/**
 * OmniAI — Audio-Reactive Bus
 * ===========================
 * A single shared analyser that any media module can feed into, and any
 * visualiser (the cosmic backdrop) can read from every frame.
 *
 * Design notes / honesty:
 *  - One `AudioContext` + one `AnalyserNode` are created lazily on first
 *    attach. Every attached element routes element → analyser → destination,
 *    so audio keeps playing normally while its spectrum is exposed.
 *  - `createMediaElementSource` may only be called once per element, and it
 *    mutes the element's direct output if the media is cross-origin without
 *    CORS. To avoid ever muting playback, callers must only `attach()` a URL
 *    that passed `canAnalyzeUrl()`. Same-origin / blob / data always pass.
 *  - The analysis loop only spins while something is actually playing and
 *    idles out afterwards, so an idle tab does no audio work.
 *
 * This module is client-only; every entry point is a no-op on the server.
 */

export type AudioLevels = {
  /** 0..1 averaged low band (≈ 20–250 Hz). */
  bass: number;
  /** 0..1 averaged mid band (≈ 250 Hz–2 kHz). */
  mid: number;
  /** 0..1 averaged high band (≈ 2 kHz+). */
  treble: number;
  /** 0..1 overall loudness. */
  energy: number;
  /** 0..1 smoothed onset/transient envelope (decays between hits). */
  pulse: number;
  /** Whether the media graph is currently producing signal. */
  active: boolean;
};

const IDLE: AudioLevels = {
  bass: 0,
  mid: 0,
  treble: 0,
  energy: 0,
  pulse: 0,
  active: false,
};

let context: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
/** Inferred element type keeps this correct across TS lib versions. */
function newByteArray(size: number) {
  return new Uint8Array(size);
}
let frequency: ReturnType<typeof newByteArray> | null = null;
const attached = new WeakSet<HTMLMediaElement>();
const elements = new Set<HTMLMediaElement>();
const subscribers = new Set<(levels: AudioLevels) => void>();

let latest: AudioLevels = { ...IDLE };
let smoothedEnergy = 0;
let smoothedPulse = 0;
let raf = 0;
let idlingFrames = 0;

function ensureContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (context) return context;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  try {
    context = new Ctor();
  } catch {
    context = null;
  }
  return context;
}

function averageBand(data: Uint8Array, from: number, to: number): number {
  const start = Math.max(0, Math.floor(data.length * from));
  const end = Math.max(start + 1, Math.floor(data.length * to));
  let sum = 0;
  for (let i = start; i < end; i += 1) sum += data[i];
  return sum / (end - start) / 255;
}

function publish(levels: AudioLevels) {
  latest = levels;
  for (const listener of subscribers) {
    try {
      listener(levels);
    } catch {
      // A misbehaving visualiser must never break the bus.
    }
  }
}

function anyPlaying(): boolean {
  for (const el of elements) {
    if (!el.paused && !el.ended && el.readyState > 1) return true;
  }
  return false;
}

function tick() {
  raf = 0;
  if (!analyser || !frequency) return;

  analyser.getByteFrequencyData(frequency);

  const bass = averageBand(frequency, 0.0, 0.06);
  const mid = averageBand(frequency, 0.06, 0.25);
  const treble = averageBand(frequency, 0.25, 0.55);
  const energy = bass * 0.5 + mid * 0.34 + treble * 0.16;

  // Onset envelope: rise fast on a jump, fall smoothly afterwards.
  smoothedPulse = energy > smoothedPulse ? energy : smoothedPulse * 0.9;
  smoothedEnergy = smoothedEnergy * 0.72 + energy * 0.28;

  const playing = anyPlaying();
  if (!playing && smoothedEnergy < 0.004) {
    idlingFrames += 1;
    if (idlingFrames > 24) {
      publish({ ...IDLE });
      smoothedPulse = 0;
      smoothedEnergy = 0;
      return; // stop the loop until something plays again
    }
  } else {
    idlingFrames = 0;
  }

  publish({
    bass,
    mid,
    treble,
    energy: smoothedEnergy,
    pulse: smoothedPulse,
    active: playing,
  });

  raf = window.requestAnimationFrame(tick);
}

function start() {
  if (typeof window === "undefined") return;
  if (raf) return;
  idlingFrames = 0;
  raf = window.requestAnimationFrame(tick);
}

function onPlay() {
  void context?.resume().catch(() => undefined);
  start();
}

/**
 * Route a media element's output through the analyser once. Safe to call
 * repeatedly and on elements that are not yet loaded. Returns true if the
 * element is now contributing spectrum data.
 */
export function attach(element: HTMLMediaElement | null | undefined): boolean {
  if (!element) return false;
  if (attached.has(element)) return true;
  const ctx = ensureContext();
  if (!ctx) return false;
  try {
    const source = ctx.createMediaElementSource(element);
    if (!analyser) {
      analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.8;
      frequency = newByteArray(analyser.frequencyBinCount);
    }
    source.connect(analyser);
    analyser.connect(ctx.destination);
    attached.add(element);
    elements.add(element);
    element.addEventListener("play", onPlay);
    element.addEventListener("playing", onPlay);
    start();
    return true;
  } catch {
    return false;
  }
}

/** Latest levels — cheap to call every animation frame. */
export function getLevels(): AudioLevels {
  return latest;
}

/** Subscribe to level updates (mostly for non-rAF consumers). */
export function subscribe(listener: (levels: AudioLevels) => void): () => void {
  subscribers.add(listener);
  return () => subscribers.delete(listener);
}

/**
 * Whether a media URL can be analysed without risking muted playback.
 * Same-origin, blob: and data: sources are always safe; cross-origin
 * sources are probed for CORS before we route them through the graph.
 */
export async function canAnalyzeUrl(url: string): Promise<boolean> {
  if (typeof window === "undefined" || !url) return false;
  try {
    const parsed = new URL(url, window.location.href);
    if (parsed.origin === window.location.origin) return true;
    if (parsed.protocol === "blob:" || parsed.protocol === "data:") return true;

    const res = await fetch(parsed.toString(), {
      method: "GET",
      mode: "cors",
      headers: { Range: "bytes=0-1" },
    });
    return res.ok;
  } catch {
    return false;
  }
}

export const audioBus = {
  attach,
  getLevels,
  subscribe,
  canAnalyzeUrl,
};
