"use client";

import { useEffect, useRef } from "react";

export type OrbState = "idle" | "thinking" | "speaking" | "listening";

type Props = {
  state?: OrbState;
  className?: string;
  /** Render the caption under the orb. Callers that show their own status can hide it. */
  showLabel?: boolean;
};

/* ------------------------------------------------------------------ *
 * Minimal mat4 helpers. The orb carries its own projection so the mesh
 * is a genuine perspective scene — you can orbit it and see the sides.
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

/* ------------------------------------------------------------------ */

const VERT = `
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

  // Layered travelling waves: the "mesh wavelength" surface.
  float w = waveLayer(p, t) * 0.55
          + waveLayer(p * 2.13 + 5.0, t * 1.7) * 0.28
          + waveLayer(p * 4.37 - 3.0, t * 2.6) * 0.14;

  float amp  = 0.052 * (0.5 + uEnergy * 1.4);
  float disp = w * amp;

  vec4 mv  = uModelView * vec4(p, 1.0);
  vec4 c0  = uProjection * mv;
  vec2 ndc = c0.xy / max(abs(c0.w), 0.0001);

  // Touch: the pointer presses an indentation into the shell.
  float d    = distance(ndc, uPointer);
  float soft = exp(-d * d * 11.0) * uPress;
  disp -= soft * 0.36;

  vec3 n = normalize(uNormalMat * aNormal);
  mv.xyz += n * disp;

  gl_Position = uProjection * mv;
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

  // Latitude / longitude graticule, anti-aliased against the mesh density.
  vec2 g  = abs(fract(vUV * vec2(30.0, 15.0)) - 0.5);
  float line = 1.0 - smoothstep(0.0, 0.11, min(g.x, g.y));

  float pulse = 0.5 + 0.5 * sin(vUV.y * 34.0 - uTime * 3.0);

  vec3 col = mix(uColorA, uColorB, clamp(vDisp * 16.0 + 0.5, 0.0, 1.0));
  col += uColorB * fres * 1.15;
  col += uColorA * line * 0.42;
  col += uColorB * pulse * fres * 0.5;

  // Brighter at the rim, like a lit plasma shell.
  float a = (fres * 0.72 + line * 0.30 + 0.08) * uAlpha;
  gl_FragColor = vec4(col * uGlow, clamp(a, 0.0, 1.0));
}
`;

const FRAG_MESH = `
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
  float depthShade = mix(0.30, 1.0, pow(ndv, 0.6));   // far side dims, near side pops
  vec3 col = mix(uColorA, uColorB, clamp(vDisp * 16.0 + 0.5, 0.0, 1.0));
  // Additive lines saturate toward white where they pile up, so keep each
  // contribution low and let the hue survive the accumulation.
  col = col * col * 1.9;
  gl_FragColor = vec4(col * uGlow * depthShade, 0.30);
}
`;

const FRAG_POINT = `
precision highp float;
varying float vDisp;
varying vec3  vNormal;
varying vec3  vView;
varying vec2  vUV;

uniform vec3  uColorB;
uniform float uGlow;

void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = dot(c, c);
  if (d > 0.25) discard;
  float a = smoothstep(0.25, 0.0, d);
  gl_FragColor = vec4(uColorB * uGlow, a * 0.75);
}
`;

/* Palettes — original violet family plus the stream cyan for rim light. */
const PALETTES: Record<OrbState, { a: [number, number, number]; b: [number, number, number]; energy: number; speed: number; glow: number }> = {
  idle:      { a: [0.424, 0.388, 1.0], b: [0.545, 0.498, 1.0], energy: 0.34, speed: 0.55, glow: 1.0 },
  thinking:  { a: [0.424, 0.388, 1.0], b: [0.0,   0.949, 0.996], energy: 1.0,  speed: 2.4,  glow: 1.55 },
  speaking:  { a: [0.545, 0.498, 1.0], b: [0.0,   0.949, 0.996], energy: 0.78, speed: 1.7,  glow: 1.3 },
  listening: { a: [1.0,   0.165, 0.427], b: [0.545, 0.498, 1.0], energy: 0.6,  speed: 1.1,  glow: 1.15 },
};

const LABELS: Record<OrbState, string> = {
  idle: "Standing by",
  thinking: "Thinking…",
  speaking: "Responding…",
  listening: "Listening",
};

