"use client";

import { useEffect, useRef } from "react";

/**
 * Ambient neural field: a slowly drifting node network behind every page.
 * Deliberately faint — it should read as the machine breathing in the
 * corner of your eye, never as content competing for attention.
 *
 * Stands completely still for anyone with reduced-motion enabled, where it
 * draws a single static frame.
 *
 * Palette: signal violet links, cyan and violet node tints — the workspace
 * colours, not a second theme.
 */
const NODE_AREA = 34_000; // px² of canvas per node
const MAX_NODES = 58;
const MIN_NODES = 14;
const LINK_DISTANCE = 132;
const SPEED = 0.11;

type FieldNode = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  tint: number; // 0 = scar, 1 = cyan
};

export default function NeuralField() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let width = 0;
    let height = 0;
    let nodes: FieldNode[] = [];
    let frame = 0;

    function seed() {
      const count = Math.min(
        MAX_NODES,
        Math.max(MIN_NODES, Math.round((width * height) / NODE_AREA)),
      );
      nodes = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * SPEED,
        vy: (Math.random() - 0.5) * SPEED,
        r: Math.random() * 1.3 + 0.5,
        tint: Math.random(),
      }));
    }

    function draw() {
      ctx!.clearRect(0, 0, width, height);

      for (let i = 0; i < nodes.length; i += 1) {
        for (let j = i + 1; j < nodes.length; j += 1) {
          const a = nodes[i];
          const b = nodes[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.hypot(dx, dy);
          if (dist > LINK_DISTANCE) continue;
          const alpha = (1 - dist / LINK_DISTANCE) * 0.15;
          ctx!.strokeStyle = `rgba(139,127,255,${alpha})`;
          ctx!.lineWidth = 0.55;
          ctx!.beginPath();
          ctx!.moveTo(a.x, a.y);
          ctx!.lineTo(b.x, b.y);
          ctx!.stroke();
        }
      }

      for (const n of nodes) {
        ctx!.beginPath();
        ctx!.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx!.fillStyle =
          n.tint > 0.78
            ? "rgba(0,242,254,0.45)"
            : "rgba(166,158,255,0.4)";
        ctx!.fill();
      }
    }

    function step() {
      for (const n of nodes) {
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < 0 || n.x > width) n.vx *= -1;
        if (n.y < 0 || n.y > height) n.vy *= -1;
        n.x = Math.max(0, Math.min(width, n.x));
        n.y = Math.max(0, Math.min(height, n.y));
      }
      draw();
      frame = window.requestAnimationFrame(step);
    }

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(1, canvas!.clientWidth);
      height = Math.max(1, canvas!.clientHeight);
      canvas!.width = Math.round(width * dpr);
      canvas!.height = Math.round(height * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed();
      draw();
    }

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();

    if (!reduced) frame = window.requestAnimationFrame(step);

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 h-full w-full opacity-60"
    />
  );
}
