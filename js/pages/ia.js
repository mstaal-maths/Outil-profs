// « Demander à une IA » : une banque de demandes prêtes à l'emploi pour créer des supports.
import { html, useState, useMemo, useEffect } from '../vendor/preact.js';
import { Icon, Dialog, toast, useTitle } from '../ui/core.js';
import { PROMPTS, CATEGORIES, LEVELS, fillPrompt, AI_SITES } from '../lib/prompts.js';
import { fuzzyScore } from '../lib/util.js';

const LS = 'trousse.ia';
const load = () => { try { return JSON.parse(localStorage.getItem(LS)) || {}; } catch { return {}; } };
const store = (v) => { try { localStorage.setItem(LS, JSON.stringify(v)); } catch {} };

async function copyText(t) {
  try { await navigator.clipboard.writeText(t); return true; }
  catch { const ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select(); let ok = false; try { ok = document.execCommand('copy'); } catch {} ta.remove(); return ok; }
}

export function IaPage() {
  useTitle('Demander à une IA');
  const [cat, setCat] = useState('all');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(null);
  const list = useMemo(() => {
    let l = PROMPTS.filter((p) => cat === 'all' || p.cat === cat);
    if (q.trim()) l = l.map((p) => ({ p, s: Math.max(fuzzyScore(q, p.title), fuzzyScore(q, p.desc) * 0.8) })).filter((x) => x.s > 25).sort((a, b) => b.s - a.s).map((x) => x.p);
    return l;
  }, [cat, q]);
  return html`<main id="main" class="page route-enter" tabindex="-1">
    <div class="page-head"><div><h1>Demander à une IA</h1><p class="sub">Des demandes toutes prêtes pour faire préparer vos supports par une IA gratuite.</p></div></div>
    <ol class="ia-how">
      <li><b>1</b><span><strong>Choisissez</strong> ce que vous voulez créer.</span></li>
      <li><b>2</b><span><strong>Remplissez</strong> 2 ou 3 cases : matière, niveau, thème.</span></li>
      <li><b>3</b><span><strong>Cliquez</strong> sur une IA : la demande s’envoie toute seule.</span></li>
    </ol>
    <div class="ia-bar">
      <div class="dash-search"><${Icon} name="search"/><label class="sr-only" for="iaq">Rechercher une demande</label><input id="iaq" class="input" type="search" placeholder="Rechercher : évaluation, DYS, leçon…" value=${q} onInput=${(e) => setQ(e.target.value)}/></div>
      <div class="ia-cats" role="tablist" aria-label="Catégories">
        <button role="tab" aria-selected=${cat === 'all'} onClick=${() => setCat('all')}>Tout</button>
        ${CATEGORIES.map((c) => html`<button role="tab" aria-selected=${cat === c.id} onClick=${() => setCat(c.id)}><${Icon} name=${c.icon}/>${c.label}</button>`)}
      </div>
    </div>
    ${list.length === 0 ? html`<div class="empty"><h3>Aucune demande trouvée</h3><p>Essayez un autre mot, ou choisissez « Tout ».</p></div>`
    : CATEGORIES.filter((c) => list.some((p) => p.cat === c.id)).map((c) => html`<section class="ia-sec"><h2 class="sec-title"><${Icon} name=${c.icon} size=${15}/>${c.label}</h2>
      <div class="ia-grid">${list.filter((p) => p.cat === c.id).map((p) => html`<button class="ia-card" onClick=${() => setOpen(p)}><b>${p.title}</b><span>${p.desc}</span><span class="ia-go">Préparer<${Icon} name="arrow-right"/></span></button>`)}</div></section>`)}
    <div class="notice" style="margin-top:28px"><${Icon} name="shield-check"/><div><strong>Ne mettez jamais le nom d’un élève</strong> ni aucune information personnelle dans une IA. Et relisez toujours ce qu’elle produit : elle peut se tromper.</div></div>
    <${PromptDialog} p=${open} onClose=${() => setOpen(null)}/>
  </main>`;
}

