"use client";

import { useEffect, useRef } from "react";
import { useDirector } from "@/lib/directorMode";

/**
 * Director Field — the WebGL skin of Director Mode.
 *
 * A fullscreen shader quad that breathes neon emerald pulse waves across
 * the whole workspace: radial shockwaves from the switch, a drifting grid
 * pushed by the wavefront, a slow scanline sweep, and an activation burst
 * envelope that spikes the moment the switch flips. Rendered with
 * `mix-blend-mode: screen` at low gain so the UI underneath stays legible.
 *
 * The DOM frame around it (edge pulse ring + corner brackets) completes
 * the "heavy radiant border" of the brief without touching a single
 * component's own styling.
 *
 * Reduced-motion gets one static emerald frame — the state change still
 * reads, the wave does not move.
 */

const VERT = `
attribute vec2 aPos;
void main() {
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

const FRAG = `
precision mediump float;

uniform vec2 uRes;
uniform float uTime;
uniform float uMix;    // 0 = off, 1 = fully engaged (eased)
uniform float uBurst;  // activation shockwave envelope

void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / min(uRes.x, uRes.y);

  float dist = length(p);

  // Radial pulse waves emanating from the switch (top-right of frame).
  float waveA = sin(dist * 22.0 - uTime * 1.9);
  float waveB = sin(dist * 41.0 - uTime * 3.1 + 1.7);
  float waves = smoothstep(0.55, 1.0, waveA) * 0.55
              + smoothstep(0.72, 1.0, waveB) * 0.30;

  // Activation shockwave: a bright ring racing outward on engage.
  float burstRing = smoothstep(0.06, 0.0, abs(dist - uBurst * 1.4)) * uBurst;

  // Drifting tactical grid, brighter where the wavefront passes.
  vec2 gridUv = uv * vec2(uRes.x / uRes.y, 1.0) * 26.0;
  vec2 grid = abs(fract(gridUv) - 0.5);
  float lines = smoothstep(0.485, 0.5, max(grid.x, grid.y));
  float gridPulse = lines * (0.10 + 0.35 * waves);

  // Slow scanline sweep band travelling down the workspace.
  float sweep = smoothstep(0.035, 0.0, abs(uv.y - fract(uTime * 0.055))) * 0.5;

  // Heavier at the periphery — the center stays readable.
  float periphery = smoothstep(0.18, 0.92, dist);

  vec3 emerald = vec3(0.0, 1.0, 0.64);        // #00ffa3
  vec3 mint    = vec3(0.30, 1.0, 0.82);       // #4dffd1
  vec3 deep    = vec3(0.0, 0.55, 0.38);

  float glow = (waves * periphery * 0.42)
             + gridPulse
             + sweep * periphery * 0.30
             + burstRing * 0.9;

  vec3 color = mix(deep, emerald, clamp(waves + burstRing, 0.0, 1.0));
  color = mix(color, mint, burstRing * 0.8 + sweep * 0.25);

  float alpha = glow * uMix;
  gl_FragColor = vec4(color * alpha, alpha * 0.85);
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

export default function DirectorField() {
  const { active } = useDirector();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const activeRef = useRef(active);
  activeRef.current = active;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl =
      canvas.getContext("webgl", { alpha: true, premultipliedAlpha: true }) ??
      (canvas.getContext("experimental-webgl") as WebGLRenderingContext | null);
    if (!gl) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const vs = compile(gl, gl.VERTEX_SHADER, VERT);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return;

    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW
    );
    const aPos = gl.getAttribLocation(program, "aPos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(program, "uRes");
    const uTime = gl.getUniformLocation(program, "uTime");
    const uMix = gl.getUniformLocation(program, "uMix");
    const uBurst = gl.getUniformLocation(program, "uBurst");

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    let width = 0;
    let height = 0;
    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
      width = Math.max(1, canvas!.clientWidth);
      height = Math.max(1, canvas!.clientHeight);
      canvas!.width = Math.round(width * dpr);
      canvas!.height = Math.round(height * dpr);
      gl!.viewport(0, 0, canvas!.width, canvas!.height);
      gl!.uniform2f(uRes, canvas!.width, canvas!.height);
    }

    let easedMix = 0;
    let burst = 0;
    let wasActive = false;
    let idled = false;
    let raf = 0;
    const start = performance.now();

    function frame(now: number) {
      const target = activeRef.current ? 1 : 0;
      // Ease the field in/out rather than hard-cutting it.
      easedMix += (target - easedMix) * 0.045;

      if (activeRef.current && !wasActive) burst = 1; // spike on engage
      wasActive = activeRef.current;
      burst = Math.max(0, burst - 0.0075);

      const t = (now - start) / 1000;
      gl!.uniform1f(uTime, reduced ? 0 : t);
      gl!.uniform1f(uMix, easedMix);
      gl!.uniform1f(uBurst, burst);

      // Fully faded out and not engaged: stop redrawing, just keep the
      // loop warm so re-engagement eases back in smoothly.
      if (easedMix < 0.004 && target === 0 && burst <= 0) {
        if (!idled) {
          gl!.clearColor(0, 0, 0, 0);
          gl!.clear(gl!.COLOR_BUFFER_BIT);
          idled = true;
        }
        raf = window.requestAnimationFrame(frame);
        return;
      }
      idled = false;

      gl!.clearColor(0, 0, 0, 0);
      gl!.clear(gl!.COLOR_BUFFER_BIT);
      gl!.drawArrays(gl!.TRIANGLES, 0, 3);

      raf = window.requestAnimationFrame(frame);
    }

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();
    raf = window.requestAnimationFrame(frame);

    return () => {
      window.cancelAnimationFrame(raf);
      observer.disconnect();
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      gl.deleteBuffer(buffer);
    };
  }, []);

  return (
    <>
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="syn-director-field pointer-events-none fixed inset-0 z-[45] h-full w-full"
      />
      {/* DOM frame: radiant edge pulse + corner brackets, pure CSS. */}
      <div
        aria-hidden="true"
        className={`syn-director-ring pointer-events-none fixed inset-0 z-[46] ${
          active ? "is-on" : ""
        }`}
      >
        <span className="syn-director-ring__corner syn-director-ring__corner--tl" />
        <span className="syn-director-ring__corner syn-director-ring__corner--tr" />
        <span className="syn-director-ring__corner syn-director-ring__corner--bl" />
        <span className="syn-director-ring__corner syn-director-ring__corner--br" />
      </div>
    </>
  );
}
