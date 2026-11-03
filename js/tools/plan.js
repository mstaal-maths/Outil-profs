// Outil 4 — Plan de classe (outil phare).
import { html, useState, useRef, useEffect, useMemo } from '../vendor/preact.js';
import { Icon, Dialog, toggleFullscreen, useFullscreen, toast, confirmDialog, useProjection } from '../ui/core.js';
import { updateClass } from '../lib/store.js';
import { PRESETS, ITEM_TYPES, buildLayout, seatsOf, bounds, autoPlace, planViolations, newPlan, suggestOpts, capacity, table, item, defaultItems, SEAT_W, SEAT_H, GRID } from '../lib/room.js';
import { levelMap, currentPeriod, hasGrades } from '../lib/model.js';
import { fullName, plural, prefersReducedMotion } from '../lib/util.js';
import { startDrag } from '../ui/dnd.js';
import { ConstraintsCard } from '../pages/classe.js';

const STRATEGIES = [
  { id: 'random', label: 'Au hasard', hint: 'En respectant vos contraintes' },
  { id: 'alpha', label: 'Ordre alphabétique', hint: 'Pratique en début d’année' },
  { id: 'hetero', label: 'Binômes de niveaux mêlés', hint: 'D’après les notes' },
  { id: 'mix', label: 'Alterner filles et garçons', hint: 'D’après l’accord il / elle' },
];

export function PlanTool({ cls }) {
  const plans = cls.plans || [];
  const plan = plans.find((p) => p.id === cls.activePlan) || plans[0];
  const [creating, setCreating] = useState(false);
  if (!cls.students.length) return html`<div class="empty"><h3>Ajoutez d’abord vos élèves</h3><p>Le plan de classe se remplit avec les élèves de la classe.</p><a class="btn btn-primary" href=${`#/classes/${cls.id}`}>Ajouter des élèves</a></div>`;
  if (!plan || creating) return html`<${RoomWizard} cls=${cls} onCancel=${plan ? () => setCreating(false) : null} onDone=${() => setCreating(false)}/>`;
  return html`<${PlanEditor} cls=${cls} plan=${plan} onNewRoom=${() => setCreating(true)} key=${plan.id}/>`;
}

// ---------- Assistant de création de salle ----------
function RoomWizard({ cls, onCancel, onDone }) {
  const n = cls.students.length;
  const [kind, setKind] = useState('rangees');
  const [opts, setOpts] = useState(suggestOpts('rangees', n));
  const [name, setName] = useState(cls.plans?.length ? `Salle ${cls.plans.length + 1}` : 'Salle principale');
  const tables = useMemo(() => buildLayout(kind, opts), [kind, opts]);
  const cap = capacity(tables);
  const pick = (k) => { setKind(k); setOpts(suggestOpts(k, n)); };
  const knob = (key, label, min, max) => html`<div class="knob"><span>${label}</span><div class="stepper sm">
    <button class="btn btn-icon btn-sm" onClick=${() => setOpts({ ...opts, [key]: Math.max(min, (opts[key] ?? min) - 1) })} aria-label=${label + ' : moins'}>−</button>
    <output class="tnum">${opts[key]}</output>
    <button class="btn btn-icon btn-sm" onClick=${() => setOpts({ ...opts, [key]: Math.min(max, (opts[key] ?? min) + 1) })} aria-label=${label + ' : plus'}>+</button></div></div>`;
  const create = () => {
    const p = newPlan(name.trim() || 'Salle', kind, opts);
    p.tables = tables;
    p.items = defaultItems(tables);
    if (kind === 'libre') p.startArrange = true;
    updateClass(cls.id, (c) => { c.plans = [...(c.plans || []), p]; c.activePlan = p.id; });
    onDone();
  };
  return html`<div class="wizard route-enter">
    <div class="wizard-head"><div><p class="eyebrow">Plan de classe</p><h2>Comment est organisée votre salle ?</h2><p class="sub">Choisissez un modèle : vous pourrez déplacer chaque table ensuite.</p></div>
      ${onCancel && html`<button class="btn btn-ghost" onClick=${onCancel}>Annuler</button>`}</div>
    <div class="preset-grid" role="radiogroup" aria-label="Modèle de salle">
      ${Object.entries(PRESETS).map(([k, p]) => html`<button role="radio" aria-checked=${kind === k} class="preset" onClick=${() => pick(k)}>
        <${RoomThumb} tables=${buildLayout(k, suggestOpts(k, n))}/><b>${p.label}</b><small>${p.desc}</small></button>`)}
    </div>
    <div class="wizard-body">
      <div class="wizard-preview card"><${RoomThumb} tables=${tables} big=${true}/></div>
      <div class="card side-card wizard-opts">
        <div class="field"><label for="rname">Nom de la salle</label><input id="rname" class="input" value=${name} onInput=${(e) => setName(e.target.value)} placeholder="Ex. B12"/></div>
        ${kind === 'rangees' && html`${knob('rows', 'Rangées', 1, 10)}${knob('perRow', 'Tables par rangée', 1, 6)}${knob('seats', 'Places par table', 1, 4)}`}
        ${kind === 'ilots' && html`${knob('islands', 'Îlots', 1, 12)}${knob('perLine', 'Îlots par ligne', 1, 5)}
          <div class="knob"><span>Taille d’un îlot</span><div class="seg"><button aria-pressed=${opts.islandSize === 4} onClick=${() => setOpts({ ...opts, islandSize: 4 })}>4</button><button aria-pressed=${opts.islandSize === 6} onClick=${() => setOpts({ ...opts, islandSize: 6 })}>6</button></div></div>`}
        ${kind === 'u' && html`${knob('side', 'Places sur chaque côté', 2, 10)}${knob('back', 'Places au fond', 1, 10)}
          <label class="switch"><input type="checkbox" checked=${!!opts.inner} onChange=${(e) => setOpts({ ...opts, inner: e.target.checked })}/>Rangée au centre</label>`}
        ${kind === 'examen' && html`${knob('rows', 'Rangées', 1, 10)}${knob('perRow', 'Tables par rangée', 1, 8)}`}
        ${kind === 'libre' && html`<p class="hint">Vous arriverez sur une salle vide avec un tableau et un bureau. Ajoutez ensuite vos tables, chaises, porte, fenêtres… et placez-les exactement comme chez vous.</p>`}
        ${kind !== 'libre' && html`<div class=${`cap ${cap < n ? 'short' : ''}`}><b class="tnum">${cap}</b> places pour <b class="tnum">${n}</b> élèves${cap < n ? html` — <span>il manque ${n - cap} places</span>` : ''}</div>`}
        <button class="btn btn-primary btn-lg btn-block" onClick=${create}><${Icon} name="check"/>Créer cette salle</button>
      </div>
    </div>
  </div>`;
}

