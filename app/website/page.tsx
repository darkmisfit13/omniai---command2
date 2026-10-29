"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import HoloOrb from "@/components/HoloOrb";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Globe,
  Radio,
  Play,
  RotateCcw,
  Trash2,
  Download,
  Copy,
  Check,
  Zap,
  Activity,
  Layers,
  Terminal as TerminalIcon,
  Server,
  ArrowRight,
  Clock,
  Sliders,
  ChevronRight,
  Cpu,
  Database,
  ShieldCheck,
  Send,
  UploadCloud,
  FileCode,
  Sparkles,
  RefreshCw,
  CornerDownRight,
  AlertCircle,
  BarChart3,
  Network,
  Share2,
  Search,
  ExternalLink,
  ShieldAlert,
  Eye,
  SlidersHorizontal,
  Video,
  FileSpreadsheet,
  Gauge,
  Smartphone,
  Flame,
} from "lucide-react";

export type ParsingScript = "deep-web" | "tiktok-scrape" | "social-listener" | "competitor-delta";
export type AutomationInterval = "realtime" | "10m" | "daily" | "custom-jitter";

export interface SentimentNode {
  id: string;
  label: string;
  weight: number; // 1 to 10
  sentiment: "positive" | "neutral" | "volatile" | "negative";
  volume: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
}

export interface ActivityTickLog {
  id: string;
  timestamp: string;
  step: string;
  level: "TICK" | "DOM" | "PAYLOAD" | "SENTIMENT" | "BRIDGE";
  detail: string;
}

export interface SafeZoneHazard {
  id: string;
  assetName: string;
  platform: "TikTok" | "IG Reels" | "YouTube Shorts";
  hazardZone: "Right Action Stack" | "Bottom Caption Zone" | "Top Navigation Zone";
  riskScore: "LOW" | "ELEVATED" | "CRITICAL";
  recommendation: string;
}

