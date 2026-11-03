// ==========================================================================
// Chiffrement de bout en bout (Web Crypto API, entièrement dans le navigateur)
//
//  mot de passe ──PBKDF2-SHA256 (600 000 itérations, sel lié à l'e-mail)──► clé maîtresse
//     clé maîtresse ──HKDF « auth »──► secret de connexion envoyé à Firebase
//     clé maîtresse ──HKDF « enc »───► clé de protection (KEK)
//  clé de données (DEK, AES-GCM 256 aléatoire) ──chiffrée par KEK──► stockée dans Firestore
//  clé de secours (160 bits aléatoires) ──PBKDF2──► 2e KEK ──► 2e copie chiffrée de la DEK
//
//  Le vrai mot de passe ne quitte jamais le navigateur : Firebase ne reçoit
//  qu'un secret dérivé, à partir duquel on ne peut pas retrouver la KEK.
//  Firestore ne stocke que des blocs { iv, ct } illisibles.
// ==========================================================================

const enc = new TextEncoder();
const dec = new TextDecoder();
export const KDF_ITERATIONS = 600_000;
const RECOVERY_ITERATIONS = 210_000;
const VERSION = 1;

export function b64(bytes) {
  bytes = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
export function unb64(str) {
  const s = atob(str);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}
const b64url = (bytes) => b64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const rand = (n) => crypto.getRandomValues(new Uint8Array(n));

async function pbkdf2Bits(secret, salt, iterations) {
  const base = await crypto.subtle.importKey('raw', typeof secret === 'string' ? enc.encode(secret) : secret, 'PBKDF2', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, base, 256));
}
async function hkdfBits(ikm, info) {
  const base = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: enc.encode('trousse/v1'), info: enc.encode(info) }, base, 256));
}
async function importAes(raw, usages, extractable = false) {
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, extractable, usages);
}

/** Sel déterministe : il doit être connu AVANT la connexion (même principe que Bitwarden). */
async function emailSalt(email) {
  const h = await crypto.subtle.digest('SHA-256', enc.encode('trousse:kdf:v1:' + email.trim().toLowerCase()));
  return new Uint8Array(h);
}

/**
 * Dérive, à partir du mot de passe, le secret de connexion Firebase et la clé de protection.
 * ~0,5 à 1,5 s volontairement : c'est ce qui rend les attaques par force brute très coûteuses.
 */
export async function deriveFromPassword(email, password) {
  const master = await pbkdf2Bits(password.normalize('NFKC'), await emailSalt(email), KDF_ITERATIONS);
  const authBits = await hkdfBits(master, 'auth');
  const kekBits = await hkdfBits(master, 'enc');
  master.fill(0);
  const kek = await importAes(kekBits, ['encrypt', 'decrypt']);
  kekBits.fill(0);
  return { authSecret: 'tr1.' + b64url(authBits), kek };
}

/** Clé de données aléatoire (extractible uniquement pour pouvoir la protéger). */
export async function generateDataKey() {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
}

export async function wrapKey(dek, kek) {
  const raw = new Uint8Array(await crypto.subtle.exportKey('raw', dek));
  const iv = rand(12);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, kek, raw));
  raw.fill(0);
  return { iv: b64(iv), ct: b64(ct) };
}
export async function unwrapKey(wrapped, kek) {
  const raw = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(wrapped.iv) }, kek, unb64(wrapped.ct)));
  const key = await importAes(raw, ['encrypt', 'decrypt'], true);
  raw.fill(0);
  return key;
}

// ---------- Clé de secours ----------
const B32 = 'ABCDEFGHJKMNPQRSTVWXYZ0123456789'.split(''); // sans I, L, O, U : pas de confusion à la lecture
export function generateRecoveryKey() {
  const bytes = rand(20); // 160 bits
  let bits = '';
  for (const b of bytes) bits += b.toString(2).padStart(8, '0');
  let out = '';
  for (let i = 0; i < bits.length; i += 5) out += B32[parseInt(bits.slice(i, i + 5), 2)];
  return out.match(/.{4}/g).join('-'); // 8 groupes de 4 caractères
}
export function normalizeRecoveryKey(k) {
  return (k || '').toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1').replace(/U/g, 'V');
}
export function isValidRecoveryKey(k) { return normalizeRecoveryKey(k).length === 32; }
async function recoveryKek(key, salt) {
  const bits = await pbkdf2Bits(normalizeRecoveryKey(key), salt, RECOVERY_ITERATIONS);
  const kek = await importAes(bits, ['encrypt', 'decrypt']);
  bits.fill(0);
  return kek;
}

/** Prépare tout le trousseau d'un nouveau compte. */
export async function createKeyring(kek) {
  const dek = await generateDataKey();
  const recoveryKey = generateRecoveryKey();
  const rSalt = rand(16);
  const keyring = {
    v: VERSION,
    kdf: { alg: 'PBKDF2-SHA256+HKDF', iterations: KDF_ITERATIONS },
    byPassword: await wrapKey(dek, kek),
    byRecovery: { salt: b64(rSalt), iterations: RECOVERY_ITERATIONS, ...(await wrapKey(dek, await recoveryKek(recoveryKey, rSalt))) },
  };
  return { dek, recoveryKey, keyring };
}
export async function unlockWithRecovery(keyring, recoveryKey) {
  const r = keyring.byRecovery;
  return unwrapKey(r, await recoveryKek(recoveryKey, unb64(r.salt)));
}

// ---------- Chiffrement des données ----------
/** Chiffre n'importe quel objet JSON. Le « contexte » (ex. identifiant du document) est authentifié. */
export async function encryptJSON(dek, obj, context = '') {
  const iv = rand(12);
  const data = enc.encode(JSON.stringify(obj));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: enc.encode(context) }, dek, data));
  return { v: VERSION, iv: b64(iv), ct: b64(ct) };
}
export async function decryptJSON(dek, box, context = '') {
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(box.iv), additionalData: enc.encode(context) }, dek, unb64(box.ct));
  return JSON.parse(dec.decode(pt));
}

// ---------- Conservation de la clé pendant la session de l'onglet ----------
const SS_KEY = 'trousse.session.k';
export async function stashKey(dek) {
  const raw = new Uint8Array(await crypto.subtle.exportKey('raw', dek));
  sessionStorage.setItem(SS_KEY, b64(raw));
  raw.fill(0);
}
export async function restoreKey() {
  const s = sessionStorage.getItem(SS_KEY);
  if (!s) return null;
  try { return await importAes(unb64(s), ['encrypt', 'decrypt'], true); } catch { return null; }
}
export function forgetKey() { sessionStorage.removeItem(SS_KEY); }

/** Évalue grossièrement la robustesse d'un mot de passe (0 à 4). */
export function passwordStrength(pw) {
  if (!pw) return 0;
  let pool = 0;
  if (/[a-z]/.test(pw)) pool += 26;
  if (/[A-Z]/.test(pw)) pool += 26;
  if (/\d/.test(pw)) pool += 10;
  if (/[^a-zA-Z0-9]/.test(pw)) pool += 30;
  const uniq = new Set(pw).size;
  const bits = Math.log2(Math.max(pool, 1)) * Math.min(pw.length, uniq * 1.6);
  if (pw.length < 10) return Math.min(1, bits > 30 ? 1 : 0);
  return bits < 45 ? 1 : bits < 60 ? 2 : bits < 80 ? 3 : 4;
}
