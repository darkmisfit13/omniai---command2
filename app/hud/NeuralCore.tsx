"use client";

import { useEffect, useRef } from "react";

/**
 * NeuralCore — the dashboard's signal visualizer, rebuilt as a true 3D scene.
 *
 * The composition comes from the OmniAI build (wireframe core, studio
 * signal waves crossing it, interrupted instrument rings with orbiting nodes,
 * telemetry ticks and moving signal packets). The rendering is the same
 * WebGL stack the chat orb uses: a perspective camera, a fresnel glass shell
 * you can press a thumb into, an additive wireframe that dims on its far
 * side, and a bloom that swells with live activity.
 *
 * Drag to orbit the core. Everything else is driven by `levels` — one 0..1
 * value per studio system, exactly like the legend under the canvas.
 */

export type NeuralCoreProps = {
  /** 0..1 activity per studio lane. */
  levels?: number[];
  /** Hex colour per lane; falls back to the platform palette. */
  colors?: string[];
  /** A check or generation is running right now. */
  active?: boolean;
  /** Flash ring while a burst is in flight. */
  pulse?: boolean;
  className?: string;
  label?: string;
};

const PALETTE = [
  "#a78bfa",
  "#00f2fe",
  "#e879f9",
  "#6ee7b7",
  "#c4b5fd",
  "#7dd3fc",
  "#f0abfc",
  "#fcd34d",
];

/* The core itself wears the studio palette — violet shell with a light
   violet rim — so it reads as part of the app regardless of which systems
   are reporting. The coloured rings provide the variety. */
const ORB_PRIMARY = "#a78bfa";
const ORB_ACCENT = "#c4b5fd";

/* Orbit rings circling the core: green, purple, blue, light blue. */
const ORBIT_COLORS = ["#6ee7b7", "#a78bfa", "#38bdf8", "#00f2fe"];

function hexToRgb(hex: string): [number, number, number] {
  const value = hex.replace("#", "").trim();
  const full =
    value.length === 3
      ? value
          .split("")
          .map((c) => c + c)
          .join("")
      : value;
  const num = Number.parseInt(full.slice(0, 6) || "a78bfa", 16);
  if (Number.isNaN(num)) return [0.65, 0.55, 0.98];
  return [((num >> 16) & 255) / 255, ((num >> 8) & 255) / 255, (num & 255) / 255];
}

/* ------------------------------------------------------------------ *
 * Shaders. The displaced-vertex shell is the chat orb's: pointer press
 * dents the surface so the core feels solid under the cursor.
 * ------------------------------------------------------------------ */

const VERT_DISPLACE = `
precision highp float;

attribute vec3 aPosition;
attribute vec3 aNormal;
attribute vec2 aUV;

uniform mat4 uProjection;
uniform mat4 uModelView;
uniform mat3 uNormalMat;
uniform float uTime;
uniform float uEnergy;
uniform float uWaveSpeed;
uniform vec2  uPointer;
uniform float uPress;
uniform float uPointSize;

varying float vDisp;
varying vec3  vNormal;
varying vec3  vView;
varying vec2  vUV;

float waveLayer(vec3 p, float t) {
  return sin(p.x * 3.1 + t)
       * sin(p.y * 2.7 - t * 1.13)
       * sin(p.z * 3.4 + t * 0.71);
}

void main() {
  float t = uTime * uWaveSpeed;
  vec3 p = aPosition;

  float w = waveLayer(p, t) * 0.55
          + waveLayer(p * 2.13 + 5.0, t * 1.7) * 0.28
          + waveLayer(p * 4.37 - 3.0, t * 2.6) * 0.14;

  float amp  = 0.038 * (0.5 + uEnergy * 1.1);
  float disp = w * amp;

  vec4 mv  = uModelView * vec4(p, 1.0);
  vec4 c0  = uProjection * mv;
  vec2 ndc = c0.xy / max(abs(c0.w), 0.0001);

  float d    = distance(ndc, uPointer);
  float soft = exp(-d * d * 11.0) * uPress;
  disp -= soft * 0.30;

  vec3 n = normalize(uNormalMat * aNormal);
  mv.xyz += n * disp;

  gl_Position = uProjection * mv;
  gl_PointSize = uPointSize;
  vNormal = n;
  vView   = normalize(-mv.xyz);
  vDisp   = disp;
  vUV     = aUV;
}
`;

const FRAG_SHELL = `
precision highp float;

varying float vDisp;
varying vec3  vNormal;
varying vec3  vView;
varying vec2  vUV;

uniform vec3  uColorA;
uniform vec3  uColorB;
uniform float uGlow;
uniform float uTime;
uniform float uAlpha;

void main() {
  float ndv  = max(dot(normalize(vNormal), normalize(vView)), 0.0);
  float fres = pow(1.0 - ndv, 2.2);

  vec2 g  = abs(fract(vUV * vec2(30.0, 15.0)) - 0.5);
  float line = 1.0 - smoothstep(0.0, 0.11, min(g.x, g.y));

  float pulse = 0.5 + 0.5 * sin(vUV.y * 34.0 - uTime * 3.0);

  vec3 col = mix(uColorA, uColorB, clamp(vDisp * 16.0 + 0.5, 0.0, 1.0));
  col += uColorB * fres * 1.15;
  col += uColorA * line * 0.42;
  col += uColorB * pulse * fres * 0.5;

  float a = (fres * 0.72 + line * 0.30 + 0.08) * uAlpha;
  gl_FragColor = vec4(col * uGlow, clamp(a, 0.0, 1.0));
}
`;

