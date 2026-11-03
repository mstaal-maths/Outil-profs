// Outil 2 — Générateur de groupes.
import { html, useState, useRef, useLayoutEffect } from '../vendor/preact.js';
import { Icon, toggleFullscreen, useFullscreen, toast, useProjection } from '../ui/core.js';
import { updateClass } from '../lib/store.js';
import { makeGroups, violations, sizesFor } from '../lib/groups.js';
import { levelMap, periodsOf, currentPeriod, hasGrades } from '../lib/model.js';
import { shortName, fullName, fmt1, plural } from '../lib/util.js';
import { startDrag, flip } from '../ui/dnd.js';
import { ConstraintsCard } from '../pages/classe.js';

const today = () => new Date().toISOString().slice(0, 10);
const MODES = [
  { id: 'random', label: 'Aléatoires', icon: 'shuffle', desc: 'Le hasard, en respectant vos contraintes.' },
  { id: 'hetero', label: 'Hétérogènes', icon: 'layers', desc: 'Chaque groupe mélange les niveaux, moyennes équilibrées.' },
  { id: 'homo', label: 'Homogènes', icon: 'chart-column', desc: 'Des élèves de niveau proche ensemble.' },
];

export function GroupsTool({ cls }) {
  const stageRef = useRef();
  const gridRef = useRef();
  const flipRef = useRef(null);
  const fs = useFullscreen();
  const proj = useProjection();
  const periods = periodsOf(cls);
  const saved = cls.groups || {};
  const [mode, setMode] = useState(saved.mode || 'random');
  const [period, setPeriod] = useState(saved.period || Math.min(currentPeriod(cls), periods.length));
  const [by, setBy] = useState(saved.by || 'size');
  const [size, setSize] = useState(saved.size || 4);
  const [count, setCount] = useState(saved.count || 6);
  const [showLv, setShowLv] = useState(false);
  const [picked, setPicked] = useState(null); // élève sélectionné au clavier
  const [gen, setGen] = useState(0);

  const absent = cls.draw?.absentDate === today() ? cls.draw.absent || [] : [];
  const ids = cls.students.filter((s) => !absent.includes(s.id)).map((s) => s.id);
  const graded = hasGrades(cls, period) || hasGrades(cls);
  const levels = levelMap(cls, period);
  const groups = (saved.list || []).map((g) => ({ ...g, members: g.members.filter((id) => cls.students.some((s) => s.id === id)) }));
  const viol = violations(groups.map((g) => g.members), cls.constraints);
  const bad = new Set(viol.flatMap((v) => [v.a, v.b]));
  const stu = (id) => cls.students.find((s) => s.id === id);
  const sizes = sizesFor(ids.length, by === 'size' ? { size } : { count });

  useLayoutEffect(() => { flipRef.current?.(); flipRef.current = null; });

  function generate() {
    if (mode !== 'random' && !graded) { toast('Il faut des notes pour faire des groupes par niveau. Ajoutez-en dans l’onglet Notes.', { icon: 'info' }); return; }
    const gs = makeGroups({ ids, levels, mode, size, count: by === 'count' ? count : 0, constraints: cls.constraints });
    updateClass(cls.id, (c) => { c.groups = { mode, period, by, size, count, at: Date.now(), list: gs.map((m, i) => ({ name: `Groupe ${i + 1}`, members: m })) }; });
    setGen((x) => x + 1);
    setPicked(null);
    const v = violations(gs, cls.constraints);
    if (v.length) toast(`Impossible de respecter toutes les contraintes (${v.length}). Ajustez à la main.`, { icon: 'triangle-alert' });
  }
  function move(sid, toIdx) {
    flipRef.current = flip(gridRef.current, '[data-flip]');
    updateClass(cls.id, (c) => {
      const list = c.groups.list;
      for (const g of list) g.members = g.members.filter((x) => x !== sid);
      if (toIdx === 'new') list.push({ name: `Groupe ${list.length + 1}`, members: [sid] });
      else list[Number(toIdx)].members.push(sid);
      c.groups.list = list.filter((g) => g.members.length);
    });
    setPicked(null);
  }
  const rename = (i, name) => updateClass(cls.id, (c) => { c.groups.list[i].name = name || `Groupe ${i + 1}`; });
  const gMean = (g) => { const v = g.members.map((id) => levels[id]); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
  const lvTone = (v) => (v < 8 ? 'lo' : v < 12 ? 'mid' : 'hi');
  const levelsVisible = showLv && !proj && mode !== 'random';

  if (cls.students.length < 2) return html`<div class="empty"><h3>Il faut au moins deux élèves</h3><p>Ajoutez les élèves de la classe pour former des groupes.</p><a class="btn btn-primary" href=${`#/classes/${cls.id}`}>Ajouter des élèves</a></div>`;

  return html`<div class="tool-layout">
    <section class=${`stage groups-stage ${fs ? 'is-fs' : ''}`} ref=${stageRef} aria-label="Groupes">
      <div class="stage-top">
        <strong class="stage-title">${groups.length ? `${plural(groups.length, 'groupe', 'groupes')} · ${MODES.find((m) => m.id === (saved.mode || mode)).label.toLowerCase()}` : 'Groupes'}</strong>
        ${viol.length > 0 && html`<span class="chip warn-chip"><${Icon} name="triangle-alert"/>${plural(viol.length, 'contrainte non respectée', 'contraintes non respectées')}</span>`}
        <div class="spacer"></div>
        ${mode !== 'random' && graded && groups.length > 0 && html`<label class="switch hide-sm" title="Visible uniquement pour vous, masqué en mode projection"><input type="checkbox" checked=${showLv} onChange=${(e) => setShowLv(e.target.checked)}/>Niveaux</label>`}
        <button class="btn btn-ghost btn-icon btn-sm" onClick=${() => window.print()} aria-label="Imprimer les groupes" disabled=${!groups.length}><${Icon} name="printer"/></button>
        <button class="btn btn-ghost btn-icon btn-sm" onClick=${() => toggleFullscreen(stageRef.current)} aria-label=${fs ? 'Quitter le plein écran' : 'Plein écran'}><${Icon} name=${fs ? 'minimize' : 'maximize'}/></button>
      </div>
      ${groups.length === 0 ? html`<div class="draw-idle" style="min-height:340px"><div class="hat"><${Icon} name="users"/></div><p>Prêt à former ${plural(sizes.length, 'groupe', 'groupes')}</p><span class="hint">${ids.length} élèves présents · ${sizes.join(', ')} élèves par groupe</span>
          <button class="btn btn-primary btn-lg" style="margin-top:12px" onClick=${generate}><${Icon} name="wand-sparkles"/>Former les groupes</button></div>`
      : html`<div class="groups-grid" ref=${gridRef} key=${gen}>
        ${groups.map((g, i) => {
          const m = gMean(g);
          return html`<div class=${`group-card ${picked ? 'can-drop' : ''}`} data-drop=${i} style=${`--i:${i}`} onClick=${() => picked && move(picked, i)}>
            <div class="group-head"><input class="group-name" value=${g.name} onChange=${(e) => rename(i, e.target.value.trim())} aria-label=${`Nom du groupe ${i + 1}`} onClick=${(e) => e.stopPropagation()}/>
              ${levelsVisible && m != null ? html`<span class=${'grade-pill ' + lvTone(m)} title="Moyenne du groupe">${fmt1(m)}</span>` : html`<span class="g-count">${g.members.length}</span>`}</div>
            <ul class="members">${g.members.map((id) => {
              const s = stu(id);
              if (!s) return null;
              return html`<li key=${id} data-flip=${id}><button class=${`member ${bad.has(id) ? 'bad' : ''} ${picked === id ? 'picked' : ''}`}
                onPointerDown=${(e) => startDrag(e, { data: id, onDrop: (to) => move(id, to) })}
                onClick=${(e) => { e.stopPropagation(); setPicked(picked === id ? null : id); }}
                aria-pressed=${picked === id} aria-label=${`${fullName(s)}. ${picked === id ? 'Sélectionné : choisissez un groupe.' : 'Sélectionner pour déplacer.'}`}
                title=${bad.has(id) ? 'Contrainte non respectée' : 'Glissez vers un autre groupe'}>
                ${levelsVisible && html`<i class=${'lv ' + lvTone(levels[id])} aria-hidden="true"></i>`}<span>${shortName(s, cls.students)}</span></button></li>`;
            })}</ul>
          </div>`;
        })}
        <div class="group-card new-group" data-drop="new" onClick=${() => picked && move(picked, 'new')}><${Icon} name="plus"/>Nouveau groupe</div>
      </div>`}
      ${picked && html`<div class="pick-hint" role="status">Choisissez le groupe de ${stu(picked)?.first} — ou glissez directement.</div>`}
      ${groups.length > 0 && html`<div class="stage-bottom">
        <button class="btn btn-primary btn-lg" onClick=${generate}><${Icon} name="shuffle"/>Nouveaux groupes</button>
      </div>`}
    </section>

    <aside class="tool-side no-print stack" style="--gap:14px">
      <div class="card side-card">
        <h3>Type de groupes</h3>
        <div class="mode-list" role="radiogroup" aria-label="Type de groupes">${MODES.map((m) => html`<button role="radio" aria-checked=${mode === m.id} class="mode-opt" onClick=${() => setMode(m.id)} disabled=${m.id !== 'random' && !graded}>
          <${Icon} name=${m.icon}/><span><b>${m.label}</b><small>${m.id !== 'random' && !graded ? 'Nécessite des notes' : m.desc}</small></span></button>`)}</div>
        ${mode !== 'random' && graded && html`<div class="field"><label for="gp">Niveau calculé sur</label><select id="gp" class="select" value=${period} onChange=${(e) => setPeriod(Number(e.target.value))}>${periods.map((p) => html`<option value=${p.n}>${p.label}</option>`)}</select></div>`}
      </div>
      <div class="card side-card">
        <h3>Taille</h3>
        <div class="seg" role="group" aria-label="Choisir par"><button aria-pressed=${by === 'size'} onClick=${() => setBy('size')}>Élèves par groupe</button><button aria-pressed=${by === 'count'} onClick=${() => setBy('count')}>Nombre de groupes</button></div>
        <div class="stepper">
          <button class="btn btn-icon" onClick=${() => (by === 'size' ? setSize(Math.max(2, size - 1)) : setCount(Math.max(2, count - 1)))} aria-label="Moins">−</button>
          <output class="tnum" aria-live="polite">${by === 'size' ? size : count}</output>
          <button class="btn btn-icon" onClick=${() => (by === 'size' ? setSize(Math.min(12, size + 1)) : setCount(Math.min(ids.length, count + 1)))} aria-label="Plus">+</button>
        </div>
        <p class="hint">${ids.length} présents → ${plural(sizes.length, 'groupe', 'groupes')} de ${[...new Set(sizes)].sort((a, b) => b - a).join(' ou ')}${absent.length ? ` · ${plural(absent.length, 'absent', 'absents')} (voir Tirage)` : ''}</p>
      </div>
      <${ConstraintsCard} cls=${cls}/>
    </aside>
  </div>`;
}
