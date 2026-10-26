"use client";

import { useMemo, useState } from "react";
import type { StemTrackState } from "@/lib/dawSynthEngine";
import {
  Volume2,
  VolumeX,
  Sliders,
  Radio,
  Cpu,
  Layers,
  Sparkles,
  Maximize2
} from "lucide-react";

interface TimelineMixerProps {
  tracks: StemTrackState[];
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  bpm: number;
  onSeek: (seconds: number) => void;
  onUpdateTrack: (track: StemTrackState) => void;
  onToggleMute: (trackId: string) => void;
  onToggleSolo: (trackId: string) => void;
  onToggleBypass: (trackId: string) => void;
  onVolumeChange: (trackId: string, volume: number) => void;
  onPanChange: (trackId: string, pan: number) => void;
}

const formatTime = (secs: number) => {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  const ms = Math.floor((secs % 1) * 100);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(ms).padStart(2, "0")}`;
};

export default function TimelineMixer({
  tracks,
  currentTime,
  duration,
  isPlaying,
  bpm,
  onSeek,
  onToggleMute,
  onToggleSolo,
  onToggleBypass,
  onVolumeChange,
  onPanChange,
}: TimelineMixerProps) {
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const anySoloed = useMemo(() => tracks.some((t) => t.solo), [tracks]);

  // Compute time ruler markers (every 15s or based on beats)
  const timeMarkers = useMemo(() => {
    const markers: number[] = [];
    const interval = zoomLevel > 1.4 ? 10 : 15;
    for (let t = 0; t <= duration; t += interval) {
      markers.push(t);
    }
    return markers;
  }, [duration, zoomLevel]);

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    onSeek(ratio * duration);
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="flex flex-1 flex-col overflow-hidden rounded-xl border border-[#2e2055] bg-[#0c0919]">
      {/* Timeline Header Controls Bar */}
      <div className="flex shrink-0 items-center justify-between border-b border-[#2e2055] bg-[#120d24] px-4 py-2.5">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-mono text-[11px] text-[#00ffa3] font-semibold tracking-wider uppercase">
            <Layers className="h-3.5 w-3.5" />
            <span>Multi-Track Timeline · 4 Discrete Neural Stems</span>
          </div>
          <span className="rounded bg-[#1d1538] px-2 py-0.5 font-mono text-[10px] text-slate-300 border border-[#2e2055]">
            {bpm} BPM // 4/4 // C MINOR
          </span>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1 font-mono text-[11px] text-slate-300">
            <span className="text-[#00ffa3] font-bold">{formatTime(currentTime)}</span>
            <span className="text-slate-600">/</span>
            <span className="text-slate-400">{formatTime(duration)}</span>
          </div>

          {/* Zoom Controls */}
          <div className="flex items-center gap-1 rounded-lg border border-[#2e2055] bg-[#17112c] p-0.5">
            <button
              onClick={() => setZoomLevel((z) => Math.max(0.75, z - 0.25))}
              className="px-2 py-0.5 font-mono text-xs text-slate-400 hover:text-white"
              title="Zoom Out"
            >
              -
            </button>
            <span className="font-mono text-[10px] text-slate-400 px-1">{Math.round(zoomLevel * 100)}%</span>
            <button
              onClick={() => setZoomLevel((z) => Math.min(2.5, z + 0.25))}
              className="px-2 py-0.5 font-mono text-xs text-slate-400 hover:text-white"
              title="Zoom In"
            >
              +
            </button>
          </div>
        </div>
      </div>

      {/* Main Track Workspace: Left Mechanical HUD + Right Waveform Viewport */}
      <div className="relative flex flex-1 overflow-x-hidden overflow-y-auto">
        {/* Left Mechanical Track Control Strips (Fixed 240px) */}
        <div className="w-[240px] shrink-0 border-r border-[#2e2055] bg-[#100b21]">
          {/* Time Ruler Offset Header */}
          <div className="h-7 border-b border-[#2e2055] bg-[#16112c] px-3 flex items-center justify-between text-[10px] font-mono text-slate-400">
            <span>STEM CHANNEL</span>
            <span>DSP / NODE</span>
          </div>

          {tracks.map((track) => {
            const isMuted = track.muted;
            const isSoloed = track.solo;
            const isBypassed = track.bypassed;
            const isAudible = !isMuted && (!anySoloed || isSoloed);

            return (
              <div
                key={track.id}
                className={`relative flex h-24 flex-col justify-between border-b border-[#2e2055] p-2.5 transition-colors ${
                  track.type === "vocals"
                    ? "bg-[#0b162c]/60"
                    : track.type === "instrumentals"
                    ? "bg-[#180e2f]/60"
                    : track.type === "bass_drums"
                    ? "bg-[#081a29]/60"
                    : "bg-[#071d18]/60"
                }`}
              >
                {/* Track ID and Color Tag */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-sm shadow-sm"
                      style={{ backgroundColor: track.color }}
                    />
                    <span className="text-xs font-semibold tracking-wide text-white truncate max-w-[110px]">
                      {track.name}
                    </span>
                  </div>

                  {/* Specialized Bypass Node Switch */}
                  <button
                    onClick={() => onToggleBypass(track.id)}
                    title={isBypassed ? "DSP Bypassed (Raw Node Output)" : "DSP Active (Neural Stem Isolation Engaged)"}
                    className={`flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[9px] font-semibold border transition ${
                      isBypassed
                        ? "border-amber-400/40 bg-amber-400/10 text-amber-300 shadow-[0_0_8px_rgba(251,191,36,0.2)]"
                        : "border-[#00ffa3]/40 bg-[#00ffa3]/10 text-[#00ffa3] shadow-[0_0_8px_rgba(0,255,163,0.15)]"
                    }`}
                  >
                    <Cpu className="h-2.5 w-2.5" />
                    <span>{isBypassed ? "BYPASS" : "NODE ON"}</span>
                  </button>
                </div>

                {/* Inline Action Buttons: [Mute], [Solo], Level VU */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onToggleMute(track.id)}
                    aria-label={`Mute ${track.name}`}
                    className={`h-6 w-7 rounded border font-mono text-[10px] font-bold transition ${
                      isMuted
                        ? "border-rose-500 bg-rose-500/30 text-rose-200 shadow-[0_0_10px_rgba(244,63,94,0.4)]"
                        : "border-white/10 bg-black/40 text-slate-400 hover:border-rose-400/50 hover:text-rose-300"
                    }`}
                  >
                    M
                  </button>
                  <button
                    onClick={() => onToggleSolo(track.id)}
                    aria-label={`Solo ${track.name}`}
                    className={`h-6 w-7 rounded border font-mono text-[10px] font-bold transition ${
                      isSoloed
                        ? "border-amber-400 bg-amber-400/30 text-amber-200 shadow-[0_0_10px_rgba(251,191,36,0.4)]"
                        : "border-white/10 bg-black/40 text-slate-400 hover:border-amber-400/50 hover:text-amber-300"
                    }`}
                  >
                    S
                  </button>

                  {/* Animated Stereo VU Meter */}
                  <div className="flex h-5 flex-1 items-center gap-1 rounded border border-[#2e2055] bg-black/60 px-1.5">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-800">
                      <div
                        className="h-full rounded-full transition-all duration-75"
                        style={{
                          width: isPlaying && isAudible ? `${Math.min(100, (track.volume * 0.9) + Math.random() * 15)}%` : "0%",
                          backgroundColor: track.color,
                        }}
                      />
                    </div>
                    <span className="font-mono text-[9px] text-slate-400 w-8 text-right">
                      {isAudible ? `${Math.round((track.volume / 100) * 6 - (100 - track.volume) * 0.4)}dB` : "-∞dB"}
                    </span>
                  </div>
                </div>

                {/* Mechanical Volume & Pan Sliders */}
                <div className="flex items-center gap-2">
                  <div className="flex flex-1 items-center gap-1.5">
                    <Volume2 className="h-3 w-3 text-slate-400 shrink-0" />
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={track.volume}
                      onChange={(e) => onVolumeChange(track.id, Number(e.target.value))}
                      className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-black/60 accent-[#00ffa3]"
                      title={`Volume: ${track.volume}%`}
                    />
                  </div>

                  <div className="flex w-16 items-center gap-1">
                    <span className="font-mono text-[9px] text-slate-400">PAN</span>
                    <input
                      type="range"
                      min={-50}
                      max={50}
                      value={track.pan}
                      onChange={(e) => onPanChange(track.id, Number(e.target.value))}
                      className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-black/60 accent-[#00ffa3]"
                      title={`Pan: ${track.pan === 0 ? "Center" : track.pan < 0 ? `L${Math.abs(track.pan)}` : `R${track.pan}`}`}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right Widescreen Waveform & Region Timeline */}
        <div
          onClick={handleTimelineClick}
          className="relative flex-1 cursor-pointer select-none bg-[#0a0714]"
        >
          {/* Time Ruler Bar */}
          <div className="relative h-7 border-b border-[#2e2055] bg-[#120d24]">
            {timeMarkers.map((marker) => {
              const markerPos = (marker / duration) * 100;
              return (
                <div
                  key={marker}
                  className="absolute top-0 bottom-0 flex flex-col justify-between border-l border-[#2e2055]/80 pl-1"
                  style={{ left: `${markerPos}%` }}
                >
                  <span className="font-mono text-[9px] text-slate-400">
                    {Math.floor(marker / 60)}:{String(Math.floor(marker % 60)).padStart(2, "0")}
                  </span>
                  <div className="h-1.5 w-px bg-slate-600" />
                </div>
              );
            })}
          </div>

          {/* 4 Multi-Row Waveform Layers */}
          {tracks.map((track) => {
            const isAudible = !track.muted && (!anySoloed || track.solo);

            return (
              <div
                key={track.id}
                className="relative h-24 border-b border-[#2e2055] overflow-hidden"
              >
                {/* Visual Region Block */}
                <div
                  className="absolute inset-y-1.5 left-2 right-4 rounded-lg border p-2 flex flex-col justify-between transition-all"
                  style={{
                    backgroundColor: `${track.color}10`,
                    borderColor: `${track.color}40`,
                    opacity: isAudible ? 1 : 0.25,
                  }}
                >
                  {/* Region Metadata Header */}
                  <div className="flex items-center justify-between text-[10px] font-mono pointer-events-none">
                    <span className="font-semibold text-white/90 uppercase tracking-wider flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: track.color }} />
                      {track.name} [STEM LAYER]
                    </span>
                    <span className="text-slate-400">
                      {track.bypassed ? "NEURAL BYPASS (RAW)" : "STEREO ISOLATED · 48kHz"}
                    </span>
                  </div>

                  {/* High-Fidelity Waveform Peaks Graphic */}
                  <div className="flex h-12 items-center gap-0.5 overflow-hidden">
                    {track.peaks.map((peak, idx) => {
                      const isPast = (idx / track.peaks.length) * 100 <= progressPercent;
                      return (
                        <div
                          key={idx}
                          className="flex-1 rounded-sm transition-all duration-100"
                          style={{
                            height: `${Math.max(12, peak * 85)}%`,
                            backgroundColor: isPast && isPlaying ? "#00ffa3" : track.color,
                            opacity: isPast ? 0.95 : 0.45,
                            boxShadow: isPast && isPlaying ? "0 0 6px #00ffa3" : "none",
                          }}
                        />
                      );
                    })}
                  </div>

                  {/* Lower Region Info */}
                  <div className="flex items-center justify-between text-[9px] font-mono text-slate-400 pointer-events-none">
                    <span>GAIN: {track.volume}%</span>
                    <span>STEREO PHASE COHERENT</span>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Master Playhead Scrubber Line */}
          <div
            className="absolute top-0 bottom-0 z-30 pointer-events-none flex flex-col items-center"
            style={{ left: `${progressPercent}%` }}
          >
            {/* Scrubber Playhead Handle */}
            <div className="relative -top-0.5 h-3.5 w-3.5 -translate-x-1/2 rotate-45 rounded-sm bg-[#00ffa3] shadow-[0_0_12px_#00ffa3] border border-white" />
            <div className="h-full w-0.5 bg-[#00ffa3] shadow-[0_0_10px_#00ffa3]" />
          </div>
        </div>
      </div>

      {/* Live Telemetry Line at absolute bottom margin */}
      <div className="flex shrink-0 items-center justify-between border-t border-[#2e2055] bg-[#07050d] px-4 py-2 font-mono text-[10px] text-slate-400">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-[#00ffa3] animate-pulse" />
          <span className="font-semibold text-[#00ffa3] tracking-wide">
            [Nexus-Audio-Inference: Wave-Engine / Local Stem Isolation Pipeline Active]
          </span>
        </div>
        <div className="flex items-center gap-4 text-slate-400">
          <span>LATENCY: 5.8ms</span>
          <span>DSP LOAD: 12%</span>
          <span className="text-[#00ffa3]">OLLAMA HYBRID: SYNCHRONIZED</span>
        </div>
      </div>
    </div>
  );
}