function RoomThumb({ tables, big }) {
  if (!tables.length) return html`<svg class=${`thumb ${big ? 'big' : ''}`} viewBox="-300 0 600 420" aria-hidden="true">
    <rect x="-90" y="30" width="180" height="12" rx="6" class="th-board"/>
    <rect x="-250" y="70" width="500" height="320" rx="18" class="th-empty"/>
    <path d="M-20 230h40M0 210v40" class="th-plus"/></svg>`;
  const b = bounds(tables);
  const pad = 40;
  const vb = `${b.x - pad} ${Math.min(b.y, 40) - pad} ${b.w + pad * 2} ${b.y + b.h - Math.min(b.y, 40) + pad * 2}`;
  return html`<svg class=${`thumb ${big ? 'big' : ''}`} viewBox=${vb} aria-hidden="true">
    <rect x=${-90} y=${30} width="180" height="12" rx="6" class="th-board"/>
    ${tables.map((t) => html`<g transform=${`translate(${t.x} ${t.y}) rotate(${t.rot})`}><rect x=${(-t.cols * SEAT_W) / 2 + 3} y=${(-t.rows * SEAT_H) / 2 + 3} width=${t.cols * SEAT_W - 6} height=${t.rows * SEAT_H - 6} rx="8" class="th-table"/>
      ${Array.from({ length: t.cols * t.rows }, (_, i) => html`<circle cx=${(-t.cols * SEAT_W) / 2 + SEAT_W / 2 + (i % t.cols) * SEAT_W} cy=${(-t.rows * SEAT_H) / 2 + SEAT_H / 2 + Math.floor(i / t.cols) * SEAT_H} r="9" class="th-seat"/>`)}</g>`)}
  </svg>`;
}

// ---------- Éditeur ----------
const ADDABLE = [
  { k: 't2', label: 'Table de 2', icon: 'plus', make: (x, y) => table(x, y, 2, 1) },
  { k: 't1', label: 'Table de 1', icon: 'plus', make: (x, y) => table(x, y, 1, 1) },
  { k: 't4', label: 'Îlot de 4', icon: 'plus', make: (x, y) => table(x, y, 2, 2) },
  { k: 'chair', label: 'Chaise seule', icon: 'armchair', make: (x, y) => ({ ...table(x, y, 1, 1), bare: true }) },
  { k: 'board', label: 'Tableau', icon: 'presentation', item: true },
  { k: 'desk', label: 'Bureau', icon: 'graduation-cap', item: true },
  { k: 'door', label: 'Porte', icon: 'door-open', item: true },
  { k: 'window', label: 'Fenêtre', icon: 'sun', item: true },
  { k: 'cabinet', label: 'Armoire', icon: 'layers', item: true },
];
const upright = (a) => { a = ((a % 360) + 360) % 360; return a > 90 && a <= 270 ? a - 180 : a; };

