// Les cinq générateurs de documents : données, exemple, éditeur et construction (sujet + corrigé).
import { html, useState } from '../vendor/preact.js';
import { Icon, Dialog } from '../ui/core.js';
import { uid, plural } from '../lib/util.js';
import { seeded } from '../lib/util.js';
import { parsePairs, crossword, wordSearch, clozeRuns, gooseBoard, defaultSpecials, dominoSheets, chainCards, gridWord, sShuffle } from './generators.js';

const rint = () => Math.floor(Math.random() * 1e9);
const lines = (t) => (t || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

// ---------- Petits composants d'édition ----------
export function Field({ id, label, hint, children }) {
  return html`<div class="field"><label for=${id}>${label}</label>${children}${hint && html`<span class="hint">${hint}</span>`}</div>`;
}
export function TextIn({ id, label, value, onInput, placeholder, hint }) {
  return html`<${Field} id=${id} label=${label} hint=${hint}><input id=${id} class="input" value=${value} onInput=${(e) => onInput(e.target.value)} placeholder=${placeholder}/></${Field}>`;
}
export function Area({ id, label, value, onInput, placeholder, hint, rows = 8 }) {
  return html`<${Field} id=${id} label=${label} hint=${hint}><textarea id=${id} class="textarea" rows=${rows} style=${`min-height:${rows * 1.6}em`} value=${value} onInput=${(e) => onInput(e.target.value)} placeholder=${placeholder}></textarea></${Field}>`;
}
export function Seg({ label, value, options, onChange }) {
  return html`<div class="field"><span class="label">${label}</span><div class="seg seg-wrap" role="group" aria-label=${label}>${options.map(([v, l]) => html`<button type="button" aria-pressed=${value === v} onClick=${() => onChange(v)}>${l}</button>`)}</div></div>`;
}
export function Check({ label, checked, onChange }) {
  return html`<label class="switch"><input type="checkbox" checked=${checked} onChange=${(e) => onChange(e.target.checked)}/>${label}</label>`;
}

// ======================================================================
// 5. QCM & quiz
// ======================================================================
const newQ = (type = 'qcm') => ({ id: uid('q'), type, text: '', points: 1, lines: 3, answer: '',
  choices: type === 'vf' ? [{ text: 'Vrai', ok: true }, { text: 'Faux', ok: false }] : [{ text: '', ok: true }, { text: '', ok: false }, { text: '', ok: false }] });

/** Format rapide : une question par paragraphe, bonnes réponses précédées de *. */
export function parseQuiz(text) {
  return text.split(/\n\s*\n/).map((blk) => lines(blk)).filter((l) => l.length).map((l) => {
    const q = l[0].replace(/^\d+\s*[.)-]\s*/, '');
    const ch = l.slice(1).map((c) => ({ ok: /^\*/.test(c), text: c.replace(/^\*\s*/, '').replace(/^[-–•]\s*|^[a-h]\)\s*/i, '') }));
    if (!ch.length) return { ...newQ('court'), text: q };
    if (ch.length === 2 && ch.every((c) => /^(vrai|faux)$/i.test(c.text))) return { ...newQ('vf'), text: q, choices: ch };
    return { ...newQ('qcm'), text: q, choices: ch.some((c) => c.ok) ? ch : ch.map((c, i) => ({ ...c, ok: i === 0 })) };
  });
}

