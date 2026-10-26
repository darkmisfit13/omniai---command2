"use client";

import { useEffect, useRef } from "react";
import { audioBus } from "@/lib/audioReactive";

/**
 * FluidCanvas — the workspace's cosmic backdrop.
 *
 * A full-screen WebGL shader quad running a domain-warped fluid field. It
 * reacts to two live inputs:
 *
 *   - the pointer (the flow is pushed and brightened around the cursor), and
 *   - the Audio-Reactive Bus (bass expands the field, transients fire a
 *     radial pulse ring — so a track playing in OmniWave or OmniBeat visibly
 *     warps the backdrop).
 *
 * If WebGL is unavailable the component degrades to a lightweight 2D particle
 * field rather than rendering nothing. Reduced-motion gets one static frame.
 */

const VERT = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const FRAG = `
precision mediump float;

uniform vec2 uRes;
uniform float uTime;
uniform vec2 uMouse;      // pointer in field space
uniform vec4 uAudio;      // x=bass y=mid z=treble w=pulse
uniform float uIntensity;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p *= 2.02;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / min(uRes.x, uRes.y);
  float t = uTime;

  float bass = uAudio.x;
  float pulse = uAudio.w;
  float amp = 0.9 + bass * 1.5 + pulse * 0.7;

  // Advected domain warp — the "fluid" body of the field.
  vec2 q = vec2(
    fbm(p * 1.6 + t * 0.08),
    fbm(p * 1.6 + vec2(5.2, 1.3) - t * 0.06)
  );
  vec2 r = vec2(
    fbm(p * 2.1 + 3.0 * q + vec2(1.7, 9.2) + t * 0.11),
    fbm(p * 2.1 + 3.0 * q + vec2(8.3, 2.8) - t * 0.09)
  );
  float f = fbm(p * 2.4 + 2.2 * r);

  // Pointer: brighten and push the field near the cursor.
  float md = length(p - uMouse);
  float pointer = smoothstep(0.55, 0.0, md) * (0.7 + bass * 0.6);
  f += pointer * 0.25;

  // Audio transient pulse (ring removed — only ambient glow remains)

  vec3 violet = vec3(0.42, 0.36, 1.0);
  vec3 cyan   = vec3(0.0, 0.95, 1.0);
  vec3 emerald= vec3(0.43, 0.90, 0.72);
  vec3 pink   = vec3(0.91, 0.47, 0.98);

  vec3 col = mix(violet, cyan, clamp(f * amp, 0.0, 1.0));
  col = mix(col, emerald, clamp(r.x * 0.8 + pointer * 0.3, 0.0, 1.0));
  col = mix(col, pink, clamp(q.y * 0.6 + pulse * 0.2, 0.0, 1.0));

  float glow = (f * 0.6 + pointer * 0.5);
  glow *= (0.3 + bass * 1.0 + pulse * 0.6) * (0.35 + uIntensity);
  glow *= smoothstep(1.3, 0.12, length(p)); // vignette toward the edges

  gl_FragColor = vec4(col * glow, glow * 0.9);
}
`;

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

/** 2D particle fallback — pointer-reactive, never audio-reactive, always cheap. */
function runFallback(canvas: HTMLCanvasElement, intensity: number): () => void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => {};
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const palette = ["#a69eff", "#00f2fe", "#6ee7b7", "#e879f9"];

  let width = 0;
  let height = 0;
  let dpr = 1;
  let raf = 0;
  let pointerX = -1000;
  let pointerY = -1000;
  let hasPointer = false;
  type P = { x: number; y: number; vx: number; vy: number; r: number; color: string };
  let particles: P[] = [];

  const rebuild = () => {
    const count = reduced ? 28 : Math.min(120, Math.round((width * height) / 16000));
    particles = Array.from({ length: count }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.25,
      vy: (Math.random() - 0.5) * 0.25,
      r: 1 + Math.random() * 2.2,
      color: palette[Math.floor(Math.random() * palette.length)],
    }));
  };

  const resize = () => {
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    if (width <= 0 || height <= 0) return;
    dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    rebuild();
  };

  const step = () => {
    ctx.clearRect(0, 0, width, height);
    const audio = audioBus.getLevels();
    const boost = 1 + audio.energy * 0.8 + audio.pulse * 1.2;
    for (const p of particles) {
      if (hasPointer) {
        const dx = pointerX - p.x;
        const dy = pointerY - p.y;
        const dist = Math.hypot(dx, dy) || 1;
        if (dist < 260) {
          p.vx += (dx / dist) * 0.005 * boost;
          p.vy += (dy / dist) * 0.005 * boost;
        }
      }
      p.vx = p.vx * 0.98 + (Math.random() - 0.5) * 0.006;
      p.vy = p.vy * 0.98 + (Math.random() - 0.5) * 0.006;
      p.vx = Math.max(-0.9, Math.min(0.9, p.vx));
      p.vy = Math.max(-0.9, Math.min(0.9, p.vy));
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < 0) p.x += width;
      if (p.x > width) p.x -= width;
      if (p.y < 0) p.y += height;
      if (p.y > height) p.y -= height;

      const a = 0.18 + intensity * 0.35;
      const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 3.8);
      grad.addColorStop(0, p.color);
      grad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.globalAlpha = a;
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * 3.8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    raf = requestAnimationFrame(step);
  };

  const onMouse = (e: MouseEvent) => {
    pointerX = e.clientX;
    pointerY = e.clientY;
    hasPointer = true;
  };
  const onLeave = () => {
    hasPointer = false;
  };

  window.addEventListener("mousemove", onMouse);
  window.addEventListener("mouseleave", onLeave);
  window.addEventListener("resize", resize);
  resize();
  if (!reduced) raf = requestAnimationFrame(step);

  return () => {
    window.removeEventListener("mousemove", onMouse);
    window.removeEventListener("mouseleave", onLeave);
    window.removeEventListener("resize", resize);
    cancelAnimationFrame(raf);
  };
}

