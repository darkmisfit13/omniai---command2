/**
 * OmniAI — Infinite Audio-Reactive Camera Geometry
 * =================================================
 * Pure mathematical camera-curve generators that turn a deep transient
 * audio envelope into simulated multi-axis mechanical camera maneuvers:
 *
 *   - dynamic speed-ramped dolly zooms (transient burst → pull)
 *   - kinetic 360-degree orbital loops (sweeps/grooves)
 *   - rhythmic lens-distortion glitches on musical crests
 *
 * Designed to run on an `AnalyserNode`. Exported helpers are pure functions
 * so they are trivially unit-testable and reusable from any component.
 */

export interface AudioFeatures {
  /** 0..1 RMS energy frame. */
  energy: number;
  /** Low-band (bass/heart) energy 0..1. */
  bass: number;
  /** Mid band energy 0..1. */
  mid: number;
  /** High band / transient sharpness 0..1. */
  high: number;
  /** Dominant transient strength 0..1 computed from derivative. */
  transient: number;
  /** Estimated BPM or fallback 120. */
  bpm: number;
}

export interface TransientPeak {
  t: number;
  strength: number;
}

export interface CameraTransform {
  /** Camera position in world space (m). */
  x: number;
  y: number;
  z: number;
  /** Camera look-at target. */
  targetX: number;
  targetY: number;
  targetZ: number;
  /** Roll in radians. */
  roll: number;
  /** Vertical FOV in degrees. */
  fov: number;
  /** Post-computed screen shake intensity 0..1. */
  shake: number;
  /** Lens distortion curvature 0..1. */
  distortion: number;
}

/** Wrap a value into [0, 2π). */
function wrap(t: number, period: number): number {
  const phase = (t / period) % 1;
  return phase < 0 ? phase + 1 : phase;
}

/** Smooth amplitude peak detection from a loudness envelope. */
export function detectTransients(samples: number[], minSep = 0.05): TransientPeak[] {
  const peaks: TransientPeak[] = [];
  let last = -Infinity;
  for (let i = 1; i < samples.length - 1; i += 1) {
    const a = samples[i - 1];
    const b = samples[i];
    const c = samples[i + 1];
    if (b > a && b >= c && b > 0.12 && i - last > minSep * samples.length) {
      peaks.push({ t: i / samples.length, strength: b });
      last = i;
    }
  }
  return peaks;
}

/** Build an attack/decay envelope keyed on the transients array. */
export function transientEnvelope(t: number, peaks: TransientPeak[], attack = 0.015, release = 0.18): number {
  let acc = 0;
  for (const p of peaks) {
    const delta = t - p.t;
    if (delta < 0) continue;
    const env = delta < attack ? p.strength * (delta / attack) : p.strength * Math.exp(-(delta - attack) / release);
    acc = Math.max(acc, env);
  }
  return acc;
}

/** Easing helpers. */
export const EASINGS = {
  smoothstep(x: number): number {
    const c = Math.max(0, Math.min(1, x));
    return c * c * (3 - 2 * c);
  },
  easeOutCubic(x: number): number {
    return 1 - (1 - Math.max(0, Math.min(1, x))) ** 3;
  },
  spring(x: number, stiffness = 120, damping = 14): number {
    // Critically-damped-ish approximation of a spring impulse.
    const wn = Math.sqrt(stiffness);
    const zeta = damping / (2 * Math.sqrt(stiffness));
    if (zeta < 1) {
      const wd = wn * Math.sqrt(1 - zeta * zeta);
      return (
        Math.exp(-zeta * wn * x) *
        (Math.cos(wd * x) + (zeta / Math.sqrt(1 - zeta * zeta)) * Math.sin(wd * x))
      );
    }
    return Math.exp(-wn * x) * (1 + wn * x);
  },
};

export function idleCamera(): CameraTransform {
  return { x: 0, y: 0, z: 6, targetX: 0, targetY: 0, targetZ: 0, roll: 0, fov: 58, shake: 0, distortion: 0 };
}