function PlanEditor({ cls, plan, onNewRoom }) {
  const stageRef = useRef();
  const svgRef = useRef();
  const history = useRef([]);
  const fs = useFullscreen();
  const proj = useProjection();
  const [mode, setMode] = useState(plan.startArrange ? 'arrange' : 'place');
  const [picked, setPicked] = useState(null);
  const [sel, setSel] = useState(null); // { kind: 'table' | 'item', id }
  const [strategy, setStrategy] = useState('random');
  const [fillFront, setFillFront] = useState(true);
  const [live, setLive] = useState(null); // copie locale pendant un déplacement
  const [shuffling, setShuffling] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [, setUndoN] = useState(0);

  useEffect(() => { if (plan.startArrange) updateClass(cls.id, (c) => { delete c.plans.find((x) => x.id === plan.id).startArrange; }); }, []);

  const baseItems = plan.items || defaultItems(plan.tables);
  const tables = live ? live.tables : plan.tables;
  const items = live ? live.items : baseItems;
  const seats = useMemo(() => seatsOf(tables), [tables]);
  const seatById = useMemo(() => Object.fromEntries(seats.map((s) => [s.id, s])), [seats]);
  const assign = Object.fromEntries(Object.entries(plan.assign).filter(([seat, sid]) => seatById[seat] && cls.students.some((s) => s.id === sid)));
  const seatOf = Object.fromEntries(Object.entries(assign).map(([seat, sid]) => [sid, seat]));
  const unplaced = cls.students.filter((s) => !seatOf[s.id]);
  const flipped = plan.view === 'prof';
  const bad = planViolations(tables, assign, cls.constraints);
  const locked = new Set((plan.locked || []).filter((seat) => assign[seat]));

  // Repère d'affichage (vue du bureau = salle pivotée de 180°, texte toujours droit).
  const b = bounds(tables, items);
  const pad = 60;
  let left = b.x - pad, right = b.x + b.w + pad, top = b.y - pad, bottom = b.y + b.h + pad;
  if (right - left < 640) { const c = (left + right) / 2; left = c - 320; right = c + 320; }
  if (bottom - top < 420) { const c = (top + bottom) / 2; top = c - 210; bottom = c + 210; }
  const W = right - left, H = bottom - top;
  const P = (x, y) => (flipped ? { x: left + right - x, y: top + bottom - y } : { x, y });
  const rotD = (r) => (flipped ? r + 180 : r);

  /** Enregistre une modification du plan, en gardant l'état précédent pour « Annuler ». */
  const save = (fn, undoable = true) => {
    if (undoable) {
      history.current.push(JSON.stringify({ tables: plan.tables, items: baseItems, assign: plan.assign, locked: plan.locked || [] }));
      if (history.current.length > 60) history.current.shift();
      setUndoN(history.current.length);
    }
    updateClass(cls.id, (c) => { const p = c.plans.find((x) => x.id === plan.id); if (!p.items) p.items = defaultItems(p.tables); fn(p, c); });
  };
  const undo = () => {
    const last = history.current.pop();
    if (!last) return;
    setUndoN(history.current.length);
    const st = JSON.parse(last);
    updateClass(cls.id, (c) => { Object.assign(c.plans.find((x) => x.id === plan.id), st); });
    setSel(null);
  };
  useEffect(() => {
    const on = (e) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z' && !/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) { e.preventDefault(); undo(); }
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  });

  function place(sid, target) {
    save((p) => {
      const a = p.assign;
      const from = Object.keys(a).find((k) => a[k] === sid);
      if (target === 'tray') { if (from) { delete a[from]; p.locked = (p.locked || []).filter((x) => x !== from); } return; }
      if (from === target) return;
      const occupant = a[target];
      a[target] = sid;
      if (from) { if (occupant) a[from] = occupant; else delete a[from]; }
      const L = new Set(p.locked || []);
      if (from && L.has(from) !== L.has(target)) { const fl = L.has(from); L.delete(from); L.delete(target); if (fl) L.add(target); }
      p.locked = [...L];
    });
    setPicked(null);
  }
  const onSeatClick = (seatId) => {
    if (mode !== 'place') return;
    const occ = assign[seatId];
    if (picked) { if (occ === picked) setPicked(null); else place(picked, seatId); return; }
    if (occ) setPicked(occ);
  };
  function auto() {
    const levels = levelMap(cls, currentPeriod(cls));
    if (!seats.length) { toast('Ajoutez d’abord des tables dans « Aménager la salle ».', { icon: 'info' }); return; }
    if (strategy === 'hetero' && !hasGrades(cls)) { toast('Ajoutez des notes pour former des binômes de niveaux mêlés.', { icon: 'info' }); return; }
    if (strategy === 'mix' && !cls.students.some((s) => s.g)) { toast('Indiquez « il » ou « elle » dans la liste des élèves pour alterner.', { icon: 'info' }); return; }
    const next = autoPlace({ items, tables, students: cls.students, assign, locked: [...locked], strategy, constraints: cls.constraints, levels, fillFront });
    setShuffling(!prefersReducedMotion());
    save((p) => { p.assign = next; });
    setTimeout(() => setShuffling(false), 1400);
    if (cls.students.length > seats.length) toast(`Il manque ${cls.students.length - seats.length} places : ajoutez des tables dans « Aménager la salle ».`, { icon: 'triangle-alert' });
  }
  const clear = async () => { if (await confirmDialog({ title: 'Vider le plan ?', body: 'Tous les élèves retournent dans la liste. Les tables restent en place.', ok: 'Vider' })) save((p) => { p.assign = {}; p.locked = []; }); };
  const toggleLock = (sid) => { const seat = seatOf[sid]; if (!seat) return; save((p) => { const L = new Set(p.locked || []); L.has(seat) ? L.delete(seat) : L.add(seat); p.locked = [...L]; }); };

  // --- Aménagement : déplacer tables et éléments ---
  const toSvg = (e) => { const pt = svgRef.current.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; return pt.matrixTransform(svgRef.current.getScreenCTM().inverse()); };
  function dragEl(e, kind, el) {
    if (mode !== 'arrange') return;
    e.preventDefault();
    e.stopPropagation();
    setSel({ kind, id: el.id });
    const start = toSvg(e);
    const orig = { tables: plan.tables, items: baseItems };
    let moved = false;
    const mv = (ev) => {
      const pt = toSvg(ev);
      let dx = pt.x - start.x, dy = pt.y - start.y;
      if (flipped) { dx = -dx; dy = -dy; }
      if (Math.hypot(dx, dy) > 2) moved = true;
      const nx = Math.round((el.x + dx) / GRID) * GRID, ny = Math.round((el.y + dy) / GRID) * GRID;
      const key = kind === 'table' ? 'tables' : 'items';
      setLive({ ...orig, [key]: orig[key].map((x) => (x.id === el.id ? { ...x, x: nx, y: ny } : x)) });
    };
    const up = () => {
      window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up);
      setLive((cur) => { if (cur && moved) save((p) => { p.tables = cur.tables; p.items = cur.items; }); return null; });
    };
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
  }
  const selT = sel?.kind === 'table' ? plan.tables.find((t) => t.id === sel.id) : null;
  const selI = sel?.kind === 'item' ? baseItems.find((t) => t.id === sel.id) : null;
  const selEl = selT || selI;
  const edit = (fn) => save((p) => { const list = sel.kind === 'table' ? p.tables : p.items; const x = list.find((y) => y.id === sel.id); if (x) fn(x, p); });
  const removeSel = () => {
    save((p) => {
      if (sel.kind === 'table') {
        p.tables = p.tables.filter((x) => x.id !== sel.id);
        for (const k of Object.keys(p.assign)) if (k.startsWith(sel.id + ':')) delete p.assign[k];
      } else p.items = p.items.filter((x) => x.id !== sel.id);
    });
    setSel(null);
  };
  const duplicate = () => {
    if (selT) { const nt = { ...table(selT.x + 32, selT.y + 32, selT.cols, selT.rows, selT.rot), bare: selT.bare }; save((p) => { p.tables.push(nt); }); setSel({ kind: 'table', id: nt.id }); }
    else if (selI) { const ni = item(selI.type, selI.x + 32, selI.y + 32, selI.rot, selI.w, selI.h); save((p) => { p.items.push(ni); }); setSel({ kind: 'item', id: ni.id }); }
  };
  const resizeTable = (dc) => edit((t, p) => {
    const nc = Math.max(1, Math.min(6, t.cols + dc));
    if (nc < t.cols) for (const k of Object.keys(p.assign)) { const [tid, i] = k.split(':'); if (tid === t.id && Number(i) % t.cols >= nc) delete p.assign[k]; }
    // Réindexe les places restantes (la numérotation dépend du nombre de colonnes).
    const re = {};
    for (const [k, v] of Object.entries(p.assign)) { const [tid, i] = k.split(':'); if (tid !== t.id) { re[k] = v; continue; } const r = Math.floor(i / t.cols), c = i % t.cols; if (c < nc) re[`${tid}:${r * nc + c}`] = v; }
    p.assign = re;
    t.cols = nc; t.bare = false;
  });
  const setRows = (r) => edit((t, p) => {
    if (r < t.rows) for (const k of Object.keys(p.assign)) { const [tid, i] = k.split(':'); if (tid === t.id && Math.floor(i / t.cols) >= r) delete p.assign[k]; }
    t.rows = r; t.bare = false;
  });
  const addThing = (a) => {
    // Nouvel élément posé dans l'espace libre sous la salle, décalé pour ne pas s'empiler.
    const n = history.current.length % 5;
    const cx = Math.round((b.x + b.w / 2 + (n - 2) * 40) / GRID) * GRID;
    const cy = Math.round((b.y + b.h + 70) / GRID) * GRID;
    if (a.item) { const ni = item(a.k, cx, cy); save((p) => { p.items.push(ni); }); setSel({ kind: 'item', id: ni.id }); }
    else { const nt = a.make(cx, cy); save((p) => { p.tables.push(nt); }); setSel({ kind: 'table', id: nt.id }); }
  };
  const keyArrange = (e) => {
    if (mode !== 'arrange' || !selEl) return;
    const d = e.shiftKey ? GRID * 4 : GRID;
    const m = { ArrowLeft: [-d, 0], ArrowRight: [d, 0], ArrowUp: [0, -d], ArrowDown: [0, d] }[e.key];
    if (m) { e.preventDefault(); edit((t) => { t.x += flipped ? -m[0] : m[0]; t.y += flipped ? -m[1] : m[1]; }); }
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); removeSel(); }
    if (e.key === 'r' || e.key === 'R') { e.preventDefault(); edit((t) => { t.rot = (t.rot + (e.shiftKey ? 15 : 90)) % 360; }); }
    if (e.key === 'Escape') setSel(null);
  };

  const byId = Object.fromEntries(cls.students.map((s) => [s.id, s]));
  const short = (s) => (s.first.length > 11 ? s.first.slice(0, 10) + '.' : s.first);
  const lastLine = (s) => (s.last ? (s.last.length > 12 ? s.last.slice(0, 11) + '.' : s.last) : '');
  const nameSize = (s) => (short(s).length > 9 ? 10.5 : short(s).length > 6 ? 12 : 13.5);
  const date = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  const isSel = (kind, id) => sel?.kind === kind && sel.id === id;

  const drawItem = (it) => {
    const w = it.w, h = it.h;
    if (it.type === 'board') return html`<rect x=${-w / 2} y=${-h / 2} width=${w} height=${h} rx=${Math.min(10, h / 2)} class="it-board"/>`;
    if (it.type === 'desk') return html`<rect x=${-w / 2} y=${-h / 2} width=${w} height=${h} rx="8" class="it-desk"/><rect x="-16" y=${h / 2 + 4} width="32" height="10" rx="4" class="chair"/>`;
    if (it.type === 'door') return html`<rect x=${-w / 2} y=${-h / 2} width=${w} height=${h} rx="2" class="it-door"/><path d=${`M${-w / 2} ${h / 2} A ${w} ${w} 0 0 1 ${w / 2} ${h / 2 + w}`} class="it-swing"/><line x1=${-w / 2} y1=${h / 2} x2=${-w / 2} y2=${h / 2 + w} class="it-swing"/>`;
    if (it.type === 'window') return html`<rect x=${-w / 2} y=${-h / 2} width=${w} height=${h} class="it-window"/><line x1=${-w / 2} y1="0" x2=${w / 2} y2="0" class="it-window-l"/>`;
    return html`<rect x=${-w / 2} y=${-h / 2} width=${w} height=${h} rx="4" class="it-cab"/><line x1="0" y1=${-h / 2} x2="0" y2=${h / 2} class="it-cab-l"/>`;
  };
  const labelPos = (it) => {
    // Étiquette à l'intérieur pour le tableau, à côté pour la porte et la fenêtre.
    if (it.type === 'door' || it.type === 'window') return { dy: -(it.h / 2 + 10) };
    return { dy: 0 };
  };

  return html`<div class=${`tool-layout plan-layout ${mode}`}>
    <section class=${`stage plan-stage ${fs ? 'is-fs' : ''}`} ref=${stageRef} aria-label="Plan de classe">
      <div class="stage-top no-print">
        <div class="plan-picker">
          <label class="sr-only" for="pp">Salle</label>
          <select id="pp" class="select" value=${plan.id} onChange=${(e) => { if (e.target.value === '__new') { onNewRoom(); return; } updateClass(cls.id, (c) => { c.activePlan = e.target.value; }); }}>
            ${cls.plans.map((p) => html`<option value=${p.id}>${p.name}</option>`)}<option value="__new">+ Nouvelle salle…</option></select>
          <button class="btn btn-ghost btn-icon btn-sm" onClick=${() => setRenaming(true)} aria-label="Renommer ou supprimer la salle"><${Icon} name="pencil"/></button>
        </div>
        <div class="seg" role="group" aria-label="Mode d’édition">
          <button aria-pressed=${mode === 'place'} onClick=${() => { setMode('place'); setSel(null); }}><${Icon} name="users"/><span class="hide-sm">Placer les élèves</span></button>
          <button aria-pressed=${mode === 'arrange'} onClick=${() => { setMode('arrange'); setPicked(null); }}><${Icon} name="move"/><span class="hide-sm">Aménager la salle</span></button></div>
        <button class="btn btn-ghost btn-icon btn-sm" onClick=${undo} disabled=${!history.current.length} aria-label="Annuler la dernière modification (Ctrl+Z)" title="Annuler (Ctrl+Z)"><${Icon} name="undo-2"/></button>
        <div class="spacer"></div>
        <div class="seg" role="group" aria-label="Point de vue">
          <button aria-pressed=${!flipped} onClick=${() => save((p) => { p.view = 'eleves'; }, false)} title="Le tableau en haut, comme les élèves le voient">Vue élèves</button>
          <button aria-pressed=${flipped} onClick=${() => save((p) => { p.view = 'prof'; }, false)} title="La classe telle que vous la voyez depuis votre bureau">Vue du bureau</button></div>
        <button class="btn btn-ghost btn-icon btn-sm" onClick=${() => window.print()} aria-label="Imprimer le plan" title="Imprimer"><${Icon} name="printer"/></button>
        <button class="btn btn-ghost btn-icon btn-sm" onClick=${() => toggleFullscreen(stageRef.current)} aria-label=${fs ? 'Quitter le plein écran' : 'Plein écran'}><${Icon} name=${fs ? 'minimize' : 'maximize'}/></button>
      </div>
      <div class="print-head" aria-hidden="true"><h1>Plan de classe — ${cls.name}</h1><p>${plan.name} · ${flipped ? 'vue depuis le bureau' : 'vue des élèves'} · ${date}</p></div>

      <div class="room-wrap" tabindex=${mode === 'arrange' ? 0 : undefined} onKeyDown=${keyArrange}>
        <svg ref=${svgRef} class=${`room ${shuffling ? 'shuffling' : ''} ${picked ? 'has-pick' : ''}`} viewBox=${`${left} ${top} ${W} ${H}`} role="group" aria-label=${`Salle ${plan.name}, ${plural(seats.length, 'place', 'places')}`}
          onPointerDown=${(e) => { if (e.target === svgRef.current || e.target.classList.contains('floor')) { setSel(null); setPicked(null); } }}>
          <defs><pattern id="floor" width="32" height="32" patternUnits="userSpaceOnUse"><path d="M32 0H0V32" fill="none" class="floor-line"/></pattern></defs>
          <rect x=${left} y=${top} width=${W} height=${H} fill="url(#floor)" class="floor"/>
          ${tables.map((t) => { const p = P(t.x, t.y); const w = t.cols * SEAT_W, h = t.rows * SEAT_H;
            return html`<g key=${t.id} class=${`tbl-g ${isSel('table', t.id) ? 'sel' : ''} ${t.bare ? 'bare' : ''}`} transform=${`translate(${p.x} ${p.y}) rotate(${rotD(t.rot)})`} onPointerDown=${(e) => dragEl(e, 'table', t)}>
              ${t.bare ? html`<rect x="-24" y="-22" width="48" height="44" rx="14" class="chair-solo"/>` : html`
              ${Array.from({ length: t.cols * t.rows }, (_, i) => { const r = Math.floor(i / t.cols), k = i % t.cols; const side = t.rows === 2 && r === 0 ? -1 : 1;
                const cx = -w / 2 + SEAT_W / 2 + k * SEAT_W, cy = -h / 2 + SEAT_H / 2 + r * SEAT_H + side * (SEAT_H / 2 + 7);
                return html`<rect x=${cx - 15} y=${cy - 5} width="30" height="10" rx="4" class="chair"/>`; })}
              <rect x=${-w / 2 + 2} y=${-h / 2 + 2} width=${w - 4} height=${h - 4} rx="10" class="tbl-r"/>`}
              ${isSel('table', t.id) && html`<rect x=${-w / 2 - 6} y=${-h / 2 - 6} width=${w + 12} height=${h + 12} rx="12" class="sel-ring"/>`}</g>`; })}
          ${items.map((it) => { const p = P(it.x, it.y); return html`<g key=${it.id} class=${`item-g itm-${it.type} ${isSel('item', it.id) ? 'sel' : ''}`} transform=${`translate(${p.x} ${p.y}) rotate(${rotD(it.rot)})`} onPointerDown=${(e) => dragEl(e, 'item', it)}>
            <rect x=${-it.w / 2 - 10} y=${-it.h / 2 - 12} width=${it.w + 20} height=${it.h + 24} class="hit"/>${drawItem(it)}${isSel('item', it.id) && html`<rect x=${-it.w / 2 - 6} y=${-it.h / 2 - 6} width=${it.w + 12} height=${it.h + 12} rx="8" class="sel-ring"/>`}</g>`; })}
          ${items.map((it) => { const p = P(it.x, it.y); const a = upright(rotD(it.rot)); const elongated = it.type === 'board' || it.type === 'window' || it.type === 'door';
            return html`<g key=${'l' + it.id} transform=${`translate(${p.x} ${p.y}) rotate(${elongated ? a : 0})`} class="it-label-g" pointer-events="none"><text y=${labelPos(it).dy + 4} text-anchor="middle" class=${`it-label lb-${it.type}`}>${ITEM_TYPES[it.type].label.toUpperCase()}</text></g>`; })}
          ${seats.map((s) => { const p = P(s.x, s.y); return html`<rect key=${s.id} class="slot" data-drop=${s.id} x=${p.x - SEAT_W / 2 + 6} y=${p.y - SEAT_H / 2 + 6} width=${SEAT_W - 12} height=${SEAT_H - 12} rx="8" onClick=${() => onSeatClick(s.id)}/>`; })}
          ${mode === 'place' && Object.entries(assign).map(([seat, sid], i) => {
            const s = seatById[seat]; const st = byId[sid]; if (!s || !st) return null;
            const p = P(s.x, s.y);
            return html`<g key=${sid} class=${`tok ${picked === sid ? 'picked' : ''} ${bad.has(sid) ? 'bad' : ''} ${locked.has(seat) ? 'locked' : ''}`} data-drop=${seat}
              style=${`transform:translate(${p.x}px,${p.y}px);--d:${(i % 12) * 35}ms`} tabindex="0" role="button"
              aria-label=${`${fullName(st)}${locked.has(seat) ? ', épinglé' : ''}${bad.has(sid) ? ', contrainte non respectée' : ''}. Entrée pour sélectionner.`}
              onPointerDown=${(e) => startDrag(e, { data: sid, ghost: () => ghostChip(st), onDrop: (to) => place(sid, to) })}
              onClick=${() => onSeatClick(seat)} onKeyDown=${(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSeatClick(seat); } }}>
              <rect x=${-SEAT_W / 2 + 4} y=${-SEAT_H / 2 + 4} width=${SEAT_W - 8} height=${SEAT_H - 8} rx="9" class="tok-r"/>
              <text y=${st.last && !proj ? -1 : 4.5} text-anchor="middle" class="tok-n" style=${`font-size:${nameSize(st)}px`}>${short(st)}</text>
              ${st.last && !proj && html`<text y="13" text-anchor="middle" class="tok-l">${lastLine(st)}</text>`}
              ${locked.has(seat) && html`<g transform=${`translate(${SEAT_W / 2 - 11} ${-SEAT_H / 2 + 11})`} class="pin"><circle r="7"/><path d="M-2.5 -2.5 2.5 2.5M-1 -4 4 1M-3 3l-2 2" /></g>`}
            </g>`;
          })}
          ${mode === 'arrange' && !tables.length && html`<text x=${(left + right) / 2} y=${(top + bottom) / 2 + 40} text-anchor="middle" class="room-empty">Ajoutez des tables avec les boutons ci-dessous, puis faites-les glisser.</text>`}
        </svg>
      </div>

      ${mode === 'place' && html`<div class="tray no-print" data-drop="tray" aria-label="Élèves non placés">
        <div class="tray-head"><b>${unplaced.length ? `${plural(unplaced.length, 'élève à placer', 'élèves à placer')}` : 'Tout le monde est placé'}</b>${unplaced.length > 0 && html`<span class="hint">Glissez-les sur une place, ou cliquez puis choisissez une place.</span>`}</div>
        <div class="tray-list">${unplaced.map((st) => html`<button key=${st.id} class=${`member ${picked === st.id ? 'picked' : ''}`} aria-pressed=${picked === st.id}
          onPointerDown=${(e) => startDrag(e, { data: st.id, onDrop: (to) => place(st.id, to) })} onClick=${() => setPicked(picked === st.id ? null : st.id)}>${st.first} ${st.last ? st.last[0] + '.' : ''}</button>`)}</div>
      </div>`}
      ${picked && mode === 'place' && html`<div class="pick-bar no-print" role="status">
        <span><b>${byId[picked]?.first}</b> : choisissez une place${seatOf[picked] ? ' (ou échangez avec un camarade)' : ''}.</span>
        ${seatOf[picked] && html`<button class="btn btn-sm" onClick=${() => toggleLock(picked)}><${Icon} name=${locked.has(seatOf[picked]) ? 'pin-off' : 'pin'}/>${locked.has(seatOf[picked]) ? 'Désépingler' : 'Épingler ici'}</button>
          <button class="btn btn-sm" onClick=${() => place(picked, 'tray')}><${Icon} name="x"/>Retirer du plan</button>`}
        <button class="btn btn-sm btn-ghost" onClick=${() => setPicked(null)}>Annuler</button></div>`}
      ${mode === 'arrange' && html`<div class="pick-bar no-print arrange-bar">
        ${selT ? html`<span class="ab-title"><b>${selT.bare ? 'Chaise seule' : `Table de ${selT.cols * selT.rows}`}</b></span>
          <span class="ab-group"><span class="hint">Places</span><button class="btn btn-sm btn-icon" onClick=${() => resizeTable(-1)} disabled=${selT.cols <= 1} aria-label="Une place de moins">−</button><b class="tnum">${selT.cols}</b><button class="btn btn-sm btn-icon" onClick=${() => resizeTable(1)} disabled=${selT.cols >= 6} aria-label="Une place de plus">+</button></span>
          ${!selT.bare && html`<span class="seg" role="group" aria-label="Rangs"><button aria-pressed=${selT.rows === 1} onClick=${() => setRows(1)}>1 rang</button><button aria-pressed=${selT.rows === 2} onClick=${() => setRows(2)}>2 rangs</button></span>`}
          <button class="btn btn-sm" onClick=${() => edit((t) => { t.rot = (t.rot + 90) % 360; })}><${Icon} name="rotate-cw"/>90°</button>
          <button class="btn btn-sm" onClick=${() => edit((t) => { t.rot = (t.rot + 15) % 360; })}>15°</button>
          <button class="btn btn-sm" onClick=${duplicate}><${Icon} name="copy"/>Dupliquer</button>
          <button class="btn btn-sm btn-danger" onClick=${removeSel}><${Icon} name="trash-2"/>Supprimer</button>
          <button class="btn btn-sm btn-ghost" onClick=${() => setSel(null)}>Terminé</button>`
        : selI ? html`<span class="ab-title"><b>${ITEM_TYPES[selI.type].label}</b></span>
          <span class="ab-group"><span class="hint">Longueur</span><button class="btn btn-sm btn-icon" onClick=${() => edit((t) => { t.w = Math.max(30, t.w - 20); })} aria-label="Plus court">−</button><button class="btn btn-sm btn-icon" onClick=${() => edit((t) => { t.w = Math.min(900, t.w + 20); })} aria-label="Plus long">+</button></span>
          ${(selI.type === 'desk' || selI.type === 'cabinet') && html`<span class="ab-group"><span class="hint">Largeur</span><button class="btn btn-sm btn-icon" onClick=${() => edit((t) => { t.h = Math.max(20, t.h - 10); })} aria-label="Moins large">−</button><button class="btn btn-sm btn-icon" onClick=${() => edit((t) => { t.h = Math.min(300, t.h + 10); })} aria-label="Plus large">+</button></span>`}
          <button class="btn btn-sm" onClick=${() => edit((t) => { t.rot = (t.rot + 90) % 360; })}><${Icon} name="rotate-cw"/>90°</button>
          <button class="btn btn-sm" onClick=${() => edit((t) => { t.rot = (t.rot + 15) % 360; })}>15°</button>
          <button class="btn btn-sm" onClick=${duplicate}><${Icon} name="copy"/>Dupliquer</button>
          <button class="btn btn-sm btn-danger" onClick=${removeSel}><${Icon} name="trash-2"/>Supprimer</button>
          <button class="btn btn-sm btn-ghost" onClick=${() => setSel(null)}>Terminé</button>`
        : html`<span class="ab-title"><b>Ajouter</b><span class="hint hide-sm"> puis faites glisser à sa place</span></span>
          ${ADDABLE.map((a) => html`<button class="btn btn-sm" onClick=${() => addThing(a)}><${Icon} name=${a.icon}/>${a.label}</button>`)}`}
        <span class="spacer"></span><span class="chip tnum">${seats.length} places · ${cls.students.length} élèves</span></div>
        ${mode === 'arrange' && html`<p class="hint no-print arrange-tip">Cliquez sur un élément pour le modifier. Clavier : flèches pour déplacer, R pour tourner, Suppr pour effacer, Ctrl+Z pour annuler.</p>`}`}
    </section>

    <aside class="tool-side no-print stack" style="--gap:14px">
      <div class="card side-card">
        <h3>Placement automatique</h3>
        <div class="mode-list" role="radiogroup" aria-label="Méthode de placement">${STRATEGIES.map((s) => html`<button role="radio" aria-checked=${strategy === s.id} class="mode-opt compact" onClick=${() => setStrategy(s.id)}><span><b>${s.label}</b><small>${s.hint}</small></span></button>`)}</div>
        <label class="switch"><input type="checkbox" checked=${fillFront} onChange=${(e) => setFillFront(e.target.checked)}/>Remplir près du tableau d’abord</label>
        <button class="btn btn-primary btn-lg" onClick=${auto}><${Icon} name="wand-sparkles"/>Placer automatiquement</button>
        <p class="hint">Les élèves épinglés <${Icon} name="pin" size=${13} style="display:inline;vertical-align:-2px"/> ne bougent pas.</p>
        <button class="btn btn-ghost" onClick=${clear} disabled=${!Object.keys(assign).length}><${Icon} name="rotate-ccw"/>Vider le plan</button>
      </div>
      ${bad.size > 0 && html`<div class="notice warn"><${Icon} name="triangle-alert"/><div>Certains élèves à séparer sont voisins (en rouge).</div></div>`}
      <${ConstraintsCard} cls=${cls}/>
    </aside>
    <${RenameRoom} open=${renaming} onClose=${() => setRenaming(false)} cls=${cls} plan=${plan}/>
  </div>`;
}

