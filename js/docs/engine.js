// ==========================================================================
// Moteur de documents imprimables : un même modèle → aperçu HTML, PDF, Word.
//
// Un document = { title, subtitle, fields, blocks: [...] }
// Blocs :
//   { t: 'h', text }                         titre de partie
//   { t: 'p', runs: [{ text, b, i, blank }] } paragraphe (blank = trou à compléter)
//   { t: 'keep', items: [blocs] }            groupe JAMAIS coupé entre deux pages
//   { t: 'choices', items: [{ text, ok }], cols, showAnswers }
//   { t: 'lines', n }                        lignes pour répondre
//   { t: 'grid', cells: [[{ ch, num, black, hl }]], size }  grille (mots croisés, mêlés)
//   { t: 'table', head, rows, widths }       tableau
//   { t: 'cards', cards: [{ text, sub }], cols, rows, height } planche de cartes à découper
//   { t: 'svg', svg, width }                 dessin (plateau de jeu)
//   { t: 'wordbank', words }                 banque de mots
//   { t: 'break' }                           saut de page
// ==========================================================================

const PT = 1; // unité pdfmake = point
export const A4 = { w: 595.28, h: 841.89, margin: 42 };

export function styleFor(dys) {
  return dys
    ? { font: 'Arimo', wordFont: 'Arial', size: 14, lh: 1.5, small: 12, h: 16, title: 22 }
    : { font: 'Atkinson', wordFont: 'Calibri', size: 11, lh: 1.25, small: 9, h: 13, title: 20 };
}

// ---------- Chargement paresseux des bibliothèques ----------
let pdfReady = null;
const loadedFonts = new Set();
function loadScript(src) {
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src; s.onload = res; s.onerror = () => rej(new Error('Chargement impossible : ' + src));
    document.head.appendChild(s);
  });
}
async function fetchB64(url) {
  const buf = await (await fetch(url)).arrayBuffer();
  let s = '';
  const b = new Uint8Array(buf);
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s);
}
const FONT_FILES = {
  Atkinson: ['AtkinsonHyperlegible_400Regular', 'AtkinsonHyperlegible_700Bold', 'AtkinsonHyperlegible_400Regular_Italic', 'AtkinsonHyperlegible_700Bold_Italic'],
  Arimo: ['Arimo_400Regular', 'Arimo_700Bold', 'Arimo_400Regular_Italic', 'Arimo_700Bold_Italic'],
};
async function pdfMakeWith(font) {
  if (!pdfReady) pdfReady = loadScript(new URL('../vendor/pdfmake.min.js', import.meta.url).href);
  await pdfReady;
  const pm = window.pdfMake;
  if (!loadedFonts.has(font)) {
    const files = FONT_FILES[font];
    const vfs = {};
    await Promise.all(files.map(async (f) => { vfs[f + '.ttf'] = await fetchB64(new URL(`../../assets/fonts/pdf/${f}.ttf`, import.meta.url).href); }));
    pm.addVirtualFileSystem(vfs);
    loadedFonts.add(font);
    const all = {};
    for (const k of loadedFonts) { const [n, b, i, bi] = FONT_FILES[k]; all[k] = { normal: n + '.ttf', bold: b + '.ttf', italics: i + '.ttf', bolditalics: bi + '.ttf' }; }
    pm.addFonts(all);
  }
  return pm;
}

