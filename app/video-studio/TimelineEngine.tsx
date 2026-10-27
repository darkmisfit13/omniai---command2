"use client";

import { useMemo, useRef, useState, useCallback } from "react";
import {
  Film,
  Layers,
  Subtitles,
  Volume2,
  VolumeX,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Scissors,
  Trash2,
  Magnet,
  Maximize2,
  ZoomIn,
  ZoomOut,
  Sparkles,
  ChevronRight,
  MoveHorizontal
} from "lucide-react";

export interface TimelineClip {
  id: string;
  trackId: "video1" | "video2" | "captions" | "audio";
  title: string;
  startTime: number; // in seconds
  duration: number; // in seconds
  sourceUrl?: string;
  color?: string;
  text?: string;
  wavePeaks?: number[];
}

export interface TrackConfig {
  id: "video1" | "video2" | "captions" | "audio";
  name: string;
  type: "video" | "overlay" | "captions" | "audio";
  color: string;
  muted: boolean;
  locked: boolean;
  opacity: number;
}

interface TimelineEngineProps {
  clips: TimelineClip[];
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  onSeek: (seconds: number) => void;
  onSelectClip: (clip: TimelineClip | null) => void;
  selectedClipId: string | null;
  onSplitClip: (clipId: string, splitTime: number) => void;
  onDeleteClip: (clipId: string) => void;
  onUpdateClipTime: (clipId: string, newStart: number, newDuration: number) => void;
  snapToGrid: boolean;
  magneticMode: boolean;
  beatSync?: boolean;
  bpm?: number;
}

const TRACKS_METADATA: TrackConfig[] = [
  {
    id: "video1",
    name: "Video Track 01 (Primary)",
    type: "video",
    color: "#0C00CA",
    muted: false,
    locked: false,
    opacity: 100,
  },
  {
    id: "video2",
    name: "Overlay Video 02 (B-Roll)",
    type: "overlay",
    color: "#3d2cf5",
    muted: false,
    locked: false,
    opacity: 85,
  },
  {
    id: "captions",
    name: "Captions / Subtitles",
    type: "captions",
    color: "#00ffff",
    muted: false,
    locked: false,
    opacity: 100,
  },
  {
    id: "audio",
    name: "Audio Sound Track",
    type: "audio",
    color: "#00ffff",
    muted: false,
    locked: false,
    opacity: 100,
  },
];

