"use client";

import { useEffect, useId, useRef } from "react";

export default function VoiceWave({
  active,
  density = "llm",
}: {
  active: boolean;
  density?: "llm" | "sync";
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const activeRef = useRef(active);
  const densityRef = useRef(density);
  const gradientId = useId();

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  useEffect(() => {
    densityRef.current = density;
  }, [density]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d", { alpha: true });
    if (!canvas || !ctx) return;

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    let frame = 0;
    let width = 1;
    let height = 1;

    const render = (time: number) => {
      const busy = activeRef.current;
      const tight = densityRef.current === "sync";
      ctx.clearRect(0, 0, width, height);

      const amplitude = busy ? (tight ? 0.22 : 0.38) : 0.12;
      const frequency = tight ? 0.085 : 0.038;
      const speed = busy ? (tight ? 0.012 : 0.008) : 0.0022;
      const t = reducedMotion ? 0 : time * speed;

      const gradient = ctx.createLinearGradient(0, 0, width, 0);
      gradient.addColorStop(0, "#00f2fe");
      gradient.addColorStop(1, "#4facfe");

      for (let layer = 0; layer < 3; layer += 1) {
        ctx.beginPath();
        for (let x = 0; x <= width; x += 2) {
          const y =
            height / 2 +
            Math.sin(x * frequency + t + layer * 0.9) *
              height *
              amplitude *
              (1 - layer * 0.22);
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = gradient;
        ctx.globalAlpha = busy ? 0.95 - layer * 0.22 : 0.45 - layer * 0.12;
        ctx.lineWidth = layer === 0 ? 2.2 : 1;
        ctx.shadowColor = "#00f2fe";
        ctx.shadowBlur = busy ? 12 : 4;
        ctx.stroke();
      }

      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;

      if (!reducedMotion) frame = requestAnimationFrame(render);
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      render(performance.now());
    };

    resize();
    window.addEventListener("resize", resize);
    if (!reducedMotion) frame = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
    };
  }, [gradientId]);

  return (
    <canvas
      ref={canvasRef}
      className="h-12 w-full"
      aria-hidden="true"
    />
  );
}
