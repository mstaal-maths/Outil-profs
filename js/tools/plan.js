// Outil 4 — Plan de classe (outil phare).
import { html, useState, useRef, useEffect, useMemo } from '../vendor/preact.js';
import { Icon, Dialog, toggleFullscreen, useFullscreen, toast, confirmDialog, useProjection } from '../ui/core.js';
import { updateClass } from '../lib/store.js';
import { PRESETS, buildLayout, seatsOf, bounds, autoPlace, planViolations, newPlan, suggestOpts, capacity, table, SEAT_W, SEAT_H, GRID } from '../lib/room.js';
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
        <div class=${`cap ${cap < n ? 'short' : ''}`}><b class="tnum">${cap}</b> places pour <b class="tnum">${n}</b> élèves${cap < n ? html` — <span>il manque ${cap - n < 0 ? n - cap : 0} places</span>` : ''}</div>
        <button class="btn btn-primary btn-lg btn-block" onClick=${create}><${Icon} name="check"/>Créer cette salle</button>
      </div>
    </div>
  </div>`;
}

function RoomThumb({ tables, big }) {
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
function PlanEditor({ cls, plan, onNewRoom }) {
  const stageRef = useRef();
  const svgRef = useRef();
  const fs = useFullscreen();
  const proj = useProjection();
  const [mode, setMode] = useState('place'); // 'place' | 'arrange'
  const [picked, setPicked] = useState(null); // id d'élève sélectionné (clavier / clic)
  const [selTable, setSelTable] = useState(null);
  const [strategy, setStrategy] = useState('random');
  const [fillFront, setFillFront] = useState(true);
  const [dragTables, setDragTables] = useState(null); // copie locale pendant le déplacement d'une table
  const [shuffling, setShuffling] = useState(false);
  const [renaming, setRenaming] = useState(false);

  const tables = dragTables || plan.tables;
  const seats = useMemo(() => seatsOf(tables), [tables]);
  const seatById = useMemo(() => Object.fromEntries(seats.map((s) => [s.id, s])), [seats]);
  const assign = Object.fromEntries(Object.entries(plan.assign).filter(([seat, sid]) => seatById[seat] && cls.students.some((s) => s.id === sid)));
  const seatOf = Object.fromEntries(Object.entries(assign).map(([seat, sid]) => [sid, seat]));
  const unplaced = cls.students.filter((s) => !seatOf[s.id]);
  const flipped = plan.view === 'prof';
  const bad = planViolations(tables, assign, cls.constraints);
  const locked = new Set((plan.locked || []).filter((seat) => assign[seat]));

  // Repère d'affichage : on fait pivoter la salle de 180° en « vue du bureau » (le texte reste droit).
  const b = bounds(tables);
  const pad = 56;
  const boardY = Math.min(b.y, 120) - 70;
  const top = boardY - 30, bottom = b.y + b.h + pad;
  const left = Math.min(b.x, -200) - pad, right = Math.max(b.x + b.w, 200) + pad;
  const W = right - left, H = bottom - top;
  const P = (x, y) => (flipped ? { x: left + right - x, y: top + bottom - y } : { x, y });
  const rotD = (r) => (flipped ? r + 180 : r);

  const save = (fn) => updateClass(cls.id, (c) => { const p = c.plans.find((x) => x.id === plan.id); fn(p, c); });

  function place(sid, target) {
    save((p) => {
      const a = p.assign;
      const from = Object.keys(a).find((k) => a[k] === sid);
      if (target === 'tray') { if (from) { delete a[from]; p.locked = (p.locked || []).filter((x) => x !== from); } return; }
      if (from === target) return;
      const occupant = a[target];
      a[target] = sid;
      if (from) { if (occupant) a[from] = occupant; else delete a[from]; }
      else if (occupant) { /* l'occupant retourne dans la liste */ }
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
    if (strategy === 'hetero' && !hasGrades(cls)) { toast('Ajoutez des notes pour former des binômes de niveaux mêlés.', { icon: 'info' }); return; }
    if (strategy === 'mix' && !cls.students.some((s) => s.g)) { toast('Indiquez « il » ou « elle » dans la liste des élèves pour alterner.', { icon: 'info' }); return; }
    const next = autoPlace({ tables, students: cls.students, assign, locked: [...locked], strategy, constraints: cls.constraints, levels, fillFront });
    setShuffling(!prefersReducedMotion());
    save((p) => { p.assign = next; });
    setTimeout(() => setShuffling(false), 1400);
    if (cls.students.length > seats.length) toast(`Il manque ${cls.students.length - seats.length} places : ajoutez des tables dans « Aménager la salle ».`, { icon: 'triangle-alert' });
  }
  const clear = async () => { if (await confirmDialog({ title: 'Vider le plan ?', body: 'Tous les élèves retournent dans la liste. Les tables restent en place.', ok: 'Vider' })) save((p) => { p.assign = {}; p.locked = []; }); };
  const toggleLock = (sid) => { const seat = seatOf[sid]; if (!seat) return; save((p) => { const L = new Set(p.locked || []); L.has(seat) ? L.delete(seat) : L.add(seat); p.locked = [...L]; }); };

  // --- Aménagement : déplacer les tables ---
  const toSvg = (e) => { const pt = svgRef.current.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; return pt.matrixTransform(svgRef.current.getScreenCTM().inverse()); };
  function dragTable(e, t) {
    if (mode !== 'arrange') return;
    e.preventDefault();
    setSelTable(t.id);
    const start = toSvg(e);
    const orig = plan.tables.map((x) => ({ ...x }));
    let moved = false;
    const mv = (ev) => {
      const p = toSvg(ev);
      let dx = p.x - start.x, dy = p.y - start.y;
      if (flipped) { dx = -dx; dy = -dy; }
      if (Math.hypot(dx, dy) > 2) moved = true;
      setDragTables(orig.map((x) => (x.id === t.id ? { ...x, x: Math.round((t.x + dx) / GRID) * GRID, y: Math.round((t.y + dy) / GRID) * GRID } : x)));
    };
    const up = () => {
      window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up);
      setDragTables((cur) => { if (cur && moved) save((p) => { p.tables = cur; }); return null; });
    };
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
  }
  const selT = plan.tables.find((t) => t.id === selTable);
  const editTable = (fn) => save((p) => { const t = p.tables.find((x) => x.id === selTable); if (t) fn(t, p); });
  const removeTable = () => save((p) => {
    const t = p.tables.find((x) => x.id === selTable);
    p.tables = p.tables.filter((x) => x.id !== selTable);
    for (const k of Object.keys(p.assign)) if (k.startsWith(t.id + ':')) delete p.assign[k];
    setSelTable(null);
  });
  const addTable = (cols, rows) => {
    const nt = table(Math.round((b.x + b.w / 2) / GRID) * GRID, Math.round((b.y + b.h + 70) / GRID) * GRID, cols, rows);
    save((p) => { p.tables.push(nt); });
    setSelTable(nt.id);
  };
  const keyArrange = (e) => {
    if (mode !== 'arrange' || !selT) return;
    const d = e.shiftKey ? GRID * 4 : GRID;
    const m = { ArrowLeft: [-d, 0], ArrowRight: [d, 0], ArrowUp: [0, -d], ArrowDown: [0, d] }[e.key];
    if (m) { e.preventDefault(); editTable((t) => { t.x += flipped ? -m[0] : m[0]; t.y += flipped ? -m[1] : m[1]; }); }
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); removeTable(); }
    if (e.key === 'r' || e.key === 'R') { e.preventDefault(); editTable((t) => { t.rot = (t.rot + (e.shiftKey ? 45 : 90)) % 360; }); }
  };

  const byId = Object.fromEntries(cls.students.map((s) => [s.id, s]));
  const short = (s) => (s.first.length > 11 ? s.first.slice(0, 10) + '.' : s.first);
  const lastLine = (s) => (s.last ? (s.last.length > 12 ? s.last.slice(0, 11) + '.' : s.last) : '');
  const nameSize = (s) => (short(s).length > 9 ? 10.5 : short(s).length > 6 ? 12 : 13.5);
  const date = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

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
          <button aria-pressed=${mode === 'place'} onClick=${() => { setMode('place'); setSelTable(null); }}><${Icon} name="users"/><span class="hide-sm">Placer les élèves</span></button>
          <button aria-pressed=${mode === 'arrange'} onClick=${() => { setMode('arrange'); setPicked(null); }}><${Icon} name="move"/><span class="hide-sm">Aménager la salle</span></button></div>
        <div class="spacer"></div>
        <div class="seg" role="group" aria-label="Point de vue">
          <button aria-pressed=${!flipped} onClick=${() => save((p) => { p.view = 'eleves'; })} title="Le tableau en haut, comme les élèves le voient">Vue élèves</button>
          <button aria-pressed=${flipped} onClick=${() => save((p) => { p.view = 'prof'; })} title="Le tableau en bas : la classe telle que vous la voyez depuis votre bureau">Vue du bureau</button></div>
        <button class="btn btn-ghost btn-icon btn-sm" onClick=${() => window.print()} aria-label="Imprimer le plan" title="Imprimer"><${Icon} name="printer"/></button>
        <button class="btn btn-ghost btn-icon btn-sm" onClick=${() => toggleFullscreen(stageRef.current)} aria-label=${fs ? 'Quitter le plein écran' : 'Plein écran'}><${Icon} name=${fs ? 'minimize' : 'maximize'}/></button>
      </div>
      <div class="print-head" aria-hidden="true"><h1>Plan de classe — ${cls.name}</h1><p>${plan.name} · ${flipped ? 'vue depuis le bureau' : 'vue des élèves'} · ${date}</p></div>

      <div class="room-wrap" tabindex=${mode === 'arrange' ? 0 : undefined} onKeyDown=${keyArrange}>
        <svg ref=${svgRef} class=${`room ${shuffling ? 'shuffling' : ''} ${picked ? 'has-pick' : ''}`} viewBox=${`${left} ${top} ${W} ${H}`} role="group" aria-label=${`Salle ${plan.name}, ${plural(seats.length, 'place', 'places')}`}
          onPointerDown=${(e) => { if (e.target === svgRef.current) { setSelTable(null); setPicked(null); } }}>
          <defs><pattern id="floor" width="32" height="32" patternUnits="userSpaceOnUse"><path d="M32 0H0V32" fill="none" class="floor-line"/></pattern></defs>
          <rect x=${left} y=${top} width=${W} height=${H} fill="url(#floor)" class="floor" pointer-events="none"/>
          ${(() => { const p = P(0, boardY); return html`<g class="board" transform=${`translate(${p.x} ${p.y})`}><rect x="-150" y="-9" width="300" height="18" rx="9"/><text y=${flipped ? -20 : 32} text-anchor="middle">TABLEAU</text></g>`; })()}
          ${(() => { const p = P(right - pad - 60, boardY + 34); return html`<g class="desk" transform=${`translate(${p.x} ${p.y})`}><rect x="-50" y="-20" width="100" height="40" rx="8"/><text y="5" text-anchor="middle">Bureau</text></g>`; })()}
          ${tables.map((t) => { const p = P(t.x, t.y); const w = t.cols * SEAT_W, h = t.rows * SEAT_H; return html`<g key=${t.id} class=${`tbl-g ${selTable === t.id ? 'sel' : ''}`} transform=${`translate(${p.x} ${p.y}) rotate(${rotD(t.rot)})`} onPointerDown=${(e) => dragTable(e, t)}>
            <rect x=${-w / 2 + 2} y=${-h / 2 + 2} width=${w - 4} height=${h - 4} rx="10" class="tbl-r"/></g>`; })}
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
        ${selT ? html`<span><b>Table de ${selT.cols * selT.rows}</b> · flèches pour déplacer, R pour tourner</span>
          <button class="btn btn-sm" onClick=${() => editTable((t) => { t.rot = (t.rot + 90) % 360; })}><${Icon} name="rotate-cw"/>Tourner</button>
          <button class="btn btn-sm" onClick=${() => editTable((t) => { t.rot = (t.rot + 45) % 360; })}>45°</button>
          <button class="btn btn-sm" onClick=${() => { const c = { ...selT, id: undefined }; const nt = table(selT.x + 24, selT.y + 24, c.cols, c.rows, c.rot); save((p) => { p.tables.push(nt); }); setSelTable(nt.id); }}><${Icon} name="copy"/>Dupliquer</button>
          <button class="btn btn-sm btn-danger" onClick=${removeTable}><${Icon} name="trash-2"/>Supprimer</button>`
        : html`<span>Glissez les tables pour les déplacer. Ajouter :</span>
          <button class="btn btn-sm" onClick=${() => addTable(1, 1)}><${Icon} name="plus"/>1 place</button>
          <button class="btn btn-sm" onClick=${() => addTable(2, 1)}><${Icon} name="plus"/>2 places</button>
          <button class="btn btn-sm" onClick=${() => addTable(2, 2)}><${Icon} name="plus"/>Îlot de 4</button>`}
        <span class="spacer"></span><span class="chip tnum">${seats.length} places · ${cls.students.length} élèves</span></div>`}
    </section>

    <aside class="tool-side no-print stack" style="--gap:14px">
      <div class="card side-card">
        <h3>Placement automatique</h3>
        <div class="mode-list" role="radiogroup" aria-label="Méthode de placement">${STRATEGIES.map((s) => html`<button role="radio" aria-checked=${strategy === s.id} class="mode-opt compact" onClick=${() => setStrategy(s.id)}><span><b>${s.label}</b><small>${s.hint}</small></span></button>`)}</div>
        <label class="switch"><input type="checkbox" checked=${fillFront} onChange=${(e) => setFillFront(e.target.checked)}/>Remplir l’avant d’abord</label>
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
