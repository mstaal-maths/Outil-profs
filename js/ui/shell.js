// Coquille de l'application : barre supérieure, palette de commandes, raccourcis.
import { html, useState, useEffect, useRef, useMemo } from '../vendor/preact.js';
import { Icon, Logo, Link, Dialog, navigate, useStore, toggleTheme, toggleProjection, useProjection, useTheme, toggleFullscreen, confirmDialog, toast } from './core.js';
import { classList, logout, hasPendingWrites, leaveDemo } from '../lib/store.js';
import { fuzzyScore, isTyping, plural } from '../lib/util.js';
import { colorHex } from '../lib/model.js';

export const TOOLS = [
  { id: 'tirage', name: 'Tirage au sort', icon: 'dices', desc: 'Personne ne repasse avant que tout le monde soit passé.', phase: 1, key: '1' },
  { id: 'groupes', name: 'Groupes', icon: 'users', desc: 'Aléatoires, hétérogènes ou homogènes, avec vos contraintes.', phase: 1, key: '2' },
  { id: 'minuteur', name: 'Minuteur', icon: 'timer', desc: 'Lisible du fond de la classe, avec signal de fin.', phase: 1, key: '3' },
  { id: 'plan', name: 'Plan de classe', icon: 'armchair', desc: 'Dessinez votre vraie salle, placez vos élèves, imprimez.', phase: 1, key: '4' },
  { id: 'appreciations', name: 'Appréciations', icon: 'message-square-text', desc: 'Choisissez l’élève, 4 clics, et l’appréciation est rédigée.', phase: 1, key: '5' },
  { id: 'bruit', name: 'Bruitomètre', icon: 'volume-2', desc: 'Le bruit de la classe, visible par tous : vert, orange, rouge.', phase: 1, key: '6' },
];

// ---------- Indicateur d'enregistrement ----------
export function SaveStatus() {
  const s = useStore();
  const map = {
    saved: ['Enregistré', html`<svg viewBox="0 0 24 24" class="check-draw" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>`],
    saving: ['Enregistrement…', html`<span class="dot"></span>`],
    offline: ['En attente de connexion', html`<${Icon} name="cloud-off"/>`],
    error: ['Nouvel essai en cours…', html`<${Icon} name="triangle-alert"/>`],
    demo: ['Démo · rien n’est enregistré', html`<${Icon} name="eye"/>`],
  };
  const m = map[s.save];
  if (!m) return null;
  const title = {
    saved: 'Toutes vos modifications sont enregistrées et chiffrées.',
    saving: 'Vos modifications sont en cours d’envoi, chiffrées.',
    offline: 'Pas de connexion : vos modifications sont gardées sur cet ordinateur et seront envoyées automatiquement au retour du réseau.',
    error: 'Le serveur n’a pas répondu. Vos modifications sont gardées ; nouvel essai automatique.',
    demo: 'Mode démonstration : les données sont fictives et disparaissent à la fermeture de l’onglet.',
  }[s.save];
  return html`<span class="save-status" data-state=${s.save} title=${title} role="status" aria-live="polite" key=${s.save}>${m[1]}<span class="hide-sm">${m[0]}</span><span class="sr-only show-sm">${m[0]}</span></span>`;
}

