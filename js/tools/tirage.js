// Outil 1 — Tirage au sort sans répétition.
import { html, useState, useEffect, useRef } from '../vendor/preact.js';
import { Icon, useKeys, toggleFullscreen, useFullscreen, useWakeLock, toast } from '../ui/core.js';
import { updateClass } from '../lib/store.js';
import { randInt, shuffle, fullName, shortName, plural, prefersReducedMotion } from '../lib/util.js';
import * as sound from '../lib/sound.js';

const ITEM_H = 1.25; // en em (hauteur d'une ligne du rouleau)
const today = () => new Date().toISOString().slice(0, 10);

export function DrawTool({ cls }) {
  const stageRef = useRef();
  const fs = useFullscreen();
  const [count, setCount] = useState(1);
  const [reels, setReels] = useState([]); // [{ seq: [noms], target: id, key }]
  const [spinning, setSpinning] = useState(false);
  const [muted, setMutedS] = useState(sound.isMuted());
  const [last, setLast] = useState([]);
  useWakeLock(true);

  const draw = cls.draw || { done: [], absent: [] };
  const absent = draw.absentDate === today() ? draw.absent || [] : [];
  const present = cls.students.filter((s) => !absent.includes(s.id));
  const remaining = present.filter((s) => !draw.done.includes(s.id));
  const nameOf = (s) => shortName(s, cls.students);

  function go() {
    if (spinning) return;
    if (present.length === 0) { toast('Aucun élève présent à tirer.', { icon: 'info' }); return; }
    sound.unlockAudio();
    let pool = remaining.slice();
    let newRound = false;
    if (pool.length === 0) { pool = present.slice(); newRound = true; }
    const n = Math.min(count, present.length);
    const picked = [];
    while (picked.length < n) {
      if (pool.length === 0) { pool = present.filter((s) => !picked.includes(s)); newRound = true; }
      picked.push(pool.splice(randInt(pool.length), 1)[0]);
    }
    const reduce = prefersReducedMotion();
    const rs = picked.map((p, i) => {
      const len = reduce ? 1 : 26 + i * 7;
      const seq = [];
      for (let k = 0; k < len - 1; k++) seq.push(nameOf(present[randInt(present.length)]));
      seq.push(nameOf(p));
      return { seq, target: p.id, key: Math.random(), dur: reduce ? 0 : 2600 + i * 450 };
    });
    setReels(rs);
    setSpinning(true);
    setLast([]);
    const total = Math.max(...rs.map((r) => r.dur));
    setTimeout(() => {
      setSpinning(false);
      setLast(picked.map((p) => p.id));
      sound.reveal();
      updateClass(cls.id, (c) => {
        c.draw = c.draw || { done: [], absent: [] };
        if (newRound) c.draw.done = c.draw.done.filter((id) => !present.some((s) => s.id === id));
        for (const p of picked) if (!c.draw.done.includes(p.id)) c.draw.done.push(p.id);
        c.draw.history = [...(c.draw.history || []), ...picked.map((p) => p.id)].slice(-60);
      });
      if (newRound) toast('Tout le monde est passé : un nouveau tour commence !', { icon: 'rotate-ccw' });
    }, total + 60);
  }

  const reset = () => updateClass(cls.id, (c) => { c.draw.done = []; setLast([]); setReels([]); });
  const undo = () => {
    if (!last.length) return;
    updateClass(cls.id, (c) => { c.draw.done = c.draw.done.filter((id) => !last.includes(id)); });
    setLast([]); setReels([]);
    toast('Dernier tirage annulé : ces élèves sont remis dans le chapeau.', { icon: 'undo-2' });
  };
  const toggleAbsent = (sid) => updateClass(cls.id, (c) => {
    c.draw = c.draw || { done: [], absent: [] };
    if (c.draw.absentDate !== today()) { c.draw.absent = []; c.draw.absentDate = today(); }
    c.draw.absent = c.draw.absent.includes(sid) ? c.draw.absent.filter((x) => x !== sid) : [...c.draw.absent, sid];
  });

  useKeys({ Space: go, Enter: go, u: undo }, [spinning, remaining, count, last, cls]);

  if (!cls.students.length) return html`<div class="empty"><h3>Ajoutez des élèves pour tirer au sort</h3><p>Le tirage se fait parmi les élèves de la classe.</p><a class="btn btn-primary" href=${`#/classes/${cls.id}`}>Ajouter des élèves</a></div>`;

  const doneCount = present.length - remaining.length;
  return html`<div class="tool-layout">
    <section class=${`stage draw-stage seyes ${fs ? 'is-fs' : ''}`} ref=${stageRef} aria-label="Tirage au sort">
      <div class="stage-top">
        <div class="draw-progress" aria-label=${`${doneCount} élèves passés sur ${present.length}`}>
          <span class="tnum"><b>${doneCount}</b> / ${present.length} passés</span>
          <div class="dots" aria-hidden="true">${present.map((s) => html`<i class=${draw.done.includes(s.id) ? 'on' : ''}></i>`)}</div>
        </div>
        <div class="spacer"></div>
        <button class="btn btn-ghost btn-icon btn-sm" onClick=${() => { sound.setMuted(!muted); setMutedS(!muted); }} aria-label=${muted ? 'Activer le son' : 'Couper le son'} aria-pressed=${!muted} title=${muted ? 'Son coupé' : 'Son activé'}><${Icon} name=${muted ? 'volume-x' : 'volume-2'}/></button>
        <button class="btn btn-ghost btn-icon btn-sm" onClick=${() => toggleFullscreen(stageRef.current)} aria-label=${fs ? 'Quitter le plein écran' : 'Plein écran'} title="Plein écran (F)"><${Icon} name=${fs ? 'minimize' : 'maximize'}/></button>
      </div>
      <div class=${`reels n${reels.length || 1}`} aria-hidden=${spinning ? 'true' : undefined}>
        ${reels.length === 0 ? html`<div class="draw-idle"><div class="hat" aria-hidden="true"><${Icon} name="dices"/></div><p>Qui va passer ?</p><span class="hint">Appuyez sur <span class="kbd">Espace</span> pour tirer au sort</span></div>`
          : reels.map((r, i) => html`<${Reel} key=${r.key} reel=${r} index=${i} spinning=${spinning}/>`)}
      </div>
      <div class="sr-only" aria-live="assertive">${!spinning && last.length ? 'Élève tiré : ' + last.map((id) => fullName(cls.students.find((s) => s.id === id) || {})).join(', ') : ''}</div>
      <div class="stage-bottom">
        <div class="seg" role="group" aria-label="Nombre d’élèves à tirer">${[1, 2, 3, 4].map((n) => html`<button aria-pressed=${count === n} onClick=${() => setCount(n)} disabled=${n > present.length}>${n}</button>`)}</div>
        <button class="btn btn-primary btn-lg draw-btn" onClick=${go} disabled=${spinning}><${Icon} name="dices"/>${spinning ? 'Tirage…' : count > 1 ? `Tirer ${count} élèves` : 'Tirer au sort'}<span class="kbd">Espace</span></button>
        <button class="btn btn-ghost" onClick=${undo} disabled=${!last.length || spinning} title="Remettre le dernier tirage dans le chapeau (U)"><${Icon} name="undo-2"/><span class="hide-sm">Annuler</span></button>
      </div>
    </section>

    <aside class="tool-side no-print">
      <div class="card side-card">
        <div class="row"><h3 style="flex:1">Dans le chapeau</h3><span class="badge">${remaining.length}</span></div>
        <p>Cliquez sur un élève absent aujourd’hui pour l’écarter du tirage.</p>
        <div class="who-list" role="list">${cls.students.map((s) => {
          const isAbs = absent.includes(s.id);
          const isDone = draw.done.includes(s.id);
          return html`<button role="listitem" class=${`who ${isAbs ? 'abs' : isDone ? 'done' : ''} ${last.includes(s.id) && !spinning ? 'just' : ''}`} onClick=${() => toggleAbsent(s.id)} aria-pressed=${isAbs} aria-label=${`${fullName(s)} : ${isAbs ? 'absent' : isDone ? 'déjà passé' : 'pas encore passé'}. Cliquer pour marquer ${isAbs ? 'présent' : 'absent'}.`}>
            ${nameOf(s)}${isDone && !isAbs && html`<${Icon} name="check" size=${13}/>`}${isAbs && html`<span class="abs-tag">absent</span>`}</button>`;
        })}</div>
        <button class="btn" onClick=${reset} disabled=${!draw.done.length}><${Icon} name="rotate-ccw"/>Remettre tout le monde</button>
      </div>
    </aside>
  </div>`;
}

