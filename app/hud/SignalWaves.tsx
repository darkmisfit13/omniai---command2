"use client";

import { useEffect, useRef } from "react";

/**
 * SignalWaves — horizontal studio signal waves stretching full width.
 *
 * Based on the OmniAI NeuralCore: six horizontal lanes of animated waves
 * crossing the full canvas width, with instrument rings, telemetry ticks,
 * and signal packets. The canvas fills its container edge-to-edge.
 */

const PALETTE = [
  "#a78bfa", // violet (Video)
  "#00f2fe", // cyan (Overlay/Text)
  "#e879f9", // pink (Audio)
  "#6ee7b7", // green (Local AI)
  "#c4b5fd", // light violet (Database)
  "#7dd3fc", // light blue (Providers)
];

const ORBIT_COLORS = ["#6ee7b7", "#a78bfa", "#38bdf8", "#00f2fe"];

function hexToRgb(hex: string | undefined | null): [number, number, number] {
  if (typeof hex !== "string" || !hex.trim()) return [0.65, 0.55, 0.98];
  const value = hex.replace("#", "").trim();
  const full = value.length === 3 ? value.split("").map((c) => c + c).join("") : value;
  const num = Number.parseInt(full.slice(0, 6) || "a78bfa", 16);
  if (Number.isNaN(num)) return [0.65, 0.55, 0.98];
  return [((num >> 16) & 255) / 255, ((num >> 8) & 255) / 255, (num & 255) / 255];
}

const VERT = `
precision highp float;
attribute vec2 aPosition;
varying vec2 vUV;
void main() {
  vUV = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

const FRAG = `
precision highp float;
varying vec2 vUV;
uniform vec2 uRes;
uniform float uTime;
uniform float uEnergy;
uniform float uPhase;
uniform vec3 uColors[6];
uniform float uLevels[6];
uniform int uLanes;

float waveY(float lane, float lanes, float nx, float level, float sub) {
  float spacing = lanes > 6.0 ? 0.13 : 0.16;
  float y0 = (lane - (lanes - 1.0) / 2.0) * spacing;
  float taper = sin(nx * 3.14159);
  float amp = 0.05 + level * 0.11 + uEnergy * 0.05;
  return y0 + sin(nx * 12.0 + uPhase * (lane + 1.0) + sub * 0.35 + lane) * amp * taper;
}

