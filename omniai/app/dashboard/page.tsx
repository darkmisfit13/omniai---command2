
"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

type OllamaResult = {
  reachable: boolean;
  models: string[];
  llama32Installed: boolean;
  reason?: string;
};

type Provider = { name: string; enabled: boolean };

type SupabaseResult = {
  status: "connected" | "check-failed";
  detail: string;
};

type ProviderResult = { providers: Provider[]; error?: string };
type SignalState = "busy" | "good" | "bad" | "idle";

const systems = [
  {
    number: "01",
    title: "Local AI",
    eyebrow: "LOCAL INTELLIGENCE",
    description: "Check Ollama and installed models.",
    href: "/local-diagnostics",
    action: "Open diagnostics",
  },
  {
    number: "02",
    title: "AI Providers",
    eyebrow: "MODEL NETWORK",
    description: "Review configured provider settings.",
    href: "/settings",
    action: "Review configuration",
  },
  {
    number: "03",
    title: "Approval Safeguards",
    eyebrow: "GOVERNANCE",
    description: "Review proposals and approval requirements.",
    href: "/approvals",
    action: "Review approvals",
  },
  {
    number: "04",
    title: "System Activity",
    eyebrow: "AUDIT TRAIL",
    description: "Explore available audit records.",
    href: "/audit-log",
    action: "View activity",
  },
];

const shortcuts = [
  {
    code: "AI",
    title: "AI workspace",
    description: "Plan, write, reason, and work with your AI.",
    href: "/",
    label: "Open workspace",
  },
  {
    code: "IO",
    title: "Local diagnostics",
    description: "Inspect your local AI service.",
    href: "/local-diagnostics",
    label: "Inspect system",
  },
  {
    code: "OK",
    title: "Review proposals",
    description: "Check drafts and approval requirements.",
    href: "/approvals",
    label: "Review items",
  },
];

function providerName(name: string) {
  const names: Record<string, string> = {
    groq: "Groq",
    gemini: "Gemini",
    claude: "Claude",
    gpt: "OpenAI GPT",
    ollama: "Ollama",
  };

  return names[name.toLowerCase()] ?? name;
}

function MiniSignal({
  state,
  variant = 0,
}: {
  state: SignalState;
  variant?: number;
}) {
  const config: Record<
    SignalState,
    { color: string; position: number; ticks: number; label: string }
  > = {
    good: { color: "#6ee7b7", position: 0.78, ticks: 8, label: "OK" },
    bad: { color: "#fb7185", position: 0.20, ticks: 2, label: "ERR" },
    busy: { color: "#00f2fe", position: 0.64, ticks: 6, label: "RUN" },
    idle: { color: "#b9a0ff", position: 0.46, ticks: 4, label: "IDLE" },
  };

  const gauge = config[state];
  const angle = Math.PI + gauge.position * Math.PI;
  const markerX = 52 + Math.cos(angle) * 25;
  const markerY = 35 + Math.sin(angle) * 25;

  return (
    <svg
      className={`omni-mini-signal omni-gauge-signal omni-wave-${state}`}
      viewBox="0 0 104 42"
      role="img"
      aria-label={`Status gauge: ${state}`}
      style={{ "--wave-color": gauge.color } as CSSProperties}
    >
      <path
        d="M20 35 A32 32 0 0 1 84 35"
        fill="none"
        stroke="#38264f"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path
        d="M20 35 A32 32 0 0 1 84 35"
        fill="none"
        stroke={gauge.color}
        strokeWidth="1"
        strokeOpacity=".28"
        strokeLinecap="round"
      />
      {Array.from({ length: 11 }, (_, i) => {
        const tickAngle = Math.PI + (i / 10) * Math.PI;
        const outerRadius = 30;
        const innerRadius = i % 5 === 0 ? 22 : 25;
        const x1 = 52 + Math.cos(tickAngle) * innerRadius;
        const y1 = 35 + Math.sin(tickAngle) * innerRadius;
        const x2 = 52 + Math.cos(tickAngle) * outerRadius;
        const y2 = 35 + Math.sin(tickAngle) * outerRadius;
        const lit = i <= gauge.ticks;

        return (
          <line
            key={`${variant}-${i}`}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={lit ? gauge.color : "#66517b"}
            strokeWidth={i % 5 === 0 ? 1.8 : 1.2}
            strokeLinecap="round"
            opacity={lit ? 0.95 : 0.45}
          />
        );
      })}
      <line
        x1="52"
        y1="35"
        x2={markerX}
        y2={markerY}
        stroke={gauge.color}
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity=".75"
      />
      <circle
        cx={markerX}
        cy={markerY}
        r={state === "busy" ? 3 : 2.4}
        fill={gauge.color}
        className="omni-mini-dot"
      />
      {state === "busy" && (
        <circle
          cx={markerX}
          cy={markerY}
          r="4.5"
          fill="none"
          stroke={gauge.color}
          strokeWidth=".8"
          strokeOpacity=".65"
          className="omni-mini-ring"
        />
      )}
      <circle
        cx="52"
        cy="35"
        r="2.3"
        fill="#d8b4fe"
        stroke="#080610"
        strokeWidth="1"
      />
      <text
        x="52"
        y="29"
        textAnchor="middle"
        fontSize="7"
        fontWeight="800"
        letterSpacing="1"
        fill={gauge.color}
      >
        {gauge.label}
      </text>
    </svg>
  );
}

/**
 * Circular HUD gauge: outer tick ring, glowing arc, centre value + detail.
 * Values are honest — they come from the real checks, never fabricated.
 */
function OrbGauge({
  value,
  max = 100,
  health,
  label,
  detail,
  state,
  live = false,
}: {
  value: number | string;
  max?: number;
  /**
   * Ring fill 0..1. Use when the ring reports system health rather than a
   * count (a system with one model is still healthy, so its ring is full).
   * Defaults to value/max.
   */
  health?: number;
  label: string;
  detail?: string;
  state: SignalState;
  live?: boolean;
}) {
  const uid = useId().replace(/:/g, "");
  const palette: Record<SignalState, string> = {
    good: "#6ee7b7",
    bad: "#fb7185",
    busy: "#00f2fe",
    idle: "#b9a0ff",
  };

  const color = palette[state];
  const pct =
    health !== undefined
      ? Math.max(0, Math.min(1, health))
      : typeof value === "number"
        ? Math.max(0, Math.min(1, max > 0 ? value / max : 0))
        : 1;

  const R = 44;
  const ARC = 2 * Math.PI * R * 0.75;
  const TICKS = 36;

  return (
    <div className={`omni-orb-gauge ${live ? "is-live" : ""} omni-wave-${state}`}>
      <svg
        viewBox="0 0 120 120"
        role="img"
        aria-label={`${label}: ${value}${detail ? ` — ${detail}` : ""}`}
        style={{ "--wave-color": color } as CSSProperties}
      >
        <defs>
          <radialGradient id={`disc-${uid}`} cx="50%" cy="38%" r="70%">
            <stop offset="0%" stopColor="#1a1430" />
            <stop offset="100%" stopColor="#0a0813" />
          </radialGradient>
        </defs>

        {/* Outer tick ring */}
        {Array.from({ length: TICKS }, (_, i) => {
          const theta = ((135 + (i / TICKS) * 270) * Math.PI) / 180;
          const lit = i / TICKS <= pct;
          const outer = 56;
          const inner = i % 6 === 0 ? 50 : 53;

          return (
            <line
              key={i}
              x1={60 + Math.cos(theta) * inner}
              y1={60 + Math.sin(theta) * inner}
              x2={60 + Math.cos(theta) * outer}
              y2={60 + Math.sin(theta) * outer}
              stroke={lit ? color : "#3a2f55"}
              strokeWidth={i % 6 === 0 ? 1.8 : 1.1}
              strokeLinecap="round"
              opacity={lit ? 0.95 : 0.5}
            />
          );
        })}

        {/* Inner disc */}
        <circle cx="60" cy="60" r="37" fill={`url(#disc-${uid})`} stroke="rgba(139,127,255,.16)" />

        {/* Track */}
        <circle
          cx="60"
          cy="60"
          r={R}
          fill="none"
          stroke="#2a2140"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${ARC} 999`}
          transform="rotate(135 60 60)"
        />

        {/* Progress arc */}
        <circle
          cx="60"
          cy="60"
          r={R}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${ARC * pct} 999`}
          transform="rotate(135 60 60)"
          style={{
            filter: `drop-shadow(0 0 5px ${color})`,
            transition: "stroke-dasharray .8s cubic-bezier(.22,1,.36,1)",
          }}
        />

        {/* Centre readout */}
        <text
          x="60"
          y="59"
          textAnchor="middle"
          fontSize="21"
          fontWeight="800"
          fill="#f0eaff"
          style={{ letterSpacing: "-0.02em" }}
        >
          {value}
        </text>
        <text x="60" y="74" textAnchor="middle" fontSize="8" fontWeight="800" fill={color} style={{ letterSpacing: "0.12em" }}>
          {label}
        </text>

        {state === "busy" && (
          <circle cx="60" cy="60" r="48" fill="none" stroke={color} strokeWidth="0.8" strokeOpacity=".5" className="omni-gauge-ping" />
        )}
      </svg>

      {detail && <p className="omni-orb-gauge-detail">{detail}</p>}
    </div>
  );
}

/** Compact numeric readout — the label/value/hint tile from the Lovable core. */
function Readout({
  label,
  value,
  hint,
}: {
  label: string;
  value: number | string;
  hint?: string;
}) {
  return (
    <div className="omni-readout">
      <p className="omni-readout-label">{label}</p>
      <p className="omni-readout-value">
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
      {hint && <p className="omni-readout-hint">{hint}</p>}
    </div>
  );
}

type Strand = { color: string; level: number; label: string };

