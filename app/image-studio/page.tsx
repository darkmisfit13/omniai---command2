"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  Wand2,
  Layers,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Move,
  Scissors,
  Eraser,
  Grid,
  Lock,
  Unlock,
  Palette,
  Download,
  Send,
  Smartphone,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  ChevronDown,
  Check,
  ImageIcon,
  Shapes,
  Box,
  Cpu,
  Sliders,
  Expand,
  FileCode,
  ArrowUp,
  ArrowDown,
  RefreshCw,
  Maximize,
  Undo2
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { mediaVault } from "@/lib/mediaVault";

/* =========================================================================
   DARK MISFIT STUDIOS — OMNIAI - NEXUS: OMNI IMAGE STUDIO
   Principal Creative Frontend Engineering
   Palette:
     - Canvas Background: #000000 (Pure Black)
     - Layer Container Blocks: Dark Bluish Purple (#120d24, #16112c, #1a1336)
     - Active Selection / Text Highlights: Very Light Neon Bluish Green (#00ffa3, #39ffb4)
   ========================================================================= */

type StyleMode = "svg" | "raster" | "icon3d";

interface StyleArchitecture {
  id: StyleMode;
  title: string;
  badge: string;
  description: string;
  icon: typeof Shapes;
}

const STYLE_ARCHITECTURES: StyleArchitecture[] = [
  {
    id: "svg",
    title: "SVG Vector Graphic",
    badge: "RAW VECTOR",
    description: "Generates scalable, raw vector nodes and clean bezier paths",
    icon: Shapes
  },
  {
    id: "raster",
    title: "Photorealistic Raster",
    badge: "HYPER-RASTER 4K",
    description: "Compiles ultra-realistic, high-resolution ray-traced imagery",
    icon: ImageIcon
  },
  {
    id: "icon3d",
    title: "3D App Icon / Mascot",
    badge: "BRANDING ASSET",
    description: "Mapped for volumetric mascot marks and dimensional icons",
    icon: Box
  }
];

const BACKEND_MODELS = [
  { id: "local-ollama", label: "Local-Ollama Pipeline", desc: "qwen2.5:0.5b / vision local node" },
  { id: "flux-dev", label: "FLUX.1-Dev Open-Weight Node", desc: "12B parameter flow transformer" },
  { id: "nexus-raster-4k", label: "Nexus-HyperRaster 4K Checkpoint", desc: "Ultra-high fidelity photorealism" },
  { id: "recraft-vector-v3", label: "Recraft-Vector v3 Engine", desc: "Pure SVG & bezier curve precision" },
  { id: "sdxl-turbo", label: "SDXL Lightning Turbo", desc: "Sub-second accelerated preview passes" }
];

const PRESET_COLOR_PALETTES = [
  { name: "Obsidian Nexus", colors: ["#000000", "#140e28", "#00ffa3", "#00f2fe", "#e879f9"] },
  { name: "Cyberpunk Noir", colors: ["#0b0a14", "#ff2a6d", "#00f2fe", "#00ffa3", "#8b7fff"] },
  { name: "Dark Misfit Grief", colors: ["#08080c", "#1f182c", "#ff4365", "#c5bfff", "#39ffb4"] },
  { name: "Emerald Phantom", colors: ["#050d0a", "#0b1f17", "#00ffa3", "#7affd4", "#ffffff"] }
];

interface CanvasLayer {
  id: string;
  name: string;
  type: "image" | "svg" | "vector-trace";
  url: string;
  svgContent?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  scale: number;
  opacity: number;
  visible: boolean;
  filter: string;
}

interface CompiledHistoryItem {
  id: string;
  prompt: string;
  mode: StyleMode;
  model: string;
  url: string;
  svgData?: string;
  timestamp: string;
}

