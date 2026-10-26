// @ts-nocheck
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Sparkles,
  Layers,
  Sliders,
  Terminal as TerminalIcon,
  Download,
  Share2,
  RefreshCw,
  Cpu,
  Activity,
  Grid,
  Zap,
  Check,
  ChevronRight,
  Maximize2,
  RotateCcw,
  Radio,
  FileCode,
  HardDrive,
  Eye,
  EyeOff,
  Palette,
  Compass,
  Box,
  Shirt,
  CreditCard,
  Smartphone,
  ZoomIn,
  ZoomOut,
  Move,
  Scissors,
  CheckSquare,
  Square,
  FileText,
} from "lucide-react";

type VectorPathStyle = "clean_monoline" | "geometric_bauhaus" | "liquid_gradient";
type MockupType = "tshirt" | "business_card" | "glass_hud";

interface BrandChecklist {
  primaryLogo: boolean;
  horizontalWordmark: boolean;
  simplifiedFavicon: boolean;
  styleManual: boolean;
}

const PRESET_PALETTES = [
  {
    name: "Obsidian Cyberpunk",
    colors: ["#00f2ff", "#7c3aed", "#ffffff", "#ff007a", "#0a071b"],
  },
  {
    name: "Electric Void",
    colors: ["#00f2ff", "#3b82f6", "#ffffff", "#6366f1", "#05030e"],
  },
  {
    name: "Acid Neon",
    colors: ["#00ffa3", "#a855f7", "#ffffff", "#facc15", "#0d091a"],
  },
  {
    name: "Noir Diamond",
    colors: ["#ffffff", "#00f2ff", "#7c3aed", "#94a3b8", "#000000"],
  },
];

