// Petites fonctions utilitaires partagées.

/** Identifiant aléatoire court (jamais dérivé d'un nom d'élève). */
export function uid(prefix = '') {
  const b = crypto.getRandomValues(new Uint8Array(9));
  return prefix + Array.from(b, (x) => 'abcdefghijkmnpqrstuvwxyz23456789'[x % 32]).join('');
}

/** Entier aléatoire uniforme dans [0, n) — tirage cryptographique, sans biais. */
export function randInt(n) {
  if (n <= 1) return 0;
  const max = Math.floor(0xffffffff / n) * n;
  const buf = new Uint32Array(1);
  let x;
  do { crypto.getRandomValues(buf); x = buf[0]; } while (x >= max);
  return x % n;
}

export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = randInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Générateur pseudo-aléatoire reproductible (données de démonstration). */
export function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export function debounce(fn, ms) {
  let t;
  const d = (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  d.flush = (...args) => { clearTimeout(t); fn(...args); };
  d.cancel = () => clearTimeout(t);
  return d;
}

/** Normalise pour la recherche : minuscules, sans accents. */
export function norm(s) {
  return (s || '').toString().normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/** Recherche floue simple : toutes les lettres de q apparaissent dans l'ordre. */
export function fuzzyScore(q, text) {
  q = norm(q); text = norm(text);
  if (!q) return 1;
  const idx = text.indexOf(q);
  if (idx === 0) return 100;
  if (idx > 0) return 80 - Math.min(idx, 40) / 2 + (text[idx - 1] === ' ' ? 10 : 0);
  let ti = 0, score = 0, streak = 0;
  for (const c of q) {
    const f = text.indexOf(c, ti);
    if (f < 0) return 0;
    streak = f === ti ? streak + 1 : 0;
    score += 1 + streak;
    ti = f + 1;
  }
  return Math.min(60, score * 2);
}

const nf1 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1, minimumFractionDigits: 0 });
const nf2 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2, minimumFractionDigits: 0 });
export const fmt1 = (n) => (n == null || Number.isNaN(n) ? '—' : nf1.format(n));
export const fmt2 = (n) => (n == null || Number.isNaN(n) ? '—' : nf2.format(n));

export function plural(n, one, many) { return `${n} ${n > 1 ? many : one}`; }

/** Affichage d'un élève : « Prénom N. » ou complet. */
export function shortName(s, all = []) {
  if (!s) return '';
  const first = s.first || '';
  if (!s.last) return first;
  // Ajoute l'initiale seulement si un autre élève porte le même prénom.
  const dup = all.some((o) => o.id !== s.id && norm(o.first) === norm(first));
  return dup ? `${first} ${s.last[0].toUpperCase()}.` : first;
}
export function fullName(s) { return [s.first, s.last].filter(Boolean).join(' '); }

export function initials(s) {
  return ((s.first || '?')[0] + (s.last ? s.last[0] : '')).toUpperCase();
}

/** Découpe une ligne « DUPONT Marie », « Marie Dupont », « Dupont, Marie » ou « Marie D. ». */
export function parseStudentLine(line) {
  let l = line.replace(/\t+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!l) return null;
  l = l.replace(/^\d+[.)\-\s]+/, ''); // numéros de liste
  if (l.includes(',')) {
    const [a, b] = l.split(',').map((x) => x.trim());
    return { first: cap(b), last: cap(a) };
  }
  const parts = l.split(' ');
  if (parts.length === 1) return { first: cap(parts[0]), last: '' };
  // Format Pronote / École Directe : NOM(S) EN MAJUSCULES puis prénom.
  const upper = parts.filter((p) => p.length > 1 && p === p.toUpperCase() && /[A-ZÀ-Ý]/.test(p));
  if (upper.length && upper.length < parts.length) {
    const last = parts.filter((p) => upper.includes(p)).join(' ');
    const first = parts.filter((p) => !upper.includes(p)).join(' ');
    return { first: cap(first), last: cap(last) };
  }
  return { first: cap(parts[0]), last: cap(parts.slice(1).join(' ')) };
}
function cap(s) {
  return (s || '').toLowerCase().replace(/(^|[\s\-'’])(\p{L})/gu, (m, a, b) => a + b.toUpperCase());
}

export function parseGrade(raw) {
  if (raw == null) return null;
  const s = String(raw).trim().toLowerCase().replace(',', '.');
  if (!s) return null;
  if (/^(abs|absent|a)$/.test(s)) return 'abs';
  if (/^(disp|dispense|dispensé|d|nn|n\.n\.)$/.test(s)) return 'disp';
  const m = s.match(/^(-?\d+(?:\.\d+)?)(?:\s*\/\s*\d+(?:\.\d+)?)?$/);
  if (!m) return undefined; // invalide
  return Number(m[1]);
}

export function prefersReducedMotion() {
  return matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.motion === 'reduce';
}

export function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.rel = 'noopener';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function relTime(ts) {
  if (!ts) return '';
  const d = (Date.now() - ts) / 1000;
  if (d < 60) return 'à l’instant';
  if (d < 3600) return `il y a ${Math.round(d / 60)} min`;
  if (d < 86400) return `il y a ${Math.round(d / 3600)} h`;
  if (d < 86400 * 7) return `il y a ${Math.round(d / 86400)} j`;
  return new Date(ts).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

export function isTyping(e) {
  const t = e.target;
  return t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
}
