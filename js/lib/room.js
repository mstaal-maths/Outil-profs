// Géométrie de la salle et placement automatique pour le plan de classe.
import { uid, shuffle, randInt } from './util.js';

// Unités : 1 = 1 cm environ. Une place = 64 × 52.
export const SEAT_W = 64;
export const SEAT_H = 52;
export const GRID = 8;

/** Une table : position du centre, rotation, et grille de places (cols × rows). */
export function table(x, y, cols = 2, rows = 1, rot = 0) { return { id: uid('t'), x, y, cols, rows, rot }; }

export const PRESETS = {
  rangees: { label: 'Rangées', desc: 'Tables de deux face au tableau', icon: 'list' },
  ilots: { label: 'Îlots', desc: 'Groupes de 4 ou 6 tables', icon: 'layout-grid' },
  u: { label: 'En U', desc: 'Fer à cheval, idéal pour débattre', icon: 'move' },
  examen: { label: 'Examen', desc: 'Tables individuelles espacées', icon: 'grid-3x3' },
  libre: { label: 'Salle vide', desc: 'Vous placez tout vous-même', icon: 'pencil' },
};

// Éléments de la salle (hors tables) : dimensions par défaut en cm environ.
export const ITEM_TYPES = {
  board: { label: 'Tableau', w: 300, h: 20 },
  desk: { label: 'Bureau', w: 120, h: 60 },
  door: { label: 'Porte', w: 90, h: 14 },
  window: { label: 'Fenêtre', w: 160, h: 10 },
  cabinet: { label: 'Armoire', w: 110, h: 45 },
};
export function item(type, x, y, rot = 0, w, h) {
  const d = ITEM_TYPES[type];
  return { id: uid('i'), type, x, y, rot, w: w ?? d.w, h: h ?? d.h };
}
/** Tableau et bureau par défaut, placés devant les tables. */
export function defaultItems(tables) {
  const b = bounds(tables);
  const top = Math.min(b.y, 120);
  const cx = tables.length ? b.x + b.w / 2 : 0;
  return [item('board', cx, top - 80), item('desk', Math.max(b.x + b.w, 200) - 60, top - 20)];
}
/** Les plans créés avant l'arrivée des éléments libres en reçoivent automatiquement. */
export function ensureItems(plan) {
  if (!plan.items) plan.items = defaultItems(plan.tables);
  return plan;
}
export const boardOf = (items = []) => items.find((i) => i.type === 'board');

/** Génère une salle complète à partir d'un modèle et de quelques réglages. */
export function buildLayout(kind, o = {}) {
  const tables = [];
  if (kind === 'rangees') {
    const rows = o.rows ?? 5, perRow = o.perRow ?? 3, seats = o.seats ?? 2;
    const tw = seats * SEAT_W, gap = o.aisle ?? 56;
    const totalW = perRow * tw + (perRow - 1) * gap;
    for (let r = 0; r < rows; r++) for (let t = 0; t < perRow; t++)
      tables.push(table(-totalW / 2 + tw / 2 + t * (tw + gap), 150 + r * (SEAT_H + 54), seats, 1));
  } else if (kind === 'ilots') {
    const n = o.islands ?? 6, size = o.islandSize ?? 4;
    const cols = size === 6 ? 3 : 2;
    const perLine = o.perLine ?? 3;
    const iw = cols * SEAT_W, ih = 2 * SEAT_H, gx = 80, gy = 70;
    const lines = Math.ceil(n / perLine);
    for (let i = 0; i < n; i++) {
      const line = Math.floor(i / perLine), k = i % perLine;
      const inLine = Math.min(perLine, n - line * perLine);
      const w = inLine * iw + (inLine - 1) * gx;
      tables.push(table(-w / 2 + iw / 2 + k * (iw + gx), 160 + line * (ih + gy), cols, 2));
    }
    void lines;
  } else if (kind === 'u') {
    const side = o.side ?? 5, back = o.back ?? 4;
    const w = back * SEAT_W + 2 * SEAT_H + 40;
    const top = 160;
    for (let i = 0; i < side; i++) {
      tables.push(table(-w / 2 + SEAT_H / 2, top + i * SEAT_W, 1, 1, 90));
      tables.push(table(w / 2 - SEAT_H / 2, top + i * SEAT_W, 1, 1, 270));
    }
    const by = top + side * SEAT_W - SEAT_W / 2 + SEAT_H / 2 + 12;
    for (let i = 0; i < back; i++) tables.push(table(-((back - 1) * SEAT_W) / 2 + i * SEAT_W, by, 1, 1, 0));
    // Rangée intérieure optionnelle
    if (o.inner) {
      const iw = (back - 2) * SEAT_W;
      for (let i = 0; i < back - 2; i++) tables.push(table(-iw / 2 + SEAT_W / 2 + i * SEAT_W, top + 120, 1, 1, 0));
    }
  } else if (kind === 'examen') {
    const rows = o.rows ?? 6, perRow = o.perRow ?? 5;
    const gap = 46;
    const totalW = perRow * SEAT_W + (perRow - 1) * gap;
    for (let r = 0; r < rows; r++) for (let t = 0; t < perRow; t++)
      tables.push(table(-totalW / 2 + SEAT_W / 2 + t * (SEAT_W + gap), 150 + r * (SEAT_H + 44), 1, 1));
  }
  // 'libre' : aucune table, le professeur construit sa salle.
  return tables;
}