export default function TimelineEngine({
  clips,
  currentTime,
  duration,
  isPlaying,
  onSeek,
  onSelectClip,
  selectedClipId,
  onSplitClip,
  onDeleteClip,
  onUpdateClipTime,
  snapToGrid,
  magneticMode,
  beatSync = true,
  bpm = 128,
}: TimelineEngineProps) {
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [trackConfigs, setTrackConfigs] = useState<TrackConfig[]>(TRACKS_METADATA);
  const timelineBodyRef = useRef<HTMLDivElement | null>(null);

  // Musical Beat Grid Interval: 60 / BPM in seconds
  const beatInterval = useMemo(() => 60 / (bpm > 0 ? bpm : 128), [bpm]);

  // Dragging / Trimming Clip state
  const [activeDrag, setActiveDrag] = useState<{
    clipId: string;
    mode: "move" | "trim_left" | "trim_right";
    startX: number;
    origStart: number;
    origDuration: number;
  } | null>(null);

  // Time markers on ruler (e.g. Every 10s or 5s depending on zoom)
  const timeMarkers = useMemo(() => {
    const markers: number[] = [];
    const step = zoomLevel > 1.4 ? 5 : 10;
    for (let t = 0; t <= duration; t += step) {
      markers.push(t);
    }
    return markers;
  }, [duration, zoomLevel]);

  // Detected BPM Beat Markers
  const beatMarkers = useMemo(() => {
    if (!beatSync) return [];
    const markers: { time: number; isDownbeat: boolean }[] = [];
    let beatIdx = 0;
    for (let t = 0; t <= duration; t += beatInterval) {
      markers.push({ time: t, isDownbeat: beatIdx % 4 === 0 });
      beatIdx++;
    }
    return markers;
  }, [duration, beatInterval, beatSync]);

  // Handle timeline ruler / body click to seek
  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (activeDrag) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    onSeek(ratio * duration);
  };

  // Toggle track mute / lock
  const handleToggleMute = (trackId: string) => {
    setTrackConfigs((prev) =>
      prev.map((t) => (t.id === trackId ? { ...t, muted: !t.muted } : t))
    );
  };

  const handleToggleLock = (trackId: string) => {
    setTrackConfigs((prev) =>
      prev.map((t) => (t.id === trackId ? { ...t, locked: !t.locked } : t))
    );
  };

  // Drag Handlers
  const handleClipMouseDown = (
    e: React.MouseEvent,
    clip: TimelineClip,
    mode: "move" | "trim_left" | "trim_right"
  ) => {
    e.stopPropagation();
    onSelectClip(clip);

    setActiveDrag({
      clipId: clip.id,
      mode,
      startX: e.clientX,
      origStart: clip.startTime,
      origDuration: clip.duration,
    });
  };

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!activeDrag || !timelineBodyRef.current) return;

      const rect = timelineBodyRef.current.getBoundingClientRect();
      const deltaX = e.clientX - activeDrag.startX;
      const secondsPerPixel = duration / rect.width;
      const deltaSec = deltaX * secondsPerPixel;

      let newStart = activeDrag.origStart;
      let newDuration = activeDrag.origDuration;

      if (activeDrag.mode === "move") {
        newStart = Math.max(0, Math.min(duration - newDuration, activeDrag.origStart + deltaSec));
        if (beatSync) {
          // Snap precisely to detected BPM grid
          newStart = Math.round(newStart / beatInterval) * beatInterval;
        } else if (snapToGrid) {
          newStart = Math.round(newStart * 2) / 2; // snap to 0.5s intervals
        }
      } else if (activeDrag.mode === "trim_left") {
        let potentialStart = Math.max(0, activeDrag.origStart + deltaSec);
        if (beatSync) {
          potentialStart = Math.round(potentialStart / beatInterval) * beatInterval;
        } else if (snapToGrid) {
          potentialStart = Math.round(potentialStart * 2) / 2;
        }
        const change = potentialStart - activeDrag.origStart;
        if (activeDrag.origDuration - change >= 0.25) {
          newStart = potentialStart;
          newDuration = activeDrag.origDuration - change;
        }
      } else if (activeDrag.mode === "trim_right") {
        let potentialDur = Math.max(0.25, Math.min(duration - activeDrag.origStart, activeDrag.origDuration + deltaSec));
        if (beatSync) {
          const snappedEnd = Math.round((activeDrag.origStart + potentialDur) / beatInterval) * beatInterval;
          potentialDur = Math.max(beatInterval, snappedEnd - activeDrag.origStart);
        } else if (snapToGrid) {
          const snappedEnd = Math.round((activeDrag.origStart + potentialDur) * 2) / 2;
          potentialDur = Math.max(0.5, snappedEnd - activeDrag.origStart);
        }
        newDuration = potentialDur;
      }

      onUpdateClipTime(activeDrag.clipId, newStart, newDuration);
    },
    [activeDrag, duration, onUpdateClipTime, beatSync, snapToGrid, beatInterval]
  );

  const handleMouseUp = () => {
    setActiveDrag(null);
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      className="flex h-full w-full flex-col overflow-hidden bg-[#0a0714]"
    >
      {/* Sequencer Track Headers & Timeline Workspace */}
      <div className="relative flex flex-1 overflow-hidden select-none">
        {/* Left Track Headers Column (Fixed 240px) */}
        <div className="w-[240px] shrink-0 border-r border-[#2e2055] bg-[#0c0819] flex flex-col z-20">
          {/* Header Time Ruler aligner */}
          <div className="h-7 border-b border-[#2e2055] bg-[#120d24] px-3 flex items-center justify-between font-mono text-[9px] text-slate-400">
            <span>TRACK SEQUENCER</span>
            <span>SYNC LOCK</span>
          </div>

          {/* 4 Discrete Track Configuration Headers */}
          {trackConfigs.map((track) => (
            <div
              key={track.id}
              className="flex h-16 items-center justify-between border-b border-[#2e2055] px-3 bg-[#100b21]/90"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="h-2.5 w-2.5 rounded-sm shrink-0 shadow-sm"
                  style={{ backgroundColor: track.color }}
                />
                <div className="min-w-0">
                  <span className="block truncate text-xs font-semibold text-white tracking-wide">
                    {track.name}
                  </span>
                  <span className="text-[9px] font-mono text-slate-400 uppercase">
                    {track.type}
                  </span>
                </div>
              </div>

              {/* Action Buttons: Mute/Hide & Lock */}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => handleToggleMute(track.id)}
                  className={`rounded p-1 text-[10px] transition ${
                    track.muted
                      ? "text-rose-400 bg-rose-500/10 border border-rose-500/30"
                      : "text-slate-400 hover:text-white"
                  }`}
                  title={track.muted ? "Unmute Track" : "Mute Track"}
                >
                  {track.type === "audio" ? (
                    track.muted ? <VolumeX className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />
                  ) : (
                    track.muted ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />
                  )}
                </button>

                <button
                  onClick={() => handleToggleLock(track.id)}
                  className={`rounded p-1 text-[10px] transition ${
                    track.locked
                      ? "text-amber-400 bg-amber-500/10 border border-amber-500/30"
                      : "text-slate-400 hover:text-white"
                  }`}
                  title={track.locked ? "Unlock Track" : "Lock Track"}
                >
                  {track.locked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Right Multi-Row Timeline Grid */}
        <div
          ref={timelineBodyRef}
          onClick={handleTimelineClick}
          className="relative flex-1 cursor-pointer bg-[#000000] overflow-x-hidden overflow-y-auto"
        >
          {/* Top SMPTE Time Ruler & Musical Beat Counter */}
          <div className="relative h-7 border-b border-[#2e2055] bg-[#120d24]">
            {/* Standard Time Markers */}
            {timeMarkers.map((marker) => {
              const markerPos = (marker / duration) * 100;
              return (
                <div
                  key={marker}
                  className="absolute top-0 bottom-0 flex flex-col justify-between border-l border-[#2e2055]/80 pl-1 pointer-events-none"
                  style={{ left: `${markerPos}%` }}
                >
                  <span className="font-mono text-[9px] text-slate-400">
                    {Math.floor(marker / 60)}:{String(Math.floor(marker % 60)).padStart(2, "0")}
                  </span>
                  <div className="h-1.5 w-px bg-slate-600" />
                </div>
              );
            })}

            {/* Beat Grid Ruler Ticks when Beat-Sync is active */}
            {beatSync &&
              beatMarkers.map((bm, idx) => {
                const pos = (bm.time / duration) * 100;
                return (
                  <div
                    key={`beat-ruler-${idx}`}
                    className="absolute bottom-0 pointer-events-none flex flex-col items-center"
                    style={{ left: `${pos}%` }}
                  >
                    <div
                      className={`w-px ${
                        bm.isDownbeat
                          ? "h-3 bg-[#00ffa3] shadow-[0_0_6px_#00ffa3]"
                          : "h-1.5 bg-[#00D2FF]/40"
                      }`}
                    />
                  </div>
                );
              })}
          </div>

          {/* 4 Visible Horizontal Multi-Row Tracks */}
          {trackConfigs.map((track) => {
            const trackClips = clips.filter((c) => c.trackId === track.id);

            return (
              <div
                key={track.id}
                className="relative h-16 border-b border-[#2e2055] bg-[#07050d] transition-colors hover:bg-[#0c0919]"
              >
                {/* Visual Grid Guide Lines */}
                <div className="absolute inset-0 pointer-events-none opacity-20">
                  {timeMarkers.map((m) => (
                    <div
                      key={m}
                      className="absolute top-0 bottom-0 border-l border-white/10"
                      style={{ left: `${(m / duration) * 100}%` }}
                    />
                  ))}
                </div>

                {/* Beat-Sync Visual Grid Lines (Vertical ticks aligned to BPM) */}
                {beatSync && (
                  <div className="absolute inset-0 pointer-events-none">
                    {beatMarkers.map((bm, idx) => (
                      <div
                        key={`beat-grid-${idx}`}
                        className={`absolute top-0 bottom-0 border-l ${
                          bm.isDownbeat
                            ? "border-[#00ffa3]/25"
                            : "border-[#00D2FF]/10"
                        }`}
                        style={{ left: `${(bm.time / duration) * 100}%` }}
                      />
                    ))}
                  </div>
                )}

                {/* Clips Container */}
                {trackClips.map((clip) => {
                  const clipLeft = (clip.startTime / duration) * 100;
                  const clipWidth = (clip.duration / duration) * 100;
                  const isSelected = selectedClipId === clip.id;

                  return (
                    <div
                      key={clip.id}
                      onMouseDown={(e) => handleClipMouseDown(e, clip, "move")}
                      className={`absolute top-1.5 bottom-1.5 rounded-lg border px-2.5 py-1 flex items-center justify-between cursor-move overflow-hidden transition-all shadow-md group ${
                        isSelected
                          ? "border-[#00ffa3] shadow-[0_0_15px_rgba(0,255,163,0.4)] z-10"
                          : "border-white/10 hover:border-white/30"
                      } ${
                        track.id === "video1"
                          ? "bg-[#1e123d] text-purple-100" // Dark purple containers
                          : track.id === "video2"
                          ? "bg-[#2a174f]/70 text-purple-200 backdrop-blur-sm" // Translucent purple containers
                          : track.id === "captions"
                          ? "bg-[#00ffa3]/15 border-[#00ffa3]/60 text-[#00ffa3]" // Neon-green text block wrappers
                          : "bg-[#082032] border-[#00f2fe]/40 text-cyan-200" // Reactive audio wave blocks
                      }`}
                      style={{
                        left: `${clipLeft}%`,
                        width: `${clipWidth}%`,
                        minWidth: "36px",
                      }}
                    >
                      {/* Left Trim Handle */}
                      <div
                        onMouseDown={(e) => handleClipMouseDown(e, clip, "trim_left")}
                        className="absolute left-0 top-0 bottom-0 w-2 cursor-col-resize bg-black/40 hover:bg-[#00ffa3] transition-colors"
                      />

                      {/* Clip Label & Icon */}
                      <div className="flex items-center gap-1.5 min-w-0 pointer-events-none">
                        {track.id === "video1" && <Film className="h-3 w-3 text-purple-300 shrink-0" />}
                        {track.id === "video2" && <Layers className="h-3 w-3 text-purple-200 shrink-0" />}
                        {track.id === "captions" && <Subtitles className="h-3 w-3 text-[#00ffa3] shrink-0" />}
                        {track.id === "audio" && <Volume2 className="h-3 w-3 text-cyan-300 shrink-0" />}

                        <span className="truncate font-mono text-[10px] font-semibold">
                          {clip.text ? `"${clip.text}"` : clip.title}
                        </span>
                      </div>

                      {/* Synthetic Audio Waveform Graphic for Audio Track */}
                      {track.id === "audio" && (
                        <div className="absolute inset-y-1 right-3 left-28 flex items-center gap-0.5 opacity-60 pointer-events-none overflow-hidden">
                          {Array.from({ length: 32 }).map((_, i) => (
                            <div
                              key={i}
                              className="flex-1 bg-cyan-400 rounded-sm"
                              style={{ height: `${20 + ((i * 19 + Math.sin(i * 1.5) * 12) % 65)}%` }}
                            />
                          ))}
                        </div>
                      )}

                      {/* Duration Tag */}
                      <span className="font-mono text-[8px] text-white/50 shrink-0 pointer-events-none">
                        {clip.duration.toFixed(1)}s
                      </span>

                      {/* Right Trim Handle */}
                      <div
                        onMouseDown={(e) => handleClipMouseDown(e, clip, "trim_right")}
                        className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize bg-black/40 hover:bg-[#00ffa3] transition-colors"
                      />
                    </div>
                  );
                })}
              </div>
            );
          })}

          {/* Master Timeline Playhead Scrubber Line */}
          <div
            className="absolute top-0 bottom-0 z-30 pointer-events-none flex flex-col items-center"
            style={{ left: `${progressPercent}%` }}
          >
            {/* Playhead Handle */}
            <div className="relative -top-0.5 h-3.5 w-3.5 -translate-x-1/2 rotate-45 rounded-sm bg-[#00ffff] shadow-[0_0_12px_#00ffff] border border-white" />
            <div className="h-full w-0.5 bg-[#00ffff] shadow-[0_0_12px_#00ffff]" />
          </div>
        </div>
      </div>

      {/* System Telemetry Line at absolute bottom margin (Baby Blue #00ffff) */}
      <div className="flex h-7 shrink-0 items-center justify-between border-t border-[#1f1638] bg-[#000000] px-4 font-mono text-[10px] text-slate-400">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-[#00ffff] shadow-[0_0_8px_#00ffff] animate-pulse" />
          <span className="font-bold text-[#00ffff] tracking-wide">
            [Nexus-Inference: Max-Speed / Local-Ollama Override] · [WebCodecs Local-GPU Active]
          </span>
        </div>
        <div className="flex items-center gap-4 text-slate-400">
          <span>PIPELINE: <strong className="text-white">VULKAN/WEBGPU</strong></span>
          <span>LATENCY: <strong className="text-[#00ffff]">4.2ms</strong></span>
          <span className="text-[#00ffff] font-bold">WHISPER-LOCAL: ARMED</span>
        </div>
      </div>
    </div>
  );
}
