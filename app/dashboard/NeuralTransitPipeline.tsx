"use client";

import { useEffect, useRef, useState } from "react";

interface TelemetryValue { value: string | number; accent?: string; }

interface Props {
  localReachable: boolean | null;
  modelsCount: number;
  checkingOllama: boolean;
  providerEnabled: number;
  providerTotal: number;
  providerError?: boolean;
  safeguardOk: boolean;
  checkingSafeguards: boolean;
  safeguardPending: number;
  commandConversations: number;
  commandAssets24h: number;
  isBusy: boolean;
}

const VIEW = { w: 880, h: 250 };
type NodeKey = "intake" | "local" | "cloud" | "gate" | "output";
const NODES: Record<NodeKey, { x: number; y: number; label: string }> = {
  intake: { x: 92, y: 125, label: "INTAKE" },
  local: { x: 310, y: 68, label: "LOCAL AI" },
  cloud: { x: 310, y: 182, label: "CLOUD" },
  gate: { x: 540, y: 125, label: "APPROVAL GATE" },
  output: { x: 770, y: 125, label: "OUTPUT" },
};

const PATHS: { id: string; from: NodeKey; to: NodeKey; cp: { x: number; y: number }[]; color: string; tag: "local" | "cloud" | "gate" | "output" }[] = [
  { id: "p-local", from: "intake", to: "local", cp: [{ x: 190, y: 125 }, { x: 232, y: 68 }], color: "#6ee7b7", tag: "local" },
  { id: "p-cloud", from: "intake", to: "cloud", cp: [{ x: 190, y: 125 }, { x: 232, y: 182 }], color: "#4facfe", tag: "cloud" },
  { id: "p-localgate", from: "local", to: "gate", cp: [{ x: 420, y: 68 }, { x: 452, y: 125 }], color: "#6ee7b7", tag: "gate" },
  { id: "p-cloudgate", from: "cloud", to: "gate", cp: [{ x: 420, y: 182 }, { x: 452, y: 125 }], color: "#4facfe", tag: "gate" },
  { id: "p-output", from: "gate", to: "output", cp: [{ x: 600, y: 125 }, { x: 720, y: 125 }], color: "#a78bfa", tag: "output" },
];

function pointAt(t: number, pts: { x: number; y: number }[]): { x: number; y: number } {
  // De Casteljau polybezier for array of control points.
  const n = pts.length - 1;
  const res = { x: 0, y: 0 };
  let comb = 1;
  for (let i = 0; i <= n; i++) {
    const b = comb * Math.pow(1 - t, n - i) * Math.pow(t, i);
    res.x += b * pts[i].x;
    res.y += b * pts[i].y;
    comb = (comb * (n - i)) / (i + 1);
  }
  return res;
}

function pathCoords(path: typeof PATHS[number], nodePos: Record<NodeKey, { x: number; y: number }>): { x: number; y: number }[] {
  return [nodePos[path.from], ...path.cp, nodePos[path.to]].map((p) => ({ ...p }));
}

interface Particle { pathId: string; t: number; speed: number; intensity: number; }

