"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  Upload,
  Music,
  Film,
  Layers,
  Cpu,
  RefreshCw,
  Download,
  Crosshair,
  ShieldAlert,
  Wand2,
  ChevronRight,
  Link as LinkIcon,
  Check,
  Zap,
  Activity,
  Camera,
  Tv,
  Radio,
  Sliders,
  Volume2,
  VolumeX,
  Grid,
  Mic,
  Trash2,
  Copy,
  FolderDown,
  Repeat
} from "lucide-react";
import { mediaVault, type VaultAsset } from "@/lib/mediaVault";
import StudioToggleMatrix from "@/components/StudioToggleMatrix";

/* =========================================================================
   DARK MISFIT STUDIOS — OMNIAI - NEXUS: OMNIBEAT STUDIO
   AI Music Video Director Terminal (Desktop Web-Native Workstation)
   Palette:
     - Canvas Background: #000000 (Pure Black)
     - Layer Container Blocks: Dark Bluish Purple (#0e0a1c, #120d24, #16112c, #1d1538)
     - Active Selection / Text Highlights: Very Light Neon Bluish Green (#00ffa3, #39ffb4)
   ========================================================================= */

type ProductionMode = "story" | "stage" | "vj_loop";

interface ProductionModeConfig {
  id: ProductionMode;
  title: string;
  badge: string;
  description: string;
  icon: typeof Film;
}

const PRODUCTION_MODES: ProductionModeConfig[] = [
  {
    id: "story",
    title: "Story Narrative Mode",
    badge: "CINEMATIC TIMELINE",
    description: "Drives cinematic storytelling timelines.",
    icon: Film,
  },
  {
    id: "stage",
    title: "Stage Performance Mode",
    badge: "LIP-SYNC & DANCE",
    description: "Orchestrates local lip-sync dance frameworks.",
    icon: Tv,
  },
  {
    id: "vj_loop",
    title: "Abstract VJ Visualizer Loop",
    badge: "AUDIO-REACTIVE VJ",
    description: "Compiles seamless audio-reactive background assets.",
    icon: Radio,
  },
];

const AUTOMATION_STEPS = [
  { id: 1, name: "Music Analysis", code: "AUDIO_SPEC" },
  { id: 2, name: "Style Lock", code: "AESTHETIC" },
  { id: 3, name: "Creative Brief", code: "VISION_MAP" },
  { id: 4, name: "Asset Casting", code: "FACE_ANCHOR" },
  { id: 5, name: "Scene Planning", code: "BLOCK_CHART" },
  { id: 6, name: "Shot Blueprint", code: "CAMERA_GRID" },
  { id: 7, name: "Storyboard Frames", code: "FRAME_GEN" },
  { id: 8, name: "Video Compilation", code: "TENSOR_RENDER" },
  { id: 9, name: "Final Merge", code: "MASTER_MUX" },
] as const;

interface StoryboardScene {
  id: string;
  section: "Intro" | "Verse" | "Chorus" | "Drop" | "Outro";
  timecode: string;
  startTime: number;
  duration: number;
  prompt: string;
  cameraMovement: string;
  characterAnchorId: string;
  lightingStyle: string;
  renderStatus: "ready" | "rendering" | "queued" | "regenerating";
  thumbnailColor: string;
  accentColor: string;
}

const INITIAL_SCENES: StoryboardScene[] = [
  {
    id: "scene-1",
    section: "Intro",
    timecode: "00:00 - 00:22",
    startTime: 0,
    duration: 22,
    prompt: "A solitary android protagonist draped in obsidian velvet stands under a flickering violet holographic sign on a rain-slicked boulevard.",
    cameraMovement: "Slow creeping push-in, low 24mm anamorphic lens, shallow depth of field",
    characterAnchorId: "ANCHOR-MISFIT-01 (Face Symmetry Locked)",
    lightingStyle: "Low-key volumetric cyan rim, ambient dark purple haze",
    renderStatus: "ready",
    thumbnailColor: "#16112c",
    accentColor: "#a855f7",
  },
  {
    id: "scene-2",
    section: "Verse",
    timecode: "00:22 - 00:54",
    startTime: 22,
    duration: 32,
    prompt: "Medium close-up singing into an antique condenser microphone wrapped in glowing neon cables as rain drops refract neon pink billboard light.",
    cameraMovement: "Subtle handheld orbital drift, 35mm portrait focal length",
    characterAnchorId: "ANCHOR-MISFIT-01 (Face Symmetry Locked)",
    lightingStyle: "Split lighting, neon magenta key with cyan fill shadows",
    renderStatus: "ready",
    thumbnailColor: "#130f28",
    accentColor: "#00f2fe",
  },
  {
    id: "scene-3",
    section: "Chorus",
    timecode: "00:54 - 01:32",
    startTime: 54,
    duration: 38,
    prompt: "High-octane climax: character surrounded by shattered glass shards suspended mid-air as explosive bass waves trigger neon shockwave rings.",
    cameraMovement: "Rapid 360-degree rotational dolly zoom with anamorphic horizontal flares",
    characterAnchorId: "ANCHOR-MISFIT-01 (Face Symmetry Locked)",
    lightingStyle: "Stroboscopic neon bluish-green (#00ffa3) laser matrix flashes",
    renderStatus: "ready",
    thumbnailColor: "#1a1236",
    accentColor: "#00ffa3",
  },
  {
    id: "scene-4",
    section: "Drop",
    timecode: "01:32 - 02:08",
    startTime: 92,
    duration: 36,
    prompt: "Abstract cybernetic transfiguration: body disintegrates into glowing wireframe nodes and liquid obsidian waveforms synchronized to sub-808 kicks.",
    cameraMovement: "Infinite hyper-lapse camera plunging through dimensional lattice corridors",
    characterAnchorId: "ANCHOR-MISFIT-01 (Wireframe Geometry)",
    lightingStyle: "Pure obsidian void with ultra-bright reactive laser grid lines",
    renderStatus: "ready",
    thumbnailColor: "#170f2e",
    accentColor: "#e879f9",
  },
  {
    id: "scene-5",
    section: "Outro",
    timecode: "02:08 - 02:45",
    startTime: 128,
    duration: 37,
    prompt: "Protagonist standing on skyscraper edge looking down over endless cyberpunk megacity smog as storm clouds absorb the dying neon horizon glow.",
    cameraMovement: "Extreme wide pulling upward back into night sky fog, crane elevation",
    characterAnchorId: "ANCHOR-MISFIT-01 (Face Symmetry Locked)",
    lightingStyle: "Deep twilight obsidian noir, dying violet ember highlights",
    renderStatus: "ready",
    thumbnailColor: "#110c22",
    accentColor: "#9490ac",
  },
];

const ONBEAT_EFFECTS = [
  { id: "strobe", label: "Strobe Hits [Drum Onset]", key: "1", tag: "STROBE" },
  { id: "glitch", label: "Glitch Filters [Bass Drop]", key: "2", tag: "RGB GLITCH" },
  { id: "volumetric", label: "Volumetric Light Burst", key: "3", tag: "GOD RAYS" },
  { id: "slowmo", label: "Slow-Mo Camera Drift", key: "4", tag: "0.5x SPEED" },
  { id: "scanlines", label: "VHS Scanline Warp", key: "5", tag: "CRT RETRO" },
  { id: "bassshake", label: "Bass Shake Rumble", key: "6", tag: "CAMERA SHAKE" },
  { id: "flare", label: "Neon Inversion Flare", key: "7", tag: "CYBER INVERT" },
  { id: "anamorphic", label: "Anamorphic Streak", key: "8", tag: "OPTICAL FLARE" },
];

const CINEMATIC_DIRECTIVES = [
  "Tracking shot with 35mm anamorphic bokeh",
  "High-speed 360-degree rotational dolly zoom",
  "Low-angle Dutch tilt with cyberpunk rim lighting",
  "Drone flythrough piercing heavy obsidian rain",
  "Handheld intimate focus pulling on chorus onset",
  "Vertigo rack-focus transitioning into neon fog",
];

export interface AudioStemTrack {
  id: "master" | "vocals" | "drums" | "synths";
  name: string;
  role: string;
  color: string;
  muted: boolean;
  solo: boolean;
  volumeDb: number;
  offsetMs: number; // Alignment offset in ms (-50ms to +50ms)
  peaks: number[];
}