export const qcm = {
  id: 'qcm', name: 'QCM & quiz', icon: 'list-checks', desc: 'Questions à choix, vrai/faux ou rédigées. Plusieurs versions pour éviter la triche.', hasKey: true,
  defaults: () => ({ title: 'QCM', subtitle: '', fields: true, shuffleQ: false, shuffleA: false, versions: 1, showPoints: true, seed: rint(), questions: [newQ()] }),
  example: () => ({ ...qcm.defaults(), title: 'Le système solaire', subtitle: 'Sciences · 6e · 15 minutes', questions: parseQuiz(`Quelle est la planète la plus proche du Soleil ?
*Mercure
Vénus
Mars
La Terre

Combien de planètes compte le système solaire ?
7
*8
9
10

La Lune est une étoile.
Vrai
*Faux

Quelles planètes sont des géantes gazeuses ?
*Jupiter
*Saturne
Mars
Mercure

Explique pourquoi il fait jour d'un côté de la Terre et nuit de l'autre.`).map((q, i) => (i === 4 ? { ...q, points: 2, answer: 'La Terre tourne sur elle-même : la moitié éclairée par le Soleil est le jour, l’autre est la nuit.' } : q)) }),
  build(d) {
    const one = (v, key) => {
      const rnd = seeded(d.seed + v * 7919);
      let qs = d.questions.filter((q) => q.text.trim());
      if (d.shuffleQ || v > 0) qs = sShuffle(qs, rnd);
      const blocks = qs.map((q, i) => {
        const pts = d.showPoints ? ` (${String(q.points).replace('.', ',')} pt${q.points > 1 ? 's' : ''})` : '';
        const multi = q.type === 'qcm' && q.choices.filter((c) => c.ok).length > 1;
        const head = { t: 'p', runs: [{ text: `${i + 1}. `, b: true }, { text: q.text, b: true }, { text: pts }, ...(multi && !key ? [{ text: '  — plusieurs réponses possibles', i: true }] : [])] };
        let body;
        if (q.type === 'court') body = key ? [{ t: 'p', runs: [{ text: 'Réponse attendue : ', b: true }, { text: q.answer || '—', i: true }] }] : [{ t: 'lines', n: q.lines || 3 }];
        else {
          let ch = q.choices.filter((c) => c.text.trim());
          if ((d.shuffleA || v > 0) && q.type !== 'vf') ch = sShuffle(ch, rnd);
          const short = ch.every((c) => c.text.length <= 22);
          body = [{ t: 'choices', items: ch, cols: short && ch.length >= 3 ? Math.min(ch.length, 4) === 3 ? 3 : 2 : q.type === 'vf' ? 2 : 1, showAnswers: key }];
        }
        return { t: 'keep', items: [head, ...body] };
      });
      const total = qs.reduce((a, q) => a + Number(q.points || 0), 0);
      const vName = d.versions > 1 ? ` — Sujet ${String.fromCharCode(65 + v)}` : '';
      return { title: (d.title || 'QCM') + vName + (key ? ' — Corrigé' : ''), subtitle: [d.subtitle, d.showPoints ? `Total : ${String(total).replace('.', ',')} points` : ''].filter(Boolean).join(' · '), fields: d.fields && !key, blocks };
    };
    const merge = (key) => {
      const docs = Array.from({ length: Math.max(1, d.versions) }, (_, v) => one(v, key));
      if (docs.length === 1) return docs[0];
      return { title: '', blocks: docs.flatMap((x, i) => [...(i ? [{ t: 'break' }] : []), { t: 'p', runs: [{ text: x.title, b: true }] }, ...(x.subtitle ? [{ t: 'p', runs: [{ text: x.subtitle, i: true }] }] : []), ...(x.fields ? [{ t: 'p', runs: [{ text: 'Nom : ____________   Prénom : ____________   Classe : ______' }] }] : []), ...x.blocks]) };
    };
    return { sujet: merge(false), corrige: merge(true) };
  },
  Editor: QcmEditor,
};

