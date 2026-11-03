// Couche Firebase : authentification + Firestore. Ne manipule que des données chiffrées.
import { FIREBASE_CONFIG } from '../config.js';
import * as C from './crypto.js';

let fb = null; // module Firebase (chargé à la demande : ~700 Ko, inutile pour la démo)
let app, auth, db;

export const isConfigured = () => !!(FIREBASE_CONFIG && FIREBASE_CONFIG.apiKey);

export async function init() {
  if (db) return { auth, db };
  if (!isConfigured()) throw new Error('not-configured');
  fb = await import('../vendor/firebase.js');
  app = fb.initializeApp(FIREBASE_CONFIG);
  auth = fb.getAuth(app);
  auth.languageCode = 'fr';
  // La session s'arrête quand on ferme le navigateur (ordinateurs partagés).
  await fb.setPersistence(auth, fb.browserSessionPersistence);
  db = fb.initializeFirestore(app, {
    localCache: fb.persistentLocalCache({ tabManager: fb.persistentMultipleTabManager() }),
  });
  return { auth, db };
}

/** Attend l'état de connexion initial de Firebase. */
export async function currentUser() {
  await init();
  return new Promise((resolve) => {
    const off = fb.onAuthStateChanged(auth, (u) => { off(); resolve(u); });
  });
}

const userDoc = (uid) => fb.doc(db, 'users', uid);
const classDoc = (uid, id) => fb.doc(db, 'users', uid, 'classes', id);
const classCol = (uid) => fb.collection(db, 'users', uid, 'classes');

export function friendlyError(e) {
  const code = e?.code || e?.message || '';
  const map = {
    'auth/email-already-in-use': 'Un compte existe déjà avec cette adresse. Essayez plutôt de vous connecter.',
    'auth/invalid-email': 'Cette adresse e-mail ne semble pas valide.',
    'auth/invalid-credential': 'E-mail ou mot de passe incorrect.',
    'auth/wrong-password': 'E-mail ou mot de passe incorrect.',
    'auth/user-not-found': 'E-mail ou mot de passe incorrect.',
    'auth/too-many-requests': 'Trop de tentatives. Patientez quelques minutes avant de réessayer.',
    'auth/network-request-failed': 'Pas de connexion Internet. Vérifiez le réseau puis réessayez.',
    'auth/expired-action-code': 'Ce lien a expiré. Demandez-en un nouveau.',
    'auth/invalid-action-code': 'Ce lien n’est plus valable (déjà utilisé ou expiré). Demandez-en un nouveau.',
    'auth/requires-recent-login': 'Par sécurité, reconnectez-vous puis recommencez.',
    'not-configured': 'Les comptes ne sont pas encore activés sur ce site. Vous pouvez utiliser la démonstration.',
    'permission-denied': 'Accès refusé par le serveur.',
  };
  return map[code] || 'Une erreur inattendue est survenue. Réessayez dans un instant.';
}

// ---------- Inscription / connexion ----------
export async function signUp(email, password) {
  await init();
  const { authSecret, kek } = await C.deriveFromPassword(email, password);
  const cred = await fb.createUserWithEmailAndPassword(auth, email.trim(), authSecret);
  const { dek, recoveryKey, keyring } = await C.createKeyring(kek);
  await fb.setDoc(userDoc(cred.user.uid), { keyring, createdAt: fb.serverTimestamp() });
  await C.stashKey(dek);
  return { user: cred.user, dek, recoveryKey };
}

/**
 * Connexion. Retourne { user, dek } ou { user, needsRecovery, kek } si le mot de passe
 * a été réinitialisé : il faut alors la clé de secours pour rouvrir les données.
 */
export async function signIn(email, password) {
  await init();
  const { authSecret, kek } = await C.deriveFromPassword(email, password);
  const cred = await fb.signInWithEmailAndPassword(auth, email.trim(), authSecret);
  const snap = await fb.getDoc(userDoc(cred.user.uid));
  if (!snap.exists()) {
    // Compte créé mais trousseau jamais enregistré (coupure réseau à l'inscription) : on repart proprement.
    const { dek, recoveryKey, keyring } = await C.createKeyring(kek);
    await fb.setDoc(userDoc(cred.user.uid), { keyring, createdAt: fb.serverTimestamp() });
    await C.stashKey(dek);
    return { user: cred.user, dek, recoveryKey };
  }
  const { keyring } = snap.data();
  try {
    const dek = await C.unwrapKey(keyring.byPassword, kek);
    await C.stashKey(dek);
    return { user: cred.user, dek };
  } catch {
    return { user: cred.user, needsRecovery: true, kek, keyring };
  }
}

/** Rouvre les données avec la clé de secours, puis les protège avec le nouveau mot de passe. */
export async function recoverWithKey(keyring, recoveryKey, kek) {
  const dek = await C.unlockWithRecovery(keyring, recoveryKey);
  const byPassword = await C.wrapKey(dek, kek);
  await fb.setDoc(userDoc(auth.currentUser.uid), { keyring: { ...keyring, byPassword } }, { merge: true });
  await C.stashKey(dek);
  return dek;
}

/** Abandon des anciennes données (mot de passe ET clé de secours perdus). */
export async function startOver(kek) {
  const uid = auth.currentUser.uid;
  const snaps = await fb.getDocs(classCol(uid));
  await Promise.all(snaps.docs.map((d) => fb.deleteDoc(d.ref)));
  const ds = await fb.getDocs(docCol(uid));
  await Promise.all(ds.docs.map((d) => fb.deleteDoc(d.ref)));
  const { dek, recoveryKey, keyring } = await C.createKeyring(kek);
  await fb.setDoc(userDoc(uid), { keyring, createdAt: fb.serverTimestamp() });
  await C.stashKey(dek);
  return { dek, recoveryKey };
}

