/**
 * Tactile UI sound effects, played from pre-rendered 44.1 kHz 16-bit WAV files
 * (public/sfx/*.wav, generated offline by scripts/render-sfx.mjs — see that file
 * for the sound design: a machined lock in thick, high-density material).
 *
 * Each play gets a small random pitch variation so repeated actions sound like
 * a physical mechanism rather than a looped sample. Every entry point no-ops
 * safely when audio is unavailable.
 */

type SfxName = 'select' | 'move' | 'capture';

let audioCtx: AudioContext | null = null;
const buffers: Partial<Record<SfxName, AudioBuffer>> = {};
const rawFiles: Partial<Record<SfxName, Promise<ArrayBuffer>>> = {};

let sfxEnabled = true;
let masterVolume = 1;

export function setSfxEnabled(enabled: boolean): void {
  sfxEnabled = enabled;
}

export function setSfxVolume(volume: number): void {
  masterVolume = Math.max(0, Math.min(1, volume));
}

// Start downloading immediately at module load — decoding waits for the
// AudioContext, which browsers only allow after the first user gesture.
for (const name of ['select', 'move', 'capture'] as const) {
  rawFiles[name] = fetch(`${import.meta.env.BASE_URL}sfx/${name}.wav`)
    .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(`${r.status}`))))
    .catch(() => new ArrayBuffer(0));
}

function context(): AudioContext | null {
  try {
    audioCtx ??= new AudioContext();
    if (audioCtx.state === 'suspended') void audioCtx.resume();
    return audioCtx;
  } catch {
    return null;
  }
}

async function bufferFor(ctx: AudioContext, name: SfxName): Promise<AudioBuffer | null> {
  if (buffers[name]) return buffers[name]!;
  try {
    const raw = await rawFiles[name]!;
    if (raw.byteLength === 0) return null;
    buffers[name] = await ctx.decodeAudioData(raw.slice(0));
    return buffers[name]!;
  } catch {
    return null;
  }
}

function play(name: SfxName, volume: number): void {
  if (!sfxEnabled || masterVolume === 0) return;
  const ctx = context();
  if (!ctx) return;
  void bufferFor(ctx, name).then((buffer) => {
    if (!buffer) return;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.value = 0.96 + Math.random() * 0.08; // subtle mechanical variation
    const gain = ctx.createGain();
    gain.gain.value = volume * masterVolume;
    src.connect(gain);
    gain.connect(ctx.destination);
    src.start();
  });
}

/** Piece selected: the key seats and turns. */
export function playSelectSfx(): void {
  play('select', 0.75);
}

/** Piece moved: the bolt drives home. */
export function playMoveSfx(): void {
  play('move', 0.9);
}

/** Capture: the same lock action struck much harder. */
export function playCaptureSfx(): void {
  play('capture', 1.0);
}