function ghostChip(st) {
  const d = document.createElement('div');
  d.className = 'member';
  d.textContent = st.first;
  return d;
}

function RenameRoom({ open, onClose, cls, plan }) {
  const [name, setName] = useState(plan.name);
  useEffect(() => { if (open) setName(plan.name); }, [open]);
  const del = async () => {
    if (!(await confirmDialog({ title: `Supprimer la salle « ${plan.name} » ?`, body: 'La disposition et le placement des élèves seront perdus.', ok: 'Supprimer', danger: true }))) return;
    updateClass(cls.id, (c) => { c.plans = c.plans.filter((p) => p.id !== plan.id); c.activePlan = c.plans[0]?.id || null; });
    onClose();
  };
  const dup = () => {
    const copy = { ...structuredClone(plan), id: 'p_' + Math.random().toString(36).slice(2, 10), name: plan.name + ' (copie)' };
    updateClass(cls.id, (c) => { c.plans.push(copy); c.activePlan = copy.id; });
    onClose();
    toast('Salle dupliquée.');
  };
  return html`<${Dialog} open=${open} onClose=${onClose} title="Salle">
    <form onSubmit=${(e) => { e.preventDefault(); updateClass(cls.id, (c) => { c.plans.find((p) => p.id === plan.id).name = name.trim() || plan.name; }); onClose(); }}>
      <div class="dlg-body stack" style="--gap:16px"><div class="field"><label for="rr">Nom de la salle</label><input id="rr" class="input" value=${name} onInput=${(e) => setName(e.target.value)} autofocus/></div>
        <div class="row"><button type="button" class="btn" onClick=${dup}><${Icon} name="copy"/>Dupliquer la salle</button><button type="button" class="btn btn-danger" onClick=${del}><${Icon} name="trash-2"/>Supprimer</button></div></div>
      <div class="dlg-foot"><button class="btn btn-primary" type="submit">Enregistrer</button></div></form>
  </${Dialog}>`;
}
