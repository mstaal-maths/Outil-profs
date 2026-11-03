// Tableau de bord : « Mes classes ».
import { html, useState, useEffect, useMemo, useRef } from '../vendor/preact.js';
import { Icon, Dialog, navigate, useStore, useTitle } from '../ui/core.js';
import { classList, createClass, leaveDemo } from '../lib/store.js';
import { CLASS_COLORS, colorHex, classAverage, currentPeriod } from '../lib/model.js';
import { fuzzyScore, norm, plural, fmt1, initials, relTime } from '../lib/util.js';

export function Dashboard() {
  const s = useStore();
  useTitle('Mes classes');
  const [q, setQ] = useState('');
  const [creating, setCreating] = useState(location.hash.includes('nouvelle'));
  const searchRef = useRef();
  useEffect(() => { if (location.hash.includes('nouvelle')) { setCreating(true); history.replaceState(null, '', '#/classes'); } });
  const classes = classList();
  const filtered = useMemo(() => {
    if (!q.trim()) return classes;
    return classes.map((c) => ({ c, sc: fuzzyScore(q, c.name) })).filter((x) => x.sc > 20).sort((a, b) => b.sc - a.sc).map((x) => x.c);
  }, [q, s.classes]);
  const studentHits = useMemo(() => {
    if (q.trim().length < 2) return [];
    const out = [];
    for (const c of classes) for (const st of c.students) {
      const sc = Math.max(fuzzyScore(q, `${st.first} ${st.last}`), fuzzyScore(q, `${st.last} ${st.first}`));
      if (sc > 40) out.push({ st, c, sc });
    }
    return out.sort((a, b) => b.sc - a.sc).slice(0, 8);
  }, [q, s.classes]);

  const total = classes.reduce((a, c) => a + c.students.length, 0);
  const hour = new Date().getHours();
  const hello = hour < 5 ? 'Bonsoir' : hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir';

  return html`<main id="main" class="page route-enter" tabindex="-1">
    ${s.mode === 'demo' && html`<div class="demo-banner"><${Icon} name="sparkles"/>
      <p>Vous êtes en démonstration. <span>Les élèves sont fictifs : modifiez, mélangez, cassez tout, rien n’est enregistré.</span></p>
      <a class="btn btn-primary btn-sm" href="#/inscription">Créer mon compte gratuit</a>
      <button class="btn btn-ghost btn-sm" onClick=${() => { leaveDemo(); navigate('/'); }}>Quitter</button></div>`}
    <div class="page-head">
      <div style="flex:1;min-width:240px">
        <p class="eyebrow">${hello}${s.user?.email ? '' : ''}</p>
        <h1 style="margin-top:6px">Mes classes</h1>
        <p class="sub">${classes.length ? `${plural(classes.length, 'classe', 'classes')} · ${plural(total, 'élève', 'élèves')}` : 'Commencez par créer votre première classe.'}</p>
      </div>
    </div>
    ${classes.length > 0 && html`<div class="dash-tools">
      <div class="dash-search"><${Icon} name="search"/>
        <label class="sr-only" for="dsearch">Rechercher une classe ou un élève</label>
        <input id="dsearch" ref=${searchRef} class="input" type="search" placeholder="Rechercher une classe ou un élève…" value=${q} onInput=${(e) => setQ(e.target.value)} autocomplete="off"/></div>
      <div class="spacer"></div>
      <a class="btn" href="#/minuteur"><${Icon} name="timer"/>Minuteur</a>
      <button class="btn btn-primary" onClick=${() => setCreating(true)}><${Icon} name="plus"/>Nouvelle classe</button>
    </div>`}

    ${classes.length === 0 ? html`<div class="empty">
      <svg class="illu" viewBox="0 0 120 90" aria-hidden="true"><rect x="14" y="20" width="92" height="60" rx="16" fill="var(--encre-soft)"/><path d="M28 38c10 7 21 10 32 10s22-3 32-10" stroke="var(--encre)" stroke-width="3" stroke-dasharray="1 6" stroke-linecap="round" fill="none"/><rect x="80" y="4" width="10" height="38" rx="5" transform="rotate(28 85 23)" fill="var(--marge)"/></svg>
      <h3>Votre trousse est encore vide</h3>
      <p>Créez une classe, ajoutez vos élèves (vous pouvez coller une liste depuis Pronote ou École Directe), et tous les outils seront prêts.</p>
      <button class="btn btn-primary btn-lg" onClick=${() => setCreating(true)}><${Icon} name="plus"/>Créer ma première classe</button>
    </div>` : html`
      <div class="class-grid">
        ${filtered.map((c, i) => {
          const avg = classAverage(c, currentPeriod(c));
          return html`<a class="class-card" href=${'#/classes/' + c.id} style=${`--c:${colorHex(c.color)};--i:${i}`} key=${c.id}>
            <div><h3>${c.name}</h3>
            <div class="meta"><span><${Icon} name="users"/>${plural(c.students.length, 'élève', 'élèves')}</span><span>Modifiée ${relTime(c.updatedAt)}</span></div></div>
            ${avg != null && html`<div class="avg"><b class="tnum">${fmt1(avg)}</b><small>moy. T${currentPeriod(c)}</small></div>`}
            <div class="faces" aria-hidden="true">${c.students.slice(0, 7).map((st) => html`<span>${initials(st)}</span>`)}${c.students.length > 7 && html`<span>+${c.students.length - 7}</span>`}</div>
          </a>`;
        })}
        ${!q && html`<button class="new-card" onClick=${() => setCreating(true)}><div><div class="plus"><${Icon} name="plus"/></div>Nouvelle classe</div></button>`}
      </div>
      ${q && filtered.length === 0 && studentHits.length === 0 && html`<div class="empty" style="margin-top:8px"><h3>Rien trouvé pour « ${q} »</h3><p>Vérifiez l’orthographe, ou cherchez par prénom.</p></div>`}
      ${studentHits.length > 0 && html`<div class="search-results"><h2>Élèves</h2>${studentHits.map(({ st, c }) => html`<a class="student-hit" href=${'#/classes/' + c.id}>
        <span class="class-dot" style=${`--c:${colorHex(c.color)}`}></span>${st.first} ${st.last}<span class="muted" style="margin-left:auto;font-weight:600">${c.name}</span><${Icon} name="chevron-right" size=${16}/></a>`)}</div>`}
    `}
    <${NewClassDialog} open=${creating} onClose=${() => setCreating(false)}/>
  </main>`;
}