// ---------- PDF ----------
const escX = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;');
export function gridSvg(cells, cs) {
  const n = cells[0].length, m = cells.length;
  let o = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-1 -1 ${n * cs + 2} ${m * cs + 2}" width="${n * cs + 2}" height="${m * cs + 2}">`;
  cells.forEach((row, y) => row.forEach((c, x) => {
    if (c.void) return;
    const X = x * cs, Y = y * cs;
    o += `<rect x="${X}" y="${Y}" width="${cs}" height="${cs}" fill="${c.black ? '#222' : c.hl ? '#e6e9fb' : '#fff'}" stroke="#333" stroke-width="0.8"/>`;
    if (c.num) o += `<text x="${X + 1.6}" y="${Y + cs * 0.3}" font-family="Helvetica" font-size="${Math.max(5, cs * 0.27)}" font-weight="bold" fill="#333">${c.num}</text>`;
    if (c.ch && !c.black) o += `<text x="${X + cs / 2}" y="${Y + cs * 0.72}" text-anchor="middle" font-family="Helvetica" font-size="${cs * 0.55}" font-weight="${c.hl ? 'bold' : 'normal'}" fill="${c.hl ? '#1c2fb0' : '#111'}">${escX(c.ch)}</text>`;
  }));
  return o + '</svg>';
}
const box = (checked, size) => ({
  canvas: [
    { type: 'rect', x: 0, y: 1, w: size, h: size, r: 1, lineWidth: 1, lineColor: '#333' },
    ...(checked ? [{ type: 'polyline', lineWidth: 1.8, lineColor: '#000', points: [{ x: size * 0.2, y: size * 0.55 + 1 }, { x: size * 0.42, y: size * 0.78 + 1 }, { x: size * 0.82, y: size * 0.22 + 1 }] }] : []),
  ],
  width: size + 6,
});
function runsPdf(runs, st) {
  return runs.map((r) => (r.blank
    ? { text: r.answer ? r.answer : ' '.repeat(Math.max(6, r.len || 12)), decoration: 'underline', decorationStyle: r.answer ? undefined : 'solid', bold: !!r.answer, color: r.answer ? '#1c2fb0' : '#000', preserveLeadingSpaces: true }
    : { text: r.text, bold: !!r.b, italics: !!r.i }));
}
function blockPdf(b, st, width) {
  switch (b.t) {
    case 'h': return { text: b.text, bold: true, fontSize: st.h, margin: [0, 10, 0, 4] };
    case 'p': return { text: runsPdf(b.runs || [{ text: b.text || '' }], st), margin: [0, 0, 0, 4] };
    case 'keep': return { stack: b.items.map((x) => blockPdf(x, st, width)), unbreakable: true, margin: [0, 4, 0, 8] };
    case 'choices': {
      const cols = b.cols || 1;
      const cells = b.items.map((c, i) => ({ columns: [box(b.showAnswers && c.ok, st.size * 0.85), { text: [{ text: String.fromCharCode(97 + i) + ') ', bold: true }, { text: c.text, bold: b.showAnswers && c.ok }] }], columnGap: 2, margin: [0, 2, 0, 2] }));
      if (cols === 1) return { stack: cells, margin: [8, 0, 0, 2] };
      const rows = [];
      for (let i = 0; i < cells.length; i += cols) rows.push(Array.from({ length: cols }, (_, k) => cells[i + k] || {}));
      return { table: { widths: Array(cols).fill('*'), body: rows }, layout: 'noBorders', margin: [8, 0, 0, 2] };
    }
    case 'lines': return { canvas: Array.from({ length: b.n || 2 }, (_, i) => ({ type: 'line', x1: 0, y1: (i + 1) * st.size * 2, x2: width, y2: (i + 1) * st.size * 2, lineWidth: 0.6, lineColor: '#999', dash: { length: 2, space: 2 } })), margin: [0, 0, 0, 6] };
    case 'grid': {
      // Grille dessinée en SVG : placement exact des numéros et des lettres.
      const n = b.cells[0].length, m = b.cells.length;
      const cs = Math.min(b.size || 22, (width - 2) / n);
      return { svg: gridSvg(b.cells, cs), width: n * cs + 2, alignment: 'center', margin: [0, 4, 0, 10] };
    }
    case 'table': {
      const ncol = (b.head || b.rows[0]).length;
      // Largeurs données en proportions (ex. [2, 4, 4]) → points réels, marges des cellules déduites.
      const rel = b.widths && b.widths.every((x) => typeof x === 'number') ? b.widths : Array(ncol).fill(1);
      const sum = rel.reduce((a, c) => a + c, 0);
      const widths = rel.map((x) => (x / sum) * (width - ncol * 13) );
      return {
      table: { headerRows: b.head ? 1 : 0, keepWithHeaderRows: b.head ? 1 : 0, widths, dontBreakRows: true,
        body: [...(b.head ? [b.head.map((h) => ({ text: h, bold: true, fillColor: '#eef0fa' }))] : []), ...b.rows.map((r) => r.map((c) => (typeof c === 'string' ? { text: c } : c)))] },
      layout: { hLineColor: () => '#999', vLineColor: () => '#999', paddingTop: () => 5, paddingBottom: () => 5, paddingLeft: () => 6, paddingRight: () => 6 }, margin: [0, 4, 0, 8],
    }; }
    case 'cards': {
      const cols = b.cols, rows = b.rows, h = b.height;
      const per = cols * rows;
      const out = [];
      for (let p = 0; p < b.cards.length; p += per) {
        const page = b.cards.slice(p, p + per);
        const body = [];
        for (let r = 0; r < rows; r++) body.push(Array.from({ length: cols }, (_, k) => {
          const c = page[r * cols + k];
          return c ? { stack: [{ text: c.text, alignment: 'center', bold: !c.plain, fontSize: c.size || st.size + 3 }, ...(c.sub ? [{ text: c.sub, alignment: 'center', fontSize: c.subSize || st.small, bold: !!c.subSize, color: c.subSize ? '#1a1d36' : '#555', margin: [0, 6, 0, 0] }] : [])], margin: [6, 0, 6, 0] } : { text: '' };
        }));
        out.push({
          table: { widths: Array(cols).fill((A4.w - 2 * A4.margin) / cols - 12.5), heights: () => h, body: body.map((row) => row.map((cell) => ({ ...cell, verticalAlignment: 'middle' }))), dontBreakRows: true },
          layout: { hLineWidth: () => 0.6, vLineWidth: () => 0.6, hLineColor: () => '#999', vLineColor: () => '#999', hLineStyle: () => ({ dash: { length: 4, space: 3 } }), vLineStyle: () => ({ dash: { length: 4, space: 3 } }) },
          ...(p + per < b.cards.length ? { pageBreak: 'after' } : {}),
        });
      }
      return { stack: out };
    }
    case 'svg': return { svg: b.svg, width: Math.min(width, b.width || width), alignment: 'center', margin: [0, 4, 0, 8] };
    case 'wordbank': return { table: { widths: ['*'], body: [[{ text: b.words.join('   •   '), alignment: 'center', margin: [6, 6, 6, 6] }]] }, layout: { hLineColor: () => '#999', vLineColor: () => '#999' }, margin: [0, 4, 0, 10] };
    case 'break': return { text: '', pageBreak: 'after' };
    default: return { text: '' };
  }
}
export function pdfDefinition(doc, dys) {
  const st = styleFor(dys);
  const width = A4.w - 2 * A4.margin;
  const head = [];
  if (doc.title) head.push({ text: doc.title, fontSize: st.title, bold: true, margin: [0, 0, 0, 2] });
  if (doc.subtitle) head.push({ text: doc.subtitle, color: '#444', margin: [0, 0, 0, 6] });
  if (doc.fields) head.push({ text: 'Nom : ____________________   Prénom : ____________________   Classe : ________   Date : ____________', fontSize: st.small + 1, margin: [0, 6, 0, 12] });
  return {
    pageSize: 'A4', pageMargins: [A4.margin, A4.margin, A4.margin, A4.margin + 6],
    info: { title: doc.title || 'Document', creator: 'Trousse' },
    defaultStyle: { font: st.font, fontSize: st.size, lineHeight: st.lh },
    footer: (page, count) => (count > 1 ? { text: `${page} / ${count}`, alignment: 'center', fontSize: 8, color: '#888', margin: [0, 10, 0, 0] } : null),
    content: [...head, ...doc.blocks.map((b) => blockPdf(b, st, width))],
  };
}
export async function toPdfBlob(doc, dys) {
  const pm = await pdfMakeWith(dys ? 'Arimo' : 'Atkinson');
  const p = pm.createPdf(pdfDefinition(doc, dys));
  return new Promise((res, rej) => { try { const r = p.getBlob(res); if (r && r.then) r.then(res, rej); } catch (e) { rej(e); } });
}

