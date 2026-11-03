// Lecture d'un tableau de notes collé depuis École Directe, Pronote ou un tableur.
// Tout se passe dans le navigateur : rien n'est envoyé nulle part.
import { parseStudentLine, norm, fuzzyScore } from './util.js';

// Colonnes à ne pas importer par défaut (moyennes, appréciations…) et lignes de synthèse.
const SKIP_TITLE = /(^|[\s(])(moy\.?|moyennes?|appr\.?|appréciations?|rang|total|bilan|écart)(?=$|[\s).:])/i;
const ROW_SKIP = /^(moyennes?|moy\.?|total|minimum|maximum|min\.?|max\.?|médiane|écart)(\s|$|[:.])/i;

/** Lit une valeur de note : « 15,5 », « 15.5/20 », « Abs », « Disp », « NE »… */
export function readCell(raw) {
  let s = String(raw ?? '').trim();
  if (!s || /^[-–—.]+$/.test(s)) return { v: null };
  const low = norm(s);
  if (/^(abs|absent|absente|a|ab)\.?$/.test(low)) return { v: 'abs' };
  if (/^(disp|dispense|dispensee|d|nn|ne|n\.e\.|n\.n\.|nr|non rendu|non note)\.?$/.test(low)) return { v: 'disp' };
  s = s.replace(/\s+/g, '').replace(/\*+$/, '');
  const m = s.match(/^(-?\d+(?:[.,]\d+)?)(?:\/(\d+(?:[.,]\d+)?))?(?:\(.*\))?$/);
  if (!m) return { v: undefined };
  return { v: Number(m[1].replace(',', '.')), outOf: m[2] ? Number(m[2].replace(',', '.')) : null };
}
// Rang d'un élève : « 1 », « 2e », « 1er », « 3e ex » (vue Éditions d'École Directe).
const RANK = /^(\d+)\s*(er|re|e|è|ème|eme|°)?(\s*ex\.?(\s*(aequo|æquo))?)?(\s*\/\s*(\d+))?$/i;
const isRankLike = (c) => { const t = String(c || '').trim(); return RANK.test(t) && /[a-zè°/]/i.test(t) && !/[.,]/.test(t); };
// Lignes d'en-tête qui portent un libellé : « Coef », « Sur », « Barème », « Date »…
const META = /^(coef(ficient)?s?|sur|bar[èe]me|note sur|noté sur|date|max(imum)?)\b/i;
const metaKind = (r, nameCols) => {
  const label = r.slice(0, nameCols + 1).filter(Boolean).join(' ').trim();
  const m = label.match(META);
  if (!m) return null;
  const w = norm(m[1]);
  return w.startsWith('coef') ? 'coef' : w.startsWith('date') ? 'date' : 'max';
};
const isGradeLike = (c) => { const r = readCell(c); return r.v !== undefined && r.v !== null; };
const isEmptyish = (c) => readCell(c).v === null;

function splitCells(line) {
  if (line.includes('\t')) return line.split('\t');
  if (line.includes(';')) return line.split(';');
  return line.split(/\s{2,}/);
}

/** Retrouve l'élève de la classe correspondant à un nom collé (accents, ordre, initiale). */
export function matchStudent(cls, raw) {
  const p = parseStudentLine(raw);
  if (!p) return null;
  let best = null, bestSc = 0;
  for (const s of cls.students) {
    let sc;
    if (norm(s.first) === norm(p.first) && norm(s.last) === norm(p.last)) sc = 200;
    else if (norm(s.first) === norm(p.last) && norm(s.last) === norm(p.first)) sc = 190;
    else sc = Math.max(fuzzyScore(`${p.first} ${p.last}`, `${s.first} ${s.last}`), fuzzyScore(`${p.first} ${p.last}`, `${s.last} ${s.first}`));
    if (sc > bestSc) { bestSc = sc; best = s; }
  }
  return bestSc >= 60 ? best : null;
}

/**
 * Analyse le texte collé.
 * Retourne { columns: [{ title, max, coef, include }], rows: [{ name, st, cells: [valeur…] }] }
 */
