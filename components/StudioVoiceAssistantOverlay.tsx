"use client";

import { useState, useRef, useEffect } from "react";
import { useOrbEngine, orbEngineStore } from "@/lib/orbEngineStore";
import {
  Mic,
  MicOff,
  Send,
  X,
  Sparkles,
  Terminal,
  Activity,
  Layers,
  CheckCircle2,
  Cpu,
} from "lucide-react";

/* =========================================================================
   DARK MISFIT STUDIOS — OMNIAI - NEXUS: SLIDE-DOWN CONVERSATIONAL VOICE/CHAT
   Interactive Bridge with direct structural access to the studio context
========================================================================= */

// Contextual Quick Automation Actions per Studio Type
const STUDIO_AUTOMATIONS: Record<string, { label: string; prompt: string }[]> = {
  "OmniStyle Studio": [
    {
      label: "Erase Garment Background",
      prompt: "Hey Omni, erase the background on this garment using PyTorch BiRefNet.",
    },
    {
      label: "Equip Obsidian Palette",
      prompt: "Match garment palette to Neon Green #00ffa3 brand swatch.",
    },
    {
      label: "Consult Tri-Agent Council",
      prompt: "Request styling advisory from Strategist, Empath, and Ghost council.",
    },
  ],
  "OmniBeat Studio": [
    {
      label: "9-Step Music Video Blueprint",
      prompt: "Generate the full 9-step automation tracker for the uploaded audio track.",
    },
    {
      label: "Sync Cuts to BPM Grid",
      prompt: "Lock storyboard cut transitions to 128 BPM grid intervals.",
    },
    {
      label: "Toggle Safe Zones Overlay",
      prompt: "Project TikTok and Reels hazard safe zones over WebGL monitor.",
    },
  ],
  "Omni Storyboard": [
    {
      label: "Fragment Script into Scenes",
      prompt: "Analyze and fragment current script into scenes with dialogue separation.",
    },
    {
      label: "Engage Character Symmetry Lock",
      prompt: "Lock vector facial traits across all 5 reference portrait anchors.",
    },
    {
      label: "Inject Camera Vectors",
      prompt: "Auto-inject orbital tracking shots and neon rim light vectors.",
    },
  ],
  "Video Studio": [
    {
      label: "Snap Clips to 0.5s Grid",
      prompt: "Snap all video timeline clips to 0.5s intervals automatically.",
    },
    {
      label: "Export Master WAV (48kHz)",
      prompt: "Dispatch master 48kHz / 24-bit PCM WAV audio export.",
    },
  ],
  "Universal Matrix": [
    {
      label: "Run Local Diagnostics",
      prompt: "Audit active Ollama node array and LPU mock latency.",
    },
    {
      label: "Sync Long-Term Memory",
      prompt: "Fetch Dark Misfit Studios emotional anchors and aesthetic profile.",
    },
  ],
};