const FRAG_WIRE = `
precision highp float;

varying float vDisp;
varying vec3  vNormal;
varying vec3  vView;
varying vec2  vUV;

uniform vec3  uColorA;
uniform vec3  uColorB;
uniform float uGlow;

void main() {
  float ndv  = max(dot(normalize(vNormal), normalize(vView)), 0.0);
  float depthShade = mix(0.24, 1.0, pow(ndv, 0.6));
  vec3 col = mix(uColorA, uColorB, clamp(vDisp * 16.0 + 0.5, 0.0, 1.0));
  col = col * col * 2.1;
  gl_FragColor = vec4(col * uGlow * depthShade, 0.34);
}
`;

const FRAG_SPARK = `
precision highp float;

varying float vDisp;
varying vec3  vNormal;
varying vec3  vView;
varying vec2  vUV;

uniform vec3  uColorB;
uniform float uGlow;
uniform float uAlpha;

void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = dot(c, c);
  if (d > 0.25) discard;
  float a = smoothstep(0.25, 0.0, d);
  gl_FragColor = vec4(uColorB * uGlow, a * 0.7 * uAlpha);
}
`;

/** Colour travels with the vertex so one program draws waves, rings and ticks. */
const VERT_SIMPLE = `
precision highp float;

attribute vec3 aPosition;
attribute vec3 aColor;

uniform mat4  uProjection;
uniform mat4  uModelView;
uniform float uPointSize;

varying vec3 vColor;

void main() {
  vColor = aColor;
  gl_Position = uProjection * uModelView * vec4(aPosition, 1.0);
  gl_PointSize = uPointSize;
}
`;

const FRAG_LINE = `
precision mediump float;
varying vec3 vColor;
uniform float uAlpha;
void main() {
  gl_FragColor = vec4(vColor * uAlpha, 1.0);
}
`;

const FRAG_DOT = `
precision mediump float;
varying vec3 vColor;
uniform float uAlpha;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = dot(c, c);
  if (d > 0.25) discard;
  float a = smoothstep(0.25, 0.0, d);
  gl_FragColor = vec4(vColor * a * uAlpha, 1.0);
}
`;

const VERT_BLOOM = `
precision highp float;
attribute vec2 aPosition;
varying vec2 vUV;
uniform mat4 uProjection;
uniform mat4 uModelView;
void main() {
  vUV = aPosition * 0.5 + 0.5;
  // A wide plane sitting behind the core so the glow haloes it.
  gl_Position = uProjection * uModelView * vec4(aPosition * 3.4, -1.6, 1.0);
}
`;

const FRAG_BLOOM = `
precision mediump float;
varying vec2 vUV;
uniform vec3  uColor;
uniform float uIntensity;
uniform float uPhase;
void main() {
  float d = distance(vUV, vec2(0.5));
  float a = pow(smoothstep(0.5, 0.0, d), 2.4);
  // A travelling highlight: the waves' own light pooling on the dark
  // screen behind the core. It bounces off the block — a constant-speed
  // ping-pong on x (triangle wave) that reverses at the edges as the
  // sphere turns, with a soft vertical sway.
  float tri = asin(clamp(sin(uPhase), -1.0, 1.0)) * 0.6366;
  vec2 drift = vec2(tri, sin(uPhase * 0.8) * 0.55) * 0.12;
  float d2 = distance(vUV, vec2(0.5) + drift);
  float b = pow(smoothstep(0.42, 0.0, d2), 3.0) * 0.5;
  float glow = (a + b) * uIntensity;
  // Alpha tracks the falloff so the canvas stays transparent outside the
  // halo — the core floats on the page instead of sitting in a black box.
  gl_FragColor = vec4(uColor * glow, glow);
}
`;

/* ------------------------------------------------------------------ *
 * Matrices — same conventions as the chat orb.
 * ------------------------------------------------------------------ */

type Mat4 = Float32Array;

function perspective(fovy: number, aspect: number, near: number, far: number): Mat4 {
  const f = 1 / Math.tan(fovy / 2);
  const nf = 1 / (near - far);
  return new Float32Array([
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (far + near) * nf, -1,
    0, 0, 2 * far * near * nf, 0,
  ]);
}

function multiply(a: Mat4, b: Mat4): Mat4 {
  const out = new Float32Array(16);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      out[c * 4 + r] =
        a[r] * b[c * 4] +
        a[4 + r] * b[c * 4 + 1] +
        a[8 + r] * b[c * 4 + 2] +
        a[12 + r] * b[c * 4 + 3];
    }
  }
  return out;
}

function rotY(rad: number): Mat4 {
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return new Float32Array([c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]);
}

function rotX(rad: number): Mat4 {
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return new Float32Array([1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]);
}

function translateZ(rad: number): Mat4 {
  return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, rad, 1]);
}

/* ------------------------------------------------------------------ *
 * Geometry
 * ------------------------------------------------------------------ */

