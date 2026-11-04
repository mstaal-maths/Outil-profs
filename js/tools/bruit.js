// Outil 6 — Bruitomètre : mesure le niveau sonore de la classe avec le micro, à projeter.
// Le son n'est jamais enregistré ni envoyé : seul un niveau (0 à 100) est calculé, sur cet ordinateur.
import { html, useState, useEffect, useRef } from '../vendor/preact.js';
import { Icon, toggleFullscreen, useFullscreen, useWakeLock, useTitle } from '../ui/core.js';
import * as sound from '../lib/sound.js';

const MODES = [
  { id: 'silence', label: 'Silence', sub: 'contrôle, lecture', limit: 30 },
  { id: 'chuchote', label: 'Chuchotements', sub: 'travail en groupe', limit: 52 },
  { id: 'discussion', label: 'Discussion', sub: 'débat, activité', limit: 72 },
];
const pref = (k, d) => { try { return JSON.parse(localStorage.getItem('trousse.bruit.' + k)) ?? d; } catch { return d; } };
const savePref = (k, v) => { try { localStorage.setItem('trousse.bruit.' + k, JSON.stringify(v)); } catch {} };
const fmtTime = (ms) => { const s = Math.floor(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

export function NoiseTool({ standalone }) {
  if (standalone) useTitle('Bruitomètre');
  const stageRef = useRef();
  const fs = useFullscreen();
  const [state, setState] = useState('idle'); // 'idle' | 'starting' | 'on' | 'denied' | 'nomic' | 'sim'
  const [level, setLevel] = useState(0);
  const [mode, setMode] = useState(() => pref('mode', 'chuchote'));
  const [sens, setSens] = useState(() => pref('sens', 1)); // sensibilité du micro
  const [beep, setBeep] = useState(() => pref('beep', false));
  const [alerts, setAlerts] = useState(0);
  const [calm, setCalm] = useState(0);
  const [over, setOver] = useState(false);
  const [sim, setSim] = useState(20);
  const audio = useRef({});
  const lim = MODES.find((m) => m.id === mode).limit;
  useWakeLock(state === 'on' || state === 'sim');
  useEffect(() => savePref('mode', mode), [mode]);
  useEffect(() => savePref('sens', sens), [sens]);
  useEffect(() => savePref('beep', beep), [beep]);

  // Boucle de mesure : niveau lissé, alerte après 1,2 s au-dessus du seuil, temps calme cumulé.
  const live = useRef({ level: 0, overSince: 0, alerted: false, last: 0, sens: 1, lim: 52, beep: false });
  live.current.sens = sens; live.current.lim = lim; live.current.beep = beep;
  useEffect(() => {
    if (state !== 'on' && state !== 'sim') return;
    let raf;
    const buf = new Float32Array(2048);
    const loop = (t) => {
      const L = live.current;
      let raw;
      if (state === 'on') {
        if (!audio.current.analyser) return; // micro arrêté
        audio.current.analyser.getFloatTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
        const rms = Math.sqrt(sum / buf.length) * L.sens;
        const db = 20 * Math.log10(Math.max(rms, 1e-5)); // de -100 à 0
        raw = Math.max(0, Math.min(100, ((db + 62) / 52) * 100));
      } else raw = Math.max(0, Math.min(100, L.simTarget ?? 20)) + (Math.random() - 0.5) * 4;
      L.level += (raw - L.level) * (raw > L.level ? 0.25 : 0.06); // monte vite, redescend doucement
      const dt = L.last ? t - L.last : 0;
      L.last = t;
      if (L.level > L.lim) {
        if (!L.overSince) L.overSince = t;
        if (t - L.overSince > 1200 && !L.alerted) { L.alerted = true; setAlerts((a) => a + 1); setOver(true); if (L.beep) sound.tick(0.6); }
      } else {
        L.overSince = 0;
        if (L.alerted && L.level < L.lim - 6) { L.alerted = false; setOver(false); }
        if (!L.alerted) setCalm((c) => c + dt);
      }
      setLevel(L.level);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [state]);
  useEffect(() => { live.current.simTarget = sim; }, [sim]);
  useEffect(() => () => stop(), []);

  async function start() {
    setState('starting');
    sound.unlockAudio();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      src.connect(analyser);
      audio.current = { stream, ctx, analyser };
      reset();
      setState('on');
    } catch (e) {
      setState(e && (e.name === 'NotFoundError' || e.name === 'OverconstrainedError') ? 'nomic' : 'denied');
    }
  }
  function stop() {
    const a = audio.current;
    a.stream?.getTracks().forEach((tr) => tr.stop());
    a.ctx?.close?.();
    audio.current = {};
    setState('idle'); setOver(false);
  }
  const reset = () => { setAlerts(0); setCalm(0); setOver(false); live.current.alerted = false; live.current.overSince = 0; live.current.last = 0; };

  const zone = level > lim ? 'loud' : level > lim * 0.75 ? 'mid' : 'calm';
  const word = { calm: 'Calme', mid: 'Ça monte…', loud: 'Trop fort !' }[zone];
  // Cadran : demi-cercle de 0 à 100, aiguille, zone d'alerte au-delà du seuil.
  const ang = (v) => Math.PI * (1 - v / 100);
  const pt = (v, r) => [150 + r * Math.cos(ang(v)), 160 - r * Math.sin(ang(v))];
  const arc = (a, b, r) => { const [x1, y1] = pt(a, r), [x2, y2] = pt(b, r); return `M${x1} ${y1} A${r} ${r} 0 0 1 ${x2} ${y2}`; };
  const [nx, ny] = pt(Math.min(100, level), 112);
  const running = state === 'on' || state === 'sim';

  return html`<div class=${standalone ? 'page page-wide route-enter' : ''}>
    ${standalone && html`<div class="page-head"><div><h1>Bruitomètre</h1><p class="sub">Projetez-le : la classe voit elle-même quand le bruit devient trop fort.</p></div></div>`}
    <section class=${`stage noise-stage z-${running ? zone : 'idle'} ${over ? 'alarm' : ''} ${fs ? 'is-fs' : ''}`} ref=${stageRef} aria-label="Bruitomètre">
      <div class="stage-top">
        <div class="seg seg-wrap" role="radiogroup" aria-label="Niveau autorisé">${MODES.map((m) => html`<button role="radio" aria-checked=${mode === m.id} aria-pressed=${mode === m.id} onClick=${() => { setMode(m.id); reset(); }}><b>${m.label}</b><span class="hide-sm" style="font-weight:500;opacity:.75"> · ${m.sub}</span></button>`)}</div>
        <div class="spacer"></div>
        <button class="btn btn-ghost btn-icon btn-sm" onClick=${() => setBeep(!beep)} aria-pressed=${beep} aria-label=${beep ? 'Couper le son d’alerte' : 'Activer un son d’alerte'} title=${beep ? 'Son d’alerte activé' : 'Son d’alerte coupé'}><${Icon} name=${beep ? 'volume-2' : 'volume-x'}/></button>
        <button class="btn btn-ghost btn-icon btn-sm" onClick=${() => toggleFullscreen(stageRef.current)} aria-label=${fs ? 'Quitter le plein écran' : 'Plein écran'}><${Icon} name=${fs ? 'minimize' : 'maximize'}/></button>
      </div>

      <div class="noise-face">
        <svg viewBox="0 0 300 180" class="noise-gauge" aria-hidden="true">
          <path d=${arc(0, lim * 0.75, 120)} class="g-calm"/>
          <path d=${arc(lim * 0.75, lim, 120)} class="g-mid"/>
          <path d=${arc(lim, 100, 120)} class="g-loud"/>
          <line x1="150" y1="160" x2=${nx} y2=${ny} class="g-needle"/>
          <circle cx="150" cy="160" r="9" class="g-hub"/>
        </svg>
        <div class="noise-word" role="status" aria-live="polite">${running ? word : state === 'starting' ? 'Activation du micro…' : 'Bruitomètre'}</div>
        ${running && html`<div class="noise-stats"><span><b class="tnum">${fmtTime(calm)}</b> de calme</span><span><b class="tnum">${alerts}</b> alerte${alerts > 1 ? 's' : ''}</span></div>`}
      </div>

      ${state === 'denied' && html`<div class="notice warn"><${Icon} name="info"/><div><strong>Le micro est bloqué.</strong> Cliquez sur le cadenas à gauche de l’adresse du site, autorisez le <b>micro</b>, puis recliquez sur « Activer le micro ». Vous pouvez aussi essayer sans micro ci-dessous.</div></div>`}
      ${state === 'nomic' && html`<div class="notice warn"><${Icon} name="info"/><div><strong>Aucun micro trouvé</strong> sur cet ordinateur. Branchez un micro (ou une webcam avec micro), puis réessayez.</div></div>`}
      ${state === 'sim' && html`<div class="sim-box"><label for="sim">Simulation sans micro : faites glisser pour imiter le bruit de la classe</label><input id="sim" type="range" min="0" max="100" value=${sim} onInput=${(e) => setSim(Number(e.target.value))}/></div>`}

      <div class="stage-bottom">
        ${state === 'on' || state === 'sim'
          ? html`<button class="btn btn-lg" onClick=${stop}><${Icon} name="pause"/>Arrêter</button><button class="btn btn-ghost" onClick=${reset}><${Icon} name="rotate-ccw"/>Remettre à zéro</button>`
          : html`<button class="btn btn-primary btn-lg" onClick=${start} disabled=${state === 'starting'}><${Icon} name="volume-2"/>Activer le micro</button>
            <button class="btn btn-ghost" onClick=${() => { reset(); setState('sim'); }}>Essayer sans micro</button>`}
      </div>
      ${state === 'on' && html`<div class="sens-row no-print"><label for="sens">Sensibilité du micro</label><input id="sens" type="range" min="0.3" max="3" step="0.1" value=${sens} onInput=${(e) => setSens(Number(e.target.value))}/><span class="hint">Si l’aiguille bouge trop ou pas assez, réglez ici.</span></div>`}
      <p class="noise-privacy"><${Icon} name="shield-check" size=${15}/>Le son n’est ni enregistré ni envoyé : il est seulement mesuré, sur cet ordinateur.</p>
    </section>
  </div>`;
}
