// Page d'une classe : élèves, notes, et outils branchés.
import { html, useState, useEffect, useMemo, useRef } from '../vendor/preact.js';
import { Icon, Dialog, navigate, useTitle, toast, confirmDialog, useStore } from '../ui/core.js';
import { updateClass, deleteClass, restoreClass } from '../lib/store.js';
import { CLASS_COLORS, colorHex, periodsOf, currentPeriod, newStudent, studentAverage, classAverage, evalAverage } from '../lib/model.js';
import { parseStudentLine, parseGrade, fmt1, fmt2, plural, norm, uid, fullName, fuzzyScore } from '../lib/util.js';
import { TOOLS } from '../ui/shell.js';
import { DrawTool } from '../tools/tirage.js';
import { GroupsTool } from '../tools/groupes.js';
import { TimerTool } from '../tools/minuteur.js';
import { PlanTool } from '../tools/plan.js';

export function ClassPage({ cls, tab }) {
  useTitle(cls.name);
  const tools = TOOLS.filter((t) => t.phase === 1);
  const toolMap = { tirage: DrawTool, groupes: GroupsTool, minuteur: TimerTool, plan: PlanTool };
  const Tool = toolMap[tab];
  const avg = classAverage(cls, currentPeriod(cls));
  return html`<main id="main" class=${`page ${Tool ? 'page-wide' : ''} route-enter`} tabindex="-1" key=${tab}>
    <div class="class-head no-print">
      <div class="class-badge" style=${`--c:${colorHex(cls.color)}`} aria-hidden="true">${cls.name.slice(0, 3)}</div>
      <div style="flex:1;min-width:200px"><h1>${cls.name}${cls.demo && html` <span class="badge badge-demo" style="vertical-align:middle">Démo</span>`}</h1>
        <div class="meta"><span>${plural(cls.students.length, 'élève', 'élèves')}</span>${avg != null && html`<span>Moyenne ${periodsOf(cls).find((p) => p.n === currentPeriod(cls)).short} : <span class="tnum">${fmt1(avg)}</span></span>`}<span>${cls.year}</span></div></div>
    </div>
    <nav class="tabs no-print" aria-label="Sections de la classe">
      <a href=${`#/classes/${cls.id}`} aria-current=${tab === 'eleves' ? 'page' : undefined}><${Icon} name="users"/>Élèves</a>
      <a href=${`#/classes/${cls.id}/notes`} aria-current=${tab === 'notes' ? 'page' : undefined}><${Icon} name="file-text"/>Notes</a>
      <span class="sep" aria-hidden="true"></span>
      ${tools.map((t) => html`<a href=${`#/classes/${cls.id}/${t.id}`} aria-current=${tab === t.id ? 'page' : undefined}><${Icon} name=${t.icon}/>${t.name}</a>`)}
    </nav>
    ${tab === 'eleves' && html`<${StudentsTab} cls=${cls}/>`}
    ${tab === 'notes' && html`<${GradesTab} cls=${cls}/>`}
    ${Tool && html`<${Tool} cls=${cls}/>`}
    ${!Tool && tab !== 'eleves' && tab !== 'notes' && html`<div class="empty"><h3>Cet outil arrive bientôt</h3><p>Il fait partie des prochaines étapes du projet.</p></div>`}
  </main>`;
}

// ======================================================================
// Élèves
// ======================================================================
function StudentsTab({ cls }) {
  const [entry, setEntry] = useState('');
  const [paste, setPaste] = useState(false);
  const [fresh, setFresh] = useState(null);
  const [settings, setSettings] = useState(false);
  const inputRef = useRef();

  const add = (e) => {
    e.preventDefault();
    const p = parseStudentLine(entry);
    if (!p) return;
    const st = newStudent(p.first, p.last);
    updateClass(cls.id, (c) => { c.students.push(st); });
    setFresh(st.id); setEntry('');
    inputRef.current?.focus();
  };
  const edit = (sid, field, value) => updateClass(cls.id, (c) => { const s = c.students.find((x) => x.id === sid); if (s) s[field] = value; });
  const remove = (st) => {
    const before = cls;
    updateClass(cls.id, (c) => {
      c.students = c.students.filter((x) => x.id !== st.id);
      c.constraints.apart = c.constraints.apart.filter((p) => !p.includes(st.id));
      c.constraints.together = c.constraints.together.filter((p) => !p.includes(st.id));
      c.constraints.front = c.constraints.front.filter((x) => x !== st.id);
      c.draw.done = c.draw.done.filter((x) => x !== st.id);
      for (const pl of c.plans) for (const k of Object.keys(pl.assign)) if (pl.assign[k] === st.id) delete pl.assign[k];
    });
    toast(`${fullName(st)} a été retiré(e) de la classe.`, { icon: 'trash-2', action: { label: 'Annuler', run: () => updateClass(cls.id, () => structuredClone(before)) } });
  };
  const sorted = cls.students;

  return html`<div class="students-layout">
    <section aria-labelledby="st-title">
      <h2 id="st-title" class="sr-only">Liste des élèves</h2>
      <form class="add-student" onSubmit=${add}>
        <label class="sr-only" for="newst">Ajouter un élève (prénom et nom)</label>
        <input id="newst" ref=${inputRef} class="input" value=${entry} onInput=${(e) => setEntry(e.target.value)} placeholder="Ajouter un élève : prénom et nom, puis Entrée" autocomplete="off" autofocus=${cls.students.length === 0}/>
        <button class="btn btn-primary" type="submit" disabled=${!entry.trim()}><${Icon} name="plus"/><span class="hide-sm">Ajouter</span></button>
        <button class="btn" type="button" onClick=${() => setPaste(true)}><${Icon} name="clipboard-paste"/><span class="hide-sm">Coller une liste</span></button>
      </form>
      ${cls.students.length === 0 ? html`<div class="empty">
        <h3>Aucun élève pour l’instant</h3>
        <p>Tapez un nom ci-dessus, ou gagnez du temps : copiez la liste depuis Pronote, École Directe ou un tableur, puis collez-la.</p>
        <button class="btn btn-primary" onClick=${() => setPaste(true)}><${Icon} name="clipboard-paste"/>Coller une liste d’élèves</button>
        <p class="hint">Seuls le prénom et le nom (ou une initiale) sont nécessaires. Jamais de date de naissance ni d’adresse.</p></div>` : html`
      <div class="table-wrap"><table class="tbl">
        <thead><tr><th class="num-col">#</th><th>Prénom</th><th>Nom</th><th title="Utilisé pour accorder les appréciations">Accord</th><th class="act"><span class="sr-only">Actions</span></th></tr></thead>
        <tbody>${sorted.map((st, i) => html`<tr class=${`st-row ${fresh === st.id ? 'new' : ''}`} key=${st.id}>
          <td class="num-col">${i + 1}</td>
          <td><input class="inline" value=${st.first} aria-label=${'Prénom de l’élève ' + (i + 1)} onChange=${(e) => edit(st.id, 'first', e.target.value.trim())}/></td>
          <td><input class="inline" value=${st.last} aria-label=${'Nom de l’élève ' + (i + 1)} onChange=${(e) => edit(st.id, 'last', e.target.value.trim())} placeholder="—"/></td>
          <td><div class="g-toggle" role="group" aria-label=${'Accord pour ' + st.first}>
            <button aria-pressed=${st.g === 'f'} onClick=${() => edit(st.id, 'g', st.g === 'f' ? '' : 'f')}>elle</button>
            <button aria-pressed=${st.g === 'm'} onClick=${() => edit(st.id, 'g', st.g === 'm' ? '' : 'm')}>il</button></div></td>
          <td class="act"><button class="btn btn-ghost btn-icon btn-sm" onClick=${() => remove(st)} aria-label=${'Retirer ' + fullName(st)}><${Icon} name="trash-2"/></button></td>
        </tr>`)}</tbody></table></div>`}
    </section>
    <aside class="stack">
      <div class="card side-card">
        <h3>Outils de la classe</h3>
        <div class="tool-launch">${TOOLS.filter((t) => t.phase === 1).map((t) => html`<a href=${`#/classes/${cls.id}/${t.id}`}><${Icon} name=${t.icon}/>${t.name}<span class="kbd">${t.key}</span></a>`)}</div>
      </div>
      <${ConstraintsCard} cls=${cls}/>
      <div class="card side-card">
        <h3>Réglages</h3>
        <button class="btn" onClick=${() => setSettings(true)}><${Icon} name="settings"/>Renommer, couleur, périodes…</button>
      </div>
    </aside>
    <${PasteStudents} open=${paste} onClose=${() => setPaste(false)} cls=${cls}/>
    <${ClassSettings} open=${settings} onClose=${() => setSettings(false)} cls=${cls}/>
  </div>`;
}

function PasteStudents({ open, onClose, cls }) {
  const [text, setText] = useState('');
  useEffect(() => { if (open) setText(''); }, [open]);
  const parsed = useMemo(() => text.split(/\r?\n/).map(parseStudentLine).filter((p) => p && p.first), [text]);
  const existing = new Set(cls.students.map((s) => norm(s.first + ' ' + s.last)));
  const fresh = parsed.filter((p) => !existing.has(norm(p.first + ' ' + p.last)));
  const swap = () => setText(parsed.map((p) => `${p.last} ${p.first}`.trim()).join('\n').replace(/^/gm, ''));
  const doImport = () => {
    updateClass(cls.id, (c) => { for (const p of fresh) c.students.push(newStudent(p.first, p.last)); });
    toast(`${plural(fresh.length, 'élève ajouté', 'élèves ajoutés')}`);
    onClose();
  };
  return html`<${Dialog} open=${open} onClose=${onClose} wide title="Coller une liste d’élèves" desc="Un élève par ligne. Les formats « DUPONT Marie », « Marie Dupont » ou « Dupont, Marie » sont reconnus.">
    <div class="dlg-body stack" style="--gap:14px">
      <label class="sr-only" for="pastest">Liste d’élèves</label>
      <textarea id="pastest" class="textarea" value=${text} onInput=${(e) => setText(e.target.value)} placeholder=${'BERNARD Inès\nMOREAU Lucas\nLefèvre Chloé\n…'} autofocus></textarea>
      ${parsed.length > 0 && html`<div class="row"><strong>${plural(fresh.length, 'nouvel élève', 'nouveaux élèves')}</strong>${parsed.length !== fresh.length && html`<span class="muted">(${parsed.length - fresh.length} déjà dans la classe)</span>`}<div class="spacer"></div>
        <button class="btn btn-sm btn-ghost" onClick=${() => setText(parsed.map((p) => `${p.last}, ${p.first}`).join('\n'))} title="Si prénom et nom sont inversés"><${Icon} name="shuffle"/>Inverser prénom / nom</button></div>
      <div class="parse-preview"><table><thead><tr><th>Prénom</th><th>Nom</th></tr></thead><tbody>
        ${parsed.slice(0, 60).map((p) => html`<tr><td>${p.first}</td><td>${p.last || html`<span class="muted">—</span>`}</td></tr>`)}</tbody></table></div>`}
    </div>
    <div class="dlg-foot"><button class="btn" onClick=${onClose}>Annuler</button><button class="btn btn-primary" disabled=${!fresh.length} onClick=${doImport}>Ajouter ${fresh.length ? plural(fresh.length, 'élève', 'élèves') : ''}</button></div>
  </${Dialog}>`;
}

function ClassSettings({ open, onClose, cls }) {
  const [name, setName] = useState(cls.name);
  useEffect(() => { if (open) setName(cls.name); }, [open]);
  const save = (e) => { e.preventDefault(); if (name.trim()) updateClass(cls.id, (c) => { c.name = name.trim(); }); onClose(); };
  const del = async () => {
    const ok = await confirmDialog({ title: `Supprimer la classe ${cls.name} ?`, body: `Les ${plural(cls.students.length, 'élève', 'élèves')}, leurs notes et les plans de classe seront supprimés.`, ok: 'Supprimer la classe', danger: true });
    if (!ok) return;
    onClose();
    const removed = await deleteClass(cls.id);
    navigate('/classes');
    toast(`Classe ${cls.name} supprimée.`, { icon: 'trash-2', action: { label: 'Annuler', run: () => restoreClass(removed) }, duration: 7000 });
  };
  return html`<${Dialog} open=${open} onClose=${onClose} title="Réglages de la classe">
    <form onSubmit=${save}><div class="dlg-body stack" style="--gap:18px">
      <div class="field"><label for="rn">Nom</label><input id="rn" class="input" value=${name} onInput=${(e) => setName(e.target.value)} maxlength="40"/></div>
      <div class="field"><span class="label">Couleur</span><div class="color-pick">${CLASS_COLORS.map((c) => html`<button type="button" style=${`--c:${c.hex}`} aria-pressed=${cls.color === c.id} aria-label=${c.label} onClick=${() => updateClass(cls.id, (x) => { x.color = c.id; })}>${cls.color === c.id && html`<${Icon} name="check"/>`}</button>`)}</div></div>
      <div class="field"><span class="label">Découpage de l’année</span><div class="seg">
        <button type="button" aria-pressed=${cls.periodMode === 'trimestre'} onClick=${() => updateClass(cls.id, (x) => { x.periodMode = 'trimestre'; })}>Trimestres</button>
        <button type="button" aria-pressed=${cls.periodMode === 'semestre'} onClick=${() => updateClass(cls.id, (x) => { x.periodMode = 'semestre'; for (const e of x.evals) if (e.period > 2) e.period = 2; })}>Semestres</button></div></div>
      <hr class="divider"/>
      <div class="row"><div style="flex:1"><strong>Supprimer la classe</strong><p class="hint">Définitif après quelques secondes.</p></div><button type="button" class="btn btn-danger" onClick=${del}><${Icon} name="trash-2"/>Supprimer</button></div>
    </div>
    <div class="dlg-foot"><button class="btn btn-primary" type="submit">Terminé</button></div></form>
  </${Dialog}>`;
}

// ---------- Contraintes partagées (groupes + plan de classe) ----------
export function ConstraintsCard({ cls, compact }) {
  const [open, setOpen] = useState(false);
  const n = cls.constraints.apart.length + cls.constraints.together.length + cls.constraints.front.length;
  return html`<div class="card side-card">
    <h3>Contraintes</h3>
    <p>${n ? `${plural(n, 'règle', 'règles')} utilisée${n > 1 ? 's' : ''} par les groupes et le plan de classe.` : 'Séparer deux bavards, rapprocher deux élèves, placer devant…'}</p>
    ${n > 0 && !compact && html`<${ConstraintSummary} cls=${cls}/>`}
    <button class="btn" onClick=${() => setOpen(true)}><${Icon} name="pencil"/>${n ? 'Modifier' : 'Ajouter des contraintes'}</button>
    <${ConstraintsDialog} open=${open} onClose=${() => setOpen(false)} cls=${cls}/>
  </div>`;
}
export function ConstraintSummary({ cls }) {
  const nm = (id) => cls.students.find((s) => s.id === id)?.first || '?';
  return html`<div class="c-summary">
    ${cls.constraints.apart.map(([a, b]) => html`<span class="c-chip apart" title="Ne pas mettre ensemble">${nm(a)}<span aria-label="séparé de">✕</span>${nm(b)}</span>`)}
    ${cls.constraints.together.map(([a, b]) => html`<span class="c-chip together" title="Mettre ensemble">${nm(a)}<span aria-label="avec">＋</span>${nm(b)}</span>`)}
    ${cls.constraints.front.map((a) => html`<span class="c-chip front" title="Placer devant">${nm(a)} · devant</span>`)}
  </div>`;
}

export function ConstraintsDialog({ open, onClose, cls }) {
  const [kind, setKind] = useState('apart');
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const sts = [...cls.students].sort((x, y) => x.first.localeCompare(y.first, 'fr'));
  const nm = (id) => { const s = cls.students.find((x) => x.id === id); return s ? fullName(s) : '?'; };
  const add = (e) => {
    e.preventDefault();
    if (!a || (kind !== 'front' && (!b || a === b))) return;
    updateClass(cls.id, (c) => {
      if (kind === 'front') { if (!c.constraints.front.includes(a)) c.constraints.front.push(a); }
      else {
        const list = c.constraints[kind];
        if (!list.some((p) => p.includes(a) && p.includes(b))) list.push([a, b]);
        const other = c.constraints[kind === 'apart' ? 'together' : 'apart'];
        c.constraints[kind === 'apart' ? 'together' : 'apart'] = other.filter((p) => !(p.includes(a) && p.includes(b)));
      }
    });
    setA(''); setB('');
  };
  const rm = (k, i) => updateClass(cls.id, (c) => { c.constraints[k].splice(i, 1); });
  const sel = (v, set, label, id) => html`<select id=${id} class="select" value=${v} onChange=${(e) => set(e.target.value)} aria-label=${label}><option value="">${label}</option>${sts.map((s) => html`<option value=${s.id}>${fullName(s)}</option>`)}</select>`;
  return html`<${Dialog} open=${open} onClose=${onClose} wide title="Contraintes de la classe" desc="Elles s’appliquent automatiquement aux groupes et au plan de classe.">
    <div class="dlg-body stack" style="--gap:20px">
      <form class="stack" style="--gap:12px" onSubmit=${add}>
        <div class="seg" role="group" aria-label="Type de contrainte">
          <button type="button" aria-pressed=${kind === 'apart'} onClick=${() => setKind('apart')}>Ne pas mettre ensemble</button>
          <button type="button" aria-pressed=${kind === 'together'} onClick=${() => setKind('together')}>Mettre ensemble</button>
          <button type="button" aria-pressed=${kind === 'front'} onClick=${() => setKind('front')}>Placer devant</button></div>
        <div class="c-form">${sel(a, setA, 'Choisir un élève', 'ca')}${kind !== 'front' && html`<span class="c-op">${kind === 'apart' ? 'et' : 'avec'}</span>${sel(b, setB, 'Choisir un élève', 'cb')}`}
          <button class="btn btn-primary" type="submit" disabled=${!a || (kind !== 'front' && (!b || a === b))}><${Icon} name="plus"/>Ajouter</button></div>
      </form>
      <div class="c-lists">
        ${[['apart', 'Ne pas mettre ensemble', 'x'], ['together', 'Mettre ensemble', 'plus']].map(([k, label, ic]) => html`<div><h4 class="eyebrow" style="margin-bottom:8px">${label}</h4>
          ${cls.constraints[k].length === 0 ? html`<p class="hint">Aucune.</p>` : cls.constraints[k].map(([x, y], i) => html`<div class="c-line"><${Icon} name=${ic} size=${16}/>${nm(x)} <span class="muted">${k === 'apart' ? 'et' : 'avec'}</span> ${nm(y)}<button class="btn btn-ghost btn-icon btn-sm" onClick=${() => rm(k, i)} aria-label="Supprimer cette contrainte"><${Icon} name="x"/></button></div>`)}</div>`)}
        <div><h4 class="eyebrow" style="margin-bottom:8px">Placer devant</h4>
          ${cls.constraints.front.length === 0 ? html`<p class="hint">Aucun.</p>` : cls.constraints.front.map((x, i) => html`<div class="c-line"><${Icon} name="eye" size=${16}/>${nm(x)}<button class="btn btn-ghost btn-icon btn-sm" onClick=${() => rm('front', i)} aria-label="Supprimer"><${Icon} name="x"/></button></div>`)}</div>
      </div>
    </div>
    <div class="dlg-foot"><button class="btn btn-primary" onClick=${onClose}>Terminé</button></div>
  </${Dialog}>`;
}

// ======================================================================
// Notes
// ======================================================================
function GradesTab({ cls }) {
  const periods = periodsOf(cls);
  const [period, setPeriod] = useState(() => Math.min(currentPeriod(cls), periods.length));
  const [evalDlg, setEvalDlg] = useState(null); // null | 'new' | eval
  const [paste, setPaste] = useState(false);
  const evals = cls.evals.filter((e) => e.period === period).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  const setGrade = (eid, sid, raw, el) => {
    const v = parseGrade(raw);
    if (v === undefined) { el.classList.add('bad'); return; }
    el.classList.remove('bad');
    const ev = cls.evals.find((e) => e.id === eid);
    if (typeof v === 'number' && (v < 0 || v > (ev?.max || 20))) { el.classList.add('bad'); toast(`La note doit être entre 0 et ${ev?.max || 20}.`, { icon: 'triangle-alert' }); return; }
    updateClass(cls.id, (c) => { const e = c.evals.find((x) => x.id === eid); if (!e) return; if (v == null) delete e.grades[sid]; else e.grades[sid] = v; });
  };
  const display = (v) => (v == null ? '' : v === 'abs' ? 'abs' : v === 'disp' ? 'disp' : fmt2(v));
  // Navigation au clavier type tableur.
  const onKey = (e) => {
    const td = e.target.closest('td');
    const tr = td?.parentElement;
    if (!tr) return;
    const col = [...tr.children].indexOf(td);
    let target;
    if (e.key === 'Enter' || e.key === 'ArrowDown') target = tr.nextElementSibling?.children[col];
    else if (e.key === 'ArrowUp') target = tr.previousElementSibling?.children[col];
    else if (e.key === 'ArrowRight' && e.target.selectionStart === e.target.value.length) target = td.nextElementSibling;
    else if (e.key === 'ArrowLeft' && e.target.selectionStart === 0) target = td.previousElementSibling;
    const inp = target?.querySelector('input');
    if (inp) { e.preventDefault(); e.target.blur(); inp.focus(); inp.select(); }
  };
  const tone = (v) => (v == null ? '' : v < 8 ? 'lo' : v < 12 ? 'mid' : 'hi');
  const avgP = classAverage(cls, period);

  return html`<section aria-labelledby="g-title">
    <h2 id="g-title" class="sr-only">Notes</h2>
    <div class="grades-bar">
      <div class="seg" role="tablist" aria-label="Période">${periods.map((p) => html`<button role="tab" aria-selected=${p.n === period} onClick=${() => setPeriod(p.n)}>${p.label}</button>`)}</div>
      <div class="spacer"></div>
      <button class="btn" onClick=${() => setPaste(true)} disabled=${!cls.students.length}><${Icon} name="clipboard-paste"/>Coller un tableau</button>
      <button class="btn btn-primary" onClick=${() => setEvalDlg('new')} disabled=${!cls.students.length}><${Icon} name="plus"/>Nouvelle évaluation</button>
    </div>
    ${!cls.students.length ? html`<div class="empty"><h3>Ajoutez d’abord vos élèves</h3><p>Les notes se saisissent dans un tableau, élève par élève.</p><a class="btn btn-primary" href=${`#/classes/${cls.id}`}>Ajouter des élèves</a></div>`
    : evals.length === 0 ? html`<div class="empty"><h3>Pas encore de note ce ${periods.find((p) => p.n === period).label.toLowerCase()}</h3>
        <p>Créez une évaluation, puis saisissez les notes comme dans un tableur (Entrée pour descendre). Vous pouvez aussi coller un tableau depuis Pronote ou Excel.</p>
        <div class="row" style="justify-content:center"><button class="btn btn-primary" onClick=${() => setEvalDlg('new')}><${Icon} name="plus"/>Nouvelle évaluation</button><button class="btn" onClick=${() => setPaste(true)}><${Icon} name="clipboard-paste"/>Coller un tableau</button></div>
        <p class="hint">L’import depuis une capture d’écran arrive à la phase 3.</p></div>`
    : html`<div class="table-wrap"><table class="tbl gtbl" onKeyDown=${onKey}>
      <thead><tr><th class="sticky-col">Élève</th>
        ${evals.map((e) => html`<th class="eval-h"><button onClick=${() => setEvalDlg(e)} title="Modifier l’évaluation"><span class="t">${e.title}</span><span class="m">/${e.max} · coef ${fmt2(e.coef)}${e.date ? ' · ' + new Date(e.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : ''}</span></button></th>`)}
        <th class="avg-col">Moyenne /20</th></tr></thead>
      <tbody>${cls.students.map((st) => {
        const a = studentAverage(cls, st.id, period);
        return html`<tr key=${st.id}><td class="sticky-col" style="font-weight:600">${st.first} ${st.last}</td>
          ${evals.map((e) => { const v = e.grades?.[st.id]; return html`<td class="cell"><input value=${display(v)} class=${typeof v === 'string' ? 'special' : ''} inputmode="decimal" aria-label=${`${e.title} — ${st.first} ${st.last}`} onChange=${(ev) => setGrade(e.id, st.id, ev.target.value, ev.target)} onFocus=${(ev) => ev.target.select()}/></td>`; })}
          <td class="avg-col">${a == null ? html`<span class="muted">—</span>` : html`<span class=${'grade-pill ' + tone(a)}>${fmt2(a)}</span>`}</td></tr>`;
      })}</tbody>
      <tfoot><tr><td class="sticky-col">Moyenne de la classe</td>${evals.map((e) => html`<td>${fmt2(evalAverage(cls, e))}</td>`)}<td class="avg-col">${fmt2(avgP)}</td></tr></tfoot>
    </table></div>
    <p class="hint" style="margin-top:10px">Astuce : tapez « abs » pour absent, « disp » pour dispensé. Ces cas ne comptent pas dans la moyenne.</p>`}
    <${EvalDialog} target=${evalDlg} onClose=${() => setEvalDlg(null)} cls=${cls} period=${period}/>
    <${PasteGrades} open=${paste} onClose=${() => setPaste(false)} cls=${cls} period=${period}/>
  </section>`;
}

function EvalDialog({ target, onClose, cls, period }) {
  const isNew = target === 'new';
  const ev = !isNew && target;
  const [title, setTitle] = useState('');
  const [max, setMax] = useState('20');
  const [coef, setCoef] = useState('1');
  const [date, setDate] = useState('');
  useEffect(() => {
    if (!target) return;
    setTitle(ev ? ev.title : ''); setMax(String(ev ? ev.max : 20)); setCoef(String(ev ? ev.coef : 1).replace('.', ','));
    setDate(ev ? ev.date || '' : new Date().toISOString().slice(0, 10));
  }, [target]);
  const save = (e) => {
    e.preventDefault();
    const m = Number(String(max).replace(',', '.')) || 20;
    const c = Number(String(coef).replace(',', '.'));
    const data = { title: title.trim() || 'Évaluation', max: m, coef: Number.isFinite(c) && c >= 0 ? c : 1, date };
    updateClass(cls.id, (x) => {
      if (isNew) x.evals.push({ id: uid('e_'), period, grades: {}, ...data });
      else Object.assign(x.evals.find((y) => y.id === ev.id), data);
    });
    onClose();
  };
  const del = async () => {
    if (!(await confirmDialog({ title: `Supprimer « ${ev.title} » ?`, body: 'Toutes les notes de cette évaluation seront effacées.', ok: 'Supprimer', danger: true }))) return;
    const before = cls;
    updateClass(cls.id, (x) => { x.evals = x.evals.filter((y) => y.id !== ev.id); });
    onClose();
    toast('Évaluation supprimée.', { icon: 'trash-2', action: { label: 'Annuler', run: () => updateClass(cls.id, () => structuredClone(before)) } });
  };
  return html`<${Dialog} open=${!!target} onClose=${onClose} title=${isNew ? 'Nouvelle évaluation' : 'Modifier l’évaluation'}>
    <form onSubmit=${save}><div class="dlg-body stack" style="--gap:16px">
      <div class="field"><label for="et">Intitulé</label><input id="et" class="input" value=${title} onInput=${(e) => setTitle(e.target.value)} placeholder="Ex. Contrôle — théorème de Pythagore" autofocus maxlength="80"/></div>
      <div class="row" style="--gap:12px;align-items:flex-start">
        <div class="field" style="flex:1;min-width:90px"><label for="em">Noté sur</label><input id="em" class="input" inputmode="decimal" value=${max} onInput=${(e) => setMax(e.target.value)}/></div>
        <div class="field" style="flex:1;min-width:90px"><label for="ec">Coefficient</label><input id="ec" class="input" inputmode="decimal" value=${coef} onInput=${(e) => setCoef(e.target.value)}/></div>
        <div class="field" style="flex:1.4;min-width:140px"><label for="ed">Date</label><input id="ed" class="input" type="date" value=${date} onInput=${(e) => setDate(e.target.value)}/></div>
      </div>
    </div>
    <div class="dlg-foot">${!isNew && html`<button type="button" class="btn btn-danger" style="margin-right:auto" onClick=${del}><${Icon} name="trash-2"/>Supprimer</button>`}
      <button type="button" class="btn" onClick=${onClose}>Annuler</button><button class="btn btn-primary" type="submit">${isNew ? 'Créer' : 'Enregistrer'}</button></div></form>
  </${Dialog}>`;
}

/** Associe un nom collé à un élève de la classe (tolère accents, ordre, initiale). */
export function matchStudent(cls, raw) {
  const p = parseStudentLine(raw);
  if (!p) return null;
  let best = null, bestSc = 0;
  for (const s of cls.students) {
    const cands = [`${s.first} ${s.last}`, `${s.last} ${s.first}`];
    const target = `${p.first} ${p.last}`;
    let sc = 0;
    if (norm(s.first) === norm(p.first) && norm(s.last) === norm(p.last)) sc = 200;
    else if (norm(s.first) === norm(p.last) && norm(s.last) === norm(p.first)) sc = 190;
    else sc = Math.max(...cands.map((c) => fuzzyScore(target, c)));
    if (sc > bestSc) { bestSc = sc; best = s; }
  }
  return bestSc >= 60 ? best : null;
}

function PasteGrades({ open, onClose, cls, period }) {
  const [text, setText] = useState('');
  const [title, setTitle] = useState('');
  const [max, setMax] = useState('20');
  useEffect(() => { if (open) { setText(''); setTitle(''); } }, [open]);
  const rows = useMemo(() => text.split(/\r?\n/).filter((l) => l.trim()).map((l) => {
    const cells = l.includes('\t') ? l.split('\t') : l.split(/;|\s{2,}/);
    let name = cells[0];
    let grade = cells.slice(1).map((c) => c.trim()).find((c) => parseGrade(c) !== undefined && c !== '');
    if (cells.length === 1) { const m = l.match(/^(.*?)[\s:]+(\d+(?:[.,]\d+)?|abs|disp)\s*$/i); if (m) { name = m[1]; grade = m[2]; } }
    const st = matchStudent(cls, name);
    return { raw: name.trim(), st, grade: parseGrade(grade) };
  }).filter((r) => r.raw), [text, cls]);
  const ok = rows.filter((r) => r.st && r.grade != null);
  const doImport = () => {
    const m = Number(String(max).replace(',', '.')) || 20;
    updateClass(cls.id, (c) => {
      const grades = {};
      for (const r of ok) grades[r.st.id] = r.grade;
      c.evals.push({ id: uid('e_'), period, title: title.trim() || 'Évaluation importée', max: m, coef: 1, date: new Date().toISOString().slice(0, 10), grades });
    });
    toast(`${plural(ok.length, 'note importée', 'notes importées')}`);
    onClose();
  };
  return html`<${Dialog} open=${open} onClose=${onClose} wide title="Coller un tableau de notes" desc="Copiez deux colonnes (nom, note) depuis Pronote, École Directe ou un tableur, puis collez-les ici. Vous vérifiez avant de valider.">
    <div class="dlg-body stack" style="--gap:14px">
      <div class="row" style="--gap:12px;align-items:flex-end">
        <div class="field" style="flex:3;min-width:200px"><label for="pt">Intitulé de l’évaluation</label><input id="pt" class="input" value=${title} onInput=${(e) => setTitle(e.target.value)} placeholder="Ex. Contrôle n°2"/></div>
        <div class="field" style="flex:1;min-width:90px"><label for="pm">Sur</label><input id="pm" class="input" value=${max} onInput=${(e) => setMax(e.target.value)} inputmode="decimal"/></div></div>
      <label class="sr-only" for="pg">Tableau collé</label>
      <textarea id="pg" class="textarea" value=${text} onInput=${(e) => setText(e.target.value)} placeholder=${'BERNARD Inès\t15,5\nMOREAU Lucas\t11\n…'}></textarea>
      ${rows.length > 0 && html`<div class="parse-preview"><table><thead><tr><th>Ligne collée</th><th>Élève reconnu</th><th>Note</th></tr></thead><tbody>
        ${rows.map((r) => html`<tr><td>${r.raw}</td><td>${r.st ? html`<span style="color:var(--vert);font-weight:700">✓</span> ${fullName(r.st)}` : html`<span class="error-text">Non reconnu</span>`}</td><td class="tnum">${r.grade == null ? html`<span class="error-text">?</span>` : typeof r.grade === 'number' ? fmt2(r.grade) : r.grade}</td></tr>`)}</tbody></table></div>
        <p class="hint">${ok.length} / ${rows.length} lignes prêtes à importer. Les lignes non reconnues seront ignorées ; vous pourrez compléter à la main.</p>`}
    </div>
    <div class="dlg-foot"><button class="btn" onClick=${onClose}>Annuler</button><button class="btn btn-primary" disabled=${!ok.length} onClick=${doImport}>Importer ${ok.length ? plural(ok.length, 'note', 'notes') : ''}</button></div>
  </${Dialog}>`;
}