export default function NeuralTransitPipeline(props: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
const packetPulseRef = useRef(0);
  const rafRef = useRef<number>(0);
  const mouseRef = useRef<{ x: number; y: number } | null>(null);
  const dragRef = useRef<NodeKey | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const nodeOffsetRef = useRef<Record<NodeKey, { x: number; y: number; vx: number; vy: number }>>({
    intake: { x: 0, y: 0, vx: 0, vy: 0 },
    local: { x: 0, y: 0, vx: 0, vy: 0 },
    cloud: { x: 0, y: 0, vx: 0, vy: 0 },
    gate: { x: 0, y: 0, vx: 0, vy: 0 },
    output: { x: 0, y: 0, vx: 0, vy: 0 },
  });
  const phaseRef = useRef(0);
  const directorRef = useRef(false);
  const [digits, setDigits] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let w = 0, h = 0, dpr = 1;
    const resize = () => {
      const rect = container.getBoundingClientRect();
      w = Math.max(1, rect.width);
      h = Math.max(1, w * (VIEW.h / VIEW.w));
      container.style.height = h + "px";
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(container);
    resize();

    // node rect positions
    const toPx = (v: { x: number; y: number }) => ({ x: v.x / VIEW.w * w, y: v.y / VIEW.h * h });
    const nodeAbs = (): Record<NodeKey, { x: number; y: number }> =>
      ({
        intake: toPx({ x: NODES.intake.x + nodeOffsetRef.current.intake.x, y: NODES.intake.y + nodeOffsetRef.current.intake.y }),
        local: toPx({ x: NODES.local.x + nodeOffsetRef.current.local.x, y: NODES.local.y + nodeOffsetRef.current.local.y }),
        cloud: toPx({ x: NODES.cloud.x + nodeOffsetRef.current.cloud.x, y: NODES.cloud.y + nodeOffsetRef.current.cloud.y }),
        gate: toPx({ x: NODES.gate.x + nodeOffsetRef.current.gate.x, y: NODES.gate.y + nodeOffsetRef.current.gate.y }),
        output: toPx({ x: NODES.output.x + nodeOffsetRef.current.output.x, y: NODES.output.y + nodeOffsetRef.current.output.y }),
      });

    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      phaseRef.current += dt;
      directorRef.current = document.documentElement.getAttribute("data-director") === "on";

      // spring settle for node offsets
      const k = 120, damp = 10;
      for (const key of Object.keys(nodeOffsetRef.current) as NodeKey[]) {
        const s = nodeOffsetRef.current[key];
        const ax = -k * s.x - damp * s.vx;
        const ay = -k * s.y - damp * s.vy;
        s.vx += ax * dt;
        s.vy += ay * dt;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        if (Math.abs(s.x) < 0.6 && Math.abs(s.vx) < 1) s.x = 0;
        if (Math.abs(s.y) < 0.6 && Math.abs(s.vy) < 1) s.y = 0;
      }

      // update drag target by inverse (handled in pointer handlers via offsets tracked separately)
      // pointer drag applies offset directly on pointer move; springs pull back on release.

      const speedMul = directorRef.current ? 2 : 1;
      const density = props.isBusy ? 1.6 : 1;

      // advance particles
      const particles = particlesRef.current;
      for (const p of particles) p.t += p.speed * dt * speedMul;
      // cull
      particlesRef.current = particles.filter((p) => p.t < 1);

      // spawn particles
      const minCount = Math.floor(20 * density);
      while (particlesRef.current.length < minCount) {
        const path = PATHS[Math.floor(Math.random() * PATHS.length)];
        particlesRef.current.push({ pathId: path.id, t: 0, speed: 0.55 + Math.random() * 0.3, intensity: 0.6 + Math.random() * 0.4 });
      }
      // occasional burst on director
      if (directorRef.current && Math.random() < 0.04) {
        for (let i = 0; i < 3; i++) {
          const path = PATHS[Math.floor(Math.random() * PATHS.length)];
          particlesRef.current.push({ pathId: path.id, t: 0, speed: 1.4 + Math.random() * 0.6, intensity: 1 });
        }
        window.dispatchEvent(new CustomEvent('omni:transit-packet', { detail: { count: 3 } }));
      }
      // baseline cadence pulse so the core stays lively when not directoring
      packetPulseRef.current += 1;
      if (packetPulseRef.current % 180 === 0) {
        window.dispatchEvent(new CustomEvent('omni:transit-packet', { detail: { count: 1 } }));
      }

      const abs = nodeAbs();
      const canvasPaths = PATHS.map((p) => ({ ...p, pts: pathCoords(p, abs) }));

      // draw
      ctx.clearRect(0, 0, w, h);
      // bg grid
      ctx.save();
      ctx.globalAlpha = 0.06;
      ctx.strokeStyle = "#8b7fff";
      ctx.lineWidth = 1;
      for (let i = 0; i < w; i += 40) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, h); ctx.stroke(); }
      for (let j = 0; j < h; j += 40) { ctx.beginPath(); ctx.moveTo(0, j); ctx.lineTo(w, j); ctx.stroke(); }
      ctx.restore();

      // paths as glowing ribbons
      for (const path of canvasPaths) {
        const activeColor = path.tag === "local" ? (props.localReachable === false ? "#ff2a6d" : path.color) : path.color;
        // base line with gradient
        const grad = ctx.createLinearGradient(path.pts[0].x, path.pts[0].y, path.pts[path.pts.length - 1].x, path.pts[path.pts.length - 1].y);
        grad.addColorStop(0, "rgba(255,255,255,0.06)");
        grad.addColorStop(0.5, activeColor + "55");
        grad.addColorStop(1, "rgba(255,255,255,0.06)");
        ctx.save();
        ctx.lineWidth = 4;
        ctx.strokeStyle = grad;
        ctx.shadowColor = activeColor;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.moveTo(path.pts[0].x, path.pts[0].y);
        if (path.pts.length >= 4) ctx.bezierCurveTo(path.pts[1].x, path.pts[1].y, path.pts[2].x, path.pts[2].y, path.pts[3].x, path.pts[3].y);
        else for (let i = 1; i < path.pts.length; i++) ctx.lineTo(path.pts[i].x, path.pts[i].y);
        ctx.stroke();
        ctx.restore();

        const dashOffset = -phaseRef.current * 30 * speedMul;
        ctx.save();
        ctx.setLineDash([3, 7]);
        ctx.lineDashOffset = dashOffset;
        ctx.lineWidth = 1.2;
        ctx.strokeStyle = activeColor + "aa";
        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        ctx.moveTo(path.pts[0].x, path.pts[0].y);
        if (path.pts.length >= 4) ctx.bezierCurveTo(path.pts[1].x, path.pts[1].y, path.pts[2].x, path.pts[2].y, path.pts[3].x, path.pts[3].y);
        else for (let i = 1; i < path.pts.length; i++) ctx.lineTo(path.pts[i].x, path.pts[i].y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }

      // particles
      for (const p of particlesRef.current) {
        const path = canvasPaths.find((c) => c.id === p.pathId);
        if (!path) continue;
        const pt = pointAt(p.t, path.pts);
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.shadowColor = path.color;
        ctx.shadowBlur = 12 * p.intensity;
        ctx.fillStyle = path.color;
        ctx.globalAlpha = 0.9 * p.intensity;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 2 + p.intensity * 1.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // nodes halos: local unreachable red pulsing; cloud orbit emerald
      drawNode(ctx, abs.intake, "#a78bfa", null, "intake");
      drawNode(ctx, abs.local, props.localReachable === false ? "#ff2a6d" : "#6ee7b7", props.localReachable === false ? "pulse-red" : null, "local");
      drawNode(ctx, abs.cloud, "#4facfe", props.providerEnabled > 0 ? "orbit-emerald" : null, "cloud");
      drawNode(ctx, abs.gate, props.safeguardOk ? "#a78bfa" : "#ff2a6d", null, "gate");
      drawNode(ctx, abs.output, safeguardStateGood(props) ? "#6ee7b7" : "#a78bfa", null, "output");

      // cloud orbit ring
      if (props.providerEnabled > 0) {
        const r = 22;
        const a = phaseRef.current * (directorRef.current ? 4 : 1.6);
        ctx.save();
        ctx.strokeStyle = "rgba(110,231,183,0.85)";
        ctx.lineWidth = 1.6;
        ctx.setLineDash([6, 10]);
        ctx.lineDashOffset = -a * 30;
        ctx.beginPath();
        ctx.arc(abs.cloud.x, abs.cloud.y, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
        // dot orbiting
        ctx.save();
        ctx.fillStyle = "#7dffd9";
        ctx.shadowColor = "#7dffd9";
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(abs.cloud.x + Math.cos(a) * r, abs.cloud.y + Math.sin(a) * r, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // local red warning halo
      if (props.localReachable === false) {
        const r = 20 + 6 * Math.sin(phaseRef.current * 4);
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.fillStyle = "rgba(255,42,109,0.18)";
        ctx.beginPath();
        ctx.arc(abs.local.x, abs.local.y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      ctx.font = 'bold 10px "JetBrains Mono", monospace';
      ctx.fillStyle = "#9490ac";
      ctx.textAlign = "center";

      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
  }, [props]);

  // digit-flicker trigger on prop changes
  useEffect(() => { setDigits((d) => d + 1); }, [props.commandConversations, props.commandAssets24h, props.modelsCount, props.providerEnabled, props.safeguardPending]);

  const containerCursor = dragRef.current ? "grabbing" : "default";

  return (
    <div ref={containerRef} className="relative w-full select-none overflow-hidden rounded-xl" style={{ cursor: containerCursor, minHeight: 180 }}>
      <style>{`@keyframes digit-flicker { 0% { filter: blur(4px) brightness(1.6); transform: translateY(-1px); opacity: .6; } 30% { filter: blur(2px) brightness(1.3); } 100% { filter: blur(0) brightness(1); transform: translateY(0); opacity: 1; } }`}</style>
      <canvas ref={canvasRef} className="block" />
      {/* holographic node overlays */}
      {Object.entries(NODES).map(([k, n]) => {
        const offset = nodeOffsetRef.current[k as NodeKey];
        const left = (n.x / VIEW.w) * 100;
        const top = (n.y / VIEW.h) * 100;
        return (
          <div
            key={k}
            onPointerDown={(e) => {
              (e.target as HTMLElement).setPointerCapture(e.pointerId);
              dragRef.current = k as NodeKey;
              const rect = containerRef.current!.getBoundingClientRect();
              let startX = e.clientX; let startY = e.clientY;
              const move = (ev: PointerEvent) => {
                const dx = ev.clientX - startX; const dy = ev.clientY - startY;
                startX = ev.clientX; startY = ev.clientY;
                nodeOffsetRef.current[k as NodeKey].x += dx * (VIEW.w / rect.width);
                nodeOffsetRef.current[k as NodeKey].y += dy * (VIEW.h / rect.height);
                nodeOffsetRef.current[k as NodeKey].vx = 0;
                nodeOffsetRef.current[k as NodeKey].vy = 0;
              };
              const up = () => {
                document.removeEventListener("pointermove", move);
                document.removeEventListener("pointerup", up);
                dragRef.current = null;
              };
              document.addEventListener("pointermove", move);
              document.addEventListener("pointerup", up);
            }}
            className="absolute -translate-x-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing"
            style={{ left: `${left}%`, top: `${top}%` }}
          >
            <div className={`flex size-11 items-center justify-center rounded-full border border-white/[0.12] bg-[#14121f]/90 backdrop-blur-md shadow-[0_0_20px_rgba(139,127,255,0.35)] ${k === "gate" ? "hollographic-gate" : ""}`}>
              <span className="text-[8px] font-bold tracking-[0.12em] text-[#c5bfff]">{n.label}</span>
            </div>
          </div>
        );
      })}

      {/* live telemetry brackets */}
      <div className="pointer-events-none absolute inset-0">
        <Telemetry pos={{ x: 92, y: 155 }} value={`${props.commandConversations} conversations`} flickerKey={digits} />
        <Telemetry pos={{ x: props.localReachable === false ? 310 : 310, y: 98 }} value={props.checkingOllama ? "checking…" : props.localReachable ? `${props.modelsCount} model${props.modelsCount === 1 ? "" : "s"}` : "unreachable"} flickerKey={digits} accent={props.localReachable === false ? "#ff2a6d" : "#6ee7b7"} />
        <Telemetry pos={{ x: 310, y: 212 }} value={props.providerError ? "settings unreadable" : `${props.providerEnabled}/${props.providerTotal} enabled`} flickerKey={digits} />
        <Telemetry pos={{ x: 540, y: 155 }} value={props.checkingSafeguards ? "checking…" : props.safeguardOk ? `${props.safeguardPending} pending review` : "queue unreachable"} flickerKey={digits} />
        <Telemetry pos={{ x: 770, y: 155 }} value={`${props.commandAssets24h} assets · 24h`} flickerKey={digits} />
      </div>

      <footer className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2">
        <div className="flex items-center gap-3 text-[10px]">
          <span className="flex items-center gap-1"><i className="size-2 rounded-full" style={{ background: "#6ee7b7" }} /> Local path</span>
          <span className="flex items-center gap-1"><i className="size-2 rounded-full" style={{ background: "#4facfe" }} /> Cloud path</span>
          <span className="flex items-center gap-1"><i className="size-2 rounded-full" style={{ background: "#a78bfa" }} /> Approval gate</span>
        </div>
      </footer>
    </div>
  );
}

function Telemetry({ pos, value, flickerKey, accent }: { pos: { x: number; y: number }; value: string; flickerKey: number; accent?: string }) {
  return (
    <div
      key={flickerKey}
      className="absolute -translate-x-1/2 -translate-y-1/2 animate-[digit-flicker_.55s_ease-out]"
      style={{ left: `${(pos.x / VIEW.w) * 100}%`, top: `${(pos.y / VIEW.h) * 100}%`, color: accent || "#9490ac" }}
    >
      <span className="rounded border border-white/[0.08] bg-[#0b0a14]/70 px-1.5 py-0.5 font-mono text-[10px] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)]">
        {value}
      </span>
    </div>
  );
}

// Helper used in canvas loop where props reference must be fresh; attached at call time.
declare global { interface KeyboardEvent {} }

// Add to Props extension for safeguardState computation (kept on component).
function drawNode(ctx: CanvasRenderingContext2D, pos: { x: number; y: number }, color: string, _hint: string | null, _key: string) {
  ctx.save();
  // outer ring halo
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, 18, 0, Math.PI * 2);
  ctx.strokeStyle = color + "33";
  ctx.lineWidth = 1;
  ctx.stroke();
  // mid disc
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, 12, 0, Math.PI * 2);
  ctx.fillStyle = color + "18";
  ctx.fill();
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 14;
  ctx.stroke();
  // core
  ctx.shadowBlur = 0;
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, 5, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

function safeguardStateGood(p: Props): boolean {
  return p.safeguardOk && p.safeguardPending === 0;
}

// augment Props type with helper via prototype (no-op runtime)
(NeuralTransitPipeline as unknown as { safeguardStateGood?: typeof safeguardStateGood }).safeguardStateGood = safeguardStateGood;
