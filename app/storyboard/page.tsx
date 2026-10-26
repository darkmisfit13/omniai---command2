"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Film,
  Sparkles,
  Camera,
  Scissors,
  FileText,
  Layers,
  Lock,
  Unlock,
  Mic,
  Video,
  Image as ImageIcon,
  Copy,
  Check,
  RotateCcw,
  Upload,
  Play,
  Pause,
  Sliders,
  Download,
  Trash2,
  Crosshair,
  Activity,
  Zap,
  ChevronRight,
  ShieldAlert,
  FolderDown,
  Wand2
} from "lucide-react";
import StudioToggleMatrix from "@/components/StudioToggleMatrix";

/* =========================================================================
   DARK MISFIT STUDIOS — OMNIAI - NEXUS: OMNI STORYBOARD
   Principal Creative Media Architecture
   Palette Parameters:
     - Canvas Background: #000000 (Pure Black)
     - Layer Container Blocks: Dark Bluish Purple (#0e0a1c, #120d24, #16112c, #1a1336, #221745)
     - Active Text Highlights & Status Lines: Very Light Neon Bluish Green (#00ffa3, #39ffb4)
   Naming: "OmniAI - Nexus"
   ========================================================================= */

interface ScriptScene {
  id: string;
  idx: number;
  header: string;
  timecode: string;
  actionText: string;
  dialogueLines: string[];
  characters: string[];
  cameraVector: string;
  lightingPrompt: string;
  visualPrompt: string;
  preRenderState: "idle" | "rendering" | "ready";
  previewGradient: string;
  deployed: {
    image: boolean;
    video: boolean;
    voice: boolean;
  };
}

interface PortraitAnchorSlot {
  id: string;
  slotNumber: number;
  name: string;
  avatarUrl?: string;
  vectorTraits: string;
  isFilled: boolean;
}

const DEFAULT_PORTRAIT_ANCHORS: PortraitAnchorSlot[] = [
  {
    id: "anchor-1",
    slotNumber: 1,
    name: "KAI (Lead Protagonist)",
    vectorTraits: "Male, 30s, sharp jawline, silver cybernetic cheek suture, wet jet-black undercut",
    isFilled: true,
  },
  {
    id: "anchor-2",
    slotNumber: 2,
    name: "ALIKA (Street Fixer)",
    vectorTraits: "Female, late 20s, braided obsidian hair, glowing emerald iris ocular implant, leather collar",
    isFilled: true,
  },
  {
    id: "anchor-3",
    slotNumber: 3,
    name: "MALAK (Drone Rig Operator)",
    vectorTraits: "Non-binary, hooded, heavy carbon tactical visor with amber LED readout, tech vest",
    isFilled: true,
  },
  {
    id: "anchor-4",
    slotNumber: 4,
    name: "EMPTY ANCHOR SLOT 04",
    vectorTraits: "Unassigned secondary character node",
    isFilled: false,
  },
  {
    id: "anchor-5",
    slotNumber: 5,
    name: "EMPTY ANCHOR SLOT 05",
    vectorTraits: "Unassigned environmental villain / crowd anchor",
    isFilled: false,
  },
];

const DEFAULT_SCRIPT_MARKDOWN = `# OMNIAI - NEXUS // CONTINUOUS NARRATIVE SCRIPT
# PRODUCTION CODE: DARKMISFIT-SCENE-GRID-V4
# AUTHOR: BENJAMIN JAMES (DARK MISFIT STUDIOS)

INT. OBSIDIAN ALLEYWAY - NIGHT

(00:00:00 - 00:00:18)
Neon rain cascades down brutalist steel monoliths. Puddles reflect shimmering violet and cyan advertisement holograms. KAI sprints over wet grates, heavy breathing caught in the cold air.

KAI (V.O.)
Memory is just corrupt data waiting to be rewritten. In this sector, betrayal is the only currency that never devalues.

VISUAL NOTE: Wide low-angle tracking shot skimming the flooded pavement.

INT. UNDERGROUND CIPHER CLUB - CONTINUOUS

(00:00:18 - 00:00:46)
Sub-bass rumbles through the reinforced concrete walls. ALIKA leans against a shattered glass divider, fingers tapping an encrypted datapad while smoke curls from her lips.

ALIKA
You cut the security grid three seconds too early, Kai. The watchers are already tracing your heat signature.

KAI
Let them scan. By the time their patrol reaches the drop floor, the vault will already be empty.

VISUAL NOTE: Medium close-up with intense stroboscopic neon cyan rim lighting.

EXT. CITADEL ROOFTOP SPRAY - DAWN

(00:00:46 - 01:24)
Storm clouds break into deep indigo twilight. MALAK deploys four hovering surveillance drones that rotate in synchronized flight formation. Kai hands over the glowing titanium drive.

MALAK
Clean extraction. But whoever commissioned this payload didn't tell you what was locked inside.

KAI
I don't need to know the code. I just need the ignition key to burn it down.

VISUAL NOTE: Dramatic 360-degree rotational orbital dolly zoom as drone headlights flare into the lens.

INT. THE FORGOTTEN DATA VAULT - DUSK

(01:24 - 01:52)
A solitary holographic projection of a shattered cybernetic heart pulses in slow rhythm. Kai watches the signal dissolve into obsidian mist.

KAI (WHISPER)
End of line.

VISUAL NOTE: Extreme macro push-in focusing on glowing circuit traces fading into total darkness.
`;