function QcmEditor({ d, set }) {
  const [paste, setPaste] = useState(false);
  const [txt, setTxt] = useState('');
  const upQ = (i, patch) => set({ questions: d.questions.map((q, k) => (k === i ? { ...q, ...patch } : q)) });
  const move = (i, dir) => { const a = d.questions.slice(); const j = i + dir; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; set({ questions: a }); };
  return html`<div class="stack" style="--gap:16px">
    <${TextIn} id="dq-t" label="Titre" value=${d.title} onInput=${(v) => set({ title: v })}/>
    <${TextIn} id="dq-s" label="Sous-titre" value=${d.subtitle} onInput=${(v) => set({ subtitle: v })} placeholder="Ex. Histoire · 4e · 20 minutes"/>
    <div class="q-list">${d.questions.map((q, i) => html`<div class="q-card" key=${q.id}>
      <div class="q-head"><b class="q-num">${i + 1}</b>
        <div class="seg seg-sm" role="group" aria-label="Type de question">${[['qcm', 'Choix'], ['vf', 'Vrai / faux'], ['court', 'Rédigée']].map(([v, l]) => html`<button type="button" aria-pressed=${q.type === v} onClick=${() => upQ(i, { type: v, choices: v === 'vf' ? [{ text: 'Vrai', ok: true }, { text: 'Faux', ok: false }] : q.type === 'vf' ? newQ().choices : q.choices })}>${l}</button>`)}</div>
        <div class="spacer"></div>
        <button class="btn btn-ghost btn-icon btn-sm" onClick=${() => move(i, -1)} disabled=${i === 0} aria-label="Monter la question">↑</button>
        <button class="btn btn-ghost btn-icon btn-sm" onClick=${() => move(i, 1)} disabled=${i === d.questions.length - 1} aria-label="Descendre la question">↓</button>
        <button class="btn btn-ghost btn-icon btn-sm" onClick=${() => set({ questions: d.questions.filter((_, k) => k !== i) })} aria-label="Supprimer la question"><${Icon} name="trash-2"/></button></div>
      <label class="sr-only" for=${'qt' + q.id}>Énoncé de la question ${i + 1}</label>
      <textarea id=${'qt' + q.id} class="textarea q-text" rows="2" value=${q.text} onInput=${(e) => upQ(i, { text: e.target.value })} placeholder="Écrivez la question…"></textarea>
      ${q.type !== 'court' ? html`<div class="q-choices">${q.choices.map((c, k) => html`<div class="q-choice">
          <button type="button" class=${`q-ok ${c.ok ? 'on' : ''}`} onClick=${() => upQ(i, { choices: q.choices.map((x, m) => (q.type === 'vf' ? { ...x, ok: m === k } : m === k ? { ...x, ok: !x.ok } : x)) })} aria-pressed=${c.ok} aria-label=${c.ok ? 'Bonne réponse' : 'Marquer comme bonne réponse'} title="Bonne réponse ?">${c.ok ? '✓' : ''}</button>
          <input class="input" value=${c.text} readOnly=${q.type === 'vf'} onInput=${(e) => upQ(i, { choices: q.choices.map((x, m) => (m === k ? { ...x, text: e.target.value } : x)) })} placeholder=${'Réponse ' + String.fromCharCode(97 + k)} aria-label=${'Réponse ' + String.fromCharCode(97 + k)}/>
          ${q.type === 'qcm' && q.choices.length > 2 && html`<button class="btn btn-ghost btn-icon btn-sm" onClick=${() => upQ(i, { choices: q.choices.filter((_, m) => m !== k) })} aria-label="Retirer cette réponse"><${Icon} name="x"/></button>`}</div>`)}
        ${q.type === 'qcm' && q.choices.length < 8 && html`<button class="btn btn-ghost btn-sm" style="justify-self:start" onClick=${() => upQ(i, { choices: [...q.choices, { text: '', ok: false }] })}><${Icon} name="plus"/>Ajouter une réponse</button>`}
        <p class="hint">Cliquez sur le carré pour cocher la ou les bonnes réponses.</p></div>`
      : html`<div class="row" style="--gap:10px;align-items:flex-end"><div class="field" style="flex:1"><label for=${'qa' + q.id}>Réponse attendue (pour le corrigé)</label><input id=${'qa' + q.id} class="input" value=${q.answer} onInput=${(e) => upQ(i, { answer: e.target.value })}/></div>
          <div class="field" style="width:110px"><label for=${'ql' + q.id}>Lignes</label><input id=${'ql' + q.id} class="input" type="number" min="1" max="15" value=${q.lines} onInput=${(e) => upQ(i, { lines: Number(e.target.value) || 1 })}/></div></div>`}
      <div class="row" style="--gap:8px"><label class="hint" for=${'qp' + q.id}>Points</label><input id=${'qp' + q.id} class="input q-pts" inputmode="decimal" value=${q.points} onInput=${(e) => upQ(i, { points: Number(e.target.value.replace(',', '.')) || 0 })}/></div>
    </div>`)}</div>
    <div class="row" style="--gap:8px">
      <button class="btn btn-primary" onClick=${() => set({ questions: [...d.questions, newQ()] })}><${Icon} name="plus"/>Ajouter une question</button>
      <button class="btn" onClick=${() => { setTxt(''); setPaste(true); }}><${Icon} name="clipboard-paste"/>Coller des questions</button></div>
    <details class="opts"><summary>Options</summary><div class="stack" style="--gap:12px;margin-top:12px">
      <${Check} label="Cadre Nom / Prénom / Classe" checked=${d.fields} onChange=${(v) => set({ fields: v })}/>
      <${Check} label="Afficher les points" checked=${d.showPoints} onChange=${(v) => set({ showPoints: v })}/>
      <${Check} label="Mélanger les questions" checked=${d.shuffleQ} onChange=${(v) => set({ shuffleQ: v })}/>
      <${Check} label="Mélanger les réponses" checked=${d.shuffleA} onChange=${(v) => set({ shuffleA: v })}/>
      <${Seg} label="Nombre de versions (anti-triche)" value=${d.versions} options=${[[1, '1'], [2, '2 (A, B)'], [3, '3'], [4, '4']]} onChange=${(v) => set({ versions: v, seed: rint() })}/>
    </div></details>
    <${Dialog} open=${paste} onClose=${() => setPaste(false)} wide title="Coller des questions" desc="Une question par paragraphe (laissez une ligne vide entre deux questions). Mettez une * devant les bonnes réponses. Sans réponses : question rédigée.">
      <div class="dlg-body"><label class="sr-only" for="qpaste">Questions</label><textarea id="qpaste" class="textarea" rows="12" style="min-height:16em" value=${txt} onInput=${(e) => setTxt(e.target.value)} placeholder=${'Quelle est la capitale de l’Italie ?\n*Rome\nMilan\nNaples\n\nLa Seine passe par Paris.\n*Vrai\nFaux'} autofocus></textarea>
        <p class="hint" style="margin-top:8px">${plural(parseQuiz(txt).length, 'question reconnue', 'questions reconnues')}</p></div>
      <div class="dlg-foot"><button class="btn" onClick=${() => setPaste(false)}>Annuler</button><button class="btn btn-primary" disabled=${!parseQuiz(txt).length} onClick=${() => { const qs = parseQuiz(txt); set({ questions: [...d.questions.filter((q) => q.text.trim()), ...qs] }); setPaste(false); }}>Ajouter</button></div>
    </${Dialog}>
  </div>`;
}