export default function VectorAndBrandLabPage() {
  // Panel 1: Corporate Identity Intake HUD
  const [businessName, setBusinessName] = useState("Dark Misfit Studios");
  const [slogan, setSlogan] = useState("Raw Emotion Into Visual Art");
  const [industryNiche, setIndustryNiche] = useState("AI Research & Content Creation Studio");
  const [prompt, setPrompt] = useState(
    "High-contrast obsidian emblem, razor-sharp cybernetic curves, minimalist typographic kerning with dual-tone geometric crest"
  );
  const [pathStyle, setPathStyle] = useState<VectorPathStyle>("clean_monoline");
  const [checklist, setChecklist] = useState<BrandChecklist>({
    primaryLogo: true,
    horizontalWordmark: true,
    simplifiedFavicon: true,
    styleManual: true,
  });

  // Panel 3: Color Locking Swatches (3-5 Brand Colors)
  const [colors, setColors] = useState<string[]>(["#00f2ff", "#7c3aed", "#ffffff", "#ff007a", "#0a071b"]);
  const [activeColorIndex, setActiveColorIndex] = useState<number>(0);
  const [colorInput, setColorInput] = useState("#00f2ff");

  // Panel 2: Synchronized Canvas State
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [showGridLines, setShowGridLines] = useState(true);
  const [curveSmoothness, setCurveSmoothness] = useState(12); // Smooth Curve Anchor Points
  const [kerningSpacing, setKerningSpacing] = useState(6); // Equalize Kerning Spacing
  const [flattenNodes, setFlattenNodes] = useState(false); // Flatten Path Nodes
  const [mockupView, setMockupView] = useState<MockupType>("tshirt");

  // Path Tree Hierarchy Outliner
  const [layerVisibility, setLayerVisibility] = useState({
    symbolCore: true,
    wordmarkPrimary: true,
    taglineVector: true,
    accentNodes: true,
    gridChassis: true,
  });

  // Export & Pipeline Feedback
  const [isMultiplying, setIsMultiplying] = useState(false);
  const [pipelineNotice, setPipelineNotice] = useState<string | null>(null);
  const [pushStatus, setPushStatus] = useState<"idle" | "pushing" | "synced">("idle");
  const [telemetryFps, setTelemetryFps] = useState(60);

  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);

  // Trigger temporary notification
  const triggerNotice = (msg: string) => {
    setPipelineNotice(msg);
    setTimeout(() => {
      setPipelineNotice((prev) => (prev === msg ? null : prev));
    }, 4500);
  };

  // Color redistribution
  const handleUpdateColor = (index: number, newHex: string) => {
    if (!/^#[0-9A-Fa-f]{6}$/.test(newHex)) return;
    const next = [...colors];
    next[index] = newHex;
    setColors(next);
    triggerNotice(`Redistributed Brand Vector Color [${index + 1}]: ${newHex}`);
  };

  // Multiply Brand Assets Handler
  const handleMultiplyBrandAssets = () => {
    setIsMultiplying(true);
    triggerNotice("Compiling Brand Identity Matrix & Multi-Variant Vector Sheets...");

    setTimeout(() => {
      setIsMultiplying(false);
      triggerNotice("Multiplication Complete! 4 Synchronized Vector Quadrants Generated.");
    }, 900);
  };

  // Curve Modifier Actions
  const handleSmoothCurves = () => {
    setCurveSmoothness((prev) => (prev >= 24 ? 4 : prev + 6));
    triggerNotice(`Smooth Curve Anchors: Bezier radius recalibrated to ${curveSmoothness + 6}px.`);
  };

  const handleEqualizeKerning = () => {
    setKerningSpacing((prev) => (prev >= 14 ? 2 : prev + 4));
    triggerNotice(`Kerning Spacing Equalized: Typography letter-spacing normalized.`);
  };

  const handleFlattenNodes = () => {
    setFlattenNodes((prev) => !prev);
    triggerNotice(
      !flattenNodes
        ? "Path Nodes Flattened: Geometric hard-angle vertex mode locked."
        : "Curved Splines Re-engaged: Fluid cubic Bezier paths active."
    );
  };

  // Export Scalable SVG Package
  const handleDownloadSvgPackage = () => {
    const primaryColor = colors[0] || "#00f2ff";
    const secondaryColor = colors[1] || "#7c3aed";
    const whiteColor = colors[2] || "#ffffff";
    const darkBg = colors[4] || "#000000";

    const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<!-- OmniAI - Nexus Scalable SVG Brand Package -->
<!-- Dark Misfit Studios Vector Lab Export -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1200" width="1600" height="1200">
  <defs>
    <linearGradient id="nexusGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${primaryColor}"/>
      <stop offset="100%" stop-color="${secondaryColor}"/>
    </linearGradient>
    <filter id="neonGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="8" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  
  <rect width="100%" height="100%" fill="${darkBg}"/>
  
  <!-- Quadrant A: Primary Logomark -->
  <g id="quadrant-a-logo" transform="translate(150, 150)">
    <polygon points="200,40 340,160 340,320 200,440 60,320 60,160" fill="none" stroke="url(#nexusGrad)" stroke-width="8" />
    <polygon points="200,90 300,180 300,300 200,390 100,300 100,180" fill="#0a071b" stroke="${primaryColor}" stroke-width="4" />
    <circle cx="200" cy="240" r="36" fill="${secondaryColor}" filter="url(#neonGlow)"/>
    <text x="200" y="520" text-anchor="middle" fill="${whiteColor}" font-family="system-ui, sans-serif" font-size="34" font-weight="900" letter-spacing="${kerningSpacing}px">${businessName.toUpperCase()}</text>
    <text x="200" y="565" text-anchor="middle" fill="${primaryColor}" font-family="monospace" font-size="16" letter-spacing="4px">${slogan.toUpperCase()}</text>
  </g>
  
  <!-- Quadrant B: Isolated Wordmark -->
  <g id="quadrant-b-wordmark" transform="translate(950, 260)">
    <text x="0" y="100" fill="${whiteColor}" font-family="system-ui, sans-serif" font-size="52" font-weight="900" letter-spacing="${kerningSpacing * 1.5}px">${businessName}</text>
    <line x1="0" y1="130" x2="500" y2="130" stroke="${primaryColor}" stroke-width="4" />
    <text x="0" y="170" fill="${primaryColor}" font-family="monospace" font-size="20" letter-spacing="6px">${slogan}</text>
  </g>

  <!-- Quadrant C: Favicon Icon -->
  <g id="quadrant-c-favicon" transform="translate(200, 750)">
    <rect x="0" y="0" width="300" height="300" rx="60" fill="#0a071b" stroke="${secondaryColor}" stroke-width="6"/>
    <polygon points="150,50 240,130 240,210 150,270 60,210 60,130" fill="none" stroke="${primaryColor}" stroke-width="8"/>
    <circle cx="150" cy="160" r="28" fill="${whiteColor}" filter="url(#neonGlow)"/>
  </g>
</svg>`;

    const blob = new Blob([svgContent], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${businessName.toLowerCase().replace(/\s+/g, "-")}-brand-package.svg`;
    a.click();
    URL.revokeObjectURL(url);
    triggerNotice("Production-Ready Scalable SVG Package downloaded.");
  };

  // Export Print-Ready PDF Archive
  const handleDownloadPdfArchive = () => {
    const dummyPdfContent = `%PDF-1.4\n1 0 obj\n<< /Title (${businessName} Brand Manual) /Creator (OmniAI - Nexus Vector Lab) >>\nendobj\n%%EOF`;
    const blob = new Blob([dummyPdfContent], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${businessName.toLowerCase().replace(/\s+/g, "-")}-300dpi-brand-archive.pdf`;
    a.click();
    URL.revokeObjectURL(url);
    triggerNotice("Print-Ready High-DPI Layered PDF Archive generated and downloaded.");
  };

  // Push Direct to Omni Video Studio / Storyboard
  const handlePushToVideoStudio = () => {
    setPushStatus("pushing");
    triggerNotice("Initiating WebSocket Handshake with Omni Video Studio Asset Vault...");

    setTimeout(() => {
      setPushStatus("synced");
      triggerNotice(
        "Direct Ingestion SUCCESS: 4 Brand Asset Vectors pushed to Video Studio Timelines (Asset ID: #NEXUS-VEC-8831)."
      );
      setTimeout(() => setPushStatus("idle"), 4000);
    }, 1200);
  };

  // Render SVG Elements for Quadrant A (Primary Logomark)
  const renderQuadrantA = () => {
    const primary = colors[0] || "#00f2ff";
    const secondary = colors[1] || "#7c3aed";
    const white = colors[2] || "#ffffff";
    const accent = colors[3] || "#ff007a";

    return (
      <svg className="w-full h-full p-4" viewBox="0 0 500 500">
        <defs>
          <linearGradient id="q1Grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={primary} />
            <stop offset="100%" stopColor={secondary} />
          </linearGradient>
          <filter id="glowA" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Chassis Grid lines */}
        {layerVisibility.gridChassis && (
          <g opacity="0.25" stroke={primary} strokeWidth="1" strokeDasharray="3,3">
            <line x1="50" y1="200" x2="450" y2="200" />
            <line x1="250" y1="40" x2="250" y2="360" />
            <circle cx="250" cy="200" r="160" fill="none" />
          </g>
        )}

        {/* Outer Geometric Hexagon */}
        {layerVisibility.symbolCore && (
          <g>
            <polygon
              points={
                flattenNodes
                  ? "250,50 390,130 390,270 250,350 110,270 110,130"
                  : "250,55 385,133 385,267 250,345 115,267 115,133"
              }
              fill="#0a071b"
              stroke="url(#q1Grad)"
              strokeWidth={pathStyle === "clean_monoline" ? "5" : pathStyle === "geometric_bauhaus" ? "9" : "6"}
              filter="url(#glowA)"
            />

            {/* Inner Crest Structure */}
            <polygon
              points="250,95 345,150 345,250 250,305 155,250 155,150"
              fill="none"
              stroke={primary}
              strokeWidth="3"
            />

            {/* Center Core Glyph */}
            <circle cx="250" cy="200" r={curveSmoothness * 2} fill={secondary} />
            <polygon points="250,170 275,215 225,215" fill={white} />
          </g>
        )}

        {/* Accent Nodes */}
        {layerVisibility.accentNodes && (
          <g>
            <circle cx="250" cy="55" r="5" fill={accent} />
            <circle cx="385" cy="133" r="5" fill={accent} />
            <circle cx="385" cy="267" r="5" fill={accent} />
            <circle cx="250" cy="345" r="5" fill={accent} />
            <circle cx="115" cy="267" r="5" fill={accent} />
            <circle cx="115" cy="133" r="5" fill={accent} />
          </g>
        )}

        {/* Wordmark Primary */}
        {layerVisibility.wordmarkPrimary && (
          <text
            x="250"
            y="415"
            textAnchor="middle"
            fill={white}
            fontSize="24"
            fontWeight="900"
            letterSpacing={`${kerningSpacing}px`}
            fontFamily="system-ui, sans-serif"
          >
            {businessName.toUpperCase()}
          </text>
        )}

        {/* Tagline Vector */}
        {layerVisibility.taglineVector && (
          <text
            x="250"
            y="445"
            textAnchor="middle"
            fill={primary}
            fontSize="11"
            fontFamily="monospace"
            letterSpacing="3px"
          >
            {slogan.toUpperCase()}
          </text>
        )}
      </svg>
    );
  };

  // Render SVG Elements for Quadrant B (Horizontal Wordmark)
  const renderQuadrantB = () => {
    const primary = colors[0] || "#00f2ff";
    const secondary = colors[1] || "#7c3aed";
    const white = colors[2] || "#ffffff";

    return (
      <svg className="w-full h-full p-6 flex items-center justify-center" viewBox="0 0 600 300">
        <defs>
          <linearGradient id="q2Grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={primary} />
            <stop offset="60%" stopColor={secondary} />
            <stop offset="100%" stopColor={white} />
          </linearGradient>
        </defs>

        {/* Micro Grid Alignment */}
        {layerVisibility.gridChassis && (
          <g opacity="0.2" stroke={primary} strokeWidth="1">
            <line x1="40" y1="90" x2="560" y2="90" strokeDasharray="2,2" />
            <line x1="40" y1="165" x2="560" y2="165" strokeDasharray="2,2" />
            <line x1="40" y1="210" x2="560" y2="210" strokeDasharray="2,2" />
          </g>
        )}

        {/* Primary Wordmark Letters */}
        {layerVisibility.wordmarkPrimary && (
          <g>
            <text
              x="50"
              y="145"
              fill="url(#q2Grad)"
              fontSize="44"
              fontWeight="900"
              letterSpacing={`${kerningSpacing * 1.5}px`}
              fontFamily="system-ui, sans-serif"
            >
              {businessName}
            </text>

            <line x1="50" y1="175" x2="550" y2="175" stroke={primary} strokeWidth="3" />
          </g>
        )}

        {/* Tagline Lockup */}
        {layerVisibility.taglineVector && (
          <g>
            <text
              x="50"
              y="205"
              fill={white}
              fontSize="14"
              fontFamily="monospace"
              letterSpacing="5px"
              fontWeight="600"
            >
              {slogan}
            </text>

            {/* Typography Metrics Badges */}
            <text x="50" y="245" fill={primary} fontSize="10" fontFamily="monospace">
              [KERNING: {kerningSpacing}PX · TRACKING: OPTICAL · WEIGHT: 900 BLACK]
            </text>
          </g>
        )}
      </svg>
    );
  };

  // Render SVG Elements for Quadrant C (Favicon Sub-Mark)
  const renderQuadrantC = () => {
    const primary = colors[0] || "#00f2ff";
    const secondary = colors[1] || "#7c3aed";
    const white = colors[2] || "#ffffff";

    return (
      <svg className="w-full h-full p-6" viewBox="0 0 300 300">
        <defs>
          <linearGradient id="iconBg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1a1138" />
            <stop offset="100%" stopColor="#0a071b" />
          </linearGradient>
          <filter id="iconGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="5" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* App Squircle Chassis */}
        <rect
          x="30"
          y="30"
          width="240"
          height="240"
          rx="52"
          fill="url(#iconBg)"
          stroke={secondary}
          strokeWidth="4"
        />

        {/* Inner Symbol */}
        <g transform="translate(150, 150) scale(0.65) translate(-250, -200)">
          <polygon
            points="250,50 390,130 390,270 250,350 110,270 110,130"
            fill="none"
            stroke={primary}
            strokeWidth="10"
            filter="url(#iconGlow)"
          />
          <circle cx="250" cy="200" r="42" fill={secondary} />
          <polygon points="250,165 285,225 215,225" fill={white} />
        </g>
      </svg>
    );
  };

  // Render Quadrant D (Product Merchandise Mockup)
  const renderQuadrantD = () => {
    const primary = colors[0] || "#00f2ff";
    const secondary = colors[1] || "#7c3aed";
    const white = colors[2] || "#ffffff";

    if (mockupView === "tshirt") {
      return (
        <div className="relative w-full h-full flex flex-col items-center justify-center p-4">
          <div className="relative w-64 h-64 flex items-center justify-center rounded-2xl bg-[#0e0c18] border border-[#231a44] shadow-2xl overflow-hidden">
            {/* T-Shirt Silhouette Outline */}
            <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#7c3aed_1px,transparent_1px)] [background-size:12px_12px]" />
            <Shirt className="size-48 text-[#1b1535] stroke-1" />

            {/* Printed Brand Vector on Chest */}
            <div className="absolute top-20 flex flex-col items-center justify-center text-center scale-90">
              <div className="size-16 rounded-xl border border-[#00f2ff] bg-[#0a071b]/90 flex items-center justify-center shadow-[0_0_15px_rgba(0,242,255,0.4)]">
                <div className="size-8 rotate-45 border-2 border-[#7c3aed] flex items-center justify-center">
                  <div className="size-3 bg-white rounded-full" />
                </div>
              </div>
              <span className="font-extrabold text-[11px] tracking-widest text-white mt-2">
                {businessName.toUpperCase()}
              </span>
              <span className="text-[7px] font-mono text-[#00f2ff] tracking-wider">
                {slogan.toUpperCase()}
              </span>
            </div>
          </div>
          <span className="text-[10px] font-mono text-zinc-400 mt-2">
            Apparel Mockup · 100% Ring-Spun Obsidian Cotton
          </span>
        </div>
      );
    }

    if (mockupView === "business_card") {
      return (
        <div className="relative w-full h-full flex flex-col items-center justify-center p-4">
          <div className="relative w-72 h-44 rounded-xl bg-gradient-to-br from-[#120d28] via-[#0a071b] to-[#000000] border border-[#7c3aed]/50 p-5 shadow-[0_12px_32px_rgba(0,0,0,0.9)] flex flex-col justify-between">
            {/* Metallic Foil Accent Bar */}
            <div className="flex items-center justify-between">
              <div className="size-8 rounded border border-[#00f2ff] bg-[#00f2ff]/10 flex items-center justify-center shadow-[0_0_10px_#00f2ff]">
                <div className="size-3 rounded-full bg-[#7c3aed]" />
              </div>
              <span className="font-mono text-[8px] text-[#00f2ff] border border-[#00f2ff]/30 px-1.5 py-0.5 rounded">
                METALLIC FOIL STAMP
              </span>
            </div>

            <div className="space-y-1">
              <div className="text-sm font-extrabold tracking-wider text-white">
                {businessName}
              </div>
              <div className="text-[9px] font-mono text-[#00f2ff] tracking-widest">
                {slogan}
              </div>
            </div>

            <div className="flex justify-between items-end border-t border-[#261d47] pt-2 text-[8px] font-mono text-zinc-400">
              <span>{industryNiche}</span>
              <span className="text-white font-bold">NEXUS ID: #DMF-2026</span>
            </div>
          </div>
          <span className="text-[10px] font-mono text-zinc-400 mt-2">
            Luxury Matte Cardstock · 450 GSM Black Core
          </span>
        </div>
      );
    }

    // App Glass HUD Layer
    return (
      <div className="relative w-full h-full flex flex-col items-center justify-center p-4">
        <div className="relative w-64 h-64 rounded-3xl bg-[#0a071b]/80 backdrop-blur-xl border border-[#00f2ff]/30 p-4 shadow-[0_0_30px_rgba(0,242,255,0.15)] flex flex-col justify-between">
          <div className="flex justify-between items-center text-[9px] font-mono text-[#00f2ff]">
            <span>9:41 AM</span>
            <span className="flex items-center gap-1">
              <Radio className="size-2.5 animate-pulse text-[#00f2ff]" />
              <span>5G VOLTE</span>
            </span>
          </div>

          <div className="flex flex-col items-center justify-center text-center space-y-2">
            <div className="size-16 rounded-2xl bg-gradient-to-tr from-[#7c3aed] to-[#00f2ff] p-0.5 shadow-[0_0_20px_rgba(124,58,237,0.5)]">
              <div className="w-full h-full rounded-2xl bg-[#0a071b] flex items-center justify-center">
                <Sparkles className="size-8 text-[#00f2ff]" />
              </div>
            </div>
            <div className="text-xs font-bold text-white">{businessName}</div>
            <div className="text-[8px] font-mono text-zinc-400 max-w-[160px] truncate">{slogan}</div>
          </div>

          <button
            type="button"
            className="w-full py-1.5 rounded-lg bg-[#7c3aed] text-white font-mono text-[9px] font-bold uppercase tracking-wider"
          >
            Launch Identity Matrix
          </button>
        </div>
        <span className="text-[10px] font-mono text-zinc-400 mt-2">
          iOS &amp; VisionOS Glass HUD Interface Layer
        </span>
      </div>
    );
  };

  return (
    <div className="min-h-screen w-full bg-[#000000] text-[#e8e6f2] flex flex-col font-sans select-none overflow-x-hidden">
      {/* ========================================================
          UNIVERSAL APPLICATION HEADER: "OmniAI - Nexus"
          ======================================================== */}
      <header className="h-14 border-b border-[#1c1538] bg-[#000000] px-4 lg:px-6 flex items-center justify-between z-20 flex-shrink-0">
        <div className="flex items-center gap-3">
          {/* Static, Non-Floating Header Orb Asset (Far Upper-Left Corner) */}
          <div className="size-8 rounded-full border border-[#00f2ff]/60 bg-[#000000] flex items-center justify-center shadow-[0_0_12px_rgba(0,242,255,0.4)]">
            <div className="size-4 rounded-full bg-white shadow-[0_0_8px_#ffffff]" />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-base font-extrabold tracking-wider text-white">
              OmniAI - Nexus
            </span>
            <span className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-mono uppercase tracking-widest text-[#00f2ff] bg-[#00f2ff]/10 border border-[#00f2ff]/30 rounded">
              Vector &amp; Brand Lab
            </span>
          </div>
        </div>

        {/* Global Matrix Telemetry Readout */}
        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded bg-[#0a071b] border border-[#1c1538]">
            <Activity className="size-3.5 text-[#00f2ff]" />
            <span className="text-zinc-400">Bezier FPS:</span>
            <span className="text-[#00f2ff] font-bold">60.0</span>
            <span className="text-zinc-600">|</span>
            <span className="text-zinc-400">Nodes:</span>
            <span className="text-[#e8e6f2]">1,280 Scalable</span>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1 rounded bg-[#7c3aed]/15 border border-[#7c3aed]/40 text-[#c4b5fd]">
            <Radio className="size-3.5 text-[#00f2ff] animate-pulse" />
            <span className="text-[11px] font-semibold tracking-wide">SVG Engine: Linked</span>
          </div>
        </div>
      </header>

      {/* ========================================================
          THREE-COLUMN DASHBOARD LAYOUT (25% / 50% / 25%)
          ======================================================== */}
      <div className="flex-1 w-full grid grid-cols-1 lg:grid-cols-12 min-h-0 bg-[#000000]">
        {/* ========================================================
            PANEL 1: BRAND CONSTRUCTOR MATRIX (LEFT - 25% WIDTH)
            ======================================================== */}
        <aside className="lg:col-span-3 border-r border-[#1c1538] bg-[#0a071b] flex flex-col overflow-y-auto p-4 space-y-5">
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-[#1c1538]">
            <div className="flex items-center gap-2">
              <Compass className="size-4 text-[#7c3aed]" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-white">
                Brand Constructor Matrix
              </h2>
            </div>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#7c3aed]/20 text-[#c4b5fd] border border-[#7c3aed]/30">
              Recraft V4 Parity
            </span>
          </div>

          {/* Corporate Identity Intake HUD */}
          <div className="space-y-3">
            <label className="text-[11px] font-semibold text-zinc-300 flex items-center gap-1.5">
              <FileText className="size-3.5 text-[#00f2ff]" />
              Corporate Identity Intake HUD
            </label>

            <div className="space-y-1">
              <span className="text-[10px] font-mono text-zinc-400">Primary Business Name</span>
              <input
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="e.g. Dark Misfit Studios"
                className="w-full rounded-lg border border-[#1c1538] bg-[#000000] px-3 py-2 text-xs text-white placeholder:text-zinc-600 focus:border-[#7c3aed] focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <span className="text-[10px] font-mono text-zinc-400">Required Slogan / Tagline</span>
              <input
                type="text"
                value={slogan}
                onChange={(e) => setSlogan(e.target.value)}
                placeholder="e.g. Raw Emotion Into Visual Art"
                className="w-full rounded-lg border border-[#1c1538] bg-[#000000] px-3 py-2 text-xs text-white placeholder:text-zinc-600 focus:border-[#7c3aed] focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <span className="text-[10px] font-mono text-zinc-400">Industry Niche Parameters</span>
              <input
                type="text"
                value={industryNiche}
                onChange={(e) => setIndustryNiche(e.target.value)}
                placeholder="e.g. AI Content Studio & Digital Shadow"
                className="w-full rounded-lg border border-[#1c1538] bg-[#000000] px-3 py-2 text-xs text-white placeholder:text-zinc-600 focus:border-[#7c3aed] focus:outline-none"
              />
            </div>
          </div>

          {/* Automated Variant Multiplier Checklist */}
          <div className="space-y-2 pt-2 border-t border-[#1c1538]">
            <label className="text-[11px] font-semibold text-zinc-300 flex items-center gap-1.5">
              <Layers className="size-3.5 text-[#7c3aed]" />
              Variant Multiplier Checklist
            </label>
            <div className="space-y-1.5">
              {[
                { key: "primaryLogo", label: "Primary Logomark (Symbolic Anchor)" },
                { key: "horizontalWordmark", label: "Horizontal Wordmark (Typography Locked)" },
                { key: "simplifiedFavicon", label: "Simplified Favicon Sub-Mark (Compact Icon)" },
                { key: "styleManual", label: "Corporate Identity Brand Style Manual" },
              ].map((item) => {
                const checked = checklist[item.key as keyof BrandChecklist];
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() =>
                      setChecklist((prev) => ({
                        ...prev,
                        [item.key]: !prev[item.key as keyof BrandChecklist],
                      }))
                    }
                    className="w-full flex items-center gap-2.5 p-2 rounded-lg bg-[#000000] border border-[#1c1538] hover:border-[#7c3aed]/40 text-left transition"
                  >
                    {checked ? (
                      <CheckSquare className="size-3.5 text-[#00f2ff] shrink-0" />
                    ) : (
                      <Square className="size-3.5 text-zinc-600 shrink-0" />
                    )}
                    <span className={`text-[11px] font-mono ${checked ? "text-white" : "text-zinc-500"}`}>
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Vector Path Node Selectors */}
          <div className="space-y-2 pt-2 border-t border-[#1c1538]">
            <label className="text-[11px] font-semibold text-zinc-300 flex items-center gap-1.5">
              <Box className="size-3.5 text-[#00f2ff]" />
              Vector Path Node Selectors
            </label>
            <div className="grid grid-cols-1 gap-1.5">
              {[
                { id: "clean_monoline", label: "Clean Monoline SVG", desc: "Single continuous Bezier stroke" },
                { id: "geometric_bauhaus", label: "Geometric Bauhaus Vector", desc: "Bold constructivist primitives" },
                { id: "liquid_gradient", label: "Liquid Gradient Mesh Paths", desc: "Dual-tone luminous vector fills" },
              ].map((styleOption) => {
                const isSelected = pathStyle === styleOption.id;
                return (
                  <button
                    key={styleOption.id}
                    type="button"
                    onClick={() => {
                      setPathStyle(styleOption.id as VectorPathStyle);
                      triggerNotice(`Vector Path Mode set to [${styleOption.label}].`);
                    }}
                    className={`p-2 rounded-lg border text-left transition ${
                      isSelected
                        ? "border-[#7c3aed] bg-[#7c3aed]/20 text-white shadow-[0_0_12px_rgba(124,58,237,0.25)]"
                        : "border-[#1c1538] bg-[#000000] text-zinc-400 hover:text-white"
                    }`}
                  >
                    <div className="text-[11px] font-bold">{styleOption.label}</div>
                    <div className="text-[9px] font-mono text-zinc-500 mt-0.5">{styleOption.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Prompt Construction Area & Multiply Action Button */}
          <div className="space-y-2 pt-2 border-t border-[#1c1538]">
            <label className="text-[11px] font-semibold text-zinc-300 flex items-center gap-1.5">
              <FileCode className="size-3.5 text-[#7c3aed]" />
              Prompt Construction Area
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              placeholder="Construct SVG parameters or geometric styling instructions..."
              className="w-full rounded-lg border border-[#1c1538] bg-[#000000] p-2.5 text-xs text-white placeholder:text-zinc-600 focus:border-[#7c3aed] focus:outline-none resize-none"
            />

            <button
              type="button"
              onClick={handleMultiplyBrandAssets}
              disabled={isMultiplying}
              className={`w-full py-2.5 px-4 rounded-lg font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition ${
                isMultiplying
                  ? "bg-[#7c3aed]/50 text-white cursor-wait"
                  : "bg-[#7c3aed] hover:bg-[#6d28d9] text-white shadow-[0_0_15px_rgba(124,58,237,0.4)]"
              }`}
            >
              {isMultiplying ? (
                <>
                  <RefreshCw className="size-4 animate-spin text-[#00f2ff]" />
                  Multiplying Brand Variants...
                </>
              ) : (
                <>
                  <Zap className="size-4 text-[#00f2ff]" />
                  Multiply Brand Assets
                </>
              )}
            </button>
          </div>
        </aside>

        {/* ========================================================
            PANEL 2: SYNCHRONIZED INFINITE VECTOR CANVAS (CENTER - 50%)
            ======================================================== */}
        <main className="lg:col-span-6 flex flex-col relative bg-[#000000] border-r border-[#1c1538]">
          {/* Floating Curve Modifier Deck (Top Margin Toolbar) */}
          <div className="h-12 border-b border-[#1c1538] bg-[#0a071b] px-3 flex items-center justify-between z-10 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono uppercase text-zinc-400 px-1 flex items-center gap-1">
                <Sliders className="size-3 text-[#00f2ff]" />
                Curve Modifiers
              </span>

              {/* [Smooth Curve Anchor Points] */}
              <button
                type="button"
                onClick={handleSmoothCurves}
                className="px-2.5 py-1 rounded-lg border border-[#1c1538] bg-[#000000] hover:border-[#7c3aed] text-zinc-300 hover:text-white text-[10px] font-mono flex items-center gap-1 transition"
              >
                <span>Smooth Curve Anchor Points</span>
                <span className="text-[#00f2ff] font-bold">({curveSmoothness}px)</span>
              </button>

              {/* [Equalize Kerning Spacing] */}
              <button
                type="button"
                onClick={handleEqualizeKerning}
                className="px-2.5 py-1 rounded-lg border border-[#1c1538] bg-[#000000] hover:border-[#7c3aed] text-zinc-300 hover:text-white text-[10px] font-mono flex items-center gap-1 transition"
              >
                <span>Equalize Kerning Spacing</span>
                <span className="text-[#00f2ff] font-bold">({kerningSpacing}px)</span>
              </button>

              {/* [Flatten Path Nodes] */}
              <button
                type="button"
                onClick={handleFlattenNodes}
                className={`px-2.5 py-1 rounded-lg border text-[10px] font-mono flex items-center gap-1 transition ${
                  flattenNodes
                    ? "border-[#00f2ff] bg-[#00f2ff]/20 text-[#00f2ff]"
                    : "border-[#1c1538] bg-[#000000] text-zinc-300 hover:text-white"
                }`}
              >
                <span>Flatten Path Nodes</span>
                <span className="font-bold">[{flattenNodes ? "ON" : "OFF"}]</span>
              </button>
            </div>

            {/* Canvas Viewport Zoom & Grid Controls */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setShowGridLines(!showGridLines)}
                title="Toggle Grid Lines"
                className={`p-1.5 rounded border text-xs transition ${
                  showGridLines
                    ? "border-[#00f2ff] bg-[#00f2ff]/20 text-[#00f2ff]"
                    : "border-[#1c1538] bg-[#000000] text-zinc-400"
                }`}
              >
                <Grid className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(0.6, z - 0.15))}
                title="Zoom Out"
                className="p-1.5 rounded border border-[#1c1538] bg-[#000000] text-zinc-400 hover:text-white"
              >
                <ZoomOut className="size-3.5" />
              </button>
              <span className="font-mono text-[10px] text-[#00f2ff] w-10 text-center">
                {(zoom * 100).toFixed(0)}%
              </span>
              <button
                type="button"
                onClick={() => setZoom((z) => Math.min(2.0, z + 0.15))}
                title="Zoom In"
                className="p-1.5 rounded border border-[#1c1538] bg-[#000000] text-zinc-400 hover:text-white"
              >
                <ZoomIn className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setZoom(1);
                  setPanOffset({ x: 0, y: 0 });
                }}
                title="Reset View"
                className="p-1.5 rounded border border-[#1c1538] bg-[#000000] text-zinc-400 hover:text-white"
              >
                <RotateCcw className="size-3.5" />
              </button>
            </div>
          </div>

          {/* Infinite WebGL / SVG Canvas Area */}
          <div
            className="relative flex-1 w-full min-h-[500px] overflow-hidden bg-[#000000] cursor-grab active:cursor-grabbing"
            onPointerDown={(e) => {
              dragRef.current = {
                startX: e.clientX,
                startY: e.clientY,
                origX: panOffset.x,
                origY: panOffset.y,
              };
              setIsPanning(true);
              e.currentTarget.setPointerCapture(e.pointerId);
            }}
            onPointerMove={(e) => {
              if (!dragRef.current) return;
              setPanOffset({
                x: dragRef.current.origX + (e.clientX - dragRef.current.startX),
                y: dragRef.current.origY + (e.clientY - dragRef.current.startY),
              });
            }}
            onPointerUp={(e) => {
              dragRef.current = null;
              setIsPanning(false);
              if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                e.currentTarget.releasePointerCapture(e.pointerId);
              }
            }}
          >
            {/* Background Grid Lines */}
            {showGridLines && (
              <div
                className="absolute inset-0 pointer-events-none opacity-25"
                style={{
                  backgroundImage:
                    "linear-gradient(#1c1538 1px, transparent 1px), linear-gradient(90deg, #1c1538 1px, transparent 1px)",
                  backgroundSize: "28px 28px",
                }}
              />
            )}

            {/* Canvas Transformation Container */}
            <div
              className="absolute inset-0 flex items-center justify-center p-6"
              style={{
                transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`,
                transformOrigin: "center center",
              }}
            >
              {/* ========================================================
                  THE 4-QUADRANT COHESIVE DISPLAY GRID (MATHEMATICAL SVG)
                  ======================================================== */}
              <div className="grid grid-cols-2 gap-4 w-[780px] h-[640px] pointer-events-auto">
                {/* QUADRANT A: Primary Logomark Container */}
                <div className="relative rounded-2xl border border-[#1c1538] bg-[#0a071b] flex flex-col overflow-hidden shadow-2xl group hover:border-[#7c3aed] transition">
                  <div className="h-7 border-b border-[#1c1538] px-3 flex items-center justify-between bg-[#000000]/60">
                    <span className="text-[10px] font-mono text-[#00f2ff] font-bold">
                      QUADRANT A: PRIMARY LOGOMARK
                    </span>
                    <span className="text-[9px] font-mono text-zinc-500">Vector Combo Mark</span>
                  </div>
                  <div className="flex-1 flex items-center justify-center relative">
                    {renderQuadrantA()}
                  </div>
                </div>

                {/* QUADRANT B: Typography Isolated Wordmark Container */}
                <div className="relative rounded-2xl border border-[#1c1538] bg-[#0a071b] flex flex-col overflow-hidden shadow-2xl group hover:border-[#7c3aed] transition">
                  <div className="h-7 border-b border-[#1c1538] px-3 flex items-center justify-between bg-[#000000]/60">
                    <span className="text-[10px] font-mono text-[#00f2ff] font-bold">
                      QUADRANT B: ISOLATED WORDMARK
                    </span>
                    <span className="text-[9px] font-mono text-zinc-500">Optical Kerning Locked</span>
                  </div>
                  <div className="flex-1 flex items-center justify-center relative">
                    {renderQuadrantB()}
                  </div>
                </div>

                {/* QUADRANT C: Favicon App Icon Component */}
                <div className="relative rounded-2xl border border-[#1c1538] bg-[#0a071b] flex flex-col overflow-hidden shadow-2xl group hover:border-[#7c3aed] transition">
                  <div className="h-7 border-b border-[#1c1538] px-3 flex items-center justify-between bg-[#000000]/60">
                    <span className="text-[10px] font-mono text-[#00f2ff] font-bold">
                      QUADRANT C: FAVICON / APP ICON
                    </span>
                    <span className="text-[9px] font-mono text-zinc-500">Compact Sub-Mark</span>
                  </div>
                  <div className="flex-1 flex items-center justify-center relative">
                    {renderQuadrantC()}
                  </div>
                </div>

                {/* QUADRANT D: Real-Time Product Merchandise Mockup */}
                <div className="relative rounded-2xl border border-[#1c1538] bg-[#0a071b] flex flex-col overflow-hidden shadow-2xl group hover:border-[#7c3aed] transition">
                  <div className="h-7 border-b border-[#1c1538] px-3 flex items-center justify-between bg-[#000000]/60">
                    <span className="text-[10px] font-mono text-[#00f2ff] font-bold">
                      QUADRANT D: PRODUCT MOCKUP
                    </span>
                    <div className="flex items-center gap-1">
                      {[
                        { id: "tshirt", icon: Shirt, label: "Tee" },
                        { id: "business_card", icon: CreditCard, label: "Card" },
                        { id: "glass_hud", icon: Smartphone, label: "HUD" },
                      ].map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setMockupView(m.id as MockupType)}
                          className={`px-1.5 py-0.5 rounded text-[8px] font-mono flex items-center gap-1 transition ${
                            mockupView === m.id
                              ? "bg-[#7c3aed] text-white"
                              : "text-zinc-500 hover:text-white"
                          }`}
                        >
                          <m.icon className="size-2.5" />
                          <span>{m.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex-1 flex items-center justify-center relative">
                    {renderQuadrantD()}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ========================================================
              PERMANENT MONOSPACED TELEMETRY BAR (CYBER AQUA)
              ======================================================== */}
          <div className="h-10 border-t border-[#1c1538] bg-[#000000] px-4 flex items-center justify-between text-xs font-mono z-10">
            <div className="flex items-center gap-2 overflow-hidden text-ellipsis whitespace-nowrap">
              <span className="text-[#00f2ff] font-bold tracking-tight">
                [Nexus-Vector: Native Scalable SVG Compiler / Bezier Path Synchronization Active]
              </span>
            </div>
            <div className="hidden sm:flex items-center gap-3 text-[11px] text-zinc-500">
              <span className="text-zinc-400">
                Quadrant Matrix: <span className="text-[#7c3aed]">4/4 Synchronized</span>
              </span>
              <span className="text-zinc-400">
                Precision: <span className="text-[#00f2ff]">Infinite Vector Math</span>
              </span>
            </div>
          </div>
        </main>

        {/* ========================================================
            PANEL 3: LAYER RE-MAPPING & EXPORT DECK (RIGHT - 25% WIDTH)
            ======================================================== */}
        <aside className="lg:col-span-3 bg-[#0a071b] flex flex-col overflow-y-auto p-4 space-y-5">
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-[#1c1538]">
            <div className="flex items-center gap-2">
              <Palette className="size-4 text-[#00f2ff]" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-white">
                Layer &amp; Color Re-Mapping
              </h2>
            </div>
            <span className="text-[10px] font-mono text-[#00f2ff]">3-5 Swatches</span>
          </div>

          {/* Hexadecimal Color Locking Swatches */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-semibold text-zinc-300 flex items-center gap-1.5">
                <Palette className="size-3.5 text-[#7c3aed]" />
                Hexadecimal Color Swatches
              </label>
              <span className="text-[10px] font-mono text-zinc-500">Locked Vectors</span>
            </div>

            {/* Current Palette Swatches Grid */}
            <div className="grid grid-cols-5 gap-1.5">
              {colors.map((hex, idx) => (
                <div
                  key={idx}
                  onClick={() => {
                    setActiveColorIndex(idx);
                    setColorInput(hex);
                  }}
                  className={`p-2 rounded-xl border flex flex-col items-center gap-1 cursor-pointer transition ${
                    activeColorIndex === idx
                      ? "border-[#00f2ff] bg-[#00f2ff]/10 shadow-[0_0_10px_rgba(0,242,255,0.3)]"
                      : "border-[#1c1538] bg-[#000000] hover:border-[#7c3aed]/50"
                  }`}
                >
                  <div
                    className="size-6 rounded-lg border border-black/40 shadow-sm"
                    style={{ backgroundColor: hex }}
                  />
                  <span className="text-[9px] font-mono text-zinc-300 uppercase">
                    {hex.slice(0, 4)}..
                  </span>
                </div>
              ))}
            </div>

            {/* Active Color Editor Input */}
            <div className="flex gap-2">
              <input
                type="text"
                value={colorInput}
                onChange={(e) => setColorInput(e.target.value)}
                placeholder="#00f2ff"
                className="flex-1 rounded-lg border border-[#1c1538] bg-[#000000] px-3 py-1.5 text-xs font-mono text-white placeholder:text-zinc-600 focus:border-[#00f2ff] focus:outline-none"
              />
              <button
                type="button"
                onClick={() => handleUpdateColor(activeColorIndex, colorInput)}
                className="px-3 py-1.5 rounded-lg bg-[#7c3aed] text-white text-xs font-mono font-bold hover:bg-[#6d28d9] transition"
              >
                Apply
              </button>
            </div>

            {/* Preset Color Palettes */}
            <div className="space-y-1.5 pt-1">
              <span className="text-[10px] font-mono text-zinc-400">Curated Obsidian Palettes:</span>
              <div className="grid grid-cols-2 gap-1.5">
                {PRESET_PALETTES.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => {
                      setColors([...preset.colors]);
                      setColorInput(preset.colors[0]);
                      triggerNotice(`Locked [${preset.name}] palette across all 4 quadrants.`);
                    }}
                    className="p-1.5 rounded-lg border border-[#1c1538] bg-[#000000] hover:border-[#00f2ff] text-left transition"
                  >
                    <div className="text-[10px] font-bold text-white truncate">{preset.name}</div>
                    <div className="flex gap-1 mt-1">
                      {preset.colors.map((c, i) => (
                        <div key={i} className="size-2.5 rounded-full" style={{ backgroundColor: c }} />
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Path Tree Hierarchy Outliner */}
          <div className="space-y-2 pt-2 border-t border-[#1c1538]">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-semibold text-zinc-300 flex items-center gap-1.5">
                <Layers className="size-3.5 text-[#00f2ff]" />
                Path Tree Hierarchy Outliner
              </label>
              <span className="text-[10px] font-mono text-zinc-500">Isolated Nodes</span>
            </div>

            <div className="space-y-1 rounded-xl border border-[#1c1538] bg-[#000000] p-2 max-h-48 overflow-y-auto">
              {[
                { key: "symbolCore", name: "<g id='symbol-core'>", type: "Polygon/Bezier Group" },
                { key: "wordmarkPrimary", name: "<g id='wordmark-primary'>", type: "Glyph Curves" },
                { key: "taglineVector", name: "<g id='tagline-vector'>", type: "Monospace Path" },
                { key: "accentNodes", name: "<g id='accent-nodes'>", type: "Vertex Coordinates" },
                { key: "gridChassis", name: "<g id='grid-chassis'>", type: "Alignment Guides" },
              ].map((layer) => {
                const isVisible = layerVisibility[layer.key as keyof typeof layerVisibility];
                return (
                  <div
                    key={layer.key}
                    className="flex items-center justify-between p-1.5 rounded-lg hover:bg-[#0a071b] border border-transparent hover:border-[#1c1538] transition"
                  >
                    <div className="space-y-0.5 truncate pr-2">
                      <div className="text-[11px] font-mono text-white truncate">{layer.name}</div>
                      <div className="text-[9px] font-mono text-zinc-500">{layer.type}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setLayerVisibility((prev) => ({
                          ...prev,
                          [layer.key]: !prev[layer.key as keyof typeof layerVisibility],
                        }))
                      }
                      className="p-1 text-zinc-400 hover:text-white"
                    >
                      {isVisible ? (
                        <Eye className="size-3.5 text-[#00f2ff]" />
                      ) : (
                        <EyeOff className="size-3.5 text-zinc-600" />
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Production-Grade Package Exporter */}
          <div className="space-y-2 pt-2 border-t border-[#1c1538]">
            <label className="text-[11px] font-semibold text-zinc-300 flex items-center gap-1.5">
              <Download className="size-3.5 text-[#7c3aed]" />
              Production-Grade Package Exporter
            </label>

            {/* Button 1: Download Scalable SVG Package */}
            <button
              type="button"
              onClick={handleDownloadSvgPackage}
              className="w-full py-2 px-3 rounded-lg border border-[#1c1538] bg-[#000000] hover:border-[#00f2ff] text-white text-xs font-mono font-bold flex items-center justify-center gap-2 transition"
            >
              <Download className="size-3.5 text-[#00f2ff]" />
              <span>Download Production-Ready Scalable SVG</span>
            </button>

            {/* Button 2: Download Print-Ready PDF Archive */}
            <button
              type="button"
              onClick={handleDownloadPdfArchive}
              className="w-full py-2 px-3 rounded-lg border border-[#1c1538] bg-[#000000] hover:border-[#7c3aed] text-white text-xs font-mono font-bold flex items-center justify-center gap-2 transition"
            >
              <FileCode className="size-3.5 text-[#7c3aed]" />
              <span>Download Print-Ready 300-DPI PDF Archive</span>
            </button>

            {/* Button 3: Push Direct to Omni Video Studio */}
            <button
              type="button"
              onClick={handlePushToVideoStudio}
              disabled={pushStatus === "pushing"}
              className="w-full py-2.5 px-3 rounded-lg border border-[#00f2ff]/40 bg-[#00f2ff]/10 hover:bg-[#00f2ff]/20 text-[#00f2ff] font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition shadow-[0_0_12px_rgba(0,242,255,0.15)]"
            >
              {pushStatus === "pushing" ? (
                <>
                  <RefreshCw className="size-3.5 animate-spin" />
                  <span>Pushing to Timelines...</span>
                </>
              ) : pushStatus === "synced" ? (
                <>
                  <Check className="size-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Pushed to Video Timelines!</span>
                </>
              ) : (
                <>
                  <Share2 className="size-3.5" />
                  <span>Push to Omni Video Studio / Storyboard</span>
                </>
              )}
            </button>
          </div>
        </aside>
      </div>

      {/* Floating Pipeline Notice Toast */}
      {pipelineNotice && (
        <div className="fixed bottom-12 left-1/2 z-50 -translate-x-1/2 flex items-center gap-2 rounded-xl border border-[#00f2ff]/60 bg-[#0c0919] px-4 py-2 text-xs font-mono text-[#00f2ff] shadow-[0_0_25px_rgba(0,242,255,0.35)] animate-in fade-in slide-in-from-bottom-2">
          <Activity className="size-3.5 animate-pulse" />
          <span>{pipelineNotice}</span>
          <button
            onClick={() => setPipelineNotice(null)}
            className="ml-2 text-zinc-400 hover:text-white"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