function SignalCore({
  active,
  strands,
  name,
}: {
  active: boolean;
  strands: Strand[];
  name: string | null;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const activeRef = useRef(active);
  const strandsRef = useRef(strands);

  useEffect(() => {
    activeRef.current = active;
    strandsRef.current = strands;
  }, [active, strands]);

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
    let lastDraw = 0;
    let dpr = 1;

    /**
     * A resting human heart, ~69bpm. The mesh does not drift on a flat sine —
     * it beats: atrial bump, small Q dip, tall R spike, ventricular bump, rest.
     */
    const BEAT_HZ = 1.15;

    function heartbeat(phase: number): number {
      const g = (c: number, s: number, a: number) =>
        a * Math.exp(-((phase - c) ** 2) / (2 * s * s));
      return (
        g(0.14, 0.03, 0.3) -
        g(0.205, 0.01, 0.16) +
        g(0.245, 0.014, 1) +
        g(0.42, 0.055, 0.38)
      );
    }

    const render = (time: number, force = false) => {
      const busy = activeRef.current;
      const interval = busy ? 0 : 1000 / 14;

      if (!force && time - lastDraw < interval) {
        if (!reducedMotion) animationId = requestAnimationFrame(render);
        return;
      }

      lastDraw = time;

      const t = reducedMotion ? 0.7 : time * (busy ? 0.00105 : 0.00025);
      const cols = Math.max(22, Math.min(36, Math.round(width / 16)));
      const rows = 15;
      const points: { x: number; y: number; depth: number }[][] = [];

      // Real seconds, independent of the animation speed curve — the heart
      // keeps its own time whether the dashboard is busy or not.
      const seconds = reducedMotion ? 0.213 : time / 1000;
      const beat = reducedMotion ? 0.98 : heartbeat((seconds * BEAT_HZ) % 1);

      // A crest races left to right and breaks hardest on the beat.
      const sweep = ((seconds * (busy ? 0.55 : 0.17)) % 1.3) - 0.15;
      const settle = 0.72 + beat * 0.62;

      ctx.clearRect(0, 0, width, height);

      const atmosphere = ctx.createRadialGradient(
        width * 0.5,
        height * 0.52,
        2,
        width * 0.5,
        height * 0.52,
        width * 0.62,
      );

      atmosphere.addColorStop(
        0,
        busy ? "rgba(126,66,210,.30)" : "rgba(91,49,154,.20)",
      );
      atmosphere.addColorStop(0.55, "rgba(50,24,84,.10)");
      atmosphere.addColorStop(1, "rgba(5,4,12,0)");

      ctx.fillStyle = atmosphere;
      ctx.fillRect(0, 0, width, height);

      // Light pooling where the crest is about to break through the surface.
      const crestGlow = ctx.createRadialGradient(
        sweep * width,
        height * 0.5,
        1,
        sweep * width,
        height * 0.5,
        width * 0.2,
      );
      const crestStrength = beat * (busy ? 0.34 : 0.18);
      crestGlow.addColorStop(0, `rgba(197,191,255,${crestStrength})`);
      crestGlow.addColorStop(0.45, `rgba(108,99,255,${crestStrength * 0.5})`);
      crestGlow.addColorStop(1, "rgba(5,4,12,0)");

      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = crestGlow;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();

      for (let r = 0; r <= rows; r++) {
        const row: { x: number; y: number; depth: number }[] = [];

        for (let c = 0; c <= cols; c++) {
          const nx = c / cols;
          const ny = r / rows;
          const envelope = Math.sin(nx * Math.PI);

          const dx = nx - sweep;
          const crest = Math.exp(-(dx * dx) / (2 * 0.04 ** 2));

          const wave =
            (Math.sin(nx * 8.5 + t * 2.1 + ny * 2.5) * 0.15 +
              Math.sin(nx * 17 - t * 1.4 + ny * 4.2) * 0.055 +
              Math.cos(ny * 7 + t * 1.3 + nx * 3) * 0.045) *
              settle +
            crest * beat * (busy ? 0.2 : 0.11);

          const depth = wave * envelope;
          row.push({
            x: nx * width,
            y: height * (0.13 + ny * 0.75) - depth * height,
            depth,
          });
        }

        points.push(row);
      }

      // Rear layers add depth to the holographic mesh.
      for (let layer = 2; layer >= 1; layer--) {
        ctx.save();
        ctx.globalAlpha = layer === 2 ? 0.15 : 0.28;
        ctx.translate(0, layer * 5);
        ctx.strokeStyle = layer === 2 ? "#6c63ff" : "#8b7fff";
        ctx.lineWidth = 0.7;

        for (let r = 0; r <= rows; r += 2) {
          ctx.beginPath();
          points[r].forEach((p, c) =>
            c === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y),
          );
          ctx.stroke();
        }

        ctx.restore();
      }

      // Main horizontal mesh ribbons. Drawn three times with a chromatic
      // offset — cyan pulled left, pale violet pulled right — so the surface
      // reads as a hologram rather than a line chart.
      const ribbonPass = (
        ox: number,
        oy: number,
        strong: string,
        soft: string,
        alpha: number,
      ) => {
        ctx.save();
        ctx.translate(ox, oy);
        ctx.globalAlpha = alpha;

        for (let r = 0; r <= rows; r++) {
          ctx.beginPath();
          points[r].forEach((p, c) =>
            c === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y),
          );

          ctx.strokeStyle = r % 3 === 0 ? strong : soft;
          ctx.lineWidth = r % 3 === 0 ? 1 : 0.6;
          ctx.stroke();
        }

        ctx.restore();
      };

      const split = busy ? 0.55 : 0.32;

      ctx.globalCompositeOperation = "lighter";
      ribbonPass(
        -1.4,
        0.6,
        "rgba(0,242,254,.95)",
        "rgba(0,242,254,.4)",
        split * 0.55,
      );
      ribbonPass(
        1.4,
        -0.6,
        "rgba(197,191,255,.95)",
        "rgba(197,191,255,.4)",
        split * 0.55,
      );
      ctx.globalCompositeOperation = "source-over";

      ribbonPass(
        0,
        0,
        `rgba(197,191,255,${split})`,
        `rgba(139,127,255,${split * 0.52})`,
        1,
      );

      // Vertical mesh lines and cyan accent threads.
      for (let c = 0; c <= cols; c++) {
        ctx.beginPath();

        for (let r = 0; r <= rows; r++) {
          const p = points[r][c];

          if (r === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        }

        const accent = c % 8 === 0;

        ctx.strokeStyle = accent
          ? `rgba(0,242,254,${busy ? 0.65 : 0.36})`
          : `rgba(139,127,255,${busy ? 0.32 : 0.17})`;

        ctx.lineWidth = accent ? 0.9 : 0.55;
        ctx.stroke();
      }

      // Travelling energy band, locked to the same crest the mesh is lifting on.
      const pulseX = sweep * width;

      const band = ctx.createLinearGradient(
        pulseX - width * 0.2,
        0,
        pulseX + width * 0.2,
        0,
      );

      band.addColorStop(0, "rgba(255,42,109,0)");
      band.addColorStop(
        0.43,
        busy ? "rgba(255,42,109,.32)" : "rgba(197,191,255,.08)",
      );
      band.addColorStop(
        0.55,
        busy ? "rgba(0,242,254,.28)" : "rgba(0,242,254,.06)",
      );
      band.addColorStop(1, "rgba(0,242,254,0)");

      ctx.save();
      ctx.globalCompositeOperation = "screen";
      ctx.fillStyle = band;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();

      // Small light points across the mesh.
      for (let r = 2; r < rows; r += 3) {
        for (let c = 3; c < cols; c += 5) {
          const p = points[r][c];

          ctx.beginPath();
          ctx.arc(p.x, p.y, busy ? 1.4 : 0.9, 0, Math.PI * 2);

          ctx.fillStyle =
            c % 2 === 0
              ? `rgba(255,42,109,${busy ? 0.9 : 0.45})`
              : `rgba(0,242,254,${busy ? 0.8 : 0.32})`;

          ctx.fill();
        }
      }

      // Core orb — the machine's own heart, beating at the centre of the mesh.
      const orbPulse = 1 + beat * 0.09 + Math.sin(t * 9) * 0.015;
      const orbRadius = height * 0.44 * orbPulse;
      const orb = ctx.createRadialGradient(
        width * 0.5,
        height * 0.5,
        0,
        width * 0.5,
        height * 0.5,
        orbRadius,
      );
      orb.addColorStop(
        0,
        busy
          ? `rgba(139,127,255,${0.34 + beat * 0.2})`
          : `rgba(108,99,255,${0.2 + beat * 0.16})`,
      );
      orb.addColorStop(0.4, `rgba(108,99,255,${0.1 + beat * 0.08})`);
      orb.addColorStop(1, "rgba(108,99,255,0)");

      ctx.save();
      ctx.globalCompositeOperation = "screen";
      ctx.fillStyle = orb;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();

      // Per-system wavelength strands: one strand per system, its amplitude and
      // brightness driven by that system's live state.
      const live = strandsRef.current;

      if (live.length > 0) {
        ctx.save();
        ctx.globalCompositeOperation = "screen";

        live.forEach((strand, index) => {
          const lane = live.length > 1 ? index / (live.length - 1) : 0.5;
          const baseline = height * (0.2 + lane * 0.6);
          const level = Math.max(0, Math.min(1, strand.level));
          const amplitude = height * (0.03 + level * 0.085);

          for (let pass = 0; pass < 2; pass++) {
            ctx.beginPath();

            for (let x = 0; x <= width; x += 5) {
              const taper = Math.sin((x / width) * Math.PI) ** 1.4;
              const y =
                baseline +
                Math.sin(
                  (x / width) * (6 + index * 2) +
                    t * 10 +
                    index * 1.7 +
                    pass * 0.6,
                ) *
                  amplitude *
                  taper;

              if (x === 0) ctx.moveTo(x, y);
              else ctx.lineTo(x, y);
            }

            ctx.strokeStyle = strand.color;
            ctx.globalAlpha = pass === 0 ? 0.14 + level * 0.45 : 0.92;
            ctx.lineWidth = pass === 0 ? 6 : 1.6;
            ctx.stroke();
          }
        });

        ctx.restore();
      }

      if (!reducedMotion) {
        animationId = requestAnimationFrame(render);
      }
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();

      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      dpr = Math.min(window.devicePixelRatio || 1, 1.25);

      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      render(performance.now(), true);
    };

    resize();

    if (!reducedMotion) {
      animationId = requestAnimationFrame(render);
    }

    window.addEventListener("resize", resize);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <section
      className={`omni-core ${active ? "is-active" : ""}`}
      data-d3="6"
      data-d3-x="5"
      data-d3-y="4"
    >
      <div className="omni-core-heading">
        <div className="omni-core-title">
          <span className="omni-core-icon" aria-hidden="true">&#9673;</span>
          <div>
            <p className="omni-label">SIGNAL VISUALIZATION</p>
            <h2>OmniAI Neural Core</h2>
          </div>
        </div>

        <span className="omni-core-state">
          <i />
          {active ? "CHECKS RUNNING" : "STANDBY"}
        </span>
      </div>

      <div className="omni-core-welcome">
        <p className="omni-core-welcome__name">
          Welcome{name ? `, ${name}` : ""}
        </p>
        <p className="omni-core-welcome__hub">OmniAI Hub · Command Center</p>
      </div>

      <div className="omni-core-canvas">
        <canvas
          ref={canvasRef}
          aria-label="Animated holographic mesh with a heartbeat waveform reacting to dashboard checks"
          role="img"
        />
        <div className="omni-core-vignette" aria-hidden="true" />
        <div className="omni-core-crosshair" aria-hidden="true">+</div>
        <div className="omni-core-ring ring-one" aria-hidden="true" />
        <div className="omni-core-ring ring-two" aria-hidden="true" />
      </div>

      <div className="omni-core-footer">
        <div className="omni-core-legend" aria-label="Signal strand per system">
          {strands.map((strand) => (
            <span
              key={strand.label}
              className="omni-legend-item"
              style={{
                color: strand.color,
                opacity: 0.55 + Math.min(1, strand.level) * 0.45,
              }}
            >
              <i
                style={{
                  background: strand.color,
                  boxShadow: `0 0 7px ${strand.color}99`,
                }}
              />
              {strand.label}
            </span>
          ))}
        </div>
        <span className="omni-core-mode">
          {active ? "LIVE CHECK ACTIVITY" : "VISUALIZATION READY"}
        </span>
      </div>
    </section>
  );
}