type SphereGeometry = {
  verts: Float32Array;
  normals: Float32Array;
  uvs: Float32Array;
  tris: Uint16Array;
  wire: Uint16Array;
  spark: Uint16Array;
  count: number;
};

/** 13 latitude rings + 16 meridians — the Hub core's mesh, at real depth. */
function buildSphere(segU = 64, segV = 24): SphereGeometry {
  const verts: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const tris: number[] = [];
  const wire: number[] = [];
  const spark: number[] = [];

  for (let v = 0; v <= segV; v++) {
    const theta = (v / segV) * Math.PI;
    const st = Math.sin(theta);
    const ct = Math.cos(theta);
    for (let u = 0; u <= segU; u++) {
      const phi = (u / segU) * Math.PI * 2;
      const x = st * Math.cos(phi);
      const y = ct;
      const z = st * Math.sin(phi);
      verts.push(x, y, z);
      normals.push(x, y, z);
      uvs.push(u / segU, v / segV);
    }
  }

  const stride = segU + 1;
  for (let v = 0; v < segV; v++) {
    for (let u = 0; u < segU; u++) {
      const a = v * stride + u;
      const b = a + 1;
      const c = a + stride;
      const d = c + 1;
      tris.push(a, c, b, b, c, d);
    }
  }

  // Latitude rings every 2 rows (13 rings), meridians every 4 columns (16).
  for (let v = 0; v <= segV; v += 2) {
    for (let u = 0; u < segU; u++) {
      const a = v * stride + u;
      wire.push(a, a + 1);
    }
  }
  for (let u = 0; u <= segU; u += 4) {
    for (let v = 0; v < segV; v++) {
      const a = v * stride + u;
      wire.push(a, a + stride);
    }
  }

  // Sparkle nodes at the mesh intersections.
  for (let v = 0; v <= segV; v += 2) {
    for (let u = 0; u <= segU; u += 4) {
      spark.push(v * stride + u);
    }
  }

  return {
    verts: new Float32Array(verts),
    normals: new Float32Array(normals),
    uvs: new Float32Array(uvs),
    tris: new Uint16Array(tris),
    wire: new Uint16Array(wire),
    spark: new Uint16Array(spark),
    count: verts.length / 3,
  };
}

/* ------------------------------------------------------------------ */

type Signal = {
  levels: number[];
  colors: string[];
  active: boolean;
  pulse: boolean;
};