// ---------- Barre supérieure ----------
export function Topbar({ crumbs = [] }) {
  const s = useStore();
  const proj = useProjection();
  const theme = useTheme();
  const [scrolled, setScrolled] = useState(false);
  const [menu, setMenu] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(scrollY > 4);
    on(); addEventListener('scroll', on, { passive: true });
    return () => removeEventListener('scroll', on);
  }, []);
  const home = s.mode === 'none' ? '/' : '/classes';
  return html`<header class=${`topbar ${scrolled ? 'scrolled' : ''}`}>
    <a class="brand" href=${'#' + home} aria-label="Trousse — accueil"><${Logo}/><span class="hide-sm">trousse</span></a>
    ${crumbs.length > 0 && html`<nav class="crumbs" aria-label="Fil d’Ariane"><span class="sep" aria-hidden="true">/</span>
      ${crumbs.map((c, i) => i === crumbs.length - 1
        ? html`<span aria-current="page">${c.label}</span>`
        : html`<a href=${'#' + c.href}>${c.label}</a><span class="sep" aria-hidden="true">/</span>`)}</nav>`}
    <div class="spacer"></div>
    ${s.mode !== 'none' && html`<${SaveStatus}/>`}
    <button class="search-trigger" onClick=${() => openPalette()} aria-label="Rechercher un outil ou une classe (Ctrl+K)">
      <${Icon} name="search"/><span class="label-text">Rechercher…</span><span class="kbd">${navigator.platform?.includes('Mac') ? '⌘' : 'Ctrl'} K</span></button>
    <a class="btn btn-sm ia-top" href="#/ia" title="Demander à une IA"><${Icon} name="sparkles"/><span class="hide-sm">Demander à une IA</span></a>
    <button class=${`btn btn-ghost btn-icon hide-sm ${proj ? 'is-on' : ''}`} onClick=${() => toggleProjection()} aria-pressed=${proj} title="Mode projection (P)" aria-label="Mode projection"><${Icon} name="presentation"/></button>
    <button class="btn btn-ghost btn-icon" onClick=${toggleTheme} title=${theme === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre'} aria-label=${theme === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre'}>
      <span class="theme-ico" data-t=${theme}><${Icon} name=${theme === 'dark' ? 'sun' : 'moon'}/></span></button>
    ${s.mode === 'cloud' && html`<div class="menu-wrap">
      <button class="avatar" onClick=${() => setMenu(!menu)} aria-expanded=${menu} aria-haspopup="menu" aria-label="Mon compte">${(s.user?.email || '?')[0].toUpperCase()}</button>
      ${menu && html`<${AccountMenu} onClose=${() => setMenu(false)} email=${s.user?.email}/>`}</div>`}
    ${s.mode === 'demo' && html`<a class="btn btn-primary btn-sm hide-sm" href="#/inscription">Créer mon compte</a>`}
    ${s.mode === 'none' && html`<a class="btn btn-sm" href="#/connexion">Se connecter</a>`}
  </header>`;
}

function AccountMenu({ onClose, email }) {
  const ref = useRef();
  useEffect(() => {
    const on = (e) => { if (!ref.current?.contains(e.target)) onClose(); };
    const key = (e) => { if (e.key === 'Escape') onClose(); };
    setTimeout(() => document.addEventListener('click', on));
    document.addEventListener('keydown', key);
    ref.current?.querySelector('a,button')?.focus();
    return () => { document.removeEventListener('click', on); document.removeEventListener('keydown', key); };
  }, []);
  return html`<div class="menu" role="menu" ref=${ref}>
    <div class="menu-head"><div class="eyebrow">Connecté</div><div class="menu-email">${email}</div></div>
    <a role="menuitem" href="#/classes" onClick=${onClose}><${Icon} name="graduation-cap"/>Mes classes</a>
    <a role="menuitem" href="#/compte" onClick=${onClose}><${Icon} name="settings"/>Mon compte & sécurité</a>
    <button role="menuitem" onClick=${() => { onClose(); openShortcuts(); }}><${Icon} name="keyboard"/>Raccourcis clavier</button>
    <hr class="divider"/>
    <button role="menuitem" onClick=${() => { onClose(); doLogout(); }}><${Icon} name="log-out"/>Se déconnecter</button>
  </div>`;
}

export async function doLogout() {
  if (hasPendingWrites()) {
    const ok = await confirmDialog({ title: 'Des modifications ne sont pas encore envoyées', body: 'Vous semblez hors connexion. Si vous vous déconnectez maintenant, les dernières modifications seront perdues. Reconnectez-vous au réseau quelques secondes, puis réessayez.', ok: 'Me déconnecter quand même', danger: true });
    if (!ok) return;
  }
  await logout();
  navigate('/', { replace: true });
  toast('Vous êtes déconnecté. Plus aucune donnée ne reste sur cet ordinateur.', { icon: 'shield-check' });
}

// ---------- Palette de commandes (Ctrl+K) ----------
let paletteOpener = () => {};
export const openPalette = () => paletteOpener(true);
let shortcutsOpener = () => {};
export const openShortcuts = () => shortcutsOpener(true);