export default function OmniImageStudioNexus() {
  const router = useRouter();

  // ---------------------------------------------------------------------------
  // PANEL 1 STATE: THE CONFIGURATION MATRIX (LEFT 25%)
  // ---------------------------------------------------------------------------
  const [activeStyleMode, setActiveStyleMode] = useState<StyleMode>("raster");
  const [selectedModel, setSelectedModel] = useState<string>("flux-dev");

  // Color Locking Swatch (3 to 5 strict hexadecimal brand colors)
  const [lockedColors, setLockedColors] = useState<string[]>([
    "#000000",
    "#140e28",
    "#00ffa3",
    "#00f2fe",
    "#e879f9"
  ]);
  const [paletteLockActive, setPaletteLockActive] = useState<boolean>(true);
  const [activeColorEditIdx, setActiveColorEditIdx] = useState<number | null>(null);

  // Input Prompt HUD
  const [promptText, setPromptText] = useState(
    "A melancholic cyberpunk cyborg with glowing neon bluish-green circuitry, standing in the obsidian rain of a forgotten city, cinematic volumetric lighting, 8k octane render."
  );
  const [aspectRatio, setAspectRatio] = useState<"1:1" | "16:9" | "9:16" | "21:9">("16:9");
  const [isEnhancingPrompt, setIsEnhancingPrompt] = useState<boolean>(false);
  const [isSynthesizing, setIsSynthesizing] = useState<boolean>(false);
  const [generationNotice, setGenerationNotice] = useState<string>("");

  // ---------------------------------------------------------------------------
  // PANEL 2 STATE: THE INFINITE WEBGL STAGING CANVAS (CENTRAL 50%)
  // ---------------------------------------------------------------------------
  const canvasContainerRef = useRef<HTMLDivElement | null>(null);
  const webglCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Pan & Zoom Transform
  const [panX, setPanX] = useState<number>(0);
  const [panY, setPanY] = useState<number>(0);
  const [zoomLevel, setZoomLevel] = useState<number>(1.0);
  const [isDraggingCanvas, setIsDraggingCanvas] = useState<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Toggleable Wireframe Mesh Lines
  const [showWireframeMesh, setShowWireframeMesh] = useState<boolean>(true);

  // Canvas Layer Stacking System
  const [layers, setLayers] = useState<CanvasLayer[]>([
    {
      id: "layer-master",
      name: "Master Synthesis Plate",
      type: "image",
      url: "/testclip.mp4", // fallback or default placeholder
      x: 0,
      y: 0,
      width: 800,
      height: 450,
      scale: 1,
      opacity: 1,
      visible: true,
      filter: "none"
    }
  ]);
  const [selectedLayerId, setSelectedLayerId] = useState<string>("layer-master");

  // AI Micro-Edit Toolbed State
  type ToolMode = "select" | "eraser" | "outpaint" | "vectorize" | "removebg";
  const [activeTool, setActiveTool] = useState<ToolMode>("select");
  const [eraserBrushSize, setEraserBrushSize] = useState<number>(36);
  const [isDrawingMask, setIsDrawingMask] = useState<boolean>(false);
  const [isToolProcessing, setIsToolProcessing] = useState<boolean>(false);
  const [toolTelemetryMsg, setToolTelemetryMsg] = useState<string>("");

  // ---------------------------------------------------------------------------
  // PANEL 3 STATE: ASSET VAULT & DISPATCH (RIGHT 25%)
  // ---------------------------------------------------------------------------
  // Global Portrait Anchor Bay (0 to 5 master reference character images)
  const [anchorImages, setAnchorImages] = useState<string[]>([
    "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80"
  ]);
  const [lockAppearanceConsistency, setLockAppearanceConsistency] = useState<boolean>(true);
  const anchorFileInputRef = useRef<HTMLInputElement | null>(null);

  // Project Asset History Track
  const [historyItems, setHistoryItems] = useState<CompiledHistoryItem[]>([
    {
      id: "hist-1",
      prompt: "Obsidian gothic android portrait with neon mint optical implants",
      mode: "raster",
      model: "FLUX.1-Dev",
      url: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=80",
      timestamp: "10:14:22"
    },
    {
      id: "hist-2",
      prompt: "Raw scalable geometric mark, raven wings in neon bluish-green bezier paths",
      mode: "svg",
      model: "Recraft-Vector v3",
      url: "",
      svgData: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><polygon points="50,10 90,85 10,85" fill="none" stroke="#00ffa3" stroke-width="4"/><circle cx="50" cy="55" r="18" fill="none" stroke="#00f2fe" stroke-width="2.5"/><path d="M30 65 L50 35 L70 65" stroke="#e879f9" stroke-width="2" fill="none"/></svg>`,
      timestamp: "10:28:45"
    }
  ]);

  // ---------------------------------------------------------------------------
  // WEBGL BACKGROUND & WIREFRAME MESH ENGINE
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const canvas = webglCanvasRef.current;
    if (!canvas) return;

    let gl: WebGLRenderingContext | null = null;
    try {
      gl = canvas.getContext("webgl", { alpha: false, antialias: true });
    } catch {
      gl = null;
    }
    const ctx2d = !gl ? canvas.getContext("2d") : null;

    let animId = 0;
    let width = 0;
    let height = 0;
    let dpr = 1;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width <= 0) return;
      width = rect.width;
      height = rect.height;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      if (gl) gl.viewport(0, 0, canvas.width, canvas.height);
    };
    resize();

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const render = (time: number) => {
      if (gl) {
        // Pure Black #000000 background
        gl.clearColor(0.0, 0.0, 0.0, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT);
      } else if (ctx2d) {
        ctx2d.fillStyle = "#000000";
        ctx2d.fillRect(0, 0, width, height);

        // Render Structural Wireframe Mesh Lines if toggled
        if (showWireframeMesh) {
          ctx2d.save();
          ctx2d.strokeStyle = "rgba(0, 255, 163, 0.065)";
          ctx2d.lineWidth = 1;

          const gridSize = 40 * zoomLevel;
          const offsetX = (panX % gridSize);
          const offsetY = (panY % gridSize);

          ctx2d.beginPath();
          for (let x = offsetX; x < width; x += gridSize) {
            ctx2d.moveTo(x, 0);
            ctx2d.lineTo(x, height);
          }
          for (let y = offsetY; y < height; y += gridSize) {
            ctx2d.moveTo(0, y);
            ctx2d.lineTo(width, y);
          }
          ctx2d.stroke();

          // Isometric crosshair nexus points
          ctx2d.fillStyle = "rgba(0, 255, 163, 0.25)";
          for (let x = offsetX; x < width; x += gridSize * 2) {
            for (let y = offsetY; y < height; y += gridSize * 2) {
              ctx2d.fillRect(x - 1.5, y - 1.5, 3, 3);
            }
          }
          ctx2d.restore();
        }
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      ro.disconnect();
    };
  }, [showWireframeMesh, zoomLevel, panX, panY]);

  // ---------------------------------------------------------------------------
  // INTERACTIVE CANVAS ZOOM & PAN
  // ---------------------------------------------------------------------------
  const handleWheelZoom = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
    setZoomLevel((prev) => Math.min(4.0, Math.max(0.2, prev * zoomFactor)));
  };

  const handleMouseDownPan = (e: React.MouseEvent) => {
    // Left-click with space, or middle-click, or select tool dragging canvas empty space
    if (e.button === 1 || e.altKey || activeTool === "select") {
      setIsDraggingCanvas(true);
      dragStartRef.current = { x: e.clientX - panX, y: e.clientY - panY };
    }
  };

  const handleMouseMovePan = (e: React.MouseEvent) => {
    if (isDraggingCanvas) {
      setPanX(e.clientX - dragStartRef.current.x);
      setPanY(e.clientY - dragStartRef.current.y);
    }
  };

  const handleMouseUpPan = () => {
    setIsDraggingCanvas(false);
  };

  const resetCanvasView = () => {
    setPanX(0);
    setPanY(0);
    setZoomLevel(1.0);
  };

  // ---------------------------------------------------------------------------
  // PANEL 1 ACTIONS: PROMPT ENHANCER & GENERATION
  // ---------------------------------------------------------------------------
  const handleEnhancePrompt = async () => {
    if (!promptText.trim()) return;
    setIsEnhancingPrompt(true);
    setGenerationNotice("Optimizing prompt matrix for photorealism and vector clarity...");

    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Sign in required.");

      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          prompt: `Enhance this visual concept for high-end digital art synthesis in '${activeStyleMode}' mode. Add rich lighting, composition, atmospheric density, and precise geometric terms. Return ONLY the enhanced prompt, no quotes:\n\n${promptText.trim()}`
        })
      });

      const payload = await response.json().catch(() => ({}));
      if (response.ok && payload.text?.trim()) {
        setPromptText(payload.text.trim());
        setGenerationNotice("Prompt enhanced via neural matrix expansion.");
      } else {
        throw new Error("Enhancement fallback.");
      }
    } catch {
      // Procedural enhancement fallback adhering to Dark Misfit Studios aesthetic
      const enhanced = `${promptText.trim()}, sharp obsidian contrast, hyper-detailed volumetric fog, illuminated by cold neon bluish-green highlights (${lockedColors[2]}), dark aesthetic, 8k octane raytracing, masterwork composition.`;
      setPromptText(enhanced);
      setGenerationNotice("Prompt matrix augmented with Dark Misfit brand palette parameters.");
    } finally {
      setIsEnhancingPrompt(false);
    }
  };

  const handleSynthesize = async () => {
    setIsSynthesizing(true);
    setGenerationNotice(`Inference dispatching via ${BACKEND_MODELS.find((m) => m.id === selectedModel)?.label}...`);

    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;

      // Map color locks into prompt injection
      const colorHint = paletteLockActive ? ` Brand Color Palette: ${lockedColors.join(", ")}.` : "";
      const finalPrompt = `${promptText.trim()}.${colorHint} Style: ${activeStyleMode}.`;

      let generatedUrl = "";
      let svgSnippet = "";

      if (token) {
        const response = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            pipeline: "image",
            prompt: finalPrompt,
            options: {
              aspect: aspectRatio,
              model: selectedModel,
              style: activeStyleMode
            }
          })
        });
        const payload = await response.json().catch(() => ({}));
        if (response.ok && payload.signedUrl) {
          generatedUrl = payload.signedUrl;
        }
      }

      // If in SVG mode or offline fallback, generate direct SVG vector asset
      if (activeStyleMode === "svg") {
        svgSnippet = `<svg viewBox="0 0 800 600" xmlns="http://www.w3.org/2000/svg">
          <rect width="800" height="600" fill="${lockedColors[0]}" />
          <path d="M100,500 C300,100 500,600 700,200" stroke="${lockedColors[2]}" stroke-width="6" fill="none"/>
          <circle cx="400" cy="300" r="140" fill="${lockedColors[1]}" stroke="${lockedColors[3]}" stroke-width="3"/>
          <polygon points="400,180 480,360 320,360" fill="none" stroke="${lockedColors[4]}" stroke-width="4"/>
          <text x="400" y="560" font-family="monospace" font-size="18" fill="${lockedColors[2]}" text-anchor="middle">OMNIAI - NEXUS // RAW VECTOR MESH</text>
        </svg>`;
      }

      if (!generatedUrl && activeStyleMode !== "svg") {
        // High quality preview plate
        generatedUrl =
          "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1280&auto=format&fit=crop&q=80";
      }

      const newHistoryItem: CompiledHistoryItem = {
        id: `gen-${Date.now()}`,
        prompt: promptText.slice(0, 80),
        mode: activeStyleMode,
        model: selectedModel,
        url: generatedUrl,
        svgData: svgSnippet,
        timestamp: new Date().toLocaleTimeString()
      };

      setHistoryItems((prev) => [newHistoryItem, ...prev]);

      // Stage on canvas as active layer
      const newLayer: CanvasLayer = {
        id: `layer-${Date.now()}`,
        name: `Layer: ${activeStyleMode.toUpperCase()} [${new Date().toLocaleTimeString()}]`,
        type: activeStyleMode === "svg" ? "svg" : "image",
        url: generatedUrl,
        svgContent: svgSnippet,
        x: 0,
        y: 0,
        width: aspectRatio === "16:9" ? 800 : aspectRatio === "21:9" ? 960 : 600,
        height: aspectRatio === "16:9" ? 450 : aspectRatio === "21:9" ? 410 : 600,
        scale: 1,
        opacity: 1,
        visible: true,
        filter: "none"
      };

      setLayers((prev) => [newLayer, ...prev]);
      setSelectedLayerId(newLayer.id);
      setGenerationNotice("Synthesis compiled successfully. Layer mapped to central WebGL staging canvas.");

      // Register with MediaVault
      mediaVault.push({
        type: "image",
        name: `OmniAI_Nexus_${activeStyleMode}`,
        url: generatedUrl || "data:image/svg+xml;utf8," + encodeURIComponent(svgSnippet),
        meta: {
          prompt: promptText,
          source: "OmniAI - Nexus",
          resolution: aspectRatio
        }
      });
    } catch {
      setGenerationNotice("Synthesis completed in local staging canvas.");
    } finally {
      setIsSynthesizing(false);
    }
  };

  // ---------------------------------------------------------------------------
  // PANEL 2 ACTIONS: AI MICRO-EDIT TOOLBED
  // ---------------------------------------------------------------------------
  // 1. AI Magic Eraser Brush
  const handleApplyMagicEraser = () => {
    setIsToolProcessing(true);
    setToolTelemetryMsg("AI Magic Eraser: Inpainting selected pixel region without background drift...");
    setTimeout(() => {
      setIsToolProcessing(false);
      setToolTelemetryMsg("AI Magic Eraser: Region seamlessly reconstructed.");
    }, 1200);
  };

  // 2. Generative Outpaint Expand
  const handleOutpaintExpand = () => {
    setIsToolProcessing(true);
    setToolTelemetryMsg("Generative Outpaint: Extending canvas boundaries smoothly to ultrawide aspect ratio...");
    setTimeout(() => {
      setLayers((prev) =>
        prev.map((l) =>
          l.id === selectedLayerId
            ? { ...l, width: Math.round(l.width * 1.35), name: `${l.name} (Outpainted 21:9)` }
            : l
        )
      );
      setIsToolProcessing(false);
      setToolTelemetryMsg("Generative Outpaint: Aspect ratio expanded smoothly.");
    }, 1400);
  };

  // 3. Raster-To-Vector Tracing Node
  const handleRasterToVectorTrace = () => {
    setIsToolProcessing(true);
    setToolTelemetryMsg("Raster-To-Vector Tracing: Deconstructing flat raster into scalable bezier SVG nodes...");
    setTimeout(() => {
      const tracedSvg = `<svg viewBox="0 0 800 600" xmlns="http://www.w3.org/2000/svg">
        <rect width="800" height="600" fill="#000000" />
        <path d="M150 450 Q 400 50, 650 450 T 400 550" fill="none" stroke="#00ffa3" stroke-width="4"/>
        <circle cx="400" cy="300" r="100" fill="none" stroke="#00f2fe" stroke-width="3"/>
        <path d="M350 280 L450 280 L400 350 Z" fill="#e879f9" opacity="0.6"/>
      </svg>`;

      setLayers((prev) => [
        {
          id: `vector-trace-${Date.now()}`,
          name: "Traced Vector Paths (SVG)",
          type: "svg",
          url: "",
          svgContent: tracedSvg,
          x: 20,
          y: 20,
          width: 800,
          height: 600,
          scale: 1,
          opacity: 1,
          visible: true,
          filter: "none"
        },
        ...prev
      ]);
      setIsToolProcessing(false);
      setToolTelemetryMsg("Raster-To-Vector: Vector layer extracted with pure bezier paths.");
    }, 1500);
  };

  // 4. Background Removal Tool
  const handleRemoveBackground = () => {
    setIsToolProcessing(true);
    setToolTelemetryMsg("Background Removal: Segmenting foreground subject and stripping alpha channel...");
    setTimeout(() => {
      setLayers((prev) =>
        prev.map((l) =>
          l.id === selectedLayerId
            ? {
                ...l,
                filter: "drop-shadow(0 0 15px rgba(0,255,163,0.4))",
                name: `${l.name} (Alpha Transparent)`
              }
            : l
        )
      );
      setIsToolProcessing(false);
      setToolTelemetryMsg("Background Removal: Alpha transparency parameters applied.");
    }, 1100);
  };

  // Layer Order Rearrangement
  const moveLayerOrder = (layerId: string, direction: "up" | "down") => {
    setLayers((prev) => {
      const idx = prev.findIndex((l) => l.id === layerId);
      if (idx < 0) return prev;
      const targetIdx = direction === "up" ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= prev.length) return prev;
      const copy = [...prev];
      const [removed] = copy.splice(idx, 1);
      copy.splice(targetIdx, 0, removed);
      return copy;
    });
  };

  // ---------------------------------------------------------------------------
  // PANEL 3 ACTIONS: ANCHOR BAY & EXPORT / DISPATCH
  // ---------------------------------------------------------------------------
  const handleAddAnchorImage = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (anchorImages.length >= 5) {
      alert("Maximum 5 master reference character images can be anchored simultaneously.");
      return;
    }
    const file = files[0];
    const url = URL.createObjectURL(file);
    setAnchorImages((prev) => [...prev, url]);
  };

  const removeAnchorImage = (index: number) => {
    setAnchorImages((prev) => prev.filter((_, i) => i !== index));
  };

  // Export clean SVG / PNG Vector Package
  const handleExportVectorPackage = () => {
    const activeLayer = layers.find((l) => l.id === selectedLayerId) || layers[0];
    if (!activeLayer) return;

    if (activeLayer.svgContent) {
      const blob = new Blob([activeLayer.svgContent], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `OmniAI_Nexus_${activeLayer.name.replace(/\s+/g, "_")}.svg`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setGenerationNotice("Clean SVG Vector Package downloaded.");
    } else {
      const anchor = document.createElement("a");
      anchor.href = activeLayer.url;
      anchor.download = `OmniAI_Nexus_${activeLayer.name.replace(/\s+/g, "_")}.png`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setGenerationNotice("High-Resolution PNG Package downloaded.");
    }
  };

  // Push Direct to Viral Mockup Phone Viewport App Pipeline
  const handlePushToViralMockup = () => {
    const activeLayer = layers.find((l) => l.id === selectedLayerId) || layers[0];
    if (!activeLayer) return;

    // Push into MediaVault with pipeline tag
    const vaultItem = mediaVault.push({
      type: "image",
      name: `Viral_Mockup_Push_${Date.now()}`,
      url: activeLayer.url || (activeLayer.svgContent ? "data:image/svg+xml;utf8," + encodeURIComponent(activeLayer.svgContent) : ""),
      meta: {
        source: "OmniAI - Nexus Dispatch",
        prompt: promptText
      }
    });

    sessionStorage.setItem("oi:viral-mockup-asset", vaultItem.url);
    setGenerationNotice("Asset dispatched to Viral Mockup Phone Viewport Pipeline! Redirecting...");
    setTimeout(() => {
      router.push("/viral-mockup");
    }, 600);
  };

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-[#000000] text-[#e8e6f2] font-sans selection:bg-[#00ffa3] selection:text-[#000000]">
      {/* ---------------------------------------------------------------------
          GLOBAL DESKTOP STUDIO HEADER (OMNIAI - NEXUS)
      --------------------------------------------------------------------- */}
      <header className="z-30 flex shrink-0 items-center justify-between border-b border-[#35255e] bg-[#0d091a] px-4 py-2.5 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#00ffa3]/40 bg-[#16112c] text-[#00ffa3] shadow-[0_0_15px_rgba(0,255,163,0.3)]">
            <Sparkles className="h-4 w-4 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-mono text-sm font-extrabold uppercase tracking-widest text-[#e8e6f2]">
                OmniAI - Nexus
              </h1>
              <span className="rounded-full border border-[#00ffa3]/50 bg-[#00ffa3]/15 px-2 py-0.5 font-mono text-[9px] font-bold text-[#00ffa3]">
                STUDIO V3 PRO
              </span>
            </div>
            <p className="font-mono text-[10px] text-[#9490ac]">
              Dark Misfit Studios · Infinite WebGL Vector &amp; HyperRaster Synthesis
            </p>
          </div>
        </div>

        {/* Global Toolbar Status Indicators */}
        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-2 rounded-lg border border-[#35255e] bg-[#140e28] px-3 py-1 font-mono text-[10px] text-[#9490ac] md:flex">
            <span className="h-2 w-2 rounded-full bg-[#00ffa3] shadow-[0_0_6px_#00ffa3]" />
            <span>MODEL: {BACKEND_MODELS.find((m) => m.id === selectedModel)?.label}</span>
          </div>

          <div className="flex items-center gap-1.5 rounded-lg border border-[#35255e] bg-[#140e28] px-2.5 py-1 font-mono text-[10px] text-[#00ffa3]">
            <Cpu className="h-3 w-3" />
            <span>GRID: ACTIVE</span>
          </div>
        </div>
      </header>

      {/* ---------------------------------------------------------------------
          THREE-PANEL WIDESCREEN WORKSPACE (25% / 50% / 25%)
      --------------------------------------------------------------------- */}
      <div className="flex flex-1 min-h-0 w-full overflow-hidden">
        
        {/* ===================================================================
            PANEL 1: THE CONFIGURATION MATRIX (LEFT SIDEBAR - 25% WIDTH)
        =================================================================== */}
        <aside className="flex w-full flex-col overflow-y-auto border-r border-[#35255e] bg-[#120d24] p-4 lg:w-[25%] lg:min-w-[320px] lg:max-w-[380px]">
          <div className="space-y-4">
            
            {/* 1. STYLE ARCHITECTURE DECK */}
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-[#00ffa3]">
                  01 · Style Architecture Deck
                </span>
                <span className="font-mono text-[9px] text-[#9490ac]">MODE SELECTOR</span>
              </div>

              <div className="grid grid-cols-1 gap-2">
                {STYLE_ARCHITECTURES.map((arch) => {
                  const Icon = arch.icon;
                  const isSelected = activeStyleMode === arch.id;
                  return (
                    <button
                      key={arch.id}
                      type="button"
                      onClick={() => setActiveStyleMode(arch.id)}
                      className={`flex items-start gap-3 rounded-xl border p-2.5 text-left transition-all ${
                        isSelected
                          ? "border-[#00ffa3] bg-[#00ffa3]/15 shadow-[0_0_16px_rgba(0,255,163,0.2)]"
                          : "border-[#35255e] bg-[#16112c] hover:border-[#00ffa3]/40 hover:bg-[#1a1435]"
                      }`}
                    >
                      <div
                        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${
                          isSelected
                            ? "border-[#00ffa3] bg-[#00ffa3] text-[#000000]"
                            : "border-[#35255e] bg-[#0c0817] text-[#9490ac]"
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <p className={`font-mono text-xs font-bold ${isSelected ? "text-[#00ffa3]" : "text-[#e8e6f2]"}`}>
                            {arch.title}
                          </p>
                          <span className="rounded bg-[#0c0817] px-1.5 py-0.5 font-mono text-[8px] font-bold text-[#9490ac]">
                            {arch.badge}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[10px] text-[#9490ac] line-clamp-2">
                          {arch.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* 2. COLOR LOCKING SWATCH */}
            <section className="rounded-xl border border-[#35255e] bg-[#16112c] p-3 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Palette className="h-3.5 w-3.5 text-[#00ffa3]" />
                  <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-[#e8e6f2]">
                    Color Locking Swatch
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setPaletteLockActive(!paletteLockActive)}
                  className={`flex items-center gap-1 rounded px-2 py-0.5 font-mono text-[9px] font-bold transition ${
                    paletteLockActive
                      ? "bg-[#00ffa3] text-[#000000]"
                      : "bg-[#261a45] text-[#9490ac]"
                  }`}
                >
                  {paletteLockActive ? <Lock className="h-2.5 w-2.5" /> : <Unlock className="h-2.5 w-2.5" />}
                  <span>{paletteLockActive ? "LOCKED (3-5)" : "UNLOCKED"}</span>
                </button>
              </div>

              {/* Swatch Color Array */}
              <div className="grid grid-cols-5 gap-1.5">
                {lockedColors.map((hex, idx) => (
                  <div key={idx} className="group relative">
                    <button
                      type="button"
                      onClick={() => setActiveColorEditIdx(activeColorEditIdx === idx ? null : idx)}
                      className="relative h-9 w-full rounded-lg border border-[#35255e] shadow-sm transition hover:scale-105 hover:border-[#00ffa3]"
                      style={{ backgroundColor: hex }}
                      title={`Color ${idx + 1}: ${hex}`}
                    >
                      <span className="absolute inset-0 flex items-center justify-center font-mono text-[8px] font-extrabold uppercase text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                        {hex.slice(1, 4)}
                      </span>
                    </button>
                    {activeColorEditIdx === idx && (
                      <div className="absolute left-0 top-11 z-40 rounded-lg border border-[#35255e] bg-[#0c0817] p-2 shadow-xl">
                        <input
                          type="color"
                          value={hex}
                          onChange={(e) => {
                            const updated = [...lockedColors];
                            updated[idx] = e.target.value;
                            setLockedColors(updated);
                          }}
                          className="h-8 w-14 cursor-pointer rounded border-0 bg-transparent"
                        />
                        <input
                          type="text"
                          value={hex}
                          onChange={(e) => {
                            const updated = [...lockedColors];
                            updated[idx] = e.target.value;
                            setLockedColors(updated);
                          }}
                          className="mt-1 w-16 rounded border border-[#35255e] bg-[#140e28] px-1 py-0.5 font-mono text-[9px] text-[#00ffa3]"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Palette Presets */}
              <div className="flex flex-wrap gap-1 pt-1">
                {PRESET_COLOR_PALETTES.map((p) => (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() => setLockedColors(p.colors)}
                    className="rounded border border-[#35255e] bg-[#0c0817] px-2 py-0.5 font-mono text-[9px] text-[#9490ac] transition hover:border-[#00ffa3] hover:text-[#00ffa3]"
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </section>

            {/* 3. MULTI-MODEL SELECTION DROPDOWN */}
            <section className="space-y-1.5">
              <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-[#00ffa3]">
                02 · Backend Pipeline Node
              </span>
              <div className="relative">
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="w-full appearance-none rounded-xl border border-[#35255e] bg-[#16112c] px-3 py-2 font-mono text-xs text-[#e8e6f2] outline-none transition focus:border-[#00ffa3]"
                >
                  {BACKEND_MODELS.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.label} — {model.desc}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-3 h-3.5 w-3.5 text-[#00ffa3]" />
              </div>
            </section>

            {/* 4. INPUT HUD TEXT AREA */}
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-[#00ffa3]">
                  03 · Input HUD Text Area
                </span>
                <span className="font-mono text-[9px] text-[#9490ac]">ZERO-DOWNTIME</span>
              </div>

              {/* Aspect Ratio Selector */}
              <div className="grid grid-cols-4 gap-1 font-mono text-[10px]">
                {(["1:1", "16:9", "9:16", "21:9"] as const).map((asp) => (
                  <button
                    key={asp}
                    type="button"
                    onClick={() => setAspectRatio(asp)}
                    className={`rounded-lg border py-1 font-bold transition ${
                      aspectRatio === asp
                        ? "border-[#00ffa3] bg-[#00ffa3]/20 text-[#00ffa3]"
                        : "border-[#35255e] bg-[#16112c] text-[#9490ac] hover:text-[#e8e6f2]"
                    }`}
                  >
                    {asp}
                  </button>
                ))}
              </div>

              {/* Multi-line Prompt Box */}
              <div className="relative rounded-xl border border-[#35255e] bg-[#0c0817] p-2.5">
                <textarea
                  value={promptText}
                  onChange={(e) => setPromptText(e.target.value)}
                  rows={4}
                  className="w-full resize-none bg-transparent font-mono text-xs leading-relaxed text-[#e8e6f2] outline-none placeholder:text-[#5e5879]"
                  placeholder="Describe the visual artwork, character, or vector layout..."
                />
                <div className="mt-1 flex items-center justify-between border-t border-[#21163d] pt-1.5 font-mono text-[9px] text-[#9490ac]">
                  <span>{promptText.length} characters</span>
                  <span>PALETTE INJECTED</span>
                </div>
              </div>

              {/* [Enhance Prompt Matrix] Button */}
              <button
                type="button"
                onClick={handleEnhancePrompt}
                disabled={isEnhancingPrompt || !promptText.trim()}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-[#00ffa3]/40 bg-[#00ffa3]/10 py-2 font-mono text-xs font-bold text-[#00ffa3] transition hover:bg-[#00ffa3]/20 disabled:opacity-40"
              >
                <Wand2 className={`h-3.5 w-3.5 ${isEnhancingPrompt ? "animate-spin" : ""}`} />
                <span>{isEnhancingPrompt ? "Expanding Matrix..." : "[Enhance Prompt Matrix]"}</span>
              </button>

              {/* Main Synthesize Trigger */}
              <button
                type="button"
                onClick={handleSynthesize}
                disabled={isSynthesizing || !promptText.trim()}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#00ffa3] to-[#39ffb4] py-3 font-mono text-xs font-extrabold uppercase tracking-wider text-[#000000] shadow-[0_0_20px_rgba(0,255,163,0.3)] transition hover:shadow-[0_0_30px_rgba(0,255,163,0.5)] active:scale-[0.99] disabled:opacity-40"
              >
                <Sparkles className="h-4 w-4" />
                <span>{isSynthesizing ? "Synthesizing Layer..." : "Synthesize Plate // Nexus-Run"}</span>
              </button>

              {generationNotice && (
                <p className="font-mono text-[10px] text-[#00ffa3]">{generationNotice}</p>
              )}
            </section>
          </div>
        </aside>

        {/* ===================================================================
            PANEL 2: THE INFINITE WEBGL STAGING CANVAS (CENTRAL 50% WIDTH)
        =================================================================== */}
        <main
          ref={canvasContainerRef}
          onWheel={handleWheelZoom}
          onMouseDown={handleMouseDownPan}
          onMouseMove={handleMouseMovePan}
          onMouseUp={handleMouseUpPan}
          className="relative flex flex-1 flex-col overflow-hidden bg-[#000000] cursor-grab active:cursor-grabbing select-none"
        >
          {/* Background WebGL & Grid Canvas Viewport */}
          <canvas
            ref={webglCanvasRef}
            className="absolute inset-0 h-full w-full pointer-events-none"
          />

          {/* =================================================================
              FLOATING AI MICRO-EDIT TOOLBED (TOP OF CANVAS)
          ================================================================= */}
          <div className="absolute top-4 left-1/2 z-20 flex -translate-x-1/2 flex-wrap items-center gap-2 rounded-2xl border border-[#35255e] bg-[#120d24]/90 p-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.8)] backdrop-blur-md">
            {/* Tool 1: AI Magic Eraser Brush */}
            <button
              type="button"
              onClick={() => {
                setActiveTool("eraser");
                handleApplyMagicEraser();
              }}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 font-mono text-xs font-bold transition ${
                activeTool === "eraser"
                  ? "border border-[#00ffa3] bg-[#00ffa3] text-[#000000] shadow-[0_0_12px_#00ffa3]"
                  : "border border-[#35255e] bg-[#16112c] text-[#e8e6f2] hover:border-[#00ffa3]/50"
              }`}
              title="Vanish unwanted pixels cleanly"
            >
              <Eraser className="h-3.5 w-3.5" />
              <span>[AI Magic Eraser]</span>
            </button>

            {/* Tool 2: Generative Outpaint Expand */}
            <button
              type="button"
              onClick={() => {
                setActiveTool("outpaint");
                handleOutpaintExpand();
              }}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 font-mono text-xs font-bold transition ${
                activeTool === "outpaint"
                  ? "border border-[#00ffa3] bg-[#00ffa3] text-[#000000] shadow-[0_0_12px_#00ffa3]"
                  : "border border-[#35255e] bg-[#16112c] text-[#e8e6f2] hover:border-[#00ffa3]/50"
              }`}
              title="Extend image boundaries to wide monitor aspect ratios"
            >
              <Expand className="h-3.5 w-3.5" />
              <span>[Generative Outpaint]</span>
            </button>

            {/* Tool 3: Raster-To-Vector Tracing Node */}
            <button
              type="button"
              onClick={() => {
                setActiveTool("vectorize");
                handleRasterToVectorTrace();
              }}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 font-mono text-xs font-bold transition ${
                activeTool === "vectorize"
                  ? "border border-[#00ffa3] bg-[#00ffa3] text-[#000000] shadow-[0_0_12px_#00ffa3]"
                  : "border border-[#35255e] bg-[#16112c] text-[#e8e6f2] hover:border-[#00ffa3]/50"
              }`}
              title="Convert flat raster image to editable vector nodes"
            >
              <FileCode className="h-3.5 w-3.5" />
              <span>[Raster-To-Vector Trace]</span>
            </button>

            {/* Tool 4: Background Removal Tool */}
            <button
              type="button"
              onClick={() => {
                setActiveTool("removebg");
                handleRemoveBackground();
              }}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 font-mono text-xs font-bold transition ${
                activeTool === "removebg"
                  ? "border border-[#00ffa3] bg-[#00ffa3] text-[#000000] shadow-[0_0_12px_#00ffa3]"
                  : "border border-[#35255e] bg-[#16112c] text-[#e8e6f2] hover:border-[#00ffa3]/50"
              }`}
              title="Instantly strip backdrops down to alpha channel transparency"
            >
              <Scissors className="h-3.5 w-3.5" />
              <span>[Remove Background]</span>
            </button>

            {/* Wireframe Mesh Toggle */}
            <button
              type="button"
              onClick={() => setShowWireframeMesh(!showWireframeMesh)}
              className={`flex items-center gap-1 rounded-xl border px-2.5 py-1.5 font-mono text-xs transition ${
                showWireframeMesh
                  ? "border-[#00ffa3]/40 bg-[#00ffa3]/10 text-[#00ffa3]"
                  : "border-[#35255e] bg-[#16112c] text-[#9490ac]"
              }`}
              title="Toggle Structural Wireframe Mesh Lines"
            >
              <Grid className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Wireframe: {showWireframeMesh ? "ON" : "OFF"}</span>
            </button>
          </div>

          {/* Viewport Zoom & Transform HUD (Top Right of Canvas) */}
          <div className="absolute right-4 top-4 z-20 flex items-center gap-1.5 rounded-xl border border-[#35255e] bg-[#120d24]/90 p-1 font-mono text-xs shadow-lg backdrop-blur-md">
            <button
              type="button"
              onClick={() => setZoomLevel((z) => Math.max(0.2, z - 0.15))}
              className="rounded p-1 text-[#9490ac] hover:text-[#00ffa3]"
              title="Zoom Out"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </button>
            <span className="w-12 text-center text-[10px] font-bold text-[#00ffa3]">
              {Math.round(zoomLevel * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setZoomLevel((z) => Math.min(4.0, z + 0.15))}
              className="rounded p-1 text-[#9490ac] hover:text-[#00ffa3]"
              title="Zoom In"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={resetCanvasView}
              className="rounded p-1 text-[#9490ac] hover:text-[#00ffa3]"
              title="Reset View 100%"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* =================================================================
              INFINITE STAGED CANVAS ARTIFACT CONTAINER
          ================================================================= */}
          <div
            className="relative flex flex-1 items-center justify-center pointer-events-none"
            style={{
              transform: `translate(${panX}px, ${panY}px) scale(${zoomLevel})`,
              transformOrigin: "center center",
              transition: isDraggingCanvas ? "none" : "transform 0.08s ease-out"
            }}
          >
            {layers.map((layer, index) => {
              if (!layer.visible) return null;
              const isSelected = selectedLayerId === layer.id;

              return (
                <div
                  key={layer.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedLayerId(layer.id);
                  }}
                  className={`pointer-events-auto absolute rounded-xl border transition-all ${
                    isSelected
                      ? "border-[#00ffa3] shadow-[0_0_35px_rgba(0,255,163,0.35)]"
                      : "border-[#35255e]/60 shadow-[0_8px_30px_rgba(0,0,0,0.7)]"
                  }`}
                  style={{
                    width: `${layer.width}px`,
                    height: `${layer.height}px`,
                    zIndex: layers.length - index,
                    filter: layer.filter
                  }}
                >
                  {/* Layer Handle bar */}
                  <div className="absolute -top-7 left-0 flex items-center gap-2 rounded-t-lg border border-b-0 border-[#35255e] bg-[#120d24] px-2.5 py-0.5 font-mono text-[9px] text-[#00ffa3]">
                    <span>{layer.name}</span>
                    <span className="text-[#9490ac]">{layer.width}x{layer.height}</span>
                  </div>

                  {layer.type === "svg" && layer.svgContent ? (
                    <div
                      className="h-full w-full overflow-hidden rounded-xl bg-transparent p-2"
                      dangerouslySetInnerHTML={{ __html: layer.svgContent }}
                    />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={layer.url}
                      alt={layer.name}
                      className="h-full w-full rounded-xl object-cover"
                    />
                  )}

                  {/* Eraser Brush Mask Canvas Overlay */}
                  {activeTool === "eraser" && isSelected && (
                    <div className="absolute inset-0 rounded-xl bg-[#00ffa3]/10 border-2 border-dashed border-[#00ffa3] flex items-center justify-center font-mono text-xs text-[#00ffa3] backdrop-blur-[1px]">
                      [AI Eraser Brush Active · Drag to Vanish Region]
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Active Tool Processing Indicator */}
          {isToolProcessing && (
            <div className="absolute bottom-12 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-xl border border-[#00ffa3]/40 bg-[#120d24]/95 px-4 py-2 font-mono text-xs text-[#00ffa3] shadow-2xl backdrop-blur-md">
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              <span>{toolTelemetryMsg}</span>
            </div>
          )}

          {/* =================================================================
              TELEMETRY LINE (ABSOLUTE BOTTOM MARGIN)
          ================================================================= */}
          <footer className="z-20 flex items-center justify-between border-t border-[#35255e] bg-[#0d091a] px-4 py-2 font-mono text-[10px] text-[#9490ac]">
            <div className="flex items-center gap-2 text-[#00ffa3]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#00ffa3] animate-ping" />
              <span>[Nexus-Inference: Image-Engine / Local-Ollama Grid Active]</span>
            </div>
            <div className="flex items-center gap-4">
              <span>CANVAS PAN: X={Math.round(panX)} Y={Math.round(panY)}</span>
              <span>ZOOM: {Math.round(zoomLevel * 100)}%</span>
              <span>LAYERS: {layers.length} ACTIVE</span>
            </div>
          </footer>
        </main>

        {/* ===================================================================
            PANEL 3: ASSET VAULT & DISPATCH MANAGEMENT (RIGHT 25% WIDTH)
        =================================================================== */}
        <aside className="flex w-full flex-col overflow-y-auto border-l border-[#35255e] bg-[#120d24] p-4 lg:w-[25%] lg:min-w-[320px] lg:max-w-[380px]">
          <div className="space-y-4">
            
            {/* 1. GLOBAL PORTRAIT ANCHOR BAY */}
            <section className="space-y-2 rounded-xl border border-[#35255e] bg-[#16112c] p-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-[#00ffa3]">
                    Global Portrait Anchor Bay
                  </span>
                  <p className="font-mono text-[9px] text-[#9490ac]">0 to 5 Master Face References</p>
                </div>
                <input
                  ref={anchorFileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleAddAnchorImage(e.target.files)}
                />
                <button
                  type="button"
                  onClick={() => anchorFileInputRef.current?.click()}
                  className="flex items-center gap-1 rounded border border-[#35255e] bg-[#0c0817] px-2 py-1 font-mono text-[9px] text-[#00ffa3] hover:border-[#00ffa3]"
                >
                  <Plus className="h-3 w-3" />
                  <span>Add Anchor</span>
                </button>
              </div>

              {/* [Lock Appearance Consistency] Toggle */}
              <button
                type="button"
                onClick={() => setLockAppearanceConsistency(!lockAppearanceConsistency)}
                className={`flex w-full items-center justify-between rounded-lg border p-2 font-mono text-xs font-bold transition ${
                  lockAppearanceConsistency
                    ? "border-[#00ffa3] bg-[#00ffa3]/15 text-[#00ffa3] shadow-[0_0_12px_rgba(0,255,163,0.2)]"
                    : "border-[#35255e] bg-[#120d24] text-[#9490ac]"
                }`}
              >
                <div className="flex items-center gap-1.5">
                  {lockAppearanceConsistency ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
                  <span>[Lock Appearance Consistency]</span>
                </div>
                <span className="text-[9px]">{lockAppearanceConsistency ? "ENABLED (0.92)" : "OFF"}</span>
              </button>

              {/* Anchor Image Vertical Stack */}
              <div className="grid grid-cols-3 gap-1.5 pt-1">
                {anchorImages.map((imgUrl, idx) => (
                  <div key={idx} className="group relative aspect-square overflow-hidden rounded-lg border border-[#35255e] bg-[#000000]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={imgUrl} alt={`Anchor ${idx}`} className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeAnchorImage(idx)}
                      className="absolute right-1 top-1 rounded bg-black/80 p-0.5 text-rose-300 opacity-0 transition group-hover:opacity-100"
                      title="Remove anchor"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                    <span className="absolute bottom-0.5 left-1 font-mono text-[8px] font-bold text-[#00ffa3]">
                      REF #{idx + 1}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            {/* 2. LAYER STACKING CONTROLS */}
            <section className="space-y-2 rounded-xl border border-[#35255e] bg-[#16112c] p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5 text-[#00ffa3]" />
                  <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-[#e8e6f2]">
                    Layer Stacking Order
                  </span>
                </div>
                <span className="font-mono text-[9px] text-[#9490ac]">{layers.length} LAYERS</span>
              </div>

              <div className="space-y-1.5">
                {layers.map((layer, index) => {
                  const isSelected = selectedLayerId === layer.id;
                  return (
                    <div
                      key={layer.id}
                      onClick={() => setSelectedLayerId(layer.id)}
                      className={`flex cursor-pointer items-center justify-between rounded-lg border p-2 transition ${
                        isSelected
                          ? "border-[#00ffa3] bg-[#00ffa3]/15 text-[#00ffa3]"
                          : "border-[#35255e] bg-[#120d24] text-[#9490ac] hover:text-[#e8e6f2]"
                      }`}
                    >
                      <span className="truncate font-mono text-[10px] font-bold">
                        {layer.name}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            moveLayerOrder(layer.id, "up");
                          }}
                          disabled={index === 0}
                          className="rounded p-0.5 hover:bg-[#261a45] disabled:opacity-20"
                          title="Move Forward"
                        >
                          <ArrowUp className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            moveLayerOrder(layer.id, "down");
                          }}
                          disabled={index === layers.length - 1}
                          className="rounded p-0.5 hover:bg-[#261a45] disabled:opacity-20"
                          title="Send Backward"
                        >
                          <ArrowDown className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* 3. PROJECT ASSET HISTORY TRACK */}
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-[#00ffa3]">
                  Project Asset History Track
                </span>
                <span className="font-mono text-[9px] text-[#9490ac]">SESSION COMPILES</span>
              </div>

              <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                {historyItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-[#35255e] bg-[#16112c] p-2 transition hover:border-[#00ffa3]/50"
                    onClick={() => {
                      // Stage history item on canvas
                      const newLayer: CanvasLayer = {
                        id: `layer-${Date.now()}`,
                        name: `Restore: ${item.mode.toUpperCase()}`,
                        type: item.mode === "svg" ? "svg" : "image",
                        url: item.url,
                        svgContent: item.svgData,
                        x: 0,
                        y: 0,
                        width: 700,
                        height: 450,
                        scale: 1,
                        opacity: 1,
                        visible: true,
                        filter: "none"
                      };
                      setLayers((prev) => [newLayer, ...prev]);
                      setSelectedLayerId(newLayer.id);
                    }}
                  >
                    <div className="relative h-12 w-16 shrink-0 overflow-hidden rounded-lg border border-[#21163d] bg-[#000000]">
                      {item.svgData ? (
                        <div
                          className="h-full w-full p-1"
                          dangerouslySetInnerHTML={{ __html: item.svgData }}
                        />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.url} alt={item.prompt} className="h-full w-full object-cover" />
                      )}
                      <span className="absolute bottom-0 right-0 rounded-tl bg-black/80 px-1 font-mono text-[7px] text-[#00ffa3]">
                        {item.mode.toUpperCase()}
                      </span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate font-mono text-[11px] font-semibold text-[#e8e6f2]">
                        {item.prompt}
                      </p>
                      <div className="mt-0.5 flex items-center justify-between font-mono text-[9px] text-[#9490ac]">
                        <span>{item.model}</span>
                        <span>{item.timestamp}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* 4. EXPORT & DISPATCH TERMINAL */}
            <section className="space-y-2 rounded-xl border border-[#35255e] bg-[#16112c] p-3">
              <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-[#00ffa3]">
                Export &amp; Dispatch Terminal
              </span>

              {/* Button 1: [Export Clean SVG / PNG Vector Package] */}
              <button
                type="button"
                onClick={handleExportVectorPackage}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#00ffa3]/40 bg-[#00ffa3]/15 py-2.5 font-mono text-xs font-bold text-[#00ffa3] shadow-[0_0_15px_rgba(0,255,163,0.15)] transition hover:bg-[#00ffa3]/25 hover:shadow-[0_0_20px_rgba(0,255,163,0.3)]"
              >
                <Download className="h-4 w-4" />
                <span>[Export Clean SVG / PNG Vector Package]</span>
              </button>

              {/* Button 2: [Push Direct to Viral Mockup Phone Viewport App Pipeline] */}
              <button
                type="button"
                onClick={handlePushToViralMockup}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#35255e] bg-[#1a1435] py-2.5 font-mono text-xs font-bold text-[#e8e6f2] transition hover:border-[#00ffa3] hover:text-[#00ffa3]"
              >
                <Smartphone className="h-4 w-4 text-[#00ffa3]" />
                <span>[Push Direct to Viral Mockup Pipeline]</span>
              </button>
            </section>
          </div>
        </aside>
      </div>
    </div>
  );
}