void main() {
  vec2 uv = vUV;
  float px = 1.0 / max(1.0, uRes.y);

  /* Base: dark screen */
  vec3 base = vec3(0.02, 0.015, 0.03);
  base += vec3(0.01, 0.008, 0.02) * (1.0 - uv.x) * (1.0 - uv.y);

  /* Fine grain */
  float hash = fract(sin(dot(floor(uv * uRes * 0.5), vec2(12.9898, 78.233))) * 10000.0);
  base += (hash - 0.5) * 0.008;

  /* Draw waves for each lane */
  int lanes = uLanes < 6 ? uLanes : 6;
  for (int s = 0; s < 6; s++) {
    if (s >= lanes) break;
    float level = uLevels[s];
    if (level < 0.01) continue;
    vec3 rgb = uColors[s];
    float k = 0.1 + level * 0.5 + uEnergy * 0.12;
    for (int sub = 0; sub < 2; sub++) {
      float baseAmp = sub == 0 ? 1.0 : 0.45;
      float amp = (0.05 + level * 0.11 + uEnergy * 0.05) * baseAmp;
      float y0 = (float(s) - (float(lanes) - 1.0) / 2.0) * (float(lanes) > 6.0 ? 0.13 : 0.16);
      float x = uv.x * 2.0 - 1.0;
      float taper = sin((uv.x + 1.0) * 0.5 * 3.14159);
      float y = y0 + sin(uv.x * 12.0 + uPhase * (float(s) + 1.0) + float(sub) * 0.35 + float(s)) * amp * taper;
      float dist = abs(uv.y - (0.5 + y));
      float wave = smoothstep(0.008, 0.0, dist) * k;
      base += rgb * wave;
    }
  }

  /* Telemetry ticks around center */
  for (int i = 0; i < 64; i++) {
    float a = float(i) / 64.0 * 6.28318;
    float outer = 0.42;
    float inner = outer - (mod(float(i), 4.0) == 0.0 ? 0.03 : 0.018);
    float k = float(int(mod(float(i), 4.0))) == 0.0 ? 0.34 : 0.2;
    float dx = uv.x - 0.5;
    float dy = uv.y - 0.5;
    float d = length(vec2(dx, dy));
    if (d > inner && d < outer) {
      base += vec3(0.65, 0.55, 0.98) * k * smoothstep(0.0, 0.004, min(d - inner, outer - d));
    }
  }

  /* Instrument rings */
  for (int ring = 0; ring < 4; ring++) {
    float rr = 0.95 * (1.18 + float(ring) * 0.15);
    float squash = 0.38 + float(ring) * 0.15;
    float dir = (mod(float(ring), 2.0) == 0.0 ? 1.0 : -1.0);
    float a0 = uPhase * dir * (1.0 + float(ring) * 0.22) + float(ring) * 1.1;
    float span = 3.14159 * (1.5 + mod(float(ring), 2.0) * 0.2);
    float tiltZ = (float(ring) - 1.5) * 0.36;
    float tiltX = (float(ring) - 1.5) * 0.3;
    vec3 rgb = vec3(
      float(ring == 0 ? 0.431 : ring == 1 ? 0.655 : ring == 2 ? 0.22 : 0.0),
      float(ring == 0 ? 0.906 : ring == 1 ? 0.545 : ring == 2 ? 0.86 : 0.949),
      float(ring == 0 ? 0.718 : ring == 1 ? 0.98 : ring == 2 ? 0.97 : 0.996)
    );
    float k = 0.55 + uEnergy * 0.55;
    float dx = uv.x - 0.5;
    float dy = uv.y - 0.5;
    float x = dx;
    float y = dy;
    float c = cos(tiltZ); float sn = sin(tiltZ);
    float nx = x * c - y * sn; float ny = x * sn + y * c;
    x = nx; y = ny;
    c = cos(tiltX); sn = sin(tiltX);
    ny = y * c - 0.0 * sn;
    float nz = y * sn + 0.0 * c;
    y = ny;
    float r = length(vec2(x, y));
    float angle = atan(y, x);
    float diff = abs(angle - a0);
    if (diff > 3.14159) diff = 6.28318 - diff;
    if (diff < span * 0.5) {
      float ringDist = abs(r - rr);
      float ringWave = smoothstep(0.012, 0.0, ringDist) * k;
      base += rgb * ringWave;
    }
  }

  /* Scanlines */
  float scan = sin(uv.y * uRes.y * 1.7) * 0.5 + 0.5;
  base *= 0.985 + scan * 0.02;

  /* Vignette */
  float vig = distance(uv, vec2(0.5));
  base *= 1.0 - vig * 0.12;

  gl_FragColor = vec4(base, 1.0);
}
`; 

/* CSS fallback when WebGL unavailable */
const fallbackStyle: React.CSSProperties = {
  background: 
    "radial-gradient(ellipse at 50% 46%, rgba(8,5,17,0.52), rgba(5,4,11,0.62) 62%, rgba(4,3,9,0.68) 100%), " +
    "repeating-linear-gradient(112deg, rgba(255,255,255,0.014) 0 1px, transparent 1px 3px)",
  boxShadow: "inset 0 0 80px rgba(0,0,0,0.42)",
};

export default function SignalWaves({
  levels = [],
  colors = [],
  active = false,
  pulse = false,
  className = "",
}: {
  levels?: number[];
  colors?: string[];
  active?: boolean;
  pulse?: boolean;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const canvasFallback = useRef<HTMLDivElement | null>(null);
  const signalRef = useRef({ levels, colors, active, pulse });
  const redrawRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    signalRef.current = { levels, colors, active, pulse };
    redrawRef.current();
  }, [levels, colors, active, pulse]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const el: HTMLCanvasElement = canvas;

    let gl: WebGLRenderingContext | null = null;
    try {
      gl = (el.getContext("webgl", { alpha: true, antialias: true, premultipliedAlpha: false }) ||
        el.getContext("experimental-webgl")) as WebGLRenderingContext | null;
    } catch {
      gl = null;
    }
    if (!gl) {
      el.dataset.fallback = "1";
      return;
    }

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function compile(type: number, src: string) {
      const sh = gl!.createShader(type)!;
      gl!.shaderSource(sh, src);
      gl!.compileShader(sh);
      if (!gl!.getShaderParameter(sh, gl!.COMPILE_STATUS)) {
        const log = gl!.getShaderInfoLog(sh);
        gl!.deleteShader(sh);
        throw new Error(`shader: ${log ?? "compile failed"}`);
      }
      return sh;
    }

    function link(vs: string, fs: string) {
      const p = gl!.createProgram()!;
      const v = compile(gl!.VERTEX_SHADER, vs);
      const f = compile(gl!.FRAGMENT_SHADER, fs);
      gl!.attachShader(p, v);
      gl!.attachShader(p, f);
      gl!.linkProgram(p);
      gl!.deleteShader(v);
      gl!.deleteShader(f);
      if (!gl!.getProgramParameter(p, gl!.LINK_STATUS)) {
        const log = gl!.getProgramInfoLog(p);
        gl!.deleteProgram(p);
        throw new Error(`link: ${log ?? "link failed"}`);
      }
      return p;
    }

    let program: WebGLProgram;
    try {
      program = link(VERT, FRAG);
    } catch (error) {
      el.dataset.error = error instanceof Error ? error.message : String(error);
      el.dataset.fallback = "1";
      return;
    }

    /* Full-screen quad */
    const bufPos = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, bufPos);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );
    const aPos = gl.getAttribLocation(program, "aPosition");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const loc = (name: string) => gl!.getUniformLocation(program, name);

    const uRes = loc("uRes");
    const uTime = loc("uTime");
    const uEnergy = loc("uEnergy");
    const uPhase = loc("uPhase");
    const uColors = loc("uColors");
    const uLevels = loc("uLevels");
    const uLanes = loc("uLanes");

    let width = 0;
    let height = 0;

    function resize() {
      const rect = el.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(1, Math.round(rect.width * dpr));
      const h = Math.max(1, Math.round(rect.height * dpr));
      if (w !== width || h !== height) {
        width = w;
        height = h;
        el.width = w;
        el.height = h;
      }
    }

    let energy = 0;
    let phase = 0;

    function render(now: number) {
      const { levels: lv, colors: cols, active: isActive, pulse: flash } = signalRef.current;

      resize();

      const lanes = Math.max(1, Math.min(6, lv.length || 6));
      const liveCount = lv.filter((v) => v > 0.15).length;
      const target = Math.min(liveCount, 6) / 6 + (isActive || flash ? 0.7 : 0);
      energy += (target - energy) * 0.06;

      const dt = 1 / 60;
      if (!reduceMotion) phase += dt * (0.18 + energy * 1.2);

      const time = reduceMotion ? 1.4 : now / 1000;

      const g = gl!;
      g.viewport(0, 0, width, height);
      g.clearColor(0, 0, 0, 0);
      g.clear(g.COLOR_BUFFER_BIT);
      g.useProgram(program);

      const colorData = new Float32Array(6 * 3);
      const levelData = new Float32Array(6);
      for (let s = 0; s < 6; s++) {
        const level = Math.max(0, Math.min(1, lv[s] ?? 0));
        const rawHex = cols[s];
        const hex = typeof rawHex === "string" && rawHex.trim() ? rawHex : PALETTE[s % PALETTE.length];
        const [r, g2, b] = hexToRgb(hex);
        colorData[s * 3] = r;
        colorData[s * 3 + 1] = g2;
        colorData[s * 3 + 2] = b;
        levelData[s] = level;
      }

      g.uniform2f(uRes, width, height);
      g.uniform1f(uTime, time);
      g.uniform1f(uEnergy, energy);
      g.uniform1f(uPhase, phase);
      g.uniform3fv(uColors, colorData);
      g.uniform1fv(uLevels, levelData);
      g.uniform1i(uLanes, lanes);

      g.drawArrays(g.TRIANGLES, 0, 6);
    }

    let raf = 0;
    let last = 0;

    function frame(now: number) {
      raf = requestAnimationFrame(frame);
      const interval = energy > 0.25 ? 0 : 1000 / 30;
      if (interval && now - last < interval) return;
      last = now;
      render(now);
    }

    function renderStatic() {
      render(performance.now());
    }

    redrawRef.current = renderStatic;

    resize();
    renderStatic();

    if (!reduceMotion) {
      raf = requestAnimationFrame(frame);
    }

    const onResize = () => {
      resize();
      if (reduceMotion) renderStatic();
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      gl!.deleteBuffer(bufPos);
      gl!.deleteProgram(program);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const fallback = canvasFallback.current;
    if (!canvas || !fallback) return;
    // Show fallback if WebGL failed or canvas has no size
    const showFallback = canvas.dataset.fallback === "1" || canvas.width === 0 || canvas.height === 0;
    fallback.style.display = showFallback ? "block" : "none";
  }, []);

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <canvas
        ref={canvasRef}
        className={className}
        role="img"
        aria-label={`OmniAI signal waves: ${levels.length} studio signals`}
        draggable={false}
        style={{ width: "100%", height: "100%", display: "block" }}
      />
      <div
        ref={canvasFallback}
        style={fallbackStyle}
        aria-hidden="true"
      />
    </div>
  );
}