function buildCommands(s, path) {
  const cmds = [];
  const inClass = path.match(/^\/classes\/([^/]+)/)?.[1];
  const classes = s.mode === 'none' ? [] : classList();
  const cur = inClass && s.classes[inClass];
  if (cur) {
    for (const t of TOOLS.filter((x) => x.phase === 1)) cmds.push({ group: cur.name, label: t.name, icon: t.icon, run: () => navigate(`/classes/${cur.id}/${t.id}`), kw: t.desc });
    cmds.push({ group: cur.name, label: 'Élèves', icon: 'users', run: () => navigate(`/classes/${cur.id}`) });
    cmds.push({ group: cur.name, label: 'Notes', icon: 'file-text', run: () => navigate(`/classes/${cur.id}/notes`) });
  }
  for (const c of classes) {
    cmds.push({ group: 'Classes', label: c.name, icon: 'graduation-cap', color: colorHex(c.color), hint: plural(c.students.length, 'élève', 'élèves'), run: () => navigate(`/classes/${c.id}`) });
    for (const t of TOOLS.filter((x) => x.phase === 1 && x.id !== 'minuteur')) cmds.push({ group: 'Outils', label: `${t.name} — ${c.name}`, icon: t.icon, run: () => navigate(`/classes/${c.id}/${t.id}`), hidden: true });
    for (const st of c.students) cmds.push({ group: 'Élèves', label: `${st.first} ${st.last}`.trim(), icon: 'user-plus', hint: c.name, run: () => navigate(`/classes/${c.id}`), hidden: true });
  }
  if (s.mode !== 'none') cmds.push({ group: 'Actions', label: 'Nouvelle classe', icon: 'plus', run: () => navigate('/classes?nouvelle'), kw: 'créer ajouter' });
  cmds.push({ group: 'Outils', label: 'Demander à une IA', icon: 'sparkles', run: () => navigate('/ia'), kw: 'prompt intelligence artificielle chatgpt mistral claude cours exercices évaluation dys' });
  cmds.push({ group: 'Outils', label: 'Bruitomètre', icon: 'volume-2', run: () => navigate(cur ? `/classes/${cur.id}/bruit` : '/bruit'), kw: 'bruit son micro silence calme' });
  cmds.push({ group: 'Outils', label: 'Minuteur', icon: 'timer', run: () => navigate(cur ? `/classes/${cur.id}/minuteur` : '/minuteur'), kw: 'chrono compte à rebours' });
  cmds.push({ group: 'Affichage', label: 'Basculer clair / sombre', icon: 'moon', run: toggleTheme, hint: 'Maj+D', kw: 'thème nuit' });
  cmds.push({ group: 'Affichage', label: 'Mode projection', icon: 'presentation', run: () => toggleProjection(), hint: 'P', kw: 'vidéoprojecteur tableau' });
  cmds.push({ group: 'Affichage', label: 'Plein écran', icon: 'maximize', run: () => toggleFullscreen(), hint: 'F' });
  cmds.push({ group: 'Aide', label: 'Raccourcis clavier', icon: 'keyboard', run: openShortcuts, hint: '?' });
  if (s.mode === 'none') {
    cmds.push({ group: 'Commencer', label: 'Essayer sans compte', icon: 'sparkles', run: () => navigate('/demo') });
    cmds.push({ group: 'Commencer', label: 'Se connecter', icon: 'key-round', run: () => navigate('/connexion') });
    cmds.push({ group: 'Commencer', label: 'Créer un compte', icon: 'user-plus', run: () => navigate('/inscription') });
  } else if (s.mode === 'cloud') {
    cmds.push({ group: 'Compte', label: 'Mon compte & sécurité', icon: 'settings', run: () => navigate('/compte') });
    cmds.push({ group: 'Compte', label: 'Se déconnecter', icon: 'log-out', run: doLogout });
  } else {
    cmds.push({ group: 'Commencer', label: 'Créer mon compte', icon: 'user-plus', run: () => navigate('/inscription') });
    cmds.push({ group: 'Commencer', label: 'Quitter la démonstration', icon: 'log-out', run: () => { leaveDemo(); navigate('/'); } });
  }
  cmds.push({ group: 'Navigation', label: 'Accueil du site', icon: 'house', run: () => navigate('/') });
  return cmds;
}