// ======================================================================
// 6. Mots croisés, mots mêlés, textes à trous
// ======================================================================
export const mots = {
  id: 'mots', name: 'Mots croisés & mêlés', icon: 'grid-3x3', desc: 'Mots croisés, mots mêlés et textes à trous, avec corrigé.', hasKey: true,
  defaults: () => ({ mode: 'croises', title: 'Mots croisés', subtitle: '', fields: true, pairs: '', words: '', level: 'moyen', text: '', bank: true, seed: rint() }),
  example: () => ({ ...mots.defaults(), title: 'Le vocabulaire du théâtre', subtitle: 'Français · 5e',
    pairs: `Scène : Partie du théâtre où jouent les acteurs
Rideau : Il se lève au début de la pièce
Acte : Grande partie d'une pièce de théâtre
Réplique : Ce que dit un personnage en réponse à un autre
Tirade : Longue réplique
Didascalie : Indication de mise en scène, souvent en italique
Comédie : Pièce qui fait rire
Coulisses : Endroit caché où les acteurs attendent
Public : Les spectateurs
Monologue : Un personnage parle seul`,
    words: 'CAT\nDOG\nHORSE\nRABBIT\nMOUSE\nELEPHANT\nLION\nTIGER\nMONKEY\nZEBRA\nSNAKE\nBIRD',
    text: `Le 14 juillet [1789], le peuple de Paris prend la [Bastille], une prison qui symbolise le pouvoir du [roi]. Quelques semaines plus tard, le 26 août, les députés adoptent la Déclaration des droits de l'[homme] et du citoyen. Elle affirme que les hommes naissent et demeurent [libres] et égaux en droits.` }),
  build(d) {
    if (d.mode === 'croises') {
      const entries = parsePairs(d.pairs).filter((e) => e.a && e.b);
      if (!entries.length) return { sujet: { title: d.title, subtitle: d.subtitle, blocks: [{ t: 'p', runs: [{ text: 'Ajoutez des mots et leurs définitions pour créer la grille.', i: true }] }] }, corrige: null };
      const cw = crossword(entries, d.seed);
      const list = (dir) => cw.placed.filter((p) => p.dir === dir).sort((a, b) => a.num - b.num).map((p) => `${p.num}. ${p.b} (${p.w.length})`);
      const H = list('H'), V = list('V');
      const n = Math.max(H.length, V.length);
      const defs = { t: 'table', head: ['Horizontalement', 'Verticalement'], rows: Array.from({ length: n }, (_, i) => [H[i] || '', V[i] || '']) };
      const size = Math.min(26, 500 / Math.max(cw.W, 1), 400 / Math.max(cw.H, 1));
      const missing = entries.length - cw.placed.length;
      const base = { title: d.title, subtitle: d.subtitle, fields: d.fields };
      return {
        sujet: { ...base, blocks: [{ t: 'grid', cells: cw.cells(false), size }, defs] },
        corrige: { ...base, title: d.title + ' — Corrigé', fields: false, blocks: [{ t: 'grid', cells: cw.cells(true), size }] },
        warn: missing ? `${plural(missing, 'mot n’a pas pu être placé', 'mots n’ont pas pu être placés')} : essayez « Nouvelle grille » ou ajoutez des mots qui partagent des lettres.` : '',
      };
    }
    if (d.mode === 'meles') {
      const words = lines(d.words);
      if (!words.length) return { sujet: { title: d.title, blocks: [{ t: 'p', runs: [{ text: 'Ajoutez des mots à cacher dans la grille.', i: true }] }] }, corrige: null };
      const ws = wordSearch(words, { level: d.level, seed: d.seed });
      const size = Math.min(28, 500 / ws.n);
      const shown = words.filter((w) => ws.placed.includes(gridWord(w)));
      const base = { title: d.title, subtitle: d.subtitle, fields: d.fields };
      return {
        sujet: { ...base, blocks: [{ t: 'grid', cells: ws.cells(false), size }, { t: 'p', runs: [{ text: `Retrouve ces ${shown.length} mots :`, b: true }] }, { t: 'wordbank', words: shown }] },
        corrige: { ...base, title: d.title + ' — Corrigé', fields: false, blocks: [{ t: 'grid', cells: ws.cells(true), size }] },
        warn: ws.missing.length ? `Mots trop longs pour la grille : ${ws.missing.join(', ')}.` : '',
      };
    }
    const s = clozeRuns(d.text || '', false), k = clozeRuns(d.text || '', true);
    const paras = (r) => [{ t: 'p', runs: r.runs }];
    const base = { title: d.title, subtitle: d.subtitle, fields: d.fields };
    return {
      sujet: { ...base, blocks: [...(d.bank && s.words.length ? [{ t: 'p', runs: [{ text: 'Complète avec les mots suivants :', b: true }] }, { t: 'wordbank', words: sShuffle(s.words, seeded(d.seed)) }] : []), ...paras(s)] },
      corrige: { ...base, title: d.title + ' — Corrigé', fields: false, blocks: paras(k) },
      warn: s.words.length ? '' : 'Mettez entre [crochets] les mots à faire deviner.',
    };
  },
  Editor({ d, set }) {
    return html`<div class="stack" style="--gap:16px">
      <${Seg} label="Type d’exercice" value=${d.mode} options=${[['croises', 'Mots croisés'], ['meles', 'Mots mêlés'], ['trous', 'Texte à trous']]} onChange=${(v) => set({ mode: v, title: d.title && !['Mots croisés', 'Mots mêlés', 'Texte à trous'].includes(d.title) ? d.title : { croises: 'Mots croisés', meles: 'Mots mêlés', trous: 'Texte à trous' }[v] })}/>
      <${TextIn} id="dm-t" label="Titre" value=${d.title} onInput=${(v) => set({ title: v })}/>
      <${TextIn} id="dm-s" label="Sous-titre" value=${d.subtitle} onInput=${(v) => set({ subtitle: v })} placeholder="Ex. Français · 5e"/>
      ${d.mode === 'croises' && html`<${Area} id="dm-p" label="Mots et définitions" rows=${10} value=${d.pairs} onInput=${(v) => set({ pairs: v })} placeholder=${'Un mot par ligne, puis deux-points et sa définition :\nScène : Partie du théâtre où jouent les acteurs\nRideau : Il se lève au début de la pièce'} hint=${`${plural(parsePairs(d.pairs).filter((e) => e.a && e.b).length, 'mot', 'mots')}. Les accents et espaces sont retirés dans la grille.`}/>
        <button class="btn" onClick=${() => set({ seed: rint() })}><${Icon} name="shuffle"/>Nouvelle grille</button>`}
      ${d.mode === 'meles' && html`<${Area} id="dm-w" label="Mots à cacher" rows=${8} value=${d.words} onInput=${(v) => set({ words: v })} placeholder=${'Un mot par ligne'} hint=${plural(lines(d.words).length, 'mot', 'mots')}/>
        <${Seg} label="Difficulté" value=${d.level} options=${[['facile', 'Facile (→ ↓)'], ['moyen', 'Moyen (+ diagonales)'], ['difficile', 'Difficile (+ à l’envers)']]} onChange=${(v) => set({ level: v })}/>
        <button class="btn" onClick=${() => set({ seed: rint() })}><${Icon} name="shuffle"/>Nouvelle grille</button>`}
      ${d.mode === 'trous' && html`<${Area} id="dm-x" label="Texte" rows=${10} value=${d.text} onInput=${(v) => set({ text: v })} placeholder="Collez votre texte et mettez entre [crochets] les mots à faire trouver." hint="Astuce : sélectionnez un mot puis cliquez sur le bouton ci-dessous."/>
        <button class="btn" onClick=${() => { const ta = document.getElementById('dm-x'); const a = ta.selectionStart, b = ta.selectionEnd; if (a === b) return; set({ text: d.text.slice(0, a) + '[' + d.text.slice(a, b) + ']' + d.text.slice(b) }); }}><${Icon} name="pencil"/>Transformer la sélection en trou</button>
        <${Check} label="Donner la liste des mots (dans le désordre)" checked=${d.bank} onChange=${(v) => set({ bank: v })}/>`}
      <${Check} label="Cadre Nom / Prénom / Classe" checked=${d.fields} onChange=${(v) => set({ fields: v })}/>
    </div>`;
  },
};