function PromptDialog({ p, onClose }) {
  const [vals, setVals] = useState({});
  const [edited, setEdited] = useState(null);
  useEffect(() => {
    if (!p) return;
    const saved = load();
    const v = {};
    for (const f of p.fields) v[f.id] = f.remember ? saved[f.id] ?? (f.type === 'level' ? '5e' : '') : f.def ?? '';
    setVals(v); setEdited(null);
  }, [p]);
  if (!p) return html`<${Dialog} open=${false}/>`;
  const text = edited ?? fillPrompt(p, vals);
  const missing = p.fields.filter((f) => !f.optional && !String(vals[f.id] ?? '').trim());
  const set = (id, v) => { setVals({ ...vals, [id]: v }); setEdited(null); };
  const remember = () => { const s = load(); for (const f of p.fields) if (f.remember) s[f.id] = vals[f.id]; store(s); };
  const send = async (site) => {
    remember();
    const ok = await copyText(text);
    const url = site.url(text);
    // Une adresse trop longue est refusée par certains sites : on ouvre alors le site vide, la demande est dans le presse-papiers.
    window.open(url.length < 7000 ? url : site.url('').replace(/[?&]q=$/, ''), '_blank', 'noopener');
    toast(ok ? 'Demande copiée. Si elle n’apparaît pas dans l’IA, collez-la (Ctrl + V).' : 'Si la demande n’apparaît pas, copiez-la depuis Trousse.', { icon: 'sparkles', duration: 6000 });
  };
  const copy = async () => { remember(); toast((await copyText(text)) ? 'Demande copiée : collez-la dans l’IA de votre choix (Ctrl + V).' : 'Copie impossible : sélectionnez le texte.', { icon: 'copy' }); };

  return html`<${Dialog} open=${!!p} onClose=${onClose} wide title=${p.title} desc=${p.desc}>
    <div class="dlg-body stack" style="--gap:16px">
      <div class="ia-fields">${p.fields.map((f) => html`<div class=${`field ${f.type === 'textarea' ? 'wide' : ''}`}><label for=${'ia-' + f.id}>${f.label}</label>
        ${f.type === 'level' ? html`<select id=${'ia-' + f.id} class="select" value=${vals[f.id]} onChange=${(e) => set(f.id, e.target.value)}>${LEVELS.map((l) => html`<option>${l}</option>`)}</select>`
        : f.type === 'textarea' ? html`<textarea id=${'ia-' + f.id} class="textarea" rows="6" value=${vals[f.id]} onInput=${(e) => set(f.id, e.target.value)} placeholder=${f.placeholder}></textarea>`
        : html`<input id=${'ia-' + f.id} class="input" type=${f.type === 'number' ? 'number' : 'text'} min="1" max="60" value=${vals[f.id]} onInput=${(e) => set(f.id, e.target.value)} placeholder=${f.placeholder}/>`}</div>`)}</div>
      <details class="ia-preview"><summary>Voir ou modifier la demande envoyée</summary>
        <label class="sr-only" for="ia-text">Demande</label>
        <textarea id="ia-text" class="textarea" rows="10" value=${text} onInput=${(e) => setEdited(e.target.value)}></textarea></details>
      ${missing.length > 0 && html`<p class="hint">À remplir : ${missing.map((f) => f.label.toLowerCase()).join(', ')}.</p>`}
    </div>
    <div class="dlg-foot ia-foot">
      <span class="ia-foot-label">Envoyer à :</span>
      ${AI_SITES.map((s, i) => html`<button class=${`btn btn-lg ${i === 0 ? 'btn-primary' : ''}`} onClick=${() => send(s)} disabled=${missing.length > 0}><${Icon} name="sparkles"/>${s.name}<small>${s.sub}</small></button>`)}
      <button class="btn btn-ghost" onClick=${copy} disabled=${missing.length > 0}><${Icon} name="copy"/>Copier</button>
    </div>
  </${Dialog}>`;
}
