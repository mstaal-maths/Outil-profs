// Algorithmes des générateurs : mots croisés, mots mêlés, textes à trous, jeux.
import { shuffle, randInt, seeded } from '../lib/util.js';

/** Mot « de grille » : majuscules, sans accents ni espaces. */
export const gridWord = (w) => (w || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/Œ/gi, 'OE').replace(/Æ/gi, 'AE').toUpperCase().replace(/[^A-Z]/g, '');

/** Lit des lignes « mot : définition » (aussi « mot = déf », « mot ; déf » ou tabulation). */
export function parsePairs(text) {
  return (text || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((l) => {
    const m = l.match(/^(.*?)\s*(?:\t|\s:\s|:|=|;|\s[–—-]\s)\s*(.*)$/);
    return m ? { a: m[1].trim(), b: m[2].trim() } : { a: l, b: '' };
  });
}

// ---------- Mots croisés ----------
function sShuffle(a, rnd) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
export function crossword(entries, seed = 1, tries = 40) {
  const rnd = seeded(seed);
  const list = entries.map((e) => ({ ...e, w: gridWord(e.a) })).filter((e) => e.w.length >= 2);
  let best = null;
  for (let t = 0; t < tries; t++) {
    const order = t === 0 ? list.slice().sort((a, b) => b.w.length - a.w.length) : sShuffle(list, rnd).sort((a, b) => b.w.length - a.w.length - (rnd() < 0.35 ? 3 : 0));
    const r = buildCrossword(order, rnd);
    const score = r.placed.length * 1000 - r.area + r.crossings * 8;
    if (!best || score > best.score) best = { ...r, score };
    if (best.placed.length === list.length && t > 12) break;
  }
  return best;
}
function buildCrossword(words, rnd) {
  const g = new Map();
  const key = (x, y) => x + ',' + y;
  const placed = [];
  let crossings = 0;
  const canPlace = (w, x, y, dir) => {
    const dx = dir === 'H' ? 1 : 0, dy = dir === 'H' ? 0 : 1;
    if (g.has(key(x - dx, y - dy)) || g.has(key(x + dx * w.length, y + dy * w.length))) return -1;
    let inter = 0;
    for (let i = 0; i < w.length; i++) {
      const cx = x + dx * i, cy = y + dy * i;
      const c = g.get(key(cx, cy));
      if (c) { if (c.ch !== w[i] || c[dir]) return -1; inter++; }
      else if (g.has(key(cx + dy, cy + dx)) || g.has(key(cx - dy, cy - dx))) return -1;
    }
    return inter;
  };
  const put = (e, x, y, dir) => {
    const dx = dir === 'H' ? 1 : 0, dy = dir === 'H' ? 0 : 1;
    for (let i = 0; i < e.w.length; i++) {
      const k = key(x + dx * i, y + dy * i);
      const c = g.get(k) || { ch: e.w[i] };
      c[dir] = true; g.set(k, c);
    }
    placed.push({ ...e, x, y, dir });
  };
  words.forEach((e, idx) => {
    if (idx === 0) { put(e, 0, 0, 'H'); return; }
    let cand = [];
    for (const [k, c] of g) {
      const [cx, cy] = k.split(',').map(Number);
      for (let i = 0; i < e.w.length; i++) {
        if (e.w[i] !== c.ch) continue;
        for (const dir of ['H', 'V']) {
          if (c[dir]) continue;
          const x = dir === 'H' ? cx - i : cx, y = dir === 'H' ? cy : cy - i;
          const inter = canPlace(e.w, x, y, dir);
          if (inter > 0) cand.push({ x, y, dir, inter });
        }
      }
    }
    if (!cand.length) return;
    // On privilégie les croisements multiples et une grille compacte.
    const xs = [...g.keys()].map((k) => +k.split(',')[0]), ys = [...g.keys()].map((k) => +k.split(',')[1]);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    cand = cand.map((c) => {
      const ex = c.dir === 'H' ? c.x + e.w.length - 1 : c.x, ey = c.dir === 'V' ? c.y + e.w.length - 1 : c.y;
      const area = (Math.max(x1, ex) - Math.min(x0, c.x) + 1) * (Math.max(y1, ey) - Math.min(y0, c.y) + 1);
      return { ...c, s: c.inter * 30 - area * 0.4 + rnd() * 6 };
    }).sort((a, b) => b.s - a.s);
    const c = cand[0];
    crossings += c.inter;
    put(e, c.x, c.y, c.dir);
  });
  const xs = [...g.keys()].map((k) => +k.split(',')[0]), ys = [...g.keys()].map((k) => +k.split(',')[1]);
  const x0 = Math.min(...xs), y0 = Math.min(...ys);
  const W = Math.max(...xs) - x0 + 1, H = Math.max(...ys) - y0 + 1;
  // Numérotation : de gauche à droite, de haut en bas.
  const starts = new Map();
  placed.forEach((p) => { const k = key(p.x, p.y); if (!starts.has(k)) starts.set(k, []); starts.get(k).push(p); });
  const sortedStarts = [...starts.keys()].sort((a, b) => { const [ax, ay] = a.split(',').map(Number), [bx, by] = b.split(',').map(Number); return ay - by || ax - bx; });
  const numOf = new Map(sortedStarts.map((k, i) => [k, i + 1]));
  placed.forEach((p) => { p.num = numOf.get(key(p.x, p.y)); });
  const cells = (show) => Array.from({ length: H }, (_, y) => Array.from({ length: W }, (_, x) => {
    const c = g.get(key(x + x0, y + y0));
    if (!c) return { black: true, void: true };
    return { ch: show ? c.ch : '', num: numOf.get(key(x + x0, y + y0)) };
  }));
  return { placed, W, H, area: W * H, crossings, cells };
}

// ---------- Mots mêlés ----------
const DIRS = {
  facile: [[1, 0], [0, 1]],
  moyen: [[1, 0], [0, 1], [1, 1], [1, -1]],
  difficile: [[1, 0], [0, 1], [1, 1], [1, -1], [-1, 0], [0, -1], [-1, -1], [-1, 1]],
};
const FR_LETTERS = 'EEEEEEAAAAASSSSIIIINNNTTTTRRRRUUUULLLOOOODDDCCPPMMVQFBGHJXYZK';
export function wordSearch(words, { size, level = 'moyen', seed = Date.now() } = {}) {
  const rnd = seeded(seed);
  const ws = [...new Set(words.map(gridWord).filter((w) => w.length >= 2))].sort((a, b) => b.length - a.length);
  const n = Math.max(size || 0, Math.min(18, Math.max(10, (ws[0]?.length || 0) + 2, Math.ceil(Math.sqrt(ws.join('').length * 2.2)))));
  const grid = Array.from({ length: n }, () => Array(n).fill(''));
  const hl = Array.from({ length: n }, () => Array(n).fill(false));
  const dirs = DIRS[level] || DIRS.moyen;
  const placed = [], missing = [];
  for (const w of ws) {
    let ok = false;
    for (let t = 0; t < 400 && !ok; t++) {
      const [dx, dy] = dirs[Math.floor(rnd() * dirs.length)];
      const x = Math.floor(rnd() * n), y = Math.floor(rnd() * n);
      const ex = x + dx * (w.length - 1), ey = y + dy * (w.length - 1);
      if (ex < 0 || ex >= n || ey < 0 || ey >= n) continue;
      let fits = true;
      for (let i = 0; i < w.length; i++) { const c = grid[y + dy * i][x + dx * i]; if (c && c !== w[i]) { fits = false; break; } }
      if (!fits) continue;
      for (let i = 0; i < w.length; i++) { grid[y + dy * i][x + dx * i] = w[i]; hl[y + dy * i][x + dx * i] = true; }
      placed.push(w); ok = true;
    }
    if (!ok) missing.push(w);
  }
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (!grid[y][x]) grid[y][x] = FR_LETTERS[Math.floor(rnd() * FR_LETTERS.length)];
  return { n, placed, missing, cells: (show) => grid.map((row, y) => row.map((ch, x) => ({ ch, hl: show && hl[y][x] }))) };
}

// ---------- Texte à trous ----------
/** Le texte contient des [mots entre crochets] : ce sont les trous. */
export function clozeRuns(text, showAnswers) {
  const out = [];
  const re = /\[([^\]]+)\]/g;
  let last = 0, m;
  const words = [];
  while ((m = re.exec(text))) {
    if (m.index > last) out.push({ text: text.slice(last, m.index) });
    out.push({ blank: true, len: m[1].length + 3, answer: showAnswers ? m[1] : '' });
    words.push(m[1]);
    last = re.lastIndex;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return { runs: out, words };
}

// ---------- Plateau du jeu de l'oie (SVG) ----------
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export function gooseBoard({ count = 40, specials = {}, title = '' }) {
  const cols = 8;
  const rows = Math.ceil(count / cols);
  const cw = 70, ch = 62, pad = 14, top = title ? 40 : 14;
  const W = cols * cw + pad * 2, H = rows * ch + top + pad;
  const cells = [];
  for (let i = 0; i < count; i++) {
    const r = Math.floor(i / cols);
    const k = r % 2 === 0 ? i % cols : cols - 1 - (i % cols);
    cells.push({ i: i + 1, x: pad + k * cw, y: top + (rows - 1 - r) * ch });
  }
  const tone = { rejoue: '#dff3e8', recule: '#fde2df', pause: '#fff1c7', depart: '#e6e9fb', arrivee: '#e6e9fb', question: '#ffffff' };
  const label = { rejoue: ['Rejoue !'], recule: ['Recule', 'de 3'], pause: ['Passe', 'un tour'], depart: ['DÉPART'], arrivee: ['ARRIVÉE'] };
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="Arial, Helvetica, sans-serif">`;
  svg += `<rect x="0" y="0" width="${W}" height="${H}" fill="#ffffff"/>`;
  if (title) svg += `<text x="${W / 2}" y="26" text-anchor="middle" font-size="18" font-weight="700" fill="#1a1d36">${esc(title)}</text>`;
  // Chemin qui relie les cases
  svg += `<polyline fill="none" stroke="#c9cfee" stroke-width="10" stroke-linecap="round" stroke-linejoin="round" points="${cells.map((c) => `${c.x + cw / 2},${c.y + ch / 2}`).join(' ')}"/>`;
  for (const c of cells) {
    const kind = c.i === 1 ? 'depart' : c.i === count ? 'arrivee' : specials[c.i] || 'question';
    svg += `<rect x="${c.x + 4}" y="${c.y + 4}" width="${cw - 8}" height="${ch - 8}" rx="10" fill="${tone[kind]}" stroke="#2e44c9" stroke-width="1.6"/>`;
    svg += `<text x="${c.x + 12}" y="${c.y + 21}" font-size="13" font-weight="700" fill="#2e44c9">${c.i}</text>`;
    if (label[kind]) label[kind].forEach((l, j, a) => { svg += `<text x="${c.x + cw / 2}" y="${c.y + ch / 2 + (a.length > 1 ? 6 + j * 12 : 12)}" text-anchor="middle" font-size="11" font-weight="700" fill="#1a1d36">${l}</text>`; });
    else svg += `<text x="${c.x + cw / 2}" y="${c.y + ch / 2 + 12}" text-anchor="middle" font-size="16" fill="#686c84">?</text>`;
  }
  svg += '</svg>';
  return { svg, ratio: H / W };
}

/** Cases spéciales réparties régulièrement (sans toucher au départ ni à l'arrivée). */
export function defaultSpecials(count) {
  const s = {};
  const kinds = ['rejoue', 'recule', 'pause'];
  let k = 0;
  for (let i = 6; i < count - 1; i += 6) { s[i] = kinds[k % 3]; k++; }
  return s;
}

// ---------- Dominos (SVG, une planche par page) ----------
function wrap(text, max) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > max && cur) { lines.push(cur); cur = w; } else cur = (cur + ' ' + w).trim();
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 4);
}
export function dominoSheets(pairs, perPage = 12, seed = 1) {
  // Domino i : à gauche la réponse de la paire précédente, à droite la question i. La chaîne boucle.
  const n = pairs.length;
  const dominos = pairs.map((p, i) => ({ left: pairs[(i - 1 + n) % n].b, right: p.a, start: i === 0 }));
  const order = sShuffle(dominos.map((d, i) => ({ ...d, i })), seeded(seed));
  const sheets = [];
  const W = 520, dw = 250, dh = 90, gap = 20;
  for (let p = 0; p < order.length; p += perPage) {
    const page = order.slice(p, p + perPage);
    const rows = Math.ceil(page.length / 2);
    const H = rows * (dh + gap);
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="Arial, Helvetica, sans-serif"><rect width="${W}" height="${H}" fill="#fff"/>`;
    page.forEach((d, k) => {
      const x = (k % 2) * (dw + gap), y = Math.floor(k / 2) * (dh + gap);
      svg += `<rect x="${x + 1}" y="${y + 1}" width="${dw - 2}" height="${dh - 2}" rx="12" fill="#fff" stroke="#1a1d36" stroke-width="1.6" stroke-dasharray="6 4"/>`;
      svg += `<line x1="${x + dw / 2}" y1="${y + 10}" x2="${x + dw / 2}" y2="${y + dh - 10}" stroke="#1a1d36" stroke-width="2"/>`;
      [[d.left, x + dw / 4], [d.right, x + (3 * dw) / 4]].forEach(([t, cx], side) => {
        const lines = wrap(t, 17);
        const y0 = y + dh / 2 - ((lines.length - 1) * 14) / 2 + 4;
        lines.forEach((l, j) => { svg += `<text x="${cx}" y="${y0 + j * 14}" text-anchor="middle" font-size="${side ? 12.5 : 12.5}" font-weight="${side ? 700 : 400}" fill="#1a1d36">${esc(l)}</text>`; });
      });
      if (d.start) svg += `<text x="${x + 12}" y="${y + 18}" font-size="9" font-weight="700" fill="#d93b30">DÉBUT</text>`;
    });
    svg += '</svg>';
    sheets.push({ svg, ratio: H / W });
  }
  return sheets;
}

/** Jeu « J'ai… Qui a… ? » : chaque carte donne une réponse puis pose la question suivante. */
export function chainCards(pairs, seed = 1) {
  const n = pairs.length;
  return sShuffle(pairs.map((p, i) => ({ text: `J’ai : ${pairs[i].b}`, sub: `Qui a : ${pairs[(i + 1) % n].a} ?`, size: 15, subSize: 13 })), seeded(seed));
}

export { sShuffle };
