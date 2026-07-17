/**
 * Offline SFX renderer — generates the game's sound effects as 44.1 kHz 16-bit
 * stereo WAV files in public/sfx/. Run with: node scripts/render-sfx.mjs
 *
 * Sound design brief: the tactile action of a well-machined lock in thick,
 * high-density material. Each sound is layered from four families:
 *   - transient: a few ms of high-passed noise (the instant of metal contact)
 *   - clicks:    band-passed noise bursts (key teeth, tumblers, latches)
 *   - mass:      pitch-dropping sines with tanh drive (the block absorbing force)
 *   - material:  short inharmonic partials + a faint noise settle tail (density)
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SR = 44100;
const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// Deterministic noise so re-running the script produces identical WAVs.
let seed = 0x2a5f1c3d;
function rand() {
  seed ^= seed << 13;
  seed ^= seed >>> 17;
  seed ^= seed << 5;
  seed >>>= 0;
  return seed / 0xffffffff;
}
function noiseSample() {
  return rand() * 2 - 1;
}

function makeBuffer(seconds) {
  return new Float64Array(Math.ceil(seconds * SR));
}

/** Band-passed noise burst via a simple resonant filter (biquad, constant coefficients). */
function click(buf, at, { freq, q = 9, dur, vol }) {
  const start = Math.floor(at * SR);
  const n = Math.floor(dur * SR);
  const w0 = (2 * Math.PI * freq) / SR;
  const alpha = Math.sin(w0) / (2 * q);
  const b0 = alpha;
  const b2 = -alpha;
  const a0 = 1 + alpha;
  const a1 = -2 * Math.cos(w0);
  const a2 = 1 - alpha;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < n && start + i < buf.length; i++) {
    const x0 = noiseSample();
    const y0 = (b0 / a0) * x0 + (b2 / a0) * x2 - (a1 / a0) * y1 - (a2 / a0) * y2;
    x2 = x1; x1 = x0; y2 = y1; y1 = y0;
    const env = Math.exp((-5.5 * i) / n);
    buf[start + i] += y0 * env * vol;
  }
}

/** A few milliseconds of raw high-frequency contact — the "touch" of the sound. */
function transient(buf, at, { dur = 0.003, vol }) {
  const start = Math.floor(at * SR);
  const n = Math.floor(dur * SR);
  let prev = 0;
  for (let i = 0; i < n && start + i < buf.length; i++) {
    const x = noiseSample();
    const hp = x - prev * 0.95; // crude high-pass: difference against smoothed history
    prev = x;
    buf[start + i] += hp * (1 - i / n) * vol;
  }
}

/** Pitch-dropping sine with tanh drive — dense mass taking the blow. */
function mass(buf, at, { from, to, dur, vol, drive = 1.6 }) {
  const start = Math.floor(at * SR);
  const n = Math.floor(dur * SR);
  let phase = 0;
  for (let i = 0; i < n && start + i < buf.length; i++) {
    const t = i / n;
    const freq = from * Math.pow(to / from, t);
    phase += (2 * Math.PI * freq) / SR;
    const env = Math.exp(-5 * t);
    buf[start + i] += Math.tanh(Math.sin(phase) * drive) * env * vol;
  }
}

/** Short decaying sine partial — the ring of the material itself. */
function partial(buf, at, { freq, dur, vol }) {
  const start = Math.floor(at * SR);
  const n = Math.floor(dur * SR);
  for (let i = 0; i < n && start + i < buf.length; i++) {
    const t = i / n;
    buf[start + i] += Math.sin((2 * Math.PI * freq * i) / SR) * Math.exp(-6 * t) * vol;
  }
}

/** Quiet low-passed noise wash — felt/stone settle after the strike. */
function settle(buf, at, { dur, vol, cutoffMix = 0.08 }) {
  const start = Math.floor(at * SR);
  const n = Math.floor(dur * SR);
  let lp = 0;
  for (let i = 0; i < n && start + i < buf.length; i++) {
    lp += (noiseSample() - lp) * cutoffMix; // one-pole low-pass
    buf[start + i] += lp * Math.exp((-4 * i) / n) * vol;
  }
}

function normalize(buf, peakTarget = 0.88) {
  let peak = 0;
  for (const s of buf) peak = Math.max(peak, Math.abs(s));
  if (peak === 0) return buf;
  const g = peakTarget / peak;
  for (let i = 0; i < buf.length; i++) buf[i] *= g;
  return buf;
}