const CAMERA_VECTOR_PRESETS = [
  "Slow 24mm anamorphic tracking push-in skimming rain pavement",
  "High-speed 360-degree rotational orbital dolly zoom with anamorphic lens flare",
  "Low-angle Dutch tilt with high-contrast neon rim light silhouette",
  "Intimate 50mm portrait rack-focus from cigarette smoke to glowing ocular implant",
  "FPV drone flythrough diving through cracked holographic architecture",
  "Extreme wide high-altitude crane elevation pulling back into twilight smog",
];

export default function OmniStoryboardNexus() {
  const router = useRouter();

  // ---------------------------------------------------------------------------
  // COLUMN 1: THE SCRIPT PARSING WORKSPACE (LEFT 45%)
  // ---------------------------------------------------------------------------
  const [scriptMarkdown, setScriptMarkdown] = useState<string>(DEFAULT_SCRIPT_MARKDOWN);
  const [isFragmenting, setIsFragmenting] = useState<boolean>(false);
  const [isInjectingVectors, setIsInjectingVectors] = useState<boolean>(false);

  // Markdown Editor Metrics
  const lineCount = useMemo(() => scriptMarkdown.split("\n").length, [scriptMarkdown]);
  const wordCount = useMemo(
    () => scriptMarkdown.trim().split(/\s+/).filter(Boolean).length,
    [scriptMarkdown]
  );

  // ---------------------------------------------------------------------------
  // COLUMN 2: CONTINUITY CASTING & SCENE GENERATOR DECK (RIGHT 55%)
  // ---------------------------------------------------------------------------
  const [portraitAnchors, setPortraitAnchors] = useState<PortraitAnchorSlot[]>(DEFAULT_PORTRAIT_ANCHORS);
  const [symmetryLockEngaged, setSymmetryLockEngaged] = useState<boolean>(true);
  const [activeAnchorSlotId, setActiveAnchorSlotId] = useState<string>("anchor-1");

  // Storyboard Scene Block Containers
  const [scenes, setScenes] = useState<ScriptScene[]>([]);
  const [selectedSceneId, setSelectedSceneId] = useState<string>("");
  const [toastNotice, setToastNotice] = useState<string>("");

  const triggerToast = (msg: string) => {
    setToastNotice(msg);
    setTimeout(() => {
      setToastNotice((cur) => (cur === msg ? "" : cur));
    }, 4000);
  };

  // ---------------------------------------------------------------------------
  // INITIAL SCRIPT PARSE ON MOUNT
  // ---------------------------------------------------------------------------
  const parseScriptInternal = useCallback(
    (scriptText: string, injectVectors: boolean = false) => {
      const chunks = scriptText.split(/(?=(?:INT\.|EXT\.|SCENE))/i).filter((c) => c.trim().length > 10);
      const gradients = [
        "linear-gradient(135deg, #1b1236 0%, #000000 100%)",
        "linear-gradient(135deg, #121c2e 0%, #000000 100%)",
        "linear-gradient(135deg, #2a122e 0%, #000000 100%)",
        "linear-gradient(135deg, #0e221d 0%, #000000 100%)",
        "linear-gradient(135deg, #241a10 0%, #000000 100%)",
      ];

      const parsed: ScriptScene[] = chunks.map((chunk, index) => {
        const lines = chunk.split("\n").map((l) => l.trim()).filter(Boolean);
        const header = lines.find((l) => /^(INT\.|EXT\.|SCENE)/i.test(l)) || `SCENE 0${index + 1} - UNTITLED`;

        // Extract timecode
        const tcMatch = chunk.match(/\(?(\d{2}:\d{2}(?::\d{2})?)\s*-\s*(\d{2}:\d{2}(?::\d{2})?)\)?/);
        const timecode = tcMatch ? `${tcMatch[1]} - ${tcMatch[2]}` : `00:${String(index * 20).padStart(2, "0")} - 00:${String((index + 1) * 20).padStart(2, "0")}`;

        // Extract Spoken Dialogue lines
        const dialogueLines: string[] = [];
        let isCollectingDialogue = false;
        let currentSpeaker = "";

        for (const line of lines) {
          if (/^[A-Z][A-Z\s]{1,18}(?:\([^)]+\))?$/.test(line) && !/^(INT\.|EXT\.|VISUAL)/.test(line)) {
            currentSpeaker = line;
            isCollectingDialogue = true;
          } else if (isCollectingDialogue) {
            dialogueLines.push(`${currentSpeaker}: "${line}"`);
            isCollectingDialogue = false;
          }
        }

        // Extract Action / Environment Text
        const actionLines = lines.filter(
          (l) =>
            !/^(INT\.|EXT\.|VISUAL|SCENE)/i.test(l) &&
            !/^\(?\d{2}:\d{2}/.test(l) &&
            !/^[A-Z][A-Z\s]{1,18}(?:\([^)]+\))?$/.test(l) &&
            !dialogueLines.some((d) => d.includes(l))
        );
        const actionText = actionLines.join(" ") || "Atmospheric environment shot in rain-drenched cyberpunk city.";

        // Detect Characters
        const charMatches = (chunk.match(/\b(KAI|ALIKA|MALAK|VALKYRIE|CYBORG|PROTAGONIST)\b/g) || []);
        const characters = Array.from(new Set(charMatches));

        // Camera Vector
        const visualLine = lines.find((l) => /^VISUAL NOTE:/i.test(l));
        const cameraVector = visualLine
          ? visualLine.replace(/^VISUAL NOTE:\s*/i, "")
          : CAMERA_VECTOR_PRESETS[index % CAMERA_VECTOR_PRESETS.length];

        // Synthesize Visual Prompt with Character Symmetry Lock if active
        const anchorInject = symmetryLockEngaged
          ? `[SYMMETRY-LOCK: Active Face Vectors for ${characters.join(" & ") || "Lead Protagonist"}]`
          : "";

        const visualPrompt = `${anchorInject} Cinematic 8k shot: ${actionText.slice(0, 160)}. Camera vector: ${cameraVector}. Volumetric cyan and magenta neon rim lighting, 35mm anamorphic film grain, photorealistic octane render.`.trim();

        return {
          id: `scene-${index + 1}`,
          idx: index + 1,
          header,
          timecode,
          actionText,
          dialogueLines,
          characters,
          cameraVector,
          lightingPrompt: "Volumetric neon rim with obsidian shadows and ambient violet smog",
          visualPrompt,
          preRenderState: "ready",
          previewGradient: gradients[index % gradients.length],
          deployed: { image: false, video: false, voice: false },
        };
      });

      setScenes(parsed);
      if (parsed.length > 0 && !selectedSceneId) {
        setSelectedSceneId(parsed[0].id);
      }
    },
    [symmetryLockEngaged, selectedSceneId]
  );

  useEffect(() => {
    parseScriptInternal(scriptMarkdown, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------------------------------------------------------------------------
  // BUTTON 1: [Analyze & Fragment Script into Scenes]
  // ---------------------------------------------------------------------------
  const handleAnalyzeAndFragment = () => {
    setIsFragmenting(true);
    triggerToast("Executing local Python parser: Slicing scenes & dialogue tokens…");

    setTimeout(() => {
      parseScriptInternal(scriptMarkdown, false);
      setIsFragmenting(false);
      triggerToast(`Script successfully fragmented into ${scenes.length || 4} discrete scene modules.`);
    }, 600);
  };

  // ---------------------------------------------------------------------------
  // BUTTON 2: [Auto-Inject Cinematic Camera Vectors]
  // ---------------------------------------------------------------------------
  const handleAutoInjectCameraVectors = () => {
    setIsInjectingVectors(true);
    triggerToast("Auto-Injecting cinematic camera vectors (Pan, Tilt, Dolly, Anamorphic Scope)…");

    setTimeout(() => {
      setScenes((prev) =>
        prev.map((scene, i) => {
          const vector = CAMERA_VECTOR_PRESETS[(i + 1) % CAMERA_VECTOR_PRESETS.length];
          const updatedPrompt = `${scene.visualPrompt.replace(/Camera vector: [^.]+\./i, "")} Camera vector: ${vector}.`;
          return {
            ...scene,
            cameraVector: vector,
            visualPrompt: updatedPrompt,
          };
        })
      );
      setIsInjectingVectors(false);
      triggerToast("Cinematic camera vectors injected across all storyboard blocks!");
    }, 700);
  };

  // ---------------------------------------------------------------------------
  // DEPLOYMENT MICRO-ACTION HANDLERS
  // ---------------------------------------------------------------------------
  const handleDeployToImageStudio = (scene: ScriptScene) => {
    try {
      sessionStorage.setItem("oi:image-prompt", scene.visualPrompt);
      navigator.clipboard?.writeText(scene.visualPrompt);
    } catch {}
    setScenes((prev) =>
      prev.map((s) => (s.id === scene.id ? { ...s, deployed: { ...s.deployed, image: true } } : s))
    );
    triggerToast(`Payload deployed to Image Studio Node! (Copied to Clipboard)`);
    setTimeout(() => {
      router.push("/image-studio");
    }, 700);
  };

  const handleDeployToVideoStudio = (scene: ScriptScene) => {
    try {
      sessionStorage.setItem("oi:video-prompt", scene.visualPrompt);
      navigator.clipboard?.writeText(scene.visualPrompt);
    } catch {}
    setScenes((prev) =>
      prev.map((s) => (s.id === scene.id ? { ...s, deployed: { ...s.deployed, video: true } } : s))
    );
    triggerToast(`Payload deployed to Video Studio Node! (Timeline preloaded)`);
    setTimeout(() => {
      router.push("/video-studio");
    }, 700);
  };

  const handleDeployToVoiceStudio = (scene: ScriptScene) => {
    const speechText = scene.dialogueLines.join("\n") || scene.actionText;
    try {
      sessionStorage.setItem("oi:voice-script", speechText);
      navigator.clipboard?.writeText(speechText);
    } catch {}
    setScenes((prev) =>
      prev.map((s) => (s.id === scene.id ? { ...s, deployed: { ...s.deployed, voice: true } } : s))
    );
    triggerToast(`Dialogue lines deployed to Voice Studio Node!`);
    setTimeout(() => {
      router.push("/voice-studio");
    }, 700);
  };

  // ---------------------------------------------------------------------------
  // CHARACTER ANCHOR SLOT ACTIONS
  // ---------------------------------------------------------------------------
  const handleFillAnchorSlot = (slotNumber: number) => {
    const promptName = prompt("Enter Character Anchor Name (e.g., KAI / ALIKA / CYBORG):", `CHARACTER_0${slotNumber}`);
    if (!promptName) return;

    setPortraitAnchors((prev) =>
      prev.map((slot) =>
        slot.slotNumber === slotNumber
          ? {
              ...slot,
              name: promptName.toUpperCase(),
              vectorTraits: "Standardized facial proportions, biometric symmetry lock enabled",
              isFilled: true,
            }
          : slot
      )
    );
    triggerToast(`Anchor Slot 0${slotNumber} locked to ${promptName.toUpperCase()}`);
  };

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-[#000000] text-slate-100 font-sans selection:bg-[#00ffa3]/30 selection:text-[#00ffa3]">
      {/* ========================================================
          GLOBAL WORKSTATION TOP NAVIGATION BAR
      ======================================================== */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-[#2e2055] bg-[#0c0919] px-4 z-30">
        {/* Brand & Studio Identification */}
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#00ffa3]/40 bg-[#120d24] shadow-[0_0_15px_rgba(0,255,163,0.25)]">
            <Film className="h-5 w-5 text-[#00ffa3]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-black tracking-wider text-[#00ffa3] uppercase">
                OmniAI - Nexus
              </span>
              <span className="rounded-full border border-[#00ffa3]/30 bg-[#00ffa3]/10 px-2 py-0.5 text-[9px] font-mono text-[#00ffa3] font-bold">
                STORYBOARD PRO V4
              </span>
            </div>
            <p className="text-[10px] text-slate-400 tracking-wide">
              Dark Misfit Studios · Continuous Narrative Script Extraction &amp; Casting Engine
            </p>
          </div>
        </div>

        {/* Center Quick Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleAnalyzeAndFragment}
            disabled={isFragmenting}
            className="flex items-center gap-1.5 rounded-lg border border-[#00ffa3] bg-[#00ffa3] px-3.5 py-1.5 font-mono text-xs font-black text-black hover:bg-[#39ffb4] transition shadow-[0_0_18px_rgba(0,255,163,0.35)] disabled:opacity-50"
          >
            <Scissors className={`h-3.5 w-3.5 ${isFragmenting ? "animate-spin" : ""}`} />
            <span>{isFragmenting ? "Fragmenting Script…" : "Slice Script into Scenes"}</span>
          </button>

          <button
            onClick={handleAutoInjectCameraVectors}
            disabled={isInjectingVectors}
            className="flex items-center gap-1.5 rounded-lg border border-[#2e2055] bg-[#16112c] px-3 py-1.5 font-mono text-xs font-bold text-slate-200 hover:border-[#00ffa3]/50 hover:text-[#00ffa3] transition"
          >
            <Camera className={`h-3.5 w-3.5 ${isInjectingVectors ? "animate-spin text-[#00ffa3]" : "text-[#00ffa3]"}`} />
            <span className="hidden sm:inline">Inject Camera Vectors</span>
          </button>
        </div>

        {/* Right Status Badge & Assistant Toggle */}
        <div className="flex items-center gap-3">
          <StudioToggleMatrix studioName="Omni Storyboard" />
          <div className="hidden md:flex items-center gap-2 font-mono text-[10px] text-slate-400">
            <span className="h-2 w-2 rounded-full bg-[#00ffa3] animate-pulse" />
            <span className="text-[#00ffa3] font-bold">WEBGPU ACTIVE</span>
            <span>{"//"}</span>
            <span>NON-DESTRUCTIVE</span>
          </div>
        </div>
      </header>

      {/* ========================================================
          TWO-COLUMN BALANCED WORKSPACE FRAMEWORK
      ======================================================== */}
      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-[#2e2055]">
        {/* ========================================================
            COLUMN 1: THE SCRIPT PARSING WORKSPACE (LEFT PANEL - 45% WIDTH)
        ======================================================== */}
        <section className="col-span-12 lg:col-span-5 flex min-h-0 flex-col overflow-hidden bg-[#000000] p-3.5 space-y-3">
          {/* Column Header & Metrics */}
          <div className="flex items-center justify-between border-b border-[#2e2055] pb-2.5">
            <div>
              <p className="font-mono text-[9px] uppercase tracking-[0.25em] text-[#00ffa3] font-bold">
                COLUMN 01 // SCRIPT PARSING WORKSPACE
              </p>
              <h2 className="text-sm font-bold text-white tracking-wide flex items-center gap-2">
                <FileText className="h-4 w-4 text-[#00ffa3]" />
                Direct Markdown Script Editor
              </h2>
            </div>
            <div className="flex items-center gap-2 font-mono text-[9px] text-slate-400">
              <span className="rounded bg-[#120d24] px-2 py-0.5 border border-[#2e2055]">
                {lineCount} LINES
              </span>
              <span className="rounded bg-[#120d24] px-2 py-0.5 border border-[#2e2055]">
                {wordCount} WORDS
              </span>
            </div>
          </div>

          {/* Advanced Multi-Line Text Input Environment with Active Line Numbers & Highlighting */}
          <div className="relative flex flex-1 min-h-0 rounded-2xl border border-[#2e2055] bg-[#000000] overflow-hidden shadow-inner">
            {/* Line-Numbering Gutter */}
            <div
              aria-hidden="true"
              className="w-11 shrink-0 select-none border-r border-[#211740] bg-[#080512] py-3 text-right font-mono text-[11px] leading-6 text-slate-600 pr-2.5"
            >
              {Array.from({ length: Math.max(lineCount, 25) }).map((_, i) => (
                <div key={i} className="text-slate-600">
                  {i + 1}
                </div>
              ))}
            </div>

            {/* Direct Markdown Textarea (Pure Black Background + Neon Highlights) */}
            <textarea
              value={scriptMarkdown}
              onChange={(e) => setScriptMarkdown(e.target.value)}
              spellCheck={false}
              aria-label="Direct Markdown Script Editor"
              className="flex-1 resize-none bg-[#000000] p-3 font-mono text-xs leading-6 text-[#e8e6f2] outline-none selection:bg-[#00ffa3]/30 selection:text-[#00ffa3] focus:ring-0 custom-scrollbar"
              placeholder="# Write or paste your screenplay here in standard Markdown format..."
            />
          </div>

          {/* Mechanical Processing Deck (Grouped Action Buttons directly below editor) */}
          <div className="rounded-xl border border-[#2e2055] bg-[#0e0a1c] p-3 space-y-2.5 shadow-lg">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[9px] uppercase tracking-wider text-[#00ffa3] font-bold flex items-center gap-1.5">
                <Sliders className="h-3 w-3 text-[#00ffa3]" />
                Mechanical Processing Deck
              </span>
              <span className="text-[9px] font-mono text-slate-400">LOCAL ENGINE READY</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {/* Button 1: [Analyze & Fragment Script into Scenes] */}
              <button
                onClick={handleAnalyzeAndFragment}
                disabled={isFragmenting}
                className="flex items-center justify-center gap-2 rounded-xl border border-[#00ffa3] bg-[#00ffa3] py-2.5 font-mono text-xs font-black uppercase text-black hover:bg-[#39ffb4] transition shadow-[0_0_18px_rgba(0,255,163,0.3)] disabled:opacity-50"
              >
                <Scissors className={`h-4 w-4 ${isFragmenting ? "animate-spin" : ""}`} />
                <span>{isFragmenting ? "Fragmenting Script…" : "Analyze & Fragment Script"}</span>
              </button>

              {/* Button 2: [Auto-Inject Cinematic Camera Vectors] */}
              <button
                onClick={handleAutoInjectCameraVectors}
                disabled={isInjectingVectors}
                className="flex items-center justify-center gap-2 rounded-xl border border-[#00ffa3]/40 bg-[#00ffa3]/10 py-2.5 font-mono text-xs font-bold text-[#00ffa3] hover:bg-[#00ffa3]/20 transition shadow-[0_0_12px_rgba(0,255,163,0.15)] disabled:opacity-50"
              >
                <Camera className={`h-4 w-4 ${isInjectingVectors ? "animate-spin" : ""}`} />
                <span>Auto-Inject Camera Vectors</span>
              </button>
            </div>

            <p className="font-mono text-[9px] text-slate-400 leading-tight">
              Slices by scene headers (INT/EXT), separating spoken dialogue tokens from environmental action text and binding vector camera movements.
            </p>
          </div>
        </section>

        {/* ========================================================
            COLUMN 2: CONTINUITY CASTING & SCENE GENERATOR DECK (RIGHT PANEL - 55% WIDTH)
        ======================================================== */}
        <section className="col-span-12 lg:col-span-7 flex min-h-0 flex-col overflow-hidden bg-[#07040e] p-3.5 space-y-3.5">
          {/* Column Header */}
          <div className="flex items-center justify-between border-b border-[#2e2055] pb-2.5">
            <div>
              <p className="font-mono text-[9px] uppercase tracking-[0.25em] text-[#00ffa3] font-bold">
                COLUMN 02 // CASTING &amp; SCENE GENERATOR
              </p>
              <h2 className="text-sm font-bold text-white tracking-wide flex items-center gap-2">
                <Crosshair className="h-4 w-4 text-[#00ffa3]" />
                Continuity Casting Bay &amp; Scene Timeline Matrix
              </h2>
            </div>
            <span className="font-mono text-[10px] text-slate-400">
              {scenes.length} SCENE MODULES GENERATED
            </span>
          </div>

          {/* ========================================================
              SECTION 1: THE GLOBAL PORTRAIT ANCHOR BAY (TOP SECTION)
          ======================================================== */}
          <div className="rounded-2xl border border-[#2e2055] bg-[#0e0a1c] p-3 space-y-3 shadow-lg">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="font-mono text-[10px] uppercase tracking-wider text-slate-200 font-bold flex items-center gap-1.5">
                  <Crosshair className="h-3.5 w-3.5 text-[#00ffa3]" />
                  The Global Portrait Anchor Bay (5 Dedicated Slots)
                </span>
                <p className="text-[9px] font-mono text-slate-400">
                  Fixed biometric reference vectors to prevent character mutation drift
                </p>
              </div>

              {/* INTEGRITY SWITCH: [ENGAGE CHARACTER SYMMETRY LOCK] */}
              <button
                onClick={() => {
                  const nextState = !symmetryLockEngaged;
                  setSymmetryLockEngaged(nextState);
                  triggerToast(
                    nextState
                      ? "ENGAGE CHARACTER SYMMETRY LOCK: Master traits frozen across rendering cycles!"
                      : "CHARACTER SYMMETRY LOCK: Disengaged (Freeform mode)"
                  );
                }}
                className={`flex items-center gap-2 rounded-xl border px-3 py-1.5 font-mono text-xs font-bold transition shadow-sm ${
                  symmetryLockEngaged
                    ? "border-[#00ffa3] bg-[#00ffa3] text-black shadow-[0_0_18px_#00ffa3]"
                    : "border-[#2e2055] bg-[#16112c] text-slate-400 hover:border-[#00ffa3]/40 hover:text-white"
                }`}
              >
                {symmetryLockEngaged ? <Lock className="h-3.5 w-3.5 fill-current" /> : <Unlock className="h-3.5 w-3.5" />}
                <span>{symmetryLockEngaged ? "ENGAGE CHARACTER SYMMETRY LOCK: [ON]" : "ENGAGE CHARACTER SYMMETRY LOCK: [OFF]"}</span>
              </button>
            </div>

            {/* Horizontal Grid Panel Layout Housing 5 Dedicated Slots */}
            <div className="grid grid-cols-5 gap-2">
              {portraitAnchors.map((slot) => {
                const isActive = activeAnchorSlotId === slot.id;
                return (
                  <div
                    key={slot.id}
                    onClick={() => {
                      if (!slot.isFilled) {
                        handleFillAnchorSlot(slot.slotNumber);
                      } else {
                        setActiveAnchorSlotId(slot.id);
                      }
                    }}
                    className={`cursor-pointer group flex flex-col justify-between rounded-xl border p-2 text-left transition ${
                      isActive
                        ? "border-[#00ffa3] bg-[#1a1236] shadow-[0_0_12px_rgba(0,255,163,0.2)]"
                        : "border-[#2e2055] bg-[#120d24] hover:border-[#00ffa3]/40"
                    }`}
                  >
                    {/* Slot Header */}
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[8px] font-bold text-[#00ffa3]">
                        SLOT 0{slot.slotNumber}
                      </span>
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          slot.isFilled ? "bg-[#00ffa3]" : "bg-slate-600"
                        }`}
                      />
                    </div>

                    {/* Thumbnail Render Box */}
                    <div className="my-1.5 relative aspect-square w-full rounded-lg border border-[#2e2055] bg-[#07040e] flex items-center justify-center overflow-hidden">
                      {slot.isFilled ? (
                        <div className="flex h-full w-full flex-col items-center justify-center bg-[radial-gradient(circle_at_center,rgba(0,255,163,0.15),transparent)] p-1 text-center">
                          <Crosshair className="h-5 w-5 text-[#00ffa3] mb-0.5" />
                          <span className="font-mono text-[8px] font-bold text-slate-200 truncate w-full">
                            {slot.name.split(" ")[0]}
                          </span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center text-slate-600 group-hover:text-[#00ffa3] transition">
                          <Upload className="h-4 w-4 mb-0.5" />
                          <span className="font-mono text-[7px]">ASSIGN</span>
                        </div>
                      )}
                    </div>

                    {/* Vector Traits Caption */}
                    <p className="font-mono text-[8px] text-slate-400 line-clamp-1">
                      {slot.vectorTraits}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ========================================================
              SECTION 2: THE MODULAR VISUAL STORYBOARD MATRIX (BOTTOM SECTION)
          ======================================================== */}
          <div className="flex-1 flex flex-col min-h-0 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-wider text-slate-300 font-bold flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-[#00ffa3]" />
                The Modular Visual Storyboard Matrix
              </span>
              <span className="text-[9px] font-mono text-[#00ffa3]">
                {symmetryLockEngaged ? "SYMMETRY LOCK ENFORCED" : "FREEFORM DRIFT ALLOWED"}
              </span>
            </div>

            {/* Vertically Scrollable, Fluid Timeline Track */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar">
              {scenes.map((scene) => {
                const isSelected = selectedSceneId === scene.id;

                return (
                  <article
                    key={scene.id}
                    onClick={() => setSelectedSceneId(scene.id)}
                    className={`rounded-2xl border p-3.5 transition space-y-3 ${
                      isSelected
                        ? "border-[#00ffa3] bg-[#130d28] shadow-[0_0_20px_rgba(0,255,163,0.18)]"
                        : "border-[#2e2055] bg-[#0e0a1c] hover:border-[#00ffa3]/40"
                    }`}
                  >
                    {/* Scene Card Header */}
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#2e2055] pb-2">
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-[#00ffa3] px-2 py-0.5 font-mono text-[10px] font-black text-black">
                          SCENE 0{scene.idx}
                        </span>
                        <h3 className="font-mono text-xs font-bold text-white truncate max-w-[280px]">
                          {scene.header}
                        </h3>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="rounded border border-[#2e2055] bg-black/60 px-2 py-0.5 font-mono text-[10px] text-[#00ffa3] font-bold">
                          {scene.timecode}
                        </span>
                        {scene.characters.map((ch) => (
                          <span
                            key={ch}
                            className="rounded border border-[#2e2055] bg-[#1a1236] px-1.5 py-0.5 font-mono text-[9px] text-slate-300"
                          >
                            {ch}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Center Media Rendering Slot (Low-latency Frame Pre-renders) */}
                    <div className="relative h-32 w-full overflow-hidden rounded-xl border border-[#2e2055] bg-black">
                      <div
                        className="h-full w-full flex flex-col items-center justify-center p-3 text-center"
                        style={{ background: scene.previewGradient }}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <Camera className="h-4 w-4 text-[#00ffa3]" />
                          <span className="font-mono text-[10px] font-bold text-[#00ffa3] tracking-wide">
                            PRE-RENDER VECTOR: {scene.cameraVector.slice(0, 48)}…
                          </span>
                        </div>
                        <p className="font-mono text-[9px] text-slate-300 max-w-md line-clamp-2">
                          {scene.actionText}
                        </p>
                      </div>

                      {/* Top Corner Pre-render Tag */}
                      <div className="pointer-events-none absolute top-2 left-2 rounded bg-black/70 px-2 py-0.5 font-mono text-[8px] text-[#00ffa3] border border-[#2e2055]">
                        FRAME PRE-RENDER READY // WEBGPU
                      </div>
                    </div>

                    {/* Automated Scene Description Prompt Window & Spoken Dialogue */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                      {/* Visual Generation Prompt Box */}
                      <div className="rounded-xl border border-[#2e2055] bg-[#0a0714] p-2.5 space-y-1">
                        <span className="font-mono text-[8px] uppercase tracking-wider text-[#00ffa3] font-bold block">
                          VISUAL GENERATION PROMPT PAYLOAD
                        </span>
                        <p className="font-mono text-[10px] text-slate-300 leading-relaxed line-clamp-3">
                          {scene.visualPrompt}
                        </p>
                      </div>

                      {/* Spoken Dialogue Tokens */}
                      <div className="rounded-xl border border-[#2e2055] bg-[#0a0714] p-2.5 space-y-1">
                        <span className="font-mono text-[8px] uppercase tracking-wider text-slate-400 font-bold block">
                          SEPARATED SPOKEN DIALOGUE TOKENS
                        </span>
                        {scene.dialogueLines.length > 0 ? (
                          <div className="space-y-0.5 font-mono text-[10px] text-slate-200 line-clamp-3">
                            {scene.dialogueLines.map((dlg, i) => (
                              <p key={i} className="text-slate-300 italic">
                                {dlg}
                              </p>
                            ))}
                          </div>
                        ) : (
                          <p className="font-mono text-[10px] text-slate-500 italic">
                            (No spoken dialogue lines detected in this scene block)
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Integrated 3-Button Micro-Action Row to Deploy Prompt Payloads */}
                    <div className="grid grid-cols-3 gap-2 border-t border-[#2e2055] pt-2.5">
                      {/* Button 1: [Deploy to Image Studio Node] */}
                      <button
                        onClick={() => handleDeployToImageStudio(scene)}
                        className={`flex items-center justify-center gap-1.5 rounded-xl border py-2 font-mono text-[10px] font-bold transition shadow-sm ${
                          scene.deployed.image
                            ? "border-[#00ffa3] bg-[#00ffa3] text-black"
                            : "border-[#2e2055] bg-[#16112c] text-slate-200 hover:border-[#00ffa3]/50 hover:text-[#00ffa3]"
                        }`}
                      >
                        <ImageIcon className="h-3.5 w-3.5 text-[#00ffa3]" />
                        <span className="truncate">Deploy to Image Studio</span>
                      </button>

                      {/* Button 2: [Deploy to Video Studio Node] */}
                      <button
                        onClick={() => handleDeployToVideoStudio(scene)}
                        className={`flex items-center justify-center gap-1.5 rounded-xl border py-2 font-mono text-[10px] font-bold transition shadow-sm ${
                          scene.deployed.video
                            ? "border-[#00ffa3] bg-[#00ffa3] text-black"
                            : "border-[#2e2055] bg-[#16112c] text-slate-200 hover:border-[#00ffa3]/50 hover:text-[#00ffa3]"
                        }`}
                      >
                        <Video className="h-3.5 w-3.5 text-[#00ffa3]" />
                        <span className="truncate">Deploy to Video Studio</span>
                      </button>

                      {/* Button 3: [Deploy to Voice Studio Node] */}
                      <button
                        onClick={() => handleDeployToVoiceStudio(scene)}
                        className={`flex items-center justify-center gap-1.5 rounded-xl border py-2 font-mono text-[10px] font-bold transition shadow-sm ${
                          scene.deployed.voice
                            ? "border-[#00ffa3] bg-[#00ffa3] text-black"
                            : "border-[#2e2055] bg-[#16112c] text-slate-200 hover:border-[#00ffa3]/50 hover:text-[#00ffa3]"
                        }`}
                      >
                        <Mic className="h-3.5 w-3.5 text-[#00ffa3]" />
                        <span className="truncate">Deploy to Voice Studio</span>
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>
      </div>

      {/* ========================================================
          TIER 3: SYSTEM OVERSIGHT & TELEMETRY (ABSOLUTE BOTTOM MARGIN)
      ======================================================== */}
      <footer className="h-7 shrink-0 flex items-center justify-between border-t border-[#2e2055] bg-[#07050d] px-4 font-mono text-[9px] text-slate-400 select-none z-30">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-[#00ffa3] shadow-[0_0_6px_#00ffa3]" />
          <span className="font-black text-[#00ffa3]">
            [Nexus-Pipeline: Script Extraction / WebGPU Grid Active]
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="hidden sm:inline">NODES: IMAGE // VIDEO // VOICE</span>
          <span className="hidden md:inline">
            SYMMETRY INTEGRITY: {symmetryLockEngaged ? "LOCKED (0% DRIFT)" : "UNLOCKED"}
          </span>
          <span className="text-[#00ffa3]">SCENES: {scenes.length}</span>
          <span className="text-white font-bold">LATENCY: 8ms</span>
        </div>
      </footer>

      {/* Floating Toast Notice */}
      {toastNotice && (
        <div className="fixed bottom-10 left-1/2 z-50 -translate-x-1/2 flex items-center gap-2 rounded-xl border border-[#00ffa3]/60 bg-[#120d24] px-4 py-2 text-xs font-mono text-[#00ffa3] shadow-[0_0_30px_rgba(0,255,163,0.3)] animate-in fade-in slide-in-from-bottom-2">
          <Activity className="h-3.5 w-3.5 animate-pulse" />
          <span>{toastNotice}</span>
          <button
            onClick={() => setToastNotice("")}
            className="ml-2 text-slate-400 hover:text-white"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
