/**
 * Synthesized UI sound effects — no audio assets, everything is generated live
 * with the Web Audio API. The design brief: the smooth, weighty action of a
 * well-machined lock in thick, high-density material. Selecting a piece is the
 * key seating and turning; moving is the bolt driving home.
 *
 * Every entry point is safe to call anywhere: if audio is unavailable (old
 * browser, no output device, autoplay restrictions) the functions no-op.
 */

let audioCtx: AudioContext | null = null;
let noiseBuffer: AudioBuffer | null = null;

function context(): AudioContext | null {
  try {
    audioCtx ??= new AudioContext();
    // Browsers suspend fresh contexts until a user gesture; our sounds are always
    // triggered by clicks, so resuming here is allowed.
    if (audioCtx.state === 'suspended') void audioCtx.resume();
    return audioCtx;
  } catch {
    return null;
  }
}

function noise(ctx: AudioContext): AudioBuffer {
  if (!noiseBuffer) {
    noiseBuffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.1), ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  return noiseBuffer;
}

/** Short band-passed noise burst — the crisp mechanical "tick" of metal on metal. */
function mechanicalClick(ctx: AudioContext, when: number, freq: number, dur: number, vol: number): void {
  const src = ctx.createBufferSource();
  src.buffer = noise(ctx);
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = freq;
  bp.Q.value = 9;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(vol, when);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + dur);
  src.connect(bp);
  bp.connect(gain);
  gain.connect(ctx.destination);
  src.start(when);
  src.stop(when + dur + 0.02);
}

/** Pitch-dropping sine thump — the dense, heavy body of the mechanism absorbing the action. */
function heavyThump(ctx: AudioContext, when: number, freq: number, drop: number, dur: number, vol: number): void {
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, when);
  osc.frequency.exponentialRampToValueAtTime(drop, when + dur);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(vol, when);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + dur);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(when);
  osc.stop(when + dur + 0.02);
}

/** Piece selected: the key seats and turns — bright tick, tumbler click, shallow dense body. */
export function playSelectSfx(): void {
  const ctx = context();
  if (!ctx) return;
  const t = ctx.currentTime + 0.001;
  mechanicalClick(ctx, t, 3200, 0.016, 0.2);
  mechanicalClick(ctx, t + 0.05, 2100, 0.02, 0.16);
  heavyThump(ctx, t, 190, 120, 0.07, 0.16);
}

/** Piece moved: the bolt drives home — contact click, deep heavy thunk, closing latch. */
export function playMoveSfx(): void {
  const ctx = context();
  if (!ctx) return;
  const t = ctx.currentTime + 0.001;
  mechanicalClick(ctx, t, 2600, 0.014, 0.18);
  heavyThump(ctx, t + 0.015, 95, 46, 0.16, 0.45);
  mechanicalClick(ctx, t + 0.095, 1600, 0.026, 0.24);
}

/** Capture: the same lock action but harder — extra low mass and a sharper strike. */
export function playCaptureSfx(): void {
  const ctx = context();
  if (!ctx) return;
  const t = ctx.currentTime + 0.001;
  mechanicalClick(ctx, t, 2900, 0.016, 0.26);
  heavyThump(ctx, t + 0.01, 120, 40, 0.2, 0.55);
  heavyThump(ctx, t + 0.05, 70, 34, 0.18, 0.35);
  mechanicalClick(ctx, t + 0.11, 1400, 0.03, 0.28);
}
