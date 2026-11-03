// Briques d'interface partagées : icônes, logo, routeur, dialogues, toasts, thème.
import { html, render, useState, useEffect, useRef } from '../vendor/preact.js';
import { ICONS } from './icon-data.js';
import { getState, subscribe } from '../lib/store.js';

export { html };

// ---------- Icônes ----------
export function Icon({ name, size, label, ...rest }) {
  const body = ICONS[name] || '';
  return html`<svg viewBox="0 0 24 24" width=${size || 24} height=${size || 24} fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden=${label ? undefined : 'true'} role=${label ? 'img' : undefined} aria-label=${label} dangerouslySetInnerHTML=${{ __html: body }} ...${rest}></svg>`;
}

// ---------- Logo ----------
// Une trousse vue de face : la fermeture éclair dessine un sourire, la tirette est le stylo rouge.
export function Logo({ size = 30, title }) {
  return html`<svg viewBox="0 0 48 48" width=${size} height=${size} role=${title ? 'img' : undefined} aria-hidden=${title ? undefined : 'true'} aria-label=${title}>
    <rect x="4" y="11" width="40" height="30" rx="11" fill="var(--logo-body, #2e44c9)"/>
    <path d="M10 21.5c4.2 3.1 9 4.6 14 4.6s9.8-1.5 14-4.6" fill="none" stroke="var(--logo-zip, #fbf8f1)" stroke-width="2.6" stroke-linecap="round" stroke-dasharray="0.1 4.4"/>
    <path d="M10 21.5c4.2 3.1 9 4.6 14 4.6s9.8-1.5 14-4.6" fill="none" stroke="var(--logo-zip, #fbf8f1)" stroke-width="1.2" stroke-linecap="round" opacity=".55"/>
    <rect x="34.2" y="5" width="5.6" height="20" rx="2.8" transform="rotate(28 37 15)" fill="var(--logo-pen, #d93b30)"/>
    <circle cx="38" cy="22.6" r="2.6" fill="var(--logo-zip, #fbf8f1)" stroke="var(--logo-body, #2e44c9)" stroke-width="1.6"/>
  </svg>`;
}

// ---------- Store ----------
export function useStore() {
  const [s, setS] = useState(getState());
  useEffect(() => { const off = subscribe(setS); setS(getState()); return off; }, []);
  return s;
}

// ---------- Routeur (hash, aucune donnée d'élève dans l'URL) ----------
export function currentPath() {
  const h = location.hash.replace(/^#/, '') || '/';
  return h.split('?')[0];
}
export function navigate(path, { replace = false } = {}) {
  if (replace) history.replaceState(null, '', '#' + path);
  else location.hash = path;
  if (replace) window.dispatchEvent(new HashChangeEvent('hashchange'));
}
export function useRoute() {
  const [p, setP] = useState(currentPath());
  useEffect(() => {
    const on = () => setP(currentPath());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return p;
}
export function Link({ href, children, ...rest }) {
  return html`<a href=${'#' + href} ...${rest}>${children}</a>`;
}

// ---------- Dialogue (élément <dialog> natif : piège du focus et Échap inclus) ----------
export function Dialog({ open, onClose, title, desc, children, footer, wide, className = '', labelledBy }) {
  const ref = useRef();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) { d.showModal(); requestAnimationFrame(() => d.querySelector('[autofocus]')?.focus()); }
    if (!open && d.open) d.close();
  }, [open]);
  useEffect(() => {
    const d = ref.current;
    const onCancel = (e) => { e.preventDefault(); onClose?.(); };
    d.addEventListener('cancel', onCancel);
    return () => d.removeEventListener('cancel', onCancel);
  }, [onClose]);
  const onClick = (e) => { if (e.target === ref.current) onClose?.(); };
  const tid = labelledBy || (title ? 'dlg-t-' + title.length + title.charCodeAt(0) : undefined);
  return html`<dialog ref=${ref} class=${`dlg ${wide ? 'wide' : ''} ${className}`} aria-labelledby=${tid} onClick=${onClick}>
    ${open && html`
      ${title && html`<div class="dlg-head"><div style="flex:1"><h2 id=${tid}>${title}</h2>${desc && html`<p>${desc}</p>`}</div>
        <button class="btn btn-ghost btn-icon btn-sm" onClick=${onClose} aria-label="Fermer"><${Icon} name="x"/></button></div>`}
      ${children}
      ${footer && html`<div class="dlg-foot">${footer}</div>`}`}
  </dialog>`;
}

