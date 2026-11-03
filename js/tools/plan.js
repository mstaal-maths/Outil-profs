// Outil 4 — Plan de classe (outil phare).
import { html, useState, useRef, useEffect, useMemo } from '../vendor/preact.js';
import { Icon, Dialog, toggleFullscreen, useFullscreen, toast, confirmDialog, useProjection } from '../ui/core.js';
import { updateClass } from '../lib/store.js';
import { ITEM_TYPES, seatsOf, bounds, autoPlace, planViolations, newPlan, table, item, defaultItems, SEAT_W, SEAT_H, GRID } from '../lib/room.js';
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
  if (!cls.students.length) return html`<div class="empty"><h3>Ajoutez d’abord vos élèves</h3><p>Le plan de classe se remplit avec les élèves de la classe.</p><a class="btn btn-primary" href=${`#/classes/${cls.id}`}>Ajouter des élèves</a></div>`;
  if (!plan) return html`<${RoomStart} cls=${cls}/>`;
  return html`<${PlanEditor} cls=${cls} plan=${plan} onNewRoom=${() => createRoom(cls)} key=${plan.id}/>`;
}

/** Nouvelle salle vide (avec seulement un tableau et un bureau, que l'on déplace à volonté). */
function createRoom(cls, name) {
  const p = newPlan((name || '').trim() || (cls.plans?.length ? `Salle ${cls.plans.length + 1}` : 'Ma salle'), 'libre');
  p.startArrange = true;
  updateClass(cls.id, (c) => { c.plans = [...(c.plans || []), p]; c.activePlan = p.id; });
}

// ---------- Premier écran : dessiner sa salle ----------
function RoomStart({ cls }) {
  const [name, setName] = useState('');
  const steps = [
    ['presentation', 'Placez le tableau et votre bureau', 'Ils sont déjà là : faites-les glisser au bon endroit.'],
    ['armchair', 'Ajoutez vos tables', 'Glissez-les depuis la boîte à éléments, comme dans votre vraie salle.'],
    ['users', 'Installez vos élèves', 'À la main ou automatiquement, en respectant vos contraintes.'],
  ];
  return html`<div class="room-start route-enter">
    <div class="rs-art" aria-hidden="true">
      <svg viewBox="0 0 360 240">
        <rect x="10" y="10" width="340" height="220" rx="18" class="rs-floor"/>
        <rect x="110" y="26" width="140" height="10" rx="5" class="rs-board"/>
        <rect x="270" y="50" width="56" height="28" rx="6" class="rs-desk"/>
        <g class="rs-t rs-t1"><rect x="48" y="104" width="70" height="30" rx="7"/></g>
        <g class="rs-t rs-t2"><rect x="146" y="104" width="70" height="30" rx="7"/></g>
        <g class="rs-t rs-t3"><rect x="48" y="164" width="70" height="30" rx="7"/></g>
        <g class="rs-t rs-t4"><rect x="146" y="164" width="70" height="30" rx="7"/></g>
        <g class="rs-hand"><path d="M262 172l10 30 6-12 13 12 6-6-13-12 12-5z"/></g>
      </svg>
    </div>
    <div class="rs-copy">
      <p class="eyebrow">Plan de classe · ${cls.name}</p>
      <h2>Dessinez votre salle de classe</h2>
      <p class="sub">Reproduisez votre vraie salle, telle qu’elle est : vos élèves verront exactement où ils sont assis.</p>
      <ol class="rs-steps">${steps.map(([ic, t, d]) => html`<li><span class="rs-ico"><${Icon} name=${ic}/></span><div><b>${t}</b><span>${d}</span></div></li>`)}</ol>
      <form class="rs-form" onSubmit=${(e) => { e.preventDefault(); createRoom(cls, name); }}>
        <div class="field"><label for="rsname">Nom de la salle <span class="muted">(facultatif)</span></label>
          <input id="rsname" class="input" value=${name} onInput=${(e) => setName(e.target.value)} placeholder="Ex. B12, labo, salle info…" maxlength="40"/></div>
        <button class="btn btn-primary btn-lg" type="submit"><${Icon} name="pencil"/>Commencer à dessiner</button>
      </form>
    </div>
  </div>`;
}

