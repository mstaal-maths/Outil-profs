// État global de l'application + enregistrement automatique.
import * as cloud from './cloud.js';
import { demoClasses, newClass } from './model.js';

const listeners = new Set();
let state = {
  mode: 'none', // 'none' | 'demo' | 'cloud'
  ready: false,
  user: null, // { email, uid }
  classes: {}, // id → classe
  docs: {}, // id → document (QCM, mots croisés…)
  save: 'idle', // 'idle' | 'saved' | 'saving' | 'offline' | 'error' | 'demo'
  online: navigator.onLine,
};
let dek = null;
let unwatch = null;
const pending = new Map(); // id → nb d'écritures non confirmées
const timers = new Map();
const DEMO_KEY = 'trousse.demo';
const DEMO_DOCS = 'trousse.demo.docs';
let unwatchDocs = null;
// Le stockage peut être refusé (navigation privée, cadre sécurisé) : on ne bloque jamais l'application.
const ss = {
  get: (k) => { try { return sessionStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { sessionStorage.setItem(k, v); } catch {} },
  del: (k) => { try { sessionStorage.removeItem(k); } catch {} },
};

export const getState = () => state;
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function set(patch) {
  state = { ...state, ...patch };
  for (const fn of listeners) fn(state);
}

window.addEventListener('online', () => { set({ online: true }); refreshSaveState(); });
window.addEventListener('offline', () => { set({ online: false }); refreshSaveState(); });

function refreshSaveState() {
  if (state.mode === 'demo') return set({ save: 'demo' });
  if (state.mode !== 'cloud') return;
  const n = [...pending.values()].reduce((a, b) => a + b, 0) + timers.size;
  if (state.save === 'error' && n) return;
  set({ save: n === 0 ? 'saved' : state.online ? 'saving' : 'offline' });
}
export const hasPendingWrites = () => state.mode === 'cloud' && ([...pending.values()].some(Boolean) || timers.size > 0);

// ---------- Démarrage ----------
export async function boot() {
  try {
    const s = await cloud.resumeSession();
    if (s) return await enterCloud(s.user, s.dek);
  } catch (e) { console.warn(e); }
  const demo = ss.get(DEMO_KEY);
  if (demo) {
    try { return set({ mode: 'demo', ready: true, save: 'demo', classes: JSON.parse(demo), docs: JSON.parse(ss.get(DEMO_DOCS) || '{}') }); } catch {}
  }
  set({ ready: true });
}

export function startDemo(fresh = false) {
  let classes;
  const saved = !fresh && ss.get(DEMO_KEY);
  if (saved) classes = JSON.parse(saved);
  else { classes = {}; for (const c of demoClasses()) classes[c.id] = c; }
  const docs = (!fresh && JSON.parse(ss.get(DEMO_DOCS) || 'null')) || {};
  set({ mode: 'demo', ready: true, save: 'demo', classes, docs, user: null });
  persistDemo();
}
function persistDemo() {
  ss.set(DEMO_KEY, JSON.stringify(state.classes));
  ss.set(DEMO_DOCS, JSON.stringify(state.docs));
}
export function leaveDemo() {
  ss.del(DEMO_KEY); ss.del(DEMO_DOCS);
  set({ mode: 'none', classes: {}, docs: {}, save: 'idle' });
}

export async function enterCloud(user, key) {
  dek = key;
  ss.del(DEMO_KEY);
  set({ mode: 'cloud', user: { email: user.email, uid: user.uid }, classes: {}, save: 'saving', ready: false });
  try {
    const [list, dlist] = await Promise.all([cloud.loadClasses(dek), cloud.loadDocs(dek)]);
    const classes = {}, docs = {};
    for (const c of list) classes[c.id] = c;
    for (const d of dlist) docs[d.id] = d;
    set({ classes, docs, ready: true, save: 'saved' });
  } catch (e) {
    console.warn(e);
    set({ ready: true, save: state.online ? 'error' : 'offline' });
  }
  unwatchDocs?.();
  unwatchDocs = cloud.watchDocs(dek, (ch) => {
    if (ch.type === 'removed') { if (!state.docs[ch.id]) return; const docs = { ...state.docs }; delete docs[ch.id]; set({ docs }); return; }
    const k = 'd:' + ch.doc.id;
    if (timers.has(k) || pending.get(k)) return;
    const local = state.docs[ch.doc.id];
    if (local && local.updatedAt >= ch.doc.updatedAt) return;
    set({ docs: { ...state.docs, [ch.doc.id]: ch.doc } });
  });
  unwatch?.();
  unwatch = cloud.watchClasses(dek, (ch) => {
    if (ch.type === 'removed') {
      if (!state.classes[ch.id]) return;
      const classes = { ...state.classes }; delete classes[ch.id]; set({ classes });
    } else {
      const local = state.classes[ch.cls.id];
      if (timers.has(ch.cls.id) || pending.get(ch.cls.id)) return; // modification locale en cours : elle gagne
      if (local && local.updatedAt >= ch.cls.updatedAt) return;
      set({ classes: { ...state.classes, [ch.cls.id]: ch.cls } });
    }
  });
}

export async function logout() {
  unwatch?.(); unwatch = null;
  unwatchDocs?.(); unwatchDocs = null;
  for (const t of timers.values()) clearTimeout(t);
  timers.clear(); pending.clear();
  dek = null;
  await cloud.signOutAndWipe();
  try { sessionStorage.clear(); } catch {}
  // On ne garde localement que la préférence d'affichage (clair/sombre), sans aucune donnée.
  try {
    const theme = localStorage.getItem('trousse.theme');
    localStorage.clear();
    if (theme) localStorage.setItem('trousse.theme', theme);
  } catch {}
  set({ mode: 'none', user: null, classes: {}, docs: {}, save: 'idle', ready: true });
}

// ---------- Modifications ----------
function scheduleSave(id) {
  if (state.mode === 'demo') return persistDemo();
  if (state.mode !== 'cloud') return;
  clearTimeout(timers.get(id));
  timers.set(id, setTimeout(() => flush(id), 650));
  refreshSaveState();
}
async function flush(id) {
  timers.delete(id);
  const isDoc = id.startsWith('d:');
  const obj = isDoc ? state.docs[id.slice(2)] : state.classes[id];
  if (!obj) return refreshSaveState();
  pending.set(id, (pending.get(id) || 0) + 1);
  refreshSaveState();
  try {
    if (isDoc) await cloud.saveDocument(dek, obj); else await cloud.saveClass(dek, obj);
    pending.set(id, pending.get(id) - 1);
    if (state.save === 'error') set({ save: 'saving' });
  } catch (e) {
    console.warn(e);
    pending.set(id, pending.get(id) - 1);
    set({ save: 'error' });
    setTimeout(() => scheduleSave(id), 5000);
  }
  refreshSaveState();
}
export function flushAll() { for (const id of [...timers.keys()]) { clearTimeout(timers.get(id)); flush(id); } }
window.addEventListener('pagehide', flushAll);
document.addEventListener('visibilitychange', () => { if (document.hidden) flushAll(); });

/** Modifie une classe : `fn` reçoit une copie modifiable. */
export function updateClass(id, fn) {
  const cur = state.classes[id];
  if (!cur) return;
  const draft = structuredClone(cur);
  const r = fn(draft);
  const next = r || draft;
  next.updatedAt = Date.now();
  set({ classes: { ...state.classes, [id]: next } });
  scheduleSave(id);
}

export function createClass(opts) {
  const c = newClass(opts);
  if (state.mode === 'demo') c.demo = true;
  set({ classes: { ...state.classes, [c.id]: c } });
  scheduleSave(c.id);
  return c;
}
export function restoreClass(c) {
  set({ classes: { ...state.classes, [c.id]: c } });
  scheduleSave(c.id);
}
export async function deleteClass(id) {
  const classes = { ...state.classes };
  const removed = classes[id];
  delete classes[id];
  clearTimeout(timers.get(id)); timers.delete(id);
  set({ classes });
  if (state.mode === 'demo') persistDemo();
  if (state.mode === 'cloud') {
    pending.set(id, (pending.get(id) || 0) + 1); refreshSaveState();
    try { await cloud.removeClass(id); } catch (e) { set({ save: 'error' }); }
    pending.set(id, pending.get(id) - 1); refreshSaveState();
  }
  return removed;
}

// ---------- Documents ----------
export function createDoc(tool, data, name) {
  const now = Date.now();
  const d = { id: 'd_' + Math.random().toString(36).slice(2, 11), tool, name: name || data.title || 'Sans titre', data, dys: false, createdAt: now, updatedAt: now };
  set({ docs: { ...state.docs, [d.id]: d } });
  scheduleSave('d:' + d.id);
  return d;
}
export function updateDoc(id, fn) {
  const cur = state.docs[id];
  if (!cur) return;
  const draft = structuredClone(cur);
  const next = fn(draft) || draft;
  next.updatedAt = Date.now();
  set({ docs: { ...state.docs, [id]: next } });
  scheduleSave('d:' + id);
}
export async function deleteDoc(id) {
  const docs = { ...state.docs };
  const removed = docs[id];
  delete docs[id];
  clearTimeout(timers.get('d:' + id)); timers.delete('d:' + id);
  set({ docs });
  if (state.mode === 'demo') persistDemo();
  if (state.mode === 'cloud') { try { await cloud.removeDocument(id); } catch { set({ save: 'error' }); } }
  return removed;
}
export function restoreDoc(d) { set({ docs: { ...state.docs, [d.id]: d } }); scheduleSave('d:' + d.id); }
export const docList = () => Object.values(state.docs).sort((a, b) => b.updatedAt - a.updatedAt);

export const classList = () => Object.values(state.classes).sort((a, b) => a.name.localeCompare(b.name, 'fr', { numeric: true }));
