// Outil 3 — Minuteur visuel, compte à rebours et chronomètre.
import { html, useState, useEffect, useRef } from '../vendor/preact.js';
import { Icon, useKeys, toggleFullscreen, useFullscreen, useWakeLock, useTitle } from '../ui/core.js';
import * as sound from '../lib/sound.js';

const PRESETS = [30, 60, 120, 180, 300, 600, 900, 1200, 1800];
const label = (s) => (s < 60 ? `${s} s` : `${s / 60} min`);
function fmt(ms, up = false) {
  const total = up ? Math.floor(ms / 1000) : Math.ceil(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function TimerTool({ standalone }) {
  if (standalone) useTitle('Minuteur');
  const stageRef = useRef();
  const fs = useFullscreen();
  const [mode, setMode] = useState('down'); // 'down' | 'up'
  const [duration, setDuration] = useState(() => { try { return Number(localStorage.getItem('trousse.timer')) || 300000; } catch { return 300000; } });
  const [running, setRunning] = useState(false);
  const [endAt, setEndAt] = useState(0);
  const [left, setLeft] = useState(duration); // compte à rebours : temps restant ; chrono : temps écoulé
  const [done, setDone] = useState(false);
  const [title, setTitle] = useState('');
  const [editing, setEditing] = useState(false);
  const [muted, setMutedS] = useState(sound.isMuted());
  const rafRef = useRef();
  useWakeLock(running);

  useEffect(() => { if (!running) setLeft(mode === 'down' ? duration : 0); setDone(false); }, [duration, mode]);
  useEffect(() => { try { localStorage.setItem('trousse.timer', String(duration)); } catch {} }, [duration]);

  useEffect(() => {
    if (!running) return;
    const loop = () => {
      const now = performance.now();
      if (mode === 'down') {
        const l = endAt - now;
        setLeft(l);
        if (l <= 0 && !done) { setDone(true); sound.chime(); if (navigator.vibrate) navigator.vibrate([200, 100, 200]); }
      } else setLeft(now - endAt);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [running, endAt, mode, done]);

  const start = () => {
    sound.unlockAudio();
    if (mode === 'down') {
      const base = left <= 0 || done ? duration : left;
      if (done || left <= 0) { setDone(false); }
      setEndAt(performance.now() + base);
    } else setEndAt(performance.now() - left);
    setRunning(true);
  };
  const pause = () => { setRunning(false); };
  const toggle = () => (running ? pause() : start());
  const reset = () => { setRunning(false); setDone(false); setLeft(mode === 'down' ? duration : 0); };
  const adjust = (d) => {
    if (mode !== 'down') return;
    if (running) { setEndAt((e) => e + d); if (done && left + d > 0) setDone(false); }
    else { const v = Math.max(5000, (done ? duration : left) + d); setDuration(v); setLeft(v); setDone(false); }
  };
  const choose = (s) => { setMode('down'); setRunning(false); setDone(false); setDuration(s * 1000); setLeft(s * 1000); };

  useKeys({ Space: toggle, r: reset, '+': () => adjust(60000), '=': () => adjust(60000), '-': () => adjust(-60000), ArrowUp: () => adjust(60000), ArrowDown: () => adjust(-60000) }, [running, left, done, duration, mode, endAt]);

  const p = mode === 'down' ? Math.max(0, Math.min(1, left / duration)) : (left % 60000) / 60000;
  const R = 46;
  const C = 2 * Math.PI * R;
  const phase = mode === 'up' ? 'ok' : done ? 'over' : left <= 10000 ? 'end' : p <= 0.2 ? 'low' : 'ok';
  const shown = mode === 'down' ? (done ? '+' + fmt(-left, true) : fmt(Math.max(0, left))) : fmt(left, true);

  const onEdit = (e) => {
    e.preventDefault();
    const v = e.target.elements.t.value.trim();
    const m = v.match(/^(\d{1,3})(?:[:h'm ]\s*(\d{1,2}))?\s*(s)?$/i);
    if (m) {
      let secs = m[3] ? Number(m[1]) : Number(m[1]) * 60 + Number(m[2] || 0);
      if (secs > 0) choose(Math.min(secs, 6 * 3600));
    }
    setEditing(false);
  };

  return html`<div class=${standalone ? 'page page-wide route-enter' : ''}>
    ${standalone && html`<div class="page-head"><div><h1>Minuteur</h1><p class="sub">Projetez-le : il se lit du fond de la classe. <span class="kbd">Espace</span> pour démarrer, <span class="kbd">F</span> pour le plein écran.</p></div></div>`}
    <section class=${`stage timer-stage phase-${phase} ${running ? 'running' : ''} ${fs ? 'is-fs' : ''}`} ref=${stageRef} aria-label="Minuteur">
      <div class="stage-top">
        <div class="seg" role="group" aria-label="Mode">
          <button aria-pressed=${mode === 'down'} onClick=${() => { setRunning(false); setMode('down'); }}><${Icon} name="hourglass"/>Compte à rebours</button>
          <button aria-pressed=${mode === 'up'} onClick=${() => { setRunning(false); setMode('up'); setLeft(0); }}><${Icon} name="timer"/>Chronomètre</button></div>
        <div class="spacer"></div>
        <button class="btn btn-ghost btn-icon btn-sm" onClick=${() => { sound.setMuted(!muted); setMutedS(!muted); }} aria-label=${muted ? 'Activer le son de fin' : 'Couper le son de fin'} aria-pressed=${!muted}><${Icon} name=${muted ? 'volume-x' : 'volume-2'}/></button>
        <button class="btn btn-ghost btn-icon btn-sm" onClick=${() => toggleFullscreen(stageRef.current)} aria-label=${fs ? 'Quitter le plein écran' : 'Plein écran'}><${Icon} name=${fs ? 'minimize' : 'maximize'}/></button>
      </div>
      <div class="timer-face">
        <svg class="timer-ring" viewBox="0 0 100 100" aria-hidden="true">
          <circle cx="50" cy="50" r=${R} class="t-bg"/>
          <circle cx="50" cy="50" r=${R} class="t-fg" style=${`stroke-dasharray:${C};stroke-dashoffset:${C * (1 - p)}`}/>
          ${Array.from({ length: 60 }, (_, i) => html`<line x1="50" y1="1.2" x2="50" y2=${i % 5 ? 2.6 : 3.8} class="t-tick" transform=${`rotate(${i * 6} 50 50)`}/>`)}
        </svg>
        <div class="timer-center">
          ${editing ? html`<form onSubmit=${onEdit}><label class="sr-only" for="t-edit">Durée (minutes, ou mm:ss)</label><input id="t-edit" name="t" class="timer-input tnum" defaultValue=${fmt(duration)} autofocus onBlur=${(e) => e.target.form.requestSubmit()}/></form>`
            : html`<button class="timer-digits tnum" onClick=${() => !running && mode === 'down' && setEditing(true)} aria-label=${`Temps : ${shown}. ${running ? '' : 'Cliquer pour modifier la durée.'}`} role="timer" aria-live="off">${shown}</button>`}
          ${done ? html`<div class="timer-done" role="alert">Temps écoulé !</div>`
            : html`<input class="timer-title" value=${title} onInput=${(e) => setTitle(e.target.value)} placeholder="Ajouter un titre (ex. Exercice 3)" aria-label="Titre affiché sous le minuteur"/>`}
        </div>
      </div>
      <div class="stage-bottom">
        ${mode === 'down' && html`<button class="btn btn-icon" onClick=${() => adjust(-60000)} aria-label="Retirer une minute" title="−1 min"><span class="t-adj">−1</span></button>`}
        <button class=${`btn btn-lg timer-go ${running ? '' : 'btn-primary'}`} onClick=${toggle}><${Icon} name=${running ? 'pause' : 'play'}/>${running ? 'Pause' : done || (mode === 'down' && left < duration) || (mode === 'up' && left > 0) ? 'Reprendre' : 'Démarrer'}<span class="kbd">Espace</span></button>
        ${mode === 'down' && html`<button class="btn btn-icon" onClick=${() => adjust(60000)} aria-label="Ajouter une minute" title="+1 min"><span class="t-adj">+1</span></button>`}
        <button class="btn btn-ghost" onClick=${reset} title="Remettre à zéro (R)"><${Icon} name="rotate-ccw"/><span class="hide-sm">Remettre</span></button>
      </div>
      ${mode === 'down' && html`<div class="presets" role="group" aria-label="Durées rapides">${PRESETS.map((s) => html`<button class=${duration === s * 1000 ? 'on' : ''} onClick=${() => choose(s)}>${label(s)}</button>`)}</div>`}
    </section>
  </div>`;
}
