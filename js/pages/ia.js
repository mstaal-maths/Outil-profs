// « Demander à une IA » : des demandes générales. Le professeur joint son fichier dans l'IA,
// colle la demande, et l'IA prépare le support.
import { html, useState, useMemo } from '../vendor/preact.js';
import { Icon, Dialog, toast, useTitle } from '../ui/core.js';
import { PROMPTS, CATEGORIES, fullPrompt, AI_SITES } from '../lib/prompts.js';
import { fuzzyScore } from '../lib/util.js';

const LS = 'trousse.ia.site';
const lastSite = () => { try { return localStorage.getItem(LS) || 'lechat'; } catch { return 'lechat'; } };

async function copyText(t) {
  try { await navigator.clipboard.writeText(t); return true; }
  catch { const ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select(); let ok = false; try { ok = document.execCommand('copy'); } catch {} ta.remove(); return ok; }
}

export function IaPage() {
  useTitle('Demander à une IA');
  const [cat, setCat] = useState(CATEGORIES[0].id);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(null);
  const list = useMemo(() => {
    if (q.trim()) return PROMPTS.map((p) => ({ p, s: Math.max(fuzzyScore(q, p.title), fuzzyScore(q, p.desc) * 0.8) })).filter((x) => x.s > 25).sort((a, b) => b.s - a.s).map((x) => x.p);
    return PROMPTS.filter((p) => p.cat === cat);
  }, [cat, q]);
  return html`<main id="main" class="page route-enter" tabindex="-1">
    <div class="ia-head">
      <div><h1>Demander à une IA</h1><p class="sub">Joignez votre cours ou votre sujet à une IA gratuite : ces demandes lui disent quoi en faire.</p></div>
      <div class="dash-search ia-search"><${Icon} name="search"/><label class="sr-only" for="iaq">Rechercher une demande</label><input id="iaq" class="input" type="search" placeholder="Rechercher : évaluation, DYS…" value=${q} onInput=${(e) => setQ(e.target.value)}/></div>
    </div>
    ${!q.trim() && html`<div class="ia-cats" role="tablist" aria-label="Rubriques">${CATEGORIES.map((c) => html`<button role="tab" aria-selected=${cat === c.id} onClick=${() => setCat(c.id)}><${Icon} name=${c.icon}/>${c.label}</button>`)}</div>`}
    ${list.length === 0 ? html`<div class="empty"><h3>Aucune demande trouvée</h3><p>Essayez un autre mot.</p></div>`
    : html`<div class="ia-grid">${list.map((p) => html`<button class="ia-card" onClick=${() => setOpen(p)}><b>${p.title}</b><span>${p.desc}</span><span class="ia-go">Utiliser<${Icon} name="arrow-right"/></span></button>`)}</div>`}
    <div class="notice" style="margin-top:24px"><${Icon} name="shield-check"/><div><strong>Avant de joindre un fichier, vérifiez qu’il ne contient aucun nom d’élève</strong> ni information personnelle. Et relisez toujours ce que l’IA produit : elle peut se tromper.</div></div>
    <${PromptDialog} p=${open} onClose=${() => setOpen(null)}/>
  </main>`;
}

function PromptDialog({ p, onClose }) {
  const [site, setSite] = useState(lastSite());
  const [done, setDone] = useState(false);
  if (!p) return html`<${Dialog} open=${false}/>`;
  const text = fullPrompt(p);
  const go = async (s) => {
    try { localStorage.setItem(LS, s.id); } catch {}
    setSite(s.id);
    const ok = await copyText(text);
    window.open(s.url, '_blank', 'noopener');
    setDone(true);
    toast(ok ? `Demande copiée. Dans ${s.name} : joignez votre fichier, collez (Ctrl + V), envoyez.` : 'Copie impossible : utilisez le bouton « Copier ».', { icon: 'sparkles', duration: 7000 });
  };
  const sites = [...AI_SITES].sort((a, b) => (a.id === site ? -1 : b.id === site ? 1 : 0));
  return html`<${Dialog} open=${!!p} onClose=${() => { setDone(false); onClose(); }} wide title=${p.title} desc=${p.desc}>
    <div class="dlg-body stack" style="--gap:18px">
      <ol class="ia-steps">
        <li class=${done ? 'ok' : ''}><b>1</b><div><strong>Cliquez sur une IA</strong> ci-dessous : la demande est copiée et l’IA s’ouvre dans un nouvel onglet.</div></li>
        <li><b>2</b><div><strong>Joignez votre fichier</strong> (cours, sujet, texte…) avec le bouton <span class="kbd">+</span> ou le trombone de l’IA.</div></li>
        <li><b>3</b><div><strong>Collez la demande</strong> avec <span class="kbd">Ctrl</span> + <span class="kbd">V</span> (sur Mac <span class="kbd">⌘</span> + <span class="kbd">V</span>), puis envoyez.</div></li>
      </ol>
      <div class="ia-sites">${sites.map((s, i) => html`<button class=${`btn btn-lg ${i === 0 ? 'btn-primary' : ''}`} onClick=${() => go(s)}><${Icon} name="sparkles"/>${s.name}<small>${s.sub}</small></button>`)}</div>
      <details class="ia-preview"><summary>Voir la demande</summary><p>${text}</p>
        <button class="btn btn-sm" onClick=${async () => toast((await copyText(text)) ? 'Demande copiée.' : 'Copie impossible.', { icon: 'copy' })}><${Icon} name="copy"/>Copier seulement</button></details>
    </div>
  </${Dialog}>`;
}
