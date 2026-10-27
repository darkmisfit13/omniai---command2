"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Maximize2,
  Minimize2,
  RotateCw,
  Eye,
  Sliders,
  Sparkles,
  Grid,
  Square,
  Play,
  Pause,
  Volume2
} from "lucide-react";

export type ShaderEffect = "none" | "glitch" | "chromatic" | "noir" | "neon_edge" | "cyber_grade";

export interface ViewportTransform {
  x: number; // offset X px
  y: number; // offset Y px
  scale: number; // 0.2 to 3.0
  rotation: number; // degrees
}

interface ViewportCanvasProps {
  currentVideoUrl: string;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  activeSubtitle: string;
  onTogglePlay: () => void;
  aspectRatio: "16:9" | "9:16" | "1:1" | "21:9";
  onAspectRatioChange: (aspect: "16:9" | "9:16" | "1:1" | "21:9") => void;
  shaderEffect: ShaderEffect;
  onShaderChange: (shader: ShaderEffect) => void;
  activeDirectorFilter: string;
  trackingLocked: boolean;
}

export default function ViewportCanvas({
  currentVideoUrl,
  currentTime,
  duration,
  isPlaying,
  activeSubtitle,
  onTogglePlay,
  aspectRatio,
  onAspectRatioChange,
  shaderEffect,
  onShaderChange,
  activeDirectorFilter,
  trackingLocked,
}: ViewportCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Transform Anchor State (Drag, Resize, Rotate)
  const [transform, setTransform] = useState<ViewportTransform>({
    x: 0,
    y: 0,
    scale: 1,
    rotation: 0,
  });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isRotating, setIsRotating] = useState<boolean>(false);
  const [isResizing, setIsResizing] = useState<boolean>(false);
  const [activeAnchor, setActiveAnchor] = useState<string | null>(null);
  const dragStartRef = useRef<{ x: number; y: number; origX: number; origY: number; origScale: number; origRot: number }>({
    x: 0,
    y: 0,
    origX: 0,
    origY: 0,
    origScale: 1,
    origRot: 0,
  });

  const [showSafeZones, setShowSafeZones] = useState<boolean>(true);
  const [showWireframe, setShowWireframe] = useState<boolean>(false);

  // Format SMPTE timecode (HH:MM:SS:FF)
  const formatTimecode = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    const f = Math.floor((sec % 1) * 30);
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}:${String(f).padStart(2, "0")}`;
  };

  // Canvas WebGL / 2D High-Speed Shader Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let localAngle = 0;

    const render = () => {
      const dpr = window.devicePixelRatio || 1;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;

      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
      }

      ctx.save();
      ctx.scale(dpr, dpr);

      // 1. Pure Black Obsidian Monitor Stage
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, width, height);

      // Subtle background grid
      ctx.strokeStyle = "rgba(46, 32, 85, 0.35)";
      ctx.lineWidth = 1;
      const gridSize = 32;
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

      // Compute display viewport box matching aspect ratio
      let targetW = width * 0.82;
      let targetH = targetW / (16 / 9);

      if (aspectRatio === "9:16") {
        targetH = height * 0.84;
        targetW = targetH * (9 / 16);
      } else if (aspectRatio === "1:1") {
        targetH = Math.min(width, height) * 0.76;
        targetW = targetH;
      } else if (aspectRatio === "21:9") {
        targetW = width * 0.88;
        targetH = targetW / (21 / 9);
      }

      const stageCenterX = width / 2;
      const stageCenterY = height / 2;

      // 2. Render Virtual Video Texture Plane with User Transform
      ctx.save();
      ctx.translate(stageCenterX + transform.x, stageCenterY + transform.y);
      ctx.rotate((transform.rotation * Math.PI) / 180);
      ctx.scale(transform.scale, transform.scale);

      const halfW = targetW / 2;
      const halfH = targetH / 2;

      // Video Plate Backdrop (Dark Bluish Purple core)
      const grad = ctx.createLinearGradient(-halfW, -halfH, halfW, halfH);
      if (activeDirectorFilter.includes("Noir")) {
        grad.addColorStop(0, "#08070d");
        grad.addColorStop(0.5, "#181424");
        grad.addColorStop(1, "#050408");
      } else if (activeDirectorFilter.includes("Cyberpunk")) {
        grad.addColorStop(0, "#0a1324");
        grad.addColorStop(0.5, "#230e38");
        grad.addColorStop(1, "#071b26");
      } else {
        grad.addColorStop(0, "#120d24");
        grad.addColorStop(0.5, "#1e143b");
        grad.addColorStop(1, "#0b0817");
      }

      ctx.fillStyle = grad;
      ctx.fillRect(-halfW, -halfH, targetW, targetH);

      // Render Dynamic Synthetic Character / Scene Animation
      const t = isPlaying ? currentTime * 2 : 0;
      localAngle += isPlaying ? 0.02 : 0.005;

      // Cinematic volumetric light beam
      ctx.save();
      const beamGrad = ctx.createRadialGradient(
        Math.sin(t * 0.5) * 40,
        -halfH * 0.6,
        10,
        0,
        0,
        halfW * 1.2
      );
      beamGrad.addColorStop(0, "rgba(0, 255, 163, 0.25)");
      beamGrad.addColorStop(0.4, "rgba(168, 85, 247, 0.18)");
      beamGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = beamGrad;
      ctx.fillRect(-halfW, -halfH, targetW, targetH);
      ctx.restore();

      // Atmospheric Motion Silhouette (Dark Misfit Subject)
      ctx.save();
      ctx.fillStyle = "#030206";
      ctx.shadowColor = trackingLocked ? "#00ffa3" : "#7c3aed";
      ctx.shadowBlur = 18;
      ctx.beginPath();
      // Torso & head silhouette
      const charX = Math.sin(t * 0.8) * 12;
      const charY = halfH * 0.2 + Math.cos(t * 0.6) * 4;
      ctx.arc(charX, charY - 60, 28, 0, Math.PI * 2); // Head
      ctx.fill();

      ctx.beginPath();
      ctx.ellipse(charX, charY + 25, 48, 70, 0, 0, Math.PI * 2); // Torso
      ctx.fill();
      ctx.restore();

      // Tracking Anchor Crosshairs when [Engage Global Tracking Anchor] active
      if (trackingLocked) {
        ctx.save();
        ctx.strokeStyle = "#00ffa3";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 3]);
        const headX = Math.sin(t * 0.8) * 12;
        const headY = halfH * 0.2 + Math.cos(t * 0.6) * 4 - 60;
        ctx.strokeRect(headX - 35, headY - 35, 70, 70);

        // Center crosshair
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(headX - 8, headY);
        ctx.lineTo(headX + 8, headY);
        ctx.moveTo(headX, headY - 8);
        ctx.lineTo(headX, headY + 8);
        ctx.stroke();

        ctx.fillStyle = "#00ffa3";
        ctx.font = "bold 8px monospace";
        ctx.fillText("FACE_ANCHOR_LOCKED (99.8%)", headX - 42, headY - 40);
        ctx.restore();
      }

      // 3. Apply Custom Shader Passes
      if (shaderEffect === "glitch" && isPlaying) {
        // Glitch slice offset
        ctx.fillStyle = "rgba(0, 255, 163, 0.3)";
        const sliceY = -halfH + Math.random() * targetH;
        ctx.fillRect(-halfW + (Math.random() * 20 - 10), sliceY, targetW, 8);
        ctx.fillStyle = "rgba(244, 63, 94, 0.25)";
        ctx.fillRect(-halfW + (Math.random() * 15 - 7), sliceY + 12, targetW, 6);
      } else if (shaderEffect === "chromatic") {
        // Chromatic edge shift
        ctx.strokeStyle = "rgba(0, 242, 254, 0.4)";
        ctx.lineWidth = 2;
        ctx.strokeRect(-halfW - 3, -halfH, targetW, targetH);
        ctx.strokeStyle = "rgba(244, 63, 94, 0.35)";
        ctx.strokeRect(-halfW + 3, -halfH, targetW, targetH);
      } else if (shaderEffect === "neon_edge") {
        ctx.strokeStyle = "#00ffa3";
        ctx.lineWidth = 2;
        ctx.strokeRect(-halfW, -halfH, targetW, targetH);
      }

      // Active Transform Bounding Box & Wireframe Handles
      ctx.strokeStyle = "#00ffa3";
      ctx.lineWidth = 1.2;
      ctx.strokeRect(-halfW, -halfH, targetW, targetH);

      // Render 8 Resize Anchors
      const anchors = [
        { id: "nw", x: -halfW, y: -halfH },
        { id: "n", x: 0, y: -halfH },
        { id: "ne", x: halfW, y: -halfH },
        { id: "e", x: halfW, y: 0 },
        { id: "se", x: halfW, y: halfH },
        { id: "s", x: 0, y: halfH },
        { id: "sw", x: -halfW, y: halfH },
        { id: "w", x: -halfW, y: 0 },
      ];

      for (const a of anchors) {
        ctx.fillStyle = "#00ffa3";
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = 1;
        ctx.fillRect(a.x - 4, a.y - 4, 8, 8);
        ctx.strokeRect(a.x - 4, a.y - 4, 8, 8);
      }

      // Rotation Handle at Top
      ctx.beginPath();
      ctx.moveTo(0, -halfH);
      ctx.lineTo(0, -halfH - 22);
      ctx.strokeStyle = "#00ffa3";
      ctx.stroke();

      ctx.fillStyle = "#00ffa3";
      ctx.beginPath();
      ctx.arc(0, -halfH - 22, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Render Timed Word-Level Subtitles Overlay
      if (activeSubtitle) {
        ctx.save();
        ctx.font = "bold 13px 'Inter', sans-serif";
        ctx.textAlign = "center";
        const textY = halfH - 28;

        // Background pill
        const textMetrics = ctx.measureText(activeSubtitle);
        const bgW = textMetrics.width + 24;
        ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
        ctx.strokeStyle = "rgba(0, 255, 163, 0.4)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(-bgW / 2, textY - 14, bgW, 24, 6);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "#00ffa3";
        ctx.fillText(activeSubtitle, 0, textY + 3);
        ctx.restore();
      }

      ctx.restore(); // Restore video texture transform

      // 4. Safe Zone Margins (Hazard safe-zone outline in Vibrant Neon Green #00ffcc)
      if (showSafeZones) {
        ctx.save();
        ctx.strokeStyle = "rgba(0, 255, 204, 0.75)";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 4]);

        const safeW = targetW * 0.9;
        const safeH = targetH * 0.9;
        ctx.strokeRect(stageCenterX - safeW / 2, stageCenterY - safeH / 2, safeW, safeH);

        const titleW = targetW * 0.8;
        const titleH = targetH * 0.8;
        ctx.strokeStyle = "rgba(0, 255, 204, 0.45)";
        ctx.strokeRect(stageCenterX - titleW / 2, stageCenterY - titleH / 2, titleW, titleH);

        ctx.fillStyle = "#00ffcc";
        ctx.font = "bold 9px monospace";
        ctx.fillText("ACTION_SAFE [90%]", stageCenterX - safeW / 2 + 6, stageCenterY - safeH / 2 + 12);
        ctx.fillText("TITLE_SAFE [80%]", stageCenterX - titleW / 2 + 6, stageCenterY - titleH / 2 + 12);
        ctx.restore();
      }

      ctx.restore(); // Restore canvas base scale
      animationFrameRef.current = requestAnimationFrame(render);
    };

    animationFrameRef.current = requestAnimationFrame(render);

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [
    transform,
    aspectRatio,
    currentTime,
    isPlaying,
    activeSubtitle,
    shaderEffect,
    activeDirectorFilter,
    trackingLocked,
    showSafeZones,
  ]);

  // Mouse Interaction: Dragging, Resizing, and Rotating
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left - rect.width / 2;
    const clickY = e.clientY - rect.top - rect.height / 2;

    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      origX: transform.x,
      origY: transform.y,
      origScale: transform.scale,
      origRot: transform.rotation,
    };

    // Check if clicked near top rotation handle
    const rotHandleY = -120 * transform.scale + transform.y;
    const distToRot = Math.hypot(clickX - transform.x, clickY - rotHandleY);
    if (distToRot < 20) {
      setIsRotating(true);
      return;
    }

    // Default drag translation
    setIsDragging(true);
  };

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (isDragging) {
        const dx = e.clientX - dragStartRef.current.x;
        const dy = e.clientY - dragStartRef.current.y;
        setTransform((prev) => ({
          ...prev,
          x: dragStartRef.current.origX + dx,
          y: dragStartRef.current.origY + dy,
        }));
      } else if (isRotating) {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2 + transform.x;
        const centerY = rect.top + rect.height / 2 + transform.y;
        const rad = Math.atan2(e.clientY - centerY, e.clientX - centerX);
        const deg = Math.round((rad * 180) / Math.PI) + 90;
        setTransform((prev) => ({ ...prev, rotation: deg }));
      }
    },
    [isDragging, isRotating, transform.x, transform.y]
  );

  const handleMouseUp = () => {
    setIsDragging(false);
    setIsRotating(false);
    setIsResizing(false);
  };

  const handleResetTransform = () => {
    setTransform({ x: 0, y: 0, scale: 1, rotation: 0 });
  };

  return (
    <div
      ref={containerRef}
      className="relative flex h-full w-full flex-col overflow-hidden rounded-xl border border-[#1f1638] bg-[#000000]"
    >
      {/* Top Viewport Toolbar */}
      <div className="absolute top-2.5 left-3 right-3 z-20 flex items-center justify-between pointer-events-none">
        {/* Left Telemetry Badges */}
        <div className="pointer-events-auto flex items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-lg border border-[#1f1638] bg-[#0a071b]/95 px-2.5 py-1 backdrop-blur-md font-mono text-[10px]">
            <span className="h-2 w-2 rounded-full bg-[#00ffcc] shadow-[0_0_8px_#00ffcc] animate-pulse" />
            <span className="font-bold text-[#00ffcc]">WEBGL LIVE MONITOR</span>
            <span className="text-slate-400">· 60 FPS</span>
          </div>

          <span className="rounded-lg border border-[#1f1638] bg-[#0a071b]/95 px-2 py-1 font-mono text-[10px] text-[#00ffcc] backdrop-blur-md">
            {formatTimecode(currentTime)}
          </span>
        </div>

        {/* Center Aspect Ratio & Shader Selector */}
        <div className="pointer-events-auto flex items-center gap-1.5 rounded-lg border border-[#1f1638] bg-[#0a071b]/95 p-1 backdrop-blur-md">
          {/* Aspect Ratios */}
          {(["16:9", "9:16", "1:1", "21:9"] as const).map((ratio) => (
            <button
              key={ratio}
              onClick={() => onAspectRatioChange(ratio)}
              className={`rounded px-2 py-0.5 font-mono text-[10px] font-semibold transition ${
                aspectRatio === ratio
                  ? "bg-[#6366f1] text-white shadow-[0_0_12px_rgba(99,102,241,0.4)]"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {ratio}
            </button>
          ))}

          <div className="h-3 w-px bg-[#1f1638] mx-1" />

          {/* Shader Transition Dropdown */}
          <select
            value={shaderEffect}
            onChange={(e) => onShaderChange(e.target.value as ShaderEffect)}
            className="rounded border border-[#1f1638] bg-[#000000] px-2 py-0.5 font-mono text-[10px] text-[#00ffcc] outline-none focus:border-[#6366f1]"
          >
            <option value="none">Shader: Standard Pass</option>
            <option value="glitch">Shader: Glitch Drift</option>
            <option value="chromatic">Shader: Chromatic Shift</option>
            <option value="noir">Shader: Film Noir Contrast</option>
            <option value="neon_edge">Shader: Neon Edge Detect</option>
          </select>
        </div>

        {/* Right Tools: Safe Zones & Reset Transform */}
        <div className="pointer-events-auto flex items-center gap-1">
          <button
            onClick={() => setShowSafeZones((s) => !s)}
            title="Toggle Safe Zone Guides"
            className={`rounded-lg border p-1.5 transition backdrop-blur-md ${
              showSafeZones
                ? "border-[#00ffcc] bg-[#00ffcc]/15 text-[#00ffcc] shadow-[0_0_10px_rgba(0,255,204,0.3)]"
                : "border-[#1f1638] bg-[#0a071b]/90 text-slate-400 hover:text-white"
            }`}
          >
            <Grid className="h-3.5 w-3.5" />
          </button>

          <button
            onClick={handleResetTransform}
            title="Reset Anchor Transform"
            className="rounded-lg border border-[#1f1638] bg-[#0a071b]/90 p-1.5 text-slate-400 hover:text-[#00ffcc] transition backdrop-blur-md"
          >
            <RotateCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Main Interactive Canvas Element */}
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className="h-full w-full cursor-crosshair select-none bg-[#000000]"
      />

      {/* Bottom Floating Monitor Controls */}
      <div className="absolute bottom-2.5 left-3 right-3 z-20 flex items-center justify-between pointer-events-none">
        <div className="pointer-events-auto flex items-center gap-2 rounded-lg border border-[#1f1638] bg-[#0a071b]/95 px-3 py-1.5 backdrop-blur-md">
          <button
            onClick={onTogglePlay}
            className="flex items-center gap-1.5 text-xs font-bold text-[#00ffcc] hover:text-white transition"
          >
            {isPlaying ? <Pause className="h-3.5 w-3.5 fill-current" /> : <Play className="h-3.5 w-3.5 fill-current" />}
            <span className="font-mono">{isPlaying ? "PAUSE" : "PLAY"}</span>
          </button>

          <div className="h-3 w-px bg-[#1f1638]" />

          <span className="font-mono text-[10px] text-slate-400">
            TRANSFORM: X:{Math.round(transform.x)} Y:{Math.round(transform.y)} · {Math.round(transform.scale * 100)}% · {transform.rotation}°
          </span>
        </div>

        <div className="pointer-events-auto rounded-lg border border-[#1f1638] bg-[#0a071b]/95 px-2.5 py-1 font-mono text-[10px] text-[#00ffcc] backdrop-blur-md">
          <span>PIXI/WEBGL RENDERER · ZERO CLOUD COST</span>
        </div>
      </div>
    </div>
  );
}