export function parseGradeTable(text, cls) {
  let lines = text.split(/\r?\n/).map((l) => l.replace(/ /g, ' ')).filter((l) => l.trim());
  if (!lines.length) return { columns: [], rows: [] };
  let table = lines.map(splitCells).map((r) => r.map((c) => c.trim()));

  // Une seule colonne ? Format « Nom Prénom 15,5 » sur une ligne.
  if (table.every((r) => r.filter(Boolean).length <= 1)) {
    table = lines.map((l) => { const m = l.trim().match(/^(.*?)[\s:]+(\S+)\s*$/); return m && readCell(m[2]).v !== undefined ? [m[1], m[2]] : [l.trim()]; });
  }

  // Nombre de colonnes « nom » au début (1 ou 2 : NOM puis Prénom).
  const leadText = (r) => { let k = 0; while (k < r.length && r[k] && !isGradeLike(r[k]) && !isEmptyish(r[k]) && !isRankLike(r[k])) k++; return k; };
  const isData = (r) => r.some(isGradeLike) && !META.test(r.slice(0, 2).filter(Boolean).join(' ').trim());
  const dataRows = table.filter(isData);
  const counts = {};
  for (const r of dataRows) { const k = Math.min(3, leadText(r)); counts[k] = (counts[k] || 0) + 1; }
  const nameCols = Math.max(1, Number(Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || 1));

  // En-tête : toutes les lignes avant le premier élève (titre du devoir, coefficient, barème, date…).
  const firstData = table.findIndex(isData);
  const headRows = firstData > 0 ? table.slice(0, firstData) : [];
  const body = table.slice(Math.max(0, firstData)).filter((r) => r.some((c) => c) && !metaKind(r, nameCols));
  const metaRows = [...headRows, ...table.slice(Math.max(0, firstData)).filter((r) => metaKind(r, nameCols))];
  const width = Math.max(0, ...body.map((r) => r.length)) - nameCols;

  const rows = [];
  for (const r of body) {
    const name = r.slice(0, nameCols).filter(Boolean).join(' ').trim();
    if (!name || (ROW_SKIP.test(name) && !matchStudent(cls, name))) continue; // ligne « Moyenne de la classe »…
    rows.push({ name, st: matchStudent(cls, name), raw: r.slice(nameCols), cells: Array.from({ length: width }, (_, j) => readCell(r[nameCols + j])) });
  }

  // Positions parmi les colonnes réellement remplies (École Directe intercale des colonnes vides).
  const filled = Array.from({ length: width }, (_, j) => j).filter((j) => rows.some((r) => String(r.raw[j] || '').trim()));
  const pos = (j) => filled.indexOf(j);

  // Colonne « Rang » : à écarter (ce ne sont pas des notes).
  const headerText = (j) => metaRows.filter((r) => !metaKind(r, nameCols)).map((r) => (r[nameCols + j] || '').trim()).filter(Boolean);
  const isRankCol = (j) => {
    if (headerText(j).some((h) => /^(rang|rg\.?|classement)$/i.test(h))) return true;
    const raw = rows.map((r) => String(r.raw[j] || '').trim()).filter(Boolean);
    if (raw.length < 3) return false;
    const rl = raw.filter(isRankLike);
    if (rl.length / raw.length >= 0.6) {
      // « 3/28 » : on vérifie que c'est bien un rang (même total partout, valeurs différentes), pas une note sur 20.
      const totals = new Set(rl.map((x) => x.match(RANK)?.[7]).filter(Boolean));
      if (!totals.size || /[a-zè°]/i.test(rl.join(''))) return true;
      const tot = Number([...totals][0]);
      const ranks = rl.map((x) => Number(x.match(RANK)[1]));
      if (totals.size === 1 && tot >= rows.length * 0.6 && tot !== 20 && tot !== 10 && new Set(ranks).size / ranks.length >= 0.7) return true;
    }
    if (pos(j) < 0 || pos(j) > 2) return false; // un rang « nu » n'est cherché qu'au début, comme dans École Directe
    const nums = raw.map((x) => Number(x.match(RANK)?.[1])).filter((n) => Number.isInteger(n));
    if (nums.length < raw.length * 0.9) return false;
    const distinct = new Set(nums).size / nums.length;
    const hi = Math.max(...nums);
    return Math.min(...nums) === 1 && distinct >= 0.7 && hi <= rows.length + 1 && hi >= rows.length * 0.6 && !raw.some((x) => /[.,]/.test(x));
  };
  const rankCols = new Set(Array.from({ length: width }, (_, j) => j).filter(isRankCol));
  // Vue « Éditions » d'École Directe : Moyenne générale puis Rang, avant les devoirs. Tout ce qui précède le rang est écarté.
  const avgCols = new Set();
  for (const rc of rankCols) for (const j of filled) if (pos(j) < pos(rc)) avgCols.add(j);

  const columns = [];
  for (let j = 0; j < width; j++) {
    const vals = rows.map((r) => r.cells[j]).filter((c) => typeof c.v === 'number');
    const any = rows.some((r) => r.cells[j].v !== null && r.cells[j].v !== undefined);
    if (!any || rankCols.has(j) || avgCols.has(j)) { columns.push(null); continue; }
    const h = headerText(j).join(' — ');
    const metaVal = (kind) => { const r = metaRows.find((x) => metaKind(x, nameCols) === kind); return r ? String(r[nameCols + j] || '').trim().replace(',', '.') : ''; };
    const mCoef = metaVal('coef').match(/^\d+(\.\d+)?$/)?.[0];
    const mMax = metaVal('max').replace(/^\//, '').match(/^\d+(\.\d+)?$/)?.[0];
    const outOf = vals.find((c) => c.outOf)?.outOf;
    const hMax = h.match(/(?:\/|sur\s*)(\d+(?:[.,]\d+)?)/i)?.[1];
    const hCoef = h.match(/coef(?:ficient)?\.?\s*:?\s*(\d+(?:[.,]\d+)?)/i)?.[1] || h.match(/\(\s*x\s*(\d+(?:[.,]\d+)?)\s*\)/i)?.[1];
    const hi = Math.max(0, ...vals.map((c) => c.v));
    let max = outOf || (mMax ? Number(mMax) : hMax ? Number(hMax.replace(',', '.')) : hi <= 5 ? 5 : hi <= 10 ? 10 : 20);
    if (hi > max) max = hi <= 20 ? 20 : Math.ceil(hi);
    const title = h.replace(/\(?\s*(?:coef(?:ficient)?\.?\s*:?\s*\d+(?:[.,]\d+)?|x\s*\d+)\s*\)?/gi, '').replace(/(?:\/|sur\s*)\d+(?:[.,]\d+)?/i, '').trim();
    columns.push({ untitled: !title, title: title || `Évaluation ${columns.filter(Boolean).length + 1}`, max, coef: mCoef ? Number(mCoef) : hCoef ? Number(hCoef.replace(',', '.')) : 1, include: !SKIP_TITLE.test(h), skip: SKIP_TITLE.test(h), invalid: rows.filter((r) => r.cells[j].v === undefined).length });
  }
  // Colonne de moyenne sans titre (dans la vue Éditions d'École Directe : la 1re colonne après le rang).
  // On compare chaque colonne à la moyenne des autres notes de l'élève : si elles collent, c'est une moyenne.
  const real = columns.map((c, j) => (c && !c.skip ? j : -1)).filter((j) => j >= 0);
  const on20 = (j, r) => { const v = r.cells[j]?.v; return typeof v === 'number' ? (v / columns[j].max) * 20 : null; };
  const looksLikeAverage = (j, tol, share, minOthers) => {
    const others = real.filter((k) => k !== j);
    if (others.length < minOthers) return false;
    let close = 0, n = 0;
    for (const r of rows) {
      const v = on20(j, r);
      if (v == null) continue;
      let sw = 0, sum = 0;
      for (const k of others) { const x = on20(k, r); if (x != null) { sum += x * (columns[k].coef || 1); sw += columns[k].coef || 1; } }
      if (!sw) continue;
      n++;
      if (Math.abs(v - sum / sw) <= tol) close++;
    }
    return n >= 3 && close / n >= share;
  };
  const firstReal = real[0];
  for (const j of real) {
    const c = columns[j];
    const untitled = c.untitled;
    const isFirst = j === firstReal;
    if (untitled && ((isFirst && looksLikeAverage(j, 1.2, 0.8, 2)) || looksLikeAverage(j, 0.5, 0.9, 3))) {
      Object.assign(c, { title: 'Moyenne générale', include: false, skip: true });
    }
  }
  // Retire les colonnes vides en gardant l'alignement.
  const keep = columns.map((c, j) => (c ? j : -1)).filter((j) => j >= 0);
  return { columns: keep.map((j) => columns[j]), rows: rows.map(({ raw, ...r }) => ({ ...r, cells: keep.map((j) => r.cells[j]) })) };
}
