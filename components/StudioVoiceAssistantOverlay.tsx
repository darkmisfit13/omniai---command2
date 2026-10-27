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
   Absolute Black Cyberpunk: Pure Black #000000, Obsidian-Purple #0a071b,
   Purplish-Blue #0C00CA, Baby Blue #00ffff.
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
      prompt: "Match garment palette to Baby Blue #00ffff brand swatch.",
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
        handleSend("Hey Omni, execute absolute black cyberpunk neural pipeline for this workspace.");
      }, 2400);
    } else {
      orbEngineStore.setListening(false);
    }
  };

  return (
    <div className="fixed inset-x-0 top-14 z-50 flex justify-center px-4 animate-in slide-in-from-top-6 duration-300">
      {/* Slide-Down Glass Panel: Obsidian-Purple with Purplish-Blue boundary */}
      <div className={`w-full max-w-4xl rounded-2xl border bg-[#0a071b]/95 backdrop-blur-2xl shadow-[0_25px_70px_rgba(0,0,0,0.95)] overflow-hidden flex flex-col transition-colors duration-300 ${
        state === "thinking" ? "border-[#0C00CA] shadow-[0_0_35px_rgba(12,0,202,0.45)]" : "border-[#1f1638] shadow-[0_0_25px_rgba(12,0,202,0.25)]"
      }`}>
        {/* Header Bar */}
        <div className="flex items-center justify-between border-b border-[#1f1638] px-4 py-3 bg-[#0a071b]">
          <div className="flex items-center gap-3">
            <div className={`flex h-7 w-7 items-center justify-center rounded-lg border ${
              state === "thinking"
                ? "border-[#0C00CA] bg-[#0C00CA]/25 text-[#00ffff]"
                : "border-[#00ffff]/60 bg-[#00ffff]/15 text-[#00ffff]"
            }`}>
              <Terminal className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm text-[#f1f0f7]">OmniAI Studio Assistant</span>
                <span className={`rounded-full border px-2 py-0.5 font-mono text-[9px] font-bold ${
                  state === "thinking"
                    ? "border-[#0C00CA] bg-[#0C00CA]/30 text-[#00ffff] animate-pulse"
                    : state === "talking"
                    ? "border-[#00ffff] bg-[#00ffff]/20 text-[#00ffff]"
                    : "border-[#00ffff]/40 bg-[#00ffff]/10 text-[#00ffff]"
                }`}>
                  {state.toUpperCase()} {" // "} LPU {latencyMs.toFixed(1)}ms
                </span>
              </div>
              <p className="font-mono text-[10px] text-[#8d87a8]">
                Connected Context: <span className="text-[#00ffff] font-semibold">{activeStudioContext}</span>
              </p>
            </div>
          </div>

          <button
            onClick={() => orbEngineStore.setOverlayOpen(false)}
            className="rounded-lg p-1.5 text-[#8d87a8] hover:text-white hover:bg-[#110b29] transition"
            title="Close Assistant"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Quick Action Chips (Contextual to the current studio) */}
        <div className="flex items-center gap-2 overflow-x-auto px-4 py-2 bg-[#000000]/60 border-b border-[#1f1638]">
          <span className="font-mono text-[9px] uppercase tracking-wider text-[#8d87a8] shrink-0">
            QUICK AUTOMATIONS:
          </span>
          {quickActions.map((action, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(action.prompt)}
              className="shrink-0 flex items-center gap-1 rounded-lg border border-[#1f1638] bg-[#0a071b] px-2.5 py-1 font-mono text-[10px] text-slate-300 hover:border-[#0C00CA] hover:text-[#00ffff] transition shadow-sm hover:shadow-[0_0_12px_rgba(12,0,202,0.4)]"
            >
              <Sparkles className="h-2.5 w-2.5 text-[#00ffff]" />
              <span>{action.label}</span>
            </button>
          ))}
        </div>

        {/* Conversation Message Stream */}
        <div
          ref={chatScrollRef}
          className="max-h-[260px] overflow-y-auto p-4 space-y-3 font-mono text-xs bg-[#000000]/30"
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
                    ? "bg-[#0C00CA] text-white border border-[#3d2cf5] shadow-[0_0_18px_rgba(12,0,202,0.45)]"
                    : "bg-[#0a071b] text-[#f1f0f7] border border-[#1f1638]"
                }`}
              >
                <div className="flex items-center gap-2 mb-1 opacity-75 text-[9px]">
                  <span className="font-bold text-white">{msg.sender === "user" ? "CREATIVE DIRECTOR" : "OMNIAI - NEXUS CORE"}</span>
                  <span>·</span>
                  <span>{new Date(msg.timestamp).toLocaleTimeString()}</span>
                </div>
                <p className="leading-relaxed">{msg.text}</p>

                {/* Real-time Call Response Pills (High-contrast Baby Blue #00ffff) */}
                {msg.actionExecuted && (
                  <div className="mt-2 flex items-center gap-1.5 rounded-lg border border-[#00ffff]/50 bg-[#00ffff]/15 px-2.5 py-1 text-[10px] font-bold text-[#00ffff] shadow-[0_0_10px_rgba(0,255,255,0.25)]">
                    <CheckCircle2 className="h-3 w-3 text-[#00ffff]" />
                    <span>RESPONSE: {msg.actionExecuted}</span>
                  </div>
                )}
              </div>
            </div>
          ))}

          {state === "thinking" && (
            <div className="flex items-center gap-2 text-[#00ffff] text-[11px] font-mono">
              <span className="h-2 w-2 rounded-full bg-[#00ffff] shadow-[0_0_8px_#00ffff] animate-ping" />
              <span>Routing through local Ollama &amp; Python automation nodes…</span>
            </div>
          )}
        </div>

        {/* Real-time Audio Reactive Visualizer Ribbon */}
        {state === "talking" && (
          <div className="flex items-center justify-center gap-1 px-4 py-1.5 bg-[#0a071b] border-t border-[#1f1638]">
            <span className="font-mono text-[9px] text-[#00ffff] mr-2 font-bold">VOICE SYNTHESIS:</span>
            {audioFrequencies.map((f, i) => (
              <span
                key={i}
                className="w-1 rounded-full bg-[#00ffff] shadow-[0_0_6px_#00ffff]"
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
                ? "border-[#0C00CA] bg-[#0C00CA]/30 text-[#00ffff] animate-pulse shadow-[0_0_18px_rgba(12,0,202,0.6)]"
                : "border-[#1f1638] bg-[#0a071b] text-slate-300 hover:border-[#0C00CA] hover:text-[#00ffff] hover:shadow-[0_0_14px_rgba(12,0,202,0.4)]"
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
            className="flex-1 rounded-xl border border-[#1f1638] bg-[#0a071b] px-3.5 py-2 font-mono text-xs text-[#f1f0f7] placeholder-[#8d87a8] focus:border-[#0C00CA] focus:ring-1 focus:ring-[#0C00CA] focus:outline-none"
          />

          <button
            onClick={() => handleSend()}
            disabled={!inputText.trim()}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#3d2cf5] bg-[#0C00CA] text-white font-bold transition hover:bg-[#3d2cf5] shadow-[0_0_18px_rgba(12,0,202,0.45)] disabled:opacity-30 disabled:border-[#1f1638] disabled:bg-[#0a071b] disabled:text-[#8d87a8]"
            title="Dispatch Command"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