/** Dialogue de confirmation impératif : `if (await confirmDialog({...}))`. */
export function confirmDialog({ title, body, ok = 'Confirmer', cancel = 'Annuler', danger = false }) {
  return new Promise((resolve) => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const done = (v) => { render(null, host); host.remove(); resolve(v); };
    function C() {
      return html`<${Dialog} open=${true} onClose=${() => done(false)} title=${title}
        footer=${html`<button class="btn" onClick=${() => done(false)}>${cancel}</button>
          <button class=${`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick=${() => done(true)} autofocus>${ok}</button>`}>
        ${body && html`<div class="dlg-body"><p style="color:var(--ink-2)">${body}</p></div>`}
      </${Dialog}>`;
    }
    render(html`<${C}/>`, host);
  });
}

// ---------- Toasts ----------
let toastHost;
let toastId = 0;
const toastList = [];
let toastRender = () => {};
export function toast(message, { icon = 'circle-check', action, duration = 4200 } = {}) {
  if (!toastHost) {
    toastHost = document.createElement('div');
    document.body.appendChild(toastHost);
    function Host() {
      const [, force] = useState(0);
      toastRender = () => force((x) => x + 1);
      return html`<div class="toasts" role="status" aria-live="polite">${toastList.map((t) => html`
        <div class=${`toast ${t.out ? 'out' : ''}`} key=${t.id}><${Icon} name=${t.icon}/><span>${t.message}</span>
        ${t.action && html`<button class="btn btn-sm" onClick=${() => { t.action.run(); dismiss(t.id); }}>${t.action.label}</button>`}</div>`)}</div>`;
    }
    render(html`<${Host}/>`, toastHost);
  }
  const t = { id: ++toastId, message, icon, action };
  toastList.push(t);
  if (toastList.length > 3) toastList.shift();
  toastRender();
  setTimeout(() => dismiss(t.id), duration);
}
function dismiss(id) {
  const t = toastList.find((x) => x.id === id);
  if (!t || t.out) return;
  t.out = true; toastRender();
  setTimeout(() => { const i = toastList.indexOf(t); if (i >= 0) toastList.splice(i, 1); toastRender(); }, 230);
}

// ---------- Thème & projection ----------
const mq = matchMedia('(prefers-color-scheme: dark)');
export function themePref() { try { return localStorage.getItem('trousse.theme') || 'system'; } catch { return 'system'; } }
export function applyTheme(pref = themePref()) {
  const dark = pref === 'dark' || (pref === 'system' && mq.matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0f1513' : '#fbf8f1');
}
mq.addEventListener?.('change', () => applyTheme());
export function setTheme(pref) {
  try { localStorage.setItem('trousse.theme', pref); } catch {}
  document.documentElement.classList.add('theme-switching');
  applyTheme(pref);
  setTimeout(() => document.documentElement.classList.remove('theme-switching'), 450);
  window.dispatchEvent(new Event('themechange'));
}
export function toggleTheme() {
  setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
}
export function isProjection() { return document.documentElement.dataset.projection === 'on'; }
export function toggleProjection(force) {
  const on = force ?? !isProjection();
  document.documentElement.dataset.projection = on ? 'on' : 'off';
  window.dispatchEvent(new Event('projectionchange'));
  return on;
}
export function useProjection() {
  const [p, setP] = useState(isProjection());
  useEffect(() => {
    const on = () => setP(isProjection());
    window.addEventListener('projectionchange', on);
    return () => window.removeEventListener('projectionchange', on);
  }, []);
  return p;
}
export function useTheme() {
  const [t, setT] = useState(document.documentElement.dataset.theme);
  useEffect(() => {
    const on = () => setT(document.documentElement.dataset.theme);
    window.addEventListener('themechange', on);
    mq.addEventListener?.('change', on);
    return () => { window.removeEventListener('themechange', on); mq.removeEventListener?.('change', on); };
  }, []);
  return t;
}

export async function toggleFullscreen(el = document.documentElement) {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await el.requestFullscreen?.();
  } catch {}
}
export function useFullscreen() {
  const [f, setF] = useState(!!document.fullscreenElement);
  useEffect(() => {
    const on = () => setF(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', on);
    return () => document.removeEventListener('fullscreenchange', on);
  }, []);
  return f;
}

/** Garde l'écran allumé pendant la projection (minuteur, tirage). */
export function useWakeLock(active) {
  useEffect(() => {
    if (!active || !navigator.wakeLock) return;
    let lock;
    let stop = false;
    const req = async () => { try { lock = await navigator.wakeLock.request('screen'); } catch {} };
    req();
    const vis = () => { if (!document.hidden && !stop) req(); };
    document.addEventListener('visibilitychange', vis);
    return () => { stop = true; lock?.release?.(); document.removeEventListener('visibilitychange', vis); };
  }, [active]);
}

export function useTitle(t) {
  useEffect(() => { document.title = t ? `${t} · Trousse` : 'Trousse — les outils du prof, dans une seule trousse'; }, [t]);
}

/** Raccourci clavier local à un écran (ignoré quand on tape dans un champ). */
export function useKeys(map) {
  const ref = useRef(map);
  ref.current = map; // toujours la version la plus récente (pas de valeur périmée)
  useEffect(() => {
    const on = (e) => {
      const t = e.target;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (document.querySelector('dialog[open]')) return;
      const k = e.key === ' ' ? 'Space' : e.key;
      const fn = ref.current[k] || ref.current[k.toLowerCase()];
      if (fn) { e.preventDefault(); fn(e); }
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, []);
}
