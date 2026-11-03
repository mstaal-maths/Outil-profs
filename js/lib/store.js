// État global de l'application + enregistrement automatique.
import * as cloud from './cloud.js';
import { demoClasses, newClass } from './model.js';

const listeners = new Set();
let state = {
  mode: 'none', // 'none' | 'demo' | 'cloud'
  ready: false,
  user: null, // { email, uid }
  classes: {}, // id → classe
  save: 'idle', // 'idle' | 'saved' | 'saving' | 'offline' | 'error' | 'demo'
  online: navigator.onLine,
};
let dek = null;
let unwatch = null;
const pending = new Map(); // id → nb d'écritures non confirmées
const timers = new Map();
const DEMO_KEY = 'trousse.demo';

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
  const demo = sessionStorage.getItem(DEMO_KEY);
  if (demo) {
    try { return set({ mode: 'demo', ready: true, save: 'demo', classes: JSON.parse(demo) }); } catch {}
  }
  set({ ready: true });
}

export function startDemo(fresh = false) {
  let classes;
  const saved = !fresh && sessionStorage.getItem(DEMO_KEY);
  if (saved) classes = JSON.parse(saved);
  else { classes = {}; for (const c of demoClasses()) classes[c.id] = c; }
  set({ mode: 'demo', ready: true, save: 'demo', classes, user: null });
  persistDemo();
}
function persistDemo() {
  try { sessionStorage.setItem(DEMO_KEY, JSON.stringify(state.classes)); } catch {}
}
export function leaveDemo() {
  sessionStorage.removeItem(DEMO_KEY);
  set({ mode: 'none', classes: {}, save: 'idle' });
}

export async function enterCloud(user, key) {
  dek = key;
  sessionStorage.removeItem(DEMO_KEY);
  set({ mode: 'cloud', user: { email: user.email, uid: user.uid }, classes: {}, save: 'saving', ready: false });
  try {
    const list = await cloud.loadClasses(dek);
    const classes = {};
    for (const c of list) classes[c.id] = c;
    set({ classes, ready: true, save: 'saved' });
  } catch (e) {
    console.warn(e);
    set({ ready: true, save: state.online ? 'error' : 'offline' });
  }
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
  for (const t of timers.values()) clearTimeout(t);
  timers.clear(); pending.clear();
  dek = null;
  await cloud.signOutAndWipe();
  sessionStorage.clear();
  // On ne garde localement que la préférence d'affichage (clair/sombre), sans aucune donnée.
  const theme = localStorage.getItem('trousse.theme');
  localStorage.clear();
  if (theme) localStorage.setItem('trousse.theme', theme);
  set({ mode: 'none', user: null, classes: {}, save: 'idle', ready: true });
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
  const cls = state.classes[id];
  if (!cls) return refreshSaveState();
  pending.set(id, (pending.get(id) || 0) + 1);
  refreshSaveState();
  try {
    await cloud.saveClass(dek, cls);
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

export const classList = () => Object.values(state.classes).sort((a, b) => a.name.localeCompare(b.name, 'fr', { numeric: true }));
