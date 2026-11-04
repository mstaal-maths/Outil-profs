// Outil 5 — Appréciations de bulletin : un élève, 4 thèmes, et l'appréciation est rédigée.
import { html, useState, useEffect, useMemo } from '../vendor/preact.js';
import { Icon, toast, Dialog } from '../ui/core.js';
import { BOOKMARKLET, ED_LIMIT, payloadFor } from '../lib/edfill.js';
import { updateClass } from '../lib/store.js';
import { periodsOf, currentPeriod, studentAverage } from '../lib/model.js';
import { CRITERIA, REMARKS, composeAll, resultLevel, suggestProgress } from '../lib/apprec.js';
import { fmt1, fullName, plural } from '../lib/util.js';

async function copyText(t) {
  try { await navigator.clipboard.writeText(t); return true; }
  catch {
    const ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch {}
    ta.remove(); return ok;
  }
}

export function AppreciationsTool({ cls }) {
  const periods = periodsOf(cls);
  const [period, setPeriod] = useState(() => Math.min(currentPeriod(cls), periods.length));
  const [sid, setSid] = useState(cls.students[0]?.id);
  const [shift, setShift] = useState(0);
  const [drafts, setDrafts] = useState({}); // modifications en cours des formulations
  const [length, setLength] = useState('complete');
  const [showAll, setShowAll] = useState(false);
  const [edOpen, setEdOpen] = useState(false);
  const st = cls.students.find((s) => s.id === sid) || cls.students[0];
  const store = cls.apprec?.[period] || {};
  const entry = (st && store[st.id]) || {};
  const avg = st ? studentAverage(cls, st.id, period) : null;
  const sugg = st ? suggestProgress(cls, st.id, period) : null;
  const lv = { travail: null, attitude: null, oral: null, prog: sugg ? sugg.level : null, ...(entry.lv || {}) };
  const withResults = entry.results ?? avg != null;
  const complete = CRITERIA.every((c) => lv[c.id] != null);
  const periodWord = cls.periodMode === 'semestre' ? 'semestre' : 'trimestre';
  const remarks = entry.remarks || [];
  const variants = useMemo(() => (st && complete && st.g ? composeAll(st, lv, { results: withResults ? resultLevel(avg) : null, length, periodWord, shift, remarks }) : []), [st?.id, st?.g, JSON.stringify(lv), withResults, length, shift, avg, remarks.join()]);
  useEffect(() => { setDrafts({}); }, [st?.id, JSON.stringify(lv), length, shift, withResults, remarks.join()]);
  const toggleRemark = (id) => save({ remarks: remarks.includes(id) ? remarks.filter((x) => x !== id) : [...remarks, id] });

  const save = (patch) => updateClass(cls.id, (c) => {
    c.apprec = c.apprec || {};
    c.apprec[period] = c.apprec[period] || {};
    c.apprec[period][st.id] = { ...(c.apprec[period][st.id] || {}), ...patch };
  });
  const setLv = (id, v) => save({ lv: { ...lv, [id]: v } });
  const setG = (g) => updateClass(cls.id, (c) => { const s = c.students.find((x) => x.id === st.id); if (s) s.g = g; });
  const idx = cls.students.findIndex((s) => s.id === st?.id);
  const next = () => { const n = cls.students[idx + 1]; if (n) { setSid(n.id); setShift(0); document.querySelector('.ap-main')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); } };
  const copy = async (text) => {
    const ok = await copyText(text);
    save({ text });
    toast(ok ? `Appréciation de ${st.first} copiée : collez-la dans École Directe (Ctrl + V).` : 'Copie impossible : sélectionnez le texte puis Ctrl + C.', { icon: ok ? 'copy' : 'info' });
  };
  const done = cls.students.filter((s) => store[s.id]?.text).length;

  if (!cls.students.length) return html`<div class="empty"><h3>Ajoutez d’abord vos élèves</h3><p>Les appréciations se rédigent élève par élève.</p><a class="btn btn-primary" href=${`#/classes/${cls.id}`}>Ajouter des élèves</a></div>`;

  return html`<div class="ap-layout">
    <aside class="ap-list card" aria-label="Élèves">
      <div class="ap-list-head">
        <div class="seg seg-wrap" role="tablist" aria-label="Période">${periods.map((p) => html`<button role="tab" aria-selected=${p.n === period} onClick=${() => setPeriod(p.n)}>${p.short}</button>`)}</div>
        <span class="hint tnum">${done} / ${cls.students.length} rédigées</span>
      </div>
      <div class="ap-progress" aria-hidden="true"><i style=${`width:${(done / cls.students.length) * 100}%`}></i></div>
      <button class="btn btn-primary ap-ed-btn" onClick=${() => setEdOpen(true)} disabled=${!done}><${Icon} name="upload"/>Envoyer vers École Directe</button>
      <ul>${cls.students.map((s) => { const a = studentAverage(cls, s.id, period); const ok = !!store[s.id]?.text; return html`<li><button class=${`ap-st ${s.id === st.id ? 'on' : ''}`} onClick=${() => { setSid(s.id); setShift(0); }} aria-current=${s.id === st.id ? 'true' : undefined}>
        <span class=${`ap-dot ${ok ? 'ok' : ''}`} aria-label=${ok ? 'Appréciation rédigée' : 'À rédiger'}>${ok ? '✓' : ''}</span>
        <span class="ap-name">${fullName(s)}</span><span class="ap-avg tnum">${a == null ? '—' : fmt1(a)}</span></button></li>`; })}</ul>
    </aside>

    <section class="ap-main" aria-label=${'Appréciation de ' + fullName(st)}>
      <div class="ap-head card">
        <div style="flex:1;min-width:200px"><p class="eyebrow">${periods.find((p) => p.n === period).label}</p><h2>${fullName(st)}</h2>
          <p class="hint">${avg == null ? 'Pas encore de note sur cette période.' : html`Moyenne : <b class="tnum">${fmt1(avg)}</b>${sugg ? html` · ${sugg.delta >= 0 ? '+' : '−'}${fmt1(Math.abs(sugg.delta))} depuis le ${sugg.from}` : ''}`}</p></div>
        <div class="field"><span class="label">Accord</span><div class="seg" role="group" aria-label="Accord"><button aria-pressed=${st.g === 'f'} onClick=${() => setG('f')}>Elle</button><button aria-pressed=${st.g === 'm'} onClick=${() => setG('m')}>Il</button></div></div>
        <button class="btn btn-primary btn-lg" onClick=${next} disabled=${idx >= cls.students.length - 1}>Élève suivant<${Icon} name="arrow-right"/></button>
      </div>

      <div class="ap-crit card">
        ${CRITERIA.map((c) => html`<div class="crit-row"><span class="crit-label">${c.label}${c.id === 'prog' && sugg && lv.prog === sugg.level && entry.lv?.prog == null ? html`<small>proposé d’après les notes</small>` : ''}</span>
          <div class="crit-levels" role="radiogroup" aria-label=${c.label}>${c.levels.map((l, k) => html`<button role="radio" aria-checked=${lv[c.id] === k} class=${`lvl l${k}`} onClick=${() => setLv(c.id, k)}>${l}</button>`)}</div></div>`)}
        <div class="row ap-opts" style="--gap:16px">
          <label class="switch"><input type="checkbox" checked=${withResults} disabled=${avg == null} onChange=${(e) => save({ results: e.target.checked })}/>Parler des résultats</label>
          <div class="seg" role="group" aria-label="Longueur"><button aria-pressed=${length === 'courte'} onClick=${() => setLength('courte')}>Courte</button><button aria-pressed=${length === 'complete'} onClick=${() => setLength('complete')}>Complète</button></div>
        </div>
      </div>

      <div class="ap-remarks card">
        <div><b>Ajouter une remarque</b> <span class="muted">(facultatif)</span><p class="hint">Un clic ajoute une phrase et adapte le ton de la conclusion. Vous pouvez aussi modifier directement le texte des propositions.</p></div>
        <div class="rem-chips" role="group" aria-label="Remarques rapides">${REMARKS.map((r) => html`<button type="button" class=${`rem-chip ${r.tone > 0 ? 'pos' : r.tone < 0 ? 'neg' : ''}`} aria-pressed=${remarks.includes(r.id)} onClick=${() => toggleRemark(r.id)}>${remarks.includes(r.id) ? '✓ ' : '+ '}${r.label}</button>`)}</div>
      </div>

      ${!st.g ? html`<div class="notice"><${Icon} name="info"/><div>Choisissez <b>Elle</b> ou <b>Il</b> ci-dessus pour que les accords soient justes.</div></div>`
      : !complete ? html`<div class="ap-wait"><${Icon} name="message-square-text"/><p>Choisissez un niveau pour chacun des 4 thèmes : les appréciations s’écrivent aussitôt.</p></div>`
      : html`<div class="ap-variants">
        ${variants.map((v, i) => { const t = drafts[i] ?? v; const kept = entry.text === t; return html`<div class=${`ap-variant card ${kept ? 'kept' : ''}`}>
          <div class="row"><b>Proposition ${i + 1}</b>${kept && html`<span class="badge" style="background:var(--vert-soft);color:var(--vert)">✓ Retenue</span>`}<span class="spacer"></span><span class=${`hint tnum ${t.length > ED_LIMIT ? 'too-long' : ''}`}>${t.length} / ${ED_LIMIT}${t.length > ED_LIMIT ? ' — trop long pour École Directe' : ''}</span></div>
          <label class="sr-only" for=${'apv' + i}>Proposition ${i + 1}</label>
          <textarea id=${'apv' + i} class="textarea ap-text" rows="3" value=${t} onInput=${(e) => setDrafts({ ...drafts, [i]: e.target.value })}></textarea>
          <button class="btn btn-primary" onClick=${() => copy(t)}><${Icon} name="copy"/>Copier</button>
        </div>`; })}
        <button class="btn btn-ghost" onClick=${() => setShift(shift + 1)}><${Icon} name="shuffle"/>Autres formulations</button>
      </div>`}

      <${EdDialog} open=${edOpen} onClose=${() => setEdOpen(false)} cls=${cls} store=${store} done=${done} periodLabel=${periods.find((p) => p.n === period).label}/>
      <details class="ap-all card" open=${showAll} onToggle=${(e) => setShowAll(e.target.open)}>
        <summary>Toutes les appréciations retenues (${done})</summary>
        ${done === 0 ? html`<p class="hint" style="padding:10px 0">Copiez une proposition : elle est retenue et apparaît ici.</p>` : html`<ul class="ap-done">${cls.students.filter((s) => store[s.id]?.text).map((s) => html`<li><b>${fullName(s)}</b><p>${store[s.id].text}</p><button class="btn btn-sm" onClick=${async () => { await copyText(store[s.id].text); toast('Copiée.', { icon: 'copy' }); }}><${Icon} name="copy"/>Copier</button></li>`)}</ul>`}
      </details>
    </section>
  </div>`;
}