export async function resumeSession() {
  if (!isConfigured()) return null;
  const user = await currentUser();
  if (!user) return null;
  const dek = await C.restoreKey();
  if (!dek) { await fb.signOut(auth); return null; }
  return { user, dek };
}

export async function sendReset(email) {
  await init();
  const url = location.origin + location.pathname;
  await fb.sendPasswordResetEmail(auth, email.trim(), { url });
}
export async function checkResetCode(code) { await init(); return fb.verifyPasswordResetCode(auth, code); }
export async function confirmReset(code, email, newPassword) {
  await init();
  const { authSecret } = await C.deriveFromPassword(email, newPassword);
  await fb.confirmPasswordReset(auth, code, authSecret);
}

export async function changePassword(email, oldPw, newPw, dek) {
  await init();
  const oldD = await C.deriveFromPassword(email, oldPw);
  await fb.reauthenticateWithCredential(auth.currentUser, fb.EmailAuthProvider.credential(email, oldD.authSecret));
  const newD = await C.deriveFromPassword(email, newPw);
  const uid = auth.currentUser.uid;
  const snap = await fb.getDoc(userDoc(uid));
  const keyring = snap.data().keyring;
  await fb.updatePassword(auth.currentUser, newD.authSecret);
  await fb.setDoc(userDoc(uid), { keyring: { ...keyring, byPassword: await C.wrapKey(dek, newD.kek) } }, { merge: true });
}

// ---------- Documents (QCM, mots croisés…) : même principe que les classes ----------
const docCol = (uid) => fb.collection(db, 'users', uid, 'docs');
export async function loadDocs(dek) {
  const snaps = await fb.getDocs(docCol(auth.currentUser.uid));
  const out = [];
  for (const d of snaps.docs) { try { out.push(await C.decryptJSON(dek, d.data().box, 'doc:' + d.id)); } catch {} }
  return out;
}
export function watchDocs(dek, onChange) {
  return fb.onSnapshot(docCol(auth.currentUser.uid), async (snap) => {
    if (snap.metadata.hasPendingWrites) return;
    for (const ch of snap.docChanges()) {
      if (ch.type === 'removed') { onChange({ type: 'removed', id: ch.doc.id }); continue; }
      try { onChange({ type: 'upsert', doc: await C.decryptJSON(dek, ch.doc.data().box, 'doc:' + ch.doc.id) }); } catch {}
    }
  }, () => {});
}
export async function saveDocument(dek, d) {
  const box = await C.encryptJSON(dek, d, 'doc:' + d.id);
  return fb.setDoc(fb.doc(db, 'users', auth.currentUser.uid, 'docs', d.id), { box, updatedAt: fb.serverTimestamp() });
}
export async function removeDocument(id) { return fb.deleteDoc(fb.doc(db, 'users', auth.currentUser.uid, 'docs', id)); }

// ---------- Données ----------
export async function loadClasses(dek) {
  const uid = auth.currentUser.uid;
  const snaps = await fb.getDocs(classCol(uid));
  const out = [];
  for (const d of snaps.docs) {
    try { out.push(await C.decryptJSON(dek, d.data().box, 'class:' + d.id)); } catch (e) { console.warn('Document illisible ignoré', d.id); }
  }
  return out;
}

/** Écoute les changements faits depuis un autre ordinateur. */
export function watchClasses(dek, onChange) {
  const uid = auth.currentUser.uid;
  return fb.onSnapshot(classCol(uid), { includeMetadataChanges: false }, async (snap) => {
    if (snap.metadata.hasPendingWrites) return;
    for (const ch of snap.docChanges()) {
      if (ch.type === 'removed') { onChange({ type: 'removed', id: ch.doc.id }); continue; }
      try {
        const cls = await C.decryptJSON(dek, ch.doc.data().box, 'class:' + ch.doc.id);
        onChange({ type: 'upsert', cls });
      } catch { /* ignoré */ }
    }
  }, () => {});
}

/** La promesse se résout quand le serveur a confirmé l'écriture (reste en attente hors ligne). */
export async function saveClass(dek, cls) {
  const uid = auth.currentUser.uid;
  const box = await C.encryptJSON(dek, cls, 'class:' + cls.id);
  return fb.setDoc(classDoc(uid, cls.id), { box, updatedAt: fb.serverTimestamp() });
}
export async function removeClass(id) {
  return fb.deleteDoc(classDoc(auth.currentUser.uid, id));
}

/** Déconnexion : coupe la session ET efface toutes les traces locales. */
export async function signOutAndWipe() {
  C.forgetKey();
  if (!auth) return;
  try { await fb.signOut(auth); } catch {}
  try { await fb.terminate(db); await fb.clearIndexedDbPersistence(db); } catch {}
  db = null; auth = null; app = null;
  // Efface aussi d'éventuelles bases IndexedDB résiduelles de Firebase.
  try {
    const dbs = (await indexedDB.databases?.()) || [];
    for (const d of dbs) if (d.name && /firebase|firestore/i.test(d.name)) indexedDB.deleteDatabase(d.name);
  } catch {}
}

export async function deleteAccount(email, password) {
  await init();
  const d = await C.deriveFromPassword(email, password);
  await fb.reauthenticateWithCredential(auth.currentUser, fb.EmailAuthProvider.credential(email, d.authSecret));
  const uid = auth.currentUser.uid;
  const snaps = await fb.getDocs(classCol(uid));
  await Promise.all(snaps.docs.map((x) => fb.deleteDoc(x.ref)));
  const ds = await fb.getDocs(docCol(uid));
  await Promise.all(ds.docs.map((x) => fb.deleteDoc(x.ref)));
  await fb.deleteDoc(userDoc(uid));
  await fb.deleteUser(auth.currentUser);
}