export default function FluidCanvas({ intensity = 0.25 }: { intensity?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    // Hardware-accelerated WebGL2 (strict GPU offload). See lib/gpu/accelerator.
    const gl =
      (canvas.getContext("webgl2", {
        alpha: true,
        antialias: true,
        depth: true,
        stencil: false,
        premultipliedAlpha: false,
        preserveDrawingBuffer: false,
        powerPreference: "high-performance",
        failIfMajorPerformanceCaveat: false,
      }) as WebGL2RenderingContext | null) ||
      (canvas.getContext("webgl", {
        alpha: true,
        antialias: true,
        depth: true,
        premultipliedAlpha: false,
        preserveDrawingBuffer: false,
        powerPreference: "high-performance",
        failIfMajorPerformanceCaveat: false,
      }) as WebGLRenderingContext | null);
    if (!gl) return runFallback(canvas, intensity);

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const g = gl; // stable non-null handle for the closures below

    const vs = compile(g, g.VERTEX_SHADER, VERT);
    const fs = compile(g, g.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return runFallback(canvas, intensity);

    const program = g.createProgram();
    if (!program) return runFallback(canvas, intensity);
    g.attachShader(program, vs);
    g.attachShader(program, fs);
    g.linkProgram(program);
    if (!g.getProgramParameter(program, g.LINK_STATUS)) return runFallback(canvas, intensity);
    g.useProgram(program);

    const buffer = g.createBuffer();
    g.bindBuffer(g.ARRAY_BUFFER, buffer);
    g.bufferData(g.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), g.STATIC_DRAW);
    const aPos = g.getAttribLocation(program, "aPos");
    g.enableVertexAttribArray(aPos);
    g.vertexAttribPointer(aPos, 2, g.FLOAT, false, 0, 0);

    const uRes = g.getUniformLocation(program, "uRes");
    const uTime = g.getUniformLocation(program, "uTime");
    const uMouse = g.getUniformLocation(program, "uMouse");
    const uAudio = g.getUniformLocation(program, "uAudio");
    const uIntensity = g.getUniformLocation(program, "uIntensity");

    g.enable(g.BLEND);
    g.blendFunc(g.ONE, g.ONE_MINUS_SRC_ALPHA);

    let width = 0;
    let height = 0;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.6);
      width = Math.max(1, canvas.clientWidth);
      height = Math.max(1, canvas.clientHeight);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      g.viewport(0, 0, canvas.width, canvas.height);
      g.uniform2f(uRes, canvas.width, canvas.height);
    };

    // Pointer in field space (same space the fragment shader works in).
    let mouseX = 0;
    let mouseY = 0;
    let hasPointer = false;
    const onMouse = (e: MouseEvent) => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.6);
      const min = Math.min(canvas.width, canvas.height) || 1;
      mouseX = (e.clientX * dpr - 0.5 * canvas.width) / min;
      mouseY = ((canvas.clientHeight - e.clientY) * dpr - 0.5 * canvas.height) / min;
      hasPointer = true;
    };
    const onLeave = () => {
      hasPointer = false;
    };

    let raf = 0;
    const start = performance.now();
    const frame = (now: number) => {
      const audio = audioBus.getLevels();
      const t = reduced ? 0 : (now - start) / 1000;
      g.uniform1f(uTime, t);
      g.uniform2f(uMouse, hasPointer ? mouseX : 0, hasPointer ? mouseY : 0);
      g.uniform4f(uAudio, audio.bass, audio.mid, audio.treble, audio.pulse);
      g.uniform1f(uIntensity, intensity);
      g.clearColor(0, 0, 0, 0);
      g.clear(g.COLOR_BUFFER_BIT);
      g.drawArrays(g.TRIANGLES, 0, 3);
      raf = window.requestAnimationFrame(frame);
    };

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    window.addEventListener("mousemove", onMouse);
    window.addEventListener("mouseleave", onLeave);
    resize();
    raf = window.requestAnimationFrame(frame);

    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", onMouse);
      window.removeEventListener("mouseleave", onLeave);
      observer.disconnect();
      g.deleteProgram(program);
      g.deleteShader(vs);
      g.deleteShader(fs);
      g.deleteBuffer(buffer);
    };
  }, [intensity]);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 h-full w-full"
      style={{ zIndex: 0, opacity: 0.42, mixBlendMode: "screen" }}
    />
  );
}