// ---------- Word (.docx) ----------
let docxLib = null;
async function svgToPng(svg, w, h) {
  const img = new Image();
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  await new Promise((r, j) => { img.onload = r; img.onerror = j; img.src = url; });
  const c = document.createElement('canvas');
  c.width = w * 2; c.height = h * 2;
  const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
  g.drawImage(img, 0, 0, c.width, c.height);
  URL.revokeObjectURL(url);
  return new Uint8Array(await (await new Promise((r) => c.toBlob(r, 'image/png'))).arrayBuffer());
}
export async function toDocxBlob(doc, dys) {
  if (!docxLib) docxLib = await import('../vendor/docx.js');
  const D = docxLib;
  const st = styleFor(dys);
  const sz = st.size * 2; // demi-points
  const spacing = { line: Math.round(240 * st.lh), after: 80 };
  const widthTw = Math.round((A4.w - 2 * A4.margin) * 20);
  const P = (children, opts = {}) => new D.Paragraph({ children, spacing, ...opts });
  const T = (text, o = {}) => new D.TextRun({ text, font: st.wordFont, size: sz, ...o });
  const runs = (rs) => rs.map((r) => (r.blank ? T(r.answer ? ` ${r.answer} ` : ' '.repeat(Math.max(8, (r.len || 12) + 4)), { underline: {}, bold: !!r.answer, color: r.answer ? '1C2FB0' : undefined }) : T(r.text, { bold: !!r.b, italics: !!r.i })));
  const cellBorder = { style: D.BorderStyle.SINGLE, size: 6, color: '555555' };
  const dashed = { style: D.BorderStyle.DASHED, size: 4, color: '999999' };

  async function render(b, keep) {
    const k = keep ? { keepNext: true, keepLines: true } : {};
    switch (b.t) {
      case 'h': return [P([T(b.text, { bold: true, size: st.h * 2 })], { spacing: { before: 200, after: 80 }, keepNext: true })];
      case 'p': return [P(runs(b.runs || [{ text: b.text || '' }]), k)];
      case 'keep': {
        const out = [];
        for (const x of b.items) out.push(...(await render(x, true)));
        // Le dernier paragraphe du groupe ne doit pas s'accrocher au suivant.
        const last = out[out.length - 1];
        if (last instanceof D.Paragraph) out[out.length - 1] = cloneNoKeepNext(D, last);
        out.push(P([T('')], { spacing: { after: 60 } }));
        return out;
      }
      case 'choices': return b.items.map((c, i) => P([T(b.showAnswers && c.ok ? '☒  ' : '☐  '), T(String.fromCharCode(97 + i) + ') ', { bold: true }), T(c.text, { bold: b.showAnswers && c.ok })], { indent: { left: 280 }, ...k }));
      case 'lines': return Array.from({ length: b.n || 2 }, () => P([T('_'.repeat(dys ? 62 : 85), { color: '999999' })], k));
      case 'grid': {
        const n = b.cells[0].length;
        const cs = Math.min(b.size || 22, (A4.w - 2 * A4.margin) / n);
        const tw = Math.round(cs * 20);
        return [new D.Table({
          alignment: D.AlignmentType.CENTER, layout: D.TableLayoutType.FIXED, width: { size: tw * n, type: D.WidthType.DXA }, columnWidths: Array(n).fill(tw),
          rows: b.cells.map((row) => new D.TableRow({ cantSplit: true, height: { value: tw, rule: D.HeightRule.EXACT }, children: row.map((c) => new D.TableCell({
            width: { size: tw, type: D.WidthType.DXA }, verticalAlign: D.VerticalAlign.CENTER,
            shading: c.black && !c.void ? { fill: '222222', type: D.ShadingType.CLEAR, color: 'auto' } : c.hl ? { fill: 'E6E9FB', type: D.ShadingType.CLEAR, color: 'auto' } : undefined,
            borders: c.void ? { top: { style: D.BorderStyle.NONE }, bottom: { style: D.BorderStyle.NONE }, left: { style: D.BorderStyle.NONE }, right: { style: D.BorderStyle.NONE } } : { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder },
            margins: { top: 0, bottom: 0, left: 20, right: 20 },
            children: [new D.Paragraph({ alignment: D.AlignmentType.CENTER, spacing: { line: 240, after: 0 }, children: [
              ...(c.num ? [new D.TextRun({ text: String(c.num) + ' ', size: 10, font: st.wordFont, superScript: true })] : []),
              new D.TextRun({ text: c.black ? '' : c.ch || '', size: Math.round(cs * 1.05), bold: !!c.hl, font: st.wordFont, color: c.hl ? '1C2FB0' : undefined })] })],
          })) })),
        }), P([T('')])];
      }
      case 'table': {
        const ncol = (b.head || b.rows[0]).length;
        const rel = b.widths && b.widths.every((x) => typeof x === 'number') ? b.widths : Array(ncol).fill(1);
        const sum = rel.reduce((a, c) => a + c, 0);
        const cw = rel.map((x) => Math.round((x / sum) * widthTw));
        const mk = (cells, head) => new D.TableRow({ cantSplit: true, tableHeader: !!head, children: cells.map((c, i) => new D.TableCell({
          width: { size: cw[i], type: D.WidthType.DXA }, shading: head ? { fill: 'EEF0FA', type: D.ShadingType.CLEAR, color: 'auto' } : undefined,
          margins: { top: 60, bottom: 60, left: 100, right: 100 },
          children: [new D.Paragraph({ spacing, children: [T(typeof c === 'string' ? c : c.text || '', { bold: head || (typeof c === 'object' && c.bold) })] })] })) });
        return [new D.Table({ layout: D.TableLayoutType.FIXED, width: { size: widthTw, type: D.WidthType.DXA }, columnWidths: cw, rows: [...(b.head ? [mk(b.head, true)] : []), ...b.rows.map((r) => mk(r))] }), P([T('')])];
      }
      case 'cards': {
        const out = [];
        const per = b.cols * b.rows;
        const cw = Math.floor(widthTw / b.cols);
        for (let p = 0; p < b.cards.length; p += per) {
          const page = b.cards.slice(p, p + per);
          const rows = [];
          for (let r = 0; r < b.rows; r++) rows.push(new D.TableRow({ cantSplit: true, height: { value: Math.round(b.height * 20), rule: D.HeightRule.EXACT }, children: Array.from({ length: b.cols }, (_, k) => {
            const c = page[r * b.cols + k];
            return new D.TableCell({ width: { size: cw, type: D.WidthType.DXA }, verticalAlign: D.VerticalAlign.CENTER, borders: { top: dashed, bottom: dashed, left: dashed, right: dashed }, margins: { left: 120, right: 120 },
              children: [new D.Paragraph({ alignment: D.AlignmentType.CENTER, children: c ? [T(c.text, { bold: !c.plain, size: (c.size || st.size + 3) * 2 }), ...(c.sub ? [new D.TextRun({ break: 1 }), new D.TextRun({ break: 1 }), T(c.sub, { size: (c.subSize || st.small) * 2, bold: !!c.subSize, color: c.subSize ? undefined : '555555' })] : [])] : [] })] });
          }) }));
          out.push(new D.Table({ layout: D.TableLayoutType.FIXED, width: { size: cw * b.cols, type: D.WidthType.DXA }, columnWidths: Array(b.cols).fill(cw), rows }));
          if (p + per < b.cards.length) out.push(new D.Paragraph({ children: [new D.PageBreak()] }));
        }
        return out;
      }
      case 'svg': {
        const w = Math.min(500, b.width || 500), h = Math.round(w * (b.ratio || 0.7));
        const png = await svgToPng(b.svg, w, h);
        return [P([new D.ImageRun({ type: 'png', data: png, transformation: { width: w, height: h } })], { alignment: D.AlignmentType.CENTER })];
      }
      case 'wordbank': return [P([T(b.words.join('   •   '))], { alignment: D.AlignmentType.CENTER, border: { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder }, spacing: { before: 120, after: 200 } })];
      case 'break': return [new D.Paragraph({ children: [new D.PageBreak()] })];
      default: return [];
    }
  }
  const children = [];
  if (doc.title) children.push(P([T(doc.title, { bold: true, size: st.title * 2 })], { spacing: { after: 60 } }));
  if (doc.subtitle) children.push(P([T(doc.subtitle, { color: '444444' })]));
  if (doc.fields) children.push(P([T('Nom : ____________   Prénom : ____________   Classe : ______   Date : ________', { size: (st.small + 1) * 2 })], { spacing: { before: 120, after: 240 } }));
  for (const b of doc.blocks) children.push(...(await render(b, false)));
  const m = Math.round(A4.margin * 20);
  const d = new D.Document({
    creator: 'Trousse', title: doc.title || 'Document',
    styles: { default: { document: { run: { font: st.wordFont, size: sz } } } },
    sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: m, bottom: m, left: m, right: m } } }, children }],
  });
  return D.Packer.toBlob(d);
}
function cloneNoKeepNext(D, p) {
  // Les paragraphes docx sont immuables : on retire simplement l'option keepNext via les propriétés internes.
  try { const props = p.properties; const kn = props?.root?.findIndex?.((x) => x?.rootKey === 'w:keepNext'); if (kn >= 0) props.root.splice(kn, 1); } catch {}
  return p;
}

// ---------- Aperçu HTML ----------
export function slug(s) {
  return (s || 'document').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase().slice(0, 50) || 'document';
}
