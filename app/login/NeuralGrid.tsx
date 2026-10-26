"use client";

import { useEffect, useRef } from "react";

/**
 * A login backdrop that behaves like nervous tissue rather than wallpaper.
 *
 * Nodes sit on a jittered lattice joined by short axons. A charge lands on a
 * node, the node fires, and the signal hands itself to a connected axon — so
 * activity *travels* across the screen instead of each line animating on its
 * own loop. That propagation is the whole trick: it reads as a network
 * thinking, not as a grid shimmering.
 *
 * Motion collapses to a single static frame under reduced-motion, and the
 * frame rate is throttled on small devices because this runs behind a form
 * for as long as the user is typing.
 */

type Node = { x: number; y: number; charge: number; hot: number };
type Edge = { a: number; b: number };
type Pulse = { edge: number; t: number; speed: number; tone: number };

const CELL = 74;
const MAX_PULSES = 34;
const SPAWN_EVERY = 0.16;

const TONES = [
  "139,127,255", // #8b7fff — the house violet
  "166,158,255", // #a69eff — pale lift
  "108,99,255", // #6c63ff — core violet
  "0,242,254", // #00f2fe — cold signal, rare
  "255,42,109", // #ff2a6d — alarm, rarest
];

function toneWeight(tone: number) {
  // Violet dominates; cyan flickers; pink almost never appears.
  return tone === 3 ? 0.1 : tone === 4 ? 0.03 : 0.87 / 3;
}

