"use client";

import { useEffect, useRef, useState } from "react";
import { dawSynthEngine } from "@/lib/dawSynthEngine";
import { Activity, Disc, Sparkles, Orbit } from "lucide-react";

interface CircularAudioVisualizerProps {
  isPlaying: boolean;
  bpm: number;
}

export default function CircularAudioVisualizer({ isPlaying, bpm }: CircularAudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const [visMode, setVisMode] = useState<"circular" | "radial_particles" | "cyber_matrix">("circular");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let rotAngle = 0;
    const numBars = 72;
    const particles: Array<{ x: number; y: number; angle: number; dist: number; speed: number; size: number; color: string; life: number }> = [];

    // Initialize decorative orbiting particles
    for (let i = 0; i < 48; i++) {
      particles.push({
        x: 0,
        y: 0,
        angle: Math.random() * Math.PI * 2,
        dist: 70 + Math.random() * 85,
        speed: (Math.random() * 0.02 + 0.005) * (Math.random() > 0.5 ? 1 : -1),
        size: Math.random() * 2.2 + 0.8,
        color: Math.random() > 0.5 ? "#00ffa3" : (Math.random() > 0.5 ? "#00f2fe" : "#a855f7"),
        life: Math.random() * 100,
      });
    }

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

      // Deep Obsidian background
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, width, height);

      const centerX = width / 2;
      const centerY = height / 2;
      const baseRadius = Math.min(centerX, centerY) * 0.44;

      // Subtle cyber grid lines in backdrop
      ctx.strokeStyle = "rgba(46, 32, 85, 0.25)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(centerX, centerY, baseRadius * 1.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(centerX, centerY, baseRadius * 0.7, 0, Math.PI * 2);
      ctx.stroke();

      // Retrieve real FFT frequency data from Web Audio AnalyserNode
      const analyser = dawSynthEngine.getAnalyser();
      const bufferLength = analyser ? analyser.frequencyBinCount : 128;
      const dataArray = new Uint8Array(bufferLength);

      let avgEnergy = 0;
      if (analyser && isPlaying) {
        analyser.getByteFrequencyData(dataArray as any);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        avgEnergy = sum / bufferLength / 255;
      } else if (isPlaying) {
        // Fallback procedural energy based on BPM pulse
        const beatCycle = (performance.now() / 1000) * (bpm / 60);
        avgEnergy = 0.35 + Math.sin(beatCycle * Math.PI) * 0.25;
      } else {
        avgEnergy = 0.08;
      }

      // Rotate canvas slightly for spatial motion
      rotAngle += isPlaying ? 0.008 : 0.002;

      // Draw Orbiting Neon Particles
      for (const p of particles) {
        p.angle += p.speed * (isPlaying ? 2.2 : 1);
        p.dist += Math.sin(p.angle * 3) * (isPlaying ? 0.4 : 0.1);
        const currentDist = Math.max(baseRadius * 0.7, Math.min(baseRadius * 1.6, p.dist + (isPlaying ? avgEnergy * 25 : 0)));

        const px = centerX + Math.cos(p.angle) * currentDist;
        const py = centerY + Math.sin(p.angle) * currentDist;

        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = isPlaying ? 8 : 3;
        ctx.beginPath();
        ctx.arc(px, py, p.size * (isPlaying ? 1.4 : 1), 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      // 1. Center Holo-Core Glow
      const pulseRadius = baseRadius * 0.48 + (isPlaying ? avgEnergy * 18 : 0);
      const coreGrad = ctx.createRadialGradient(centerX, centerY, 5, centerX, centerY, pulseRadius);
      coreGrad.addColorStop(0, "rgba(0, 255, 163, 0.28)");
      coreGrad.addColorStop(0.5, "rgba(168, 85, 247, 0.15)");
      coreGrad.addColorStop(1, "rgba(0, 0, 0, 0)");

      ctx.fillStyle = coreGrad;
      ctx.beginPath();
      ctx.arc(centerX, centerY, pulseRadius, 0, Math.PI * 2);
      ctx.fill();

      // Center Core Ring
      ctx.strokeStyle = isPlaying ? "#00ffa3" : "rgba(0, 255, 163, 0.4)";
      ctx.lineWidth = isPlaying ? 2.5 : 1.5;
      ctx.shadowColor = "#00ffa3";
      ctx.shadowBlur = isPlaying ? 16 : 4;
      ctx.beginPath();
      ctx.arc(centerX, centerY, baseRadius * 0.52, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // 2. Render Circular Radial Waveform Bars
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(rotAngle);

      for (let i = 0; i < numBars; i++) {
        const barAngle = (i / numBars) * Math.PI * 2;
        let amplitude = 6;

        if (analyser && isPlaying) {
          const binIndex = Math.floor((i / numBars) * (bufferLength * 0.65));
          const val = dataArray[binIndex] || 0;
          amplitude = 8 + (val / 255) * 62;
        } else if (isPlaying) {
          const wavePhase = (i * 0.25) + (performance.now() / 180);
          amplitude = 12 + Math.abs(Math.sin(wavePhase)) * 40 * (1 + avgEnergy);
        } else {
          amplitude = 6 + Math.sin(i * 0.4 + performance.now() / 800) * 4;
        }

        const startDist = baseRadius * 0.65;
        const endDist = startDist + amplitude;

        const cosA = Math.cos(barAngle);
        const sinA = Math.sin(barAngle);

        const x1 = cosA * startDist;
        const y1 = sinA * startDist;
        const x2 = cosA * endDist;
        const y2 = sinA * endDist;

        // Gradient color: Neon Bluish Green -> Cyan -> Purple
        const barGrad = ctx.createLinearGradient(x1, y1, x2, y2);
        if (i % 3 === 0) {
          barGrad.addColorStop(0, "#00ffa3");
          barGrad.addColorStop(1, "#39ffb4");
        } else if (i % 3 === 1) {
          barGrad.addColorStop(0, "#00f2fe");
          barGrad.addColorStop(1, "#38bdf8");
        } else {
          barGrad.addColorStop(0, "#a855f7");
          barGrad.addColorStop(1, "#c084fc");
        }

        ctx.strokeStyle = barGrad;
        ctx.lineWidth = 2.2;
        ctx.lineCap = "round";
        ctx.shadowColor = i % 3 === 0 ? "#00ffa3" : "#00f2fe";
        ctx.shadowBlur = isPlaying ? 9 : 2;

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }

      ctx.restore();

      // 3. Inner Oscilloscope Waveform Line
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.beginPath();
      ctx.strokeStyle = isPlaying ? "#00ffa3" : "rgba(0, 255, 163, 0.4)";
      ctx.lineWidth = 1.8;
      ctx.shadowColor = "#00ffa3";
      ctx.shadowBlur = isPlaying ? 10 : 3;

      const innerSamples = 48;
      for (let s = 0; s <= innerSamples; s++) {
        const theta = (s / innerSamples) * Math.PI * 2;
        const wiggle = isPlaying
          ? Math.sin(theta * 6 + (performance.now() / 150)) * (avgEnergy * 14)
          : Math.sin(theta * 4) * 2;
        const r = baseRadius * 0.35 + wiggle;
        const ix = Math.cos(theta) * r;
        const iy = Math.sin(theta) * r;
        if (s === 0) ctx.moveTo(ix, iy);
        else ctx.lineTo(ix, iy);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.restore();

      // Center Icon or State indicator
      ctx.fillStyle = isPlaying ? "#00ffa3" : "#7c3aed";
      ctx.font = "bold 10px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(isPlaying ? "LIVE SPATIAL" : "STANDBY", centerX, centerY);

      ctx.restore();
      animationFrameRef.current = requestAnimationFrame(render);
    };

    animationFrameRef.current = requestAnimationFrame(render);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, bpm, visMode]);

  return (
    <div className="relative w-full overflow-hidden rounded-xl border border-[#2e2055] bg-[#000000] shadow-[0_0_24px_rgba(46,32,85,0.4)]">
      {/* Visualizer Top Bar */}
      <div className="absolute top-2.5 left-3 right-3 z-10 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 rounded-full bg-[#00ffa3] animate-pulse" />
          <span className="font-mono text-[10px] tracking-wider text-[#00ffa3] uppercase font-semibold">
            WebGL Spatial Audio Visualizer · 360° Field
          </span>
        </div>
        <div className="pointer-events-auto flex items-center gap-1.5 rounded-lg border border-[#2e2055] bg-[#120d24]/80 p-1 backdrop-blur-md">
          <button
            onClick={() => setVisMode("circular")}
            className={`flex items-center gap-1 rounded px-2 py-1 text-[10px] font-mono transition ${
              visMode === "circular"
                ? "bg-[#00ffa3]/20 text-[#00ffa3] border border-[#00ffa3]/40"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Disc className="h-3 w-3" /> Circular
          </button>
          <button
            onClick={() => setVisMode("radial_particles")}
            className={`flex items-center gap-1 rounded px-2 py-1 text-[10px] font-mono transition ${
              visMode === "radial_particles"
                ? "bg-[#00ffa3]/20 text-[#00ffa3] border border-[#00ffa3]/40"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Orbit className="h-3 w-3" /> Orbits
          </button>
          <button
            onClick={() => setVisMode("cyber_matrix")}
            className={`flex items-center gap-1 rounded px-2 py-1 text-[10px] font-mono transition ${
              visMode === "cyber_matrix"
                ? "bg-[#00ffa3]/20 text-[#00ffa3] border border-[#00ffa3]/40"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Sparkles className="h-3 w-3" /> Matrix
          </button>
        </div>
      </div>

      {/* High-Frame-Rate Canvas */}
      <canvas
        ref={canvasRef}
        className="h-44 w-full cursor-crosshair object-cover md:h-52"
      />

      {/* Visualizer Status Footer */}
      <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between pointer-events-none text-[9px] font-mono text-slate-400">
        <div className="flex items-center gap-3">
          <span>RES: 48kHz / 24-bit</span>
          <span className="hidden sm:inline">POLAR FFT: 256-BIN</span>
          <span className="text-[#00ffa3]">STATUS: {isPlaying ? "SYNCHRONIZED" : "ARMED"}</span>
        </div>
        <div className="flex items-center gap-1 text-[#00ffa3]">
          <Activity className="h-3 w-3 animate-pulse" />
          <span>{bpm} BPM STEREO PHASE</span>
        </div>
      </div>
    </div>
  );
}