const SUGGESTIONS = ['6e A', '5e B', '4e C', '3e D', '2nde 1', '1re G2', 'Tle 3', 'BTS 1'];

export function NewClassDialog({ open, onClose }) {
  const [name, setName] = useState('');
  const [color, setColor] = useState('encre');
  const [mode, setMode] = useState('trimestre');
  const [err, setErr] = useState('');
  useEffect(() => { if (open) { setName(''); setErr(''); setColor(CLASS_COLORS[classList().length % CLASS_COLORS.length].id); } }, [open]);
  const submit = (e) => {
    e.preventDefault();
    if (!name.trim()) return setErr('Donnez un nom à la classe, par exemple « 5e E ».');
    if (classList().some((c) => norm(c.name) === norm(name))) return setErr('Vous avez déjà une classe avec ce nom.');
    const c = createClass({ name, color, periodMode: mode });
    onClose();
    navigate('/classes/' + c.id);
  };
  return html`<${Dialog} open=${open} onClose=${onClose} title="Nouvelle classe" desc="Vous pourrez tout modifier plus tard.">
    <form onSubmit=${submit} id="newclass">
      <div class="dlg-body stack" style="--gap:18px">
        <div class="field"><label for="cname">Nom de la classe</label>
          <input id="cname" class="input" value=${name} onInput=${(e) => setName(e.target.value)} placeholder="Ex. 5e E" autofocus maxlength="40" aria-invalid=${err ? 'true' : undefined}/>
          <div class="suggest">${SUGGESTIONS.map((x) => html`<button type="button" onClick=${() => setName(x)}>${x}</button>`)}</div>
          ${err && html`<p class="error-text" role="alert">${err}</p>`}</div>
        <div class="field"><span class="label" id="ccol">Couleur</span>
          <div class="color-pick" role="group" aria-labelledby="ccol">${CLASS_COLORS.map((c) => html`<button type="button" style=${`--c:${c.hex}`} aria-pressed=${color === c.id} aria-label=${c.label} onClick=${() => setColor(c.id)}>${color === c.id && html`<${Icon} name="check"/>`}</button>`)}</div></div>
        <div class="field"><span class="label" id="cper">Découpage de l’année</span>
          <div class="seg" role="group" aria-labelledby="cper">
            <button type="button" aria-pressed=${mode === 'trimestre'} onClick=${() => setMode('trimestre')}>Trimestres</button>
            <button type="button" aria-pressed=${mode === 'semestre'} onClick=${() => setMode('semestre')}>Semestres</button></div></div>
      </div>
      <div class="dlg-foot"><button type="button" class="btn" onClick=${onClose}>Annuler</button><button class="btn btn-primary" type="submit">Créer la classe</button></div>
    </form>
  </${Dialog}>`;
}