export default function DashboardPage() {
  const [checkingOllama, setCheckingOllama] = useState(false);
  const [ollamaResult, setOllamaResult] = useState<OllamaResult | null>(null);
  const [checkingConnections, setCheckingConnections] = useState(false);
  const [supabaseResult, setSupabaseResult] = useState<SupabaseResult | null>(null);
  const [providerResult, setProviderResult] = useState<ProviderResult | null>(null);
  const automaticCheckStarted = useRef(false);
  const [operator, setOperator] = useState<string | null>(null);

  // The core greets whoever is signed in. Supabase holds a display name if one
  // was ever set at signup; otherwise fall back to the handle inside the email
  // address so the line never renders without one.
  useEffect(() => {
    let cancelled = false;

    supabase.auth
      .getUser()
      .then(({ data }) => {
        if (cancelled || !data.user) return;

        const user = data.user;
        const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
        const named = [meta.display_name, meta.full_name, meta.name].find(
          (value): value is string =>
            typeof value === "string" && value.trim().length > 0,
        );

        const fromEmail = (user.email ?? "").split("@")[0];
        const handle = (named ?? fromEmail ?? "").trim();
        if (!handle) return;

        setOperator(handle.charAt(0).toUpperCase() + handle.slice(1));
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, []);

  const checkOllama = useCallback(async () => {
    setCheckingOllama(true);
    setOllamaResult(null);

    try {
      const { data, error } = await supabase.auth.getSession();

      if (error) throw new Error("Could not verify your OmniAI session.");

      const token = data.session?.access_token;

      if (!token) throw new Error("Sign in to OmniAI first.");

      const response = await fetch("/api/local-diagnostics", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "ollama" }),
        cache: "no-store",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? "Could not check Ollama.");
      }

      setOllamaResult({
        reachable: Boolean(result.reachable),
        models: Array.isArray(result.models) ? result.models : [],
        llama32Installed: Boolean(result.llama32Installed),
        reason: typeof result.reason === "string" ? result.reason : undefined,
      });
    } catch (cause) {
      setOllamaResult({
        reachable: false,
        models: [],
        llama32Installed: false,
        reason:
          cause instanceof Error
            ? cause.message
            : "Could not check Ollama.",
      });
    } finally {
      setCheckingOllama(false);
    }
  }, []);

  const checkConnections = useCallback(async () => {
    setCheckingConnections(true);
    setSupabaseResult(null);
    setProviderResult(null);

    try {
      const [personaResponse, providersResponse] = await Promise.all([
        supabase.from("persona").select("id").limit(1),
        supabase.from("providers").select("name, enabled"),
      ]);

      const personaWorks = !personaResponse.error;
      const providersWork = !providersResponse.error;

      setSupabaseResult(
        personaWorks || providersWork
          ? {
              status: "connected",
              detail:
                personaWorks && providersWork
                  ? "Both database requests succeeded."
                  : "At least one request succeeded; another needs review.",
            }
          : {
              status: "check-failed",
              detail:
                "Database requests failed. Check your session, configuration, permissions, and service availability.",
            },
      );

      if (providersResponse.error) {
        setProviderResult({
          providers: [],
          error:
            "Could not read provider settings. Check sign-in and database permissions.",
        });
      } else {
        const rows = Array.isArray(providersResponse.data)
          ? providersResponse.data
          : [];

        setProviderResult({
          providers: rows.filter(
            (item): item is Provider =>
              typeof item?.name === "string" &&
              typeof item?.enabled === "boolean",
          ),
        });
      }
    } catch {
      setSupabaseResult({
        status: "check-failed",
        detail: "Could not complete the Supabase connection check.",
      });

      setProviderResult({
        providers: [],
        error: "Could not load provider settings.",
      });
    } finally {
      setCheckingConnections(false);
    }
  }, []);

  useEffect(() => {
    if (automaticCheckStarted.current) return;

    automaticCheckStarted.current = true;
    void checkOllama();
    void checkConnections();
  }, [checkOllama, checkConnections]);

  const isBusy = checkingOllama || checkingConnections;

  const enabledProviders =
    providerResult?.providers.filter((provider) => provider.enabled) ?? [];

  const localState: SignalState = checkingOllama
    ? "busy"
    : !ollamaResult
      ? "idle"
      : ollamaResult.reachable
        ? "good"
        : "bad";

  const databaseState: SignalState = checkingConnections
    ? "busy"
    : !supabaseResult
      ? "idle"
      : supabaseResult.status === "connected"
        ? "good"
        : "bad";

  const providerState: SignalState = checkingConnections
    ? "busy"
    : !providerResult
      ? "idle"
      : providerResult.error
        ? "bad"
        : "good";

  const workspaceState: SignalState = isBusy ? "busy" : "good";
  const statePalette: Record<SignalState, string> = {
    good: "#6ee7b7",
    bad: "#fb7185",
    busy: "#00f2fe",
    idle: "#b9a0ff",
  };

  // Amplitude each system contributes to the wavelength mesh.
  const levelFor = (state: SignalState) =>
    state === "busy" ? 1 : state === "bad" ? 0.8 : state === "good" ? 0.6 : 0.22;

  // Ring fill is system health, so a healthy system reads as a full ring.
  const healthFor = (state: SignalState) =>
    state === "good"
      ? 1
      : state === "busy"
        ? 0.66
        : state === "bad"
          ? 0.12
          : 0.5;

  const strands: Strand[] = [
    { label: "Local AI", color: statePalette[localState], level: levelFor(localState) },
    { label: "Database", color: statePalette[databaseState], level: levelFor(databaseState) },
    { label: "Providers", color: statePalette[providerState], level: levelFor(providerState) },
    { label: "Safeguards", color: statePalette.idle, level: 0.42 },
  ];

  const models = ollamaResult?.models ?? [];
  const providersTotal = providerResult?.providers.length ?? 0;

  return (
    <main className="omni-dashboard">
      <section className="omni-hero">
        <div className="omni-orb orb-a" aria-hidden="true" />
        <div className="omni-orb orb-b" aria-hidden="true" />

        <div className="omni-eyebrow">
          <i /> PERSONAL AI COMMAND CENTER
        </div>

        <div className="omni-hero-grid">
          <div className="omni-intro">
            <p className="omni-label">
              OMNIAI <span>/</span> SYSTEM OVERVIEW
            </p>

            <h1>
              One command center.
              <span>Connected intelligence.</span>
            </h1>

            <p className="omni-lead">
              Your personal AI operations hub. Access conversations, inspect
              your systems, manage proposals, and oversee connected tools.
            </p>

            <div className="omni-hero-actions">
              <Link href="/" className="omni-button primary">
                <span>AI</span> Open AI workspace <b>↗</b>
              </Link>
              <Link href="/local-diagnostics" className="omni-button quiet">
                <span>⌁</span> System diagnostics
              </Link>
            </div>

            <div className="omni-live-note">
              <span className={`live-dot ${isBusy ? "busy" : ""}`} />
              {isBusy ? "System checks in progress" : "Command interface ready"}
            </div>
          </div>

          <SignalCore active={isBusy} strands={strands} name={operator} />
        </div>

        <div className="omni-metrics">
          <div className="omni-metric">
            <p className="omni-label">WORKSPACE</p>
            <strong>Personal environment</strong>
            <small>{systems.length} tool areas connected</small>
            <OrbGauge
              value={systems.length}
              label="AREAS"
              health={healthFor(workspaceState)}
              state={workspaceState}
              live={isBusy}
            />
          </div>

          <div className="omni-metric">
            <p className="omni-label">SUPABASE DATABASE</p>
            <strong>
              <i className={`omni-status-dot ${databaseState}`} />
              {checkingConnections
                ? "CHECKING"
                : !supabaseResult
                  ? "NOT CHECKED"
                  : supabaseResult.status === "connected"
                    ? "REQUESTS OK"
                    : "CHECK FAILED"}
            </strong>
            <small>{supabaseResult?.detail ?? "Database status pending"}</small>
            <OrbGauge
              value={
                databaseState === "good"
                  ? "OK"
                  : databaseState === "busy"
                    ? "···"
                    : databaseState === "bad"
                      ? "FAIL"
                      : "—"
              }
              label="DATABASE"
              health={healthFor(databaseState)}
              state={databaseState}
              live={databaseState === "busy"}
            />
          </div>

          <div className="omni-metric">
            <p className="omni-label">LOCAL MODEL SERVICE</p>
            <strong>
              <i className={`omni-status-dot ${localState}`} />
              {checkingOllama
                ? "CHECKING"
                : !ollamaResult
                  ? "NOT CHECKED"
                  : ollamaResult.reachable
                    ? "RESPONDING"
                    : "UNAVAILABLE"}
            </strong>
            <small>
              {ollamaResult?.reachable
                ? `${ollamaResult.models.length} model(s) detected`
                : checkingOllama
                  ? "Inspecting local service"
                  : "Ollama connection status"}
            </small>
            <OrbGauge
              value={checkingOllama ? "···" : models.length}
              label="MODELS"
              health={healthFor(localState)}
              state={localState}
              live={localState === "busy"}
            />
          </div>

          <div className="omni-metric">
            <p className="omni-label">SAFETY MODEL</p>
            <strong>Review before action</strong>
            <small>Existing approval safeguards retained</small>
            <OrbGauge value="ON" label="SAFEGUARDS" health={1} state="idle" />
          </div>
        </div>

        <div className="omni-console">
          <div className="omni-console-head">
            <p className="omni-label">
              COMMAND <span>/</span> READOUTS
            </p>
            <span className={`omni-section-count ${isBusy ? "busy" : ""}`}>
              <i />
              {isBusy ? "CHECKING" : "ALL SYSTEMS READ"}
            </span>
          </div>

          <div className="omni-readouts">
            <Readout
              label="MODELS DETECTED"
              value={checkingOllama ? "…" : models.length}
              hint={
                ollamaResult?.reachable
                  ? "Ollama responding"
                  : ollamaResult && !ollamaResult.reachable
                    ? ollamaResult.reason ?? "Service unreachable"
                    : "Local service status"
              }
            />
            <Readout
              label="PROVIDERS ENABLED"
              value={`${enabledProviders.length}/${providersTotal}`}
              hint="Settings only — no live calls"
            />
            <Readout
              label="DATABASE"
              value={
                databaseState === "good" ? "OK" : databaseState === "busy" ? "…" : "FAIL"
              }
              hint={supabaseResult?.detail ?? "Status pending"}
            />
            <Readout
              label="SAFEGUARDS"
              value="ON"
              hint="Approvals required before action"
            />
          </div>

          {models.length > 0 && (
            <div className="omni-chip-row">
              <span className="omni-chips-label">INSTALLED MODELS</span>
              <div className="omni-chips">
                {models.map((model) => (
                  <span className="omni-chip" key={model}>
                    {model}
                  </span>
                ))}
              </div>
            </div>
          )}

          {providerResult && !providerResult.error && providersTotal > 0 && (
            <div className="omni-chip-row">
              <span className="omni-chips-label">PROVIDER NETWORK</span>
              <div className="omni-chips">
                {providerResult.providers.map((provider) => (
                  <span
                    className={`omni-chip ${provider.enabled ? "on" : "off"}`}
                    key={provider.name}
                  >
                    <i />
                    {providerName(provider.name)}
                    <b>{provider.enabled ? "ON" : "OFF"}</b>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="omni-check-actions">
          <button
            type="button"
            onClick={() => void checkConnections()}
            disabled={checkingConnections}
          >
            <span>↻</span>
            {checkingConnections
              ? "Checking connections…"
              : "Recheck database and providers"}
          </button>

          <button
            type="button"
            onClick={() => void checkOllama()}
            disabled={checkingOllama}
          >
            <span>⌁</span>
            {checkingOllama ? "Checking Ollama…" : "Recheck local AI"}
          </button>
        </div>
      </section>

      <section className="omni-section">
        <div className="omni-section-heading">
          <div>
            <p className="omni-label">
              SYSTEMS <span>/</span> MONITORING
            </p>
            <h2>Your AI environment</h2>
            <p>
              Verified service checks, provider configuration, safeguards, and
              activity.
            </p>
          </div>

          <span className="omni-section-count">
            <i />04 SYSTEM AREAS
          </span>
        </div>

        <div className="omni-system-grid">
          {systems.map((system, index) => {
            const local = system.title === "Local AI";
            const providers = system.title === "AI Providers";

            const state: SignalState = local
              ? localState
              : providers
                ? providerState
                : "idle";

            const status = local
              ? checkingOllama
                ? "Checking"
                : !ollamaResult
                  ? "Not checked"
                  : ollamaResult.reachable
                    ? `${ollamaResult.models.length} model(s)`
                    : "Unavailable"
              : providers
                ? checkingConnections
                  ? "Checking"
                  : !providerResult
                    ? "Not checked"
                    : providerResult.error
                      ? "Settings unavailable"
                      : `${enabledProviders.length} enabled`
                : "Open to review";

            const description = local
              ? !ollamaResult
                ? system.description
                : ollamaResult.reachable
                  ? `Ollama is responding. ${ollamaResult.models.length} model(s) installed. ${
                      ollamaResult.llama32Installed
                        ? "Llama 3.2 is installed."
                        : "Llama 3.2 was not found."
                    }${
                      ollamaResult.models.length
                        ? ` Models: ${ollamaResult.models.join(", ")}.`
                        : ""
                    }`
                  : ollamaResult.reason ?? "Ollama is not reachable."
              : providers && providerResult?.error
                ? providerResult.error
                : providers && providerResult
                  ? `${enabledProviders.length} of ${providerResult.providers.length} provider record(s) are enabled. This does not verify API keys or live availability.`
                  : system.description;

            return (
              <article className="omni-system-card" key={system.number}>
                <div className="omni-card-top">
                  <span className="omni-card-number">{system.number}</span>
                  <span className={`omni-card-status ${state}`}>
                    <i />{status}
                  </span>
                </div>

                <div className="omni-card-title-row">
                  <div>
                    <p className="omni-label">{system.eyebrow}</p>
                    <h3>{system.title}</h3>
                  </div>
                  <MiniSignal state={state} variant={index} />
                </div>

                <p className="omni-card-description">{description}</p>

                {providers && providerResult && !providerResult.error && (
                  <div className="omni-provider-list">
                    {providerResult.providers.map((provider) => (
                      <span
                        className={provider.enabled ? "enabled" : "disabled"}
                        key={provider.name}
                      >
                        {providerName(provider.name)}
                        <b>{provider.enabled ? "ON" : "OFF"}</b>
                      </span>
                    ))}

                    {providerResult.providers.length === 0 && (
                      <small>No provider records returned.</small>
                    )}
                  </div>
                )}

                <div className="omni-card-footer">
                  {local && (
                    <button
                      type="button"
                      onClick={() => void checkOllama()}
                      disabled={checkingOllama}
                    >
                      {checkingOllama ? "Checking…" : "Run check"}
                    </button>
                  )}

                  <Link href={system.href}>
                    {system.action}<span>↗</span>
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="omni-section">
        <div className="omni-section-heading">
          <div>
            <p className="omni-label">
              OPERATIONS <span>/</span> QUICK ACCESS
            </p>
            <h2>Ready when you are.</h2>
          </div>
        </div>

        <div className="omni-shortcut-grid">
          {shortcuts.map((item) => (
            <Link
              href={item.href}
              className="omni-shortcut"
              key={item.title}
            >
              <span className="omni-shortcut-code">{item.code}</span>
              <span className="omni-shortcut-copy">
                <strong>{item.title}</strong>
                <small>{item.description}</small>
                <b>{item.label}<span>↗</span></b>
              </span>
            </Link>
          ))}
        </div>
      </section>

      <footer className="omni-safety">
        <span className="omni-safety-icon" aria-hidden="true">◇</span>
        <div>
          <strong>Safety by design</strong>
          <p>
            Website drafts remain subject to existing approval safeguards.
            Database status reflects database requests, Ollama status checks
            the local service, and provider indicators reflect settings only.
            No provider API calls are made just to test connectivity.
          </p>
        </div>
      </footer>

      <style jsx global>{`
        .omni-dashboard {
          --purple: #a78bfa;
          --pink: #e879f9;
          --cyan: #00f2fe;
          width: 100%;
          max-width: 1500px;
          margin: 0 auto;
          padding: 0 0 32px;
          color: #eee9fb;
          display: flex;
          flex-direction: column;
          gap: 28px;
        }

        .omni-dashboard * {
          box-sizing: border-box;
        }

        .omni-dashboard .omni-hero {
          position: relative;
          isolation: isolate;
          overflow: hidden;
          padding: clamp(20px, 3vw, 36px);
          border: 1px solid rgba(167, 139, 250, 0.38);
          border-radius: 23px;
          background:
            radial-gradient(ellipse at 72% 44%, rgba(126, 70, 220, 0.18), transparent 43%),
            radial-gradient(ellipse at 18% 0%, rgba(217, 70, 239, 0.09), transparent 38%),
            linear-gradient(135deg, #151020 0%, #090711 58%, #10091b 100%);
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.045),
            inset 0 0 55px rgba(124, 58, 237, 0.045),
            0 0 0 1px rgba(167, 139, 250, 0.035),
            0 24px 70px rgba(0, 0, 0, 0.25),
            0 0 45px rgba(124, 58, 237, 0.055);
        }

        .omni-dashboard .omni-hero::before {
          content: "";
          position: absolute;
          inset: 0;
          z-index: 0;
          pointer-events: none;
          background:
            repeating-linear-gradient(0deg, transparent 0, transparent 4px, rgba(196, 181, 253, 0.018) 5px),
            linear-gradient(115deg, transparent 20%, rgba(167, 139, 250, 0.045) 48%, rgba(103, 232, 249, 0.025) 54%, transparent 78%);
          opacity: 0.8;
        }

        .omni-dashboard .omni-hero > *:not(.omni-orb) {
          position: relative;
          z-index: 1;
        }

        .omni-orb {
          position: absolute;
          z-index: -1;
          pointer-events: none;
          border-radius: 50%;
          filter: blur(75px);
        }

        .orb-a {
          width: 220px;
          height: 220px;
          right: 15%;
          top: -150px;
          background: #854af42b;
        }

        .orb-b {
          width: 190px;
          height: 190px;
          left: 20%;
          bottom: -165px;
          background: #d54ce51a;
        }

        .omni-dashboard .omni-eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          border: 1px solid #a98bff40;
          border-radius: 99px;
          background: #7049e817;
          padding: 9px 12px;
          color: #c9baff;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 0.17em;
        }

        .omni-eyebrow i,
        .omni-core-state i {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #b49aff;
          box-shadow: 0 0 11px #b49affb3;
        }

        .omni-hero-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.02fr) minmax(300px, 0.98fr);
          align-items: center;
          gap: clamp(20px, 3vw, 38px);
          margin-top: 25px;
        }

        .omni-intro {
          min-width: 0;
        }

        .omni-label {
          color: #a993e9;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 0.16em;
          line-height: 1.5;
        }

        .omni-label span {
          color: #68538f;
          padding: 0 4px;
        }

        .omni-intro h1 {
          margin: 13px 0 0;
          color: #f7f2ff;
          /* Sized against the intro column (~40% of the hero), not the
             viewport — Syne runs far wider than Inter, so a viewport-relative
             size here shreds the headline into five lines on laptops. */
          font-size: clamp(1.7rem, 2.7vw, 2.8rem);
          font-weight: 800;
          letter-spacing: -0.055em;
          line-height: 1.04;
          text-wrap: balance;
        }

        .omni-intro h1 span {
          display: block;
          margin-top: 8px;
          background: linear-gradient(100deg, #f1eaff, #b6a1ff 42%, #e879f9 72%, #7dd3fc);
          background-clip: text;
          -webkit-background-clip: text;
          color: transparent;
        }

        .omni-lead {
          max-width: 570px;
          margin-top: 17px;
          color: #aaa1bf;
          font-size: 13px;
          line-height: 1.85;
        }

        .omni-hero-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 22px;
        }

        .omni-button {
          display: inline-flex;
          min-height: 42px;
          align-items: center;
          justify-content: center;
          gap: 9px;
          border: 1px solid transparent;
          border-radius: 10px;
          padding: 10px 14px;
          font-size: 11px;
          font-weight: 750;
          transition: transform 0.2s, border-color 0.2s;
        }

        .omni-button:hover {
          transform: translateY(-2px);
        }

        .omni-button.primary {
          color: white;
          background: linear-gradient(115deg, #7548e8, #8b5cf6);
          border-color: #c1aaff6b;
          box-shadow: 0 6px 24px #6841cc33;
        }

        .omni-button.primary > span {
          display: grid;
          place-items: center;
          width: 23px;
          height: 23px;
          border-radius: 7px;
          background: #ffffff24;
          font-size: 9px;
        }

        .omni-button.quiet {
          color: #d7ccef;
          background: #0f0c19b8;
          border-color: #4b3b67;
        }

        .omni-button.quiet:hover {
          border-color: #a78bfa;
        }

        .omni-live-note {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 19px;
          color: #9487ad;
          font-size: 9px;
          letter-spacing: 0.07em;
        }

        .live-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #a78bfa;
          box-shadow: 0 0 8px #a78bfa88;
        }

        .live-dot.busy {
          background: var(--cyan);
          box-shadow: 0 0 10px var(--cyan);
          animation: omni-pulse 0.8s infinite;
        }

        .omni-dashboard .omni-core {
          position: relative;
          min-width: 0;
          overflow: hidden;
          border: 1px solid rgba(167, 139, 250, 0.48);
          border-radius: 17px;
          background:
            radial-gradient(ellipse at 50% 48%, rgba(109, 40, 217, 0.19), transparent 67%),
            radial-gradient(ellipse at 15% 5%, rgba(217, 70, 239, 0.07), transparent 48%),
            #090711;
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.055),
            inset 0 0 32px rgba(124, 58, 237, 0.07),
            0 0 24px rgba(124, 58, 237, 0.075),
            0 16px 42px rgba(0, 0, 0, 0.28);
          animation: omni-hologram-breathe 8s ease-in-out infinite;
        }

        .omni-core-heading {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 15px 16px 12px;
          background: linear-gradient(90deg, rgba(124, 58, 237, 0.07), transparent 75%);
        }

        .omni-core-title {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
        }

        .omni-core-icon {
          display: grid;
          place-items: center;
          width: 36px;
          height: 36px;
          flex-shrink: 0;
          border: 1px solid #b191ff45;
          border-radius: 10px;
          background: #8253e21f;
          color: #d0baff;
          font-size: 24px;
          box-shadow: inset 0 0 12px #a78bfa12, 0 0 16px #6c63ff17;
        }

        .omni-core-title h2 {
          margin-top: 3px;
          color: #f0eaff;
          font-size: 13px;
          font-weight: 700;
        }

        .omni-core-welcome {
          margin-top: 12px;
        }

        .omni-core-welcome__name {
          margin: 0;
          color: #f4f1ff;
          font-size: 19px;
          font-weight: 700;
          line-height: 1.15;
          letter-spacing: -0.02em;
          text-shadow: 0 0 20px rgba(108, 99, 255, 0.4);
        }

        .omni-core-welcome__hub {
          margin: 6px 0 0;
          color: #a69eff;
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.24em;
          text-transform: uppercase;
          text-shadow: 0 0 14px rgba(139, 127, 255, 0.35);
        }

        .omni-core-state {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          flex-shrink: 0;
          color: #a99bbf;
          font-size: 8px;
          font-weight: 800;
          letter-spacing: 0.1em;
        }

        .omni-core.is-active .omni-core-state i {
          background: var(--cyan);
          box-shadow: 0 0 12px var(--cyan);
          animation: omni-pulse 0.8s infinite;
        }

        .omni-core-canvas {
          position: relative;
          height: clamp(240px, 30vw, 380px);
          overflow: hidden;
          border-block: 1px solid #7454a329;
          background: linear-gradient(180deg, #0c081726, #22113a20);
        }

        .omni-core-canvas canvas {
          display: block;
          width: 100%;
          height: 100%;
        }

        .omni-core-canvas::after {
          content: "";
          position: absolute;
          inset: 0;
          z-index: 1;
          pointer-events: none;
          background:
            linear-gradient(rgba(167, 139, 250, 0.035) 1px, transparent 1px),
            linear-gradient(90deg, rgba(167, 139, 250, 0.035) 1px, transparent 1px);
          background-size: 28px 28px;
          opacity: 0.42;
          mask-image: linear-gradient(to bottom, transparent, black 18%, black 78%, transparent);
        }

        .omni-core-vignette {
          position: absolute;
          inset: 0;
          pointer-events: none;
          background: linear-gradient(90deg, #0a081366, transparent 20%, transparent 80%, #0a081366), linear-gradient(0deg, #0a081388, transparent 30%, transparent 75%, #0a081344);
        }

        .omni-core-crosshair {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          color: #d6bcff73;
          font-size: 12px;
          text-shadow: 0 0 8px #a78bfa;
        }

        .omni-core-ring {
          position: absolute;
          left: 50%;
          top: 50%;
          border: 1px solid #c084fc24;
          border-radius: 50%;
          transform: translate(-50%, -50%) rotateX(64deg);
          pointer-events: none;
          box-shadow: 0 0 14px #c084fc0b;
        }

        .ring-one {
          width: 52%;
          height: 72%;
        }

        .ring-two {
          width: 35%;
          height: 50%;
          border-color: #00f2fe25;
        }

        .omni-core-footer {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          padding: 11px 16px 13px;
          color: #87799f;
          font-size: 8px;
          font-weight: 800;
          letter-spacing: 0.1em;
        }

        .omni-core-legend {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 6px 11px;
          min-width: 0;
        }

        .omni-legend-item {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          white-space: nowrap;
          letter-spacing: 0.05em;
          transition: opacity 0.3s ease;
        }

        .omni-legend-item i {
          width: 5px;
          height: 5px;
          flex-shrink: 0;
          border-radius: 50%;
        }

        .omni-core-mode {
          flex-shrink: 0;
          margin-left: auto;
          padding-left: 10px;
          white-space: nowrap;
          color: #6d6389;
        }

        .omni-metrics {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          margin-top: 25px;
          border-top: 1px solid #43315bbb;
        }

        .omni-metric {
          position: relative;
          min-width: 0;
          padding: 16px 14px 0 0;
        }

        .omni-metric strong {
          display: flex;
          align-items: center;
          gap: 7px;
          margin-top: 8px;
          color: #e9e2fa;
          font-size: 11px;
          font-weight: 750;
          line-height: 1.55;
        }

        .omni-metric small {
          display: block;
          min-height: 31px;
          margin-top: 4px;
          color: #9288a8;
          font-size: 10px;
          line-height: 1.6;
          overflow-wrap: anywhere;
        }

        .omni-status-dot {
          display: inline-block;
          width: 6px;
          height: 6px;
          flex-shrink: 0;
          border-radius: 50%;
          background: #a78bfa;
        }

        .omni-status-dot.good {
          background: #6ee7b7;
          box-shadow: 0 0 7px #6ee7b766;
        }

        .omni-status-dot.bad {
          background: #fb7185;
        }

        .omni-status-dot.busy {
          background: #00f2fe;
          animation: omni-pulse 0.8s infinite;
        }

        /* ---- Command Center: circular gauges ---- */

        .omni-orb-gauge {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 6px;
          margin-top: 14px;
          min-width: 0;
        }

        .omni-orb-gauge svg {
          display: block;
          width: 128px;
          max-width: 100%;
          height: auto;
          overflow: visible;
        }

        .omni-orb-gauge.is-live svg {
          animation: omni-gauge-breathe 2.4s ease-in-out infinite;
        }

        .omni-orb-gauge-detail {
          max-width: 100%;
          margin: 0;
          color: #9288a8;
          font-size: 9px;
          line-height: 1.5;
          overflow-wrap: anywhere;
        }

        .omni-gauge-ping {
          transform-origin: 60px 60px;
          animation: omni-gauge-ping 1.8s cubic-bezier(0.22, 1, 0.36, 1) infinite;
        }

        @keyframes omni-gauge-ping {
          0% {
            transform: scale(0.86);
            stroke-opacity: 0.7;
          }
          100% {
            transform: scale(1.16);
            stroke-opacity: 0;
          }
        }

        @keyframes omni-gauge-breathe {
          0%,
          100% {
            filter: drop-shadow(0 0 0 rgba(0, 0, 0, 0));
          }
          50% {
            filter: drop-shadow(0 0 9px rgba(167, 139, 250, 0.4));
          }
        }

        /* ---- Command Center: live readouts console ---- */

        .omni-console {
          margin-top: 24px;
          padding-top: 16px;
          border-top: 1px solid #43315bbb;
        }

        .omni-console-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
        }

        .omni-readouts {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 10px;
          margin-top: 13px;
        }

        .omni-readout {
          min-width: 0;
          padding: 11px 12px 12px;
          border: 1px solid rgba(167, 139, 250, 0.2);
          border-radius: 11px;
          background:
            linear-gradient(160deg, rgba(124, 58, 237, 0.12), transparent 72%),
            rgba(9, 7, 17, 0.72);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.045);
        }

        .omni-readout-label {
          margin: 0;
          color: #87799f;
          font-size: 8px;
          font-weight: 800;
          letter-spacing: 0.12em;
        }

        .omni-readout-value {
          margin-top: 7px;
          color: #f0eaff;
          font-size: 21px;
          font-weight: 800;
          line-height: 1.05;
          font-variant-numeric: tabular-nums;
          letter-spacing: -0.01em;
        }

        .omni-readout-hint {
          margin-top: 6px;
          color: #9288a8;
          font-size: 9px;
          line-height: 1.5;
          overflow-wrap: anywhere;
        }

        .omni-chip-row {
          display: flex;
          align-items: baseline;
          flex-wrap: wrap;
          gap: 9px;
          margin-top: 15px;
        }

        .omni-chips-label {
          flex-shrink: 0;
          color: #87799f;
          font-size: 8px;
          font-weight: 800;
          letter-spacing: 0.12em;
        }

        .omni-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          min-width: 0;
        }

        .omni-chip {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          max-width: 100%;
          padding: 4px 9px;
          border: 1px solid rgba(167, 139, 250, 0.26);
          border-radius: 999px;
          background: rgba(124, 58, 237, 0.1);
          color: #cdc3ee;
          font-size: 9px;
          font-weight: 700;
          overflow-wrap: anywhere;
        }

        .omni-chip i {
          width: 5px;
          height: 5px;
          flex-shrink: 0;
          border-radius: 50%;
          background: #6ee7b7;
          box-shadow: 0 0 7px #6ee7b788;
        }

        .omni-chip b {
          color: #a99bbf;
          font-size: 8px;
          font-weight: 800;
          letter-spacing: 0.08em;
        }

        .omni-chip.on {
          border-color: rgba(110, 231, 183, 0.42);
          background: rgba(110, 231, 183, 0.08);
        }

        .omni-chip.on b {
          color: #6ee7b7;
        }

        .omni-chip.off {
          border-color: rgba(146, 136, 168, 0.26);
          background: rgba(146, 136, 168, 0.06);
          color: #9288a8;
        }

        .omni-chip.off i {
          background: #6b6280;
          box-shadow: none;
        }

        .omni-chip.off b {
          color: #7d7396;
        }

        .omni-section-count.busy i {
          background: #00f2fe;
          box-shadow: 0 0 12px #00f2fe;
          animation: omni-pulse 0.8s infinite;
        }

        @media (max-width: 900px) {
          .omni-readouts {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 480px) {
          .omni-readouts {
            grid-template-columns: minmax(0, 1fr);
          }
        }

        .omni-mini-signal {
          display: block;
          width: 94px;
          max-width: 100%;
          height: 27px;
          margin-top: 8px;
          overflow: visible;
          opacity: 0.8;
          filter: drop-shadow(0 0 3px color-mix(in srgb, var(--wave-color) 25%, transparent));
        }

        .omni-mini-line {
          stroke-dasharray: 10 5;
          animation: omni-wave-flow var(--wave-speed, 4.2s) linear infinite;
        }

        .omni-wave-good .omni-mini-line {
          stroke-dasharray: 13 4;
        }

        .omni-wave-busy .omni-mini-line {
          stroke-dasharray: 8 3;
        }

        .omni-mini-dot {
          filter: drop-shadow(0 0 4px var(--wave-color));
        }

        .omni-mini-ring {
          transform-box: fill-box;
          transform-origin: center;
          animation: omni-wave-ring 2.4s ease-out infinite;
        }

        .omni-check-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 9px;
          margin-top: 16px;
        }

        .omni-check-actions button,
        .omni-card-footer button {
          display: inline-flex;
          min-height: 35px;
          align-items: center;
          justify-content: center;
          gap: 7px;
          border: 1px solid #906fc754;
          border-radius: 8px;
          background: #6949a81a;
          padding: 8px 11px;
          color: #c7b6ed;
          font-size: 10px;
          font-weight: 750;
          transition: border-color 0.2s, background 0.2s;
        }

        .omni-check-actions button:hover:not(:disabled),
        .omni-card-footer button:hover:not(:disabled) {
          border-color: #b092ff9e;
          background: #7952c733;
        }

        .omni-dashboard button:disabled {
          cursor: wait;
          opacity: 0.6;
        }

        .omni-section {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .omni-section-heading {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 18px;
        }

        .omni-section-heading h2 {
          margin-top: 7px;
          color: #f0ebff;
          font-size: clamp(1.45rem, 2.4vw, 1.9rem);
          font-weight: 750;
          letter-spacing: -0.045em;
        }

        .omni-section-heading p:not(.omni-label) {
          margin-top: 6px;
          color: #958ba9;
          font-size: 11px;
          line-height: 1.7;
        }

        .omni-section-count {
          display: inline-flex;
          flex-shrink: 0;
          align-items: center;
          gap: 8px;
          border: 1px solid #755b9d47;
          border-radius: 8px;
          background: #100c1aa6;
          padding: 9px 11px;
          color: #a49ab9;
          font-size: 8px;
          font-weight: 800;
          letter-spacing: 0.1em;
        }

        .omni-section-count i {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: #a78bfa;
          box-shadow: 0 0 8px #a78bfa80;
        }

        .omni-system-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }

        .omni-system-card {
          position: relative;
          display: flex;
          min-width: 0;
          flex-direction: column;
          overflow: hidden;
          border: 1px solid #443253;
          border-radius: 14px;
          padding: 17px;
          background:
            radial-gradient(ellipse at 100% 0%, #6842a71c, transparent 48%),
            linear-gradient(145deg, #120e1c, #0b0a12);
          box-shadow: inset 0 1px #ffffff05, 0 8px 28px #00000012;
          transition: transform 0.22s, border-color 0.22s, box-shadow 0.22s;
        }

        .omni-system-card:hover {
          transform: translateY(-2px);
          border-color: #9274e9a8;
          box-shadow: inset 0 1px #ffffff08, 0 10px 30px #6c63ff15;
        }

        .omni-card-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }

        .omni-card-number {
          display: grid;
          place-items: center;
          width: 36px;
          height: 36px;
          border: 1px solid #9c7ce447;
          border-radius: 9px;
          background: #7d55d126;
          color: #c5b0ff;
          font-size: 11px;
          font-weight: 850;
        }

        .omni-card-status {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          max-width: 70%;
          border: 1px solid #705e8f47;
          border-radius: 7px;
          background: #07070e8c;
          padding: 6px 8px;
          color: #b7adc9;
          font-size: 9px;
          font-weight: 700;
          overflow-wrap: anywhere;
        }

        .omni-card-status i {
          width: 5px;
          height: 5px;
          flex-shrink: 0;
          border-radius: 50%;
          background: #9b8bb4;
        }

        .omni-card-status.good i {
          background: #6ee7b7;
          box-shadow: 0 0 7px #6ee7b766;
        }

        .omni-card-status.bad i {
          background: #fb7185;
        }

        .omni-card-status.busy i {
          background: #00f2fe;
          animation: omni-pulse 0.8s infinite;
        }

        .omni-card-title-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-top: 17px;
        }

        .omni-card-title-row .omni-mini-signal {
          width: 74px;
          height: 25px;
          margin: 0;
          flex-shrink: 0;
        }

        .omni-card-title-row h3 {
          margin-top: 5px;
          color: #f0ebff;
          font-size: 16px;
          font-weight: 750;
          letter-spacing: -0.025em;
        }

        .omni-card-description {
          min-height: 40px;
          margin-top: 10px;
          color: #a39ab8;
          font-size: 11px;
          line-height: 1.75;
          overflow-wrap: anywhere;
        }

        .omni-provider-list {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-top: 12px;
        }

        .omni-provider-list span {
          display: inline-flex;
          gap: 5px;
          align-items: center;
          border: 1px solid #51466f;
          border-radius: 5px;
          padding: 5px 7px;
          color: #9890ad;
          font-size: 9px;
          background: #0b0a14b3;
        }

        .omni-provider-list span.enabled {
          border-color: #3b806a66;
          background: #164b3a33;
          color: #8ce6c1;
        }

        .omni-provider-list b {
          opacity: 0.72;
          font-size: 8px;
        }

        .omni-provider-list small {
          color: #9890ad;
          font-size: 10px;
        }

        .omni-card-footer {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 11px;
          margin-top: auto;
          padding-top: 17px;
        }

        .omni-card-footer a {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          color: #bba6ff;
          font-size: 10px;
          font-weight: 800;
        }

        .omni-card-footer a:hover {
          color: #f0eaff;
        }

        .omni-shortcut-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
        }

        .omni-shortcut {
          display: flex;
          min-width: 0;
          align-items: flex-start;
          gap: 12px;
          border: 1px solid #443253;
          border-radius: 13px;
          padding: 15px;
          background: linear-gradient(145deg, #140f20f2, #0c0a14f5);
          transition: transform 0.2s, border-color 0.2s, box-shadow 0.2s;
        }

        .omni-shortcut:hover {
          transform: translateY(-2px);
          border-color: #9274e9a8;
          box-shadow: 0 8px 26px #6c63ff15;
        }

        .omni-shortcut-code {
          display: grid;
          place-items: center;
          width: 36px;
          height: 36px;
          flex-shrink: 0;
          border: 1px solid #9777db4d;
          border-radius: 9px;
          background: #7049e81f;
          color: #c4b0ff;
          font-size: 10px;
          font-weight: 850;
        }

        .omni-shortcut-copy {
          display: block;
          min-width: 0;
        }

        .omni-shortcut-copy strong {
          display: block;
          color: #eee9fb;
          font-size: 11px;
          font-weight: 750;
        }

        .omni-shortcut-copy small {
          display: block;
          margin-top: 7px;
          color: #a39ab8;
          font-size: 10px;
          line-height: 1.65;
        }

        .omni-shortcut-copy b {
          display: inline-flex;
          gap: 7px;
          margin-top: 12px;
          color: #b49aff;
          font-size: 9px;
          font-weight: 800;
        }

        .omni-safety {
          display: flex;
          align-items: flex-start;
          gap: 13px;
          border: 1px solid #49365f;
          border-radius: 13px;
          padding: 16px;
          background:
            radial-gradient(ellipse at 0% 50%, #6842a717, transparent 65%),
            linear-gradient(105deg, #140f20f0, #0b0a13f7);
        }

        .omni-safety-icon {
          display: grid;
          place-items: center;
          width: 34px;
          height: 34px;
          flex-shrink: 0;
          border: 1px solid #9f7ce245;
          border-radius: 9px;
          background: #7049e81f;
          color: #c0a6ff;
          font-size: 20px;
        }

        .omni-safety strong {
          color: #e6def8;
          font-size: 11px;
          font-weight: 800;
        }

        .omni-safety p {
          margin-top: 5px;
          color: #a39ab8;
          font-size: 10px;
          line-height: 1.8;
        }

        @keyframes omni-pulse {
          0%, 100% { opacity: 0.65; }
          50% { opacity: 1; }
        }

        @keyframes omni-wave-flow {
          from { stroke-dashoffset: 0; }
          to { stroke-dashoffset: -60; }
        }

        @keyframes omni-wave-ring {
          0% {
            opacity: 0.7;
            transform: scale(0.65);
          }
          100% {
            opacity: 0;
            transform: scale(1.8);
          }
        }

        @keyframes omni-hologram-breathe {
          0%, 100% {
            box-shadow:
              inset 0 1px 0 rgba(255,255,255,0.055),
              inset 0 0 32px rgba(108,99,255,0.055),
              0 0 22px rgba(108,99,255,0.06),
              0 16px 42px rgba(0,0,0,0.28);
          }
          50% {
            box-shadow:
              inset 0 1px 0 rgba(255,255,255,0.07),
              inset 0 0 38px rgba(108,99,255,0.095),
              0 0 30px rgba(108,99,255,0.11),
              0 16px 42px rgba(0,0,0,0.28);
          }
        }

        /* Syne is a wide display face — below this the intro column gets too
           narrow to hold two words of the headline, so the hero stacks and the
           copy gets the full measure instead of a shredded 300px column. */
        @media (max-width: 1180px) {
          .omni-hero-grid {
            grid-template-columns: minmax(0, 1fr);
          }

          .omni-core-canvas {
            margin-top: 4px;
          }
        }

        @media (max-width: 900px) {
          .omni-hero-grid {
            grid-template-columns: minmax(0, 1fr);
          }

          .omni-core-canvas {
            height: 190px;
          }

          .omni-shortcut-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 640px) {
          .omni-dashboard {
            gap: 22px;
          }

          .omni-dashboard .omni-hero {
            padding: 18px;
            border-radius: 17px;
          }

          .omni-metrics {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 12px 10px;
          }

          .omni-metric {
            padding-top: 14px;
            padding-right: 5px;
          }

          .omni-metric small {
            min-height: 0;
          }

          .omni-system-grid {
            grid-template-columns: minmax(0, 1fr);
          }

          .omni-section-heading {
            align-items: flex-start;
            flex-direction: column;
          }

          .omni-core-heading {
            align-items: flex-start;
            flex-direction: column;
          }

          .omni-core-state {
            margin-left: 46px;
          }

          .omni-core-footer {
            flex-direction: column;
          }

          .omni-card-description {
            min-height: 0;
          }

          .omni-intro h1 {
            font-size: clamp(1.7rem, 8.5vw, 2.5rem);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .omni-dashboard .omni-mini-line,
          .omni-dashboard .omni-mini-ring,
          .omni-dashboard .omni-core,
          .omni-dashboard .omni-core-state i,
          .omni-dashboard .omni-status-dot.busy,
          .omni-dashboard .omni-card-status.busy i {
            animation: none !important;
          }

          .omni-dashboard .omni-system-card,
          .omni-dashboard .omni-shortcut,
          .omni-dashboard .omni-button {
            transition: none !important;
          }

          .omni-dashboard .omni-hero::before {
            opacity: 0.45;
          }
        }
        /* OmniAI visual refinement — cosmetic overrides only */
        .omni-dashboard .omni-hero {
          border-color: rgba(167, 139, 250, 0.48);
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.055),
            inset 0 0 65px rgba(124, 58, 237, 0.065),
            0 24px 70px rgba(0, 0, 0, 0.32),
            0 0 42px rgba(124, 58, 237, 0.085);
        }

        .omni-dashboard .omni-intro h1 {
          letter-spacing: -0.055em;
          line-height: 1.04;
          text-wrap: balance;
          text-shadow: 0 0 34px rgba(167, 139, 250, 0.16);
        }

        .omni-dashboard .omni-lead {
          max-width: 650px;
          color: rgba(232, 226, 248, 0.76);
          line-height: 1.8;
        }

        .omni-dashboard .omni-metric {
          position: relative;
          overflow: hidden;
          padding: 18px 16px;
          border: 1px solid rgba(167, 139, 250, 0.17);
          border-radius: 15px;
          background: linear-gradient(
            145deg,
            rgba(25, 19, 39, 0.72),
            rgba(10, 8, 17, 0.76)
          );
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.035);
          transition: border-color 180ms ease, background 180ms ease,
            transform 180ms ease, box-shadow 180ms ease;
        }

        .omni-dashboard .omni-metric:hover {
          border-color: rgba(167, 139, 250, 0.38);
          background: linear-gradient(
            145deg,
            rgba(36, 24, 57, 0.82),
            rgba(13, 9, 23, 0.9)
          );
          box-shadow: 0 8px 28px rgba(0, 0, 0, 0.18),
            0 0 24px rgba(124, 58, 237, 0.07);
          transform: translateY(-2px);
        }

        .omni-dashboard .omni-metric strong {
          letter-spacing: 0.015em;
        }

        .omni-dashboard .omni-metric small {
          color: rgba(203, 195, 222, 0.72);
          line-height: 1.55;
          overflow-wrap: anywhere;
        }

        .omni-dashboard .omni-system-card {
          position: relative;
          border-color: rgba(167, 139, 250, 0.20);
          background:
            radial-gradient(
              ellipse at 100% 0%,
              rgba(124, 58, 237, 0.09),
              transparent 48%
            ),
            linear-gradient(155deg, rgba(21, 16, 32, 0.96), rgba(9, 7, 15, 0.98));
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.035),
            0 12px 30px rgba(0, 0, 0, 0.14);
          transition: border-color 180ms ease, transform 180ms ease,
            box-shadow 180ms ease, background 180ms ease;
        }

        .omni-dashboard .omni-system-card:hover {
          border-color: rgba(167, 139, 250, 0.48);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.055),
            0 16px 38px rgba(0, 0, 0, 0.26),
            0 0 28px rgba(124, 58, 237, 0.09);
          transform: translateY(-3px);
        }

        .omni-dashboard .omni-card-number {
          color: #c4b5fd;
          border-color: rgba(167, 139, 250, 0.26);
          background: rgba(124, 58, 237, 0.10);
        }

        .omni-dashboard .omni-card-description {
          color: rgba(218, 211, 235, 0.75);
          line-height: 1.7;
          overflow-wrap: anywhere;
        }

        .omni-dashboard .omni-shortcut {
          border-color: rgba(167, 139, 250, 0.18);
          background: linear-gradient(
            145deg,
            rgba(24, 18, 37, 0.88),
            rgba(10, 8, 17, 0.94)
          );
          transition: border-color 180ms ease, transform 180ms ease,
            box-shadow 180ms ease, background 180ms ease;
        }

        .omni-dashboard .omni-shortcut:hover {
          border-color: rgba(167, 139, 250, 0.46);
          background: linear-gradient(
            145deg,
            rgba(34, 23, 53, 0.96),
            rgba(13, 9, 23, 0.98)
          );
          box-shadow: 0 12px 30px rgba(0, 0, 0, 0.22),
            0 0 25px rgba(124, 58, 237, 0.08);
          transform: translateY(-3px);
        }

        .omni-dashboard .omni-button {
          transition: border-color 180ms ease, transform 180ms ease,
            box-shadow 180ms ease, background 180ms ease;
        }

        .omni-dashboard .omni-button:hover {
          transform: translateY(-2px);
        }

        .omni-dashboard .omni-section-heading h2 {
          letter-spacing: -0.025em;
          text-wrap: balance;
        }

        @media (prefers-reduced-motion: reduce) {
          .omni-dashboard .omni-metric,
          .omni-dashboard .omni-system-card,
          .omni-dashboard .omni-shortcut,
          .omni-dashboard .omni-button {
            transition: none !important;
            transform: none !important;
          }
        /* OMNIAI SIGNAL CORE ENHANCEMENT */
        .omni-dashboard .omni-core {
          border-color: rgba(167, 139, 250, 0.58);
          background:
            radial-gradient(ellipse at 50% 48%, rgba(124, 58, 237, 0.25), transparent 64%),
            radial-gradient(ellipse at 82% 18%, rgba(217, 70, 239, 0.10), transparent 42%),
            radial-gradient(ellipse at 18% 5%, rgba(167, 139, 250, 0.08), transparent 48%),
            #07050d;
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.065),
            inset 0 0 48px rgba(124, 58, 237, 0.11),
            0 0 30px rgba(124, 58, 237, 0.12),
            0 20px 52px rgba(0, 0, 0, 0.34);
        }

        .omni-dashboard .omni-core-heading {
          border-bottom: 1px solid rgba(167, 139, 250, 0.10);
          background:
            linear-gradient(100deg, rgba(124, 58, 237, 0.13), transparent 78%);
        }

        .omni-dashboard .omni-core-icon {
          border-color: rgba(192, 132, 252, 0.55);
          background:
            radial-gradient(circle, rgba(167, 139, 250, 0.24), rgba(124, 58, 237, 0.08));
          box-shadow:
            inset 0 0 16px rgba(167, 139, 250, 0.12),
            0 0 22px rgba(124, 58, 237, 0.17);
        }

        .omni-dashboard .omni-core-title h2 {
          font-size: 14px;
          letter-spacing: -0.025em;
        }

        .omni-dashboard .omni-core-canvas {
          isolation: isolate;
          background:
            radial-gradient(ellipse at center, rgba(124, 58, 237, 0.15), transparent 65%),
            linear-gradient(180deg, #090611, #10091c 55%, #080610);
        }

        .omni-dashboard .omni-core-canvas canvas {
          position: relative;
          z-index: 0;
          filter: saturate(1.18) contrast(1.04);
        }

        .omni-dashboard .omni-core-canvas::before {
          content: "";
          position: absolute;
          z-index: 1;
          inset: 0;
          pointer-events: none;
          background:
            radial-gradient(ellipse at 50% 54%, transparent 12%, rgba(8, 5, 15, 0.08) 48%, rgba(8, 5, 15, 0.48) 100%),
            linear-gradient(180deg, rgba(167, 139, 250, 0.035), transparent 30%, rgba(124, 58, 237, 0.04));
        }

        .omni-dashboard .omni-core-vignette {
          z-index: 2;
        }

        .omni-dashboard .omni-core-crosshair {
          z-index: 3;
          width: 20px;
          height: 20px;
          display: grid;
          place-items: center;
          border: 1px solid rgba(196, 181, 253, 0.23);
          border-radius: 50%;
          color: rgba(221, 204, 255, 0.9);
          box-shadow:
            0 0 16px rgba(167, 139, 250, 0.18),
            inset 0 0 10px rgba(167, 139, 250, 0.12);
        }

        .omni-dashboard .omni-core-ring {
          z-index: 3;
          border-color: rgba(192, 132, 252, 0.36);
          box-shadow:
            0 0 15px rgba(192, 132, 252, 0.10),
            inset 0 0 12px rgba(124, 58, 237, 0.06);
          animation: omni-core-orbit 24s linear infinite;
        }

        .omni-dashboard .omni-core-ring.ring-one {
          width: 58%;
          height: 70%;
          border-style: solid;
        }

        .omni-dashboard .omni-core-ring.ring-two {
          width: 39%;
          height: 49%;
          border-color: rgba(103, 232, 249, 0.32);
          border-style: dashed;
          animation-duration: 32s;
          animation-direction: reverse;
        }

        .omni-dashboard .omni-core-ring::after {
          content: "";
          position: absolute;
          top: 10%;
          left: 50%;
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: #d8b4fe;
          box-shadow:
            0 0 8px #c084fc,
            0 0 18px rgba(192, 132, 252, 0.8);
        }

        .omni-dashboard .omni-core-ring.ring-two::after {
          width: 4px;
          height: 4px;
          background: #a5f3fc;
          box-shadow: 0 0 12px rgba(103, 232, 249, 0.8);
        }

        .omni-dashboard .omni-core.is-active {
          border-color: rgba(192, 132, 252, 0.76);
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.07),
            inset 0 0 52px rgba(124, 58, 237, 0.15),
            0 0 36px rgba(124, 58, 237, 0.18),
            0 20px 52px rgba(0, 0, 0, 0.34);
        }

        .omni-dashboard .omni-core-footer {
          border-top: 1px solid rgba(167, 139, 250, 0.08);
          background: rgba(8, 5, 15, 0.32);
        }

        @keyframes omni-core-orbit {
          from {
            transform: translate(-50%, -50%) rotateX(64deg) rotateZ(0deg);
          }
          to {
            transform: translate(-50%, -50%) rotateX(64deg) rotateZ(360deg);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .omni-dashboard .omni-core-ring {
            animation: none !important;
          }
        }
        }
        /* OMNIAI HOLOGRAPHIC CARD ENHANCEMENT */
        .omni-dashboard .omni-metric,
        .omni-dashboard .omni-system-card {
          isolation: isolate;
          border-color: rgba(167, 139, 250, 0.25);
          background:
            radial-gradient(ellipse at 100% 0%, rgba(124, 58, 237, 0.13), transparent 54%),
            linear-gradient(145deg, rgba(25, 17, 41, 0.96), rgba(8, 6, 15, 0.98));
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.045),
            inset 0 0 22px rgba(124, 58, 237, 0.035),
            0 10px 28px rgba(0, 0, 0, 0.19);
        }

        .omni-dashboard .omni-metric::before,
        .omni-dashboard .omni-system-card::before {
          content: "";
          position: absolute;
          top: 0;
          left: 10%;
          right: 10%;
          height: 1px;
          pointer-events: none;
          background: linear-gradient(
            90deg,
            transparent,
            rgba(196, 181, 253, 0.52),
            rgba(217, 70, 239, 0.34),
            transparent
          );
          opacity: 0.65;
          transition: opacity 180ms ease, left 180ms ease, right 180ms ease;
        }

        .omni-dashboard .omni-metric:hover,
        .omni-dashboard .omni-system-card:hover {
          border-color: rgba(192, 132, 252, 0.62);
          background:
            radial-gradient(ellipse at 100% 0%, rgba(168, 85, 247, 0.19), transparent 56%),
            linear-gradient(145deg, rgba(34, 22, 55, 0.98), rgba(10, 7, 19, 0.99));
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.075),
            inset 0 0 26px rgba(124, 58, 237, 0.075),
            0 14px 34px rgba(0, 0, 0, 0.27),
            0 0 24px rgba(124, 58, 237, 0.13);
        }

        .omni-dashboard .omni-metric:hover::before,
        .omni-dashboard .omni-system-card:hover::before {
          left: 4%;
          right: 4%;
          opacity: 1;
        }

        .omni-dashboard .omni-card-number {
          box-shadow:
            inset 0 0 12px rgba(167, 139, 250, 0.07),
            0 0 12px rgba(124, 58, 237, 0.06);
        }

        .omni-dashboard .omni-card-status {
          text-shadow: 0 0 12px rgba(167, 139, 250, 0.12);
        }

        .omni-dashboard .omni-metric strong {
          color: #f1eaff;
          text-shadow: 0 0 18px rgba(167, 139, 250, 0.09);
        }

        @media (prefers-reduced-motion: reduce) {
          .omni-dashboard .omni-metric::before,
          .omni-dashboard .omni-system-card::before {
            transition: none !important;
          }
        }
        /* OMNIAI MINI INSTRUMENT GAUGES */
        .omni-dashboard .omni-mini-signal.omni-gauge-signal {
          display: block;
          width: 94px;
          max-width: 100%;
          height: 38px;
          margin-top: 5px;
          overflow: visible;
          filter: drop-shadow(0 0 5px rgba(124, 58, 237, 0.14));
        }

        .omni-dashboard .omni-card-title-row .omni-mini-signal.omni-gauge-signal {
          width: 78px;
          height: 30px;
          margin: -2px 0 0;
          flex-shrink: 0;
        }

        .omni-dashboard .omni-gauge-signal .omni-mini-dot {
          filter: drop-shadow(0 0 3px var(--wave-color));
        }

        .omni-dashboard .omni-gauge-signal.omni-wave-busy {
          filter: drop-shadow(0 0 7px rgba(103, 232, 249, 0.2));
        }

        @media (prefers-reduced-motion: reduce) {
          .omni-dashboard .omni-gauge-signal .omni-mini-ring {
            animation: none !important;
          }
        }

      
/* OMNIAI COMMAND CENTER POLISH V1 */
.omni-dashboard {
  --purple: #a78bfa;
  --violet-bright: #b69aff;
  --violet-soft: rgba(139, 92, 246, 0.14);
  --glass-border: rgba(167, 139, 250, 0.19);
  gap: clamp(22px, 3vw, 34px);
}

.omni-dashboard .omni-hero {
  border-color: rgba(167, 139, 250, 0.34);
  background:
    radial-gradient(ellipse at 76% 35%, rgba(124, 58, 237, 0.23), transparent 43%),
    radial-gradient(ellipse at 12% 90%, rgba(91, 33, 182, 0.13), transparent 40%),
    linear-gradient(135deg, #100b1b 0%, #08070e 54%, #130a20 100%);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.065),
    inset 0 0 70px rgba(108,99,255,0.065),
    0 22px 65px rgba(0,0,0,0.3),
    0 0 36px rgba(108,99,255,0.075);
}

.omni-dashboard .omni-hero::before {
  opacity: 0.58;
}

.omni-dashboard .omni-eyebrow {
  background: rgba(124, 58, 237, 0.12);
  border-color: rgba(167, 139, 250, 0.29);
  box-shadow: inset 0 0 18px rgba(139, 92, 246, 0.06);
}

.omni-dashboard .omni-intro h1 {
  letter-spacing: -0.055em;
  text-wrap: balance;
}

.omni-dashboard .omni-intro h1 span {
  text-shadow: 0 0 32px rgba(167, 139, 250, 0.17);
}

.omni-dashboard .omni-lead {
  max-width: 610px;
  line-height: 1.8;
  color: #b8b0ca;
}

.omni-dashboard .omni-button {
  transition:
    transform 180ms ease,
    border-color 180ms ease,
    background 180ms ease,
    box-shadow 180ms ease;
}

.omni-dashboard .omni-button.primary {
  box-shadow:
    0 0 24px rgba(139, 92, 246, 0.17),
    inset 0 1px 0 rgba(255,255,255,0.13);
}

.omni-dashboard .omni-button.primary:hover {
  transform: translateY(-2px);
  box-shadow:
    0 8px 28px rgba(139, 92, 246, 0.24),
    inset 0 1px 0 rgba(255,255,255,0.16);
}

.omni-dashboard .omni-button.quiet:hover {
  border-color: rgba(167, 139, 250, 0.48);
  background: rgba(139, 92, 246, 0.09);
}

.omni-dashboard .omni-metrics {
  gap: 12px;
  margin-top: clamp(24px, 3vw, 36px);
}

.omni-dashboard .omni-metric {
  position: relative;
  overflow: hidden;
  border: 1px solid rgba(167, 139, 250, 0.16);
  border-radius: 15px;
  background:
    linear-gradient(145deg, rgba(30, 22, 45, 0.78), rgba(11, 9, 18, 0.88));
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.035),
    0 12px 28px rgba(0,0,0,0.12);
  transition: border-color 180ms ease, transform 180ms ease, background 180ms ease;
}

.omni-dashboard .omni-metric:hover {
  transform: translateY(-2px);
  border-color: rgba(167, 139, 250, 0.34);
  background:
    linear-gradient(145deg, rgba(39, 27, 59, 0.86), rgba(12, 9, 21, 0.94));
}

.omni-dashboard .omni-metric strong {
  letter-spacing: -0.015em;
}

.omni-dashboard .omni-section {
  gap: 20px;
}

.omni-dashboard .omni-section-heading {
  align-items: flex-end;
  gap: 18px;
}

.omni-dashboard .omni-section-heading h2 {
  letter-spacing: -0.035em;
  text-wrap: balance;
}

.omni-dashboard .omni-section-count {
  border-color: rgba(167, 139, 250, 0.2);
  background: rgba(139, 92, 246, 0.065);
}

.omni-dashboard .omni-system-grid {
  gap: 15px;
}

.omni-dashboard .omni-system-card {
  position: relative;
  isolation: isolate;
  overflow: hidden;
  border: 1px solid rgba(167, 139, 250, 0.19);
  border-radius: 18px;
  background:
    radial-gradient(ellipse at 100% 0%, rgba(124, 58, 237, 0.09), transparent 46%),
    linear-gradient(150deg, rgba(23, 18, 34, 0.97), rgba(10, 9, 16, 0.98) 72%);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.045),
    0 14px 32px rgba(0,0,0,0.16);
  transition:
    transform 200ms ease,
    border-color 200ms ease,
    box-shadow 200ms ease,
    background 200ms ease;
}

.omni-dashboard .omni-system-card:hover {
  transform: translateY(-4px);
  border-color: rgba(167, 139, 250, 0.43);
  background:
    radial-gradient(ellipse at 100% 0%, rgba(124, 58, 237, 0.16), transparent 48%),
    linear-gradient(150deg, rgba(29, 21, 44, 0.99), rgba(11, 9, 18, 1) 72%);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.07),
    0 18px 38px rgba(0,0,0,0.25),
    0 0 24px rgba(108,99,255,0.075);
}

.omni-dashboard .omni-card-number {
  border-color: rgba(167, 139, 250, 0.23);
  background: rgba(139, 92, 246, 0.1);
  color: #c4b5fd;
}

.omni-dashboard .omni-card-status {
  max-width: 70%;
  border: 1px solid rgba(167, 139, 250, 0.13);
  border-radius: 999px;
  background: rgba(139, 92, 246, 0.055);
}

.omni-dashboard .omni-card-title-row h3 {
  letter-spacing: -0.025em;
}

.omni-dashboard .omni-card-description {
  color: #aaa2bd;
  line-height: 1.75;
  overflow-wrap: anywhere;
}

.omni-dashboard .omni-provider-list span {
  border-color: rgba(167, 139, 250, 0.13);
  background: rgba(139, 92, 246, 0.045);
}

.omni-dashboard .omni-card-footer {
  border-top-color: rgba(167, 139, 250, 0.13);
}

.omni-dashboard .omni-card-footer a {
  transition: color 160ms ease, gap 160ms ease;
}

.omni-dashboard .omni-card-footer a:hover {
  color: #d8ccff;
}

.omni-dashboard .omni-shortcut-grid {
  gap: 13px;
}

.omni-dashboard .omni-shortcut {
  border: 1px solid rgba(167, 139, 250, 0.17);
  border-radius: 16px;
  background:
    radial-gradient(ellipse at 0% 0%, rgba(124, 58, 237, 0.09), transparent 56%),
    linear-gradient(145deg, rgba(24, 18, 36, 0.85), rgba(10, 9, 16, 0.96));
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.035);
  transition:
    transform 180ms ease,
    border-color 180ms ease,
    background 180ms ease,
    box-shadow 180ms ease;
}

.omni-dashboard .omni-shortcut:hover {
  transform: translateY(-3px);
  border-color: rgba(167, 139, 250, 0.4);
  background:
    radial-gradient(ellipse at 0% 0%, rgba(124, 58, 237, 0.16), transparent 58%),
    linear-gradient(145deg, rgba(32, 23, 49, 0.94), rgba(11, 9, 18, 0.98));
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.055),
    0 12px 28px rgba(0,0,0,0.2);
}

.omni-dashboard .omni-shortcut-code {
  border-color: rgba(167, 139, 250, 0.2);
  background: rgba(139, 92, 246, 0.09);
  color: #c4b5fd;
}

.omni-dashboard .omni-safety {
  border: 1px solid rgba(167, 139, 250, 0.18);
  border-radius: 16px;
  background:
    linear-gradient(115deg, rgba(30, 21, 44, 0.65), rgba(11, 9, 17, 0.82));
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.035);
}

.omni-dashboard .omni-safety-icon {
  color: #c4b5fd;
  text-shadow: 0 0 18px rgba(167, 139, 250, 0.24);
}

.omni-dashboard .omni-check-actions button,
.omni-dashboard .omni-card-footer button {
  transition:
    transform 160ms ease,
    border-color 160ms ease,
    background 160ms ease;
}

.omni-dashboard .omni-check-actions button:hover:not(:disabled),
.omni-dashboard .omni-card-footer button:hover:not(:disabled) {
  transform: translateY(-1px);
}

.omni-dashboard a:focus-visible,
.omni-dashboard button:focus-visible {
  outline: 2px solid #c4b5fd;
  outline-offset: 4px;
}

@media (max-width: 700px) {
  .omni-dashboard {
    gap: 22px;
  }

  .omni-dashboard .omni-hero {
    border-radius: 18px;
  }

  .omni-dashboard .omni-section-heading {
    align-items: flex-start;
    flex-direction: column;
  }

  .omni-dashboard .omni-section-count {
    align-self: flex-start;
  }

  .omni-dashboard .omni-system-card:hover,
  .omni-dashboard .omni-shortcut:hover,
  .omni-dashboard .omni-metric:hover {
    transform: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .omni-dashboard .omni-button,
  .omni-dashboard .omni-metric,
  .omni-dashboard .omni-system-card,
  .omni-dashboard .omni-shortcut,
  .omni-dashboard .omni-check-actions button,
  .omni-dashboard .omni-card-footer button {
    transition: none !important;
  }

  .omni-dashboard .omni-system-card:hover,
  .omni-dashboard .omni-shortcut:hover,
  .omni-dashboard .omni-metric:hover,
  .omni-dashboard .omni-button.primary:hover {
    transform: none;
  }
}
/* END OMNIAI COMMAND CENTER POLISH V1 */`}</style>
    </main>
  );
}