function generateStemPeaks(seed: number, count = 80, density = 0.5): number[] {
  return Array.from({ length: count }, (_, i) => {
    const raw =
      Math.sin(i * seed * 0.28) * 0.42 +
      Math.sin(i * 0.75 + seed) * 0.28 +
      Math.cos(i * 1.4) * 0.25;
    return Math.max(0.12, Math.min(1.0, Math.abs(raw) * density + 0.16));
  });
}

const INITIAL_STEMS: AudioStemTrack[] = [
  {
    id: "master",
    name: "Master Stereo Bus",
    role: "Full Composite Stereo Mix",
    color: "#00D2FF",
    muted: false,
    solo: false,
    volumeDb: 0.0,
    offsetMs: 0,
    peaks: generateStemPeaks(2.1, 80, 0.95),
  },
  {
    id: "vocals",
    name: "Vocals Stem",
    role: "Lead Acapella & Doubles",
    color: "#FF003C",
    muted: false,
    solo: false,
    volumeDb: -1.2,
    offsetMs: 0,
    peaks: generateStemPeaks(4.7, 80, 0.72),
  },
  {
    id: "drums",
    name: "Drums & 808 Bass",
    role: "Kick / Snare / Sub Transients",
    color: "#00ffa3",
    muted: false,
    solo: false,
    volumeDb: 0.5,
    offsetMs: 0,
    peaks: generateStemPeaks(7.3, 80, 0.88),
  },
  {
    id: "synths",
    name: "Synths & Guitars",
    role: "Harmonic Pads & Sweeps",
    color: "#c084fc",
    muted: false,
    solo: false,
    volumeDb: -2.0,
    offsetMs: 0,
    peaks: generateStemPeaks(9.5, 80, 0.65),
  },
];