// ======================================================================
// 7. Flashcards recto-verso
// ======================================================================
const LAYOUTS = { 8: [2, 4], 10: [2, 5], 12: [3, 4] };
export const flashcards = {
  id: 'flashcards', name: 'Flashcards', icon: 'layers', desc: 'Recto-verso parfaitement alignés à l’impression.', hasKey: false,
  defaults: () => ({ title: 'Flashcards', pairs: '', per: 8, duplex: 'long', showTitle: true }),
  example: () => ({ ...flashcards.defaults(), title: 'Verbes irréguliers anglais', pairs: `to be : was / were – been
to go : went – gone
to see : saw – seen
to take : took – taken
to eat : ate – eaten
to write : wrote – written
to buy : bought – bought
to think : thought – thought
to begin : began – begun
to know : knew – known` }),
  build(d) {
    const pairs = parsePairs(d.pairs).filter((p) => p.a);
    const [cols, rows] = LAYOUTS[d.per] || LAYOUTS[8];
    const per = cols * rows;
    const height = Math.floor(745 / rows) - 8;
    const blocks = [];
    for (let p = 0; p < Math.max(1, pairs.length); p += per) {
      const page = pairs.slice(p, p + per);
      const front = Array.from({ length: per }, (_, i) => (page[i] ? { text: page[i].a, sub: d.showTitle ? d.title : '' } : null));
      // Verso en miroir : retourné sur le bord long, les colonnes s'inversent ; sur le bord court, les rangées.
      const back = Array.from({ length: per }, (_, i) => {
        const r = Math.floor(i / cols), c = i % cols;
        const src = d.duplex === 'long' ? r * cols + (cols - 1 - c) : (rows - 1 - r) * cols + c;
        return page[src] ? { text: page[src].b || '', plain: true } : null;
      });
      if (p) blocks.push({ t: 'break' });
      blocks.push({ t: 'cards', cards: front, cols, rows, height }, { t: 'break' }, { t: 'cards', cards: back, cols, rows, height });
    }
    return { sujet: { title: '', blocks }, corrige: null, pages: Math.ceil(Math.max(1, pairs.length) / per) * 2 };
  },
  Editor({ d, set }) {
    const n = parsePairs(d.pairs).filter((p) => p.a).length;
    return html`<div class="stack" style="--gap:16px">
      <${TextIn} id="df-t" label="Titre (écrit en petit sur chaque carte)" value=${d.title} onInput=${(v) => set({ title: v })}/>
      <${Area} id="df-p" label="Cartes : recto : verso" rows=${12} value=${d.pairs} onInput=${(v) => set({ pairs: v })} placeholder=${'Une carte par ligne :\nCapitale de l’Espagne : Madrid\nH₂O : eau'} hint=${plural(n, 'carte', 'cartes')}/>
      <${Seg} label="Cartes par page" value=${d.per} options=${[[8, '8 (grandes)'], [10, '10'], [12, '12 (petites)']]} onChange=${(v) => set({ per: v })}/>
      <${Seg} label="Impression recto-verso" value=${d.duplex} options=${[['long', 'Bord long (le plus courant)'], ['short', 'Bord court']]} onChange=${(v) => set({ duplex: v })}/>
      <${Check} label="Rappeler le titre sur chaque carte" checked=${d.showTitle} onChange=${(v) => set({ showTitle: v })}/>
      <div class="notice"><${Icon} name="printer"/><div><strong>À l’impression :</strong> choisissez « Recto-verso » et « ${d.duplex === 'long' ? 'Retourner sur le bord long' : 'Retourner sur le bord court'} », à l’échelle 100 % (sans « ajuster à la page »). Les versos tombent exactement derrière les rectos.</div></div>
    </div>`;
  },
};