export function CommandPalette({ path }) {
  const s = useStore();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const listRef = useRef();
  paletteOpener = (v) => { setOpen(v); setQ(''); setSel(0); };
  const cmds = useMemo(() => (open ? buildCommands(s, path) : []), [open, s, path]);
  const results = useMemo(() => {
    if (!q.trim()) return cmds.filter((c) => !c.hidden);
    return cmds.map((c) => ({ c, sc: Math.max(fuzzyScore(q, c.label), fuzzyScore(q, c.kw || '') * 0.7, fuzzyScore(q, c.group) * 0.4) }))
      .filter((x) => x.sc > 8).sort((a, b) => b.sc - a.sc).slice(0, 40).map((x) => x.c);
  }, [q, cmds]);
  useEffect(() => { setSel(0); }, [q]);
  useEffect(() => { listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' }); }, [sel]);
  const run = (c) => { setOpen(false); setTimeout(() => c.run(), 10); };
  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel((x) => Math.min(results.length - 1, x + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((x) => Math.max(0, x - 1)); }
    else if (e.key === 'Enter' && results[sel]) { e.preventDefault(); run(results[sel]); }
  };
  let lastGroup = null;
  return html`<${Dialog} open=${open} onClose=${() => setOpen(false)} className="cmdk" labelledBy="cmdk-label">
    <label id="cmdk-label" class="sr-only" for="cmdk-input">Rechercher une classe, un élève, un outil ou une action</label>
    <div class="cmdk-input"><${Icon} name="search"/>
      <input id="cmdk-input" autofocus placeholder="Classe, élève, outil, action…" value=${q} onInput=${(e) => setQ(e.target.value)} onKeyDown=${onKey}
        role="combobox" aria-expanded="true" aria-controls="cmdk-list" aria-activedescendant=${results[sel] ? 'cmd-' + sel : undefined} autocomplete="off" spellcheck="false"/>
      <span class="kbd">Échap</span></div>
    <div class="cmdk-list" id="cmdk-list" role="listbox" ref=${listRef}>
      ${results.length === 0 && html`<div class="cmdk-empty">Aucun résultat pour « ${q} ».<br/><span class="hint">Essayez un nom de classe, d’élève ou d’outil.</span></div>`}
      ${results.map((c, i) => {
        const g = c.group !== lastGroup ? (lastGroup = c.group) : null;
        return html`${g && html`<div class="cmdk-group" role="presentation">${g}</div>`}
          <div class="cmdk-item" id=${'cmd-' + i} role="option" aria-selected=${i === sel} onMouseMove=${() => i !== sel && setSel(i)} onClick=${() => run(c)}>
            ${c.color ? html`<span class="class-dot" style=${`--c:${c.color}`}></span>` : html`<${Icon} name=${c.icon}/>`}<span>${c.label}</span>${c.hint && html`<span class="hint">${c.hint}</span>`}</div>`;
      })}
    </div>
    <div class="cmdk-foot"><span><span class="kbd">↑</span><span class="kbd">↓</span> naviguer</span><span><span class="kbd">Entrée</span> ouvrir</span><span><span class="kbd">Échap</span> fermer</span></div>
  </${Dialog}>`;
}

export function ShortcutsDialog() {
  const [open, setOpen] = useState(false);
  shortcutsOpener = setOpen;
  const rows = [
    ['Ctrl K  ou  /', 'Rechercher une classe, un élève, un outil'],
    ['P', 'Mode projection (très gros, très contrasté)'],
    ['F', 'Plein écran'],
    ['Maj D', 'Mode clair / sombre'],
    ['1 – 6', 'Dans une classe : tirage, groupes, minuteur, plan, appréciations, bruitomètre'],
    ['Espace', 'Tirer au sort · démarrer / mettre en pause le minuteur'],
    ['R', 'Minuteur : remettre à zéro'],
    ['?', 'Afficher cette aide'],
  ];
  return html`<${Dialog} open=${open} onClose=${() => setOpen(false)} title="Raccourcis clavier" desc="Pour aller vite, sans souris.">
    <div class="dlg-body"><dl class="shortcuts">${rows.map(([k, d]) => html`<div><dt>${k.split('  ou  ').map((x, i) => html`${i > 0 && html`<span class="muted"> ou </span>`}${x.split(' ').map((y) => html`<span class="kbd">${y}</span>`)}`)}</dt><dd>${d}</dd></div>`)}</dl></div>
  </${Dialog}>`;
}

/** Raccourcis globaux. */
export function installGlobalKeys(getPath) {
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openPalette(); return; }
    if (isTyping(e) || e.ctrlKey || e.metaKey || e.altKey) return;
    if (document.querySelector('dialog[open]')) return;
    if (e.key === '/') { e.preventDefault(); openPalette(); }
    else if (e.key === '?') { e.preventDefault(); openShortcuts(); }
    else if (e.key === 'p' || e.key === 'P') { if (!e.shiftKey) { e.preventDefault(); const on = toggleProjection(); toast(on ? 'Mode projection activé — appuyez sur P pour revenir' : 'Mode projection désactivé', { icon: 'presentation', duration: 2200 }); } }
    else if (e.key === 'D' && e.shiftKey) { e.preventDefault(); toggleTheme(); }
    else if (e.key === 'f' || e.key === 'F') { e.preventDefault(); toggleFullscreen(); }
    else if (/^[1-6]$/.test(e.key)) {
      const m = getPath().match(/^\/classes\/([^/]+)/);
      if (m) { const t = TOOLS[Number(e.key) - 1]; navigate(`/classes/${m[1]}/${t.id}`); }
    }
  });
}
