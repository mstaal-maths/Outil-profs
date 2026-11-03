// « Mes documents » et l'éditeur d'un document imprimable.
import { html, useState, useMemo, useEffect } from '../vendor/preact.js';
import { Icon, navigate, useStore, useTitle, toast, confirmDialog } from '../ui/core.js';
import { createDoc, updateDoc, deleteDoc, restoreDoc, docList } from '../lib/store.js';
import { DOC_TOOLS, docTool } from '../docs/tools.js';
import { DocPreview } from '../docs/preview.js';
import { toPdfBlob, toDocxBlob, slug } from '../docs/engine.js';
import { downloadBlob, relTime, fuzzyScore } from '../lib/util.js';

// ---------- Liste ----------
export function DocumentsHome() {
  const s = useStore();
  useTitle('Mes documents');
  const [q, setQ] = useState('');
  const docs = docList().filter((d) => !q.trim() || fuzzyScore(q, d.name) > 20);
  return html`<main id="main" class="page route-enter" tabindex="-1">
    <div class="page-head"><div><h1>Mes documents</h1><p class="sub">QCM, mots croisés, flashcards… prêts à imprimer, en PDF ou en Word modifiable.</p></div></div>
    <h2 class="sec-title">Créer un document</h2>
    <div class="doc-tools">${DOC_TOOLS.map((t) => html`<a class="doc-tool" href=${'#/documents/nouveau/' + t.id}><span class="dt-ico"><${Icon} name=${t.icon}/></span><b>${t.name}</b><span>${t.desc}</span></a>`)}</div>
    <div class="row" style="margin:34px 0 12px">
      <h2 class="sec-title" style="margin:0;flex:1">Mes documents enregistrés</h2>
      ${Object.keys(s.docs).length > 3 && html`<div class="dash-search" style="max-width:280px"><${Icon} name="search"/><label class="sr-only" for="docq">Rechercher un document</label><input id="docq" class="input" type="search" placeholder="Rechercher…" value=${q} onInput=${(e) => setQ(e.target.value)}/></div>`}
    </div>
    ${!Object.keys(s.docs).length ? html`<div class="empty"><h3>Aucun document pour l’instant</h3><p>Choisissez un outil ci-dessus. Vos documents sont enregistrés (et chiffrés) automatiquement, pour les réutiliser l’an prochain.</p></div>`
    : html`<div class="doc-list">${docs.map((d) => { const t = docTool(d.tool); return html`<div class="doc-row" key=${d.id}>
        <a class="doc-open" href=${'#/documents/' + d.id}><span class="dt-ico sm"><${Icon} name=${t?.icon || 'file-text'}/></span><span><b>${d.name || 'Sans titre'}</b><small>${t?.name} · modifié ${relTime(d.updatedAt)}</small></span></a>
        <button class="btn btn-ghost btn-sm" onClick=${() => { const c = createDoc(d.tool, structuredClone(d.data), d.name + ' (copie)'); navigate('/documents/' + c.id); }}><${Icon} name="copy"/><span class="hide-sm">Dupliquer</span></button>
        <button class="btn btn-ghost btn-icon btn-sm" aria-label=${'Supprimer ' + d.name} onClick=${async () => { const r = await deleteDoc(d.id); toast('Document supprimé.', { icon: 'trash-2', action: { label: 'Annuler', run: () => restoreDoc(r) } }); }}><${Icon} name="trash-2"/></button>
      </div>`; })}</div>`}
  </main>`;
}

/** Création : on crée le document puis on ouvre l'éditeur (avec un exemple en démonstration). */
export function NewDocument({ tool }) {
  const s = useStore();
  useEffect(() => {
    const t = docTool(tool);
    if (!t) { navigate('/documents', { replace: true }); return; }
    const data = s.mode === 'demo' ? t.example() : t.defaults();
    const d = createDoc(t.id, data, s.mode === 'demo' ? data.title : 'Nouveau ' + t.name.toLowerCase().split(' ')[0]);
    navigate('/documents/' + d.id, { replace: true });
  }, [tool]);
  return html`<div class="boot"><div class="spinner"></div></div>`;
}

