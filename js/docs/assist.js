// Fenêtres d'aide à la création : « Demander à une IA » et « Générer les questions ».
import { html, useState, useMemo, useEffect } from '../vendor/preact.js';
import { Icon, Dialog, toast, useStore } from '../ui/core.js';
import { plural } from '../lib/util.js';
import { AI_KINDS, AI_SITES, LEVELS, cleanAiText, MATH, mathQuestions, questionsFromPairs } from './generate.js';
import { parsePairs } from './generators.js';

const LS = 'trousse.ai.prefs';
const loadPrefs = () => { try { return JSON.parse(localStorage.getItem(LS)) || {}; } catch { return {}; } };
const savePrefs = (p) => { try { localStorage.setItem(LS, JSON.stringify(p)); } catch {} };

/** Panneau « Demander à une IA » : 1. on décrit, 2. on ouvre l'IA, 3. on recolle la réponse. */
export function AiPanel({ kind, onResult, count }) {
  const k = AI_KINDS[kind];
  const prefs = loadPrefs();
  const [theme, setTheme] = useState('');
  const [level, setLevel] = useState(prefs.level || '5e');
  const [n, setN] = useState(kind === 'qcm' ? 10 : kind === 'trous' ? 8 : 12);
  const [types, setTypes] = useState('qcm');
  const [extra, setExtra] = useState('');
  const [answer, setAnswer] = useState('');
  const [opened, setOpened] = useState(false);
  const prompt = k.prompt({ theme: theme.trim() || '…', level, n, types, extra: extra.trim() });
  const ready = theme.trim().length > 1;
  const result = cleanAiText(answer);
  const nFound = result ? count(result) : 0;

  const open = async (site) => {
    savePrefs({ ...prefs, level, site: site.id });
    try { await navigator.clipboard.writeText(prompt); } catch {}
    window.open(site.url(prompt), '_blank', 'noopener');
    setOpened(true);
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(prompt); toast('Demande copiée : collez-la dans l’IA de votre choix.', { icon: 'copy' }); }
    catch { toast('Copie impossible : sélectionnez le texte de la demande ci-dessous.', { icon: 'info' }); }
    setOpened(true);
  };
  const sites = [...AI_SITES].sort((a, b) => (a.id === prefs.site ? -1 : b.id === prefs.site ? 1 : 0));

  return html`<div class="ai-panel">
    <ol class="big-steps">
      <li><span class="bs-n">1</span><div class="stack" style="--gap:12px">
        <b>Décrivez ce que vous voulez</b>
        <div class="field"><label for="ai-theme">Thème ou chapitre</label>
          <input id="ai-theme" class="input" value=${theme} onInput=${(e) => setTheme(e.target.value)} placeholder="Ex. La Révolution française, les fractions, le corps humain…" autofocus/></div>
        <div class="row" style="--gap:12px;align-items:flex-end">
          <div class="field" style="flex:1;min-width:120px"><label for="ai-level">Niveau</label><select id="ai-level" class="select" value=${level} onChange=${(e) => setLevel(e.target.value)}>${LEVELS.map((l) => html`<option>${l}</option>`)}</select></div>
          <div class="field" style="width:130px"><label for="ai-n">${kind === 'qcm' || kind === 'jeux' ? 'Questions' : kind === 'trous' ? 'Trous' : 'Nombre'}</label><input id="ai-n" class="input" type="number" min="3" max="40" value=${n} onInput=${(e) => setN(Math.max(1, Math.min(40, Number(e.target.value) || 1)))}/></div>
        </div>
        ${kind === 'qcm' && html`<div class="seg seg-wrap" role="group" aria-label="Type de questions">${[['qcm', 'Choix multiples'], ['vf', 'Vrai / faux'], ['mix', 'Un peu de tout']].map(([v, l]) => html`<button type="button" aria-pressed=${types === v} onClick=${() => setTypes(v)}>${l}</button>`)}</div>`}
        <div class="field"><label for="ai-extra">Précisions <span class="muted">(facultatif)</span></label><input id="ai-extra" class="input" value=${extra} onInput=${(e) => setExtra(e.target.value)} placeholder="Ex. niveau facile, questions sur les dates, élèves allophones…"/></div>
      </div></li>
      <li><span class="bs-n">2</span><div class="stack" style="--gap:10px">
        <b>Ouvrez une IA gratuite</b><span class="hint">La demande est déjà écrite pour vous : il suffit de l’envoyer. Vous pouvez utiliser votre compte gratuit.</span>
        <div class="ai-sites">${sites.map((s, i) => html`<button class=${`btn ${i === 0 ? 'btn-primary' : ''}`} onClick=${() => open(s)} disabled=${!ready}><${Icon} name="sparkles"/>${s.name}</button>`)}</div>
        <button class="btn btn-ghost btn-sm" style="justify-self:start" onClick=${copy} disabled=${!ready}><${Icon} name="copy"/>Copier la demande (pour une autre IA)</button>
        ${!ready && html`<span class="hint">Indiquez d’abord un thème.</span>`}
        <details class="ai-prompt"><summary>Voir la demande envoyée</summary><pre>${prompt}</pre></details>
      </div></li>
      <li><span class="bs-n">3</span><div class="stack" style="--gap:10px">
        <b>Copiez la réponse de l’IA et collez-la ici</b>
        <label class="sr-only" for="ai-answer">Réponse de l’IA</label>
        <textarea id="ai-answer" class=${`textarea ${opened && !answer ? 'pulse-hint' : ''}`} rows="6" value=${answer} onInput=${(e) => setAnswer(e.target.value)} placeholder="Collez ici la réponse (Ctrl + V)…"></textarea>
        ${answer && html`<p class=${nFound ? 'ok-text' : 'error-text'}>${nFound ? `✓ ${plural(nFound, 'élément reconnu', 'éléments reconnus')}` : 'Je ne reconnais pas le format. Recopiez toute la réponse de l’IA.'}</p>`}
        <p class="hint">L’IA peut se tromper : relisez avant d’imprimer.</p>
      </div></li>
    </ol>
    <div class="ai-foot"><button class="btn btn-primary btn-lg" disabled=${!nFound} onClick=${() => onResult(result)}><${Icon} name="check"/>Ajouter au document</button></div>
  </div>`;
}

