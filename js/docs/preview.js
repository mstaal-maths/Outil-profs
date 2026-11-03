// Aperçu à l'écran d'un document (même modèle que le PDF et le Word).
import { html } from '../vendor/preact.js';

const letter = (i) => String.fromCharCode(97 + i);

function Runs({ runs }) {
  return runs.map((r) => (r.blank
    ? html`<span class=${`dv-blank ${r.answer ? 'ans' : ''}`} style=${`min-width:${Math.max(4, r.len || 10) * 0.55}em`}>${r.answer || ' '}</span>`
    : html`<span style=${`${r.b ? 'font-weight:700;' : ''}${r.i ? 'font-style:italic' : ''}`}>${r.text}</span>`));
}

function Block({ b }) {
  switch (b.t) {
    case 'h': return html`<h3 class="dv-h">${b.text}</h3>`;
    case 'p': return html`<p class="dv-p"><${Runs} runs=${b.runs || [{ text: b.text || '' }]}/></p>`;
    case 'keep': return html`<div class="dv-keep">${b.items.map((x) => html`<${Block} b=${x}/>`)}</div>`;
    case 'choices': return html`<div class="dv-choices" style=${`--cols:${b.cols || 1}`}>${b.items.map((c, i) => html`<div class=${`dv-choice ${b.showAnswers && c.ok ? 'ok' : ''}`}><span class="dv-box">${b.showAnswers && c.ok ? '✓' : ''}</span><b>${letter(i)})</b> ${c.text}</div>`)}</div>`;
    case 'lines': return html`<div class="dv-lines">${Array.from({ length: b.n || 2 }, () => html`<i></i>`)}</div>`;
    case 'grid': return html`<div class="dv-grid-wrap"><table class="dv-grid" style=${`--n:${b.cells[0].length}`}><tbody>${b.cells.map((row) => html`<tr>${row.map((c) => html`<td class=${`${c.black ? (c.void ? 'void' : 'black') : ''} ${c.hl ? 'hl' : ''}`}>${c.num && html`<sup>${c.num}</sup>`}${c.black ? '' : c.ch || ''}</td>`)}</tr>`)}</tbody></table></div>`;
    case 'table': return html`<table class="dv-table">${b.head && html`<thead><tr>${b.head.map((h) => html`<th>${h}</th>`)}</tr></thead>`}<tbody>${b.rows.map((r) => html`<tr>${r.map((c) => html`<td>${typeof c === 'string' ? c : c.text}</td>`)}</tr>`)}</tbody></table>`;
    case 'cards': return html`<div class="dv-cards" style=${`--cols:${b.cols};--h:${b.height * 0.75}px`}>${b.cards.map((c, i) => html`<div class="dv-card">${c ? html`<b style=${c.plain ? 'font-weight:500' : ''}>${c.text}</b>${c.sub && html`<small class=${c.subSize ? 'strong' : ''}>${c.sub}</small>`}` : ''}</div>${(i + 1) % (b.cols * b.rows) === 0 && i + 1 < b.cards.length ? html`<div class="dv-pagebreak" style="grid-column:1/-1"><span>page suivante</span></div>` : ''}`)}</div>`;
    case 'svg': return html`<div class="dv-svg" dangerouslySetInnerHTML=${{ __html: b.svg }}></div>`;
    case 'wordbank': return html`<div class="dv-bank">${b.words.map((w, i) => html`${i > 0 && html`<span class="dot">•</span>`}<span>${w}</span>`)}</div>`;
    case 'break': return html`<div class="dv-pagebreak"><span>page suivante</span></div>`;
    default: return null;
  }
}

export function DocPreview({ doc, dys, label }) {
  if (!doc) return null;
  return html`<div class=${`dv-sheet ${dys ? 'dys' : ''}`} aria-label=${label || 'Aperçu du document'}>
    ${doc.title && html`<h2 class="dv-title">${doc.title}</h2>`}
    ${doc.subtitle && html`<p class="dv-sub">${doc.subtitle}</p>`}
    ${doc.fields && html`<p class="dv-fields">Nom : <i></i> Prénom : <i></i> Classe : <i class="s"></i> Date : <i class="s"></i></p>`}
    ${doc.blocks.map((b) => html`<${Block} b=${b}/>`)}
  </div>`;
}
