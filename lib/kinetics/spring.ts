/**
 * OmniAI — Kinetic Spring Physics Engine
 * ======================================
 * A tiny, dependency-free spring model used to give every interactive
 * surface (panels, cockpit buttons, data nodes) physics-based motion:
 * spring tension (stiffness k), mass, and a friction dampening ratio.
 *
 * Components use `useSpring()` / `useKineticPress()` from the matching
 * React hooks below. The model is also exported for deterministic tests.
 *
 * Behaviour targets: "bounce, slide, compress, and snap satisfyingly upon
 * engagement, firing ambient neon violet / radiant emerald edge waves".
 */

export interface SpringConfig {
  /** Spring stiffness / tension. */
  k: number;
  /** Mass of the simulated object. */
  mass: number;
  /** Damping ratio (1 = critically damped). */
  damping: number;
  /** Rest value. */
  rest: number;
}

export interface SpringState {
  value: number;
  velocity: number;
}

export const SPRINGS = {
  /** Snappy UI button press. */
  crisp: { k: 260, mass: 1, damping: 0.85, rest: 0 } as SpringConfig,
  /** Heavier panel lift. */
  panel: { k: 150, mass: 1.4, damping: 0.9, rest: 0 } as SpringConfig,
  /** Bouncy, delightful reference. */
  bouncy: { k: 210, mass: 0.85, damping: 0.62, rest: 0 } as SpringConfig,
  /** Coil for repeated micro-interactions. */
  coil: { k: 320, mass: 0.7, damping: 0.72, rest: 0 } as SpringConfig,
};

/** Integrate one spring step toward `target` with semi-implicit Euler. */
export function stepSpring(
  state: SpringState,
  target: number,
  cfg: SpringConfig,
  dt: number,
): SpringState {
  if (dt <= 0) return state;
  // Clamp dt to avoid explosion on tab-blur.
  const t = Math.min(dt, 0.06);
  const force = -cfg.k * (state.value - target);
  const dampingForce = -cfg.damping * cfg.mass * state.velocity;
  const acceleration = (force + dampingForce) / cfg.mass;
  let velocity = state.velocity + acceleration * t;
  const value = state.value + velocity * t;
  return { value, velocity };
}

export function springRK4(
  value0: number,
  vel0: number,
  target: number,
  cfg: SpringConfig,
  dt: number,
): SpringState {
  const deriv = (s: SpringState): SpringState => {
    const force = -cfg.k * (s.value - target) - cfg.damping * cfg.mass * s.velocity;
    return { value: s.velocity, velocity: force / cfg.mass };
  };
  const a = deriv({ value: value0, velocity: vel0 });
  const b = deriv({ value: value0 + a.value * dt * 0.5, velocity: vel0 + a.velocity * dt * 0.5 });
  const c = deriv({ value: value0 + b.value * dt * 0.5, velocity: vel0 + b.velocity * dt * 0.5 });
  const d = deriv({ value: value0 + c.value * dt, velocity: vel0 + c.velocity * dt });
  return {
    value: value0 + ((a.value + 2 * b.value + 2 * c.value + d.value) * dt) / 6,
    velocity: vel0 + ((a.velocity + 2 * b.velocity + 2 * c.velocity + d.velocity) * dt) / 6,
  };
}

export function atRest(state: SpringState, cfg: SpringConfig, tolerance = 1e-4): boolean {
  return Math.abs(state.velocity) < tolerance && Math.abs(state.value - cfg.rest) < tolerance;
}

/** Oscillator damper — cheap closed-form spring response. */
export function dampedSpring(
  target: number,
  value: number,
  velocity: number,
  k: number,
  damping: number,
  dt: number,
): { value: number; velocity: number } {
  const cfg: SpringConfig = { k, mass: 1, damping, rest: target };
  return stepSpring({ value, velocity }, target, cfg, dt);
}

export interface KineticEdgeWave {
  /** CSS custom property carrying the clicked-origin radial glow. */
  originX: number;
  originY: number;
  /** Accent key mapped to intensity. */
  intensity: number;
  startedAt: number;
}

export function buildEdgeWaveOrigin(el: HTMLElement, clientX: number, clientY: number): KineticEdgeWave {
  const r = el.getBoundingClientRect();
  return {
    originX: clientX - r.left,
    originY: clientY - r.top,
    intensity: 1,
    startedAt: performance.now(),
  };
}
