"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  Mic,
  MicOff,
  PhoneOff,
  Video,
  VideoOff,
  Volume2,
  VolumeX,
  Sparkles,
  Terminal,
  Activity,
  Layers,
  CheckCircle2,
  Smartphone,
  Monitor,
  Shield,
  Zap,
  Radio,
  BarChart3,
  Flame,
  ChevronLeft,
  ChevronRight,
  Maximize2
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell
} from "recharts";

/* =========================================================================
   DARK MISFIT STUDIOS — OMNIAI - NEXUS: LIVECALLVIEW & COUNCIL PERFORMANCE
   Absolute Black Cyberpunk Specifications:
     - Pure Shiny Black Canvas: #000000
     - Obsidian-Purple Panels & Cards: #0a071b
     - Purplish-Blue Primary Accents & Halos: #0C00CA (Bright: #3d2cf5)
     - Baby Blue Diagnostic Metrics & Telemetry: #00ffff
     - Tri-Agent Council: THE STRATEGIST, THE EMPATH, THE GHOST
========================================================================= */

type PhonePane = "Swipe Left" | "Center Feed" | "Swipe Right";

interface CouncilMetric {
  agent: "THE STRATEGIST" | "THE EMPATH" | "THE GHOST";
  shortName: string;
  contributions: number; // percentage or score
  color: string;
  roleDescription: string;
  activeStatus: "ACTIVE" | "ANALYZING" | "STANDBY";
}

interface TranscriptEntry {
  id: string;
  speaker: "USER" | "THE STRATEGIST" | "THE EMPATH" | "THE GHOST";
  text: string;
  timestamp: string;
  responsePill?: string;
  confidence?: number;
}