/** Fenêtre « Demander à une IA » pour mots croisés, flashcards, lexique, jeux. */
export function AiDialog({ open, onClose, kind, count, onResult }) {
  return html`<${Dialog} open=${open} onClose=${onClose} wide title="Remplir avec une IA" desc=${`Une IA gratuite écrit ${AI_KINDS[kind]?.label || 'le contenu'} pour vous. Aucune donnée d’élève n’est envoyée.`}>
    <div class="dlg-body">${open && html`<${AiPanel} kind=${kind} count=${count} onResult=${(t) => { onResult(t); onClose(); toast('Contenu ajouté. Relisez-le, puis téléchargez votre document.', { icon: 'sparkles' }); }}/>`}</div>
  </${Dialog}>`;
}

/** Fenêtre « Générer les questions » du QCM : IA, liste de mots, ou calcul. */
export function QuizGenerator({ open, onClose, onAdd, parseQuiz }) {
  const s = useStore();
  const [tab, setTab] = useState('ai');
  const [pairsText, setPairsText] = useState('');
  const [style, setStyle] = useState('mix');
  const [n, setN] = useState(10);
  const [kinds, setKinds] = useState(['tables']);
  useEffect(() => { if (open) setPairsText(''); }, [open]);
  // Documents existants qui contiennent une liste réutilisable.
  const sources = Object.values(s.docs || {}).map((d) => {
    const t = d.data || {};
    const text = d.tool === 'lexique' ? t.rows : d.tool === 'flashcards' || d.tool === 'jeux' ? t.pairs : d.tool === 'mots' && t.mode === 'croises' ? t.pairs : '';
    return text && text.trim() ? { id: d.id, name: d.name, text } : null;
  }).filter(Boolean);
  const pairs = useMemo(() => parsePairs(pairsText).map((p) => ({ a: p.a, b: p.b.split(/\s:\s|:(?!\d)/)[0].trim() })), [pairsText]);
  const add = (qs, label) => { if (!qs.length) return; onAdd(qs); onClose(); toast(`${plural(qs.length, 'question ajoutée', 'questions ajoutées')}${label ? ' ' + label : ''}. Relisez-les avant d’imprimer.`, { icon: 'sparkles' }); };

  return html`<${Dialog} open=${open} onClose=${onClose} wide title="Générer les questions" desc="Trois façons de créer un QCM en une minute. Vous pourrez tout modifier ensuite.">
    <div class="dlg-body stack" style="--gap:18px">
      <div class="gen-tabs" role="tablist" aria-label="Méthode">
        ${[['ai', 'sparkles', 'Avec une IA', 'Sur n’importe quel thème'], ['list', 'list', 'Depuis une liste de mots', 'Vocabulaire, définitions…'], ['math', 'grid-3x3', 'Calcul', 'Tables, fractions, %…']].map(([id, ic, l, d]) => html`<button role="tab" aria-selected=${tab === id} class="gen-tab" onClick=${() => setTab(id)}><${Icon} name=${ic}/><span><b>${l}</b><small>${d}</small></span></button>`)}
      </div>
      ${tab === 'ai' && html`<${AiPanel} kind="qcm" count=${(t) => parseQuiz(t).length} onResult=${(t) => add(parseQuiz(t), 'par l’IA')}/>`}
      ${tab === 'list' && html`<div class="stack" style="--gap:14px">
        ${sources.length > 0 && html`<div class="field"><label for="gen-src">Reprendre un de mes documents</label><select id="gen-src" class="select" onChange=${(e) => { const src = sources.find((x) => x.id === e.target.value); if (src) setPairsText(src.text); }}><option value="">— Choisir un lexique, des flashcards… —</option>${sources.map((x) => html`<option value=${x.id}>${x.name}</option>`)}</select></div>`}
        <div class="field"><label for="gen-pairs">${sources.length ? 'Ou collez une liste' : 'Collez une liste'} « mot : définition »</label>
          <textarea id="gen-pairs" class="textarea" rows="8" value=${pairsText} onInput=${(e) => setPairsText(e.target.value)} placeholder=${'Un mot par ligne :\nLittoral : Espace où la terre rencontre la mer\nRelief : Formes de la surface de la Terre'}></textarea>
          <span class="hint">${plural(pairs.filter((p) => p.a && p.b).length, 'mot reconnu', 'mots reconnus')} (il en faut au moins 4).</span></div>
        <div class="seg seg-wrap" role="group" aria-label="Type de questions">${[['mix', 'Un peu de tout'], ['def', '« Que signifie… ? »'], ['mot', '« Quel mot… ? »'], ['vf', 'Vrai / faux']].map(([v, l]) => html`<button type="button" aria-pressed=${style === v} onClick=${() => setStyle(v)}>${l}</button>`)}</div>
        <div class="ai-foot"><button class="btn btn-primary btn-lg" disabled=${pairs.filter((p) => p.a && p.b).length < 4} onClick=${() => add(questionsFromPairs(pairs, Math.min(n, pairs.length), style), 'depuis votre liste')}><${Icon} name="wand-sparkles"/>Créer ${plural(Math.min(n, pairs.filter((p) => p.a && p.b).length), 'question', 'questions')}</button></div>
      </div>`}
      ${tab === 'math' && html`<div class="stack" style="--gap:14px">
        <span class="label">Types de calcul</span>
        <div class="math-kinds">${Object.entries(MATH).map(([id, m]) => html`<label class="check-row math-kind"><input type="checkbox" checked=${kinds.includes(id)} onChange=${(e) => setKinds(e.target.checked ? [...kinds, id] : kinds.filter((x) => x !== id))}/><span>${m.label}</span></label>`)}</div>
        <div class="field" style="width:160px"><label for="gen-n">Nombre de questions</label><input id="gen-n" class="input" type="number" min="1" max="40" value=${n} onInput=${(e) => setN(Math.max(1, Math.min(40, Number(e.target.value) || 1)))}/></div>
        <p class="hint">Les mauvaises réponses reprennent les erreurs les plus fréquentes des élèves. Chaque clic crée de nouveaux calculs.</p>
        <div class="ai-foot"><button class="btn btn-primary btn-lg" disabled=${!kinds.length} onClick=${() => add(mathQuestions(kinds, n), '')}><${Icon} name="wand-sparkles"/>Créer ${plural(n, 'question', 'questions')}</button></div>
      </div>`}
    </div>
  </${Dialog}>`;
}