export default function NeuralGrid({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const element = ref.current;
    const context = element?.getContext("2d") ?? null;
    if (!element || !context) return;

    // Bound once, typed outright: these are captured by the render closures
    // below, and a plain narrowed ref would ask every one of them to re-prove
    // the guard it already passed.
    const canvas: HTMLCanvasElement = element;
    const ctx: CanvasRenderingContext2D = context;

    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const coarse = window.matchMedia("(pointer: coarse)").matches;

    let raf = 0;
    let nodes: Node[] = [];
    let edges: Edge[] = [];
    let adjacency: number[][] = [];
    let pulses: Pulse[] = [];
    let cols = 0;
    let rows = 0;
    let width = 0;
    let height = 0;
    let spawnClock = 0;
    let last = 0;

    function pickTone() {
      const roll = Math.random();
      if (roll < 0.9) return 0;
      if (roll < 0.96) return 1;
      if (roll < 0.99) return 2;
      return roll < 0.997 ? 3 : 4;
    }

    function spawn(edge: number, tone: number) {
      if (pulses.length >= MAX_PULSES) return;
      pulses.push({
        edge,
        t: 0,
        speed: 0.34 + Math.random() * 0.4,
        tone,
      });
    }

    function build() {
      cols = Math.ceil(width / CELL) + 1;
      rows = Math.ceil(height / CELL) + 1;
      nodes = [];
      edges = [];
      pulses = [];

      for (let r = 0; r < rows; r += 1) {
        for (let c = 0; c < cols; c += 1) {
          nodes.push({
            x: c * CELL + (Math.random() - 0.5) * CELL * 0.36,
            y: r * CELL + (Math.random() - 0.5) * CELL * 0.36,
            charge: Math.random() * 0.14,
            hot: 0,
          });
        }
      }

      const at = (r: number, c: number) => r * cols + c;

      for (let r = 0; r < rows; r += 1) {
        for (let c = 0; c < cols; c += 1) {
          if (c + 1 < cols) edges.push({ a: at(r, c), b: at(r, c + 1) });
          if (r + 1 < rows) edges.push({ a: at(r, c), b: at(r + 1, c) });
          // A minority of diagonals keep the lattice from reading as graph paper.
          if (c + 1 < cols && r + 1 < rows && Math.random() < 0.14) {
            edges.push({ a: at(r, c), b: at(r + 1, c + 1) });
          }
          if (c > 0 && r + 1 < rows && Math.random() < 0.14) {
            edges.push({ a: at(r, c), b: at(r + 1, c - 1) });
          }
        }
      }

      adjacency = nodes.map(() => []);
      edges.forEach((edge, index) => {
        adjacency[edge.a].push(index);
        adjacency[edge.b].push(index);
      });

      // Seed a few pathways so the first frame is already alive.
      const seeds = Math.min(6, edges.length);
      for (let i = 0; i < seeds; i += 1) {
        spawn(Math.floor(Math.random() * edges.length), pickTone());
      }
    }

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, coarse ? 1.5 : 2);
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      if (width <= 0 || height <= 0) return;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      build();
      drawFrame(true);
    }

    function drawFrame(staticOnly: boolean) {
      ctx.clearRect(0, 0, width, height);

      // Axons — brightness follows the charge sitting on either end.
      ctx.lineWidth = 1;
      for (let i = 0; i < edges.length; i += 1) {
        const edge = edges[i];
        const a = nodes[edge.a];
        const b = nodes[edge.b];
        const charge = (a.charge + b.charge) * 0.5;
        const alpha = 0.055 + charge * 0.4;
        ctx.strokeStyle = `rgba(139,127,255,${alpha})`;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }

      // Nodes — a fired cell blooms briefly, then settles back to a seed.
      for (let i = 0; i < nodes.length; i += 1) {
        const node = nodes[i];
        const glow = node.charge;
        if (glow > 0.06) {
          const halo = ctx.createRadialGradient(
            node.x,
            node.y,
            0,
            node.x,
            node.y,
            10 + glow * 16,
          );
          halo.addColorStop(0, `rgba(166,158,255,${0.3 * glow})`);
          halo.addColorStop(1, "rgba(108,99,255,0)");
          ctx.fillStyle = halo;
          ctx.beginPath();
          ctx.arc(node.x, node.y, 10 + glow * 16, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.fillStyle =
          glow > 0.45
            ? `rgba(232,230,242,${0.45 + glow * 0.55})`
            : `rgba(166,158,255,${0.2 + glow * 0.8})`;
        ctx.beginPath();
        ctx.arc(node.x, node.y, 1.3 + glow * 2.1, 0, Math.PI * 2);
        ctx.fill();
      }

      // Signals in flight — a head with a short comet tail.
      for (let i = 0; i < pulses.length; i += 1) {
        const pulse = pulses[i];
        const edge = edges[pulse.edge];
        if (!edge) continue;
        const a = nodes[edge.a];
        const b = nodes[edge.b];
        const x = a.x + (b.x - a.x) * pulse.t;
        const y = a.y + (b.y - a.y) * pulse.t;
        const rgb = TONES[pulse.tone];

        const trail = 0.16;
        const tx = a.x + (b.x - a.x) * Math.max(0, pulse.t - trail);
        const ty = a.y + (b.y - a.y) * Math.max(0, pulse.t - trail);
        const line = ctx.createLinearGradient(tx, ty, x, y);
        line.addColorStop(0, `rgba(${rgb},0)`);
        line.addColorStop(1, `rgba(${rgb},0.85)`);
        ctx.strokeStyle = line;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(x, y);
        ctx.stroke();

        ctx.fillStyle = `rgba(${rgb},0.95)`;
        ctx.beginPath();
        ctx.arc(x, y, 2.4, 0, Math.PI * 2);
        ctx.fill();

        if (staticOnly) continue;
      }
    }

    function step(now: number) {
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
      last = now;

      spawnClock += dt;
      if (spawnClock >= SPAWN_EVERY) {
        spawnClock = 0;
        spawn(Math.floor(Math.random() * edges.length), pickTone());
      }

      for (let i = 0; i < nodes.length; i += 1) {
        const node = nodes[i];
        node.charge *= 0.94;
        node.hot = Math.max(0, node.hot - dt);
      }

      const survivors: Pulse[] = [];
      for (let i = 0; i < pulses.length; i += 1) {
        const pulse = pulses[i];
        pulse.t += pulse.speed * dt;
        const edge = edges[pulse.edge];
        if (!edge) continue;

        if (pulse.t < 1) {
          survivors.push(pulse);
          continue;
        }

        // The signal arrives and the receiving cell fires.
        const arrival = nodes[edge.b];
        arrival.charge = 1;
        arrival.hot = 0.28;

        // …then usually hands itself onward. This is what makes the field
        // look like it is routing something rather than looping.
        const onward = adjacency[edge.b];
        if (onward && onward.length && Math.random() < 0.62) {
          const next = onward[Math.floor(Math.random() * onward.length)];
          if (pulses.length + survivors.length < MAX_PULSES) {
            survivors.push({
              edge: next,
              t: 0,
              speed: pulse.speed * (0.9 + Math.random() * 0.3),
              tone: Math.random() < 0.12 ? pickTone() : pulse.tone,
            });
          }
        }
      }
      pulses = survivors;

      drawFrame(false);
      raf = window.requestAnimationFrame(step);
    }

    function drawStatic() {
      drawFrame(true);
    }

    resize();

    if (!media.matches) {
      raf = window.requestAnimationFrame(step);
    }

    const onResize = () => resize();
    window.addEventListener("resize", onResize);

    // The element can change width without the window doing so — the Review
    // pane opening, a scrollbar appearing — and a stale backing store stretches
    // the lattice. Watch the canvas itself, not just the window.
    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(() => resize());
      observer.observe(canvas);
    }

    const onMotionChange = () => {
      window.cancelAnimationFrame(raf);
      last = 0;
      if (media.matches) {
        drawStatic();
      } else {
        raf = window.requestAnimationFrame(step);
      }
    };
    media.addEventListener("change", onMotionChange);

    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      media.removeEventListener("change", onMotionChange);
      observer?.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}
    />
  );
}
