// Rédaction des appréciations de bulletin à partir de 4 critères.
// Écriture : {P} prénom · {il}/{Il} pronom · {m|f} accord masculin|féminin.
import { studentAverage } from './model.js';

export const CRITERIA = [
  { id: 'travail', label: 'Travail', levels: ['Insuffisant', 'Fragile', 'Sérieux', 'Excellent'] },
  { id: 'attitude', label: 'Attitude', levels: ['À revoir', 'Dissipée', 'Correcte', 'Exemplaire'] },
  { id: 'oral', label: 'Participation orale', levels: ['Absente', 'Timide', 'Régulière', 'Très active'] },
  { id: 'prog', label: 'Progression', levels: ['En baisse', 'Stable', 'En progrès', 'Très nette'] },
];

const BANK = {
  travail: [
    ['Le travail fourni est nettement insuffisant.', '{P} ne fournit pas le travail attendu.', 'Le travail personnel est trop irrégulier et très insuffisant.'],
    ['Le travail est encore irrégulier.', '{P} fournit des efforts, mais le travail reste trop superficiel.', 'Le travail est inégal : {il} doit gagner en régularité.'],
    ['Le travail est sérieux et régulier.', '{P} fournit un travail sérieux.', '{P} est {sérieux|sérieuse} et {appliqué|appliquée} dans son travail.'],
    ['Excellent travail, sérieux et approfondi.', '{P} fournit un travail remarquable et très régulier.', '{P} est {un élève|une élève} {rigoureux|rigoureuse} qui fournit un excellent travail.'],
  ],
  attitude: [
    ['L’attitude en classe n’est pas acceptable et gêne le travail du groupe.', '{Il} doit impérativement adopter une attitude plus adaptée en classe.', 'Le comportement en classe pose problème.'],
    ['{Il} se laisse encore trop souvent distraire.', 'L’attitude en classe est parfois dissipée.', 'Les bavardages nuisent encore à sa concentration.'],
    ['L’attitude en classe est correcte.', '{Il} a une attitude positive en classe.', 'Le comportement est adapté au travail.'],
    ['L’attitude en classe est exemplaire.', '{Il} a un comportement irréprochable.', '{Il} fait preuve d’une grande maturité en classe.'],
  ],
  oral: [
    ['La participation orale est quasi inexistante.', '{Il} doit absolument s’impliquer à l’oral.', '{Il} ne participe pas à l’oral.'],
    ['La participation orale reste trop timide.', '{Il} doit oser davantage prendre la parole.', '{Il} participe peu à l’oral.'],
    ['{Il} participe régulièrement à l’oral.', 'La participation orale est satisfaisante.', '{Il} s’implique volontiers à l’oral.'],
    ['{Il} participe activement et avec pertinence.', 'La participation orale est riche et constructive.', '{Il} enrichit le cours par ses interventions.'],
  ],
  prog: [
    ['Attention au relâchement constaté.', 'On note un relâchement par rapport à la période précédente.', 'Le niveau est en baisse.'],
    ['', 'Le niveau se maintient.', 'Le niveau est stable.'],
    ['Les progrès sont encourageants.', 'On note de réels progrès.', '{Il} progresse : c’est encourageant.'],
    ['Les progrès sont remarquables !', 'Très nette progression : bravo !', '{Il} a fait de très gros progrès.'],
  ],
};
const RESULTS = [
  ['Les résultats sont très insuffisants.', 'Les résultats sont préoccupants.', 'Les résultats sont nettement insuffisants.'],
  ['Les résultats restent fragiles.', 'Les résultats sont encore fragiles.', 'Les résultats restent justes.'],
  ['Les résultats sont satisfaisants.', 'Les résultats sont bons.', 'Les résultats sont corrects.'],
  ['Les résultats sont excellents.', 'Les résultats sont très bons.', 'D’excellents résultats.'],
];
const CLOSING = [
  ['Il faut se ressaisir rapidement.', 'Un sursaut est indispensable.', '{Il} doit se mettre au travail sans attendre.'],
  ['Des efforts sont attendus pour la suite.', 'Il faut persévérer.', '{Il} peut mieux faire avec plus de régularité.'],
  ['C’est un bon {période}, à poursuivre.', 'Continue ainsi.', 'Bon {période}.'],
  ['Félicitations !', 'Bravo, continue ainsi !', 'Excellent {période}.'],
];

