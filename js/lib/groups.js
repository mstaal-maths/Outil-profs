// Algorithme de constitution des groupes (recherche locale sous contraintes).
import { shuffle, randInt } from './util.js';

/** Tailles équilibrées : 26 élèves en groupes de 4 → [4,4,4,4,4,3,3]. */
export function sizesFor(n, { size, count }) {
  const k = count ? Math.max(1, Math.min(n, count)) : Math.max(1, Math.ceil(n / Math.max(1, size)));
  const base = Math.floor(n / k), extra = n % k;
  return Array.from({ length: k }, (_, i) => base + (i < extra ? 1 : 0));
}

const mean = (a) => a.reduce((x, y) => x + y, 0) / (a.length || 1);
const variance = (a) => { const m = mean(a); return mean(a.map((x) => (x - m) ** 2)); };

export function makeGroups({ ids, levels = {}, mode = 'random', size = 4, count = 0, constraints = { apart: [], together: [] } }) {
  const n = ids.length;
  if (!n) return [];
  const sizes = sizesFor(n, { size, count });
  const lv = (id) => levels[id] ?? 10;
  let order;
  if (mode === 'random') order = shuffle(ids);
  else order = shuffle(ids).sort((a, b) => lv(b) - lv(a)); // tri stable sur ordre aléatoire

  let groups = sizes.map(() => []);
  if (mode === 'hetero') {
    // Distribution « en serpentin » : 1→k puis k→1…
    let g = 0, dir = 1;
    for (const id of order) {
      while (groups[g].length >= sizes[g]) { g += dir; if (g >= sizes.length || g < 0) { dir = -dir; g += dir; } }
      groups[g].push(id);
      g += dir;
      if (g >= sizes.length || g < 0) { dir = -dir; g += dir; }
    }
  } else {
    let k = 0;
    for (let g = 0; g < sizes.length; g++) for (let j = 0; j < sizes[g]; j++) groups[g].push(order[k++]);
  }

  const apart = constraints.apart.filter(([a, b]) => ids.includes(a) && ids.includes(b));
  const together = constraints.together.filter(([a, b]) => ids.includes(a) && ids.includes(b));
  const globalMean = mean(ids.map(lv));

  const cost = (gs) => {
    const where = {};
    gs.forEach((g, i) => g.forEach((id) => { where[id] = i; }));
    let c = 0;
    for (const [a, b] of apart) if (where[a] === where[b]) c += 1000;
    for (const [a, b] of together) if (where[a] !== where[b]) c += 1000;
    if (mode === 'hetero') {
      for (const g of gs) c += (mean(g.map(lv)) - globalMean) ** 2 * 6 + Math.abs(variance(g.map(lv)) - variance(ids.map(lv))) * 0.3;
    } else if (mode === 'homo') {
      for (const g of gs) c += variance(g.map(lv)) * 4;
    }
    return c;
  };

  let cur = cost(groups);
  const iters = Math.min(6000, 400 + n * 160);
  for (let it = 0; it < iters && (cur > 0 || mode !== 'random'); it++) {
    const g1 = randInt(groups.length), g2 = randInt(groups.length);
    if (g1 === g2) continue;
    const i1 = randInt(groups[g1].length), i2 = randInt(groups[g2].length);
    const a = groups[g1][i1], b = groups[g2][i2];
    groups[g1][i1] = b; groups[g2][i2] = a;
    const c = cost(groups);
    const T = mode === 'random' ? 0 : Math.max(0.0001, 1 - it / iters) * 2;
    if (c <= cur || (T > 0 && Math.random() < Math.exp((cur - c) / T))) cur = c;
    else { groups[g1][i1] = a; groups[g2][i2] = b; }
    if (cur === 0 && mode === 'random') break;
  }
  if (mode === 'homo') groups.sort((x, y) => mean(y.map(lv)) - mean(x.map(lv)));
  return groups;
}

/** Liste des contraintes non respectées pour un découpage donné. */
export function violations(groups, constraints) {
  const where = {};
  groups.forEach((g, i) => g.forEach((id) => { where[id] = i; }));
  const out = [];
  for (const [a, b] of constraints.apart) if (where[a] != null && where[a] === where[b]) out.push({ type: 'apart', a, b });
  for (const [a, b] of constraints.together) if (where[a] != null && where[b] != null && where[a] !== where[b]) out.push({ type: 'together', a, b });
  return out;
}