type Geometry = {
  verts: Float32Array;
  normals: Float32Array;
  uvs: Float32Array;
  tris: Uint16Array;
  lines: Uint16Array;
  count: number;
};

function buildSphere(segU: number, segV: number): Geometry {
  const verts: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const tris: number[] = [];
  const lines: number[] = [];

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

  // Wireframe: every 3rd ring and every 4th meridian keeps it readable.
  for (let v = 0; v <= segV; v += 3) {
    for (let u = 0; u < segU; u++) {
      const a = v * stride + u;
      lines.push(a, a + 1);
    }
  }
  for (let u = 0; u <= segU; u += 4) {
    for (let v = 0; v < segV; v++) {
      const a = v * stride + u;
      lines.push(a, a + stride);
    }
  }

  return {
    verts: new Float32Array(verts),
    normals: new Float32Array(normals),
    uvs: new Float32Array(uvs),
    tris: new Uint16Array(tris),
    lines: new Uint16Array(lines),
    count: verts.length / 3,
  };
}

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const sh = gl.createShader(type)!;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh);
    gl.deleteShader(sh);
    throw new Error(`shader: ${log ?? "compile failed"}`);
  }
  return sh;
}

function link(gl: WebGLRenderingContext, vs: string, fs: string) {
  const p = gl.createProgram()!;
  const v = compile(gl, gl.VERTEX_SHADER, vs);
  const f = compile(gl, gl.FRAGMENT_SHADER, fs);
  gl.attachShader(p, v);
  gl.attachShader(p, f);
  gl.linkProgram(p);
  gl.deleteShader(v);
  gl.deleteShader(f);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(p);
    gl.deleteProgram(p);
    throw new Error(`link: ${log ?? "link failed"}`);
  }
  return p;
}

const STATE_TO_LABEL: OrbState = "idle";