export default function StudioVoiceAssistantOverlay() {
  const { isOverlayOpen, state, latencyMs, activeStudioContext, messages, audioFrequencies, isListening } =
    useOrbEngine();
  const [inputText, setInputText] = useState("");
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages]);

  if (!isOverlayOpen) return null;

  const quickActions =
    STUDIO_AUTOMATIONS[activeStudioContext] || STUDIO_AUTOMATIONS["Universal Matrix"];

  const handleSend = (text?: string) => {
    const query = text || inputText;
    if (!query.trim()) return;
    orbEngineStore.executeStudioCommand(query);
    setInputText("");
  };

  const toggleMic = () => {
    if (!isListening) {
      orbEngineStore.setListening(true);
      // Simulate voice capture
      setTimeout(() => {
        orbEngineStore.setListening(false);
        handleSend("Hey Omni, execute dark aesthetic neural pipeline for this workspace.");
      }, 2400);
    } else {
      orbEngineStore.setListening(false);
    }
  };

  return (
    <div className="fixed inset-x-0 top-14 z-50 flex justify-center px-4 animate-in slide-in-from-top-6 duration-300">
      {/* Slide-Down Glass Panel */}
      <div className={`w-full max-w-4xl rounded-2xl border bg-[#0e0a1c]/95 backdrop-blur-2xl shadow-[0_25px_70px_rgba(0,0,0,0.9)] overflow-hidden flex flex-col transition-colors duration-300 ${
        state === "thinking" ? "border-[#FF003C]/70 shadow-[0_0_40px_rgba(255,0,60,0.25)]" : "border-[#00D2FF]/40 shadow-[0_0_35px_rgba(0,210,255,0.15)]"
      }`}>
        {/* Header Bar */}
        <div className="flex items-center justify-between border-b border-[#2e2055] px-4 py-3 bg-[#120d24]">
          <div className="flex items-center gap-3">
            <div className={`flex h-7 w-7 items-center justify-center rounded-lg border ${
              state === "thinking"
                ? "border-[#FF003C]/70 bg-[#FF003C]/20 text-[#FF003C]"
                : "border-[#00D2FF]/60 bg-[#00D2FF]/15 text-[#00D2FF]"
            }`}>
              <Terminal className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm text-white">OmniAI Studio Assistant</span>
                <span className={`rounded-full border px-2 py-0.5 font-mono text-[9px] font-bold ${
                  state === "thinking"
                    ? "border-[#FF003C] bg-[#FF003C]/20 text-[#FF003C] animate-pulse"
                    : state === "talking"
                    ? "border-[#00D2FF] bg-[#00D2FF]/20 text-[#00D2FF]"
                    : "border-[#00D2FF]/40 bg-[#00D2FF]/10 text-[#00D2FF]"
                }`}>
                  {state.toUpperCase()} {" // "} LPU {latencyMs.toFixed(1)}ms
                </span>
              </div>
              <p className="font-mono text-[10px] text-slate-400">
                Connected Context: <span className={state === "thinking" ? "text-[#FF003C] font-semibold" : "text-[#00D2FF] font-semibold"}>{activeStudioContext}</span>
              </p>
            </div>
          </div>

          <button
            onClick={() => orbEngineStore.setOverlayOpen(false)}
            className="rounded-lg p-1.5 text-slate-400 hover:text-white hover:bg-[#1f173b] transition"
            title="Close Assistant"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Quick Action Chips (Contextual to the current studio) */}
        <div className="flex items-center gap-2 overflow-x-auto px-4 py-2 bg-black/40 border-b border-[#2e2055]/50">
          <span className="font-mono text-[9px] uppercase tracking-wider text-slate-400 shrink-0">
            QUICK AUTOMATIONS:
          </span>
          {quickActions.map((action, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(action.prompt)}
              className="shrink-0 flex items-center gap-1 rounded-lg border border-[#1f1638] bg-[#0a071b] px-2.5 py-1 font-mono text-[10px] text-slate-300 hover:border-[#6366f1] hover:text-[#00ffcc] transition"
            >
              <Sparkles className="h-2.5 w-2.5 text-[#00ffcc]" />
              <span>{action.label}</span>
            </button>
          ))}
        </div>

        {/* Conversation Message Stream */}
        <div
          ref={chatScrollRef}
          className="max-h-[260px] overflow-y-auto p-4 space-y-3 font-mono text-xs"
        >
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${
                msg.sender === "user" ? "items-end" : "items-start"
              }`}
            >
              <div
                className={`max-w-[85%] rounded-xl px-3.5 py-2.5 shadow-md ${
                  msg.sender === "user"
                    ? "bg-[#6366f1] text-white border border-[#6366f1] shadow-[0_0_15px_rgba(99,102,241,0.3)]"
                    : "bg-[#0a071b] text-slate-200 border border-[#1f1638]"
                }`}
              >
                <div className="flex items-center gap-2 mb-1 opacity-75 text-[9px]">
                  <span className="font-bold text-white">{msg.sender === "user" ? "CREATIVE DIRECTOR" : "OMNIAI - NEXUS CORE"}</span>
                  <span>·</span>
                  <span>{new Date(msg.timestamp).toLocaleTimeString()}</span>
                </div>
                <p className="leading-relaxed">{msg.text}</p>

                {/* Real-time Call Response Pills (Vibrant Neon Green #00ffcc) */}
                {msg.actionExecuted && (
                  <div className="mt-2 flex items-center gap-1.5 rounded-lg border border-[#00ffcc]/50 bg-[#00ffcc]/15 px-2.5 py-1 text-[10px] font-bold text-[#00ffcc] shadow-[0_0_10px_rgba(0,255,204,0.25)]">
                    <CheckCircle2 className="h-3 w-3 text-[#00ffcc]" />
                    <span>RESPONSE: {msg.actionExecuted}</span>
                  </div>
                )}
              </div>
            </div>
          ))}

          {state === "thinking" && (
            <div className="flex items-center gap-2 text-[#00ffcc] text-[11px] font-mono">
              <span className="h-2 w-2 rounded-full bg-[#00ffcc] shadow-[0_0_8px_#00ffcc] animate-ping" />
              <span>Routing through local Ollama &amp; Python automation nodes…</span>
            </div>
          )}
        </div>

        {/* Real-time Audio Reactive Visualizer Ribbon */}
        {state === "talking" && (
          <div className="flex items-center justify-center gap-1 px-4 py-1.5 bg-[#0a071b] border-t border-[#1f1638]">
            <span className="font-mono text-[9px] text-[#00ffcc] mr-2 font-bold">VOICE SYNTHESIS:</span>
            {audioFrequencies.map((f, i) => (
              <span
                key={i}
                className="w-1 rounded-full bg-[#00ffcc] shadow-[0_0_6px_#00ffcc]"
                style={{ height: `${Math.max(4, f * 18)}px` }}
              />
            ))}
          </div>
        )}

        {/* Command Input Deck */}
        <div className="flex items-center gap-2 p-3 bg-[#000000] border-t border-[#1f1638]">
          <button
            onClick={toggleMic}
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition ${
              isListening
                ? "border-[#6366f1] bg-[#6366f1]/20 text-[#00ffcc] animate-pulse shadow-[0_0_15px_rgba(99,102,241,0.5)]"
                : "border-[#1f1638] bg-[#0a071b] text-slate-300 hover:border-[#6366f1] hover:text-[#00ffcc]"
            }`}
            title={isListening ? "Listening… (Tap to Stop)" : "Tap to Speak Voice Command"}
          >
            {isListening ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
          </button>

          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSend();
            }}
            placeholder={`Instruct OmniAI in ${activeStudioContext}… (e.g. 'erase background', 'snap clips to 0.5s')`}
            className="flex-1 rounded-xl border border-[#1f1638] bg-[#0a071b] px-3.5 py-2 font-mono text-xs text-white placeholder-slate-500 focus:border-[#6366f1] focus:ring-1 focus:ring-[#6366f1] focus:outline-none"
          />

          <button
            onClick={() => handleSend()}
            disabled={!inputText.trim()}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#6366f1] bg-[#6366f1] text-white font-bold transition hover:bg-[#7579f3] shadow-[0_0_15px_rgba(99,102,241,0.35)] disabled:opacity-30 disabled:border-[#1f1638] disabled:bg-[#0a071b] disabled:text-slate-500"
            title="Dispatch Command"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
