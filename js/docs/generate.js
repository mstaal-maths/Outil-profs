// Génération automatique de contenus : calcul, questions depuis une liste de mots, demandes pour une IA.
import { uid } from '../lib/util.js';

const r = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const mix = (arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const fr = (n) => String(n).replace('.', ',').replace('-', '−');

/** Question à choix : 1 bonne réponse + 3 distracteurs différents. */
function q(text, good, wrongs) {
  const seen = new Set([String(good)]);
  const ws = [];
  for (const w of wrongs) { const s = String(w); if (!seen.has(s)) { seen.add(s); ws.push(s); } if (ws.length === 3) break; }
  let k = 1;
  while (ws.length < 3) { const s = typeof good === 'number' ? String(good + k * (k % 2 ? 1 : -1)) : `${good} ?`; if (!seen.has(s)) { seen.add(s); ws.push(s); } k++; }
  const choices = mix([{ text: String(good), ok: true }, ...ws.map((t) => ({ text: t, ok: false }))]).map((c) => ({ ...c, text: fr(c.text) }));
  return { id: uid('q'), type: 'qcm', text, points: 1, lines: 3, answer: '', choices };
}
const pgcd = (a, b) => (b ? pgcd(b, a % b) : a);

// ---------- Générateurs de calcul ----------
export const MATH = {
  tables: { label: 'Tables de multiplication', make() { const a = r(2, 10), b = r(2, 10); return q(`${a} × ${b} = ?`, a * b, [a * (b + 1), a * (b - 1), (a + 1) * b, a + b, a * b + 10]); } },
  addsub: { label: 'Additions et soustractions', make() {
    const a = r(12, 99), b = r(11, 89);
    return Math.random() < 0.5 ? q(`${a} + ${b} = ?`, a + b, [a + b + 10, a + b - 10, a + b + 1, a + b - 1]) : q(`${Math.max(a, b)} − ${Math.min(a, b)} = ?`, Math.abs(a - b), [Math.abs(a - b) + 10, Math.abs(a - b) - 10, Math.abs(a - b) + 1, a + b]);
  } },
  relatifs: { label: 'Nombres relatifs', make() {
    const a = r(-12, 12) || 3, b = r(-12, 12) || -5;
    const op = pick(['+', '−', '×']);
    const sb = b < 0 ? `(${fr(b)})` : String(b);
    const res = op === '+' ? a + b : op === '−' ? a - b : a * b;
    return q(`${fr(a)} ${op} ${sb} = ?`, res, [-res, op === '−' ? a + b : a - b, res + 1, res - 1, Math.abs(res)]);
  } },
  priorites: { label: 'Priorités opératoires', make() {
    const a = r(2, 9), b = r(2, 9), c = r(2, 9);
    if (Math.random() < 0.5) return q(`${a} + ${b} × ${c} = ?`, a + b * c, [(a + b) * c, a * b + c, a + b + c]);
    const x = b * c + r(2, 30); // résultat toujours positif
    return q(`${x} − ${b} × ${c} = ?`, x - b * c, [(x - b) * c, x - b - c, x + b * c]);
  } },
  fractions: { label: 'Simplifier une fraction', make() {
    let n = r(1, 9), d = r(2, 12);
    while (pgcd(n, d) !== 1 || n >= d) { n = r(1, 9); d = r(2, 12); }
    const k = r(2, 6);
    return q(`Écris ${n * k}/${d * k} sous forme de fraction irréductible.`, `${n}/${d}`, [`${n * k}/${d}`, `${n}/${d * k}`, `${d}/${n}`, `${n + 1}/${d}`, `${n * 2}/${d * 2}`]);
  } },
  pourcentages: { label: 'Pourcentages', make() {
    const p = pick([10, 20, 25, 50, 5, 30, 75]), v = pick([20, 40, 60, 80, 120, 200, 300, 160]);
    const res = (p * v) / 100;
    return q(`Combien font ${p} % de ${v} ?`, res, [res * 2, v - res, res / 2, p + v / 10, res + 10]);
  } },
  conversions: { label: 'Conversions (longueurs)', make() {
    const units = ['mm', 'cm', 'dm', 'm', 'dam', 'hm', 'km'];
    const i = r(0, 4), j = Math.min(6, i + r(1, 2));
    const v = r(2, 90);
    const res = v / 10 ** (j - i);
    const fix = (x) => Number(x.toPrecision(6));
    return q(`${v} ${units[i]} = … ${units[j]}`, fix(res), [fix(res * 10), fix(res / 10), v * 10 ** (j - i), fix(res * 100)]);
  } },
};
export function mathQuestions(kinds, n) {
  const ks = kinds.length ? kinds : ['tables'];
  const out = [], seen = new Set();
  for (let t = 0; out.length < n && t < n * 20; t++) {
    const qq = MATH[ks[out.length % ks.length]].make();
    if (seen.has(qq.text)) continue;
    seen.add(qq.text); out.push(qq);
  }
  return out;
}

// ---------- Questions à partir d'une liste « mot : définition » ----------
export function questionsFromPairs(pairs, n, style = 'mix') {
  const ok = pairs.filter((p) => p.a && p.b);
  if (ok.length < 2) return [];
  return mix(ok).slice(0, n).map((p, i) => {
    const others = mix(ok.filter((o) => o !== p));
    const kind = style === 'mix' ? ['def', 'mot', 'vf'][i % 3] : style;
    if (kind === 'mot') return q(`Quel mot correspond à cette définition : « ${p.b} » ?`, p.a, others.map((o) => o.a));
    if (kind === 'vf') {
      const truth = Math.random() < 0.5 || others.length === 0;
      const shown = truth ? p.b : others[0].b;
      return { id: uid('q'), type: 'vf', text: `« ${p.a} » : ${shown.charAt(0).toLowerCase() + shown.slice(1)}`, points: 1, lines: 3, answer: '', choices: [{ text: 'Vrai', ok: truth }, { text: 'Faux', ok: !truth }] };
    }
    return q(`Que signifie « ${p.a} » ?`, p.b, others.map((o) => o.b));
  });
}

// ---------- Demandes prêtes à envoyer à une IA ----------
export const LEVELS = ['CM2', '6e', '5e', '4e', '3e', '2nde', '1re', 'Terminale', 'BTS / supérieur'];
const COMMON = 'Vérifie soigneusement l’exactitude de chaque information et adapte le vocabulaire au niveau. Ne mets aucun titre, aucune introduction, aucune conclusion, aucun gras ni aucune numérotation : réponds UNIQUEMENT dans le format demandé.';
export const AI_KINDS = {
  qcm: {
    label: 'des questions de QCM',
    prompt: ({ theme, level, n, types, extra }) => `Tu es professeur. Crée un QCM de ${n} questions sur le thème « ${theme} » pour des élèves de ${level}.
${types === 'vf' ? 'Toutes les questions sont des affirmations « Vrai / Faux ».' : types === 'mix' ? 'Mélange des questions à choix multiples (4 propositions), quelques affirmations Vrai / Faux et une ou deux questions à réponse rédigée.' : 'Chaque question a 4 propositions, dont une ou plusieurs bonnes réponses.'}
${extra ? 'Consignes supplémentaires : ' + extra + '\n' : ''}FORMAT OBLIGATOIRE :
- une question par paragraphe, avec une ligne vide entre deux questions ;
- première ligne : la question ;
- puis une proposition par ligne, et un astérisque * au tout début de chaque bonne réponse ;
- pour une affirmation Vrai / Faux : deux lignes « Vrai » et « Faux », avec * devant la bonne ;
- pour une question à réponse rédigée : la question, puis une seule ligne qui commence par « Réponse : » suivie de la réponse attendue.
Exemple :
Quelle est la capitale de l’Italie ?
*Rome
Milan
Naples
Turin

${COMMON}`,
  },
  croises: { label: 'des mots et leurs définitions', field: 'pairs', prompt: ({ theme, level, n, extra }) => `Tu es professeur. Donne ${n} mots de vocabulaire importants sur le thème « ${theme} » pour des élèves de ${level}, avec pour chacun une définition courte qui ne contient pas le mot lui-même (pour une grille de mots croisés).
${extra ? 'Consignes supplémentaires : ' + extra + '\n' : ''}FORMAT OBLIGATOIRE : une ligne par mot, sous la forme « Mot : définition ». Chaque mot doit être un seul mot, sans espace.
Exemple :
Scène : Partie du théâtre où jouent les acteurs
${COMMON}` },
  meles: { label: 'une liste de mots', field: 'words', prompt: ({ theme, level, n, extra }) => `Donne ${n} mots (un seul mot chacun, sans espace, de 3 à 12 lettres) liés au thème « ${theme} », adaptés à des élèves de ${level}, pour une grille de mots mêlés.
${extra ? 'Consignes supplémentaires : ' + extra + '\n' : ''}FORMAT OBLIGATOIRE : un mot par ligne, rien d’autre.
${COMMON}` },
  trous: { label: 'un texte à trous', field: 'text', prompt: ({ theme, level, n, extra }) => `Écris un court texte de cours (environ ${Math.max(4, Math.round(n / 2))} phrases) sur le thème « ${theme} » pour des élèves de ${level}. Mets entre crochets [ ] environ ${n} mots importants que les élèves devront retrouver, par exemple : La [Révolution] commence en [1789].
${extra ? 'Consignes supplémentaires : ' + extra + '\n' : ''}FORMAT OBLIGATOIRE : uniquement le texte, avec les mots à trouver entre crochets.
${COMMON}` },
  flashcards: { label: 'des cartes recto / verso', field: 'pairs', prompt: ({ theme, level, n, extra }) => `Crée ${n} flashcards de révision sur le thème « ${theme} » pour des élèves de ${level} : au recto une notion, une question ou un mot ; au verso la réponse, courte.
${extra ? 'Consignes supplémentaires : ' + extra + '\n' : ''}FORMAT OBLIGATOIRE : une carte par ligne, sous la forme « recto : verso ».
Exemple :
Capitale de l’Espagne : Madrid
${COMMON}` },
  lexique: { label: 'un lexique', field: 'rows', prompt: ({ theme, level, n, extra }) => `Crée un lexique de ${n} mots importants sur le thème « ${theme} » pour des élèves de ${level}, avec une définition simple et un exemple d’utilisation.
${extra ? 'Consignes supplémentaires : ' + extra + '\n' : ''}FORMAT OBLIGATOIRE : une ligne par mot, sous la forme « Mot : définition : exemple ».
Exemple :
Littoral : Espace où la terre rencontre la mer : Le littoral breton attire les touristes.
${COMMON}` },
  jeux: { label: 'des questions et réponses', field: 'pairs', prompt: ({ theme, level, n, extra }) => `Crée ${n} questions de révision sur le thème « ${theme} » pour des élèves de ${level}, avec une réponse très courte (un mot, un nombre ou une expression), pour un jeu de société en classe.
${extra ? 'Consignes supplémentaires : ' + extra + '\n' : ''}FORMAT OBLIGATOIRE : une question par ligne, sous la forme « question : réponse ». N’utilise pas le caractère « : » ailleurs.
Exemple :
Combien de côtés a un hexagone : 6
${COMMON}` },
};

/** Nettoie ce que renvoie une IA (blocs de code, gras, numéros). */
export function cleanAiText(t) {
  return (t || '').replace(/```[a-z]*\n?/gi, '').replace(/\*\*(.+?)\*\*/g, '$1').replace(/^\s*(question\s*\d+\s*[:.)-]\s*)/gim, '').replace(/^\s*[-•]\s+(?=\S)/gm, '').trim();
}

export const AI_SITES = [
  { id: 'lechat', name: 'Le Chat (Mistral, français)', url: (p) => `https://chat.mistral.ai/chat?q=${encodeURIComponent(p)}` },
  { id: 'chatgpt', name: 'ChatGPT', url: (p) => `https://chatgpt.com/?q=${encodeURIComponent(p)}` },
  { id: 'claude', name: 'Claude', url: (p) => `https://claude.ai/new?q=${encodeURIComponent(p)}` },
];