/** DOLLY ZOOM — speed-ramped push/pull into a subject on a transient. */
export function dollyZoom(f: AudioFeatures, tBeatPhase: number, transientEnv: number): CameraTransform {
  const pull = transientEnv * 3.2;
  const zoom = EASINGS.smoothstep(f.bass) * 8;
  return {
    x: 0,
    y: 0.6 - transientEnv * 1.2,
    z: 6 + pull * 1.6 - zoom * 0.4,
    targetX: 0,
    targetY: 0,
    targetZ: 0,
    roll: transientEnv * (Math.PI / 72),
    fov: 58 - transientEnv * 22 + zoom,
    shake: transientEnv * 0.5,
    distortion: transientEnv * 0.6,
  };
}

/** ORBITAL LOOP — kinetic 360 pan keyed to musical groove. */
export function orbitalLoop(f: AudioFeatures, tBeatPhase: number, transientEnv: number, radius = 7): CameraTransform {
  const angle = tBeatPhase * Math.PI * 2 + f.bass * 0.7;
  const r = radius + f.bass * 1.5 - transientEnv * 1.8;
  return {
    x: Math.cos(angle) * r,
    z: Math.sin(angle) * r,
    y: 1.2 + f.mid * 1.2 + Math.sin(angle * 1.5) * 0.6,
    targetX: 0,
    targetY: 0.4,
    targetZ: 0,
    roll: -angle * 0.08 + transientEnv * 0.15,
    fov: 52 + f.high * 6,
    shake: transientEnv * 0.3,
    distortion: transientEnv * 0.25,
  };
}

/** LENS GLITCH — rhythmic distortion beat-drop. */
export function lensGlitch(f: AudioFeatures, tBeatPhase: number, transientEnv: number): CameraTransform {
  const base = orbitalLoop(f, tBeatPhase, transientEnv * 0.5, 5.6);
  return {
    ...base,
    fov: base.fov + transientEnv * 18 * (Math.random() > 0.7 ? 1 : -1),
    distortion: 0.9 * transientEnv + 0.1,
    shake: 0.7 * transientEnv + 0.1,
    roll: base.roll + transientEnv * 0.4,
  };
}

export type CameraMode = "orbit" | "dolly" | "glitch" | "auto";

/** Synchronous, client-side camera path synthesis (mirrors the worker). */
export function buildCameraPath(features: number[], mode: CameraMode, n = 120): {
  i: number; x: number; y: number; z: number; energy: number; transient: number;
}[] {
  const out: { i: number; x: number; y: number; z: number; energy: number; transient: number }[] = [];
  for (let i = 0; i < n; i += 1) {
    const phase = i / n;
    const energy = features[i % Math.max(features.length, 1)] || 0;
    let x = Math.cos(phase * Math.PI * 2) * 6 * (1 + energy * 0.2);
    let y = 1 + energy * 0.5;
    let z = 6 + energy * 1.5;
    if (mode === "dolly") { z = 6 + energy * 3; x = 0; }
    if (mode === "glitch") { x += (Math.random() - 0.5) * 0.4; z += (Math.random() - 0.5) * 0.4; }
    out.push({ i, x, y, z, energy, transient: energy > 0.6 ? energy : 0 });
  }
  return out;
}

export function synthesizeCamera(mode: CameraMode, f: AudioFeatures, beatPhase: number, transientEnv: number): CameraTransform {
  if (mode === "orbit") return orbitalLoop(f, beatPhase, transientEnv);
  if (mode === "dolly") return dollyZoom(f, beatPhase, transientEnv);
  if (mode === "glitch") return lensGlitch(f, beatPhase, transientEnv);
  const hi = f.transient > 0.6;
  if (hi) return dollyZoom(f, beatPhase, transientEnv);
  const groove = f.mid * f.bass;
  if (groove > 0.5) return orbitalLoop(f, beatPhase, transientEnv);
  return idleCamera();
}