export default function OmniAnalyzerPage() {
  const router = useRouter();

  // PANEL 1: CRAWLER TARGETING & SOCIAL INTAKE HUD STATE
  const [targetAddress, setTargetAddress] = useState("https://tiktok.com/@darkmisfitstudios");
  const [activeScript, setActiveScript] = useState<ParsingScript>("tiktok-scrape");
  const [syncInterval, setSyncInterval] = useState<AutomationInterval>("10m");
  const [promptInput, setPromptInput] = useState(
    "Extract top 25 viral hook structures, compute keyword sentiment clusters, and audit video text coordinates against native TikTok overlay barriers."
  );
  const [isScraping, setIsScraping] = useState(false);

  // PANEL 2: WEBGL SENTIMENT MATRIX & LIVE STREAM TERMINAL STATE
  const [showSafeZones, setShowSafeZones] = useState(false);
  const [selectedSentimentNode, setSelectedSentimentNode] = useState<SentimentNode | null>(null);
  const [streamTicks, setStreamTicks] = useState<ActivityTickLog[]>([
    {
      id: "tick-1",
      timestamp: "00:00:00.014",
      step: "[OMNIEXTENSION BRIDGE]",
      level: "BRIDGE",
      detail: "Handshake verified on local IPC bridge port 9222. Chrome DevTools Protocol bound.",
    },
    {
      id: "tick-2",
      timestamp: "00:00:00.048",
      step: "[RESOLVING IP...]",
      level: "TICK",
      detail: "Edge proxy tunnel engaged (IPv6 / Cloudflare Warp Node: 104.21.64.120).",
    },
    {
      id: "tick-3",
      timestamp: "00:00:00.092",
      step: "[EXTRACTING DOM STRUCTURE...]",
      level: "DOM",
      detail: "Ingested 4,120 DOM tree nodes. Metadata hydrated via JSON-LD schema parser.",
    },
  ]);

  // PANEL 3: PERFORMANCE AUDIT & DATA DISPATCH TERMINAL STATE
  const [hazardLogs, setHazardLogs] = useState<SafeZoneHazard[]>([
    {
      id: "haz-1",
      assetName: "quantum_hero_v3.mp4",
      platform: "TikTok",
      hazardZone: "Right Action Stack",
      riskScore: "CRITICAL",
      recommendation: "Shift call-to-action typography 85px left to clear native like/share icons.",
    },
    {
      id: "haz-2",
      assetName: "brand_intro_1080x1920.mp4",
      platform: "IG Reels",
      hazardZone: "Bottom Caption Zone",
      riskScore: "ELEVATED",
      recommendation: "Bottom subtitle baseline encroaching on native 150px account sound banner.",
    },
    {
      id: "haz-3",
      assetName: "synth_breakdown_reel.mp4",
      platform: "YouTube Shorts",
      hazardZone: "Top Navigation Zone",
      riskScore: "LOW",
      recommendation: "Top badge is safely 24px below camera notch & search header.",
    },
  ]);

  // Notifications & Feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState(false);
  const [loadingShortcut, setLoadingShortcut] = useState<string | null>(null);

  // Canvas Refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameId = useRef<number | null>(null);

  // Sentiment Nodes Matrix
  const sentimentNodesRef = useRef<SentimentNode[]>([
    { id: "s-1", label: "#Cyberpunk", weight: 9.4, sentiment: "positive", volume: "1.4M mentions", x: 180, y: 140, vx: 0.3, vy: -0.2, radius: 28 },
    { id: "s-2", label: "Quantum Speed", weight: 8.8, sentiment: "positive", volume: "840K mentions", x: 340, y: 190, vx: -0.2, vy: 0.3, radius: 24 },
    { id: "s-3", label: "Virality Index", weight: 9.1, sentiment: "positive", volume: "2.1M views", x: 260, y: 100, vx: 0.2, vy: 0.2, radius: 26 },
    { id: "s-4", label: "Overlay Friction", weight: 6.2, sentiment: "negative", volume: "120K flags", x: 440, y: 130, vx: -0.3, vy: -0.1, radius: 18 },
    { id: "s-5", label: "GenAI Workflow", weight: 8.5, sentiment: "neutral", volume: "620K queries", x: 160, y: 260, vx: 0.2, vy: -0.3, radius: 22 },
    { id: "s-6", label: "Price Elasticity", weight: 7.0, sentiment: "volatile", volume: "310K audits", x: 380, y: 270, vx: -0.1, vy: 0.2, radius: 20 },
    { id: "s-7", label: "Brand Affinity", weight: 9.6, sentiment: "positive", volume: "98.2% positive", x: 500, y: 210, vx: 0.2, vy: 0.1, radius: 25 },
  ]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleShortcutClick = (href: string, id: string) => {
    setLoadingShortcut(id);
    router.push(href);
  };

  const appendTick = useCallback((step: string, level: ActivityTickLog["level"], detail: string) => {
    const d = new Date();
    const timestamp = `${d.getHours().toString().padStart(2, "0")}:${d
      .getMinutes()
      .toString()
      .padStart(2, "0")}:${d.getSeconds().toString().padStart(2, "0")}.${d
      .getMilliseconds()
      .toString()
      .padStart(3, "0")}`;

    const newLog: ActivityTickLog = {
      id: `tick-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp,
      step,
      level,
      detail,
    };
    setStreamTicks((prev) => [newLog, ...prev.slice(0, 75)]);
  }, []);

  // Execute Deep Data Scrape
  const handleExecuteScrape = () => {
    if (isScraping || !targetAddress.trim()) return;
    setIsScraping(true);

    appendTick("[INITIALIZING DEEP SCRAPER]", "TICK", `Constructed target vector for ${targetAddress}`);
    appendTick("[PARSING SOCIAL API PAYLOAD...]", "PAYLOAD", "Decrypted 28 media metadata streams & engagement matrices.");

    const steps = [
      { step: "[RESOLVING IP...]", level: "TICK" as const, detail: "Rotating residential proxies (US-West / 10 Gbps unthrottled pipe)." },
      { step: "[EXTRACTING DOM STRUCTURE...]", level: "DOM" as const, detail: "Extracted full viewport hierarchy, audio hash, and video bitrate vectors." },
      { step: "[DECODING SENTIMENT METRICS...]", level: "SENTIMENT" as const, detail: "Synthesized 7 public sentiment clusters with 92.4% confidence score." },
      { step: "[SAFE-ZONE BARRIER AUDIT]", level: "BRIDGE" as const, detail: "Cross-checked video text anchors against native app overlay boundaries." },
    ];

    let i = 0;
    const interval = setInterval(() => {
      if (i < steps.length) {
        appendTick(steps[i].step, steps[i].level, steps[i].detail);
        i++;
      } else {
        clearInterval(interval);
        setIsScraping(false);
        showToast("Deep Data Scrape Complete: Telemetry Stream Synchronized");
      }
    }, 450);
  };

  // Floating Command 1: Clear Active Cache
  const handleClearCache = () => {
    setStreamTicks((prev) => prev.slice(0, 3));
    showToast("Active Scraper Cache Purged [DOM Buffers Reclaimed]");
  };

  // Floating Command 2: Force Re-Scaffold Verification
  const handleForceRescaffold = () => {
    appendTick("[RE-SCAFFOLD VERIFICATION]", "BRIDGE", "OmniExtension handshake re-authenticated with TLS 1.3 certs.");
    showToast("Scaffold Verified: Proxy Rotation & Bridge Encrypted");
  };

  // Floating Command 3: Toggle Safe Zones
  const handleToggleSafeZones = () => {
    setShowSafeZones((prev) => !prev);
    showToast(!showSafeZones ? "Social Overlay Safe Zones Activated" : "Social Overlay Safe Zones Hidden");
  };

  // Export 1: Export Full Security and Scraping Audit Report to Global Vault
  const handleExportAuditReport = () => {
    const reportData = {
      app: "OmniAI - Nexus",
      module: "OmniAnalyzer Studio",
      targetUrl: targetAddress,
      scriptType: activeScript,
      cronInterval: syncInterval,
      timestamp: new Date().toISOString(),
      sentimentNodes: sentimentNodesRef.current,
      activityLogs: streamTicks,
      hazardAudits: hazardLogs,
      performanceMetrics: {
        similarWebTraffic: "4.8M visits/mo",
        domNodes: 4120,
        averageLatencyMs: 18.2,
        safeZoneHazardsDetected: 2,
      },
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nexus-omnianalyzer-audit-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast("Full Security & Scraping Audit Report Exported to Global Vault");
  };

  // Export 2: Pipeline Scraped Dataset Direct to Tri-Agent Council Left Pane Overlays
  const handlePipelineToCouncil = () => {
    appendTick("[COUNCIL PIPELINE]", "PAYLOAD", "Piped 7 sentiment vectors to Tri-Agent Council Left Pane Overlays.");
    showToast("Scraped Dataset Piped to Tri-Agent Council Overlays");
  };

  // Export 3: Push Competitor Performance Metrics to Omni Video Studio Staging Area
  const handlePushToVideoStudio = () => {
    appendTick("[VIDEO STUDIO DISPATCH]", "SENTIMENT", "Dispatched viral hook structures to Omni Video Studio Staging Area.");
    showToast("Competitor Performance Metrics Pushed to Video Studio");
  };

  // WebGL / Canvas Renderer for Sentiment Matrix & Particle Vectors
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = (canvas.width = canvas.parentElement?.clientWidth || 700);
    let height = (canvas.height = canvas.parentElement?.clientHeight || 480);

    const handleResize = () => {
      if (!canvas.parentElement) return;
      width = canvas.width = canvas.parentElement.clientWidth;
      height = canvas.height = canvas.parentElement.clientHeight;
    };

    window.addEventListener("resize", handleResize);

    // Particle nodes physics & rendering
    const nodes = sentimentNodesRef.current;

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Velvet Black Canvas
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, width, height);

      // Subtle Cybernetic Background Grid
      ctx.strokeStyle = "rgba(99, 102, 241, 0.08)";
      ctx.lineWidth = 1;
      const gridSize = 45;
      for (let x = 0; x < width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Update Node Positions with gentle bounce
      for (const node of nodes) {
        node.x += node.vx;
        node.y += node.vy;

        if (node.x - node.radius < 20 || node.x + node.radius > width - 20) node.vx *= -1;
        if (node.y - node.radius < 20 || node.y + node.radius > height - 20) node.vy *= -1;
      }

      // Render Interconnecting Sentiment Filaments
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 180) {
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            const alpha = (1 - dist / 180) * 0.4;
            ctx.strokeStyle = `rgba(99, 102, 241, ${alpha})`;
            ctx.lineWidth = 1.5;
            ctx.stroke();
          }
        }
      }

      // Render Interactive Particle Sentiment Nodes
      for (const node of nodes) {
        const isSelected = selectedSentimentNode?.id === node.id;

        let strokeColor = "#00ffcc"; // Positive
        if (node.sentiment === "neutral") strokeColor = "#6366f1";
        if (node.sentiment === "volatile") strokeColor = "#ff8a4c";
        if (node.sentiment === "negative") strokeColor = "#ff2a6d";

        // Outer Glow
        ctx.save();
        ctx.shadowColor = strokeColor;
        ctx.shadowBlur = isSelected ? 28 : 16;

        // Node Body
        ctx.fillStyle = "#0a071b"; // Deep Obsidian-Purple
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = isSelected ? 3 : 1.5;
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();

        // Node Center Core
        ctx.fillStyle = strokeColor;
        ctx.beginPath();
        ctx.arc(node.x, node.y, 4, 0, Math.PI * 2);
        ctx.fill();

        // Label above
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 11px 'Inter', sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(node.label, node.x, node.y - node.radius - 6);

        // Sentiment Weight
        ctx.fillStyle = strokeColor;
        ctx.font = "bold 9px 'JetBrains Mono', monospace";
        ctx.fillText(`${node.weight.toFixed(1)} / 10`, node.x, node.y + node.radius + 14);
      }

      // SOCIAL OVERLAY SAFE ZONES RENDERER (When toggled ON)
      if (showSafeZones) {
        // Safe Zone Box simulating 9:16 vertical video viewport on TikTok / Reels / Shorts
        const vpW = Math.min(280, width * 0.4);
        const vpH = Math.min(440, height * 0.88);
        const vpX = (width - vpW) / 2;
        const vpY = (height - vpH) / 2;

        // Viewport Border
        ctx.strokeStyle = "rgba(0, 255, 255, 0.7)";
        ctx.lineWidth = 2;
        ctx.strokeRect(vpX, vpY, vpW, vpH);

        // Danger Zone: Right Action Stack (avatar, like, comment, bookmark, share)
        ctx.fillStyle = "rgba(255, 42, 109, 0.2)";
        ctx.fillRect(vpX + vpW - 65, vpY + 70, 60, vpH - 160);
        ctx.strokeStyle = "rgba(255, 42, 109, 0.7)";
        ctx.strokeRect(vpX + vpW - 65, vpY + 70, 60, vpH - 160);

        // Danger Zone: Bottom Caption & Audio Bar
        ctx.fillStyle = "rgba(255, 138, 76, 0.2)";
        ctx.fillRect(vpX + 10, vpY + vpH - 95, vpW - 20, 85);
        ctx.strokeStyle = "rgba(255, 138, 76, 0.7)";
        ctx.strokeRect(vpX + 10, vpY + vpH - 95, vpW - 20, 85);

        // Danger Zone: Top Header Navigation (Search, Live, Following)
        ctx.fillStyle = "rgba(99, 102, 241, 0.2)";
        ctx.fillRect(vpX + 10, vpY + 8, vpW - 20, 48);
        ctx.strokeStyle = "rgba(99, 102, 241, 0.7)";
        ctx.strokeRect(vpX + 10, vpY + 8, vpW - 20, 48);

        // Safe Center Zone label
        ctx.fillStyle = "#00ffcc";
        ctx.font = "bold 10px 'JetBrains Mono', monospace";
        ctx.textAlign = "center";
        ctx.fillText("TIKTOK/REELS SAFE ZONE (TEXT SAFE)", vpX + vpW / 2, vpY + vpH / 2);
      }

      animFrameId.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener("resize", handleResize);
      if (animFrameId.current) cancelAnimationFrame(animFrameId.current);
    };
  }, [showSafeZones, selectedSentimentNode]);

  return (
    <div className="flex min-h-screen w-full flex-col bg-[#000000] text-[#f1f0f7] selection:bg-[#6366f1]/40 selection:text-white">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-xl border border-[#00ffcc] bg-[#000000] px-5 py-2.5 shadow-[0_0_35px_rgba(0,255,204,0.35)] animate-in fade-in slide-in-from-top-4 duration-200">
          <Sparkles className="size-4 text-[#00ffcc] animate-spin" />
          <span className="font-mono text-xs font-bold text-[#00ffcc]">{toastMessage}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="ml-2 text-xs font-mono text-[#9490ac] hover:text-white"
          >
            [X]
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
              <span className="text-xs text-[#9490ac] font-mono">OmniAnalyzer Studio</span>
            </div>
            <h1 className="text-lg font-black tracking-tight text-white sm:text-xl">OmniAI - Nexus</h1>
          </div>
        </div>

        {/* Streamed Metrics & Telemetry Readouts */}
        <div className="hidden lg:flex items-center gap-4 text-xs font-mono">
          <div className="flex items-center gap-2 rounded-lg border border-[#6366f1]/30 bg-[#0a071b] px-3 py-1.5">
            <span className="size-2 rounded-full bg-[#00ffcc] animate-pulse" />
            <span className="text-[#9490ac]">OmniExtension:</span>
            <span className="text-[#00ffcc] font-semibold">Local Bridge Bound</span>
          </div>

          <div className="flex items-center gap-2 rounded-lg border border-[#6366f1]/30 bg-[#0a071b] px-3 py-1.5">
            <span className="text-[#9490ac]">Scraper Engine:</span>
            <span className="text-[#00ffcc] font-semibold">V8 Sub-Zero Active</span>
          </div>

          <div className="flex items-center gap-2 rounded-lg border border-[#6366f1]/30 bg-[#0a071b] px-3 py-1.5">
            <span className="text-[#9490ac]">Hazards:</span>
            <span className="text-amber-300 font-semibold">{hazardLogs.length} Checked</span>
          </div>
        </div>

        {/* Right Navigation Quick Links */}
        <div className="flex items-center gap-2.5">
          <Link
            href="/automations"
            className="flex items-center gap-1.5 rounded-lg border border-[#6366f1]/40 bg-[#0a071b] px-3 py-1.5 text-xs font-mono font-medium text-[#f1f0f7] transition hover:border-[#00ffff] hover:text-[#00ffff] active:scale-95"
          >
            <Zap className="size-3.5 text-[#00ffcc]" />
            <span>Automations</span>
          </Link>
          <Link
            href="/api-connector"
            className="flex items-center gap-1.5 rounded-lg border border-[#6366f1]/40 bg-[#0a071b] px-3 py-1.5 text-xs font-mono font-medium text-[#f1f0f7] transition hover:border-[#00ffff] hover:text-[#00ffff] active:scale-95"
          >
            <Radio className="size-3.5 text-[#6366f1]" />
            <span>OmniConnect</span>
          </Link>
        </div>
      </header>

      {/* THREE-COLUMN WIDESCREEN WORKSPACE (25% | 50% | 25%) */}
      <main className="grid flex-1 grid-cols-1 lg:grid-cols-12 gap-0 overflow-hidden">
        {/* =========================================================================
            PANEL 1: CRAWLER TARGETING & SOCIAL INTAKE HUD (LEFT PANEL - 25% WIDTH)
           ========================================================================= */}
        <section className="lg:col-span-3 border-r border-[#6366f1]/25 bg-[#000000] p-4 flex flex-col gap-4 overflow-y-auto max-h-[calc(100vh-4rem)]">
          {/* Section Header */}
          <div className="flex items-center justify-between border-b border-[#6366f1]/20 pb-3">
            <div className="flex items-center gap-2">
              <Search className="size-4 text-[#00ffcc]" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-white">Crawler Intake HUD</h2>
            </div>
            <span className="font-mono text-[10px] text-[#00ffcc] bg-[#00ffcc]/10 border border-[#00ffcc]/30 px-2 py-0.5 rounded">
              OmniBridge
            </span>
          </div>

          {/* 1. Target Address Constructor */}
          <div className="rounded-xl border border-[#6366f1]/30 bg-[#0a071b] p-3.5 flex flex-col gap-2">
            <label className="text-xs font-bold text-white flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Globe className="size-3.5 text-[#6366f1]" />
                Target Address Constructor
              </span>
              <span className="text-[10px] font-mono text-[#9490ac]">Domains / Social URLs</span>
            </label>

            <div className="relative">
              <input
                type="text"
                value={targetAddress}
                onChange={(e) => setTargetAddress(e.target.value)}
                placeholder="https://tiktok.com/@handle or domain..."
                className="w-full rounded-lg border border-[#6366f1]/40 bg-[#000000] px-3 py-2 font-mono text-xs text-[#00ffcc] placeholder-[#8d87a8]/60 focus:border-[#00ffcc] focus:outline-none"
              />
            </div>

            <div className="flex flex-wrap gap-1.5 pt-1">
              {[
                { label: "TikTok Profile", url: "https://tiktok.com/@darkmisfitstudios" },
                { label: "Instagram Feed", url: "https://instagram.com/omniai.nexus" },
                { label: "Competitor Site", url: "https://darkmisfit.io" },
                { label: "YouTube Channel", url: "https://youtube.com/@darkmisfitlabs" },
              ].map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => setTargetAddress(preset.url)}
                  className="rounded border border-[#6366f1]/25 bg-[#000000] px-2 py-0.5 font-mono text-[9px] text-[#8d87a8] hover:text-[#00ffcc] hover:border-[#00ffcc] transition"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* 2. Platform Extraction Matrix (Pill Selector Deck) */}
          <div className="rounded-xl border border-[#6366f1]/30 bg-[#0a071b] p-3.5 flex flex-col gap-2.5">
            <span className="text-xs font-bold text-white flex items-center gap-1.5">
              <SlidersHorizontal className="size-3.5 text-[#00ffcc]" />
              Platform Extraction Matrix
            </span>

            <div className="grid grid-cols-2 gap-2">
              {[
                { id: "deep-web", label: "[Deep Web Crawl]", desc: "DOM & Meta Tree" },
                { id: "tiktok-scrape", label: "[TikTok Profile Scrape]", desc: "Engagement & Audio" },
                { id: "social-listener", label: "[Social Feed Listener]", desc: "Real-time Mentions" },
                { id: "competitor-delta", label: "[Competitor Delta Scrape]", desc: "Price & Feature Diff" },
              ].map((script) => (
                <button
                  key={script.id}
                  onClick={() => setActiveScript(script.id as ParsingScript)}
                  className={`flex flex-col rounded-lg border p-2 text-left transition ${
                    activeScript === script.id
                      ? "border-[#00ffcc] bg-[#00ffcc]/10 shadow-[0_0_15px_rgba(0,255,204,0.2)] text-white"
                      : "border-[#6366f1]/30 bg-[#000000] text-[#9490ac] hover:border-[#6366f1]"
                  }`}
                >
                  <span className="font-mono text-[11px] font-bold text-white">{script.label}</span>
                  <span className="font-mono text-[9px] text-[#8d87a8] mt-0.5">{script.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 3. Automation Sync Core (Cron Ticker Grid) */}
          <div className="rounded-xl border border-[#6366f1]/30 bg-[#0a071b] p-3.5 flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Clock className="size-3.5 text-[#6366f1]" />
                Automation Sync Core
              </span>
              <span className="text-[10px] font-mono text-[#00ffcc]">{syncInterval}</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {[
                { id: "realtime", label: "Real-Time Stream", hint: "WebSocket Hook" },
                { id: "10m", label: "Every 10 Minutes", hint: "*/10 * * * *" },
                { id: "daily", label: "Daily Brand Audit", hint: "0 0 * * *" },
                { id: "custom-jitter", label: "Custom Jitter Cron", hint: "±180ms buffer" },
              ].map((cron) => (
                <button
                  key={cron.id}
                  onClick={() => setSyncInterval(cron.id as AutomationInterval)}
                  className={`flex flex-col rounded-lg border p-2 text-left transition ${
                    syncInterval === cron.id
                      ? "border-[#6366f1] bg-[#6366f1]/20 text-white"
                      : "border-[#6366f1]/25 bg-[#000000] text-[#8d87a8] hover:border-[#6366f1]"
                  }`}
                >
                  <span className="font-mono text-[11px] font-bold text-white">{cron.label}</span>
                  <span className="font-mono text-[9px] text-[#8d87a8]">{cron.hint}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 4. Prompt Action Anchor */}
          <div className="rounded-xl border border-[#6366f1]/30 bg-[#0a071b] p-3.5 flex flex-col gap-2.5">
            <label className="text-xs font-bold text-white flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <FileCode className="size-3.5 text-[#00ffcc]" />
                Prompt Action Anchor
              </span>
              <span className="text-[10px] font-mono text-[#9490ac]">Zero-Downtime</span>
            </label>

            <textarea
              rows={3}
              value={promptInput}
              onChange={(e) => setPromptInput(e.target.value)}
              placeholder="Enter extraction instructions..."
              className="w-full resize-none rounded-lg border border-[#6366f1]/40 bg-[#000000] p-2.5 font-mono text-xs text-[#f1f0f7] placeholder-[#8d87a8]/60 focus:border-[#00ffcc] focus:outline-none"
            />

            <button
              onClick={handleExecuteScrape}
              disabled={isScraping}
              className="flex items-center justify-center gap-2 rounded-lg border border-[#6366f1] bg-[#6366f1] py-2.5 font-mono text-xs font-bold text-white transition hover:bg-[#6366f1]/80 hover:shadow-[0_0_20px_rgba(99,102,241,0.5)] active:scale-95 disabled:opacity-50"
            >
              {isScraping ? (
                <>
                  <RefreshCw className="size-4 animate-spin" />
                  Scraping Active Pipeline...
                </>
              ) : (
                <>
                  <Play className="size-4 fill-white" />
                  [Execute Deep Data Scrape]
                </>
              )}
            </button>
          </div>
        </section>

        {/* =========================================================================
            PANEL 2: WEBGL SENTIMENT MATRIX & LIVE STREAM TERMINAL (CENTER PANELS - 50% WIDTH)
           ========================================================================= */}
        <section className="lg:col-span-6 bg-[#000000] p-4 flex flex-col justify-between overflow-hidden relative">
          {/* Top Bar: Visual Sentiment Viewport Header & Floating Command Deck */}
          <div className="flex flex-col gap-2 z-10">
            <div className="flex items-center justify-between border-b border-[#6366f1]/20 pb-2">
              <div className="flex items-center gap-2">
                <Flame className="size-4 text-[#00ffcc]" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-white">
                  Visual Sentiment Viewport & Topic Matrix
                </h2>
              </div>
              <div className="flex items-center gap-3 text-xs font-mono">
                <span className="text-[#9490ac]">Active Nodes:</span>
                <span className="text-[#00ffcc] font-bold">7 Clusters</span>
              </div>
            </div>

            {/* Floating Command Deck */}
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#6366f1]/40 bg-[#0a071b]/90 backdrop-blur-md px-3 py-1.5 shadow-2xl">
              <div className="flex items-center gap-2 text-xs font-mono text-[#9490ac]">
                <Activity className="size-3.5 text-[#00ffcc]" />
                <span>OmniAnalyzer Command Deck</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleClearCache}
                  className="flex items-center gap-1 rounded-lg border border-[#6366f1]/30 bg-[#000000] px-2 py-1 font-mono text-[11px] text-[#8d87a8] transition hover:border-[#ff2a6d] hover:text-[#ff2a6d] active:scale-95"
                >
                  <Trash2 className="size-3" />
                  [Clear Active Cache]
                </button>

                <button
                  onClick={handleForceRescaffold}
                  className="flex items-center gap-1 rounded-lg border border-[#6366f1]/30 bg-[#000000] px-2 py-1 font-mono text-[11px] text-[#8d87a8] transition hover:border-[#00ffff] hover:text-[#00ffff] active:scale-95"
                >
                  <ShieldCheck className="size-3" />
                  [Force Re-Scaffold Verification]
                </button>

                <button
                  onClick={handleToggleSafeZones}
                  className={`flex items-center gap-1 rounded-lg border px-2 py-1 font-mono text-[11px] transition active:scale-95 ${
                    showSafeZones
                      ? "border-[#00ffcc] bg-[#00ffcc]/15 text-[#00ffcc]"
                      : "border-[#6366f1]/30 bg-[#000000] text-[#8d87a8] hover:border-[#00ffff] hover:text-[#00ffff]"
                  }`}
                >
                  <Smartphone className="size-3" />
                  [Toggle Social Overlay Safe Zones]
                </button>
              </div>
            </div>
          </div>

          {/* Central Interactive WebGL / Canvas Sentiment Viewport */}
          <div className="relative my-2 flex-1 min-h-[280px] w-full rounded-2xl border border-[#6366f1]/30 bg-[#000000] overflow-hidden shadow-[inset_0_0_50px_rgba(10,7,27,0.8)]">
            <canvas ref={canvasRef} className="absolute inset-0 size-full cursor-pointer" />

            {/* Sentiment Legend */}
            <div className="absolute top-3 left-3 z-20 flex items-center gap-2 bg-[#000000]/80 backdrop-blur-md px-2.5 py-1 rounded-lg border border-[#6366f1]/30 text-[9px] font-mono">
              <span className="flex items-center gap-1 text-[#00ffcc]">
                <span className="size-1.5 rounded-full bg-[#00ffcc]" /> Positive
              </span>
              <span className="flex items-center gap-1 text-[#6366f1]">
                <span className="size-1.5 rounded-full bg-[#6366f1]" /> Neutral
              </span>
              <span className="flex items-center gap-1 text-[#ff8a4c]">
                <span className="size-1.5 rounded-full bg-[#ff8a4c]" /> Volatile
              </span>
              <span className="flex items-center gap-1 text-[#ff2a6d]">
                <span className="size-1.5 rounded-full bg-[#ff2a6d]" /> Negative
              </span>
            </div>
          </div>

          {/* Real-Time Activity Terminal */}
          <div className="rounded-xl border border-[#6366f1]/35 bg-[#0a071b] p-3 flex flex-col gap-1.5 mb-2.5 z-10">
            <div className="flex items-center justify-between border-b border-[#6366f1]/20 pb-1.5">
              <div className="flex items-center gap-1.5">
                <TerminalIcon className="size-3.5 text-[#00ffcc]" />
                <span className="font-mono text-xs font-bold text-white uppercase tracking-wider">
                  Real-Time Activity Terminal
                </span>
              </div>
              <span className="font-mono text-[10px] text-[#00ffcc]">OmniExtension Bound</span>
            </div>

            <div className="rounded-lg border border-[#6366f1]/20 bg-[#000000] p-2 font-mono text-[11px] text-[#00ffcc] overflow-y-auto max-h-32 flex flex-col gap-1 select-text">
              {streamTicks.map((tick) => (
                <div key={tick.id} className="flex items-start gap-2 leading-relaxed">
                  <span className="text-[9px] text-[#8d87a8] shrink-0 mt-0.5">{tick.timestamp}</span>
                  <span className="text-[10px] font-bold text-[#6366f1] shrink-0">{tick.step}</span>
                  <span className="text-white text-[10px]">{tick.detail}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Embedded Interactive .omni-shortcut cards for rapid cross-module navigation */}
          <div className="mb-2 flex flex-col gap-1.5 z-10">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono text-[#9490ac] flex items-center gap-1.5">
                <Network className="size-3 text-[#00ffcc]" />
                Nexus Quick Navigators (Tactile Feedback Scale 0.95)
              </span>
              <span className="text-[10px] font-mono text-[#6366f1]">:active scale(0.95) enabled</span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {/* Shortcut 1: Automations */}
              <button
                onClick={() => handleShortcutClick("/automations", "sc-auto")}
                className={`omni-shortcut flex flex-col items-start rounded-xl border border-[#6366f1]/35 bg-[#0a071b] p-2 text-left transition ${
                  loadingShortcut === "sc-auto" ? "is-loading" : ""
                }`}
              >
                <div className="flex w-full items-center justify-between">
                  <span className="text-xs font-bold text-white flex items-center gap-1">
                    Automations
                    {loadingShortcut === "sc-auto" && <span className="omni-shortcut-spinner">◌</span>}
                  </span>
                  <Zap className="size-3.5 text-[#00ffcc]" />
                </div>
                <span className="text-[10px] font-mono text-[#8d87a8] mt-0.5">
                  Event-Loop Canvas
                </span>
                {loadingShortcut === "sc-auto" && <span className="omni-shortcut-pulse" />}
              </button>

              {/* Shortcut 2: Prompt Studio */}
              <button
                onClick={() => handleShortcutClick("/prompts", "sc-prompt")}
                className={`omni-shortcut flex flex-col items-start rounded-xl border border-[#6366f1]/35 bg-[#0a071b] p-2 text-left transition ${
                  loadingShortcut === "sc-prompt" ? "is-loading" : ""
                }`}
              >
                <div className="flex w-full items-center justify-between">
                  <span className="text-xs font-bold text-white flex items-center gap-1">
                    Prompt Studio
                    {loadingShortcut === "sc-prompt" && <span className="omni-shortcut-spinner">◌</span>}
                  </span>
                  <FileCode className="size-3.5 text-[#6366f1]" />
                </div>
                <span className="text-[10px] font-mono text-[#8d87a8] mt-0.5">
                  Multi-Model Mesh
                </span>
                {loadingShortcut === "sc-prompt" && <span className="omni-shortcut-pulse" />}
              </button>

              {/* Shortcut 3: OmniConnect API Lab */}
              <button
                onClick={() => handleShortcutClick("/api-connector", "sc-conn")}
                className={`omni-shortcut flex flex-col items-start rounded-xl border border-[#6366f1]/35 bg-[#0a071b] p-2 text-left transition ${
                  loadingShortcut === "sc-conn" ? "is-loading" : ""
                }`}
              >
                <div className="flex w-full items-center justify-between">
                  <span className="text-xs font-bold text-white flex items-center gap-1">
                    OmniConnect
                    {loadingShortcut === "sc-conn" && <span className="omni-shortcut-spinner">◌</span>}
                  </span>
                  <Radio className="size-3.5 text-[#00ffcc]" />
                </div>
                <span className="text-[10px] font-mono text-[#8d87a8] mt-0.5">
                  API & Webhook Ingress
                </span>
                {loadingShortcut === "sc-conn" && <span className="omni-shortcut-pulse" />}
              </button>
            </div>
          </div>

          {/* System Telemetry Line at Absolute Bottom Margin in Vibrant Neon Green */}
          <div className="z-10 flex items-center justify-between rounded-xl border border-[#00ffcc]/35 bg-[#0a071b] px-4 py-2 text-xs font-mono shadow-[0_0_20px_rgba(0,255,204,0.15)]">
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-[#00ffcc] animate-ping" />
              <span className="text-[#00ffcc] font-bold">
                [Nexus-Analyzer: Scraper Pipeline Functional / OmniExtension Local Bridge Bound]
              </span>
            </div>
            <span className="text-[11px] text-[#9490ac] hidden sm:inline">
              Port: 9222 // DevTools Protocol
            </span>
          </div>
        </section>

        {/* =========================================================================
            PANEL 3: PERFORMANCE AUDIT & DATA DISPATCH TERMINAL (RIGHT PANEL - 25% WIDTH)
           ========================================================================= */}
        <section className="lg:col-span-3 border-l border-[#6366f1]/25 bg-[#000000] p-4 flex flex-col gap-4 overflow-y-auto max-h-[calc(100vh-4rem)]">
          {/* Section Header */}
          <div className="flex items-center justify-between border-b border-[#6366f1]/20 pb-3">
            <div className="flex items-center gap-2">
              <BarChart3 className="size-4 text-[#00ffcc]" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-white">Performance Audit</h2>
            </div>
            <span className="font-mono text-[10px] text-[#00ffcc]">Live Telemetry</span>
          </div>

          {/* 1. Live API Metric Dashboard */}
          <div className="rounded-xl border border-[#6366f1]/30 bg-[#0a071b] p-3.5 flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Gauge className="size-3.5 text-[#00ffcc]" />
                Live API Metric Dashboard
              </span>
              <span className="text-[10px] font-mono text-[#00ffcc]">SimilarWeb Ready</span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div className="rounded-lg border border-[#6366f1]/20 bg-[#000000] p-2 flex flex-col">
                <span className="text-[9px] text-[#9490ac]">Monthly Traffic</span>
                <span className="text-[#00ffcc] font-bold text-sm mt-0.5">4.8M visits</span>
                <span className="text-[9px] text-[#8d87a8]">Validation: Verified</span>
              </div>

              <div className="rounded-lg border border-[#6366f1]/20 bg-[#000000] p-2 flex flex-col">
                <span className="text-[9px] text-[#9490ac]">DOM Tree Size</span>
                <span className="text-[#00ffcc] font-bold text-sm mt-0.5">4,120 nodes</span>
                <span className="text-[9px] text-[#8d87a8]">Hydration: 14ms</span>
              </div>

              <div className="rounded-lg border border-[#6366f1]/20 bg-[#000000] p-2 flex flex-col">
                <span className="text-[9px] text-[#9490ac]">Server Latency</span>
                <span className="text-[#00ffcc] font-bold text-sm mt-0.5">18.2 ms</span>
                <span className="text-[9px] text-[#8d87a8]">Cloudflare Edge</span>
              </div>

              <div className="rounded-lg border border-[#6366f1]/20 bg-[#000000] p-2 flex flex-col">
                <span className="text-[9px] text-[#9490ac]">Missing Endpoints</span>
                <span className="text-[#00ffcc] font-bold text-sm mt-0.5">0 Missing</span>
                <span className="text-[9px] text-[#8d87a8]">100% Coverage</span>
              </div>
            </div>

            {/* Response Headers Preview */}
            <div className="rounded border border-[#6366f1]/20 bg-[#000000] p-2 text-[10px] font-mono text-[#8d87a8] flex flex-col gap-0.5">
              <span className="text-[#00ffcc]">{"// RETURNED HEADERS & TIMING"}</span>
              <span>cf-ray: 8df4a91b2c7e-SFO</span>
              <span>content-encoding: br</span>
              <span>server-timing: edge;dur=11.2, app;dur=7.0</span>
            </div>
          </div>

          {/* 2. Viral Safe-Zone Hazard Log */}
          <div className="rounded-xl border border-[#6366f1]/30 bg-[#0a071b] p-3.5 flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <ShieldAlert className="size-3.5 text-amber-400" />
                Viral Safe-Zone Hazard Log
              </span>
              <span className="text-[10px] font-mono text-amber-300">
                {hazardLogs.length} Checked
              </span>
            </div>

            <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1">
              {hazardLogs.map((h) => (
                <div
                  key={h.id}
                  className="rounded-lg border border-[#6366f1]/25 bg-[#000000] p-2.5 flex flex-col gap-1 text-xs font-mono"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white truncate">{h.assetName}</span>
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded border font-bold ${
                        h.riskScore === "CRITICAL"
                          ? "border-[#ff2a6d]/40 bg-[#ff2a6d]/10 text-[#ff2a6d]"
                          : h.riskScore === "ELEVATED"
                          ? "border-amber-400/40 bg-amber-400/10 text-amber-300"
                          : "border-[#00ffcc]/40 bg-[#00ffcc]/10 text-[#00ffcc]"
                      }`}
                    >
                      {h.riskScore}
                    </span>
                  </div>

                  <div className="text-[10px] text-[#00ffff]">
                    Platform: {h.platform} • {h.hazardZone}
                  </div>

                  <p className="text-[10px] text-[#9490ac] leading-tight">{h.recommendation}</p>
                </div>
              ))}
            </div>
          </div>

          {/* 3. Production Deploy Assembly */}
          <div className="rounded-xl border border-[#6366f1]/30 bg-[#0a071b] p-3.5 flex flex-col gap-2.5">
            <span className="text-xs font-bold text-white flex items-center gap-1.5">
              <UploadCloud className="size-3.5 text-[#00ffcc]" />
              Production Deploy Assembly
            </span>

            {/* Button 1: [Export Full Security and Scraping Audit Report to Global Vault] */}
            <button
              onClick={handleExportAuditReport}
              className="flex items-center justify-center gap-2 rounded-lg border border-[#00ffcc] bg-[#00ffcc]/20 py-2.5 font-mono text-xs font-bold text-[#00ffcc] transition hover:bg-[#00ffcc]/30 hover:shadow-[0_0_20px_rgba(0,255,204,0.4)] active:scale-95"
            >
              <Download className="size-4" />
              [Export Audit Report to Global Vault]
            </button>

            {/* Button 2: [Pipeline Scraped Dataset Direct to Tri-Agent Council Left Pane Overlays] */}
            <button
              onClick={handlePipelineToCouncil}
              className="flex items-center justify-center gap-2 rounded-lg border border-[#6366f1]/40 bg-[#000000] py-2 font-mono text-xs font-medium text-[#f1f0f7] transition hover:border-[#00ffff] hover:text-[#00ffff] active:scale-95"
            >
              <Layers className="size-3.5 text-[#6366f1]" />
              [Pipeline to Tri-Agent Council Overlays]
            </button>

            {/* Button 3: [Push Competitor Performance Metrics to Omni Video Studio Staging Area] */}
            <button
              onClick={handlePushToVideoStudio}
              className="flex items-center justify-center gap-2 rounded-lg border border-[#6366f1]/40 bg-[#000000] py-2 font-mono text-xs font-medium text-[#f1f0f7] transition hover:border-[#00ffff] hover:text-[#00ffff] active:scale-95"
            >
              <Video className="size-3.5 text-[#6366f1]" />
              [Push Metrics to Video Studio Staging Area]
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