/** Writes a 16-bit stereo WAV; the right channel is delayed ~0.35 ms for physical width. */
function writeWav(path, mono) {
  const delay = Math.round(0.00035 * SR);
  const frames = mono.length + delay;
  const data = Buffer.alloc(frames * 4);
  for (let i = 0; i < frames; i++) {
    const l = i < mono.length ? mono[i] : 0;
    const r = i - delay >= 0 && i - delay < mono.length ? mono[i - delay] : 0;
    data.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(l * 32767))), i * 4);
    data.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(r * 32767))), i * 4 + 2);
  }
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(2, 22); // stereo
  header.writeUInt32LE(SR, 24);
  header.writeUInt32LE(SR * 4, 28);
  header.writeUInt16LE(4, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  writeFileSync(path, Buffer.concat([header, data]));
  console.log(`${path}  (${((header.length + data.length) / 1024).toFixed(1)} KB)`);
}

const outDir = join(root, 'public', 'sfx');
mkdirSync(outDir, { recursive: true });

// --- select: the key seats and turns ---
{
  const buf = makeBuffer(0.22);
  transient(buf, 0, { vol: 0.5 });
  click(buf, 0.001, { freq: 3300, dur: 0.02, vol: 0.55 });
  partial(buf, 0.002, { freq: 1240, dur: 0.05, vol: 0.1 });
  mass(buf, 0.002, { from: 210, to: 130, dur: 0.07, vol: 0.3, drive: 1.3 });
  // the tumbler giving way a beat later
  transient(buf, 0.055, { vol: 0.3 });
  click(buf, 0.056, { freq: 2150, dur: 0.024, vol: 0.42 });
  partial(buf, 0.057, { freq: 860, dur: 0.06, vol: 0.09 });
  settle(buf, 0.06, { dur: 0.12, vol: 0.05 });
  writeWav(join(outDir, 'select.wav'), normalize(buf, 0.72));
}

// --- move: the bolt drives home ---
{
  const buf = makeBuffer(0.34);
  transient(buf, 0, { vol: 0.55 });
  click(buf, 0.001, { freq: 2650, dur: 0.016, vol: 0.4 });
  mass(buf, 0.012, { from: 105, to: 44, dur: 0.19, vol: 0.85, drive: 2.1 });
  settle(buf, 0.015, { dur: 0.1, vol: 0.12, cutoffMix: 0.05 });
  partial(buf, 0.014, { freq: 340, dur: 0.09, vol: 0.12 });
  partial(buf, 0.014, { freq: 705, dur: 0.07, vol: 0.07 });
  // latch closing at the end of the throw
  transient(buf, 0.105, { vol: 0.35 });
  click(buf, 0.106, { freq: 1580, dur: 0.03, vol: 0.5 });
  partial(buf, 0.108, { freq: 520, dur: 0.08, vol: 0.1 });
  settle(buf, 0.11, { dur: 0.16, vol: 0.06 });
  writeWav(join(outDir, 'move.wav'), normalize(buf, 0.8));
}

// --- capture: the same action struck much harder ---
{
  const buf = makeBuffer(0.46);
  transient(buf, 0, { vol: 0.8 });
  click(buf, 0.001, { freq: 2950, dur: 0.018, vol: 0.55 });
  mass(buf, 0.008, { from: 130, to: 38, dur: 0.24, vol: 1.0, drive: 2.6 });
  mass(buf, 0.05, { from: 68, to: 30, dur: 0.2, vol: 0.55, drive: 2.0 });
  settle(buf, 0.01, { dur: 0.14, vol: 0.18, cutoffMix: 0.05 });
  partial(buf, 0.012, { freq: 305, dur: 0.12, vol: 0.15 });
  partial(buf, 0.012, { freq: 660, dur: 0.09, vol: 0.09 });
  partial(buf, 0.012, { freq: 1130, dur: 0.06, vol: 0.06 });
  // heavy latch slam
  transient(buf, 0.12, { vol: 0.45 });
  click(buf, 0.121, { freq: 1380, dur: 0.034, vol: 0.6 });
  partial(buf, 0.124, { freq: 470, dur: 0.1, vol: 0.12 });
  settle(buf, 0.13, { dur: 0.22, vol: 0.08 });
  writeWav(join(outDir, 'capture.wav'), normalize(buf, 0.86));
}