export default function OmniBeatStudioNexus() {
  // ---------------------------------------------------------------------------
  // PANEL 1 STATE: PRODUCTION BRIEF & SPECTRAL INTAKE
  // ---------------------------------------------------------------------------
  const [trackName, setTrackName] = useState<string>("Dark_Misfit_Cyberpunk_Master_48k.wav");
  const [trackUrlInput, setTrackUrlInput] = useState<string>("");
  const [trackDuration, setTrackDuration] = useState<number>(165); // 02:45 in seconds
  const [isPlayingAudio, setIsPlayingAudio] = useState<boolean>(false);
  const [audioPlayhead, setAudioPlayhead] = useState<number>(24);
  const [bpm, setBpm] = useState<number>(128);
  const [spectralCutoff, setSpectralCutoff] = useState<number>(8400); // 8.4 kHz
  const [musicGridBars, setMusicGridBars] = useState<number>(64);
  const [onsetConfidence, setOnsetConfidence] = useState<number>(98.6);

  const [productionMode, setProductionMode] = useState<ProductionMode>("story");
  const [scenePrompt, setScenePrompt] = useState<string>(
    "A melancholic cyberpunk cyborg with glowing neon bluish-green circuitry walking through the obsidian rain of Neo-Tokyo, mourning a lost bond. Volumetric lighting, 8k octane render, cinematic film grain."
  );
  const [isEnhancingCamera, setIsEnhancingCamera] = useState<boolean>(false);

  // ---------------------------------------------------------------------------
  // PANEL 2 STATE: THE 9-STEP AUTOMATION TRACKER & VIEWPORT
  // ---------------------------------------------------------------------------
  const [activeStep, setActiveStep] = useState<number>(3); // currently at Creative Brief / Step 3
  const [completedSteps, setCompletedSteps] = useState<number[]>([1, 2]);
  const [isAutomationRunning, setIsAutomationRunning] = useState<boolean>(false);
  const [automationLog, setAutomationLog] = useState<string>("System Idle. Ready for autonomous render sequence.");

  // Viewport Settings
  const [aspectRatio, setAspectRatio] = useState<"16:9" | "9:16" | "1:1">("16:9");
  const [showSafeZones, setShowSafeZones] = useState<boolean>(true);
  const [activeEffects, setActiveEffects] = useState<Set<string>>(new Set());
  const [viewportTimecode, setViewportTimecode] = useState<string>("00:24.00");
  const [activeSceneIdx, setActiveSceneIdx] = useState<number>(0);

  // Multi-Track Audio Stems State & Visual Alignment Deck
  const [audioStems, setAudioStems] = useState<AudioStemTrack[]>(INITIAL_STEMS);
  const [stemZoom, setStemZoom] = useState<number>(1);
  const [beatSyncStems, setBeatSyncStems] = useState<boolean>(true);
  const [selectedStemId, setSelectedStemId] = useState<string>("master");
  const [isStemDeckExpanded, setIsStemDeckExpanded] = useState<boolean>(true);

  // Micro-timing Alignment Nudge Handlers for Stems
  const handleNudgeStem = (stemId: string, deltaMs: number) => {
    setAudioStems((prev) =>
      prev.map((s) =>
        s.id === stemId
          ? { ...s, offsetMs: Math.max(-50, Math.min(50, s.offsetMs + deltaMs)) }
          : s
      )
    );
  };

  const handleResetStemOffset = (stemId: string) => {
    setAudioStems((prev) =>
      prev.map((s) => (s.id === stemId ? { ...s, offsetMs: 0 } : s))
    );
  };

  const handleAutoAlignAllStems = () => {
    setAudioStems((prev) => prev.map((s) => ({ ...s, offsetMs: 0 })));
    triggerToast("⚡ Auto-Aligned: 4 audio stems phase-locked to 128 BPM grid (0ms phase drift).");
  };

  const handleToggleStemMute = (stemId: string) => {
    setAudioStems((prev) =>
      prev.map((s) => (s.id === stemId ? { ...s, muted: !s.muted } : s))
    );
  };

  const handleToggleStemSolo = (stemId: string) => {
    setAudioStems((prev) =>
      prev.map((s) => (s.id === stemId ? { ...s, solo: !s.solo } : s))
    );
  };

  const handleStemVolumeChange = (stemId: string, volDb: number) => {
    setAudioStems((prev) =>
      prev.map((s) => (s.id === stemId ? { ...s, volumeDb: volDb } : s))
    );
  };

  // Canvas Viewport Ref
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // ---------------------------------------------------------------------------
  // PANEL 3 STATE: MODULAR STORYBOARD TIMELINE
  // ---------------------------------------------------------------------------
  const [storyboardScenes, setStoryboardScenes] = useState<StoryboardScene[]>(INITIAL_SCENES);
  const [selectedSceneId, setSelectedSceneId] = useState<string>("scene-1");
  const [regeneratingSceneId, setRegeneratingSceneId] = useState<string | null>(null);
  const [globalAnchorId, setGlobalAnchorId] = useState<string>("ANCHOR-MISFIT-01");
  const [toastMessage, setToastMessage] = useState<string>("");

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((cur) => (cur === msg ? "" : cur));
    }, 4000);
  };

  // ---------------------------------------------------------------------------
  // AUDIO PLAYBACK & REAL-TIME PROGRESS SIMULATION
  // ---------------------------------------------------------------------------
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isPlayingAudio) {
      interval = setInterval(() => {
        setAudioPlayhead((prev) => {
          const next = prev + 0.1;
          if (next >= trackDuration) {
            setIsPlayingAudio(false);
            return 0;
          }
          const min = Math.floor(next / 60);
          const sec = Math.floor(next % 60);
          const cent = Math.floor((next % 1) * 100);
          setViewportTimecode(
            `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}.${String(cent).padStart(2, "0")}`
          );
          return next;
        });
      }, 100);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPlayingAudio, trackDuration]);

  // ---------------------------------------------------------------------------
  // WEBGL PROCEDURAL VIEWPORT RENDER LOOP
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let tick = 0;

    const render = () => {
      tick += 0.04;
      const width = canvas.width;
      const height = canvas.height;

      // 1. Clear to Pure Black Canvas Background (#000000)
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, width, height);

      // 2. Draw Cyberpunk Horizon Grid
      ctx.save();
      const horizon = height * 0.58;
      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, "#080512");
      gradient.addColorStop(0.55, "#140e28");
      gradient.addColorStop(0.58, "#251745");
      gradient.addColorStop(1, "#000000");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      // Perspective Grid Lines
      ctx.strokeStyle = "rgba(108, 99, 255, 0.18)";
      ctx.lineWidth = 1;
      const centerX = width / 2;
      for (let i = -14; i <= 14; i++) {
        const xOffset = i * (width / 14);
        ctx.beginPath();
        ctx.moveTo(centerX + xOffset * 0.15, horizon);
        ctx.lineTo(centerX + xOffset * 2.2, height);
        ctx.stroke();
      }

      // Horizontal depth lines
      for (let y = horizon; y <= height; y += (height - horizon) / 9) {
        ctx.strokeStyle = "rgba(0, 242, 254, 0.12)";
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
      ctx.restore();

      // 3. Audio Spectral Pulse Waves (Light Neon Bluish Green: #00ffa3)
      ctx.save();
      const waveY = horizon + Math.sin(tick * 2) * 15;
      ctx.beginPath();
      ctx.moveTo(0, waveY);
      for (let x = 0; x <= width; x += 12) {
        const distFromCenter = Math.abs(x - width / 2) / (width / 2);
        const amp = (1 - distFromCenter) * (isPlayingAudio ? 45 : 18);
        const y = waveY + Math.sin(x * 0.02 + tick * 3) * amp * Math.cos(tick + x * 0.005);
        ctx.lineTo(x, y);
      }
      ctx.strokeStyle = "#00ffa3";
      ctx.lineWidth = 2.5;
      ctx.shadowColor = "#00ffa3";
      ctx.shadowBlur = 18;
      ctx.stroke();
      ctx.restore();

      // 4. Central Visual Layer Simulation (Android Subject Wireframe Silhouette)
      ctx.save();
      const subjX = width / 2;
      const subjY = horizon - 20;

      // Glow Aura behind subject
      const aura = ctx.createRadialGradient(subjX, subjY - 40, 10, subjX, subjY - 40, 120);
      aura.addColorStop(0, "rgba(0, 255, 163, 0.25)");
      aura.addColorStop(0.5, "rgba(108, 99, 255, 0.15)");
      aura.addColorStop(1, "transparent");
      ctx.fillStyle = aura;
      ctx.beginPath();
      ctx.arc(subjX, subjY - 40, 120, 0, Math.PI * 2);
      ctx.fill();

      // Draw stylized head/bust wireframe silhouette
      ctx.strokeStyle = "#e8e6f2";
      ctx.lineWidth = 1.5;
      ctx.shadowColor = "#39ffb4";
      ctx.shadowBlur = 10;

      // Head
      ctx.beginPath();
      ctx.arc(subjX, subjY - 70, 32, 0, Math.PI * 2);
      ctx.stroke();

      // Cybernetic Headpiece / Visor
      ctx.strokeStyle = "#00ffa3";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(subjX - 28, subjY - 72);
      ctx.lineTo(subjX + 28, subjY - 72);
      ctx.stroke();

      // Torso / Shoulders
      ctx.strokeStyle = "#8b7fff";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(subjX - 65, subjY + 40);
      ctx.lineTo(subjX - 25, subjY - 35);
      ctx.lineTo(subjX + 25, subjY - 35);
      ctx.lineTo(subjX + 65, subjY + 40);
      ctx.stroke();
      ctx.restore();

      // 5. Onbeat Active Effects Shaders (Strobe, Glitch, God Rays)
      if (activeEffects.has("strobe")) {
        ctx.fillStyle = `rgba(255, 255, 255, ${0.4 + Math.sin(tick * 25) * 0.35})`;
        ctx.fillRect(0, 0, width, height);
      }

      if (activeEffects.has("glitch")) {
        const sliceY = (Math.sin(tick * 10) * 0.5 + 0.5) * height;
        ctx.fillStyle = "rgba(0, 242, 254, 0.3)";
        ctx.fillRect(0, sliceY, width, 18);
        ctx.fillStyle = "rgba(255, 42, 109, 0.3)";
        ctx.fillRect(8, sliceY + 6, width, 14);
      }

      if (activeEffects.has("scanlines")) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
        for (let y = 0; y < height; y += 4) {
          ctx.fillRect(0, y, width, 1.5);
        }
      }

      if (activeEffects.has("flare")) {
        ctx.fillStyle = "rgba(0, 255, 163, 0.12)";
        ctx.fillRect(0, 0, width, height);
      }

      // 6. [Show App Safe Zones] HIGH-CONTRAST VIBRANT NEON GREEN HAZARD OVERLAY (#00ffcc)
      if (showSafeZones) {
        ctx.save();
        ctx.strokeStyle = "#00ffcc";
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 6]);

        // Top Safe Margin (TikTok / YouTube Shorts Sound Header)
        const topH = height * 0.12;
        ctx.strokeRect(width * 0.05, topH, width * 0.9, height * 0.82 - topH);

        // Right Edge Icon Stack Hazard Box (Heart, Comment, Share, Audio Disc)
        const rightW = width * 0.16;
        const rightY = height * 0.28;
        const rightH = height * 0.52;
        ctx.fillStyle = "rgba(0, 255, 204, 0.15)";
        ctx.fillRect(width - rightW, rightY, rightW - 8, rightH);
        ctx.strokeRect(width - rightW, rightY, rightW - 8, rightH);

        // Bottom Caption Hazard Box
        const botH = height * 0.18;
        ctx.fillStyle = "rgba(0, 255, 204, 0.18)";
        ctx.fillRect(width * 0.05, height - botH, width * 0.72, botH - 10);
        ctx.strokeRect(width * 0.05, height - botH, width * 0.72, botH - 10);

        // Warning Hazard Labels in Vibrant Neon Green
        ctx.font = "bold 10px monospace";
        ctx.fillStyle = "#00ffcc";
        ctx.fillText("⚠ HAZARD: APP SAFE ZONE [TIKTOK / REELS / SHORTS]", width * 0.07, topH - 8);
        ctx.fillText("ICONS HAZARD", width - rightW + 4, rightY + 16);
        ctx.fillText("TITLE & CAPTION OVERLAY", width * 0.07, height - botH + 18);
        ctx.restore();
      }

      animationFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isPlayingAudio, showSafeZones, activeEffects]);

  // ---------------------------------------------------------------------------
  // INTERACTIVE ACTIONS
  // ---------------------------------------------------------------------------

  // Handle [Enhance Camera Direction] button
  const handleEnhanceCameraDirection = () => {
    setIsEnhancingCamera(true);
    setTimeout(() => {
      const randomDirective =
        CINEMATIC_DIRECTIVES[Math.floor(Math.random() * CINEMATIC_DIRECTIVES.length)];
      const enhanced = `${scenePrompt.trim()} Camera direction: ${randomDirective}, anamorphic 2.39:1 scope framing, synchronized motion tracking on kick drums.`;
      setScenePrompt(enhanced);
      setIsEnhancingCamera(false);
      triggerToast("Camera Direction Injected: Anamorphic tracking matrices mapped!");
    }, 600);
  };

  // Run the 9-Step Automation Pipeline sequentially
  const handleRunFullAutomation = () => {
    if (isAutomationRunning) return;
    setIsAutomationRunning(true);
    setActiveStep(1);
    setCompletedSteps([]);
    setAutomationLog("Initializing 9-Step Autonomous Direction Pipeline...");

    let step = 1;
    const interval = setInterval(() => {
      setCompletedSteps((prev) => [...prev, step]);
      step += 1;
      if (step <= 9) {
        setActiveStep(step);
        setAutomationLog(`Step ${step}/9 Active: ${AUTOMATION_STEPS[step - 1].name} compiling...`);
      } else {
        clearInterval(interval);
        setIsAutomationRunning(false);
        setActiveStep(9);
        setAutomationLog("Pipeline complete! All 9 steps compiled. Master video ready.");
        triggerToast("9-Step Automated Direction Loop Complete!");
      }
    }, 850);
  };

  // Toggle Effect from Onbeat Effects Deck
  const handleToggleEffect = (effectId: string, effectLabel: string) => {
    setActiveEffects((prev) => {
      const next = new Set(prev);
      if (next.has(effectId)) {
        next.delete(effectId);
        triggerToast(`Effect Disabled: ${effectLabel}`);
      } else {
        next.add(effectId);
        triggerToast(`Effect Injected: ${effectLabel}`);
      }
      return next;
    });
  };

  // [Regenerate Scene Segment Only] Action
  const handleRegenerateSceneOnly = (sceneId: string) => {
    setRegeneratingSceneId(sceneId);
    setStoryboardScenes((prev) =>
      prev.map((s) => (s.id === sceneId ? { ...s, renderStatus: "regenerating" } : s))
    );
    triggerToast(`Non-destructive re-render initiated for scene ${sceneId} (Isolated Node Pass)`);

    setTimeout(() => {
      setStoryboardScenes((prev) =>
        prev.map((s) => (s.id === sceneId ? { ...s, renderStatus: "ready" } : s))
      );
      setRegeneratingSceneId(null);
      triggerToast(`Scene ${sceneId} isolated re-generation finished. Remaining song preserved.`);
    }, 1800);
  };

  // [Swap Character Anchor ID] Action
  const handleSwapCharacterAnchor = (sceneId: string) => {
    const anchors = ["ANCHOR-MISFIT-01", "ANCHOR-CYBORG-02", "ANCHOR-VALKYRIE-03"];
    setStoryboardScenes((prev) =>
      prev.map((s) => {
        if (s.id === sceneId) {
          const curIdx = anchors.indexOf(s.characterAnchorId.split(" ")[0]);
          const nextAnchor = anchors[(curIdx + 1) % anchors.length];
          return {
            ...s,
            characterAnchorId: `${nextAnchor} (Face Symmetry Locked)`,
          };
        }
        return s;
      })
    );
    triggerToast(`Character Anchor ID updated: Symmetries bound to Global Face ID.`);
  };

  // Direct Audio Link Parsing Simulator
  const handleParseDirectLink = () => {
    if (!trackUrlInput.trim()) {
      triggerToast("Enter a Suno, Udio, or YouTube link to ingest.");
      return;
    }
    triggerToast(`Resolving remote audio node: ${trackUrlInput.trim()}...`);
    setTimeout(() => {
      setTrackName("Suno_Udio_RawStream_Stem_128BPM.wav");
      setBpm(132);
      setTrackDuration(180);
      setSpectralCutoff(9200);
      triggerToast("Audio ingested: Suno/Udio waveform parsed & beat-grid locked.");
      setTrackUrlInput("");
    }, 1200);
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
            <Radio className="h-5 w-5 text-[#00ffa3]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-black tracking-wider text-[#00ffa3] uppercase">
                OmniAI - Nexus
              </span>
              <span className="rounded-full border border-[#00ffa3]/30 bg-[#00ffa3]/10 px-2 py-0.5 text-[9px] font-mono text-[#00ffa3] font-bold">
                OMNIBEAT DIRECTOR V4
              </span>
            </div>
            <p className="text-[10px] text-slate-400 tracking-wide">
              Dark Misfit Studios · Desktop Web-Native AI Music Video Workstation
            </p>
          </div>
        </div>

        {/* Center Quick Transport & Action Engine */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleRunFullAutomation}
            disabled={isAutomationRunning}
            className="flex items-center gap-2 rounded-xl border border-[#00ffa3] bg-[#00ffa3] px-3.5 py-1.5 font-mono text-xs font-black text-black hover:bg-[#39ffb4] transition shadow-[0_0_20px_rgba(0,255,163,0.4)] disabled:opacity-50"
          >
            <Zap className={`h-4 w-4 ${isAutomationRunning ? "animate-spin" : "fill-black"}`} />
            <span>{isAutomationRunning ? "Running 9-Step Pipeline…" : "Run Full Autonomous Direction Loop"}</span>
          </button>

          <Link
            href="/studio/storyboard"
            className="flex items-center gap-1.5 rounded-lg border border-[#2e2055] bg-[#120d24] px-3 py-1.5 text-xs font-semibold text-slate-300 hover:border-[#00ffa3]/50 hover:text-[#00ffa3] transition"
          >
            <Layers className="h-3.5 w-3.5 text-[#00ffa3]" />
            <span className="hidden sm:inline">Push to Storyboard</span>
          </Link>
        </div>

        {/* Right Status Indicator & Assistant Toggle */}
        <div className="flex items-center gap-3">
          <StudioToggleMatrix studioName="OmniBeat Studio" />
          <div className="hidden md:flex items-center gap-2 font-mono text-[10px] text-slate-400">
            <span className="h-2 w-2 rounded-full bg-[#00ffa3] animate-pulse" />
            <span className="text-[#00ffa3] font-bold">GPU READY</span>
            <span>{"//"}</span>
            <span>RTX 4090 ACCELERATED</span>
          </div>
        </div>
      </header>

      {/* ========================================================
          THREE-PANEL WIDESCREEN WORKSPACE ARCHITECTURE
      ======================================================== */}
      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-[#2e2055]">
        {/* ========================================================
            PANEL 1: PRODUCTION BRIEF & SPECTRAL INTAKE (LEFT - 25% WIDTH)
        ======================================================== */}
        <aside className="col-span-12 lg:col-span-3 flex min-h-0 flex-col overflow-y-auto bg-[#0a0714] p-3.5 space-y-4 custom-scrollbar">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[#2e2055] pb-2.5">
            <div>
              <p className="font-mono text-[9px] uppercase tracking-[0.25em] text-[#00ffa3] font-bold">
                PANEL 01 // BRIEF & SPECTRAL INTAKE
              </p>
              <h2 className="text-sm font-bold text-white tracking-wide">
                Audio & Camera Directives
              </h2>
            </div>
            <span className="rounded bg-[#1a1236] px-2 py-0.5 font-mono text-[9px] text-[#00ffa3] border border-[#2e2055]">
              AI INGESTION
            </span>
          </div>

          {/* 1. Audio Slicing Intake Uploader */}
          <div className="rounded-xl border border-[#2e2055] bg-[#120d24] p-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="font-mono text-[10px] uppercase tracking-wider text-slate-300 font-semibold flex items-center gap-1.5">
                <Music className="h-3 w-3 text-[#00ffa3]" />
                Audio Slicing Intake Node
              </label>
              <span className="text-[9px] font-mono text-[#00ffa3]">.WAV / .MP3</span>
            </div>

            {/* Drag & Drop Node Box */}
            <div className="rounded-xl border border-dashed border-[#2e2055] bg-[#0c0919] p-3 text-center transition hover:border-[#00ffa3]/50">
              <Upload className="mx-auto h-5 w-5 text-[#00ffa3]" />
              <p className="mt-1 text-xs font-bold text-white truncate">{trackName}</p>
              <p className="text-[9px] font-mono text-slate-400">
                Drop raw audio file here or paste stream link below
              </p>
            </div>

            {/* Direct Link Input (Suno, Udio, YouTube) */}
            <div className="flex items-center gap-1.5">
              <div className="relative flex-1">
                <LinkIcon className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-500" />
                <input
                  type="text"
                  value={trackUrlInput}
                  onChange={(e) => setTrackUrlInput(e.target.value)}
                  placeholder="Paste Suno, Udio, YouTube URL..."
                  className="w-full rounded-lg border border-[#2e2055] bg-[#16112c] py-1.5 pl-8 pr-2 font-mono text-[11px] text-slate-200 outline-none focus:border-[#00ffa3]/60"
                />
              </div>
              <button
                onClick={handleParseDirectLink}
                className="rounded-lg border border-[#2e2055] bg-[#1d1538] px-2.5 py-1.5 font-mono text-[10px] font-bold text-[#00ffa3] hover:bg-[#00ffa3]/20 transition"
              >
                PARSE
              </button>
            </div>

            {/* Active Track Progress Bar with Real-Time Spectral Metrics */}
            <div className="space-y-1.5 rounded-lg border border-[#2e2055] bg-black/60 p-2 font-mono text-[10px]">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#00ffa3] flex items-center gap-1">
                  <Activity className="h-3 w-3 animate-pulse text-[#00ffa3]" />
                  BPM TRACKING: {bpm} BPM (ONSET SYNC)
                </span>
                <span className="text-slate-400">
                  {Math.floor(audioPlayhead / 60)}:{String(Math.floor(audioPlayhead % 60)).padStart(2, "0")} / 02:45
                </span>
              </div>

              {/* Progress track line */}
              <div className="relative h-2 w-full overflow-hidden rounded-full bg-slate-900 border border-[#2e2055]">
                <div
                  className="h-full bg-gradient-to-r from-[#00ffa3] via-[#00f2fe] to-[#39ffb4] transition-all duration-100 shadow-[0_0_10px_#00ffa3]"
                  style={{ width: `${(audioPlayhead / trackDuration) * 100}%` }}
                />
              </div>

              {/* Spectral Brightness & Music-Grid Analysis in Neon Green Text */}
              <div className="flex flex-col gap-0.5 text-[9px] text-[#00ffa3]">
                <div className="flex justify-between">
                  <span>SPECTRAL CUTOFF: {spectralCutoff} Hz (RESONANT BRIGHTNESS)</span>
                  <span className="text-slate-400">HIGH-PASS: 40Hz</span>
                </div>
                <div className="flex justify-between">
                  <span>MUSIC-GRID ANALYSIS: {musicGridBars} BARS // 4/4 TIME</span>
                  <span className="text-[#39ffb4] font-bold">CONFIDENCE: {onsetConfidence}%</span>
                </div>
              </div>

              {/* Audio Play/Pause Trigger */}
              <button
                onClick={() => setIsPlayingAudio(!isPlayingAudio)}
                className={`mt-1 flex w-full items-center justify-center gap-1.5 rounded-lg py-1 text-[10px] font-bold transition ${
                  isPlayingAudio
                    ? "bg-[#00ffa3] text-black"
                    : "border border-[#00ffa3]/40 bg-[#00ffa3]/10 text-[#00ffa3] hover:bg-[#00ffa3]/20"
                }`}
              >
                {isPlayingAudio ? (
                  <>
                    <Pause className="h-3 w-3 fill-current" />
                    <span>PAUSE SPECTRAL PREVIEW</span>
                  </>
                ) : (
                  <>
                    <Play className="h-3 w-3 fill-current" />
                    <span>PLAY AUDIO SPECTRUM</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* 2. Production Mode Selector (Interactive Pill Deck) */}
          <div className="space-y-2">
            <span className="font-mono text-[9px] uppercase tracking-wider text-[#00ffa3] font-semibold block">
              Production Mode Selector
            </span>

            <div className="grid grid-cols-1 gap-2">
              {PRODUCTION_MODES.map((mode) => {
                const Icon = mode.icon;
                const isSelected = productionMode === mode.id;
                return (
                  <button
                    key={mode.id}
                    onClick={() => {
                      setProductionMode(mode.id);
                      triggerToast(`Switched Mode: ${mode.title}`);
                    }}
                    className={`flex items-start gap-2.5 rounded-xl border p-2.5 text-left transition ${
                      isSelected
                        ? "border-[#00ffa3] bg-[#181130] shadow-[0_0_15px_rgba(0,255,163,0.18)]"
                        : "border-[#2e2055] bg-[#120d24] hover:border-[#00ffa3]/40 hover:bg-[#16102c]"
                    }`}
                  >
                    <div
                      className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg border ${
                        isSelected
                          ? "border-[#00ffa3] bg-[#00ffa3]/20 text-[#00ffa3]"
                          : "border-[#2e2055] bg-[#0c0919] text-slate-400"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-bold ${isSelected ? "text-[#00ffa3]" : "text-white"}`}>
                          {mode.title}
                        </span>
                        <span className="rounded bg-black/40 px-1.5 py-0.5 font-mono text-[8px] text-slate-400">
                          {mode.badge}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[10px] text-slate-400 leading-tight">
                        {mode.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Scene Concept Prompt Area */}
          <div className="rounded-xl border border-[#2e2055] bg-[#120d24] p-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="font-mono text-[10px] uppercase tracking-wider text-slate-300 font-semibold flex items-center gap-1.5">
                <Sparkles className="h-3 w-3 text-[#00ffa3]" />
                Scene Concept Prompt Area
              </label>
              <span className="text-[9px] font-mono text-slate-400">Prompt Node</span>
            </div>

            <textarea
              value={scenePrompt}
              onChange={(e) => setScenePrompt(e.target.value)}
              rows={4}
              placeholder="Describe character visual concept, lighting matrices, atmospheric mood..."
              className="w-full resize-none rounded-xl border border-[#2e2055] bg-[#16112c] p-2.5 font-mono text-xs leading-relaxed text-slate-200 outline-none transition focus:border-[#00ffa3]/70 focus:shadow-[0_0_15px_rgba(0,255,163,0.15)]"
            />

            {/* Interactive [Enhance Camera Direction] Button */}
            <button
              onClick={handleEnhanceCameraDirection}
              disabled={isEnhancingCamera}
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-[#00ffa3]/50 bg-[#00ffa3]/15 py-2 font-mono text-xs font-bold text-[#00ffa3] hover:bg-[#00ffa3]/25 transition shadow-[0_0_15px_rgba(0,255,163,0.15)] disabled:opacity-50"
            >
              <Camera className={`h-3.5 w-3.5 ${isEnhancingCamera ? "animate-spin text-[#00ffa3]" : ""}`} />
              <span>{isEnhancingCamera ? "Computing Camera Geometry…" : "Enhance Camera Direction"}</span>
            </button>

            {/* Quick Inspiration Directives */}
            <div className="flex flex-wrap gap-1">
              {[
                "Anamorphic 35mm Bokeh",
                "360° Rotational Dolly",
                "Low-Angle Dutch Tilt",
                "Drone Flythrough",
                "Cyberpunk Rain Flares"
              ].map((chip) => (
                <button
                  key={chip}
                  onClick={() => setScenePrompt((prev) => `${prev.trim()} ${chip}.`)}
                  className="rounded border border-[#2e2055] bg-[#16112c] px-2 py-0.5 font-mono text-[9px] text-slate-300 hover:border-[#00ffa3]/40 hover:text-[#00ffa3]"
                >
                  +{chip}
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* ========================================================
            PANEL 2: THE 9-STEP AUTOMATION TRACKER & VIEWPORT (CENTER - 50% WIDTH)
        ======================================================== */}
        <main className="col-span-12 lg:col-span-6 flex min-h-0 flex-col overflow-y-auto bg-[#000000] p-3.5 space-y-3 custom-scrollbar">
          {/* 1. Interactive Progress Tracker Header (Horizontal 9-Step Bar) */}
          <section className="rounded-xl border border-[#2e2055] bg-[#0e0a1c] p-2.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[9px] uppercase tracking-[0.25em] text-[#00ffa3] font-bold flex items-center gap-1.5">
                <Zap className="h-3 w-3 text-[#00ffa3]" />
                9-Step Autonomous Direction Pipeline
              </span>
              <span className="font-mono text-[9px] text-slate-400">
                ACTIVE STEP: <b className="text-[#00ffa3]">{activeStep} / 9</b>
              </span>
            </div>

            {/* Horizontal 9-Step Progress Path */}
            <div className="grid grid-cols-9 gap-1">
              {AUTOMATION_STEPS.map((step) => {
                const isCurrent = activeStep === step.id;
                const isDone = completedSteps.includes(step.id);
                return (
                  <button
                    key={step.id}
                    onClick={() => {
                      setActiveStep(step.id);
                      setAutomationLog(`Inspecting step ${step.id}: ${step.name}`);
                    }}
                    className={`flex flex-col items-center justify-between rounded-lg border p-1 text-center transition ${
                      isCurrent
                        ? "border-[#00ffa3] bg-[#00ffa3]/15 shadow-[0_0_12px_rgba(0,255,163,0.3)] text-[#00ffa3]"
                        : isDone
                        ? "border-[#2e2055] bg-[#120d24] text-[#39ffb4]"
                        : "border-[#211740] bg-[#0a0714] text-slate-500 hover:border-slate-700"
                    }`}
                  >
                    <span className="font-mono text-[8px] font-bold">
                      {isDone ? "✓" : `0${step.id}`}
                    </span>
                    <span className="truncate w-full font-mono text-[7px] font-semibold mt-0.5">
                      {step.name.split(" ")[0]}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Live Pipeline Status Banner */}
            <div className="flex items-center justify-between rounded-lg bg-black/60 px-2.5 py-1 font-mono text-[9px] text-slate-300 border border-[#2e2055]">
              <span className="truncate max-w-[340px] text-slate-300">
                <span className="text-[#00ffa3] font-bold">LOG:</span> {automationLog}
              </span>
              <span className="text-[#00ffa3] shrink-0 font-bold">NON-DESTRUCTIVE</span>
            </div>
          </section>

          {/* 2. The WebGL Visualizer Viewport */}
          <section className="relative flex flex-col rounded-2xl border border-[#2e2055] bg-[#090614] overflow-hidden shadow-[0_0_30px_rgba(0,0,0,0.8)]">
            {/* Viewport Top Controls Bar */}
            <div className="flex h-9 items-center justify-between border-b border-[#2e2055] bg-[#100b21] px-3">
              <div className="flex items-center gap-2 font-mono text-[10px]">
                <span className="h-2 w-2 rounded-full bg-[#00ffa3] animate-pulse" />
                <span className="font-bold text-white">WEBGL MONITOR VIEWPORT</span>
                <span className="text-slate-500">|</span>
                <span className="text-[#00ffa3]">{viewportTimecode}</span>
              </div>

              <div className="flex items-center gap-2">
                {/* [Show App Safe Zones] On/Off Toggle Button */}
                <button
                  onClick={() => setShowSafeZones(!showSafeZones)}
                  className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 font-mono text-[9px] font-bold transition ${
                    showSafeZones
                      ? "border-[#ff2a6d] bg-[#ff2a6d]/20 text-[#ff2a6d] shadow-[0_0_12px_rgba(255,42,109,0.3)]"
                      : "border-[#2e2055] bg-[#16112c] text-slate-400 hover:text-white"
                  }`}
                >
                  <ShieldAlert className="h-3 w-3" />
                  <span>{showSafeZones ? "Show App Safe Zones [ON]" : "Show App Safe Zones [OFF]"}</span>
                </button>

                {/* Aspect Ratio Switcher */}
                <div className="flex rounded-md border border-[#2e2055] bg-[#16112c] p-0.5 text-[9px] font-mono">
                  {(["16:9", "9:16", "1:1"] as const).map((ratio) => (
                    <button
                      key={ratio}
                      onClick={() => setAspectRatio(ratio)}
                      className={`rounded px-1.5 py-0.5 transition ${
                        aspectRatio === ratio
                          ? "bg-[#00ffa3]/20 text-[#00ffa3] font-bold"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      {ratio}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Central Canvas Screen */}
            <div className="relative flex min-h-[320px] max-h-[440px] items-center justify-center bg-[#000000] p-2">
              <div
                className="relative overflow-hidden rounded-xl border border-[#2e2055] bg-[#000000] shadow-[0_0_40px_rgba(0,0,0,0.9)]"
                style={{
                  aspectRatio: aspectRatio.replace(":", " / "),
                  width: aspectRatio === "9:16" ? "auto" : "100%",
                  height: aspectRatio === "9:16" ? "340px" : "100%",
                  maxHeight: "360px",
                }}
              >
                <canvas
                  ref={canvasRef}
                  width={640}
                  height={360}
                  className="h-full w-full object-contain"
                />

                {/* Corner Watermarks */}
                <div className="pointer-events-none absolute top-2 left-2 rounded bg-black/60 px-1.5 py-0.5 font-mono text-[8px] text-[#00ffa3] border border-[#2e2055]">
                  OMNIBEAT // 4K 60FPS
                </div>
                <div className="pointer-events-none absolute top-2 right-2 rounded bg-black/60 px-1.5 py-0.5 font-mono text-[8px] text-slate-400 border border-[#2e2055]">
                  ANCHOR: {globalAnchorId}
                </div>
              </div>
            </div>

            {/* Viewport Playback Transport Bar */}
            <div className="flex items-center justify-between border-t border-[#2e2055] bg-[#100b21] px-3 py-2 font-mono text-xs">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsPlayingAudio(!isPlayingAudio)}
                  className="flex h-7 items-center gap-1.5 rounded-lg bg-[#00ffa3] px-3 text-[11px] font-bold text-black hover:bg-[#39ffb4] transition"
                >
                  {isPlayingAudio ? (
                    <>
                      <Pause className="h-3.5 w-3.5 fill-current" />
                      <span>PAUSE</span>
                    </>
                  ) : (
                    <>
                      <Play className="h-3.5 w-3.5 fill-current" />
                      <span>PLAY</span>
                    </>
                  )}
                </button>
                <button
                  onClick={() => {
                    setAudioPlayhead(0);
                    setViewportTimecode("00:00.00");
                  }}
                  className="rounded border border-[#2e2055] bg-[#16112c] p-1.5 text-slate-300 hover:text-white"
                  title="Rewind to 0"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Scrubber slider */}
              <input
                type="range"
                min={0}
                max={trackDuration}
                step={0.1}
                value={audioPlayhead}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setAudioPlayhead(val);
                  const min = Math.floor(val / 60);
                  const sec = Math.floor(val % 60);
                  setViewportTimecode(`${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}.00`);
                }}
                className="mx-3 flex-1 h-1.5 appearance-none rounded-lg bg-black accent-[#00ffa3] cursor-pointer"
              />

              <div className="text-[10px] text-slate-400">
                <span className="text-[#00ffa3] font-bold">{viewportTimecode}</span> / 02:45.00
              </div>
            </div>
          </section>

          {/* ========================================================
              MULTI-TRACK WAVEFORM VIEW & STEM ALIGNMENT TERMINAL
              Precise visual alignment across all audio stems (Master, Vocals, Drums/Bass, Synths)
          ======================================================== */}
          <section className="rounded-xl border border-[#2e2055] bg-[#0c0819] p-3.5 space-y-3 shadow-lg">
            {/* Header: Title, Global Alignment Status, Actions */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#2e2055] pb-2.5">
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#00D2FF]/20 text-[#00D2FF] border border-[#00D2FF]/40">
                  <Activity className="h-3.5 w-3.5" />
                </div>
                <div>
                  <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
                    Multi-Track Waveform Studio
                    <span className="rounded bg-[#1a1236] px-1.5 py-0.5 text-[8px] text-[#00ffa3] border border-[#2e2055]">
                      4 STEMS SYNCED
                    </span>
                  </h3>
                  <p className="font-mono text-[9px] text-slate-400">
                    Sub-millisecond transient alignment & phase correlation monitor
                  </p>
                </div>
              </div>

              {/* Action Buttons: Auto-Align, Beat-Sync, Zoom */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleAutoAlignAllStems}
                  className="flex items-center gap-1 rounded-lg border border-[#00ffa3]/50 bg-[#00ffa3]/15 px-2.5 py-1 font-mono text-[9px] font-bold text-[#00ffa3] hover:bg-[#00ffa3]/25 transition shadow-[0_0_10px_rgba(0,255,163,0.2)]"
                  title="Auto-align all stem waveforms to 0ms phase drift"
                >
                  <Zap className="h-3 w-3" />
                  <span>AUTO-ALIGN STEMS</span>
                </button>

                <button
                  onClick={() => {
                    setBeatSyncStems((b) => !b);
                    triggerToast(`Beat-Sync ${!beatSyncStems ? "Enabled: Snapping stem edits to 128 BPM grid" : "Disabled"}`);
                  }}
                  className={`flex items-center gap-1 rounded-lg border px-2 py-1 font-mono text-[9px] font-bold transition ${
                    beatSyncStems
                      ? "border-[#00D2FF] bg-[#00D2FF]/20 text-[#00D2FF]"
                      : "border-[#2e2055] bg-[#16112c] text-slate-400 hover:text-white"
                  }`}
                  title="Toggle Beat-Sync musical quantization on stem waveforms"
                >
                  <Music className="h-3 w-3" />
                  <span>BEAT-SYNC: {beatSyncStems ? "128 BPM" : "OFF"}</span>
                </button>

                {/* Zoom toggles */}
                <div className="flex items-center rounded-lg border border-[#2e2055] bg-[#16112c] p-0.5">
                  {[1, 2, 4].map((z) => (
                    <button
                      key={z}
                      onClick={() => setStemZoom(z)}
                      className={`px-1.5 py-0.5 font-mono text-[8px] font-bold rounded ${
                        stemZoom === z ? "bg-[#00D2FF] text-black" : "text-slate-400 hover:text-white"
                      }`}
                    >
                      {z}x
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Stems Multi-Track Workspace */}
            <div className="space-y-2 relative select-none">
              {audioStems.map((stem) => {
                const anySolo = audioStems.some((s) => s.solo);
                const isAudible = (!anySolo || stem.solo) && !stem.muted;
                const isSelected = selectedStemId === stem.id;

                return (
                  <div
                    key={stem.id}
                    onClick={() => setSelectedStemId(stem.id)}
                    className={`flex flex-col sm:flex-row items-stretch rounded-xl border transition-all ${
                      isSelected
                        ? "border-[#00D2FF]/70 bg-[#120d24] shadow-[0_0_15px_rgba(0,210,255,0.1)]"
                        : "border-[#2e2055] bg-[#0e0a1c] hover:border-slate-700"
                    }`}
                  >
                    {/* Left Stem Inspector Column (Fixed 210px) */}
                    <div className="w-full sm:w-[210px] shrink-0 p-2.5 border-b sm:border-b-0 sm:border-r border-[#2e2055] flex flex-col justify-between gap-1.5 bg-black/40">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span
                            className="h-2.5 w-2.5 rounded-full shrink-0 shadow-sm"
                            style={{ backgroundColor: stem.color }}
                          />
                          <span className="font-mono text-[10px] font-bold text-white truncate">
                            {stem.name}
                          </span>
                        </div>

                        {/* Mute / Solo Buttons */}
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleStemSolo(stem.id);
                            }}
                            className={`h-5 w-5 rounded font-mono text-[9px] font-black transition ${
                              stem.solo
                                ? "bg-amber-400 text-black shadow-[0_0_8px_#fbbf24]"
                                : "bg-[#181130] text-slate-400 border border-[#2e2055] hover:text-white"
                            }`}
                            title="Solo Stem"
                          >
                            S
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleStemMute(stem.id);
                            }}
                            className={`h-5 w-5 rounded font-mono text-[9px] font-black transition ${
                              stem.muted
                                ? "bg-rose-500 text-white shadow-[0_0_8px_#f43f5e]"
                                : "bg-[#181130] text-slate-400 border border-[#2e2055] hover:text-white"
                            }`}
                            title="Mute Stem"
                          >
                            M
                          </button>
                        </div>
                      </div>

                      {/* Micro-Timing Alignment Nudge Controls */}
                      <div className="flex items-center justify-between gap-1 font-mono text-[9px]">
                        <span className="text-slate-400 text-[8px] uppercase">OFFSET:</span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleNudgeStem(stem.id, -5);
                            }}
                            className="rounded border border-[#2e2055] bg-[#16112c] px-1 py-0.5 text-slate-300 hover:border-[#00D2FF] hover:text-[#00D2FF] transition active:scale-95"
                            title="Nudge -5ms backwards"
                          >
                            -5ms
                          </button>

                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              handleResetStemOffset(stem.id);
                            }}
                            className={`cursor-pointer rounded px-1.5 py-0.5 font-bold transition ${
                              stem.offsetMs !== 0
                                ? "bg-[#FF003C]/20 text-[#FF003C] border border-[#FF003C]/40"
                                : "bg-black/60 text-[#00ffa3] border border-[#2e2055]"
                            }`}
                            title="Click to reset offset to 0ms"
                          >
                            {stem.offsetMs > 0 ? `+${stem.offsetMs}ms` : `${stem.offsetMs}ms`}
                          </span>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleNudgeStem(stem.id, 5);
                            }}
                            className="rounded border border-[#2e2055] bg-[#16112c] px-1 py-0.5 text-slate-300 hover:border-[#00D2FF] hover:text-[#00D2FF] transition active:scale-95"
                            title="Nudge +5ms forwards"
                          >
                            +5ms
                          </button>
                        </div>
                      </div>

                      {/* Volume dB Slider */}
                      <div className="flex items-center gap-1.5 text-[8px] font-mono text-slate-400">
                        <Volume2 className="h-2.5 w-2.5 text-slate-400" />
                        <input
                          type="range"
                          min={-18}
                          max={6}
                          step={0.5}
                          value={stem.volumeDb}
                          onChange={(e) => {
                            e.stopPropagation();
                            handleStemVolumeChange(stem.id, Number(e.target.value));
                          }}
                          className="h-1 flex-1 appearance-none rounded-lg bg-black accent-[#00D2FF] cursor-pointer"
                        />
                        <span className="w-10 text-right text-slate-300 font-bold">
                          {stem.volumeDb > 0 ? `+${stem.volumeDb.toFixed(1)}` : stem.volumeDb.toFixed(1)}dB
                        </span>
                      </div>
                    </div>

                    {/* Right Waveform Canvas Area */}
                    <div
                      onClick={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const clickX = e.clientX - rect.left;
                        const ratio = Math.max(0, Math.min(1, clickX / rect.width));
                        setAudioPlayhead(ratio * trackDuration);
                        const min = Math.floor((ratio * trackDuration) / 60);
                        const sec = Math.floor((ratio * trackDuration) % 60);
                        setViewportTimecode(`${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}.00`);
                      }}
                      className="relative flex-1 h-14 sm:h-16 bg-[#000000] overflow-hidden cursor-crosshair flex items-center px-2"
                    >
                      {/* Beat Grid Lines Overlay across waveform */}
                      {beatSyncStems && (
                        <div className="absolute inset-0 pointer-events-none flex">
                          {Array.from({ length: 32 }).map((_, bIdx) => (
                            <div
                              key={bIdx}
                              className={`h-full border-r ${
                                bIdx % 4 === 0 ? "border-[#00ffa3]/20" : "border-white/5"
                              }`}
                              style={{ width: `${100 / 32}%` }}
                            />
                          ))}
                        </div>
                      )}

                      {/* Synchronized Playhead Needle Line */}
                      <div
                        className="absolute top-0 bottom-0 w-0.5 bg-white z-20 pointer-events-none shadow-[0_0_8px_#ffffff]"
                        style={{ left: `${(audioPlayhead / trackDuration) * 100}%` }}
                      >
                        <div className="absolute -top-1 -left-1 h-2 w-2 rounded-full bg-white" />
                      </div>

                      {/* Waveform Symmetrical Peak Bars */}
                      <div
                        className={`flex items-center justify-between w-full h-full gap-0.5 transition-transform duration-100 ${
                          !isAudible ? "opacity-30 grayscale" : "opacity-90"
                        }`}
                        style={{
                          transform: `translateX(${(stem.offsetMs / 50) * 16}px)`,
                        }}
                      >
                        {stem.peaks.map((peak, pIdx) => {
                          const barHeight = Math.max(4, peak * 46);
                          const isPassed = (pIdx / stem.peaks.length) <= (audioPlayhead / trackDuration);

                          return (
                            <div
                              key={pIdx}
                              className="flex-1 rounded-full transition-all duration-75"
                              style={{
                                height: `${barHeight}px`,
                                backgroundColor: isPassed ? stem.color : `${stem.color}66`,
                                boxShadow: isPassed && isPlayingAudio ? `0 0 6px ${stem.color}` : "none",
                              }}
                            />
                          );
                        })}
                      </div>

                      {/* Offset Badge Indicator Overlay if nudged */}
                      {stem.offsetMs !== 0 && (
                        <div
                          className="pointer-events-none absolute right-2 top-1 rounded bg-[#FF003C]/20 border border-[#FF003C]/50 px-1.5 py-0.5 font-mono text-[8px] font-bold text-[#FF003C]"
                        >
                          OFFSET {stem.offsetMs > 0 ? `+${stem.offsetMs}` : stem.offsetMs}ms
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* 3. Onbeat Effects Deck (Grid selection deck below player) */}
          <section className="rounded-xl border border-[#2e2055] bg-[#0e0a1c] p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[9px] uppercase tracking-wider text-[#00ffa3] font-bold flex items-center gap-1.5">
                <Zap className="h-3 w-3 text-[#00ffa3]" />
                Onbeat Effects Deck (Instant Hotkey Injection)
              </span>
              <span className="text-[8px] font-mono text-slate-400">HOTKEYS [1 - 8] ACTIVE</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {ONBEAT_EFFECTS.map((effect) => {
                const isActive = activeEffects.has(effect.id);
                return (
                  <button
                    key={effect.id}
                    onClick={() => handleToggleEffect(effect.id, effect.label)}
                    className={`flex items-center justify-between rounded-lg border p-2 text-left transition ${
                      isActive
                        ? "border-[#00ffa3] bg-[#00ffa3]/20 shadow-[0_0_12px_rgba(0,255,163,0.3)] text-[#00ffa3]"
                        : "border-[#2e2055] bg-[#120d24] text-slate-300 hover:border-[#00ffa3]/40 hover:text-white"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <span className="block font-mono text-[8px] font-bold text-slate-400">
                        KEY [{effect.key}]
                      </span>
                      <span className="block text-[10px] font-bold truncate">
                        {effect.label.split("[")[0]}
                      </span>
                    </div>
                    <span
                      className={`ml-1 rounded px-1 py-0.5 font-mono text-[8px] font-bold shrink-0 ${
                        isActive ? "bg-[#00ffa3] text-black" : "bg-black/50 text-slate-400"
                      }`}
                    >
                      {isActive ? "ON" : "OFF"}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        </main>

        {/* ========================================================
            PANEL 3: MODULAR STORYBOARD TIMELINE (RIGHT - 25% WIDTH)
        ======================================================== */}
        <aside className="col-span-12 lg:col-span-3 flex min-h-0 flex-col overflow-y-auto bg-[#0a0714] p-3.5 space-y-3 custom-scrollbar">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[#2e2055] pb-2.5">
            <div>
              <p className="font-mono text-[9px] uppercase tracking-[0.25em] text-[#00ffa3] font-bold">
                PANEL 03 // STORYBOARD TIMELINE
              </p>
              <h2 className="text-sm font-bold text-white tracking-wide">
                Non-Destructive Scene Blocks
              </h2>
            </div>
            <span className="rounded bg-[#1a1236] px-2 py-0.5 font-mono text-[9px] text-[#00ffa3] border border-[#2e2055]">
              {storyboardScenes.length} SCENES
            </span>
          </div>

          {/* Global Anchor ID Controller */}
          <div className="flex items-center justify-between rounded-xl border border-[#2e2055] bg-[#120d24] p-2.5">
            <div className="min-w-0">
              <span className="font-mono text-[8px] uppercase tracking-wider text-slate-400 block">
                GLOBAL CHARACTER ANCHOR
              </span>
              <span className="font-mono text-xs font-bold text-[#00ffa3] truncate block">
                {globalAnchorId}
              </span>
            </div>
            <button
              onClick={() => {
                setGlobalAnchorId((prev) =>
                  prev === "ANCHOR-MISFIT-01" ? "ANCHOR-CYBORG-02" : "ANCHOR-MISFIT-01"
                );
                triggerToast("Swapped Global Character Anchor for all linked scenes.");
              }}
              className="rounded-lg border border-[#2e2055] bg-[#181130] px-2 py-1 font-mono text-[9px] text-slate-300 hover:border-[#00ffa3]/50 hover:text-[#00ffa3]"
            >
              CYCLE ANCHOR
            </button>
          </div>

          {/* Non-Destructive Storyboard Grid (Scrollable List of Scene Block Containers) */}
          <div className="space-y-3 flex-1 overflow-y-auto pr-1">
            {storyboardScenes.map((scene, idx) => {
              const isSelected = selectedSceneId === scene.id;
              const isRegenerating = regeneratingSceneId === scene.id;

              return (
                <div
                  key={scene.id}
                  onClick={() => setSelectedSceneId(scene.id)}
                  className={`rounded-xl border p-3 transition space-y-2.5 ${
                    isSelected
                      ? "border-[#00ffa3] bg-[#16102c] shadow-[0_0_18px_rgba(0,255,163,0.15)]"
                      : "border-[#2e2055] bg-[#120d24] hover:border-[#00ffa3]/40"
                  }`}
                >
                  {/* Scene Block Header: Section & Timecode */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="rounded px-1.5 py-0.5 font-mono text-[9px] font-black uppercase text-black"
                        style={{ backgroundColor: scene.accentColor }}
                      >
                        {scene.section}
                      </span>
                      <span className="font-mono text-[10px] text-slate-300">
                        SCENE 0{idx + 1}
                      </span>
                    </div>

                    <span className="font-mono text-[9px] text-[#00ffa3] font-bold">
                      {scene.timecode}
                    </span>
                  </div>

                  {/* Thumbnail Frame with Visual Preview */}
                  <div className="relative h-20 w-full overflow-hidden rounded-lg border border-[#2e2055] bg-black">
                    <div
                      className="h-full w-full flex items-center justify-center p-2 text-center"
                      style={{
                        background: `linear-gradient(135deg, ${scene.thumbnailColor} 0%, #000000 100%)`,
                      }}
                    >
                      <Camera className="h-4 w-4 text-[#00ffa3]/60 mr-1.5 shrink-0" />
                      <p className="font-mono text-[9px] text-slate-300 line-clamp-2">
                        {scene.cameraMovement}
                      </p>
                    </div>

                    {isRegenerating && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/80 font-mono text-[10px] text-[#00ffa3] font-bold animate-pulse">
                        <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        RE-RENDERING ISOLATED SEGMENT…
                      </div>
                    )}
                  </div>

                  {/* Prompt Subtext */}
                  <p className="text-[10px] text-slate-300 leading-relaxed font-sans line-clamp-2">
                    {scene.prompt}
                  </p>

                  {/* Character Anchor Badge */}
                  <div className="flex items-center gap-1 text-[8px] font-mono text-slate-400">
                    <Crosshair className="h-3 w-3 text-[#00ffa3]" />
                    <span className="truncate">{scene.characterAnchorId}</span>
                  </div>

                  {/* Isolated Action Row */}
                  <div className="grid grid-cols-2 gap-1.5 border-t border-[#2e2055] pt-2">
                    {/* [Regenerate Scene Segment Only] */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRegenerateSceneOnly(scene.id);
                      }}
                      disabled={isRegenerating}
                      className="flex items-center justify-center gap-1 rounded-lg border border-[#00ffa3]/40 bg-[#00ffa3]/10 py-1.5 font-mono text-[9px] font-bold text-[#00ffa3] hover:bg-[#00ffa3]/25 transition disabled:opacity-50"
                      title="Overrides a single glitchy clip natively without re-rendering the whole song."
                    >
                      <RefreshCw className={`h-2.5 w-2.5 ${isRegenerating ? "animate-spin" : ""}`} />
                      <span>Regen Segment</span>
                    </button>

                    {/* [Swap Character Anchor ID] */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSwapCharacterAnchor(scene.id);
                      }}
                      className="flex items-center justify-center gap-1 rounded-lg border border-[#2e2055] bg-[#1a1236] py-1.5 font-mono text-[9px] font-bold text-slate-200 hover:border-[#00ffa3]/50 hover:text-[#00ffa3] transition"
                      title="Binds face symmetries back to the Global Anchor."
                    >
                      <Crosshair className="h-2.5 w-2.5 text-[#00ffa3]" />
                      <span>Swap Anchor ID</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quick Scene Append Button */}
          <button
            onClick={() => {
              const newId = `scene-${storyboardScenes.length + 1}`;
              const newScene: StoryboardScene = {
                id: newId,
                section: "Chorus",
                timecode: "02:45 - 03:15",
                startTime: 165,
                duration: 30,
                prompt: "Expanded bridge breakdown with intense stroboscopic laser sweep and character levitating above obsidian lake.",
                cameraMovement: "360-degree orbital rotation with vertical boom lift",
                characterAnchorId: "ANCHOR-MISFIT-01 (Face Symmetry Locked)",
                lightingStyle: "Dual neon cyan & violet strobe matrices",
                renderStatus: "ready",
                thumbnailColor: "#170e33",
                accentColor: "#00ffa3",
              };
              setStoryboardScenes((prev) => [...prev, newScene]);
              triggerToast("Appended new modular scene block to storyboard.");
            }}
            className="w-full rounded-xl border border-dashed border-[#2e2055] py-2 font-mono text-xs font-semibold text-slate-400 hover:border-[#00ffa3]/40 hover:text-[#00ffa3] transition"
          >
            ＋ Append Storyboard Scene Block
          </button>
        </aside>
      </div>

      {/* ========================================================
          TELEMETRY LINE TRACKER (ABSOLUTE BOTTOM MARGIN)
      ======================================================== */}
      <footer className="h-7 shrink-0 flex items-center justify-between border-t border-[#2e2055] bg-[#07050d] px-4 font-mono text-[9px] text-slate-400 select-none z-30">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-[#00ffa3] shadow-[0_0_6px_#00ffa3]" />
          <span className="font-black text-[#00ffa3]">
            [Nexus-Director Engine: Local-Ollama Node Array / Non-Destructive Frame Isolation Active]
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="hidden sm:inline">BUFFER: 48.0 kHz 24-BIT</span>
          <span className="hidden md:inline">BEAT-SYNC: LOCKED</span>
          <span className="text-[#00ffa3]">VRAM: 8.4GB / 24GB</span>
          <span className="text-white font-bold">FPS: 60</span>
        </div>
      </footer>

      {/* Floating Toast Notice */}
      {toastMessage && (
        <div className="fixed bottom-10 left-1/2 z-50 -translate-x-1/2 flex items-center gap-2 rounded-xl border border-[#00ffa3]/60 bg-[#120d24] px-4 py-2 text-xs font-mono text-[#00ffa3] shadow-[0_0_30px_rgba(0,255,163,0.3)] animate-in fade-in slide-in-from-bottom-2">
          <Activity className="h-3.5 w-3.5 animate-pulse" />
          <span>{toastMessage}</span>
          <button
            onClick={() => setToastMessage("")}
            className="ml-2 text-slate-400 hover:text-white"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
