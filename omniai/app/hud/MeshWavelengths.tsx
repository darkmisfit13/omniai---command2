"use client";

import { useEffect, useRef } from "react";
import { useHudActivity } from "./useHudActivity";

/**
 * A perspective wire mesh that behaves like tissue under a heart monitor:
 * an ECG waveform (atrial bump, QRS spike, ventricular bump) drives the
 * amplitude, and a travelling crest races across the surface on each beat.
 *
 * Rendered additively with a chromatic split — cyan pulled left, pale violet
 * pulled right — so it reads as a hologram rather than a chart.
 */
export default function MeshWavelengths({
  className = "",
  forcedActive,
}: {
  className?: string;
  forcedActive?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const activity = useHudActivity();
  const intensityRef = useRef(activity.intensity);
  const modeRef = useRef(activity.mode);

  useEffect(() => {
    intensityRef.current = Math.max(
      activity.intensity,
      forcedActive ? 0.7 : 0,
    );
    modeRef.current = activity.mode;
  }, [activity.intensity, activity.mode, forcedActive]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d", { alpha: true });
    if (!canvas || !ctx) return;

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    let animationId = 0;
    let width = 1;
    let height = 1;

    /** Beats per second — roughly 69bpm, a resting human heart. */
    const BEAT_HZ = 1.15;

    /** One lub-dub: P wave, small Q dip, tall R spike, T wave. */
    function heartbeat(phase: number): number {
      const g = (center: number, spread: number, amp: number) =>
        amp * Math.exp(-((phase - center) ** 2) / (2 * spread * spread));
      return (
        g(0.14, 0.03, 0.3) -
        g(0.205, 0.01, 0.16) +
        g(0.245, 0.014, 1) +
        g(0.42, 0.055, 0.38)
      );
    }

    /** Travelling crest: a narrow gaussian sweeping left to right. */
    function crestAt(nx: number, sweep: number): number {
      const d = nx - sweep;
      return Math.exp(-(d * d) / (2 * 0.02 ** 2));
    }

    function buildPoints(
      time: number,
      intensity: number,
      tight: boolean,
      busy: boolean,
    ) {
      const cols = Math.max(18, Math.min(38, Math.round(width / 16)));
      const rows = 11;
      const beat = heartbeat((time * BEAT_HZ) % 1);
      const sweep = ((time * 0.16) % 1.3) - 0.15;
      const waveScale = tight ? 14 : 8.5;
      const amp = (busy ? 0.2 : 0.085) * (0.5 + intensity);

      const points: { x: number; y: number }[][] = [];
      for (let r = 0; r <= rows; r += 1) {
        const row: { x: number; y: number }[] = [];
        for (let c = 0; c <= cols; c += 1) {
          const nx = c / cols;
          const ny = r / rows;
          const wave =
            Math.sin(nx * waveScale + time * 2.1 + ny * 2.6) * amp +
            Math.sin(nx * (tight ? 24 : 17) - time * 1.4) * amp * 0.35 +
            crestAt(nx, sweep) * beat * 0.14 +
            beat * 0.028;
          const perspective = 0.78 + ny * 0.32;
          row.push({
            x: (nx - 0.5) * width * perspective + width * 0.5,
            y: height * (0.2 + ny * 0.68) - wave * height,
          });
        }
        points.push(row);
      }
      return { points, cols, rows, beat, sweep };
    }

    /** Strokes the wireframe, optionally offset for the chromatic split. */
    function strokeMesh(
      points: { x: number; y: number }[][],
      cols: number,
      rows: number,
      dx: number,
      dy: number,
      rowColor: string,
      rowColorDim: string,
      colColor: string,
      alphaScale: number,
    ) {
      ctx!.save();
      ctx!.translate(dx, dy);
      ctx!.globalAlpha = alphaScale;

      for (let r = 0; r <= rows; r += 1) {
        ctx!.beginPath();
        points[r].forEach((p, c) =>
          c === 0 ? ctx!.moveTo(p.x, p.y) : ctx!.lineTo(p.x, p.y),
        );
        ctx!.strokeStyle = r % 3 === 0 ? rowColor : rowColorDim;
        ctx!.lineWidth = r % 3 === 0 ? 1 : 0.55;
        ctx!.stroke();
      }

      for (let c = 0; c <= cols; c += 1) {
        ctx!.beginPath();
        for (let r = 0; r <= rows; r += 1) {
          const p = points[r][c];
          if (r === 0) ctx!.moveTo(p.x, p.y);
          else ctx!.lineTo(p.x, p.y);
        }
        ctx!.strokeStyle = c % 7 === 0 ? colColor : "rgba(166,158,250,0.10)";
        ctx!.lineWidth = c % 7 === 0 ? 0.9 : 0.5;
        ctx!.stroke();
      }

      ctx!.restore();
    }

    const render = (time: number) => {
      const intensity = intensityRef.current;
      const busy = intensity > 0.15;
      const tight = modeRef.current === "sync";
      const t = reducedMotion ? 1.8 : time * (busy ? 0.00105 : 0.00028);

      ctx!.clearRect(0, 0, width, height);

      const { points, cols, rows, beat, sweep } = buildPoints(
        t,
        intensity,
        tight,
        busy,
      );

      // --- ambient bloom under the mesh -------------------------------
      const glow = ctx!.createRadialGradient(
        width * 0.5,
        height * 0.74,
        2,
        width * 0.5,
        height * 0.74,
        width * 0.7,
      );
      const glowStrength = 0.1 + beat * 0.16 + (busy ? 0.1 : 0);
      glow.addColorStop(0, `rgba(108,99,255,${glowStrength})`);
      glow.addColorStop(0.55, `rgba(91,49,180,${glowStrength * 0.45})`);
      glow.addColorStop(1, "rgba(6,5,11,0)");
      ctx!.fillStyle = glow;
      ctx!.fillRect(0, 0, width, height);

      // --- crest bloom: light pooling where the pulse is racing --------
      if (!reducedMotion || beat > 0) {
        const crestX = sweep * width;
        const crestY = height * 0.5;
        const crest = ctx!.createRadialGradient(
          crestX,
          crestY,
          1,
          crestX,
          crestY,
          width * 0.22,
        );
        const crestStrength = beat * (busy ? 0.3 : 0.16);
        crest.addColorStop(0, `rgba(197,191,255,${crestStrength})`);
        crest.addColorStop(0.4, `rgba(108,99,255,${crestStrength * 0.5})`);
        crest.addColorStop(1, "rgba(6,5,11,0)");
        ctx!.globalCompositeOperation = "lighter";
        ctx!.fillStyle = crest;
        ctx!.fillRect(0, 0, width, height);
        ctx!.globalCompositeOperation = "source-over";
      }

      // --- chromatic split: cyan left, pale violet right --------------
      ctx!.globalCompositeOperation = "lighter";
      strokeMesh(
        points, cols, rows, -1.4, 0,
        `rgba(0,242,254,${busy ? 0.34 : 0.2})`,
        `rgba(0,242,254,${busy ? 0.17 : 0.1})`,
        "rgba(0,242,254,0.3)",
        0.85,
      );
      strokeMesh(
        points, cols, rows, 1.4, 0,
        `rgba(197,191,255,${busy ? 0.34 : 0.2})`,
        `rgba(197,191,255,${busy ? 0.17 : 0.1})`,
        "rgba(197,191,255,0.3)",
        0.85,
      );
      ctx!.globalCompositeOperation = "source-over";

      // --- core mesh --------------------------------------------------
      strokeMesh(
        points, cols, rows, 0, 0,
        `rgba(166,158,250,${busy ? 0.62 : 0.34})`,
        `rgba(108,99,255,${busy ? 0.3 : 0.16})`,
        `rgba(0,242,254,${busy ? 0.5 : 0.24})`,
        1,
      );

      // --- ghost trails: holographic persistence behind the surface ---
      ctx!.globalCompositeOperation = "lighter";
      for (let ghost = 1; ghost <= 2; ghost += 1) {
        const gy = ghost * 5;
        ctx!.globalAlpha = 0.12 / ghost;
        for (let r = 0; r <= rows; r += 2) {
          ctx!.beginPath();
          points[r].forEach((p, c) =>
            c === 0
              ? ctx!.moveTo(p.x, p.y + gy)
              : ctx!.lineTo(p.x, p.y + gy),
          );
          ctx!.strokeStyle = "rgba(166,158,250,1)";
          ctx!.lineWidth = 0.6;
          ctx!.stroke();
        }
        ctx!.globalAlpha = 1;
      }
      ctx!.globalCompositeOperation = "source-over";

      // --- nodes riding the wave --------------------------------------
      ctx!.globalCompositeOperation = "lighter";
      for (let r = 2; r < rows; r += 3) {
        for (let c = 2; c < cols; c += 4) {
          const p = points[r][c];
          ctx!.beginPath();
          ctx!.arc(p.x, p.y, busy ? 1.6 : 0.85, 0, Math.PI * 2);
          ctx!.fillStyle =
            c % 2 === 0
              ? `rgba(197,191,255,${busy ? 0.9 : 0.45})`
              : `rgba(0,242,254,${busy ? 0.85 : 0.34})`;
          ctx!.fill();
        }
      }
      ctx!.globalCompositeOperation = "source-over";

      // --- slow scan band ---------------------------------------------
      if (!reducedMotion) {
        const bandY = ((time * 0.00006) % 1) * height;
        const band = ctx!.createLinearGradient(0, bandY - 40, 0, bandY + 40);
        band.addColorStop(0, "rgba(0,242,254,0)");
        band.addColorStop(0.5, "rgba(0,242,254,0.05)");
        band.addColorStop(1, "rgba(0,242,254,0)");
        ctx!.fillStyle = band;
        ctx!.fillRect(0, bandY - 40, width, 80);
      }

      if (!reducedMotion) animationId = requestAnimationFrame(render);
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 1.25);
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      render(performance.now());
    };

    resize();
    window.addEventListener("resize", resize);
    if (!reducedMotion) animationId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}
      aria-hidden="true"
    />
  );
}
