// Sons synthétisés (Web Audio) : aucun fichier externe.
let ctx;
function ac() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}
let muted = false;
try { muted = localStorage.getItem('trousse.mute') === '1'; } catch {}
export const isMuted = () => muted;
export function setMuted(v) { muted = v; try { localStorage.setItem('trousse.mute', v ? '1' : '0'); } catch {} }

function tone(freq, t0, dur, { type = 'sine', gain = 0.2, attack = 0.005 } = {}) {
  const c = ac();
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(c.destination);
  o.start(t0); o.stop(t0 + dur + 0.05);
}

/** Petit « tic » pendant le défilement du tirage. */
export function tick(pitch = 1) {
  if (muted) return;
  try { const c = ac(); tone(1400 * pitch, c.currentTime, 0.04, { type: 'triangle', gain: 0.05 }); } catch {}
}
/** Accord joyeux quand le nom est tiré. */
export function reveal() {
  if (muted) return;
  try {
    const c = ac(); const t = c.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, t + i * 0.06, 0.9, { gain: 0.09 }));
  } catch {}
}
/** Carillon de fin du minuteur (trois coups, comme une sonnerie douce). */
export function chime() {
  if (muted) return;
  try {
    const c = ac(); const t = c.currentTime;
    for (let k = 0; k < 3; k++) {
      const b = t + k * 0.85;
      tone(880, b, 1.6, { gain: 0.22 });
      tone(1318.5, b, 1.2, { gain: 0.08 });
      tone(1760, b, 0.6, { gain: 0.04 });
    }
  } catch {}
}
export function unlockAudio() { try { ac(); } catch {} }