// ---------- Envoyer vers École Directe (favori magique) ----------
function EdDialog({ open, onClose, cls, store, done, periodLabel }) {
  const texts = Object.fromEntries(Object.entries(store).filter(([, e]) => e.text).map(([id, e]) => [id, e.text]));
  const tooLong = Object.values(texts).filter((t) => t.length > ED_LIMIT).length;
  const copy = async () => {
    const ok = await copyText(payloadFor(cls.students, texts));
    toast(ok ? `${plural(done, 'appréciation copiée', 'appréciations copiées')}. Passez à l’étape 3 dans École Directe.` : 'Copie impossible : réessayez.', { icon: ok ? 'copy' : 'info' });
  };
  return html`<${Dialog} open=${open} onClose=${onClose} wide title="Envoyer vers École Directe" desc=${`Remplir d’un coup ${done > 1 ? `les ${done} appréciations` : 'l’appréciation'} de la ${cls.name} (${periodLabel}).`}>
    <div class="dlg-body">
      <ol class="big-steps">
        <li><span class="bs-n">1</span><div class="stack" style="--gap:8px">
          <b>Une seule fois : installez le bouton dans vos favoris</b>
          <span>Avec la souris, <b>faites glisser</b> ce bouton jusque dans la barre de favoris de votre navigateur (sous la barre d’adresse) :</span>
          <a class="bm-link" href=${BOOKMARKLET} onClick=${(e) => { e.preventDefault(); toast('Ne cliquez pas : faites-le glisser dans la barre de favoris.', { icon: 'info' }); }} draggable="true">★ Remplir École Directe</a>
          <span class="hint">Vous ne voyez pas la barre de favoris ? Appuyez sur <span class="kbd">Ctrl</span> + <span class="kbd">Maj</span> + <span class="kbd">B</span> (sur Mac <span class="kbd">⌘</span> + <span class="kbd">Maj</span> + <span class="kbd">B</span>).</span></div></li>
        <li><span class="bs-n">2</span><div class="stack" style="--gap:8px">
          <b>Copiez les appréciations</b>
          <button class="btn btn-primary btn-lg" style="justify-self:start" onClick=${copy}><${Icon} name="copy"/>${done > 1 ? `Copier les ${done} appréciations` : 'Copier l’appréciation'}</button>
          ${tooLong > 0 && html`<span class="too-long">${plural(tooLong, 'appréciation dépasse', 'appréciations dépassent')} 500 caractères : raccourcissez-les avant.</span>`}</div></li>
        <li><span class="bs-n">3</span><div class="stack" style="--gap:6px">
          <b>Dans École Directe</b>
          <span>Ouvrez la page de <b>saisie des appréciations</b> de la ${cls.name}, puis cliquez sur le favori <b>★ Remplir École Directe</b>. Toutes les cases se remplissent, surlignées en jaune.</span>
          <span>Relisez, puis cliquez sur <b>Enregistrer</b> dans École Directe.</span>
          <span class="hint">Le navigateur peut demander l’autorisation de lire le presse-papiers : acceptez. Sinon, une petite fenêtre vous demandera de coller (Ctrl + V).</span></div></li>
      </ol>
      <div class="notice" style="margin-top:16px"><${Icon} name="shield-check"/><div>Le favori agit uniquement dans la page d’École Directe ouverte sur votre ordinateur, avec votre propre connexion. Il n’envoie rien et n’enregistre rien à votre place.</div></div>
    </div>
  </${Dialog}>`;
}
