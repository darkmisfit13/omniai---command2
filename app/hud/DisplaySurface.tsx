"use client";

import { useEffect, useRef } from "react";

/**
 * DisplaySurface — the deck's glass, rendered in real WebGL.
 *
 * Every command-deck display (KPI tiles, panels, sunk LED wells) mounts one of
 * these behind its content: a single full-screen quad whose fragment shader
 * paints the material itself — the brushed violet-charcoal face, the machined
 * top-edge glint, the grain, the display lines, the room light drifting across
 * the glass, and the accent glow that breathes with the check state. That way
 * the displays are genuinely WebGL rather than a CSS imitation of one, and the
 * hero core and the panels light each other in the same idiom.
 *
 * Lifecycle notes (important — do not regress):
 *   - One shared requestAnimationFrame drives every surface on the page.
 *   - Off-screen surfaces are skipped via IntersectionObserver.
 *   - Rendering pauses while the document is hidden and resumes on visibility.
 *   - WebGL context loss is handled: the canvas falls back to its CSS material
 *     (no white plate) and resources are rebuilt on restore.
 *   - Contexts are released on real unmount via a deferred loseContext() that
 *     is skipped during React StrictMode's synchronous double-invoke (the canvas
 *     is still connected to the DOM in that case), so StrictMode never leaves a
 *     dead context behind while real unmounts still free their context.
 */

type SurfaceState = "idle" | "good" | "bad" | "busy";

const VERT = `
attribute vec2 aPos;
varying vec2 vUV;
void main() {
  vUV = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

const FRAG = `
precision mediump float;

varying vec2 vUV;
uniform vec2  uRes;
uniform float uTime;
uniform vec3  uAccent;
uniform float uGlow;
uniform float uHover;
uniform float uSeed;
uniform float uVariant;

float hash(vec2 p) {
  /* Fold to a small domain first: mediump (half float) can't hold the
     usual huge sin arguments — they go Inf and the grain renders NaN. */
  vec2 q = mod(floor(p) + vec2(uSeed * 13.0, uSeed * 7.0), 64.0);
  return fract(sin(dot(q, vec2(12.9898, 78.233))) * 10000.0);
}

