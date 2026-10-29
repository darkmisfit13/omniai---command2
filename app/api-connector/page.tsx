"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import HoloOrb from "@/components/HoloOrb";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Globe,
  Radio,
  Play,
  RotateCcw,
  AlignLeft,
  XCircle,
  ShieldAlert,
  ShieldCheck,
  Download,
  Copy,
  Check,
  Key,
  ExternalLink,
  ChevronRight,
  Send,
  Lock,
  Layers,
  Terminal as TerminalIcon,
  Zap,
  Activity,
  ArrowRight,
  Server,
  Code,
  Flame,
  AlertTriangle,
} from "lucide-react";

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

interface WebhookRule {
  id: string;
  name: string;
  provider: "Stripe" | "GitHub" | "n8n" | "Custom";
  event: string;
  url: string;
  secret: string;
  status: "active" | "standby";
  deliveryCount: number;
}

interface DeveloperKey {
  id: string;
  name: string;
  service: string;
  maskedKey: string;
  status: "verified" | "connected" | "syncing";
  lastPing: string;
}

interface PipelineNode {
  id: string;
  label: string;
  type: "trigger" | "filter" | "destination";
  detail: string;
  x: number;
  y: number;
  status: "idle" | "processing" | "success" | "warning";
}

export default function OmniConnectPage() {
  const router = useRouter();

  // Panel 1: Request Constructor State
  const [method, setMethod] = useState<HttpMethod>("POST");
  const [endpointUrl, setEndpointUrl] = useState("https://api.darkmisfit.io/v2/stream/quantum");
  const [payloadBody, setPayloadBody] = useState(
    JSON.stringify(
      {
        event: "pipeline.dispatch",
        actor: "nexus-owner-dev-001",
        channel: "nexus_active_state_sync",
        parameters: {
          tone: "Flirty",
          inferenceSpeed: "Ultra",
          sandboxIsolation: true,
        },
      },
      null,
      2
    )
  );

  // Webhook Rules Generator State
  const [webhookRules, setWebhookRules] = useState<WebhookRule[]>([
    {
      id: "wh_stripe_01",
      name: "Stripe Payment Events",
      provider: "Stripe",
      event: "charge.succeeded",
      url: "https://api.darkmisfit.io/hooks/stripe-live",
      secret: "whsec_9a8f27b941c4d9204e12",
      status: "active",
      deliveryCount: 1420,
    },
    {
      id: "wh_github_02",
      name: "GitHub Push Listeners",
      provider: "GitHub",
      event: "push",
      url: "https://api.darkmisfit.io/hooks/github-matrix",
      secret: "whsec_48bc92ef10aa9843c089",
      status: "active",
      deliveryCount: 894,
    },
    {
      id: "wh_n8n_03",
      name: "n8n Workflow Ingestion",
      provider: "n8n",
      event: "workflow.trigger",
      url: "https://api.darkmisfit.io/hooks/n8n-cluster",
      secret: "whsec_110e9f88c3a1098de541",
      status: "active",
      deliveryCount: 3209,
    },
  ]);

  // Developer Keys Catalogue
  const [developerKeys, setDeveloperKeys] = useState<DeveloperKey[]>([
    {
      id: "key_google_ai",
      name: "Google AI Studio Key",
      service: "Gemini 3.5 API",
      maskedKey: "AIzaSy••••••••••••••••••••38f",
      status: "verified",
      lastPing: "0.0012s",
    },
    {
      id: "key_groq",
      name: "Groq LPU Engine",
      service: "Hardware Inference",
      maskedKey: "gsk_••••••••••••••••••••89A",
      status: "verified",
      lastPing: "0.0008s",
    },
    {
      id: "key_supabase",
      name: "Supabase DB Ledger",
      service: "PostgreSQL & RLS",
      maskedKey: "sbp_••••••••••••••••••••10a",
      status: "connected",
      lastPing: "0.0019s",
    },
    {
      id: "key_git",
      name: "Git Repo Sync Variable",
      service: "Production CI/CD",
      maskedKey: "GH_TOKEN_••••••••••••••••22F",
      status: "syncing",
      lastPing: "0.0024s",
    },
  ]);

  // Panel 2: Interactive WebGL Node-Mesh Desk
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [particleProgress, setParticleProgress] = useState(0);
  const [activePipelineRow, setActivePipelineRow] = useState<number>(0);
  const animationFrameId = useRef<number | null>(null);

  // Panel 3: Response Terminal & Security Matrix
  const [responseStatus, setResponseStatus] = useState<number>(200);
  const [responseLatency, setResponseLatency] = useState<number>(1.84);
  const [responseHeaders, setResponseHeaders] = useState({
    "content-type": "application/json; charset=utf-8",
    "x-nexus-shield": "Ironclad-Active",
    "x-sandbox-boundary": "strict-isolated",
    "x-sync-latency": "0.0018s",
    "x-ratelimit-remaining": "9984",
  });
  const [responseBody, setResponseBody] = useState({
    status: "200_OK",
    nodePath: "Trigger ➔ Processing Filter ➔ Action Destination",
    traversalTimeMs: 1.84,
    authVerified: true,
    sandboxId: "sbx_904fa1c9441e89",
    payloadDelivered: true,
  });

  // Security Matrix State
  const [authChecks, setAuthChecks] = useState({
    bearerVerified: true,
    hmacSignatureValid: true,
    sandboxIsolationEnforced: true,
    masterKeyProtectionActive: true,
  });
  const [securityToast, setSecurityToast] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [exportedReport, setExportedReport] = useState(false);
  const [loadingShortcut, setLoadingShortcut] = useState<string | null>(null);

  // Shortcut Click Handler
  const handleShortcutClick = (e: React.MouseEvent, href: string) => {
    e.preventDefault();
    setLoadingShortcut(href);
    setTimeout(() => {
      router.push(href);
    }, 240);
  };

  // Pipeline Workflows modeled as nodes
  const PIPELINES = [
    {
      title: "Stripe Webhook ➔ Sandbox Guard ➔ Postgres Sync",
      trigger: { label: "Stripe Trigger", detail: "charge.succeeded" },
      filter: { label: "Credential Firewall", detail: "Strip Master Key" },
      destination: { label: "Ledger Sync", detail: "nexus_active_state_sync" },
    },
    {
      title: "GitHub Push ➔ HMAC Validation ➔ Hot Reload Mesh",
      trigger: { label: "GitHub Hook", detail: "push (main branch)" },
      filter: { label: "SHA-256 HMAC", detail: "whsec verification" },
      destination: { label: "Dev Socket", detail: "ws://0.0.0.0:3000" },
    },
    {
      title: "Phone HUD Voice ➔ Whisper Engine ➔ Wave Stems",
      trigger: { label: "HUD Stream", detail: "Continuous PCM Audio" },
      filter: { label: "RMS Squelch", detail: "PyTorch Matrix Filter" },
      destination: { label: "OmniWave Staging", detail: "Vocals & Instrumentals" },
    },
  ];

  // Auto-beautify payload
  function handleFormatPayload() {
    try {
      const parsed = JSON.parse(payloadBody);
      setPayloadBody(JSON.stringify(parsed, null, 2));
    } catch {
      // keep as is
    }
  }

  // Hard Reset on Active Node Stream Instance
  function handleKillInstance() {
    setIsSimulating(false);
    setParticleProgress(0);
    setResponseStatus(500);
    setResponseLatency(0.42);
    setResponseBody({
      status: "TERMINATED_BY_OPERATOR",
      nodePath: "Trigger ➔ [TERMINATED]",
      traversalTimeMs: 0.42,
      authVerified: false,
      sandboxId: "sbx_killed",
      payloadDelivered: false,
    });
  }

  // Simulate Live Network Payload Trigger
  function handleSimulateTrigger() {
    setIsSimulating(true);
    setParticleProgress(0);
    setResponseStatus(200);

    const startTime = performance.now();
    let currentProgress = 0;

    const runTraversal = () => {
      currentProgress += 0.035;
      if (currentProgress < 1) {
        setParticleProgress(currentProgress);
        animationFrameId.current = requestAnimationFrame(runTraversal);
      } else {
        setParticleProgress(1);
        setIsSimulating(false);
        const elapsed = Number((performance.now() - startTime).toFixed(2));
        setResponseLatency(elapsed);
        setResponseBody({
          status: "200_OK",
          nodePath: "Trigger ➔ Processing Filter ➔ Action Destination",
          traversalTimeMs: elapsed,
          authVerified: authChecks.bearerVerified && authChecks.hmacSignatureValid,
          sandboxId: "sbx_" + Math.random().toString(36).substring(2, 10),
          payloadDelivered: true,
        });
      }
    };

    animationFrameId.current = requestAnimationFrame(runTraversal);
  }

  // Simulate Unauthorized Bypass Warning Trigger
  function handleTriggerUnauthorizedBypass() {
    setAuthChecks((prev) => ({ ...prev, bearerVerified: false }));
    setResponseStatus(403);
    setResponseLatency(0.85);
    setSecurityToast(
      "[Warning: Isolated Action Requiring Owner Bypass Approval]"
    );
    setResponseBody({
      status: "403_FORBIDDEN",
      nodePath: "Trigger ➔ [SECURITY_SHIELD_INTERCEPT]",
      traversalTimeMs: 0.85,
      authVerified: false,
      sandboxId: "sbx_firewall_quarantined",
      payloadDelivered: false,
    });

    // Auto clear toast after 5s
    setTimeout(() => {
      setSecurityToast(null);
      setAuthChecks((prev) => ({ ...prev, bearerVerified: true }));
    }, 5000);
  }

  // Copy key helper
  function copyKeyToClipboard(id: string, text: string) {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 1800);
  }

  // Export schema report
  function handleExportReport() {
    setExportedReport(true);
    const reportData = {
      timestamp: new Date().toISOString(),
      gridVersion: "OmniConnect-v3.2",
      clusterChannel: "nexus_active_state_sync",
      benchmark: "<0.002s",
      activeWebhooks: webhookRules,
      connectedKeys: developerKeys.map((k) => ({ name: k.name, status: k.status })),
      securityAudits: authChecks,
    };
    const blob = new Blob([JSON.stringify(reportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `OmniConnect_Global_Vault_Report_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setTimeout(() => setExportedReport(false), 2400);
  }

  // WebGL / Canvas 2D Traversal Visualizer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let localAnimId: number;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;

      ctx.clearRect(0, 0, width, height);

      // Background subtle cyber grid
      ctx.strokeStyle = "rgba(99, 102, 241, 0.08)";
      ctx.lineWidth = 1;
      const step = 28;
      for (let x = 0; x < width; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Three Node Points: Trigger (20%), Filter (50%), Destination (80%)
      const cy = height * 0.5;
      const n1 = { x: width * 0.18, y: cy };
      const n2 = { x: width * 0.5, y: cy };
      const n3 = { x: width * 0.82, y: cy };

      // Bezier interconnect curve 1: n1 -> n2
      ctx.beginPath();
      ctx.moveTo(n1.x, n1.y);
      ctx.bezierCurveTo(n1.x + 80, n1.y - 40, n2.x - 80, n2.y - 40, n2.x, n2.y);
      ctx.strokeStyle = "rgba(99, 102, 241, 0.35)";
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Bezier interconnect curve 2: n2 -> n3
      ctx.beginPath();
      ctx.moveTo(n2.x, n2.y);
      ctx.bezierCurveTo(n2.x + 80, n2.y + 40, n3.x - 80, n3.y + 40, n3.x, n3.y);
      ctx.strokeStyle = "rgba(99, 102, 241, 0.35)";
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Traversing Cyber Aqua particle vector
      if (particleProgress > 0 && particleProgress <= 1) {
        let px = 0;
        let py = 0;

        if (particleProgress <= 0.5) {
          const t = particleProgress * 2;
          const cp1x = n1.x + 80;
          const cp1y = n1.y - 40;
          const cp2x = n2.x - 80;
          const cp2y = n2.y - 40;
          px = (1 - t) ** 3 * n1.x + 3 * (1 - t) ** 2 * t * cp1x + 3 * (1 - t) * t ** 2 * cp2x + t ** 3 * n2.x;
          py = (1 - t) ** 3 * n1.y + 3 * (1 - t) ** 2 * t * cp1y + 3 * (1 - t) * t ** 2 * cp2y + t ** 3 * n2.y;
        } else {
          const t = (particleProgress - 0.5) * 2;
          const cp1x = n2.x + 80;
          const cp1y = n2.y + 40;
          const cp2x = n3.x - 80;
          const cp2y = n3.y + 40;
          px = (1 - t) ** 3 * n2.x + 3 * (1 - t) ** 2 * t * cp1x + 3 * (1 - t) * t ** 2 * cp2x + t ** 3 * n3.x;
          py = (1 - t) ** 3 * n2.y + 3 * (1 - t) ** 2 * t * cp1y + 3 * (1 - t) * t ** 2 * cp2y + t ** 3 * n3.y;
        }

        // Particle neon vector glow
        ctx.save();
        ctx.shadowColor = "#00ffcc";
        ctx.shadowBlur = 18;
        ctx.fillStyle = "#00ffcc";
        ctx.beginPath();
        ctx.arc(px, py, 7, 0, Math.PI * 2);
        ctx.fill();

        // Trailing beam
        ctx.shadowColor = "#00f2fe";
        ctx.shadowBlur = 28;
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(px, py, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Draw Node 1: Trigger
      drawNode(ctx, n1.x, n1.y, "TRIGGER", PIPELINES[activePipelineRow].trigger.label, "#6366f1");
      // Draw Node 2: Filter
      drawNode(ctx, n2.x, n2.y, "FILTER", PIPELINES[activePipelineRow].filter.label, "#00ffcc");
      // Draw Node 3: Destination
      drawNode(ctx, n3.x, n3.y, "ACTION", PIPELINES[activePipelineRow].destination.label, "#6366f1");

      localAnimId = requestAnimationFrame(render);
    };

    function drawNode(
      ctx: CanvasRenderingContext2D,
      x: number,
      y: number,
      role: string,
      title: string,
      color: string
    ) {
      ctx.save();
      ctx.shadowColor = color;
      ctx.shadowBlur = 12;

      // Outer ring
      ctx.beginPath();
      ctx.arc(x, y, 22, 0, Math.PI * 2);
      ctx.fillStyle = "#0a071b";
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Inner core
      ctx.beginPath();
      ctx.arc(x, y, 8, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();

      // Node Labels
      ctx.shadowBlur = 0;
      ctx.font = "bold 9px monospace";
      ctx.fillStyle = "#00ffcc";
      ctx.textAlign = "center";
      ctx.fillText(role, x, y - 30);

      ctx.font = "11px sans-serif";
      ctx.fillStyle = "#ffffff";
      ctx.fillText(title, x, y + 36);

      ctx.restore();
    }

    localAnimId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(localAnimId);
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
    };
  }, [particleProgress, activePipelineRow]);

  return (
    <div className="omniconnect-lab min-h-screen w-full bg-[#000000] text-[#e0def4] flex flex-col font-sans select-none relative overflow-x-hidden">
      {/* Global Embedded Styles for Obsidian Cyberpunk Tokens & .omni-shortcut */}
      <style jsx global>{`
        /* Physical Hover & Active Sensation for .omni-shortcut */
        .omni-shortcut {
          user-select: none;
          cursor: pointer;
          transition:
            transform 200ms cubic-bezier(0.16, 1, 0.3, 1),
            border-color 200ms ease,
            box-shadow 200ms ease,
            background 200ms ease;
          will-change: transform, border-color, box-shadow;
        }
        .omni-shortcut:hover {
          transform: translateY(-2px) scale(1.05) !important;
          border-color: #00ffff !important;
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.08),
            0 12px 32px rgba(0, 0, 0, 0.45),
            0 0 24px rgba(0, 255, 255, 0.45),
            0 0 40px rgba(0, 242, 254, 0.3) !important;
        }
        .omni-shortcut:active {
          transform: translateY(0px) scale(0.95) !important;
          border-color: #00ffff !important;
          box-shadow:
            inset 0 3px 8px rgba(0, 0, 0, 0.6),
            0 2px 6px rgba(0, 0, 0, 0.3),
            0 0 14px rgba(0, 255, 255, 0.4) !important;
          transition-duration: 75ms;
        }
        .omni-shortcut.is-loading {
          border-color: #00ffff !important;
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.1),
            0 0 24px rgba(0, 255, 255, 0.5),
            inset 0 0 12px rgba(0, 255, 255, 0.2) !important;
          pointer-events: none;
        }
        .omni-shortcut-spinner {
          display: inline-block;
          animation: spin 0.8s linear infinite;
          color: #00ffff;
          font-size: 14px;
        }
        .omni-shortcut-pulse {
          display: inline-block;
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #00ffff;
          margin-left: 6px;
          box-shadow: 0 0 8px #00ffff;
          animation: omni-pulse 0.8s ease-in-out infinite alternate;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>

      {/* SECURITY APPROVAL WARNING SLIDING TOAST */}
      {securityToast && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-xl border border-[#00ffcc] bg-[#000000] px-5 py-3 shadow-[0_0_30px_rgba(0,255,204,0.4)] animate-bounce">
          <AlertTriangle className="size-5 text-[#00ffcc]" />
          <span className="font-mono text-xs font-bold text-[#00ffcc]">
            {securityToast}
          </span>
          <button
            onClick={() => setSecurityToast(null)}
            className="ml-2 text-xs font-mono text-[#9490ac] hover:text-white"
          >
            [DISMISS]
          </button>
        </div>
      )}

      {/* UNIVERSAL APPLICATION HEADER */}
      <header className="sticky top-0 z-40 flex h-16 w-full items-center justify-between border-b border-[#6366f1]/25 bg-[#000000]/95 px-5 backdrop-blur-md">
        <div className="flex items-center gap-3.5">
          {/* Static, Non-Floating Color-Shifting WebGL Core Orb */}
          <div className="relative flex size-9 items-center justify-center">
            <HoloOrb size="xs" phase="idle" showStatusLabel={false} />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold uppercase tracking-[0.22em] text-[#00ffcc]">
                Dark Misfit Studios
              </span>
              <span className="text-[#6366f1] font-mono text-xs">/</span>
              <span className="text-xs text-[#9490ac] font-mono">OmniConnect API & Webhook Lab</span>
            </div>
            <h1 className="text-lg font-black tracking-tight text-white sm:text-xl">
              OmniAI - Nexus
            </h1>
          </div>
        </div>

        {/* Streamed Headers, Status Codes & Network Telemetry Logs */}
        <div className="hidden lg:flex items-center gap-4 text-xs font-mono">
          <div className="flex items-center gap-2 rounded-lg border border-[#6366f1]/30 bg-[#0a071b] px-3 py-1.5">
            <span className="size-2 rounded-full bg-[#00ffcc] animate-pulse" />
            <span className="text-[#9490ac]">Stream Status:</span>
            <span className="text-[#00ffcc] font-semibold">{responseStatus} OK</span>
          </div>

          <div className="flex items-center gap-2 rounded-lg border border-[#6366f1]/30 bg-[#0a071b] px-3 py-1.5">
            <span className="text-[#9490ac]">Latency:</span>
            <span className="text-[#00ffcc] font-semibold">{responseLatency}ms</span>
          </div>

          <div className="flex items-center gap-2 rounded-lg border border-[#6366f1]/30 bg-[#0a071b] px-3 py-1.5">
            <span className="text-[#9490ac]">Credential Shield:</span>
            <span className="text-[#00ffcc] font-semibold">Strict Isolated</span>
          </div>
        </div>

        {/* Header Right Action Tools */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleTriggerUnauthorizedBypass}
            className="flex items-center gap-1.5 rounded-lg border border-amber-400/40 bg-amber-400/10 px-3 py-1.5 text-xs font-mono font-medium text-amber-200 transition hover:bg-amber-400/20 active:scale-95"
          >
            <ShieldAlert className="size-3.5 text-amber-400" />
            <span>Test Security Intercept</span>
          </button>

          <button
            onClick={handleSimulateTrigger}
            disabled={isSimulating}
            className="flex items-center gap-1.5 rounded-lg border border-[#6366f1] bg-[#6366f1] px-3.5 py-1.5 text-xs font-semibold text-white shadow-[0_0_16px_rgba(99,102,241,0.4)] transition hover:brightness-110 active:scale-95 disabled:opacity-50"
          >
            <Play className={`size-3.5 ${isSimulating ? "animate-spin" : ""}`} />
            <span>Dispatch Payload</span>
          </button>
        </div>
      </header>

      {/* THREE-COLUMN WIDESCREEN WORKSPACE (25% | 50% | 25%) */}
      <main className="grid w-full flex-1 grid-cols-1 xl:grid-cols-12 gap-4 p-4 min-h-[calc(100vh-64px-36px)]">
        
        {/* ======================================================== */}
        {/* PANEL 1: ENDPOINT ROUTER & INTEGRATION DECK (LEFT - 25%) */}
        {/* ======================================================== */}
        <section className="xl:col-span-3 flex flex-col gap-4 rounded-2xl border border-[#6366f1]/25 bg-[#0a071b] p-4 shadow-[0_12px_32px_rgba(0,0,0,0.6)]">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[#6366f1]/20 pb-3">
            <div className="flex items-center gap-2">
              <Globe className="size-4 text-[#00ffcc]" />
              <h2 className="text-sm font-bold text-white tracking-wide">
                Endpoint Router &amp; Deck
              </h2>
            </div>
            <span className="font-mono text-[10px] text-[#00ffcc]">PANEL 01 // ROUTER</span>
          </div>

          {/* API Request Constructor HUD */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-[#9490ac] flex items-center justify-between">
              <span>REQUEST CONSTRUCTOR HUD</span>
              <span className="font-mono text-[10px] text-[#6366f1]">REST &amp; WS PIPELINE</span>
            </label>

            {/* Method Tabs */}
            <div className="grid grid-cols-4 gap-1 rounded-xl border border-[#6366f1]/20 bg-[#000000]/60 p-1 font-mono text-xs font-bold">
              {(["GET", "POST", "PUT", "DELETE"] as HttpMethod[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setMethod(m)}
                  className={`rounded-lg py-1.5 transition-all ${
                    method === m
                      ? "border border-[#6366f1] bg-[#6366f1] text-white shadow-[0_0_12px_rgba(99,102,241,0.4)]"
                      : "text-[#9490ac] hover:text-white"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>

            {/* Dark Obsidian Address Bar */}
            <div className="relative mt-1">
              <input
                type="text"
                value={endpointUrl}
                onChange={(e) => setEndpointUrl(e.target.value)}
                className="w-full rounded-xl border border-[#6366f1]/30 bg-[#000000] px-3 py-2 font-mono text-xs text-white outline-none transition focus:border-[#6366f1] focus:shadow-[0_0_12px_rgba(99,102,241,0.3)]"
              />
            </div>

            {/* Request Payload JSON */}
            <div className="space-y-1 pt-1">
              <div className="flex items-center justify-between text-[11px] font-mono">
                <span className="text-[#9490ac]">JSON Payload Body</span>
                <button
                  onClick={handleFormatPayload}
                  className="text-[#00ffcc] hover:underline"
                >
                  [Beautify]
                </button>
              </div>
              <textarea
                value={payloadBody}
                onChange={(e) => setPayloadBody(e.target.value)}
                rows={5}
                className="w-full resize-none rounded-xl border border-[#6366f1]/25 bg-[#000000] p-2.5 font-mono text-[11px] leading-relaxed text-[#00ffcc] outline-none transition focus:border-[#00ffcc]"
              />
            </div>
          </div>

          {/* Webhook Intake Generation Panel */}
          <div className="flex flex-col gap-2 pt-2 border-t border-[#6366f1]/20">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-white flex items-center gap-1.5">
                <Radio className="size-3.5 text-[#00ffcc]" />
                <span>Webhook Intake Rules</span>
              </label>
              <span className="font-mono text-[10px] text-[#00ffcc]">AUTOMATION</span>
            </div>

            <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
              {webhookRules.map((rule) => (
                <div
                  key={rule.id}
                  className="rounded-xl border border-[#6366f1]/20 bg-[#000000]/60 p-2.5 space-y-1 transition hover:border-[#6366f1]/50"
                >
                  <div className="flex items-center justify-between text-xs font-semibold text-white">
                    <span>{rule.name}</span>
                    <span className="font-mono text-[10px] text-[#00ffcc]">
                      {rule.deliveryCount} recv
                    </span>
                  </div>
                  <div className="font-mono text-[10px] text-[#9490ac] truncate">
                    {rule.url}
                  </div>
                  <div className="flex items-center justify-between pt-1 text-[10px] font-mono">
                    <span className="text-[#a78bfa]">{rule.event}</span>
                    <button
                      onClick={() => copyKeyToClipboard(rule.id, rule.secret)}
                      className="text-[#00ffcc] hover:underline"
                    >
                      {copiedKey === rule.id ? "Copied!" : "Copy Secret"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Third-Party Developer Keys Catalogue */}
          <div className="flex flex-col gap-2 pt-2 border-t border-[#6366f1]/20 flex-1">
            <label className="text-xs font-semibold text-[#9490ac] flex items-center justify-between">
              <span>CONNECTED DEVELOPER KEYS</span>
              <span className="font-mono text-[10px] text-[#00ffcc]">4 ENROLLED</span>
            </label>

            <div className="space-y-2 max-h-[170px] overflow-y-auto pr-1">
              {developerKeys.map((dk) => (
                <div
                  key={dk.id}
                  className="flex items-center justify-between rounded-xl border border-[#6366f1]/20 bg-[#000000]/60 p-2 text-xs"
                >
                  <div className="space-y-0.5">
                    <div className="font-semibold text-white text-[11px]">{dk.name}</div>
                    <div className="font-mono text-[10px] text-[#9490ac]">{dk.maskedKey}</div>
                  </div>
                  <div className="text-right font-mono">
                    <div className="text-[10px] text-[#00ffcc] font-semibold">{dk.status}</div>
                    <div className="text-[9px] text-[#9490ac]">{dk.lastPing}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ======================================================== */}
        {/* PANEL 2: INTERACTIVE WEBGL NODE-MESH DESK (CENTER - 50%) */}
        {/* ======================================================== */}
        <section className="xl:col-span-6 flex flex-col rounded-2xl border border-[#6366f1]/25 bg-[#0a071b] p-4 shadow-[0_12px_32px_rgba(0,0,0,0.6)] relative overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[#6366f1]/20 pb-3">
            <div className="flex items-center gap-2">
              <Layers className="size-4 text-[#00ffcc]" />
              <h2 className="text-sm font-bold text-white tracking-wide">
                Interactive WebGL Node-Mesh Desk
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-[#00ffcc] animate-ping" />
              <span className="font-mono text-[10px] text-[#00ffcc]">
                TRAVERSAL ENGINE READY
              </span>
            </div>
          </div>

          {/* Floating Simulation Toolbed */}
          <div className="my-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#6366f1]/35 bg-[#000000]/85 p-2 backdrop-blur-md">
            <div className="flex items-center gap-2">
              <button
                onClick={handleSimulateTrigger}
                disabled={isSimulating}
                className="flex items-center gap-1.5 rounded-lg border border-[#00ffcc]/40 bg-[#00ffcc]/15 px-3 py-1.5 text-xs font-mono font-bold text-[#00ffcc] transition hover:bg-[#00ffcc]/25 active:scale-95 disabled:opacity-50"
              >
                <Play className="size-3.5" />
                <span>Simulate Live Network Payload Trigger</span>
              </button>

              <button
                onClick={handleFormatPayload}
                className="flex items-center gap-1 rounded-lg border border-[#6366f1]/40 bg-[#6366f1]/20 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:border-[#6366f1] active:scale-95"
              >
                <AlignLeft className="size-3 text-[#6366f1]" />
                <span>Format Payload Indentation</span>
              </button>
            </div>

            <button
              onClick={handleKillInstance}
              className="flex items-center gap-1 rounded-lg border border-rose-500/40 bg-rose-500/10 px-2.5 py-1.5 text-xs font-mono font-bold text-rose-300 transition hover:bg-rose-500/20 active:scale-95"
            >
              <XCircle className="size-3 text-rose-400" />
              <span>Kill Active Node Stream Instance</span>
            </button>
          </div>

          {/* Active Pipeline Flow Selector */}
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[11px] font-mono text-[#9490ac]">WORKFLOW:</span>
            <div className="flex flex-wrap gap-1.5 flex-1">
              {PIPELINES.map((p, idx) => (
                <button
                  key={idx}
                  onClick={() => setActivePipelineRow(idx)}
                  className={`rounded-lg px-2.5 py-1 text-xs transition ${
                    activePipelineRow === idx
                      ? "border border-[#6366f1] bg-[#6366f1]/30 text-white font-bold"
                      : "border border-white/10 bg-[#000000]/40 text-[#9490ac] hover:text-white"
                  }`}
                >
                  {p.title}
                </button>
              ))}
            </div>
          </div>

          {/* WebGL / Canvas Traversal Flow Viewport */}
          <div className="relative flex-1 w-full rounded-xl border border-[#6366f1]/25 bg-[#000000] overflow-hidden min-h-[300px]">
            <canvas
              ref={canvasRef}
              width={720}
              height={360}
              className="w-full h-full block"
            />

            {/* Overlay Traversal Status */}
            <div className="absolute top-3 left-3 flex items-center gap-2 rounded-lg border border-[#6366f1]/30 bg-[#000000]/80 px-2.5 py-1 font-mono text-[10px] text-[#00ffcc]">
              <span className="size-1.5 rounded-full bg-[#00ffcc] animate-pulse" />
              <span>FLOW VECTOR: {PIPELINES[activePipelineRow].trigger.label} ➔ {PIPELINES[activePipelineRow].filter.label} ➔ {PIPELINES[activePipelineRow].destination.label}</span>
            </div>

            {isSimulating && (
              <div className="absolute bottom-3 right-3 flex items-center gap-2 rounded-lg border border-[#00ffcc]/40 bg-[#000000]/90 px-3 py-1 font-mono text-xs text-[#00ffcc]">
                <Zap className="size-3.5 text-[#00ffcc] animate-bounce" />
                <span>STREAMING VELOCITY: 0.0018s // PARTICLES LOCKED</span>
              </div>
            )}
          </div>

          {/* Quick Access .omni-shortcut row in the Desk */}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Link
              href="/dashboard"
              onClick={(e) => handleShortcutClick(e, "/dashboard")}
              className={`omni-shortcut flex items-center justify-between p-3 rounded-xl border border-[#a78bfa]/25 bg-[#0a071b] ${
                loadingShortcut === "/dashboard" ? "is-loading" : ""
              }`}
            >
              <div className="flex items-center gap-2">
                <Activity className="size-4 text-[#00ffcc]" />
                <span className="text-xs font-semibold text-white">
                  Nexus Intelligence Core
                </span>
              </div>
              {loadingShortcut === "/dashboard" ? (
                <span className="omni-shortcut-spinner">⟳</span>
              ) : (
                <span className="font-mono text-[10px] text-[#00ffff]">
                  HOVER 1.05 / PRESS 0.95
                </span>
              )}
            </Link>

            <Link
              href="/studio/ui-lab"
              onClick={(e) => handleShortcutClick(e, "/studio/ui-lab")}
              className={`omni-shortcut flex items-center justify-between p-3 rounded-xl border border-[#a78bfa]/25 bg-[#0a071b] ${
                loadingShortcut === "/studio/ui-lab" ? "is-loading" : ""
              }`}
            >
              <div className="flex items-center gap-2">
                <Code className="size-4 text-[#6366f1]" />
                <span className="text-xs font-semibold text-white">
                  Cosmic UI Laboratory
                </span>
              </div>
              {loadingShortcut === "/studio/ui-lab" ? (
                <span className="omni-shortcut-spinner">⟳</span>
              ) : (
                <span className="font-mono text-[10px] text-[#00ffff]">
                  HOVER 1.05 / PRESS 0.95
                </span>
              )}
            </Link>
          </div>

          {/* TELEMETRY LINE (Permanent Monospaced Bar at Absolute Bottom Margin) */}
          <div className="mt-3 flex items-center justify-between rounded-xl border border-[#00ffcc]/30 bg-[#000000] px-4 py-2 font-mono text-xs text-[#00ffcc]">
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-[#00ffcc] animate-pulse" />
              <span className="font-semibold">
                [Nexus-Connect: Live Webhook Matrix Enabled / Real-Time WebSocket Channel Active]
              </span>
            </div>
            <span className="hidden sm:inline text-[#9490ac] text-[11px]">
              CHANNEL: nexus_active_state_sync // 0.0018s
            </span>
          </div>
        </section>

        {/* ======================================================== */}
        {/* PANEL 3: RESPONSE BODY LOGS & SAFETY HUD (RIGHT - 25%)   */}
        {/* ======================================================== */}
        <section className="xl:col-span-3 flex flex-col gap-4 rounded-2xl border border-[#6366f1]/25 bg-[#0a071b] p-4 shadow-[0_12px_32px_rgba(0,0,0,0.6)]">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[#6366f1]/20 pb-3">
            <div className="flex items-center gap-2">
              <TerminalIcon className="size-4 text-[#00ffcc]" />
              <h2 className="text-sm font-bold text-white tracking-wide">
                Response Body Logs &amp; Safety
              </h2>
            </div>
            <span className="font-mono text-[10px] text-[#00ffcc]">PANEL 03 // AUDIT</span>
          </div>

          {/* Widescreen Response Terminal */}
          <div className="flex flex-col gap-2 flex-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-[#9490ac] flex items-center gap-1.5">
                <span>WIDESCREEN RESPONSE TERMINAL</span>
              </label>
              <span
                className={`font-mono text-xs font-bold px-2 py-0.5 rounded ${
                  responseStatus === 200
                    ? "bg-[#00ffcc]/20 text-[#00ffcc] border border-[#00ffcc]/40"
                    : "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                }`}
              >
                {responseStatus === 200 ? "200 OK" : responseStatus === 403 ? "403 Forbidden" : "500 Error"}
              </span>
            </div>

            {/* Scrollable Monospaced Log Window in Pure Black */}
            <div className="flex-1 max-h-[220px] overflow-y-auto rounded-xl border border-[#00ffcc]/30 bg-[#000000] p-3 font-mono text-[10px] text-[#00ffcc] select-text shadow-inner space-y-2">
              <div>
                <span className="text-[#9490ac]">{"// RESPONSE HEADERS"}</span>
                {Object.entries(responseHeaders).map(([k, v]) => (
                  <div key={k} className="text-[#c4b5fd]">
                    {k}: <span className="text-white">{v}</span>
                  </div>
                ))}
              </div>

              <div className="pt-2 border-t border-[#6366f1]/30">
                <span className="text-[#9490ac]">{`// PAYLOAD BODY (${responseLatency}ms)`}</span>
                <pre className="whitespace-pre-wrap text-[#00ffcc] mt-1">
                  {JSON.stringify(responseBody, null, 2)}
                </pre>
              </div>
            </div>
          </div>

          {/* Live Request Security Matrix */}
          <div className="flex flex-col gap-2 pt-2 border-t border-[#6366f1]/20">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-white flex items-center gap-1.5">
                <ShieldCheck className="size-3.5 text-[#00ffcc]" />
                <span>Live Request Security Matrix</span>
              </label>
              <span className="font-mono text-[10px] text-[#00ffcc]">IRONCLAD</span>
            </div>

            <div className="space-y-1.5 rounded-xl border border-[#6366f1]/20 bg-[#000000]/60 p-2.5 font-mono text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[#d8d3ef] text-[11px]">Bearer Token Auth:</span>
                <span
                  className={
                    authChecks.bearerVerified ? "text-[#00ffcc]" : "text-rose-400 font-bold"
                  }
                >
                  {authChecks.bearerVerified ? "VERIFIED" : "BYPASS_ATTEMPT"}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[#d8d3ef] text-[11px]">HMAC-SHA256 Signature:</span>
                <span className="text-[#00ffcc]">VALIDATED</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[#d8d3ef] text-[11px]">Sandbox Container Isolation:</span>
                <span className="text-[#00ffcc]">ENFORCED</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[#d8d3ef] text-[11px]">Master Key Protection:</span>
                <span className="text-[#00ffcc]">STRIPPED_SECURE</span>
              </div>
            </div>
          </div>

          {/* Vault Dispatch Link */}
          <div className="pt-2 border-t border-[#6366f1]/20">
            <button
              onClick={handleExportReport}
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-[#6366f1] bg-[#6366f1] py-3 px-4 text-xs font-bold text-white shadow-[0_0_20px_rgba(99,102,241,0.4)] transition hover:brightness-110 active:scale-95"
            >
              {exportedReport ? (
                <>
                  <Check className="size-4 text-[#00ffcc]" />
                  <span>Report Exported to Global Vault!</span>
                </>
              ) : (
                <>
                  <Download className="size-4 text-[#00ffcc]" />
                  <span>Export Full Integration Schema Report to Global Vault</span>
                </>
              )}
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