export default function LiveCallView({
  onClose,
  initialPhoneMode = false,
}: {
  onClose?: () => void;
  initialPhoneMode?: boolean;
}) {
  // Viewport mode: Desktop Widescreen HUD vs Mobile Phone Pane
  const [isPhoneMode, setIsPhoneMode] = useState<boolean>(initialPhoneMode);
  const [activePane, setActivePane] = useState<PhonePane>("Center Feed");

  // Call Audio / Hardware States
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isAudioReactive, setIsAudioReactive] = useState(true);
  const [latencyMs, setLatencyMs] = useState(12.4);

  // Web Speech API Voice Dictation State
  const [isDictating, setIsDictating] = useState(false);
  const [interimSpeech, setInterimSpeech] = useState("");
  const [dictationSupported, setDictationSupported] = useState(true);
  const recognitionRef = useRef<any>(null);

  // Council Contribution Metrics for Recharts
  const [councilMetrics, setCouncilMetrics] = useState<CouncilMetric[]>([
    {
      agent: "THE STRATEGIST",
      shortName: "STRATEGIST",
      contributions: 42,
      color: "#00ffff",
      roleDescription: "Architectural & Structural Logic",
      activeStatus: "ACTIVE",
    },
    {
      agent: "THE EMPATH",
      shortName: "EMPATH",
      contributions: 31,
      color: "#0C00CA",
      roleDescription: "Heartbreak & Emotional Resonance",
      activeStatus: "ACTIVE",
    },
    {
      agent: "THE GHOST",
      shortName: "GHOST",
      contributions: 27,
      color: "#3d2cf5",
      roleDescription: "Cyberpunk Avant-Garde Edge",
      activeStatus: "ACTIVE",
    },
  ]);

  // Real-Time Transcript Stream
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([
    {
      id: "t-1",
      speaker: "THE STRATEGIST",
      text: "Nexus-Inference telemetry initialized. All local Ollama nodes locked to 128ms LPU response boundaries.",
      timestamp: "00:02",
      responsePill: "SYSTEM_LOCK // OVERRIDE_MAX_SPEED",
      confidence: 0.99,
    },
    {
      id: "t-2",
      speaker: "THE EMPATH",
      text: "Voice cadence reflects raw heartbreak and creative tension. Tuning sonic frequencies to melancholic obsidian depths.",
      timestamp: "00:05",
      responsePill: "AESTHETIC_RESONANCE // 94%",
      confidence: 0.96,
    },
    {
      id: "t-3",
      speaker: "THE GHOST",
      text: "Thermal dissipation verified. Avant-garde visual vectors engaged for pure black viewport.",
      timestamp: "00:08",
      responsePill: "STEALTH_ROUTING // SECURE",
      confidence: 0.98,
    },
  ]);

  const [activeInput, setActiveInput] = useState("");
  const transcriptBottomRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll transcript
  useEffect(() => {
    transcriptBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript, interimSpeech]);

  // Helper to append user speech and trigger Tri-Agent council reactions
  const appendUserTranscript = useCallback((text: string) => {
    if (!text.trim()) return;

    const now = new Date();
    const timeStr = `${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;

    const userEntry: TranscriptEntry = {
      id: `u-${Date.now()}`,
      speaker: "USER",
      text,
      timestamp: timeStr,
    };

    setTranscript((prev) => [...prev, userEntry]);
    setActiveInput("");

    // Simulate council reaction and re-balance contributions in Recharts
    setTimeout(() => {
      const rand = Math.random();
      let chosenAgent: "THE STRATEGIST" | "THE EMPATH" | "THE GHOST" = "THE STRATEGIST";
      let reply = "";
      let pill = "";

      if (rand < 0.45) {
        chosenAgent = "THE STRATEGIST";
        reply = `Analyzing execution vectors for: "${text.slice(0, 40)}...". Structural integrity verified with zero latency regression.`;
        pill = "STRATEGY // OPTIMIZED";
      } else if (rand < 0.75) {
        chosenAgent = "THE EMPATH";
        reply = `Emotional undertones detected. Rebalancing harmonic resonance against Dark Misfit Studios heartbreak aesthetic.`;
        pill = "EMPATHY_CORE // 98%";
      } else {
        chosenAgent = "THE GHOST";
        reply = `Bypassing conventional telemetry filters. Shadow routing and cybernetic edge protocols enforced.`;
        pill = "GHOST_NET // ARMORED";
      }

      const agentEntry: TranscriptEntry = {
        id: `a-${Date.now()}`,
        speaker: chosenAgent,
        text: reply,
        timestamp: `${String(new Date().getMinutes()).padStart(2, "0")}:${String(new Date().getSeconds()).padStart(2, "0")}`,
        responsePill: pill,
        confidence: 0.97,
      };

      setTranscript((prev) => [...prev, agentEntry]);

      // Update Council Performance distribution dynamically
      setCouncilMetrics((prev) => {
        const updated = prev.map((item) => {
          if (item.agent === chosenAgent) {
            return { ...item, contributions: Math.min(65, item.contributions + 5) };
          }
          return { ...item, contributions: Math.max(15, item.contributions - 2.5) };
        });
        const total = updated.reduce((acc, curr) => acc + curr.contributions, 0);
        return updated.map((m) => ({
          ...m,
          contributions: Math.round((m.contributions / total) * 100),
        }));
      });
    }, 700);
  }, []);

  const appendUserTranscriptRef = useRef(appendUserTranscript);
  useEffect(() => {
    appendUserTranscriptRef.current = appendUserTranscript;
  }, [appendUserTranscript]);

  // Initialize Web Speech API for Real-Time Voice Dictation
  useEffect(() => {
    if (typeof window === "undefined") return;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setDictationSupported(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onstart = () => {
        setIsDictating(true);
      };

      recognition.onresult = (event: any) => {
        let interim = "";
        let finalTrans = "";

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTrans += event.results[i][0].transcript;
          } else {
            interim += event.results[i][0].transcript;
          }
        }

        setInterimSpeech(interim);

        if (finalTrans.trim()) {
          appendUserTranscriptRef.current(finalTrans.trim());
          setInterimSpeech("");
        }
      };

      recognition.onerror = (event: any) => {
        console.warn("[VoiceDictation] Speech recognition error:", event.error);
        setIsDictating(false);
        setInterimSpeech("");
      };

      recognition.onend = () => {
        setIsDictating(false);
        setInterimSpeech("");
      };

      recognitionRef.current = recognition;
    } catch (e) {
      console.warn("[VoiceDictation] Initialization failed:", e);
      setDictationSupported(false);
    }

    return () => {
      try {
        recognitionRef.current?.stop();
      } catch {
        // Safe cleanup
      }
    };
  }, []);

  // Voice Dictation Toggle handler
  const toggleVoiceDictation = () => {
    if (isDictating) {
      try {
        recognitionRef.current?.stop();
      } catch (err) {
        console.warn(err);
      }
      setIsDictating(false);
      setInterimSpeech("");
    } else {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.start();
          setIsDictating(true);
        } catch {
          // If already running or permission prompt
          try {
            recognitionRef.current.stop();
          } catch {}
          setIsDictating(false);
        }
      } else {
        // Fallback simulated dictation if SpeechRecognition API is disabled/unsupported
        setIsDictating(true);
        setInterimSpeech("Listening to live audio stream...");
        setTimeout(() => {
          setInterimSpeech("Analyzing voice frequencies...");
          setTimeout(() => {
            appendUserTranscript("Directive confirmed: Lock all studio viewports to Absolute Black Cyberpunk.");
            setIsDictating(false);
            setInterimSpeech("");
          }, 1800);
        }, 1200);
      }
    }
  };

  return (
    <div className="relative w-full min-h-screen bg-[#000000] text-[#f1f0f7] flex flex-col overflow-hidden font-sans select-none">
      {/* ── TOP CALL HEADER (Absolute Black & Baby Blue Telemetry) ────────── */}
      <header className="h-14 shrink-0 border-b border-[#1f1638] bg-[#000000] px-4 sm:px-6 flex items-center justify-between z-30">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-xl border border-[#0C00CA] bg-[#0C00CA]/20 text-[#00ffff] shadow-[0_0_15px_rgba(12,0,202,0.45)]">
            <Radio className="h-4 w-4 animate-pulse text-[#00ffff]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-extrabold text-sm sm:text-base tracking-tight text-white flex items-center gap-1.5">
                <span>OmniAI · Call HUD</span>
                <span className="font-mono text-[9px] text-[#00ffff] bg-[#00ffff]/10 border border-[#00ffff]/30 px-2 py-0.5 rounded-full font-bold">
                  TRI-COUNCIL LIVE
                </span>
              </h1>
            </div>
            <p className="font-mono text-[10px] text-[#8d87a8] hidden sm:block">
              Absolute Black Cyberpunk Call Room // Latency:{" "}
              <span className="text-[#00ffff] font-bold">{latencyMs.toFixed(1)}ms</span>
            </p>
          </div>
        </div>

        {/* Global Standard Telemetry Pill */}
        <div className="hidden lg:flex items-center gap-2 rounded-lg border border-[#00ffff]/40 bg-[#0a071b] px-3 py-1 shadow-[0_0_12px_rgba(0,255,255,0.2)]">
          <span className="size-2 rounded-full bg-[#00ffff] shadow-[0_0_8px_#00ffff] animate-ping" />
          <span className="font-mono text-[10px] font-bold text-[#00ffff] tracking-wide">
            [Nexus-Inference: Max-Speed / Local-Ollama Override]
          </span>
        </div>

        {/* Viewport Mode Switcher & Exit */}
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-xl border border-[#1f1638] bg-[#0a071b] p-0.5">
            <button
              onClick={() => setIsPhoneMode(false)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-mono text-[10px] font-semibold transition ${
                !isPhoneMode
                  ? "bg-[#0C00CA] text-white shadow-[0_0_12px_rgba(12,0,202,0.4)]"
                  : "text-[#8d87a8] hover:text-white"
              }`}
            >
              <Monitor className="h-3 w-3" />
              <span className="hidden sm:inline">Desktop</span>
            </button>
            <button
              onClick={() => setIsPhoneMode(true)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-mono text-[10px] font-semibold transition ${
                isPhoneMode
                  ? "bg-[#0C00CA] text-white shadow-[0_0_12px_rgba(12,0,202,0.4)]"
                  : "text-[#8d87a8] hover:text-white"
              }`}
            >
              <Smartphone className="h-3 w-3" />
              <span className="hidden sm:inline">Phone Pane</span>
            </button>
          </div>

          {onClose && (
            <button
              onClick={onClose}
              className="flex size-9 items-center justify-center rounded-xl border border-[#1f1638] bg-[#0a071b] text-[#8d87a8] hover:border-[#ff2a6d] hover:text-[#ff2a6d] transition"
              title="Close Call HUD"
            >
              <PhoneOff className="h-4 w-4" />
            </button>
          )}
        </div>
      </header>

      {/* ── MAIN VIEWPORT BODY ───────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col md:flex-row min-h-0 bg-[#000000] p-3 sm:p-4 gap-3 sm:gap-4 overflow-hidden">
        {/* LEFT / TOP: COUNCIL PERFORMANCE DASHBOARD & AGENTS (Obsidian-Purple #0a071b) */}
        <div className="w-full md:w-[380px] lg:w-[420px] shrink-0 flex flex-col gap-3 overflow-y-auto">
          {/* Council Performance Dashboard Card */}
          <section className="rounded-2xl border border-[#1f1638] bg-[#0a071b] p-4 shadow-[0_10px_35px_rgba(0,0,0,0.7)] relative overflow-hidden transition-all duration-200 hover:border-[#0C00CA] hover:shadow-[0_0_20px_rgba(12,0,202,0.35)]">
            <div className="flex items-center justify-between pb-2 border-b border-[#1f1638] mb-3">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-[#00ffff]" />
                <h2 className="font-extrabold text-xs tracking-wider uppercase text-white font-mono">
                  Council Performance Dashboard
                </h2>
              </div>
              <span className="font-mono text-[9px] text-[#00ffff] font-bold">
                REAL-TIME FLOW
              </span>
            </div>

            <p className="font-mono text-[10px] text-[#8d87a8] mb-3">
              Dynamic conversation contributions by agent according to semantic weights and triage analysis.
            </p>

            {/* Recharts Bar Chart of Agent Contributions */}
            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={councilMetrics}
                  margin={{ top: 8, right: 12, left: -22, bottom: 4 }}
                >
                  <XAxis
                    dataKey="shortName"
                    stroke="#8d87a8"
                    fontSize={10}
                    tickLine={false}
                    fontFamily="JetBrains Mono, monospace"
                  />
                  <YAxis
                    stroke="#8d87a8"
                    fontSize={10}
                    tickLine={false}
                    domain={[0, 100]}
                    fontFamily="JetBrains Mono, monospace"
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#0a071b",
                      borderColor: "#0C00CA",
                      borderRadius: "8px",
                      fontSize: "11px",
                      fontFamily: "JetBrains Mono, monospace",
                      boxShadow: "0 0 15px rgba(12,0,202,0.4)",
                    }}
                    itemStyle={{ color: "#00ffff" }}
                    formatter={(val: any) => [`${val}% Contribution`, "Impact"]}
                  />
                  <Bar dataKey="contributions" radius={[6, 6, 0, 0]}>
                    {councilMetrics.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.color}
                        stroke={entry.agent === "THE STRATEGIST" ? "#00ffff" : "#0C00CA"}
                        strokeWidth={1}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Metric Score Legend */}
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#1f1638] font-mono text-[9px]">
              {councilMetrics.map((m) => (
                <div key={m.agent} className="rounded-lg bg-[#000000] p-2 border border-[#1f1638]">
                  <span className="block text-[#8d87a8] text-[8px] truncate">{m.shortName}</span>
                  <span className="block text-sm font-extrabold text-[#00ffff]">{m.contributions}%</span>
                </div>
              ))}
            </div>
          </section>

          {/* Tri-Agent Council Cards: THE STRATEGIST, THE EMPATH, THE GHOST */}
          <div className="space-y-2.5">
            {/* AGENT 1: THE STRATEGIST */}
            <article className="rounded-xl border border-[#1f1638] bg-[#0a071b] p-3.5 transition-all duration-200 hover:border-[#0C00CA] hover:shadow-[0_0_18px_rgba(12,0,202,0.4)]">
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-mono text-xs font-black uppercase text-[#00ffff] tracking-wider drop-shadow-[0_0_8px_rgba(0,255,255,0.4)]">
                  THE STRATEGIST
                </span>
                <span className="font-mono text-[9px] text-[#00ffff] bg-[#00ffff]/10 border border-[#00ffff]/30 px-2 py-0.5 rounded font-bold">
                  ACTIVE // 42%
                </span>
              </div>
              <p className="text-xs text-slate-200 font-mono leading-relaxed">
                Structural logic, pipeline execution boundaries, and hardware compute optimization.
              </p>
              <div className="mt-2.5 flex items-center justify-between font-mono text-[9px] text-[#8d87a8] pt-2 border-t border-[#1f1638]">
                <span>Node: TensorRT-RTX</span>
                <span className="text-[#00ffff] font-semibold">Triage: High Priority</span>
              </div>
            </article>

            {/* AGENT 2: THE EMPATH */}
            <article className="rounded-xl border border-[#1f1638] bg-[#0a071b] p-3.5 transition-all duration-200 hover:border-[#0C00CA] hover:shadow-[0_0_18px_rgba(12,0,202,0.4)]">
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-mono text-xs font-black uppercase text-[#00ffff] tracking-wider drop-shadow-[0_0_8px_rgba(0,255,255,0.4)]">
                  THE EMPATH
                </span>
                <span className="font-mono text-[9px] text-[#00ffff] bg-[#00ffff]/10 border border-[#00ffff]/30 px-2 py-0.5 rounded font-bold">
                  ACTIVE // 31%
                </span>
              </div>
              <p className="text-xs text-slate-200 font-mono leading-relaxed">
                Emotional resonance, heartbreak textures, and human sentiment translation.
              </p>
              <div className="mt-2.5 flex items-center justify-between font-mono text-[9px] text-[#8d87a8] pt-2 border-t border-[#1f1638]">
                <span>Aesthetic: Melancholic Obsidian</span>
                <span className="text-[#00ffff] font-semibold">Voice: Warm Dark</span>
              </div>
            </article>

            {/* AGENT 3: THE GHOST */}
            <article className="rounded-xl border border-[#1f1638] bg-[#0a071b] p-3.5 transition-all duration-200 hover:border-[#0C00CA] hover:shadow-[0_0_18px_rgba(12,0,202,0.4)]">
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-mono text-xs font-black uppercase text-[#00ffff] tracking-wider drop-shadow-[0_0_8px_rgba(0,255,255,0.4)]">
                  THE GHOST
                </span>
                <span className="font-mono text-[9px] text-[#00ffff] bg-[#00ffff]/10 border border-[#00ffff]/30 px-2 py-0.5 rounded font-bold">
                  ACTIVE // 27%
                </span>
              </div>
              <p className="text-xs text-slate-200 font-mono leading-relaxed">
                Cyberpunk avant-garde styling, anomaly scanning, and stealth telemetry routing.
              </p>
              <div className="mt-2.5 flex items-center justify-between font-mono text-[9px] text-[#8d87a8] pt-2 border-t border-[#1f1638]">
                <span>State: Shadow Veil</span>
                <span className="text-[#00ffff] font-semibold">Defense: Shield Lock</span>
              </div>
            </article>
          </div>
        </div>

        {/* RIGHT / MAIN: TRANSCRIPT & MOBILE PHONE / WIDESCREEN SURFACE */}
        <div className="flex-1 flex flex-col min-h-0 rounded-2xl border border-[#1f1638] bg-[#0a071b] overflow-hidden shadow-[0_12px_40px_rgba(0,0,0,0.8)]">
          {/* Mobile Phone Pane Navigation Bar (if in Phone Mode) */}
          {isPhoneMode && (
            <div className="shrink-0 flex items-center justify-between border-b border-[#1f1638] bg-[#000000] px-3 py-2">
              <span className="font-mono text-[10px] text-[#8d87a8] uppercase font-bold tracking-wider">
                PHONE PANE:
              </span>
              <div className="flex items-center gap-1.5">
                {(["Swipe Left", "Center Feed", "Swipe Right"] as PhonePane[]).map((pane) => (
                  <button
                    key={pane}
                    onClick={() => setActivePane(pane)}
                    className={`px-3 py-1 rounded-lg font-mono text-[10px] font-bold uppercase transition border ${
                      activePane === pane
                        ? "border-[#0C00CA] bg-[#0C00CA] text-white shadow-[0_0_12px_rgba(12,0,202,0.6)]"
                        : "border-[#1f1638] bg-[#0a071b] text-[#8d87a8] hover:text-white"
                    }`}
                  >
                    {pane}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Call Feed Header Status */}
          <div className="shrink-0 flex items-center justify-between border-b border-[#1f1638] px-4 py-2.5 bg-[#0a071b]">
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-[#00ffff] shadow-[0_0_8px_#00ffff]" />
              <span className="font-mono text-xs font-bold text-white uppercase tracking-wider">
                Real-Time Conversation Stream
              </span>
            </div>
            <div className="flex items-center gap-2">
              {isDictating && (
                <span className="flex items-center gap-1 font-mono text-[10px] font-bold text-[#00ffff] bg-[#00ffff]/10 border border-[#00ffff]/30 px-2 py-0.5 rounded-full animate-pulse">
                  <span className="size-1.5 rounded-full bg-[#00ffff]" />
                  SPEECH RECOGNITION ACTIVE
                </span>
              )}
              <span className="font-mono text-[10px] text-[#8d87a8]">
                Mode: <b className="text-[#00ffff]">{isPhoneMode ? activePane : "Widescreen Call HUD"}</b>
              </span>
            </div>
          </div>

          {/* Transcript Area */}
          <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3.5 bg-[#000000]/40">
            {isPhoneMode && activePane === "Swipe Left" && (
              <div className="rounded-xl border border-[#0C00CA]/40 bg-[#000000] p-4 font-mono text-xs text-slate-300 space-y-2">
                <span className="text-[10px] font-bold uppercase text-[#00ffff] block">
                  [SWIPE LEFT PANE: SYSTEM TELEMETRY &amp; PROFILES]
                </span>
                <p>Tri-Agent Council members: The Strategist, The Empath, The Ghost.</p>
                <p>Audio Engine: 48kHz PCM WebRTC link active.</p>
                <p>Safe-zone bounds locked to standard 9:16 mobile device viewport.</p>
              </div>
            )}

            {isPhoneMode && activePane === "Swipe Right" && (
              <div className="rounded-xl border border-[#0C00CA]/40 bg-[#000000] p-4 font-mono text-xs text-slate-300 space-y-2">
                <span className="text-[10px] font-bold uppercase text-[#00ffff] block">
                  [SWIPE RIGHT PANE: COMMUNITY STEMS &amp; REACTIONS]
                </span>
                <p>Vault Link: Direct connection to Global Media Link Vault active.</p>
                <p>Live audio waveforms routed to WebGL spectrum visualizers.</p>
              </div>
            )}

            {/* Conversation Entries */}
            {transcript.map((item) => {
              const isUser = item.speaker === "USER";
              return (
                <div
                  key={item.id}
                  className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}
                >
                  <div
                    className={`max-w-[88%] rounded-2xl px-4 py-3 shadow-md transition-all duration-200 ${
                      isUser
                        ? "bg-[#0C00CA] text-white border border-[#3d2cf5] shadow-[0_0_20px_rgba(12,0,202,0.45)]"
                        : "bg-[#0a071b] text-[#f1f0f7] border border-[#1f1638] hover:border-[#0C00CA]/60"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1.5 font-mono text-[9px] opacity-80">
                      <span className={`font-black ${isUser ? "text-white" : "text-[#00ffff]"}`}>
                        {item.speaker}
                      </span>
                      <span>·</span>
                      <span className="text-slate-400">{item.timestamp}</span>
                    </div>

                    <p className="text-xs sm:text-sm font-sans leading-relaxed">{item.text}</p>

                    {/* Real-time Call Response Pills (Clear Baby Blue #00ffff Typography Weights) */}
                    {item.responsePill && (
                      <div className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg border border-[#00ffff]/50 bg-[#00ffff]/10 px-2.5 py-1 text-[10px] font-black text-[#00ffff] shadow-[0_0_12px_rgba(0,255,255,0.25)] tracking-wide font-mono">
                        <CheckCircle2 className="h-3 w-3 text-[#00ffff]" />
                        <span>RESPONSE: {item.responsePill}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Live Streaming Speech Preview */}
            {interimSpeech && (
              <div className="flex flex-col items-end">
                <div className="max-w-[85%] rounded-2xl px-4 py-2.5 bg-[#0C00CA]/50 text-white border border-[#00ffff]/60 shadow-[0_0_20px_rgba(0,255,255,0.3)] animate-pulse">
                  <span className="font-mono text-[9px] text-[#00ffff] font-bold block mb-1">
                    STREAMING VOICE INPUT…
                  </span>
                  <p className="text-xs font-mono">{interimSpeech}</p>
                </div>
              </div>
            )}

            <div ref={transcriptBottomRef} />
          </div>

          {/* ── BOTTOM INTERACTION TRAY ──────────────────────────────────── */}
          <div className="shrink-0 border-t border-[#1f1638] bg-[#000000] p-3 sm:p-4 space-y-3">
            {/* Input + Voice Dictation Button Bar */}
            <div className="flex items-center gap-2">
              {/* Voice Dictation Button using Browser Web Speech API */}
              <button
                type="button"
                onClick={toggleVoiceDictation}
                className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl font-mono text-xs font-bold transition-all duration-200 border ${
                  isDictating
                    ? "border-[#00ffff] bg-[#00ffff]/20 text-[#00ffff] shadow-[0_0_22px_rgba(0,255,255,0.5)] animate-pulse"
                    : "border-[#0C00CA] bg-[#0a071b] text-white hover:bg-[#0C00CA]/30 hover:border-[#3d2cf5] hover:shadow-[0_0_18px_rgba(12,0,202,0.45)]"
                }`}
                title={
                  isDictating
                    ? "Listening... Tap to Stop Voice Dictation"
                    : "Voice Dictation (Web Speech API) - Tap to speak"
                }
              >
                {isDictating ? (
                  <>
                    <Mic className="h-4 w-4 text-[#00ffff] animate-ping" />
                    <span>DICTATING…</span>
                  </>
                ) : (
                  <>
                    <Mic className="h-4 w-4 text-[#00ffff]" />
                    <span>VOICE DICTATION</span>
                  </>
                )}
              </button>

              {/* Text fallback / manual query */}
              <input
                type="text"
                value={activeInput}
                onChange={(e) => setActiveInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && activeInput.trim()) {
                    appendUserTranscript(activeInput.trim());
                  }
                }}
                placeholder="Type or use Voice Dictation to consult the council..."
                className="flex-1 rounded-xl border border-[#1f1638] bg-[#0a071b] px-3.5 py-2.5 font-mono text-xs text-white placeholder-[#8d87a8] focus:border-[#0C00CA] focus:ring-1 focus:ring-[#0C00CA] focus:outline-none"
              />

              <button
                type="button"
                onClick={() => {
                  if (activeInput.trim()) appendUserTranscript(activeInput.trim());
                }}
                disabled={!activeInput.trim()}
                className="px-4 py-2.5 rounded-xl border border-[#3d2cf5] bg-[#0C00CA] text-white font-mono text-xs font-bold transition hover:bg-[#3d2cf5] shadow-[0_0_18px_rgba(12,0,202,0.5)] disabled:opacity-30 disabled:border-[#1f1638] disabled:bg-[#0a071b] disabled:text-[#8d87a8]"
              >
                SEND
              </button>
            </div>

            {/* Quick Action Chips & Controls */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 font-mono text-[10px]">
              <div className="flex items-center gap-1.5 overflow-x-auto">
                <span className="text-[#8d87a8] uppercase text-[9px] mr-1">TRIAGE:</span>
                <button
                  type="button"
                  onClick={() =>
                    appendUserTranscript("Requesting full Tri-Agent Council performance review.")
                  }
                  className="rounded-lg border border-[#1f1638] bg-[#0a071b] px-2.5 py-1 text-slate-300 hover:border-[#0C00CA] hover:text-[#00ffff] transition hover:shadow-[0_0_12px_rgba(12,0,202,0.35)]"
                >
                  ⚡ Review Council
                </button>
                <button
                  type="button"
                  onClick={() =>
                    appendUserTranscript("Strategist: verify zero latency on all local nodes.")
                  }
                  className="rounded-lg border border-[#1f1638] bg-[#0a071b] px-2.5 py-1 text-slate-300 hover:border-[#0C00CA] hover:text-[#00ffff] transition hover:shadow-[0_0_12px_rgba(12,0,202,0.35)]"
                >
                  🎯 Strategist Audit
                </button>
                <button
                  type="button"
                  onClick={() =>
                    appendUserTranscript("Empath: tune frequency to dark cyberpunk grief theme.")
                  }
                  className="rounded-lg border border-[#1f1638] bg-[#0a071b] px-2.5 py-1 text-slate-300 hover:border-[#0C00CA] hover:text-[#00ffff] transition hover:shadow-[0_0_12px_rgba(12,0,202,0.35)]"
                >
                  🖤 Empath Tune
                </button>
              </div>

              {/* Hardware toggles */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsMuted(!isMuted)}
                  className={`size-8 rounded-lg border flex items-center justify-center transition ${
                    isMuted
                      ? "border-[#ff2a6d] bg-[#ff2a6d]/20 text-[#ff2a6d]"
                      : "border-[#1f1638] bg-[#0a071b] text-slate-300 hover:border-[#0C00CA]"
                  }`}
                  title={isMuted ? "Unmute" : "Mute"}
                >
                  {isMuted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
                </button>
                <button
                  type="button"
                  onClick={() => setIsVideoOn(!isVideoOn)}
                  className={`size-8 rounded-lg border flex items-center justify-center transition ${
                    !isVideoOn
                      ? "border-[#ff2a6d] bg-[#ff2a6d]/20 text-[#ff2a6d]"
                      : "border-[#1f1638] bg-[#0a071b] text-slate-300 hover:border-[#0C00CA]"
                  }`}
                  title={isVideoOn ? "Turn off camera" : "Turn on camera"}
                >
                  {isVideoOn ? <Video className="h-3.5 w-3.5" /> : <VideoOff className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