function Reel({ reel, index, spinning }) {
  const colRef = useRef();
  const [landed, setLanded] = useState(reel.dur === 0);
  useEffect(() => {
    const col = colRef.current;
    if (!col) return;
    const n = reel.seq.length;
    if (reel.dur === 0) { col.style.transform = `translateY(${-(n - 1) * ITEM_H}em)`; setLanded(true); return; }
    col.style.transition = 'none';
    col.style.transform = 'translateY(0)';
    col.getBoundingClientRect();
    col.style.transition = `transform ${reel.dur}ms cubic-bezier(.12,.7,.08,1)`;
    col.style.transform = `translateY(${-(n - 1) * ITEM_H}em)`;
    // Tic sonore à chaque nom qui passe.
    let raf, lastIdx = -1;
    const fontPx = parseFloat(getComputedStyle(col).fontSize);
    const loop = () => {
      const m = new DOMMatrixReadOnly(getComputedStyle(col).transform);
      const idx = Math.round(-m.m42 / (ITEM_H * fontPx));
      if (idx !== lastIdx) { lastIdx = idx; if (index === 0) sound.tick(1 + (idx % 3) * 0.04); }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const t = setTimeout(() => { cancelAnimationFrame(raf); setLanded(true); }, reel.dur);
    return () => { cancelAnimationFrame(raf); clearTimeout(t); };
  }, [reel]);
  return html`<div class=${`reel ${landed ? 'landed' : ''}`}>
    <div class="reel-window"><div class="reel-col" ref=${colRef}>${reel.seq.map((n, i) => html`<div class="reel-item" key=${i}>${n}</div>`)}</div></div>
    ${landed && html`<svg viewBox="0 0 400 140" class="draw-circle" preserveAspectRatio="none" aria-hidden="true"><path d="M52 84c-6-34 72-58 160-56 84 2 140 24 134 56-6 34-100 46-182 40-70-5-114-20-108-46 4-16 26-28 60-34"/></svg>`}
  </div>`;
}