// ---------- Éditeur ----------
const pt = (body) => html`<svg viewBox="0 0 48 32" aria-hidden="true">${body}</svg>`;
const pTable = (cols, rows) => {
  const w = cols * 12, h = rows * 10, x = 24 - w / 2, y = 16 - h / 2;
  return pt(html`<rect x=${x} y=${y} width=${w} height=${h} rx="2.5" class="pc-t"/>${Array.from({ length: cols * rows }, (_, i) => { const r = Math.floor(i / cols); const cy = rows === 2 && r === 0 ? y - 4 : y + h + 1.5; return html`<rect x=${x + (i % cols) * 12 + 3} y=${cy} width="6" height="2.5" rx="1" class="pc-c"/>`; })}`);
};
const ADDABLE = [
  { k: 't1', label: 'Table 1 place', pic: pTable(1, 1), make: (x, y) => table(x, y, 1, 1) },
  { k: 't2', label: 'Table 2 places', pic: pTable(2, 1), make: (x, y) => table(x, y, 2, 1) },
  { k: 't3', label: 'Table 3 places', pic: pTable(3, 1), make: (x, y) => table(x, y, 3, 1) },
  { k: 'i4', label: 'Îlot de 4', pic: pTable(2, 2), make: (x, y) => table(x, y, 2, 2) },
  { k: 'i6', label: 'Îlot de 6', pic: pTable(3, 2), make: (x, y) => table(x, y, 3, 2) },
  { k: 'chair', label: 'Chaise seule', pic: pt(html`<rect x="17" y="9" width="14" height="14" rx="4" class="pc-c"/>`), make: (x, y) => ({ ...table(x, y, 1, 1), bare: true }) },
  { k: 'board', label: 'Tableau', item: true, pic: pt(html`<rect x="4" y="13" width="40" height="6" rx="3" class="pc-b"/>`) },
  { k: 'desk', label: 'Bureau', item: true, pic: pt(html`<rect x="12" y="8" width="24" height="13" rx="2.5" class="pc-d"/><rect x="20" y="23" width="8" height="3" rx="1" class="pc-c"/>`) },
  { k: 'door', label: 'Porte', item: true, pic: pt(html`<rect x="10" y="7" width="22" height="3" class="pc-d"/><path d="M10 10a22 22 0 0 0 22 16M10 10v16" class="pc-s"/>`) },
  { k: 'window', label: 'Fenêtre', item: true, pic: pt(html`<rect x="6" y="14" width="36" height="4" class="pc-w"/>`) },
  { k: 'cabinet', label: 'Armoire', item: true, pic: pt(html`<rect x="12" y="9" width="24" height="14" rx="1.5" class="pc-d"/><line x1="24" y1="9" x2="24" y2="23" class="pc-s"/>`) },
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
  const [guides, setGuides] = useState(null); // lignes d'alignement pendant un déplacement

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
  const room = plan.room; // murs de la salle (plans récents)
  const b0 = bounds(tables, items);
  const b = room ? (() => { const x0 = Math.min(b0.x, -room.w / 2), y0 = Math.min(b0.y, 0), x1 = Math.max(b0.x + b0.w, room.w / 2), y1 = Math.max(b0.y + b0.h, room.h); return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }; })() : b0;
  const pad = room ? 30 : 60;
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
      let nx = Math.round((el.x + dx) / GRID) * GRID, ny = Math.round((el.y + dy) / GRID) * GRID;
      // Aimantation : s'aligne sur les tables et éléments voisins.
      const others = [...orig.tables, ...orig.items].filter((o) => o.id !== el.id);
      let gx = null, gy = null;
      for (const o of others) {
        if (gx == null && Math.abs(o.x - (el.x + dx)) < 14) { nx = o.x; gx = o.x; }
        if (gy == null && Math.abs(o.y - (el.y + dy)) < 14) { ny = o.y; gy = o.y; }
      }
      setGuides(gx != null || gy != null ? { x: gx, y: gy } : null);
      const key = kind === 'table' ? 'tables' : 'items';
      setLive({ ...orig, [key]: orig[key].map((x) => (x.id === el.id ? { ...x, x: nx, y: ny } : x)) });
    };
    const up = () => {
      window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up);
      setGuides(null);
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
  /** Copie l'élément sélectionné juste à côté : idéal pour construire une rangée. */
  const copyBeside = (dir) => {
    const el = selT || selI;
    if (!el) return;
    const turned = Math.round(el.rot / 90) % 2 === 1;
    let w = selT ? selT.cols * SEAT_W : selI.w, h = selT ? selT.rows * SEAT_H + 18 : selI.h;
    if (turned) [w, h] = [h, w];
    const x = dir === 'right' ? el.x + w + (selT ? 24 : 12) : el.x;
    const y = dir === 'below' ? el.y + h + (selT ? 34 : 12) : el.y;
    if (selT) { const nt = { ...table(x, y, selT.cols, selT.rows, selT.rot), bare: selT.bare }; save((p) => { p.tables.push(nt); }); setSel({ kind: 'table', id: nt.id }); }
    else { const ni = item(selI.type, x, y, selI.rot, selI.w, selI.h); save((p) => { p.items.push(ni); }); setSel({ kind: 'item', id: ni.id }); }
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
  const addThing = (a, at) => {
    // Posé là où on l'a lâché ; sinon dans l'espace libre sous la salle, décalé pour ne pas s'empiler.
    const n = history.current.length % 5;
    let cx = Math.round((b.x + b.w / 2 + (n - 2) * 40) / GRID) * GRID;
    let cy = Math.round((b.y + b.h + 70) / GRID) * GRID;
    if (room && !at) {
      // Cherche une place libre dans la salle, du centre vers les bords.
      const w = a.item ? ITEM_TYPES[a.k].w : (a.k === 't3' || a.k === 'i6' ? 3 : a.k === 't1' || a.k === 'chair' ? 1 : 2) * SEAT_W;
      const h = a.item ? (a.k === 'door' ? ITEM_TYPES.door.w * 2 : ITEM_TYPES[a.k].h) : (a.k.startsWith('i') ? 2 : 1) * SEAT_H + 20;
      const boxes = [...tables.map((t) => { const q = bounds([t]); return q; }), ...items.map((i) => bounds([], [i]))];
      const free = (x, y) => x - w / 2 > -room.w / 2 && x + w / 2 < room.w / 2 && y - h / 2 > 0 && y + h / 2 < room.h &&
        boxes.every((q) => x + w / 2 + 26 < q.x || x - w / 2 - 26 > q.x + q.w || y + h / 2 + 26 < q.y || y - h / 2 - 26 > q.y + q.h);
      let found = null;
      // Porte et fenêtres : directement contre un mur (gauche pour la porte, droite pour les fenêtres).
      if (a.k === 'door' || a.k === 'window') {
        const sideX = a.k === 'door' ? -room.w / 2 + 10 : room.w / 2 - 8;
        const rot = a.k === 'door' ? 270 : 90;
        const iw = ITEM_TYPES[a.k].w;
        const fits = (y) => y - iw / 2 > 0 && y + iw / 2 < room.h && boxes.every((q) => sideX + 30 < q.x || sideX - 30 > q.x + q.w || y + iw / 2 + 16 < q.y || y - iw / 2 - 16 > q.y + q.h);
        const ys = a.k === 'door' ? Array.from({ length: 20 }, (_, i) => room.h - 90 - i * 40) : Array.from({ length: 20 }, (_, i) => 150 + i * 40);
        const y = ys.find(fits);
        if (y != null) {
          const ni = item(a.k, Math.round(sideX), Math.round(y / GRID) * GRID, rot);
          save((p) => { p.items.push(ni); }); setSel({ kind: 'item', id: ni.id });
          return;
        }
      }
      for (let r = 0; r < 900 && !found; r += 32) for (let k = 0; k < Math.max(1, r / 8) && !found; k++) {
        const ang = (k / Math.max(1, r / 8)) * Math.PI * 2;
        const x = Math.round(Math.cos(ang) * r / GRID) * GRID, y = Math.round((room.h / 2 + Math.sin(ang) * r * 0.7) / GRID) * GRID;
        if (free(x, y)) found = { x, y };
      }
      cx = found ? found.x : 0; cy = found ? found.y : room.h / 2;
    }
    if (at) { cx = Math.round(at.x / GRID) * GRID; cy = Math.round(at.y / GRID) * GRID; }
    if (a.item) { const ni = item(a.k, cx, cy); save((p) => { p.items.push(ni); }); setSel({ kind: 'item', id: ni.id }); }
    else { const nt = a.make(cx, cy); save((p) => { p.tables.push(nt); }); setSel({ kind: 'table', id: nt.id }); }
  };
  /** Glisser une vignette de la boîte à éléments jusque dans la salle. */
  const dragNew = (e, a) => {
    const pic = e.currentTarget.querySelector('svg').outerHTML; // à lire tout de suite : l'événement est réutilisé ensuite
    const ghost = () => { const d = document.createElement('div'); d.className = 'tile-ghost'; d.innerHTML = pic; return d; };
    startDrag(e, { data: a.k, ghost, onDrop: (to, _d, ev) => {
      if (to !== 'room') return;
      const p = toSvg(ev);
      addThing(a, flipped ? { x: left + right - p.x, y: top + bottom - p.y } : p);
    } });
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

      <div class="room-wrap" data-drop=${mode === 'arrange' ? 'room' : undefined} tabindex=${mode === 'arrange' ? 0 : undefined} onKeyDown=${keyArrange}>
        <svg ref=${svgRef} class=${`room ${shuffling ? 'shuffling' : ''} ${picked ? 'has-pick' : ''}`} viewBox=${`${left} ${top} ${W} ${H}`} role="group" aria-label=${`Salle ${plan.name}, ${plural(seats.length, 'place', 'places')}`}
          onPointerDown=${(e) => { if (e.target === svgRef.current || e.target.classList.contains('floor')) { setSel(null); setPicked(null); } }}>
          <defs><pattern id="floor" width="32" height="32" patternUnits="userSpaceOnUse"><path d="M32 0H0V32" fill="none" class="floor-line"/></pattern></defs>
          <rect x=${left} y=${top} width=${W} height=${H} fill="url(#floor)" class="floor"/>
          ${room && (() => { const a = P(-room.w / 2, 0), c = P(room.w / 2, room.h); return html`<rect x=${Math.min(a.x, c.x)} y=${Math.min(a.y, c.y)} width=${room.w} height=${room.h} rx="6" class="walls" pointer-events="none"/>`; })()}
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
          ${guides && html`<g class="guides" pointer-events="none">${guides.x != null && (() => { const g = P(guides.x, 0); return html`<line x1=${g.x} x2=${g.x} y1=${top} y2=${bottom}/>`; })()}${guides.y != null && (() => { const g = P(0, guides.y); return html`<line y1=${g.y} y2=${g.y} x1=${left} x2=${right}/>`; })()}</g>`}
          ${mode === 'arrange' && !tables.length && html`<text x=${(left + right) / 2} y=${(top + bottom) / 2 + 40} text-anchor="middle" class="room-empty">Glissez des tables depuis la boîte à éléments →</text>`}
        </svg>
      </div>

      ${mode === 'place' && html`<div class="tray no-print" data-drop="tray" aria-label="Élèves non placés">
        ${!seats.length ? html`<div class="tray-head"><b>Votre salle n’a pas encore de tables.</b><button class="btn btn-sm btn-primary" onClick=${() => setMode('arrange')}><${Icon} name="move"/>Aménager la salle</button></div>` : ''}<div class="tray-head"><b>${unplaced.length ? `${plural(unplaced.length, 'élève à placer', 'élèves à placer')}` : 'Tout le monde est placé'}</b>${unplaced.length > 0 && html`<span class="hint">Glissez-les sur une place, ou cliquez puis choisissez une place.</span>`}</div>
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
          <button class="btn btn-sm" onClick=${() => copyBeside('right')} title="Ajoute la même table juste à droite"><${Icon} name="copy"/>Copier à droite</button>
          <button class="btn btn-sm" onClick=${() => copyBeside('below')} title="Ajoute la même table juste en dessous"><${Icon} name="copy"/>Copier en dessous</button>
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
        : html`<span class="ab-title"><${Icon} name="info" size=${16} style="vertical-align:-3px;margin-right:6px;color:var(--encre)"/>Glissez un élément pour le déplacer, cliquez dessus pour le modifier.</span>
          ${room && html`<span class="ab-group"><span class="hint">Largeur de la salle</span><button class="btn btn-sm btn-icon" onClick=${() => save((p) => { p.room.w = Math.max(400, p.room.w - 50); })} aria-label="Salle moins large">−</button><b class="tnum">${(room.w / 100).toLocaleString('fr-FR')} m</b><button class="btn btn-sm btn-icon" onClick=${() => save((p) => { p.room.w = Math.min(2000, p.room.w + 50); })} aria-label="Salle plus large">+</button></span>
          <span class="ab-group"><span class="hint">Profondeur</span><button class="btn btn-sm btn-icon" onClick=${() => save((p) => { p.room.h = Math.max(300, p.room.h - 50); })} aria-label="Salle moins profonde">−</button><b class="tnum">${(room.h / 100).toLocaleString('fr-FR')} m</b><button class="btn btn-sm btn-icon" onClick=${() => save((p) => { p.room.h = Math.min(2000, p.room.h + 50); })} aria-label="Salle plus profonde">+</button></span>`}`}
        <span class="spacer"></span><span class="chip tnum">${seats.length} places · ${cls.students.length} élèves</span></div>
        ${mode === 'arrange' && html`<p class="hint no-print arrange-tip">Astuce clavier : flèches pour déplacer, R pour tourner, Suppr pour effacer, Ctrl+Z pour annuler.</p>`}`}
    </section>

    <aside class="tool-side no-print stack" style="--gap:14px">
      ${mode === 'arrange' ? html`
      <div class="card side-card">
        <h3>Votre salle en 3 étapes</h3>
        <ol class="mini-steps">
          <li class=${items.some((i) => i.type === 'board') ? 'ok' : ''}><span>${items.some((i) => i.type === 'board') ? '✓' : '1'}</span>Le tableau et le bureau à leur place</li>
          <li class=${seats.length >= cls.students.length ? 'ok' : ''}><span>${seats.length >= cls.students.length ? '✓' : '2'}</span>Des places pour tous (${seats.length} / ${cls.students.length})</li>
          <li><span>3</span>Installer les élèves</li>
        </ol>
        <button class="btn btn-primary" onClick=${() => { setMode('place'); setSel(null); }} disabled=${!seats.length}><${Icon} name="users"/>Passer au placement des élèves</button>
      </div>
      <div class="card side-card">
        <h3>Boîte à éléments</h3>
        <p>Glissez un élément dans la salle, ou cliquez pour l’ajouter.</p>
        <div class="toolbox">${ADDABLE.map((a) => html`<button class="tile" onPointerDown=${(e) => dragNew(e, a)} onClick=${() => addThing(a)} aria-label=${'Ajouter : ' + a.label}>${a.pic}<span>${a.label}</span></button>`)}</div>
      </div>` : html`
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
`}
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