export function capacity(tables) { return tables.reduce((a, t) => a + t.cols * t.rows, 0); }

/** Toutes les places, avec leur position dans la salle (texte toujours horizontal). */
export function seatsOf(tables) {
  const out = [];
  for (const t of tables) {
    const a = (t.rot * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
    const w = t.cols * SEAT_W, h = t.rows * SEAT_H;
    for (let r = 0; r < t.rows; r++) for (let k = 0; k < t.cols; k++) {
      const lx = -w / 2 + SEAT_W / 2 + k * SEAT_W, ly = -h / 2 + SEAT_H / 2 + r * SEAT_H;
      out.push({ id: `${t.id}:${r * t.cols + k}`, table: t.id, x: t.x + lx * c - ly * s, y: t.y + lx * s + ly * c, r, k });
    }
  }
  return out;
}

export function bounds(tables, items = []) {
  const shapes = [...tables.map((t) => ({ x: t.x, y: t.y, rot: t.rot, w: t.cols * SEAT_W, h: t.rows * SEAT_H + 40 })), ...items];
  if (!shapes.length) return { x: -300, y: 100, w: 600, h: 400 };
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const t of shapes) {
    const a = (t.rot * Math.PI) / 180;
    const w = t.w, h = t.h;
    const ex = Math.abs(Math.cos(a)) * w / 2 + Math.abs(Math.sin(a)) * h / 2;
    const ey = Math.abs(Math.sin(a)) * w / 2 + Math.abs(Math.cos(a)) * h / 2;
    x0 = Math.min(x0, t.x - ex); x1 = Math.max(x1, t.x + ex);
    y0 = Math.min(y0, t.y - ey); y1 = Math.max(y1, t.y + ey);
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** Voisinage : même table et côte à côte (fort), ou tables contiguës (faible). */
export function neighbors(seats) {
  const nb = new Map(seats.map((s) => [s.id, []]));
  for (let i = 0; i < seats.length; i++) for (let j = i + 1; j < seats.length; j++) {
    const a = seats[i], b = seats[j];
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    let w = 0;
    if (a.table === b.table && d < SEAT_W * 1.2) w = 1;
    else if (a.table === b.table && d < SEAT_W * 1.6) w = 0.6;
    else if (d < SEAT_W * 1.15) w = 0.7;
    else if (d < SEAT_W * 1.7) w = 0.25;
    if (w) { nb.get(a.id).push([b.id, w]); nb.get(b.id).push([a.id, w]); }
  }
  return nb;
}

/**
 * Placement automatique.
 * strategy : 'random' | 'alpha' | 'hetero' (binômes de niveaux différents)
 * mixGender : alterner filles et garçons (se combine avec le hasard ou les binômes de niveaux)
 * Respecte : places verrouillées, « ne pas mettre ensemble », « mettre ensemble », « devant ».
 */
export function autoPlace({ items = [], tables, students, assign = {}, locked = [], strategy = 'random', constraints, levels = {}, fillFront = true, mixGender = false }) {
  const seats = seatsOf(tables);
  const nb = neighbors(seats);
  const lockedSet = new Set(locked.filter((sid) => assign[sid]));
  const result = {};
  for (const seatId of lockedSet) result[seatId] = assign[seatId];
  const placedLocked = new Set(Object.values(result));
  const free = seats.filter((s) => !lockedSet.has(s.id));
  let pool = students.map((s) => s.id).filter((id) => !placedLocked.has(id));
  if (strategy === 'alpha') {
    const byId = Object.fromEntries(students.map((s) => [s.id, s]));
    pool.sort((a, b) => (byId[a].last || byId[a].first).localeCompare(byId[b].last || byId[b].first, 'fr'));
  } else pool = shuffle(pool);

  // Ordre des places : de l'avant vers l'arrière, de gauche à droite.
  // « Devant » = près du tableau, où qu'il soit dans la salle.
  const board = boardOf(items);
  const dist = (s) => (board ? Math.hypot(s.x - board.x, s.y - board.y) : s.y);
  const order = free.slice().sort((a, b) => dist(a) - dist(b) || a.x - b.x);
  const dMin = Math.min(...seats.map(dist)), dSpan = Math.max(1, Math.max(...seats.map(dist)) - dMin);
  const frontness = Object.fromEntries(seats.map((s) => [s.id, (dist(s) - dMin) / dSpan]));

  // Si moins d'élèves que de places : on remplit l'avant d'abord, en gardant les binômes.
  let target = order;
  if (fillFront && pool.length < order.length) target = order.slice(0, pool.length);
  else if (pool.length < order.length) target = shuffle(order).slice(0, pool.length);
  const cur = {};
  target.forEach((s, i) => { if (pool[i]) cur[s.id] = pool[i]; });
  if (strategy === 'alpha') return { ...result, ...cur };

  const front = new Set(constraints.front || []);
  const apart = constraints.apart || [], together = constraints.together || [];
  const byId = Object.fromEntries(students.map((s) => [s.id, s]));
  const lv = (id) => levels[id] ?? 10;

  const cost = (a) => {
    const where = {};
    for (const [seat, sid] of Object.entries(a)) where[sid] = seat;
    const isNb = (x, y) => { const sx = where[x], sy = where[y]; if (!sx || !sy) return 0; return (nb.get(sx).find(([id]) => id === sy) || [0, 0])[1]; };
    let c = 0;
    for (const [x, y] of apart) c += isNb(x, y) * 400;
    for (const [x, y] of together) if (where[x] && where[y]) c += (1 - Math.min(1, isNb(x, y))) * 300;
    for (const id of front) if (where[id]) c += frontness[where[id]] * 260;
    if (strategy === 'hetero' || mixGender) {
      for (const [seat, sid] of Object.entries(a)) for (const [o, w] of nb.get(seat)) {
        if (w < 0.6) continue;
        const other = a[o];
        if (!other || other < sid) continue;
        if (strategy === 'hetero') c += Math.max(0, 5 - Math.abs(lv(sid) - lv(other))) * 6 * w;
        if (mixGender && byId[sid]?.g && byId[sid].g === byId[other]?.g) c += 20 * w;
      }
    }
    return c;
  };

  const all = { ...result, ...cur };
  let best = cost(all);
  const keys = target.map((s) => s.id);
  const iters = 3000 + keys.length * 120;
  for (let it = 0; it < iters && keys.length > 1; it++) {
    const i = keys[randInt(keys.length)], j = keys[randInt(keys.length)];
    if (i === j) continue;
    [all[i], all[j]] = [all[j], all[i]];
    const c = cost(all);
    const T = (1 - it / iters) * 6;
    if (c <= best || Math.random() < Math.exp((best - c) / Math.max(T, 0.01))) best = c;
    else [all[i], all[j]] = [all[j], all[i]];
  }
  for (const k of Object.keys(all)) if (!all[k]) delete all[k];
  return all;
}

/** Contraintes violées dans un plan (pour les signaler visuellement). */
export function planViolations(tables, assign, constraints) {
  const seats = seatsOf(tables);
  const nb = neighbors(seats);
  const where = {};
  for (const [seat, sid] of Object.entries(assign)) where[sid] = seat;
  const out = new Set();
  for (const [a, b] of constraints.apart || []) {
    if (where[a] && where[b] && nb.get(where[a])?.some(([id, w]) => id === where[b] && w >= 0.6)) { out.add(a); out.add(b); }
  }
  return out;
}

export function newPlan(name = 'Salle principale', kind = 'rangees', opts) {
  const tables = buildLayout(kind, opts || {});
  if (kind === 'libre') {
    // Salle vide aux dimensions réalistes (9 m × 7 m), murs réglables.
    const room = { w: 900, h: 700 };
    return { id: uid('p_'), name, kind, opts: {}, room, tables, items: [item('board', 0, 26), item('desk', room.w / 2 - 130, 110)], assign: {}, locked: [], view: 'eleves' };
  }
  return { id: uid('p_'), name, kind, opts: opts || {}, tables, items: defaultItems(tables), assign: {}, locked: [], view: 'eleves' };
}

/** Propose une salle adaptée au nombre d'élèves. */
export function suggestOpts(kind, n) {
  if (kind === 'rangees') { const perRow = n > 24 ? 3 : 3; return { rows: Math.max(3, Math.ceil(n / (perRow * 2))), perRow, seats: 2 }; }
  if (kind === 'ilots') { const size = n > 28 ? 6 : 4; return { islands: Math.max(2, Math.ceil(n / size)), islandSize: size, perLine: size === 6 ? 2 : 3 }; }
  if (kind === 'u') { const back = Math.max(3, Math.min(7, Math.round(n / 4))); return { side: Math.max(3, Math.ceil((n - back) / 2)), back }; }
  if (kind === 'examen') { const perRow = 5; return { rows: Math.max(3, Math.ceil(n / perRow)), perRow }; }
  if (kind === 'libre') return {};
  return {};
}