function render(t, st, ctx) {
  const f = st.g === 'f';
  // La toute première phrase nomme l'élève plutôt que « Il / Elle ».
  if (!ctx.named && t.startsWith('{Il}')) t = '{P}' + t.slice(4);
  let out = t.replace(/\{([^}|]+)\|([^}]+)\}/g, (_, m, w) => (f ? w : m))
    .replace(/\{période\}/g, ctx.periodWord)
    .replace(/\{Il\}/g, f ? 'Elle' : 'Il').replace(/\{il\}/g, f ? 'elle' : 'il');
  // Le prénom n'apparaît qu'une fois : ensuite, on utilise le pronom.
  if (out.includes('{P}')) {
    if (!ctx.named) { ctx.named = true; out = out.replace('{P}', st.first); }
    out = out.replace(/\{P\}/g, f ? 'Elle' : 'Il');
  }
  return out;
}

/** Niveau des résultats (0–3) d'après la moyenne sur 20. */
export const resultLevel = (avg) => (avg == null ? null : avg < 8 ? 0 : avg < 11 ? 1 : avg < 14 ? 2 : 3);

/** Progression suggérée d'après les notes : période précédente, sinon début vs fin de période. */
export function suggestProgress(cls, sid, period) {
  const cur = studentAverage(cls, sid, period);
  if (cur == null) return null;
  const prev = period > 1 ? studentAverage(cls, sid, period - 1) : null;
  let delta;
  if (prev != null) delta = cur - prev;
  else {
    const evs = cls.evals.filter((e) => e.period === period && typeof e.grades?.[sid] === 'number').sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    if (evs.length < 2) return null;
    const half = Math.ceil(evs.length / 2);
    const m = (arr) => arr.reduce((a, e) => a + (e.grades[sid] / (e.max || 20)) * 20, 0) / arr.length;
    delta = m(evs.slice(half)) - m(evs.slice(0, half));
  }
  return { delta, level: delta <= -1.5 ? 0 : delta < 1 ? 1 : delta < 3 ? 2 : 3, from: prev != null ? 'période précédente' : 'début de la période' };
}

/**
 * Trois formulations différentes.
 * lv = { travail, attitude, oral, prog } (0–3) ; opts = { results: niveau|null, length: 'courte'|'complete', periodWord }
 */
export function composeAll(st, lv, opts) {
  const ctxBase = { periodWord: opts.periodWord || 'trimestre' };
  const variants = [];
  for (let v = 0; v < 3; v++) {
    const ctx = { ...ctxBase, named: false };
    const pickS = (arr) => render(arr[(v + (opts.shift || 0)) % arr.length], st, ctx);
    const parts = [];
    const order = v === 1 ? ['attitude', 'travail', 'oral', 'prog'] : ['travail', 'attitude', 'oral', 'prog'];
    const short = opts.length === 'courte';
    for (const c of order) {
      if (lv[c] == null) continue;
      if (short && (c === 'oral' || (c === 'attitude' && lv.attitude >= 2))) continue;
      const s = pickS(BANK[c][lv[c]]);
      if (s) parts.push(s);
      if (c === 'travail' && opts.results != null && !short) {
        let r = pickS(RESULTS[opts.results]);
        // Liaison naturelle quand travail et résultats ne vont pas dans le même sens.
        if (lv.travail >= 2 && opts.results <= 1) r = 'Pourtant, ' + r.charAt(0).toLowerCase() + r.slice(1);
        else if (lv.travail <= 1 && opts.results >= 2) r = r.replace(/\.$/, '') + ', mais il ne faut pas s’en contenter.';
        parts.push(r);
      }
    }
    // Conclusion selon l'ensemble (le travail compte double).
    const vals = ['travail', 'travail', 'attitude', 'oral', 'prog'].map((c) => lv[c]).filter((x) => x != null);
    if (opts.results != null) vals.push(opts.results);
    const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 1.5;
    const closeLv = avg < 0.9 ? 0 : avg < 1.75 ? 1 : avg < 2.6 ? 2 : 3;
    parts.push(pickS(CLOSING[closeLv]));
    variants.push(parts.join(' ').replace(/\s+/g, ' ').trim());
  }
  return [...new Set(variants)];
}
