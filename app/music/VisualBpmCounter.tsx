"use client";

import { useEffect, useState } from "react";
import { Activity, Minus, Plus } from "lucide-react";

interface VisualBpmCounterProps {
  bpm: number;
  isPlaying: boolean;
  onBpmChange: (newBpm: number) => void;
  onTapTempo: () => void;
}

export default function VisualBpmCounter({
  bpm,
  isPlaying,
  onBpmChange,
  onTapTempo,
}: VisualBpmCounterProps) {
  const [currentBeat, setCurrentBeat] = useState<number>(0);

  // Sync real-time visual beat pulse to the audio engine's tempo
  useEffect(() => {
    const intervalMs = (60 / Math.max(40, Math.min(240, bpm))) * 1000;
    const interval = setInterval(() => {
      setCurrentBeat((b) => (b + 1) % 4);
    }, intervalMs);

    return () => clearInterval(interval);
  }, [bpm]);

  // Tempo classification descriptor
  const getTempoLabel = (b: number) => {
    if (b < 80) return "Largo / Chill";
    if (b < 105) return "Andante / Dark";
    if (b < 125) return "Synthwave / Groove";
    if (b < 145) return "Club / Cyberpunk";
    return "High-Speed / Phonk";
  };

  return (
    <div className="flex items-center gap-2 rounded-xl border border-[#2e2055] bg-[#120d24] px-2.5 py-1 shadow-[0_0_15px_rgba(46,32,85,0.4)]">
      {/* Visual Metronome Icon with Glowing Pulse */}
      <div
        className={`relative flex h-7 w-7 items-center justify-center rounded-lg border transition-all duration-75 ${
          isPlaying
            ? currentBeat === 0
              ? "border-[#00ffa3] bg-[#00ffa3]/25 shadow-[0_0_12px_#00ffa3]"
              : "border-[#00ffa3]/40 bg-[#00ffa3]/10"
            : "border-[#2e2055] bg-[#1a1236]"
        }`}
      >
        <Activity
          className={`h-4 w-4 transition-transform ${
            currentBeat === 0 ? "scale-110 text-[#00ffa3]" : "text-slate-400"
          }`}
        />
        {isPlaying && (
          <span
            className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-[#00ffa3] animate-ping"
            style={{ animationDuration: `${(60 / bpm) * 1000}ms` }}
          />
        )}
      </div>

      {/* Numerical BPM Display */}
      <div className="flex flex-col">
        <div className="flex items-baseline gap-1">
          <span className="font-mono text-sm font-black tracking-tight text-[#00ffa3] drop-shadow-[0_0_8px_rgba(0,255,163,0.3)]">
            {bpm}
          </span>
          <span className="font-mono text-[9px] font-bold text-slate-400 uppercase">
            BPM
          </span>
        </div>
        <span className="font-mono text-[8px] text-slate-400 truncate max-w-[85px]">
          {getTempoLabel(bpm)}
        </span>
      </div>

      {/* 4-Beat Real-Time LED Pulse Ticks */}
      <div className="flex items-center gap-1 px-1">
        {[0, 1, 2, 3].map((b) => {
          const isDownbeat = b === 0;
          const isActive = isPlaying && currentBeat === b;
          return (
            <div
              key={b}
              className={`rounded-full transition-all duration-100 ${
                isDownbeat ? "h-2 w-2" : "h-1.5 w-1.5"
              } ${
                isActive
                  ? isDownbeat
                    ? "bg-[#00ffa3] shadow-[0_0_8px_#00ffa3] scale-125"
                    : "bg-[#00f2fe] shadow-[0_0_6px_#00f2fe] scale-110"
                  : isDownbeat
                  ? "bg-[#2e2055]"
                  : "bg-slate-800"
              }`}
            />
          );
        })}
      </div>

      {/* Interactive Nudge & Tap Controls */}
      <div className="flex items-center gap-0.5 border-l border-[#2e2055] pl-1.5">
        <button
          onClick={() => onBpmChange(Math.max(40, bpm - 1))}
          title="Decrease BPM (-1)"
          className="rounded p-1 text-slate-400 hover:bg-[#1f1640] hover:text-white transition"
        >
          <Minus className="h-3 w-3" />
        </button>
        <button
          onClick={onTapTempo}
          title="Tap Tempo"
          className="rounded px-1.5 py-0.5 font-mono text-[9px] font-bold text-[#00ffa3] bg-[#00ffa3]/10 border border-[#00ffa3]/30 hover:bg-[#00ffa3]/25 transition"
        >
          TAP
        </button>
        <button
          onClick={() => onBpmChange(Math.min(240, bpm + 1))}
          title="Increase BPM (+1)"
          className="rounded p-1 text-slate-400 hover:bg-[#1f1640] hover:text-white transition"
        >
          <Plus className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