void main() {
  vec2 uv = vUV;
  float px = 1.0 / max(1.0, uRes.y);

  /* Base material: violet-charcoal, lit from the upper left. */
  vec3 base = mix(vec3(0.086, 0.070, 0.130), vec3(0.036, 0.030, 0.062), pow(uv.y, 0.8));
  base += vec3(0.028, 0.020, 0.052) * (1.0 - uv.x) * (1.0 - uv.y);

  /* Machined weave — the diagonal brushing of the deck surface. */
  float weave = sin((uv.x * uRes.x + uv.y * uRes.y) * 0.45) * 0.5
              + sin((uv.x * uRes.x - uv.y * uRes.y) * 0.33) * 0.5;
  base += weave * 0.006;

  /* Fine grain so the face never reads as flat plastic. */
  base += (hash(floor(uv * uRes * 0.5)) - 0.5) * 0.016;

  /* Display lines. */
  float scan = sin(uv.y * uRes.y * 1.7) * 0.5 + 0.5;
  base *= 0.985 + scan * 0.03;

  /* The room light drifting over the glass — slow, never still. */
  float drift = sin(uTime * 0.16 + uSeed * 1.7) * 0.34;
  float band = exp(-pow(uv.x * 0.72 + uv.y * 0.4 - 0.56 - drift, 2.0) * 8.0);
  vec3 sheen = vec3(0.55, 0.5, 0.78) * band * 0.05;

  /* Accent light: the display's own glow, keyed to its check state. */
  float corner = exp(-distance(uv, vec2(1.0, 0.97)) * 1.7);
  float floorGlow = smoothstep(0.5, 0.0, uv.y) * 0.4;
  vec3 accentLit = uAccent * (corner * 0.85 + floorGlow * 0.4) * uGlow;
  accentLit += uAccent * uHover * 0.07;

  if (uVariant > 0.5) {
    /* Sunk LED well: darker seat, shadow under the top lip, light on the
       bottom lip — a window cut into the face. */
    base *= 0.42;
    base *= 1.0 - smoothstep(0.34, 0.0, 1.0 - uv.y) * 0.55;
    base += vec3(0.5, 0.46, 0.72) * smoothstep(0.16, 0.0, uv.y) * 0.05;
    accentLit = uAccent * (corner * 0.35 + 0.1) * uGlow;
  }

  /* Machined glint along the top edge, shade along the bottom lip. */
  float topEdge = smoothstep(3.0 * px, 0.0, 1.0 - uv.y);
  float lip = smoothstep(0.07, 0.0, uv.y);

  vec3 col = base + sheen + accentLit;
  col += mix(vec3(0.72, 0.68, 0.95), uAccent, 0.35) * topEdge * 0.11;
  col *= 1.0 - lip * 0.3;

  /* Corner vignette seats the face in its bezel. */
  float vig = distance(uv, vec2(0.5)) ;
  col *= 1.0 - vig * 0.16;

  gl_FragColor = vec4(col, 1.0);
}
`;

/** State → glow floor. Busy pulses in the draw loop. */
const GLOW: Record<SurfaceState, number> = {
  idle: 0.24,
  good: 0.52,
  bad: 0.4,
  busy: 0.55,
};

function hexToRgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  if (!Number.isFinite(n)) return [0.65, 0.55, 0.98];
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function compile(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

type Surface = {
  draw(time: number): void;
  dispose(): void;
};

const surfaces = new Set<Surface>();
let rafId = 0;
let pageHidden = typeof document !== "undefined" ? document.hidden : false;
let visibilityRegistered = false;

function onVisibilityChange() {
  pageHidden = document.hidden;
  if (pageHidden) {
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
  } else if (surfaces.size > 0 && !rafId) {
    rafId = requestAnimationFrame(tick);
  }
}

function ensureVisibilityListener() {
  if (visibilityRegistered || typeof document === "undefined") return;
  visibilityRegistered = true;
  document.addEventListener("visibilitychange", onVisibilityChange);
}

function tick(now: number) {
  if (pageHidden) {
    rafId = 0;
    return;
  }
  const time = now / 1000;
  for (const surface of surfaces) surface.draw(time);
  rafId = surfaces.size > 0 ? requestAnimationFrame(tick) : 0;
}

export default function DisplaySurface({
  accent = "#a78bfa",
  state = "idle",
  variant = "panel",
  seed = 1,
}: {
  /** Accent light colour — usually the strand colour of the live check. */
  accent?: string;
  /** Check state drives the glow floor; busy adds a pulse in the loop. */
  state?: SurfaceState;
  /** "panel" is the deck face, "well" is a sunken LED window. */
  variant?: "panel" | "well";
  /** Stable per-surface noise seed so each display grains differently. */
  seed?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const paramsRef = useRef({ accent, state, variant, seed });
  paramsRef.current = { accent, state, variant, seed };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    ensureVisibilityListener();

    const glRaw = canvas.getContext("webgl", {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      preserveDrawingBuffer: false,
      powerPreference: "low-power",
    });
    if (!glRaw) {
      canvas.style.display = "none";
      return;
    }
    const gl: WebGLRenderingContext = glRaw;

    let contextLost = false;
    let program: WebGLProgram | null = null;
    let vs: WebGLShader | null = null;
    let fs: WebGLShader | null = null;
    let buffer: WebGLBuffer | null = null;
    let u: {
      res: WebGLUniformLocation | null;
      time: WebGLUniformLocation | null;
      accent: WebGLUniformLocation | null;
      glow: WebGLUniformLocation | null;
      hover: WebGLUniformLocation | null;
      seed: WebGLUniformLocation | null;
      variant: WebGLUniformLocation | null;
    } | null = null;

    let visible = true;
    let hover = 0;
    let hoverTarget = 0;
    let width = 0;
    let height = 0;

    function buildResources(): boolean {
      vs = compile(gl, gl.VERTEX_SHADER, VERT);
      fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
      program = gl.createProgram();
      if (!vs || !fs || !program) return false;
      gl.attachShader(program, vs);
      gl.attachShader(program, fs);
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return false;
      gl.useProgram(program);

      buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
        gl.STATIC_DRAW,
      );
      const aPos = gl.getAttribLocation(program, "aPos");
      gl.enableVertexAttribArray(aPos);
      gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

      u = {
        res: gl.getUniformLocation(program, "uRes"),
        time: gl.getUniformLocation(program, "uTime"),
        accent: gl.getUniformLocation(program, "uAccent"),
        glow: gl.getUniformLocation(program, "uGlow"),
        hover: gl.getUniformLocation(program, "uHover"),
        seed: gl.getUniformLocation(program, "uSeed"),
        variant: gl.getUniformLocation(program, "uVariant"),
      };
      return true;
    }

    if (!buildResources()) {
      canvas.style.display = "none";
      return;
    }

    const parent = canvas.parentElement;
    const onEnter = () => {
      hoverTarget = 1;
    };
    const onLeave = () => {
      hoverTarget = 0;
    };
    parent?.addEventListener("pointerenter", onEnter);
    parent?.addEventListener("pointerleave", onLeave);

    const observer =
      typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver((entries) => {
            visible = entries[0]?.isIntersecting ?? true;
          })
        : null;
    observer?.observe(canvas);

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = Math.max(1, Math.round(rect.width * dpr));
      const h = Math.max(1, Math.round(rect.height * dpr));
      if (w === width && h === height) return;
      width = w;
      height = h;
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    };

    const onContextLost = (e: Event) => {
      e.preventDefault(); // required to allow restoration
      contextLost = true;
      // Fall back to the panel's CSS material so the app never goes white.
      canvas.style.display = "none";
      surfaces.delete(surface);
    };

    const onContextRestored = () => {
      contextLost = false;
      if (!buildResources()) {
        canvas.style.display = "none";
        return;
      }
      canvas.style.display = "";
      surfaces.add(surface);
      resize();
      surface.draw(0);
      if (!pageHidden && surfaces.size > 0 && !rafId) {
        rafId = requestAnimationFrame(tick);
      }
    };

    canvas.addEventListener("webglcontextlost", onContextLost);
    canvas.addEventListener("webglcontextrestored", onContextRestored);

    const surface: Surface = {
      draw(time: number) {
        if (contextLost || pageHidden || !visible || !canvas.isConnected || gl.isContextLost()) return;
        resize();
        if (!u) return;
        const { accent: hex, state: key, variant: kind, seed: s } = paramsRef.current;
        const [r, g, b] = hexToRgb(hex);
        const floor = GLOW[key];
        const glow = key === "busy" ? floor * (0.72 + 0.36 * Math.abs(Math.sin(time * 3.4))) : floor;
        hover += (hoverTarget - hover) * 0.12;

        gl.uniform2f(u.res, width, height);
        gl.uniform1f(u.time, time);
        gl.uniform3f(u.accent, r, g, b);
        gl.uniform1f(u.glow, glow);
        gl.uniform1f(u.hover, hover);
        gl.uniform1f(u.seed, s);
        gl.uniform1f(u.variant, kind === "well" ? 1 : 0);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
      },
      dispose() {
        parent?.removeEventListener("pointerenter", onEnter);
        parent?.removeEventListener("pointerleave", onLeave);
        observer?.disconnect();
      },
    };

    surfaces.add(surface);
    resize(); // Size the buffer before the first paint, not on the first frame.
    surface.draw(0);
    if (!pageHidden && !rafId) rafId = requestAnimationFrame(tick);

    return () => {
      surfaces.delete(surface);
      surface.dispose();
      canvas.removeEventListener("webglcontextlost", onContextLost);
      canvas.removeEventListener("webglcontextrestored", onContextRestored);
      if (program) gl.deleteProgram(program);
      if (vs) gl.deleteShader(vs);
      if (fs) gl.deleteShader(fs);
      if (buffer) gl.deleteBuffer(buffer);
      // Release the GL context, but only if the canvas has actually been removed
      // from the DOM. React StrictMode runs cleanup synchronously and is
      // immediately followed by a re-mount on the SAME canvas element; deferring
      // the check lets us tell a real unmount from a StrictMode double-invoke.
      setTimeout(() => {
        if (!canvas.isConnected) {
          const ext = gl.getExtension("WEBGL_lose_context");
          ext?.loseContext();
        }
      }, 0);
    };
  }, []);

  return <canvas ref={canvasRef} className="omni-display" aria-hidden="true" />;
}