// ======================================================================
// 8. Fiches de vocabulaire / lexique
// ======================================================================
function parseLex(text) {
  return lines(text).map((l) => {
    const parts = l.includes('\t') ? l.split('\t') : l.split(/\s:\s|\s;\s|;|(?<!\d):(?!\d)/);
    return { term: (parts[0] || '').trim(), def: (parts[1] || '').trim(), ex: parts.slice(2).join(' : ').trim() };
  }).filter((x) => x.term);
}
export const lexique = {
  id: 'lexique', name: 'Fiches de vocabulaire', icon: 'book-open', desc: 'Lexiques clairs, avec une version à compléter.', hasKey: true,
  defaults: () => ({ title: 'Lexique', subtitle: '', rows: '', showEx: true, exercise: 'aucun', bank: true, fields: false, seed: rint() }),
  example: () => ({ ...lexique.defaults(), title: 'Les paysages', subtitle: 'Géographie · 6e', rows: `Littoral : Espace où la terre rencontre la mer : Le littoral breton attire les touristes.
Relief : Formes de la surface de la Terre : Les Alpes ont un relief élevé.
Métropole : Très grande ville qui concentre population et activités : Lyon est une métropole.
Agriculture : Activité qui consiste à cultiver la terre et élever des animaux : La Beauce est une région d'agriculture.
Désert : Espace très sec et peu peuplé : Le Sahara est le plus grand désert chaud.
Bocage : Paysage de champs entourés de haies : On trouve du bocage en Normandie.` }),
  build(d) {
    const rows = parseLex(d.rows);
    const ex = d.showEx && rows.some((r) => r.ex);
    const head = ['Mot', 'Définition', ...(ex ? ['Exemple'] : [])];
    const widths = ex ? [2, 4, 4] : [2, 5];
    const full = rows.map((r) => [{ text: r.term, bold: true }, r.def, ...(ex ? [r.ex] : [])]);
    const base = { title: d.title, subtitle: d.subtitle, fields: d.fields || d.exercise !== 'aucun' };
    if (d.exercise === 'aucun') return { sujet: { ...base, fields: d.fields, blocks: [{ t: 'table', head, widths, rows: full }] }, corrige: null };
    const blankDef = d.exercise === 'definitions';
    const missing = rows.map((r) => (blankDef ? r.def : r.term));
    const blocks = [
      ...(d.bank ? [{ t: 'p', runs: [{ text: blankDef ? 'Retrouve la bonne définition de chaque mot :' : 'Retrouve le mot qui correspond à chaque définition :', b: true }] }, ...(blankDef ? [{ t: 'table', head: ['Définitions (dans le désordre)'], rows: sShuffle(missing, seeded(d.seed)).map((x) => [x]) }] : [{ t: 'wordbank', words: sShuffle(missing, seeded(d.seed)) }])] : []),
      { t: 'table', head, widths, rows: rows.map((r) => [blankDef ? { text: r.term, bold: true } : ' ', blankDef ? ' \n ' : r.def, ...(ex ? [r.ex] : [])]) },
    ];
    return { sujet: { ...base, blocks }, corrige: { ...base, title: d.title + ' — Corrigé', fields: false, blocks: [{ t: 'table', head, widths, rows: full }] } };
  },
  Editor({ d, set }) {
    return html`<div class="stack" style="--gap:16px">
      <${TextIn} id="dl-t" label="Titre" value=${d.title} onInput=${(v) => set({ title: v })}/>
      <${TextIn} id="dl-s" label="Sous-titre" value=${d.subtitle} onInput=${(v) => set({ subtitle: v })} placeholder="Ex. SVT · 5e · Chapitre 3"/>
      <${Area} id="dl-r" label="Mot : définition : exemple (facultatif)" rows=${12} value=${d.rows} onInput=${(v) => set({ rows: v })} placeholder=${'Un mot par ligne :\nCellule : Plus petite unité du vivant : Le corps humain compte des milliards de cellules.'} hint=${plural(parseLex(d.rows).length, 'mot', 'mots')}/>
      <${Check} label="Afficher la colonne Exemple" checked=${d.showEx} onChange=${(v) => set({ showEx: v })}/>
      <${Seg} label="Version élève" value=${d.exercise} options=${[['aucun', 'Fiche complète'], ['definitions', 'Définitions à compléter'], ['termes', 'Mots à retrouver']]} onChange=${(v) => set({ exercise: v })}/>
      ${d.exercise !== 'aucun' && html`<${Check} label="Donner les réponses dans le désordre" checked=${d.bank} onChange=${(v) => set({ bank: v })}/>`}
    </div>`;
  },
};