export default function NeuralCore({
  levels = [],
  colors = [],
  active = false,
  pulse = false,
  className = "",
  label = "OmniAI neural core",
}: NeuralCoreProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const signalRef = useRef<Signal>({ levels, colors, active, pulse });
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

    let programs: {
      shell: WebGLProgram;
      wire: WebGLProgram;
      spark: WebGLProgram;
      line: WebGLProgram;
      dot: WebGLProgram;
      bloom: WebGLProgram;
    };
    let geo: SphereGeometry;

    try {
      programs = {
        shell: link(VERT_DISPLACE, FRAG_SHELL),
        wire: link(VERT_DISPLACE, FRAG_WIRE),
        spark: link(VERT_DISPLACE, FRAG_SPARK),
        line: link(VERT_SIMPLE, FRAG_LINE),
        dot: link(VERT_SIMPLE, FRAG_DOT),
        bloom: link(VERT_BLOOM, FRAG_BLOOM),
      };
      geo = buildSphere();
    } catch (error) {
      el.dataset.error = error instanceof Error ? error.message : String(error);
      el.dataset.fallback = "1";
      return;
    }

    const loc = (p: WebGLProgram, n: string) => gl!.getUniformLocation(p, n);
    const attrib = (p: WebGLProgram, n: string) => gl!.getAttribLocation(p, n);

    /* ---- buffers ---- */
    function staticBuffer(data: ArrayBufferView) {
      const b = gl!.createBuffer();
      gl!.bindBuffer(gl!.ARRAY_BUFFER, b);
      gl!.bufferData(gl!.ARRAY_BUFFER, data, gl!.STATIC_DRAW);
      return b;
    }

    const bufPos = staticBuffer(geo.verts);
    const bufNrm = staticBuffer(geo.normals);
    const bufUv = staticBuffer(geo.uvs);

    const bufTri = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bufTri);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, geo.tris, gl.STATIC_DRAW);

    const bufWire = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bufWire);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, geo.wire, gl.STATIC_DRAW);

    const bufSpark = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bufSpark);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, geo.spark, gl.STATIC_DRAW);

    // Bloom backdrop quad.
    const bufBloom = staticBuffer(
      new Float32Array([-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1]),
    );

    // Dynamic line geometry: waves + ticks + orbit rings, rebuilt each frame.
    const LINE_SEGS = 88;
    const MAX_LANES = 8;
    const lineCapacity =
      (MAX_LANES * 2 * LINE_SEGS * 2 + 64 * 2 + ORBIT_COLORS.length * (56 * 2 + 2)) * 6 + 64;
    const lineData = new Float32Array(lineCapacity);
    const bufLines = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, bufLines);
    gl.bufferData(gl.ARRAY_BUFFER, lineData.byteLength, gl.DYNAMIC_DRAW);

    // Dynamic point geometry: signal packets + cycling sparks + orbit nodes.
    const dotCapacity = (MAX_LANES * 2 + 6 * 2 + ORBIT_COLORS.length) * 6;
    const dotData = new Float32Array(dotCapacity);
    const bufDots = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, bufDots);
    gl.bufferData(gl.ARRAY_BUFFER, dotData.byteLength, gl.DYNAMIC_DRAW);

    /* ---- interaction ---- */
    let yaw = 0.5;
    let pitch = -0.22;
    let yawVel = reduceMotion ? 0 : 0.003;
    let pitchVel = 0;
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    let pointer: [number, number] = [10, 10];
    let press = 0;
    let pressTarget = 0;
    let visible = true;
    let energy = 0;
    let phase = 0;

    function toNdc(e: PointerEvent): [number, number] {
      const rect = el.getBoundingClientRect();
      return [
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        1 - ((e.clientY - rect.top) / rect.height) * 2,
      ];
    }

    function onPointerDown(e: PointerEvent) {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      pressTarget = 1;
      pointer = toNdc(e);
      el.setPointerCapture(e.pointerId);
    }
    function onPointerMove(e: PointerEvent) {
      pointer = toNdc(e);
      if (!dragging) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      yaw += dx * 0.008;
      pitch += dy * 0.007;
      pitch = Math.max(-1.2, Math.min(1.2, pitch));
      yawVel = dx * 0.0018;
      pitchVel = dy * 0.0014;
    }
    function onPointerUp(e: PointerEvent) {
      dragging = false;
      pressTarget = 0;
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
    }
    function onPointerLeave() {
      dragging = false;
      pressTarget = 0;
      pointer = [10, 10];
    }

    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", onPointerUp);
    el.addEventListener("pointercancel", onPointerUp);
    el.addEventListener("pointerleave", onPointerLeave);

    const io = new IntersectionObserver(
      (entries) => {
        visible = entries[0]?.isIntersecting ?? true;
      },
      { threshold: 0.01 },
    );
    io.observe(el);

    function onContextLost(event: Event) {
      event.preventDefault();
      visible = false;
    }
    el.addEventListener("webglcontextlost", onContextLost);

    /* ---- sizing ---- */
    let width = 0;
    let height = 0;
    let aspect = 1;

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
        aspect = w / Math.max(h, 1);
      }
    }

    /* ---- scene constants ---- */
    const FOV = 0.72;
    const DIST = 4.3; // fits the outer telemetry ring inside a wide panel
    const SPHERE_R = 0.95;
    const WAVE_Z = SPHERE_R + 0.1;
    const HALF_H = DIST * Math.tan(FOV / 2); // world units visible top→centre

    /* ---- palette cache ---- */
    let cachedColors: string[] = [];
    let cachedRgb: [number, number, number][] = [];
    const orbPrimary = hexToRgb(ORB_PRIMARY);
    const orbAccent = hexToRgb(ORB_ACCENT);
    const orbitRgb = ORBIT_COLORS.map(hexToRgb);

    function rgbFor(index: number, list: string[]): [number, number, number] {
      if (cachedColors !== list) {
        cachedColors = list;
        cachedRgb = list.map(hexToRgb);
      }
      if (cachedRgb.length === 0) cachedRgb = PALETTE.map(hexToRgb);
      const rgb = cachedRgb[index % cachedRgb.length];
      return rgb ?? [0.65, 0.55, 0.98];
    }

    function paletteRgb(index: number): [number, number, number] {
      const rgb = PALETTE[index % PALETTE.length];
      return hexToRgb(rgb);
    }

    /* ---- render ---- */
    function render(now: number) {
      const { levels: lv, colors: cols, active: isActive, pulse: flash } = signalRef.current;

      resize();

      const lanes = Math.max(1, Math.min(MAX_LANES, lv.length || 6));
      const liveCount = lv.filter((v) => v > 0.15).length;
      const target = Math.min(liveCount, 8) / 8 + (isActive || flash ? 0.7 : 0);
      energy += (target - energy) * 0.06;

      const dt = 1 / 60;
      if (!reduceMotion) phase += dt * (0.18 + energy * 1.2);

      if (!dragging && !reduceMotion) {
        yawVel += (0.003 + energy * 0.012 - yawVel) * 0.02;
        pitchVel *= 0.94;
        yaw += yawVel;
        pitch += pitchVel;
        pitch += (-0.2 - pitch) * 0.006;
      }
      press += (pressTarget - press) * 0.16;

      const time = reduceMotion ? 1.4 : now / 1000;
      const projection = perspective(FOV, aspect, 0.1, 100);
      const baseView = translateZ(-DIST);
      // The core never changes size — activity reads as light and speed only.
      // The heartbeat swell was removed on request: rotation, waves, glow and
      // spin all respond to energy, the silhouette stays put.
      const scaledBase = baseView;
      const modelView = multiply(baseView, multiply(rotX(pitch), rotY(yaw)));

      const g = gl!;
      g.viewport(0, 0, width, height);
      g.clearColor(0, 0, 0, 0);
      g.clear(g.COLOR_BUFFER_BIT | g.DEPTH_BUFFER_BIT);
      g.enable(g.DEPTH_TEST);
      g.depthFunc(g.LEQUAL);
      g.enable(g.BLEND);

      // The orb wears the studio palette; strand colours only dress the waves.
      const primary = orbPrimary;
      const accent = orbAccent;
      const energyGlow = 0.85 + energy * 1.15;

      /* 1 — bloom backdrop, additive, behind everything. */
      g.depthMask(false);
      g.disable(g.DEPTH_TEST);
      g.blendFunc(g.ONE, g.ONE);
      g.useProgram(programs.bloom);
      g.uniformMatrix4fv(loc(programs.bloom, "uProjection"), false, projection);
      g.uniformMatrix4fv(loc(programs.bloom, "uModelView"), false, scaledBase);
      g.uniform3f(loc(programs.bloom, "uColor"), primary[0] * 0.5, primary[1] * 0.5, primary[2] * 0.62);
      g.uniform1f(loc(programs.bloom, "uIntensity"), 0.1 + energy * 0.34 + press * 0.1);
      // The highlight drifts with the wave phase: the orb's own light
      // moving across the dark screen behind it.
      g.uniform1f(loc(programs.bloom, "uPhase"), phase);
      {
        const a = attrib(programs.bloom, "aPosition");
        g.bindBuffer(g.ARRAY_BUFFER, bufBloom);
        g.enableVertexAttribArray(a);
        g.vertexAttribPointer(a, 2, g.FLOAT, false, 0, 0);
        g.drawArrays(g.TRIANGLES, 0, 6);
      }

      g.enable(g.DEPTH_TEST);

      /* Shared uniforms for the displaced sphere programs. */
      const normalMat = new Float32Array([
        modelView[0], modelView[1], modelView[2],
        modelView[4], modelView[5], modelView[6],
        modelView[8], modelView[9], modelView[10],
      ]);

      function setDisplaced(p: WebGLProgram) {
        g.useProgram(p);
        g.uniformMatrix4fv(loc(p, "uProjection"), false, projection);
        g.uniformMatrix4fv(loc(p, "uModelView"), false, modelView);
        g.uniformMatrix3fv(loc(p, "uNormalMat"), false, normalMat);
        g.uniform1f(loc(p, "uTime"), time);
        g.uniform1f(loc(p, "uEnergy"), 0.35 + energy);
        g.uniform1f(loc(p, "uWaveSpeed"), 0.55 + energy * 1.6);
        g.uniform2f(loc(p, "uPointer"), pointer[0], pointer[1]);
        g.uniform1f(loc(p, "uPress"), press);
        g.uniform3f(loc(p, "uColorA"), primary[0], primary[1], primary[2]);
        g.uniform3f(loc(p, "uColorB"), accent[0], accent[1], accent[2]);
        const aPos = attrib(p, "aPosition");
        const aNrm = attrib(p, "aNormal");
        const aUv = attrib(p, "aUV");
        // A fragment shader that never reads a varying lets the linker drop
        // its attribute; enabling location -1 would raise GL_INVALID_VALUE.
        if (aPos >= 0) {
          g.bindBuffer(g.ARRAY_BUFFER, bufPos);
          g.enableVertexAttribArray(aPos);
          g.vertexAttribPointer(aPos, 3, g.FLOAT, false, 0, 0);
        }
        if (aNrm >= 0) {
          g.bindBuffer(g.ARRAY_BUFFER, bufNrm);
          g.enableVertexAttribArray(aNrm);
          g.vertexAttribPointer(aNrm, 3, g.FLOAT, false, 0, 0);
        }
        if (aUv >= 0) {
          g.bindBuffer(g.ARRAY_BUFFER, bufUv);
          g.enableVertexAttribArray(aUv);
          g.vertexAttribPointer(aUv, 2, g.FLOAT, false, 0, 0);
        }
      }

      /* 2 — far shell: the interior you look into. */
      g.depthMask(true);
      g.blendFunc(g.SRC_ALPHA, g.ONE_MINUS_SRC_ALPHA);
      g.enable(g.CULL_FACE);
      g.cullFace(g.FRONT);
      setDisplaced(programs.shell);
      g.uniform1f(loc(programs.shell, "uGlow"), energyGlow);
      g.uniform1f(loc(programs.shell, "uAlpha"), 1.0);
      g.bindBuffer(g.ELEMENT_ARRAY_BUFFER, bufTri);
      g.drawElements(g.TRIANGLES, geo.tris.length, g.UNSIGNED_SHORT, 0);

      /* 3 — wireframe mesh, additive and depth-tested. */
      g.depthMask(false);
      g.blendFunc(g.SRC_ALPHA, g.ONE);
      setDisplaced(programs.wire);
      g.uniform1f(loc(programs.wire, "uGlow"), energyGlow);
      g.bindBuffer(g.ELEMENT_ARRAY_BUFFER, bufWire);
      g.drawElements(g.LINES, geo.wire.length, g.UNSIGNED_SHORT, 0);

      /* 4 — spark nodes riding the mesh. */
      setDisplaced(programs.spark);
      g.uniform1f(loc(programs.spark, "uGlow"), 0.9 + energy * 0.6);
      g.uniform1f(loc(programs.spark, "uAlpha"), 0.55 + energy * 0.45);
      g.uniform1f(loc(programs.spark, "uPointSize"), Math.max(2, 2.2 * (window.devicePixelRatio || 1)));
      g.bindBuffer(g.ELEMENT_ARRAY_BUFFER, bufSpark);
      g.drawElements(g.POINTS, geo.spark.length, g.UNSIGNED_SHORT, 0);

      /* 5 — studio waves, telemetry ticks and instrument rings (CPU lit). */
      const lineCount = buildLines(lv, cols, lanes);
      if (lineCount > 0) {
        g.useProgram(programs.line);
        g.uniformMatrix4fv(loc(programs.line, "uProjection"), false, projection);
        g.uniformMatrix4fv(loc(programs.line, "uModelView"), false, scaledBase);
        g.uniform1f(loc(programs.line, "uAlpha"), 0.78 + energy * 0.5);
        g.uniform1f(loc(programs.line, "uPointSize"), 1);
        const aPos = attrib(programs.line, "aPosition");
        const aCol = attrib(programs.line, "aColor");
        g.bindBuffer(g.ARRAY_BUFFER, bufLines);
        g.bufferSubData(g.ARRAY_BUFFER, 0, lineData.subarray(0, lineCount * 6));
        g.enableVertexAttribArray(aPos);
        g.vertexAttribPointer(aPos, 3, g.FLOAT, false, 24, 0);
        g.enableVertexAttribArray(aCol);
        g.vertexAttribPointer(aCol, 3, g.FLOAT, false, 24, 12);
        g.drawArrays(g.LINES, 0, lineCount);
      }

      /* 6 — signal packets + orbiting nodes. */
      const dotCount = buildDots(lv, cols, lanes);
      if (dotCount > 0) {
        g.useProgram(programs.dot);
        g.uniformMatrix4fv(loc(programs.dot, "uProjection"), false, projection);
        g.uniformMatrix4fv(loc(programs.dot, "uModelView"), false, scaledBase);
        g.uniform1f(loc(programs.dot, "uAlpha"), 1);
        g.uniform1f(
          loc(programs.dot, "uPointSize"),
          Math.max(3, 3.6 * (window.devicePixelRatio || 1)),
        );
        const aPos = attrib(programs.dot, "aPosition");
        const aCol = attrib(programs.dot, "aColor");
        g.bindBuffer(g.ARRAY_BUFFER, bufDots);
        g.bufferSubData(g.ARRAY_BUFFER, 0, dotData.subarray(0, dotCount * 6));
        g.enableVertexAttribArray(aPos);
        g.vertexAttribPointer(aPos, 3, g.FLOAT, false, 24, 0);
        g.enableVertexAttribArray(aCol);
        g.vertexAttribPointer(aCol, 3, g.FLOAT, false, 24, 12);
        g.drawArrays(g.POINTS, 0, dotCount);
      }

      /* 7 — near shell: glass over the core. */
      g.blendFunc(g.SRC_ALPHA, g.ONE_MINUS_SRC_ALPHA);
      g.cullFace(g.BACK);
      setDisplaced(programs.shell);
      g.uniform1f(loc(programs.shell, "uGlow"), energyGlow);
      g.uniform1f(loc(programs.shell, "uAlpha"), 0.62);
      g.bindBuffer(g.ELEMENT_ARRAY_BUFFER, bufTri);
      g.drawElements(g.TRIANGLES, geo.tris.length, g.UNSIGNED_SHORT, 0);

      g.disable(g.CULL_FACE);
      g.depthMask(true);
    }

    /* ---- CPU-built scene lines: waves, ticks, rings ---- */

    let waveXMax = 1.8;

    function waveY(lane: number, lanes: number, nx: number, level: number, sub: number) {
      const spacing = lanes > 6 ? 0.13 : 0.16;
      const y0 = (lane - (lanes - 1) / 2) * spacing;
      const taper = Math.sin(nx * Math.PI);
      const amp = 0.05 + level * 0.11 + energy * 0.05;
      return (
        y0 +
        Math.sin(nx * 12 + phase * (lane + 1) + sub * 0.35 + lane) * amp * taper
      );
    }

    function pushLine(
      data: Float32Array,
      cursor: { i: number },
      ax: number, ay: number, az: number,
      bx: number, by: number, bz: number,
      r: number, gr: number, b: number,
    ) {
      const i = cursor.i;
      if (i + 12 > data.length) return;
      data[i] = ax; data[i + 1] = ay; data[i + 2] = az;
      data[i + 3] = r; data[i + 4] = gr; data[i + 5] = b;
      data[i + 6] = bx; data[i + 7] = by; data[i + 8] = bz;
      data[i + 9] = r; data[i + 10] = gr; data[i + 11] = b;
      cursor.i = i + 12;
    }

    function pushPoint(
      data: Float32Array,
      cursor: { i: number },
      x: number, y: number, z: number,
      r: number, gr: number, b: number,
    ) {
      const i = cursor.i;
      if (i + 6 > data.length) return;
      data[i] = x; data[i + 1] = y; data[i + 2] = z;
      data[i + 3] = r; data[i + 4] = gr; data[i + 5] = b;
      cursor.i = i + 6;
    }

    // Orbiting node positions are computed with the rings, read by the dots.
    const nodePositions: [number, number, number][] = ORBIT_COLORS.map(() => [0, 0, 0]);
    const nodeColors: [number, number, number][] = ORBIT_COLORS.map(() => [1, 1, 1]);

    function buildLines(
      lv: number[],
      cols: string[],
      lanes: number,
    ): number {
      const cursor = { i: 0 };
      const primary = cols.length ? rgbFor(0, cols) : paletteRgb(0);
      const accent = cols.length ? rgbFor(1, cols) : paletteRgb(1);

      // Studio signal waves crossing the core, in front of the shell.
      waveXMax = Math.max(1.1, HALF_H * aspect * 0.98);
      for (let s = 0; s < lanes; s++) {
        const level = Math.max(0, Math.min(1, lv[s] ?? 0));
        const rgb = cols.length ? rgbFor(s, cols) : paletteRgb(s);
        const base = 0.1 + level * 0.5 + energy * 0.12;

        for (let sub = 0; sub < 2; sub++) {
          const k = sub === 0 ? base : base * 0.45;
          const r = rgb[0] * k;
          const gr = rgb[1] * k;
          const b = rgb[2] * k;
          let prevX = -waveXMax;
          let prevY = waveY(s, lanes, 0, level, sub);
          for (let i = 1; i <= LINE_SEGS; i++) {
            const nx = i / LINE_SEGS;
            const x = -waveXMax + nx * 2 * waveXMax;
            const y = waveY(s, lanes, nx, level, sub);
            pushLine(lineData, cursor, prevX, prevY, WAVE_Z, x, y, WAVE_Z, r, gr, b);
            prevX = x;
            prevY = y;
          }
        }
      }

      // Telemetry ticks — the fixed instrument bezel around the core.
      for (let i = 0; i < 64; i++) {
        const a = (i / 64) * Math.PI * 2;
        const outer = HALF_H * 0.93;
        const inner = outer - (i % 4 === 0 ? 0.075 : 0.04);
        const k = i % 4 === 0 ? 0.34 : 0.2;
        pushLine(
          lineData, cursor,
          Math.cos(a) * inner, Math.sin(a) * inner, 0,
          Math.cos(a) * outer, Math.sin(a) * outer, 0,
          primary[0] * k, primary[1] * k, primary[2] * k,
        );
      }

      // Interrupted instrument rings — one per orbit colour — with an
      // orbiting node baked in below.
      const RING_COUNT = ORBIT_COLORS.length;
      for (let ring = 0; ring < RING_COUNT; ring++) {
        const rr = SPHERE_R * (1.18 + ring * 0.15);
        const squash = 0.38 + ring * 0.15;
        const dir = ring % 2 === 0 ? 1 : -1;
        const a0 = phase * dir * (1 + ring * 0.22) + ring * 1.1;
        const span = Math.PI * (1.5 + (ring % 2) * 0.2);
        const tiltZ = (ring - 1.5) * 0.36;
        const tiltX = (ring - 1.5) * 0.3;
        // Green, purple, blue and light blue circles around the core.
        const rgb = orbitRgb[ring] ?? primary;
        const k = 0.55 + energy * 0.55;

        const toWorld = (a: number): [number, number, number] => {
          let x = Math.cos(a) * rr;
          let y = Math.sin(a) * rr * squash;
          let z = 0;
          // ring tilt
          let c = Math.cos(tiltZ); let sn = Math.sin(tiltZ);
          let nx = x * c - y * sn; let ny = x * sn + y * c;
          x = nx; y = ny;
          c = Math.cos(tiltX); sn = Math.sin(tiltX);
          ny = y * c - z * sn;
          let nz = y * sn + z * c;
          y = ny; z = nz;
          // follow the dragged core
          c = Math.cos(yaw); sn = Math.sin(yaw);
          nx = x * c + z * sn;
          nz = -x * sn + z * c;
          x = nx; z = nz;
          c = Math.cos(pitch); sn = Math.sin(pitch);
          ny = y * c - z * sn;
          const nzz = y * sn + z * c;
          y = ny; z = nzz;
          return [x, y, z];
        };

        const STEPS = 56;
        let prev = toWorld(a0);
        for (let i = 1; i <= STEPS; i++) {
          const a = a0 + (i / STEPS) * span;
          const p = toWorld(a);
          pushLine(lineData, cursor, prev[0], prev[1], prev[2], p[0], p[1], p[2], rgb[0] * k, rgb[1] * k, rgb[2] * k);
          prev = p;
        }
        // The orbiting node is a dot; stash its colour intent via a short tick.
        const node = toWorld(a0 + span * 0.62);
        pushLine(lineData, cursor, node[0] - 0.012, node[1], node[2], node[0] + 0.012, node[1], node[2], rgb[0] * 0.9, rgb[1] * 0.9, rgb[2] * 0.9);
        nodePositions[ring] = node;
        nodeColors[ring] = rgb;
      }

      return cursor.i / 6;
    }

    function buildDots(
      lv: number[],
      cols: string[],
      lanes: number,
    ): number {
      const cursor = { i: 0 };

      // Signal packets riding the waves.
      for (let s = 0; s < lanes; s++) {
        const level = Math.max(0, Math.min(1, lv[s] ?? 0));
        if (level < 0.12) continue;
        const rgb = cols.length ? rgbFor(s, cols) : paletteRgb(s);
        const p = (phase * 0.3 + s * 0.16) % 1;
        const nx = p;
        const x = -waveXMax + nx * 2 * waveXMax;
        const y = waveY(s, lanes, nx, level, 0);
        const k = 0.85 + level * 0.4;
        pushPoint(dotData, cursor, x, y, WAVE_Z, rgb[0] * k, rgb[1] * k, rgb[2] * k);

        // A trailing echo behind the packet.
        const p2 = (p - 0.045 + 1) % 1;
        const nx2 = p2;
        const x2 = -waveXMax + nx2 * 2 * waveXMax;
        const y2 = waveY(s, lanes, nx2, level, 0);
        const k2 = 0.35 + level * 0.25;
        pushPoint(dotData, cursor, x2, y2, WAVE_Z, rgb[0] * k2, rgb[1] * k2, rgb[2] * k2);
      }

      // Sparks cycling through the orb interior on inclined great circles.
      const SPARKS = 6;
      for (let i = 0; i < SPARKS; i++) {
        const rgb = orbitRgb[i % orbitRgb.length];
        const speed = 0.55 + (i % 3) * 0.3;
        const a = phase * speed * (i % 2 === 0 ? 1 : -1) + i * 2.3;
        // Radius wanders in and out so sparks pass through the shell.
        const r = SPHERE_R * (0.35 + 0.6 * (0.5 + 0.5 * Math.sin(phase * 0.7 + i)));
        const incl = i * 0.9;
        let x = Math.cos(a) * r;
        let y = Math.sin(a) * r;
        let z = Math.sin(a * 0.5 + i) * r * 0.4;
        // Tilt each spark path, then follow the dragged core.
        let c = Math.cos(incl); let sn = Math.sin(incl);
        let ny = y * c - z * sn;
        let nz = y * sn + z * c;
        y = ny; z = nz;
        c = Math.cos(yaw); sn = Math.sin(yaw);
        const nx2 = x * c + z * sn;
        nz = -x * sn + z * c;
        x = nx2; z = nz;
        c = Math.cos(pitch); sn = Math.sin(pitch);
        ny = y * c - z * sn;
        z = y * sn + z * c;
        y = ny;
        // Brighter with activity; a faint echo trails each spark.
        const k = 0.8 + energy * 0.7;
        pushPoint(dotData, cursor, x, y, z, rgb[0] * k, rgb[1] * k, rgb[2] * k);
        pushPoint(
          dotData, cursor,
          x * 0.86, y * 0.86, z * 0.86,
          rgb[0] * k * 0.35, rgb[1] * k * 0.35, rgb[2] * k * 0.35,
        );
      }

      // Orbiting nodes on the instrument rings.
      for (let ring = 0; ring < ORBIT_COLORS.length; ring++) {
        const node = nodePositions[ring];
        const rgb = nodeColors[ring];
        pushPoint(dotData, cursor, node[0], node[1], node[2], rgb[0], rgb[1], rgb[2]);
      }

      return cursor.i / 6;
    }

    /* ---- loop ---- */
    let raf = 0;
    let last = 0;

    function frame(now: number) {
      raf = requestAnimationFrame(frame);
      if (!visible || !gl) return;
      // Idle dashboards keep a calm frame rate; busy ones open up.
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

    const onVisibility = () => {
      if (document.hidden) {
        if (raf) { cancelAnimationFrame(raf); raf = 0; }
      } else if (!reduceMotion && !raf) {
        raf = requestAnimationFrame(frame);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    const onResize = () => {
      resize();
      if (reduceMotion) renderStatic();
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("resize", onResize);
      io.disconnect();
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", onPointerUp);
      el.removeEventListener("pointercancel", onPointerUp);
      el.removeEventListener("pointerleave", onPointerLeave);
      el.removeEventListener("webglcontextlost", onContextLost);
      redrawRef.current = () => undefined;
      // StrictMode remounts this effect on the same context. Leave no
      // vertex array enabled against the buffers we are about to delete,
      // or the next frame's drawArrays logs INVALID_OPERATION.
      for (let i = 0; i < 8; i++) {
        if (gl!.getVertexAttrib(i, gl!.VERTEX_ATTRIB_ARRAY_ENABLED)) {
          gl!.disableVertexAttribArray(i);
        }
      }
      [bufPos, bufNrm, bufUv, bufLines, bufDots, bufBloom].forEach(
        (b) => b && gl!.deleteBuffer(b),
      );
      [bufTri, bufWire, bufSpark].forEach((b) => b && gl!.deleteBuffer(b));
      Object.values(programs).forEach((p) => gl!.deleteProgram(p));
      // Release the context only on a real unmount (StrictMode-safe).
      setTimeout(() => {
        if (!canvas.isConnected) {
          const ext = (gl as WebGLRenderingContext | null)?.getExtension?.("WEBGL_lose_context");
          ext?.loseContext();
        }
      }, 0);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      role="img"
      aria-label={`${label}: ${levels.length} studio signals crossing a draggable 3D core`}
      draggable={false}
      style={{ display: "block", width: "100%", height: "100%", touchAction: "none", cursor: "grab" }}
    />
  );
}