// ---------- Éditeur ----------
export function DocEditor({ doc }) {
  const t = docTool(doc.tool);
  useTitle(doc.name);
  const [tab, setTab] = useState('sujet');
  const [busy, setBusy] = useState('');
  const set = (patch) => updateDoc(doc.id, (d) => { Object.assign(d.data, patch); if (patch.title !== undefined) d.name = patch.title || 'Sans titre'; });
  const built = useMemo(() => { try { return t.build(doc.data); } catch (e) { console.warn(e); return { sujet: { title: 'Erreur', blocks: [] }, corrige: null, warn: 'Une erreur est survenue lors de la mise en page.' }; } }, [doc.data]);
  const dys = !!doc.dys;
  const hasKey = !!built.corrige;
  useEffect(() => { if (!hasKey && tab === 'corrige') setTab('sujet'); }, [hasKey]);

  async function exportAs(which, fmt) {
    const target = which === 'corrige' ? built.corrige : built.sujet;
    if (!target) return;
    setBusy(which + fmt);
    try {
      const blob = fmt === 'pdf' ? await toPdfBlob(target, dys) : await toDocxBlob(target, dys);
      downloadBlob(blob, `${slug(doc.name)}${which === 'corrige' ? '-corrige' : ''}${dys ? '-dys' : ''}.${fmt === 'pdf' ? 'pdf' : 'docx'}`);
      toast(`${which === 'corrige' ? 'Corrigé' : 'Sujet'} téléchargé (${fmt === 'pdf' ? 'PDF' : 'Word'}).`, { icon: 'download' });
    } catch (e) {
      console.error(e);
      toast('Le fichier n’a pas pu être créé. Réessayez dans un instant.', { icon: 'triangle-alert' });
    }
    setBusy('');
  }
  const loadExample = async () => {
    if (!(await confirmDialog({ title: 'Remplacer par un exemple ?', body: 'Le contenu actuel de ce document sera remplacé par un exemple tout prêt, que vous pourrez modifier.', ok: 'Charger l’exemple' }))) return;
    const ex = t.example();
    updateDoc(doc.id, (d) => { d.data = ex; d.name = ex.title; });
  };
  const btn = (which, fmt, label) => html`<button class=${`btn ${fmt === 'pdf' ? 'btn-primary' : ''}`} onClick=${() => exportAs(which, fmt)} disabled=${!!busy}>
    ${busy === which + fmt ? html`<div class="spinner" style="width:16px;height:16px"></div>` : html`<${Icon} name=${fmt === 'pdf' ? 'file-text' : 'download'}/>`}${label}</button>`;

  return html`<main id="main" class="page page-wide route-enter doc-page" tabindex="-1">
    <div class="doc-head">
      <span class="dt-ico"><${Icon} name=${t.icon}/></span>
      <div style="flex:1;min-width:200px"><p class="eyebrow">${t.name}</p><h1>${doc.name || 'Sans titre'}</h1></div>
      <button class="btn btn-ghost btn-sm" onClick=${loadExample}><${Icon} name="sparkles"/>Voir un exemple</button>
    </div>
    <div class="doc-layout">
      <section class="doc-editor card" aria-label="Contenu du document"><${t.Editor} d=${doc.data} set=${set}/></section>
      <section class="doc-side" aria-label="Aperçu et téléchargement">
        <div class="card export-card">
          <div class="row" style="--gap:10px">
            <label class="switch dys-switch" title="Arial 14, interligne 1,5"><input type="checkbox" checked=${dys} onChange=${(e) => updateDoc(doc.id, (d) => { d.dys = e.target.checked; })}/>Mise en page DYS</label>
            <span class="hint">${dys ? 'Arial 14, interligne 1,5' : 'Police très lisible, taille 11'}</span>
          </div>
          <div class="export-rows">
            <div class="export-row"><b>Sujet</b>${btn('sujet', 'pdf', 'PDF')}${btn('sujet', 'docx', 'Word')}</div>
            ${hasKey && html`<div class="export-row"><b>Corrigé</b>${btn('corrige', 'pdf', 'PDF')}${btn('corrige', 'docx', 'Word')}</div>`}
          </div>
          ${built.warn && html`<div class="notice warn"><${Icon} name="info"/><div>${built.warn}</div></div>`}
        </div>
        <div class="preview-wrap">
          ${hasKey && html`<div class="seg preview-tabs" role="tablist" aria-label="Aperçu"><button role="tab" aria-selected=${tab === 'sujet'} onClick=${() => setTab('sujet')}>Sujet</button><button role="tab" aria-selected=${tab === 'corrige'} onClick=${() => setTab('corrige')}>Corrigé</button></div>`}
          <${DocPreview} doc=${tab === 'corrige' && hasKey ? built.corrige : built.sujet} dys=${dys} label=${tab === 'corrige' ? 'Aperçu du corrigé' : 'Aperçu du sujet'}/>
          <p class="hint" style="text-align:center;margin-top:10px">Aperçu indicatif : dans le PDF et le Word, aucun exercice n’est coupé entre deux pages.</p>
        </div>
      </section>
    </div>
  </main>`;
}