// ======================================================================
// 9. Jeux de révision : jeu de l'oie, dominos, « J'ai… Qui a… ? »
// ======================================================================
export const jeux = {
  id: 'jeux', name: 'Jeux de révision', icon: 'puzzle', desc: 'Jeu de l’oie, dominos et « J’ai… Qui a… ? ».', hasKey: true,
  defaults: () => ({ kind: 'oie', title: 'Jeu de révision', pairs: '', cases: 40, seed: rint() }),
  example: () => ({ ...jeux.defaults(), title: 'Les tables de multiplication', pairs: `7 × 8 : 56
6 × 9 : 54
8 × 8 : 64
7 × 7 : 49
9 × 9 : 81
6 × 7 : 42
8 × 9 : 72
6 × 8 : 48
7 × 9 : 63
4 × 8 : 32
3 × 9 : 27
5 × 7 : 35` }),
  build(d) {
    const pairs = parsePairs(d.pairs).filter((p) => p.a && p.b);
    if (pairs.length < 3) return { sujet: { title: d.title, blocks: [{ t: 'p', runs: [{ text: 'Ajoutez au moins 3 questions avec leur réponse.', i: true }] }] }, corrige: null };
    const key = { t: 'table', head: ['N°', 'Question', 'Réponse'], widths: [1, 5, 4], rows: pairs.map((p, i) => [String(i + 1), p.a, { text: p.b, bold: true }]) };
    if (d.kind === 'oie') {
      const board = gooseBoard({ count: d.cases, specials: defaultSpecials(d.cases), title: d.title });
      const cards = pairs.map((p, i) => ({ text: p.a, sub: `Question ${i + 1}`, size: 14 }));
      return {
        sujet: { title: '', blocks: [{ t: 'svg', svg: board.svg, ratio: board.ratio }, { t: 'p', runs: [{ text: 'Règle : ', b: true }, { text: 'lancez le dé. Sur une case « ? », un autre joueur lit une carte question : bonne réponse, on reste ; mauvaise réponse, on recule d’une case. Le premier sur l’ARRIVÉE gagne.' }] }, { t: 'break' }, { t: 'cards', cards, cols: 3, rows: 5, height: 140 }] },
        corrige: { title: d.title + ' — Réponses', blocks: [key] },
      };
    }
    if (d.kind === 'dominos') {
      const sheets = dominoSheets(pairs, 12, d.seed);
      const chain = { t: 'table', head: ['Ordre', 'Question', 'Réponse'], widths: [1, 5, 4], rows: pairs.map((p, i) => [String(i + 1), p.a, { text: p.b, bold: true }]) };
      return {
        sujet: { title: d.title, subtitle: 'Découpez les dominos, puis reconstituez la chaîne : la réponse d’un domino se colle à la question qui lui correspond. Commencez par le domino « DÉBUT ».', blocks: sheets.flatMap((s, i) => [...(i ? [{ t: 'break' }] : []), { t: 'svg', svg: s.svg, ratio: s.ratio }]) },
        corrige: { title: d.title + ' — Ordre de la chaîne', blocks: [chain] },
      };
    }
    return {
      sujet: { title: '', blocks: [{ t: 'cards', cards: chainCards(pairs, d.seed), cols: 3, rows: 4, height: 175 }] },
      corrige: { title: d.title + ' — « J’ai… Qui a… ? » : ordre des cartes', blocks: [key] },
    };
  },
  Editor({ d, set }) {
    const n = parsePairs(d.pairs).filter((p) => p.a && p.b).length;
    return html`<div class="stack" style="--gap:16px">
      <${Seg} label="Jeu" value=${d.kind} options=${[['oie', 'Jeu de l’oie'], ['dominos', 'Dominos'], ['chaine', 'J’ai… Qui a… ?']]} onChange=${(v) => set({ kind: v })}/>
      <${TextIn} id="dj-t" label="Titre" value=${d.title} onInput=${(v) => set({ title: v })}/>
      <${Area} id="dj-p" label="Questions : réponses" rows=${12} value=${d.pairs} onInput=${(v) => set({ pairs: v })} placeholder=${'Une question par ligne :\n7 × 8 : 56\nCapitale du Portugal : Lisbonne'} hint=${plural(n, 'question', 'questions')}/>
      ${d.kind === 'oie' && html`<${Seg} label="Nombre de cases" value=${d.cases} options=${[[24, '24'], [32, '32'], [40, '40'], [48, '48']]} onChange=${(v) => set({ cases: v })}/>`}
      ${d.kind !== 'oie' && html`<button class="btn" onClick=${() => set({ seed: rint() })}><${Icon} name="shuffle"/>Mélanger à nouveau</button>`}
      <p class="hint">${{ oie: 'Plateau + cartes questions à découper. Les réponses sont dans le corrigé.', dominos: 'Chaque domino porte une réponse et une question : la chaîne se referme sur elle-même.', chaine: 'Distribuez une carte par élève. Celui qui a la carte de départ lit sa question, celui qui a la réponse enchaîne…' }[d.kind]}</p>
    </div>`;
  },
};

export const DOC_TOOLS = [qcm, mots, flashcards, lexique, jeux];
export const docTool = (id) => DOC_TOOLS.find((t) => t.id === id);