export default function HoloOrb({ state = "idle", className = "", showLabel = true }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef<OrbState>(state);
  stateRef.current = state;

  const labelRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Aliased with a non-nullable type so the hoisted pointer handlers
    // below can close over it without re-narrowing on every call.
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

    let programs: { shell: WebGLProgram; mesh: WebGLProgram; point: WebGLProgram };
    let geo: Geometry;
    try {
      programs = {
        shell: link(gl, VERT, FRAG_SHELL),
        mesh: link(gl, VERT, FRAG_MESH),
        point: link(gl, VERT, FRAG_POINT),
      };
      geo = buildSphere(48, 30);
    } catch (error) {
      // Keep the reason on the element so a failed orb can be diagnosed
      // from the DOM instead of a swallowed exception.
      el.dataset.error = error instanceof Error ? error.message : String(error);
      el.dataset.fallback = "1";
      return;
    }

    /* ---- buffers ---- */
    const bufPos = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, bufPos);
    gl.bufferData(gl.ARRAY_BUFFER, geo.verts, gl.STATIC_DRAW);

    const bufNrm = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, bufNrm);
    gl.bufferData(gl.ARRAY_BUFFER, geo.normals, gl.STATIC_DRAW);

    const bufUv = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, bufUv);
    gl.bufferData(gl.ARRAY_BUFFER, geo.uvs, gl.STATIC_DRAW);

    const bufTri = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bufTri);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, geo.tris, gl.STATIC_DRAW);

    const bufLine = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bufLine);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, geo.lines, gl.STATIC_DRAW);

    /* ---- interaction state ---- */
    let yaw = 0.5;
    let pitch = -0.25;
    let yawVel = reduceMotion ? 0 : 0.0032;
    let pitchVel = 0;
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    let pointer: [number, number] = [10, 10]; // offscreen until hovered
    let press = 0;
    let pressTarget = 0;
    let visible = true;

    const uniformsOf = (p: WebGLProgram) => ({
      projection: gl!.getUniformLocation(p, "uProjection"),
      modelView: gl!.getUniformLocation(p, "uModelView"),
      normalMat: gl!.getUniformLocation(p, "uNormalMat"),
      time: gl!.getUniformLocation(p, "uTime"),
      energy: gl!.getUniformLocation(p, "uEnergy"),
      waveSpeed: gl!.getUniformLocation(p, "uWaveSpeed"),
      pointer: gl!.getUniformLocation(p, "uPointer"),
      press: gl!.getUniformLocation(p, "uPress"),
      colorA: gl!.getUniformLocation(p, "uColorA"),
      colorB: gl!.getUniformLocation(p, "uColorB"),
      glow: gl!.getUniformLocation(p, "uGlow"),
      alpha: gl!.getUniformLocation(p, "uAlpha"),
      aPos: gl!.getAttribLocation(p, "aPosition"),
      aNrm: gl!.getAttribLocation(p, "aNormal"),
      aUv: gl!.getAttribLocation(p, "aUV"),
    });

    const U = {
      shell: uniformsOf(programs.shell),
      mesh: uniformsOf(programs.mesh),
      point: uniformsOf(programs.point),
    };

    function bindAttribs(u: ReturnType<typeof uniformsOf>) {
      const g = gl!;
      g.bindBuffer(g.ARRAY_BUFFER, bufPos);
      g.enableVertexAttribArray(u.aPos);
      g.vertexAttribPointer(u.aPos, 3, g.FLOAT, false, 0, 0);
      g.bindBuffer(g.ARRAY_BUFFER, bufNrm);
      g.enableVertexAttribArray(u.aNrm);
      g.vertexAttribPointer(u.aNrm, 3, g.FLOAT, false, 0, 0);
      g.bindBuffer(g.ARRAY_BUFFER, bufUv);
      g.enableVertexAttribArray(u.aUv);
      g.vertexAttribPointer(u.aUv, 2, g.FLOAT, false, 0, 0);
    }

    function setCommon(u: ReturnType<typeof uniformsOf>, projection: Mat4, modelView: Mat4, time: number, pal: (typeof PALETTES)[OrbState]) {
      const g = gl!;
      const normalMat = new Float32Array([
        modelView[0], modelView[1], modelView[2],
        modelView[4], modelView[5], modelView[6],
        modelView[8], modelView[9], modelView[10],
      ]);
      g.uniformMatrix4fv(u.projection, false, projection);
      g.uniformMatrix4fv(u.modelView, false, modelView);
      g.uniformMatrix3fv(u.normalMat, false, normalMat);
      g.uniform1f(u.time, time);
      g.uniform1f(u.energy, pal.energy);
      g.uniform1f(u.waveSpeed, pal.speed);
      g.uniform2f(u.pointer, pointer[0], pointer[1]);
      g.uniform1f(u.press, press);
      g.uniform3fv(u.colorA, pal.a);
      g.uniform3fv(u.colorB, pal.b);
      g.uniform1f(u.glow, pal.glow);
    }

    /* ---- sizing ---- */
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
      yaw += dx * 0.007;
      pitch += dy * 0.006;
      pitch = Math.max(-1.3, Math.min(1.3, pitch));
      yawVel = dx * 0.0016;
      pitchVel = dy * 0.0012;
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
      { threshold: 0.01 }
    );
    io.observe(el);

    // A lost context cannot be revived on this canvas, so stand the orb
    // down rather than leaving a black square. Preventing the default is
    // what lets the browser hand a restored context back at all.
    function onContextLost(event: Event) {
      event.preventDefault();
      visible = false;
    }
    el.addEventListener("webglcontextlost", onContextLost);

    /* ---- render loop ---- */
    let raf = 0;
    const t0 = performance.now();
    let smoothedEnergy = 0.34;

    function frame(now: number) {
      raf = requestAnimationFrame(frame);
      if (!visible || !gl) return;

      resize();
      const pal = PALETTES[stateRef.current] ?? PALETTES.idle;

      // Ease energy so state changes swell rather than snap.
      smoothedEnergy += (pal.energy - smoothedEnergy) * 0.05;
      press += (pressTarget - press) * 0.16;

      if (!dragging && !reduceMotion) {
        yawVel += (0.0032 - yawVel) * 0.02;
        pitchVel *= 0.94;
        yaw += yawVel;
        pitch += pitchVel;
        pitch += (-0.22 - pitch) * 0.006;
      }

      const time = reduceMotion ? 0 : (now - t0) / 1000;
      const aspect = width / Math.max(height, 1);
      const projection = perspective(0.72, aspect, 0.1, 100);
      const modelView = multiply(translateZ(-3.15), multiply(rotX(pitch), rotY(yaw)));

      const g = gl;
      g.viewport(0, 0, width, height);
      g.clearColor(0, 0, 0, 0);
      g.clear(g.COLOR_BUFFER_BIT | g.DEPTH_BUFFER_BIT);
      g.enable(g.DEPTH_TEST);
      g.depthFunc(g.LEQUAL);
      g.enable(g.BLEND);

      const palWithEnergy = { ...pal, energy: smoothedEnergy };

      // 1. Far shell — establishes the interior depth you look into.
      g.depthMask(true);
      g.blendFunc(g.SRC_ALPHA, g.ONE_MINUS_SRC_ALPHA);
      g.enable(g.CULL_FACE);
      g.cullFace(g.FRONT);
      g.useProgram(programs.shell);
      setCommon(U.shell, projection, modelView, time, palWithEnergy);
      g.uniform1f(U.shell.alpha, 1.0);
      bindAttribs(U.shell);
      g.bindBuffer(g.ELEMENT_ARRAY_BUFFER, bufTri);
      g.drawElements(g.TRIANGLES, geo.tris.length, g.UNSIGNED_SHORT, 0);

      // 2. Mesh lines — additive, depth-tested so far edges are hidden.
      g.depthMask(false);
      g.blendFunc(g.SRC_ALPHA, g.ONE);
      g.useProgram(programs.mesh);
      setCommon(U.mesh, projection, modelView, time, palWithEnergy);
      bindAttribs(U.mesh);
      g.bindBuffer(g.ELEMENT_ARRAY_BUFFER, bufLine);
      g.drawElements(g.LINES, geo.lines.length, g.UNSIGNED_SHORT, 0);

      // 3. Points riding the wavelength surface.
      g.useProgram(programs.point);
      setCommon(U.point, projection, modelView, time, palWithEnergy);
      g.uniform1f(U.point.glow, palWithEnergy.glow * 0.9);
      bindAttribs(U.point);
      g.drawArrays(g.POINTS, 0, geo.count);

      // 4. Near shell — translucent glass over the mesh.
      g.blendFunc(g.SRC_ALPHA, g.ONE_MINUS_SRC_ALPHA);
      g.cullFace(g.BACK);
      g.useProgram(programs.shell);
      setCommon(U.shell, projection, modelView, time, palWithEnergy);
      g.uniform1f(U.shell.alpha, 0.62);
      bindAttribs(U.shell);
      g.bindBuffer(g.ELEMENT_ARRAY_BUFFER, bufTri);
      g.drawElements(g.TRIANGLES, geo.tris.length, g.UNSIGNED_SHORT, 0);

      g.disable(g.CULL_FACE);
      g.depthMask(true);

      if (labelRef.current) {
        const next = LABELS[stateRef.current] ?? STATE_TO_LABEL;
        if (labelRef.current.textContent !== next) labelRef.current.textContent = next;
      }
    }

    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", onPointerUp);
      el.removeEventListener("pointercancel", onPointerUp);
      el.removeEventListener("pointerleave", onPointerLeave);
      el.removeEventListener("webglcontextlost", onContextLost);
      [bufPos, bufNrm, bufUv, bufTri, bufLine].forEach((b) => b && gl!.deleteBuffer(b));
      [programs.shell, programs.mesh, programs.point].forEach((p) => gl!.deleteProgram(p));
      // Deliberately NOT calling WEBGL_lose_context.loseContext(): React
      // StrictMode remounts this effect on the same canvas in development,
      // and a lost context can never be revived on that canvas — every
      // later compile fails with an empty info log. The browser reclaims
      // the context once the canvas leaves the document.
    };
  }, []);

  return (
    <div className={`hologram ${className}`} data-state={state}>
      <div className="hologram__stage">
        <canvas
          ref={canvasRef}
          className="hologram__canvas"
          role="img"
          aria-label={`OmniAI presence — ${LABELS[state] ?? "idle"}`}
          draggable={false}
        />
        <div className="hologram__halo" aria-hidden="true" />
        <div className="hologram__ring hologram__ring--a" aria-hidden="true" />
        <div className="hologram__ring hologram__ring--b" aria-hidden="true" />
      </div>
      {showLabel && (
        <span ref={labelRef} className="hologram__label dms-mono" role="status" aria-live="polite">
          {LABELS[state]}
        </span>
      )}
    </div>
  );
}
