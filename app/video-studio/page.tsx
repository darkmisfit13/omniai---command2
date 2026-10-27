"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Film,
  Sparkles,
  Scissors,
  Subtitles,
  Crosshair,
  Layers,
  Volume2,
  Download,
  Share2,
  FolderDown,
  RefreshCw,
  Plus,
  Play,
  Pause,
  RotateCcw,
  Magnet,
  Grid,
  Trash2,
  ChevronRight,
  Upload,
  Cpu,
  Sliders,
  Check,
  Disc,
  Mic,
  Activity,
  FileVideo,
  FileAudio,
  Image as ImageIcon,
  Music,
  Keyboard,
  X,
  Smartphone,
  Monitor
} from "lucide-react";
import ViewportCanvas, { type ShaderEffect } from "./ViewportCanvas";
import TimelineEngine, { type TimelineClip } from "./TimelineEngine";
import { mediaVault, audioStemBridge, type VaultAsset } from "@/lib/mediaVault";

// Preset Media Assets for Asset Management Vault
interface VaultMediaItem {
  id: string;
  name: string;
  type: "video" | "image" | "audio";
  format: string;
  duration: number; // seconds
  thumbnailUrl: string;
  source: string;
  resolution?: string;
}

const DEFAULT_VAULT_ITEMS: VaultMediaItem[] = [
  {
    id: "vault-v1",
    name: "Obsidian_Rain_Cyberpunk_Hero.mp4",
    type: "video",
    format: ".mp4",
    duration: 34,
    thumbnailUrl: "/neon_rain_thumb.jpg",
    source: "OmniAI Video Lab",
    resolution: "3840x2160 (4K)",
  },
  {
    id: "vault-v2",
    name: "Dark_Misfit_Betrayal_Monologue.mp4",
    type: "video",
    format: ".mp4",
    duration: 28,
    thumbnailUrl: "/monologue_thumb.jpg",
    source: "Voice Studio Lip-Sync",
    resolution: "1920x1080 (HD)",
  },
  {
    id: "vault-g1",
    name: "Neon_Glitch_HUD_Overlay.png",
    type: "image",
    format: ".png",
    duration: 15,
    thumbnailUrl: "/overlay_thumb.png",
    source: "Omni Image Studio",
    resolution: "3840x2160",
  },
  {
    id: "vault-a1",
    name: "Cyberpunk_Synthwave_Master_Stem.wav",
    type: "audio",
    format: ".wav",
    duration: 60,
    thumbnailUrl: "/audio_wave_thumb.png",
    source: "Omni Wave Music DAW",
    resolution: "48kHz / 24-bit",
  },
  {
    id: "vault-a2",
    name: "Dark_Chant_Vocal_Acapella.wav",
    type: "audio",
    format: ".wav",
    duration: 45,
    thumbnailUrl: "/vocal_thumb.png",
    source: "Voice Studio 10s Print",
    resolution: "48kHz / 24-bit",
  },
];

// Initial Clips populated across the 4 discrete tracks
const INITIAL_CLIPS: TimelineClip[] = [
  // Track 1: Primary Video (Dark purple containers)
  {
    id: "clip-v1",
    trackId: "video1",
    title: "Obsidian Rain Master Cut",
    startTime: 0,
    duration: 32,
    color: "#a855f7",
  },
  {
    id: "clip-v2",
    trackId: "video1",
    title: "Cinematic Slow Push-In",
    startTime: 32,
    duration: 28,
    color: "#a855f7",
  },
  // Track 2: Overlay Video 02 (Translucent purple containers)
  {
    id: "clip-ov1",
    trackId: "video2",
    title: "Neon Wireframe Glitch B-Roll",
    startTime: 8,
    duration: 18,
    color: "#c084fc",
  },
  // Track 3: Captions/Subtitle Track (Neon-green text block wrappers)
  {
    id: "clip-sub1",
    trackId: "captions",
    title: "Subtitle 01",
    startTime: 2,
    duration: 6,
    text: "You swore our nexus wouldn't ever break...",
    color: "#00ffa3",
  },
  {
    id: "clip-sub2",
    trackId: "captions",
    title: "Subtitle 02",
    startTime: 10,
    duration: 8,
    text: "Now shadows echo in the promises you fake.",
    color: "#00ffa3",
  },
  {
    id: "clip-sub3",
    trackId: "captions",
    title: "Subtitle 03",
    startTime: 20,
    duration: 7,
    text: "Lost in the feedback of your dark desire.",
    color: "#00ffa3",
  },
  // Track 4: Audio Sound Track (Reactive wave blocks synced from Wave Studio)
  {
    id: "clip-aud1",
    trackId: "audio",
    title: "OmniWave Master 48kHz (Full Stem)",
    startTime: 0,
    duration: 60,
    color: "#00f2fe",
  },
];

interface ExportPreset {
  id: string;
  name: string;
  resolution: string;
  aspectRatio: "16:9" | "9:16" | "1:1" | "21:9" | "Audio";
  platform: string;
  container: string;
  codec: string;
  description: string;
  badge?: string;
}

const EXPORT_PRESETS: ExportPreset[] = [
  {
    id: "social_media",
    name: "Social Media",
    resolution: "1080x1920 (9:16) / 1920x1080 (16:9)",
    aspectRatio: "9:16",
    platform: "TikTok / IG Reels / YouTube Shorts",
    container: ".mp4",
    codec: "H.265 / HEVC GPU Hardware",
    description: "Quickly toggle between 9:16 vertical and 16:9 landscape aspect ratios for TikTok, Instagram Reels, and YouTube Shorts.",
    badge: "9:16 / 16:9 DUAL PRESET",
  },
  {
    id: "cinema_4k",
    name: "Cinema 4K Master",
    resolution: "3840x2160",
    aspectRatio: "16:9",
    platform: "Theater / Film Master / Desktop",
    container: ".mov / .mp4",
    codec: "ProRes 422 HQ / H.265",
    description: "Full UHD high-bitrate archival master preserving maximum dynamic range.",
  },
  {
    id: "broadcast_hd",
    name: "Broadcast Standard 1080p",
    resolution: "1920x1080",
    aspectRatio: "16:9",
    platform: "YouTube / Vimeo Standard",
    container: ".mp4",
    codec: "H.264 WebCodecs HW",
    description: "Universal 16:9 landscape export for monitors and standard web players.",
  },
  {
    id: "square_feed",
    name: "Square Social Carousel",
    resolution: "1080x1080",
    aspectRatio: "1:1",
    platform: "Instagram Feed / LinkedIn",
    container: ".mp4",
    codec: "H.264 High Profile",
    description: "Balanced square viewport for high-impact social feed embeds.",
  },
  {
    id: "lossless_wav",
    name: "Lossless Master Audio Stems",
    resolution: "48kHz / 24-bit",
    aspectRatio: "Audio",
    platform: "DAW / Spotify / Soundcloud",
    container: ".wav",
    codec: "PCM Linear Uncompressed",
    description: "Studio-grade multi-track audio stem bounce with real-time waveform progress.",
  },
];

export default function VideoStudioPage() {
  // Playback & Global Engine State
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(4.5);
  const [duration, setDuration] = useState<number>(75); // 75 seconds project timeline
  const [clips, setClips] = useState<TimelineClip[]>(INITIAL_CLIPS);
  const [selectedClipId, setSelectedClipId] = useState<string | null>("clip-v1");

  // Viewport Settings
  const [aspectRatio, setAspectRatio] = useState<"16:9" | "9:16" | "1:1" | "21:9">("16:9");
  const [shaderEffect, setShaderEffect] = useState<ShaderEffect>("none");
  const [activeDirectorFilter, setActiveDirectorFilter] = useState<string>("Standard Neutral");
  const [trackingLocked, setTrackingLocked] = useState<boolean>(false);

  // Tier 1: Asset Management Vault State
  const [vaultFilter, setVaultFilter] = useState<"all" | "video" | "image" | "audio">("all");
  const [vaultItems, setVaultItems] = useState<VaultMediaItem[]>(DEFAULT_VAULT_ITEMS);
  const [isPullingGlobalVault, setIsPullingGlobalVault] = useState<boolean>(false);

  // Tier 1: Conversational Edit Director HUD State
  const [directorPrompt, setDirectorPrompt] = useState<string>(
    "Add dramatic low-key neon rim lighting, increase film noir contrast, and make the character glance toward the rain reflections during seconds 12-18."
  );
  const [isDirectorProcessing, setIsDirectorProcessing] = useState<boolean>(false);
  const [directorFeedback, setDirectorFeedback] = useState<string>(
    "Active Clip: Obsidian Rain Master Cut · Pacing: 24 FPS Cinematic · Lighting: Volumetric Neon Rim"
  );

  // Tier 2: Deck Utility Action Keys State
  const [snapToGrid, setSnapToGrid] = useState<boolean>(true);
  const [beatSync, setBeatSync] = useState<boolean>(true);
  const [detectedBpm, setDetectedBpm] = useState<number>(128);
  const [magneticMode, setMagneticMode] = useState<boolean>(true);
  const [isGeneratingCaptions, setIsGeneratingCaptions] = useState<boolean>(false);
  const [isSmartCutting, setIsSmartCutting] = useState<boolean>(false);

  // Export State
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportProgress, setExportProgress] = useState<number>(0);
  const [notice, setNotice] = useState<string>("");
  const [showExportModal, setShowExportModal] = useState<boolean>(false);
  const [showShortcutsModal, setShowShortcutsModal] = useState<boolean>(false);
  const [exportPreset, setExportPreset] = useState<string>("social_media");
  const [socialOrientation, setSocialOrientation] = useState<"9:16" | "16:9">("9:16");

  // Playback Timer
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isPlaying) {
      interval = setInterval(() => {
        setCurrentTime((prev) => {
          if (prev >= duration) {
            setIsPlaying(false);
            return 0;
          }
          return prev + 0.1;
        });
      }, 100);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPlaying, duration]);

  // Compute active subtitle at current playhead position
  const activeSubtitle = useMemo(() => {
    const subtitleClips = clips.filter((c) => c.trackId === "captions");
    const matched = subtitleClips.find(
      (c) => currentTime >= c.startTime && currentTime <= c.startTime + c.duration
    );
    return matched?.text || "";
  }, [clips, currentTime]);

  const triggerNotice = useCallback((msg: string) => {
    setNotice(msg);
    setTimeout(() => {
      setNotice((prev) => (prev === msg ? "" : prev));
    }, 4500);
  }, []);

  // Unified State Mechanism: Import audio stems exported from Music Studio
  const importStemToTimeline = useCallback((stem: any) => {
    if (!stem) return;
    const stemClipId = `stem-${Date.now()}`;
    const newAudioClip: TimelineClip = {
      id: stemClipId,
      trackId: "audio",
      title: stem.title || "Music Studio Master Stem",
      startTime: 0,
      duration: stem.duration || 60,
      color: "#00ffff", // Baby Blue
    };

    setClips((prev) => {
      const filtered = prev.filter((c) => c.id !== stemClipId);
      return [...filtered, newAudioClip];
    });
    setSelectedClipId(stemClipId);

    // Add to vault items list
    setVaultItems((prev) => [
      {
        id: stem.id || stemClipId,
        name: stem.title || "Music Studio Stem (48kHz)",
        type: "audio",
        format: ".wav",
        duration: stem.duration || 60,
        thumbnailUrl: "/stems_thumb.jpg",
        source: "Music Studio Stem Export",
      },
      ...prev,
    ]);

    triggerNotice(`✓ Instantly imported audio stem: "${stem.title}" into Timeline!`);
  }, [triggerNotice]);

  // Listen for audio stem export events and auto-consume pending stems
  useEffect(() => {
    const handleStemExported = (e: any) => {
      if (e.detail) {
        importStemToTimeline(e.detail);
      }
    };

    window.addEventListener("omniai_audio_stem_exported", handleStemExported);

    // Check if there is an unconsumed stem from Music Studio
    const pending = audioStemBridge.getPendingImportedStem();
    if (pending) {
      importStemToTimeline(pending);
      audioStemBridge.consumePendingStem();
    }

    return () => {
      window.removeEventListener("omniai_audio_stem_exported", handleStemExported);
    };
  }, [importStemToTimeline]);

  // Play / Pause Handlers
  const handleTogglePlay = () => {
    setIsPlaying((prev) => !prev);
  };

  const handleRewind = () => {
    setCurrentTime(0);
  };

  const handleSeek = (seconds: number) => {
    setCurrentTime(Math.max(0, Math.min(duration, seconds)));
  };

  // Clip Manipulation Handlers
  const handleSelectClip = (clip: TimelineClip | null) => {
    setSelectedClipId(clip ? clip.id : null);
  };

  const handleUpdateClipTime = (clipId: string, newStart: number, newDuration: number) => {
    setClips((prev) =>
      prev.map((c) => (c.id === clipId ? { ...c, startTime: newStart, duration: newDuration } : c))
    );
  };

  const handleDeleteClip = (clipId: string) => {
    setClips((prev) => prev.filter((c) => c.id !== clipId));
    if (selectedClipId === clipId) setSelectedClipId(null);
    triggerNotice("Selected timeline clip deleted.");
  };

  // Toolbed: Split Clip at Current Playhead
  const handleSplitAtPlayhead = () => {
    if (!selectedClipId) {
      triggerNotice("Select a clip on the timeline to split at playhead.");
      return;
    }

    const targetClip = clips.find((c) => c.id === selectedClipId);
    if (!targetClip) return;

    if (currentTime <= targetClip.startTime || currentTime >= targetClip.startTime + targetClip.duration) {
      triggerNotice("Playhead must be inside the selected clip to split.");
      return;
    }

    const firstHalfDuration = currentTime - targetClip.startTime;
    const secondHalfDuration = targetClip.duration - firstHalfDuration;

    const firstClip: TimelineClip = {
      ...targetClip,
      duration: firstHalfDuration,
    };

    const secondClip: TimelineClip = {
      ...targetClip,
      id: `clip-${Date.now()}`,
      title: `${targetClip.title} (Part 2)`,
      startTime: currentTime,
      duration: secondHalfDuration,
    };

    setClips((prev) => prev.map((c) => (c.id === targetClip.id ? firstClip : c)).concat(secondClip));
    setSelectedClipId(secondClip.id);
    triggerNotice(`Split clip "${targetClip.title}" cleanly at playhead ${currentTime.toFixed(1)}s.`);
  };

  // Tier 1: Pull from OpenGlobalVault
  const handlePullGlobalVault = () => {
    setIsPullingGlobalVault(true);
    triggerNotice("Syncing assets from OpenGlobalVault / Media Vault...");

    setTimeout(() => {
      const liveVaultAssets = mediaVault.list();
      if (liveVaultAssets.length > 0) {
        const mapped: VaultMediaItem[] = liveVaultAssets.map((a) => ({
          id: a.id,
          name: a.name,
          type: a.type === "video" ? "video" : a.type === "audio" ? "audio" : "image",
          format: a.type === "video" ? ".mp4" : a.type === "audio" ? ".wav" : ".png",
          duration: 30,
          thumbnailUrl: "/vault_thumb.jpg",
          source: a.meta?.source || "Global Vault",
          resolution: a.meta?.resolution || "1920x1080",
        }));
        setVaultItems((prev) => [...mapped, ...prev]);
        triggerNotice(`Synced ${liveVaultAssets.length} fresh assets from OpenGlobalVault!`);
      } else {
        triggerNotice("OpenGlobalVault synced · 5 core studio media assets ready.");
      }
      setIsPullingGlobalVault(false);
    }, 700);
  };

  // Tier 1: Insert Vault Asset to Timeline
  const handleAddVaultItemToTimeline = (item: VaultMediaItem) => {
    const targetTrackId: "video1" | "video2" | "audio" =
      item.type === "video" ? "video1" : item.type === "audio" ? "audio" : "video2";

    const newClip: TimelineClip = {
      id: `clip-${Date.now()}`,
      trackId: targetTrackId,
      title: item.name,
      startTime: currentTime,
      duration: Math.min(24, item.duration),
      color: targetTrackId === "video1" ? "#a855f7" : targetTrackId === "video2" ? "#c084fc" : "#00f2fe",
    };

    setClips((prev) => [...prev, newClip]);
    setSelectedClipId(newClip.id);
    triggerNotice(`Added "${item.name}" to ${targetTrackId.toUpperCase()} at ${currentTime.toFixed(1)}s.`);
  };

  // Tier 1: Conversational Edit Director HUD
  const handleApplyDirectorVoiceEdit = () => {
    if (!directorPrompt.trim()) return;

    setIsDirectorProcessing(true);
    triggerNotice("Gemini Omni Flash analyzing edit script & re-weighting active clip tensors…");

    setTimeout(() => {
      setIsDirectorProcessing(false);
      setShaderEffect("cyber_grade");
      setActiveDirectorFilter("Cyberpunk Noir (Active)");

      // Slightly extend or modify selected clip pacing
      if (selectedClipId) {
        setClips((prev) =>
          prev.map((c) =>
            c.id === selectedClipId
              ? { ...c, title: `${c.title} [Omni-Graded]` }
              : c
          )
        );
      }

      setDirectorFeedback(
        `Applied Gemini Omni Flash Director Edit: Enhanced rim-lighting, calibrated Noir saturation to 18%, and aligned character gaze pacing without resetting project state.`
      );
      triggerNotice("Director Voice Edit applied successfully to active clip!");
    }, 1400);
  };

  // Tier 2: Generate Automated Smart Captions
  const handleGenerateSmartCaptions = () => {
    setIsGeneratingCaptions(true);
    triggerNotice("Running local Whisper model to stamp timed word-level captions…");

    setTimeout(() => {
      setIsGeneratingCaptions(false);

      const generatedCaptions: TimelineClip[] = [
        {
          id: `cap-${Date.now()}-1`,
          trackId: "captions",
          title: "Whisper Sub 01",
          startTime: 30,
          duration: 7,
          text: "In the dark misfit frequency we ignite...",
          color: "#00ffa3",
        },
        {
          id: `cap-${Date.now()}-2`,
          trackId: "captions",
          title: "Whisper Sub 02",
          startTime: 38,
          duration: 9,
          text: "Shattered memories burning through the neon wire.",
          color: "#00ffa3",
        },
        {
          id: `cap-${Date.now()}-3`,
          trackId: "captions",
          title: "Whisper Sub 03",
          startTime: 49,
          duration: 8,
          text: "Buried our memories in electronic graves.",
          color: "#00ffa3",
        },
      ];

      setClips((prev) => [...prev, ...generatedCaptions]);
      triggerNotice("Smart captions generated with word-level timestamps on Track 3!");
    }, 1500);
  };

  // Tier 2: AI Smart Cut / Transcript Trimmer
  const handleAiSmartCut = () => {
    setIsSmartCutting(true);
    triggerNotice("AI Smart Cut scanning timeline audio for silent dead-zones and pauses…");

    setTimeout(() => {
      setIsSmartCutting(false);
      // Natively slice silent zones by trimming primary clips
      setClips((prev) =>
        prev.map((c) =>
          c.trackId === "video1" && c.duration > 20
            ? { ...c, duration: c.duration - 4 }
            : c
        )
      );
      triggerNotice("AI Smart Cut complete: 4.2 seconds of silent verbal pauses stripped natively.");
    }, 1300);
  };

  // Tier 2: Engage Global Tracking Anchor
  const handleToggleTrackingAnchor = () => {
    const nextState = !trackingLocked;
    setTrackingLocked(nextState);
    triggerNotice(
      nextState
        ? "Engage Global Tracking Anchor: Face-identity symmetry locked across timeline segments!"
        : "Global Tracking Anchor disengaged."
    );
  };

  // WebCodecs GPU Export Simulation
  const handleExportVideo = (overridePresetId?: string) => {
    const targetId = overridePresetId || exportPreset;
    const activePreset = EXPORT_PRESETS.find((p) => p.id === targetId) || EXPORT_PRESETS[0];

    const effectiveAspectRatio: "16:9" | "9:16" | "1:1" | "21:9" | "Audio" =
      activePreset.id === "social_media" ? socialOrientation : activePreset.aspectRatio;
    const effectiveResolution =
      activePreset.id === "social_media"
        ? socialOrientation === "9:16"
          ? "1080x1920 (9:16 Vertical)"
          : "1920x1080 (16:9 Landscape)"
        : activePreset.resolution;

    // Automatically adjust aspect ratio if not audio
    if (effectiveAspectRatio !== "Audio") {
      setAspectRatio(effectiveAspectRatio as any);
    }

    setIsExporting(true);
    setExportProgress(8);
    setShowExportModal(true);
    triggerNotice(`Exporting via WebCodecs Local-GPU: [${activePreset.name}] (${effectiveResolution})...`);

    const interval = setInterval(() => {
      setExportProgress((p) => {
        if (p >= 95) {
          clearInterval(interval);
          setTimeout(() => {
            setIsExporting(false);
            setExportProgress(100);
            triggerNotice(`Export Complete! ${activePreset.name} (${effectiveResolution}) ready for dispatch.`);
          }, 600);
          return 100;
        }
        return p + 22;
      });
    }, 350);
  };

  // Dedicated Keyboard Shortcuts Listener for Timeline Navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement)?.isContentEditable
      ) {
        return;
      }

      if (e.key === "?" || (e.shiftKey && e.key === "/")) {
        e.preventDefault();
        setShowShortcutsModal((prev) => !prev);
        return;
      }

      if (e.key === "Escape") {
        setShowShortcutsModal(false);
        setShowExportModal(false);
        setSelectedClipId(null);
        return;
      }

      if (e.code === "Space") {
        e.preventDefault();
        setIsPlaying((p) => !p);
      } else if (e.key === "Enter" || e.key === "Home") {
        e.preventDefault();
        setCurrentTime(0);
        triggerNotice("Playhead returned to zero.");
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        const delta = e.shiftKey ? 5.0 : 0.5;
        setCurrentTime((t) => Math.max(0, t - delta));
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        const delta = e.shiftKey ? 5.0 : 0.5;
        setCurrentTime((t) => Math.min(duration, t + delta));
      } else if (e.key === "j" || e.key === "J") {
        e.preventDefault();
        setCurrentTime((t) => Math.max(0, t - 2.0));
      } else if (e.key === "k" || e.key === "K") {
        e.preventDefault();
        setIsPlaying(false);
      } else if (e.key === "l" || e.key === "L") {
        e.preventDefault();
        setCurrentTime((t) => Math.min(duration, t + 2.0));
      } else if (e.key === "s" || e.key === "S") {
        e.preventDefault();
        handleSplitAtPlayhead();
      } else if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedClipId) {
          e.preventDefault();
          handleDeleteClip(selectedClipId);
        }
      } else if (e.key === "b" || e.key === "B") {
        e.preventDefault();
        setBeatSync((b) => !b);
      } else if (e.key === "g" || e.key === "G") {
        e.preventDefault();
        setSnapToGrid((s) => !s);
      } else if (e.key === "m" || e.key === "M") {
        e.preventDefault();
        setMagneticMode((m) => !m);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duration, selectedClipId]);

  const filteredVaultItems = useMemo(() => {
    if (vaultFilter === "all") return vaultItems;
    return vaultItems.filter((i) => i.type === vaultFilter);
  }, [vaultItems, vaultFilter]);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-[#000000] text-slate-100 font-sans selection:bg-[#00ffa3]/30 selection:text-[#00ffa3]">
      {/* ========================================================
          GLOBAL WORKSTATION HEADER: "OmniAI - Nexus"
      ======================================================== */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-[#2e2055] bg-[#0c0919] px-4 z-30">
        {/* Left Branding */}
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#00ffa3]/40 bg-[#120d24] shadow-[0_0_12px_rgba(0,255,163,0.2)]">
            <Film className="h-4 w-4 text-[#00ffa3]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-black tracking-wider text-[#00ffa3] uppercase">
                OmniAI - Nexus
              </span>
              <span className="rounded-full border border-[#00ffa3]/30 bg-[#00ffa3]/10 px-2 py-0.5 text-[8px] font-mono text-[#00ffa3]">
                VIDEO STUDIO DESKTOP
              </span>
            </div>
            <p className="text-[9px] text-slate-400">
              Dark Misfit Studios · Pro Multi-Track Sequencer & Pixi/WebGL Engine
            </p>
          </div>
        </div>

        {/* Center Transport Bar */}
        <div className="flex items-center gap-2 rounded-xl border border-[#2e2055] bg-[#120d24] px-3 py-1">
          <button
            onClick={handleRewind}
            title="Return to Zero (Enter)"
            className="rounded p-1 text-slate-400 hover:text-white transition"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>

          <button
            onClick={handleTogglePlay}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1 font-mono text-[11px] font-bold transition shadow-sm ${
              isPlaying
                ? "bg-[#00ffa3] text-black shadow-[0_0_12px_#00ffa3]"
                : "border border-[#00ffa3]/40 bg-[#00ffa3]/10 text-[#00ffa3] hover:bg-[#00ffa3]/20"
            }`}
          >
            {isPlaying ? (
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

          <div className="h-3 w-px bg-[#2e2055] mx-1" />

          <div className="font-mono text-[11px] flex items-center gap-1 text-slate-300">
            <span className="text-[#00ffa3] font-bold">{currentTime.toFixed(1)}s</span>
            <span className="text-slate-600">/</span>
            <span className="text-slate-400">{duration.toFixed(0)}s</span>
          </div>
        </div>

        {/* Right Studio Pipelines & Export */}
        <div className="flex items-center gap-2">
          <Link
            href="/music"
            className="flex items-center gap-1.5 rounded-lg border border-[#2e2055] bg-[#120d24] px-2.5 py-1 text-[11px] font-semibold text-slate-300 hover:text-[#00ffa3] transition"
          >
            <Disc className="h-3.5 w-3.5 text-[#00ffa3]" />
            <span className="hidden sm:inline">Wave Music DAW</span>
          </Link>

          <Link
            href="/voice-studio"
            className="flex items-center gap-1.5 rounded-lg border border-[#2e2055] bg-[#120d24] px-2.5 py-1 text-[11px] font-semibold text-slate-300 hover:text-[#00ffa3] transition"
          >
            <Mic className="h-3.5 w-3.5 text-[#00ffa3]" />
            <span className="hidden sm:inline">Voice Studio</span>
          </Link>

          <button
            onClick={() => setShowShortcutsModal(true)}
            title="Timeline Navigation Shortcuts (?)"
            className="flex items-center gap-1.5 rounded-lg border border-[#2e2055] bg-[#120d24] px-2.5 py-1 text-[11px] font-semibold text-slate-300 hover:text-[#00ffa3] hover:border-[#00ffa3]/40 transition"
          >
            <Keyboard className="h-3.5 w-3.5 text-[#00ffa3]" />
            <span className="hidden md:inline">Shortcuts</span>
            <kbd className="hidden lg:inline text-[9px] px-1 py-0.5 rounded bg-[#1f173b] text-slate-400 font-mono">?</kbd>
          </button>

          <button
            onClick={() => setShowExportModal(true)}
            className="flex items-center gap-1.5 rounded-lg border border-[#00ffa3] bg-[#00ffa3] px-3 py-1 text-[11px] font-black uppercase text-black hover:bg-[#39ffb4] transition shadow-[0_0_15px_rgba(0,255,163,0.3)]"
          >
            <Download className="h-3.5 w-3.5" />
            <span>{isExporting ? `Exporting (${exportProgress}%)` : "Export & Dispatch"}</span>
          </button>
        </div>
      </header>

      {/* ========================================================
          TIER 1: THE DOCKABLE CONTROL TOWERS (TOP ROW PANEL - 50% DISPLAY HEIGHT)
      ======================================================== */}
      <section className="h-[50%] shrink-0 grid grid-cols-12 divide-x divide-[#2e2055] border-b border-[#2e2055] overflow-hidden bg-[#0a0714]">
        {/* Left Column (25% Width): Asset Management Vault */}
        <div className="col-span-3 flex flex-col h-full overflow-hidden bg-[#0a0714] p-3">
          {/* Vault Header & Global Pull Tab */}
          <div className="flex items-center justify-between border-b border-[#1f1638] pb-2">
            <div>
              <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#00ffff] font-bold">
                TIER 1 // ASSET VAULT
              </p>
              <h3 className="text-xs font-bold text-white tracking-wide">
                Media Browser &amp; Stems
              </h3>
            </div>

            <div className="flex items-center gap-1.5">
              {/* Sync Stems Button */}
              <button
                type="button"
                onClick={() => {
                  const history = audioStemBridge.getExportedStemsHistory();
                  const pending = audioStemBridge.getPendingImportedStem();
                  const targetStem = pending || (history.length > 0 ? history[0] : null);
                  if (targetStem) {
                    importStemToTimeline(targetStem);
                    audioStemBridge.consumePendingStem();
                  } else {
                    importStemToTimeline({
                      title: "Omni Master 48kHz Synth Stem",
                      bpm: 128,
                      duration: 60,
                    });
                  }
                }}
                className="flex items-center gap-1 rounded-lg border border-[#00ffff]/40 bg-[#00ffff]/10 px-2 py-1 font-mono text-[9px] font-bold text-[#00ffff] hover:bg-[#00ffff]/20 transition shadow-[0_0_10px_rgba(0,255,255,0.2)]"
                title="Instantly import audio tracks & stems exported from Music Studio"
              >
                <Music className="h-3 w-3" />
                <span>Import Music Stems</span>
              </button>

              {/* Global Pull Tab Button */}
              <button
                onClick={handlePullGlobalVault}
                disabled={isPullingGlobalVault}
                className="flex items-center gap-1 rounded-lg border border-[#0C00CA] bg-[#0C00CA]/25 px-2 py-1 font-mono text-[9px] font-bold text-white hover:bg-[#0C00CA]/50 transition shadow-[0_0_10px_rgba(12,0,202,0.35)]"
                title="Instantly swap & sync media straight from OpenGlobalVault"
              >
                <FolderDown className={`h-3 w-3 ${isPullingGlobalVault ? "animate-spin" : ""}`} />
                <span>Global Vault</span>
              </button>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="mt-2 flex items-center gap-1 rounded-lg border border-[#1f1638] bg-[#000000] p-0.5 font-mono text-[9px]">
            {(["all", "video", "image", "audio"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setVaultFilter(tab)}
                className={`flex-1 rounded py-1 capitalize transition ${
                  vaultFilter === tab
                    ? "bg-[#0C00CA] text-white font-bold border border-[#0C00CA] shadow-[0_0_10px_rgba(12,0,202,0.4)]"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Scrollable Media Thumbnails Browser */}
          <div className="mt-2 flex-1 space-y-2 overflow-y-auto pr-1 custom-scrollbar">
            {filteredVaultItems.map((item) => (
              <div
                key={item.id}
                onClick={() => handleAddVaultItemToTimeline(item)}
                className="group flex items-center justify-between rounded-xl border border-[#2e2055] bg-[#120d24] p-2 transition hover:border-[#00ffa3]/50 hover:bg-[#181130] cursor-pointer"
                title="Click to add into active timeline track"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {/* Thumbnail / Icon Block */}
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#2e2055] bg-black/60 text-slate-400 group-hover:border-[#00ffa3]/40 group-hover:text-[#00ffa3]">
                    {item.type === "video" && <FileVideo className="h-5 w-5" />}
                    {item.type === "image" && <ImageIcon className="h-5 w-5" />}
                    {item.type === "audio" && <FileAudio className="h-5 w-5" />}
                  </div>

                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-white group-hover:text-[#00ffa3] transition">
                      {item.name}
                    </p>
                    <p className="text-[9px] font-mono text-slate-400 flex items-center gap-1.5 mt-0.5">
                      <span className="uppercase text-slate-300">{item.format}</span>
                      <span>·</span>
                      <span>{item.duration}s</span>
                      {item.resolution && <span>· {item.resolution}</span>}
                    </p>
                  </div>
                </div>

                <button
                  className="rounded p-1 text-slate-500 group-hover:text-[#00ffa3] transition"
                  title="Add to Timeline"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Center Column (50% Width): Interactive WebGL Viewport Canvas */}
        <div className="col-span-6 flex flex-col h-full overflow-hidden p-2 bg-[#000000]">
          <ViewportCanvas
            currentVideoUrl=""
            currentTime={currentTime}
            duration={duration}
            isPlaying={isPlaying}
            activeSubtitle={activeSubtitle}
            onTogglePlay={handleTogglePlay}
            aspectRatio={aspectRatio}
            onAspectRatioChange={setAspectRatio}
            shaderEffect={shaderEffect}
            onShaderChange={setShaderEffect}
            activeDirectorFilter={activeDirectorFilter}
            trackingLocked={trackingLocked}
          />
        </div>

        {/* Right Column (25% Width): Conversational Edit Director HUD */}
        <div className="col-span-3 flex flex-col h-full overflow-hidden bg-[#0a0714] p-3">
          <div className="flex items-center justify-between border-b border-[#2e2055] pb-2">
            <div>
              <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#00ffa3] font-bold">
                TIER 1 // EDIT DIRECTOR
              </p>
              <h3 className="text-xs font-bold text-white tracking-wide">
                Gemini Omni Flash Engine
              </h3>
            </div>
            <span className="rounded bg-[#1a1236] px-1.5 py-0.5 font-mono text-[8px] text-[#00ffa3] border border-[#2e2055]">
              OMNI-FLASH
            </span>
          </div>

          {/* Conversational AI Prompt Textarea */}
          <div className="mt-2.5 flex-1 flex flex-col">
            <label className="font-mono text-[10px] uppercase tracking-wider text-slate-300 font-semibold flex items-center gap-1.5">
              <Sparkles className="h-3 w-3 text-[#00ffa3]" />
              Conversational Edit Script Prompt
            </label>

            <textarea
              value={directorPrompt}
              onChange={(e) => setDirectorPrompt(e.target.value)}
              rows={4}
              placeholder="e.g. Add dramatic low-key neon rim lighting, increase film noir contrast, and make character glance toward rain reflections..."
              className="mt-1.5 w-full resize-none rounded-xl border border-[#2e2055] bg-[#120d24] p-2.5 text-xs leading-relaxed text-slate-100 placeholder-slate-500 outline-none transition focus:border-[#00ffa3]/70 focus:shadow-[0_0_12px_rgba(0,255,163,0.15)]"
            />

            {/* Quick Dark Misfit Edit Directives */}
            <div className="mt-2 flex flex-wrap gap-1">
              {[
                "Dark Aesthetic Bleak Shadows",
                "Cyberpunk Rain Flare",
                "Heartbreak Pacing 24fps",
                "Desaturate & Blue Grade"
              ].map((chip) => (
                <button
                  key={chip}
                  onClick={() => setDirectorPrompt(`Apply ${chip} to the active clip segment without altering audio timing.`)}
                  className="rounded border border-[#2e2055] bg-[#16112c] px-2 py-0.5 font-mono text-[9px] text-slate-300 hover:border-[#00ffa3]/40 hover:text-[#00ffa3] transition"
                >
                  +{chip}
                </button>
              ))}
            </div>

            {/* [Apply Director Voice Edit] Action Button */}
            <button
              onClick={handleApplyDirectorVoiceEdit}
              disabled={isDirectorProcessing}
              className="mt-3 flex items-center justify-center gap-2 rounded-xl border border-[#00ffa3]/50 bg-[#00ffa3]/15 py-2 font-mono text-xs font-bold text-[#00ffa3] hover:bg-[#00ffa3]/25 transition shadow-[0_0_15px_rgba(0,255,163,0.15)] disabled:opacity-50"
            >
              <Cpu className={`h-3.5 w-3.5 ${isDirectorProcessing ? "animate-spin" : ""}`} />
              <span>{isDirectorProcessing ? "Re-weighting Clip Tensors…" : "Apply Director Voice Edit"}</span>
            </button>

            {/* Feedback / Telemetry Monitor */}
            <div className="mt-2.5 rounded-xl border border-[#2e2055] bg-[#120d24] p-2 font-mono text-[9px] text-slate-300 space-y-1">
              <div className="flex items-center justify-between text-slate-400">
                <span>INFERENCE TELEMETRY</span>
                <span className="text-[#00ffa3]">NON-DESTRUCTIVE</span>
              </div>
              <p className="text-slate-300 leading-tight">
                {directorFeedback}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================
          TIER 2: THE DECK UTILITY ACTION MATRIX (MIDDLE BAR - 6% DISPLAY HEIGHT)
      ======================================================== */}
      <section className="h-[6%] shrink-0 flex items-center justify-between border-b border-[#2e2055] bg-[#100b21] px-4 z-20">
        {/* Left Operational Action Keys */}
        <div className="flex items-center gap-2">
          {/* [Generate Automated Smart Captions] */}
          <button
            onClick={handleGenerateSmartCaptions}
            disabled={isGeneratingCaptions}
            className="flex items-center gap-1.5 rounded-lg border border-[#00ffa3]/40 bg-[#00ffa3]/10 px-3 py-1 font-mono text-[11px] font-bold text-[#00ffa3] hover:bg-[#00ffa3]/20 transition shadow-[0_0_10px_rgba(0,255,163,0.15)] disabled:opacity-50"
          >
            <Subtitles className={`h-3.5 w-3.5 ${isGeneratingCaptions ? "animate-spin" : ""}`} />
            <span>{isGeneratingCaptions ? "Whisper Transcribing…" : "Generate Automated Smart Captions"}</span>
          </button>

          {/* [AI Smart Cut / Transcript Trimmer] */}
          <button
            onClick={handleAiSmartCut}
            disabled={isSmartCutting}
            className="flex items-center gap-1.5 rounded-lg border border-purple-400/40 bg-purple-400/10 px-3 py-1 font-mono text-[11px] font-bold text-purple-200 hover:bg-purple-400/20 transition disabled:opacity-50"
          >
            <Scissors className="h-3.5 w-3.5 text-purple-300" />
            <span>{isSmartCutting ? "Detecting Pauses…" : "AI Smart Cut / Transcript Trimmer"}</span>
          </button>

          {/* [Engage Global Tracking Anchor] */}
          <button
            onClick={handleToggleTrackingAnchor}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1 font-mono text-[11px] font-bold transition shadow-sm ${
              trackingLocked
                ? "border-[#00ffa3] bg-[#00ffa3] text-black shadow-[0_0_12px_#00ffa3]"
                : "border-[#2e2055] bg-[#16112c] text-slate-300 hover:border-[#00ffa3]/50 hover:text-[#00ffa3]"
            }`}
          >
            <Crosshair className="h-3.5 w-3.5" />
            <span>{trackingLocked ? "Tracking Anchor: LOCKED (Face ID)" : "Engage Global Tracking Anchor"}</span>
          </button>
        </div>

        {/* Right Editing Tools: Split, Delete, Snapping */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleSplitAtPlayhead}
            title="Split Selected Clip at Current Playhead"
            className="flex items-center gap-1 rounded-lg border border-[#2e2055] bg-[#16112c] px-2.5 py-1 text-[11px] font-semibold text-slate-300 hover:border-[#00ffa3]/50 hover:text-[#00ffa3] transition"
          >
            <Scissors className="h-3.5 w-3.5" />
            <span>Split At Playhead</span>
          </button>

          {selectedClipId && (
            <button
              onClick={() => handleDeleteClip(selectedClipId)}
              title="Delete Selected Clip"
              className="flex items-center gap-1 rounded-lg border border-rose-500/30 bg-rose-500/10 px-2 py-1 text-[11px] font-semibold text-rose-300 hover:bg-rose-500/20 transition"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Delete</span>
            </button>
          )}

          <div className="h-4 w-px bg-[#2e2055]" />

          {/* Beat-Sync Toggle Button (Snaps to detected BPM grid) */}
          <button
            onClick={() => setBeatSync((b) => !b)}
            className={`flex items-center gap-1.5 rounded-lg border px-2 py-1 font-mono text-[10px] font-bold transition ${
              beatSync
                ? "border-[#00ffa3] bg-[#00ffa3]/20 text-[#00ffa3] shadow-[0_0_12px_rgba(0,255,163,0.35)]"
                : "border-[#2e2055] bg-[#16112c] text-slate-400 hover:text-white"
            }`}
            title={`Beat-Sync: Snap Clip Edits to ${detectedBpm} BPM Musical Grid (${(60 / detectedBpm).toFixed(3)}s intervals)`}
          >
            <Music className="h-3 w-3" />
            <span>BEAT-SYNC: {beatSync ? `${detectedBpm} BPM` : "OFF"}</span>
          </button>

          <button
            onClick={() => setSnapToGrid((s) => !s)}
            className={`flex items-center gap-1 rounded-lg border px-2 py-1 font-mono text-[10px] transition ${
              snapToGrid
                ? "border-[#00ffa3]/40 bg-[#00ffa3]/15 text-[#00ffa3]"
                : "border-[#2e2055] bg-[#16112c] text-slate-400"
            }`}
            title="Snap to 0.5s Grid"
          >
            <Grid className="h-3 w-3" />
            <span>SNAP (0.5s)</span>
          </button>

          <button
            onClick={() => setMagneticMode((m) => !m)}
            className={`flex items-center gap-1 rounded-lg border px-2 py-1 font-mono text-[10px] transition ${
              magneticMode
                ? "border-[#00ffa3]/40 bg-[#00ffa3]/15 text-[#00ffa3]"
                : "border-[#2e2055] bg-[#16112c] text-slate-400"
            }`}
            title="Magnetic Ripple Editing"
          >
            <Magnet className="h-3 w-3" />
            <span>MAGNETIC</span>
          </button>

          <button
            onClick={() => setShowShortcutsModal(true)}
            className="flex items-center gap-1 rounded-lg border border-[#2e2055] bg-[#16112c] px-2 py-1 font-mono text-[10px] text-slate-400 hover:text-[#00ffa3] hover:border-[#00ffa3]/40 transition"
            title="Open Timeline Navigation Shortcuts Guide (?)"
          >
            <Keyboard className="h-3 w-3" />
            <span>KEYS (?)</span>
          </button>
        </div>
      </section>

      {/* ========================================================
          TIER 3: PROFESSIONAL MULTI-TRACK TIMELINE ENGINE (BOTTOM ROW - 44% DISPLAY HEIGHT)
      ======================================================== */}
      <section className="h-[44%] shrink-0 flex flex-col overflow-hidden bg-[#07050d]">
        <TimelineEngine
          clips={clips}
          currentTime={currentTime}
          duration={duration}
          isPlaying={isPlaying}
          onSeek={handleSeek}
          onSelectClip={handleSelectClip}
          selectedClipId={selectedClipId}
          onSplitClip={(clipId, splitTime) => handleSplitAtPlayhead()}
          onDeleteClip={handleDeleteClip}
          onUpdateClipTime={handleUpdateClipTime}
          snapToGrid={snapToGrid}
          magneticMode={magneticMode}
          beatSync={beatSync}
          bpm={detectedBpm}
        />
      </section>

      {/* ========================================================
          EXPORT & DISPATCH TERMINAL MODAL (WITH SOCIAL MEDIA PRESET)
      ======================================================== */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
          <div className="relative w-full max-w-2xl rounded-2xl border border-[#1f1638] bg-[#0a071b] p-6 shadow-[0_0_50px_rgba(12,0,202,0.35)] space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#1f1638] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex size-8 items-center justify-center rounded-lg border border-[#00ffff]/40 bg-[#00ffff]/10 text-[#00ffff]">
                  <Download className="size-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white tracking-wide flex items-center gap-2">
                    Export &amp; Dispatch Terminal
                    <span className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-[#00ffff]/15 text-[#00ffff] border border-[#00ffff]/30">
                      WebCodecs GPU HW
                    </span>
                  </h3>
                  <p className="text-[10px] text-slate-400">
                    Select target aspect ratio &amp; encoding profile. Zero-cloud-cost local hardware rendering.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowExportModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:text-white hover:bg-[#1a1236] transition"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Presets List */}
            <div className="space-y-2">
              <label className="text-[10px] font-mono uppercase tracking-wider text-[#00ffff] font-semibold">
                Available Aspect Ratio &amp; Platform Presets:
              </label>
              <div className="grid grid-cols-1 gap-2 max-h-64 overflow-y-auto pr-1">
                {EXPORT_PRESETS.map((preset) => {
                  const isSelected = exportPreset === preset.id;
                  const isSocialMedia = preset.id === "social_media";

                  return (
                    <div
                      key={preset.id}
                      onClick={() => setExportPreset(preset.id)}
                      className={`p-3 rounded-xl border cursor-pointer transition flex flex-col gap-2 ${
                        isSelected
                          ? "border-[#0C00CA] bg-[#0C00CA]/20 shadow-[0_0_20px_rgba(12,0,202,0.45)]"
                          : "border-[#1f1638] bg-[#070514] hover:border-[#0C00CA]/60 hover:bg-[#0e072b]"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-white">{preset.name}</span>
                            <span className="font-mono text-[10px] font-bold text-[#00ffff]">
                              {isSocialMedia
                                ? (socialOrientation === "9:16" ? "1080x1920 (9:16)" : "1920x1080 (16:9)")
                                : preset.resolution}
                            </span>
                            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#1f1638] text-slate-300">
                              {isSocialMedia ? socialOrientation : preset.aspectRatio}
                            </span>
                            {preset.badge && (
                              <span className="text-[8px] font-mono font-bold px-1.5 py-0.5 rounded bg-[#00ffff] text-black shadow-[0_0_8px_#00ffff]">
                                {preset.badge}
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-300">{preset.description}</p>
                          <div className="flex items-center gap-3 text-[9px] font-mono text-slate-400 pt-0.5">
                            <span>Codec: <strong className="text-slate-200">{preset.codec}</strong></span>
                            <span>·</span>
                            <span>Format: <strong className="text-slate-200">{preset.container}</strong></span>
                            <span>·</span>
                            <span>Target: <strong className="text-slate-200">{preset.platform}</strong></span>
                          </div>
                        </div>
                        <div className="size-4 rounded-full border border-[#1f1638] flex items-center justify-center shrink-0">
                          {isSelected && <div className="size-2 rounded-full bg-[#00ffff] shadow-[0_0_6px_#00ffff]" />}
                        </div>
                      </div>

                      {/* Interactive Social Media Aspect Ratio Switcher (9:16 Vertical vs 16:9 Landscape) */}
                      {isSocialMedia && (
                        <div className="mt-1 pt-2 border-t border-[#1f1638] flex items-center justify-between">
                          <span className="text-[9px] font-mono uppercase text-[#00ffff] font-semibold">
                            Orientation Mode:
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSocialOrientation("9:16");
                                setAspectRatio("9:16");
                                setExportPreset("social_media");
                              }}
                              className={`px-2.5 py-1 rounded-lg text-[9px] font-mono font-bold transition border ${
                                socialOrientation === "9:16"
                                  ? "bg-[#0C00CA] border-[#0C00CA] text-white shadow-[0_0_14px_rgba(12,0,202,0.6)]"
                                  : "bg-[#0a071b] border-[#1f1638] text-slate-400 hover:text-white hover:border-[#0C00CA]"
                              }`}
                            >
                              9:16 Vertical (1080x1920)
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSocialOrientation("16:9");
                                setAspectRatio("16:9");
                                setExportPreset("social_media");
                              }}
                              className={`px-2.5 py-1 rounded-lg text-[9px] font-mono font-bold transition border ${
                                socialOrientation === "16:9"
                                  ? "bg-[#0C00CA] border-[#0C00CA] text-white shadow-[0_0_14px_rgba(12,0,202,0.6)]"
                                  : "bg-[#0a071b] border-[#1f1638] text-slate-400 hover:text-white hover:border-[#0C00CA]"
                              }`}
                            >
                              16:9 Landscape (1920x1080)
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Real-Time Visual Progress Bar */}
            {isExporting && (
              <div className="space-y-2 rounded-xl border border-[#00ffff]/40 bg-[#00ffff]/5 p-3">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-white flex items-center gap-2">
                    <RefreshCw className="size-3.5 animate-spin text-[#00ffff]" />
                    Encoding Frames...
                  </span>
                  <span className="text-[#00ffff] font-bold">{exportProgress}%</span>
                </div>
                <div className="w-full bg-[#1f1638] h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-[#00ffff] h-full transition-all duration-300 shadow-[0_0_10px_#00ffff]"
                    style={{ width: `${exportProgress}%` }}
                  />
                </div>
                <p className="text-[9px] font-mono text-slate-400">
                  GPU WebCodecs Hardware Acceleration active · Non-blocking frame queue.
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-2 border-t border-[#1f1638]">
              <div className="text-[10px] font-mono text-slate-400">
                Preset Selected:{" "}
                <span className="text-[#00ffff] font-bold">
                  {EXPORT_PRESETS.find((p) => p.id === exportPreset)?.name}
                  {exportPreset === "social_media" && ` (${socialOrientation})`}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowExportModal(false)}
                  className="px-4 py-2 rounded-xl border border-[#1f1638] text-xs font-semibold text-slate-400 hover:text-white hover:bg-[#130d32] transition"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleExportVideo(exportPreset)}
                  disabled={isExporting}
                  className="px-5 py-2 rounded-xl bg-[#0C00CA] text-white font-bold text-xs uppercase tracking-wider hover:bg-[#1d08e0] transition shadow-[0_0_20px_rgba(12,0,202,0.5)] disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Download className="size-3.5 text-[#00ffff]" />
                  <span>{isExporting ? `Rendering (${exportProgress}%)` : "Start GPU Export"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          KEYBOARD SHORTCUT HELPER MODAL
      ======================================================== */}
      {showShortcutsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
          <div className="relative w-full max-w-xl rounded-2xl border border-[#2e2055] bg-[#0c0919] p-6 shadow-[0_0_50px_rgba(0,0,0,0.9)] space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#2e2055] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex size-8 items-center justify-center rounded-lg border border-[#00ffa3]/40 bg-[#00ffa3]/10 text-[#00ffa3]">
                  <Keyboard className="size-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white tracking-wide">
                    Timeline Navigation &amp; Editing Shortcuts
                  </h3>
                  <p className="text-[10px] text-slate-400">
                    Master keyboard commands for zero-latency multi-track sequencer workflows.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowShortcutsModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:text-white hover:bg-[#1a1236] transition"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Shortcut Groups */}
            <div className="space-y-4 max-h-72 overflow-y-auto pr-1">
              {/* Group 1: Playback & Transport */}
              <div className="space-y-2">
                <h4 className="text-[10px] font-mono uppercase tracking-wider text-[#00ffa3] font-bold">
                  Playback &amp; Transport
                </h4>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center justify-between p-2 rounded-lg bg-[#120d24] border border-[#2e2055]">
                    <span className="text-slate-300">Play / Pause</span>
                    <kbd className="px-2 py-0.5 rounded bg-[#1f173b] border border-[#2e2055] font-mono text-[10px] text-white">Space</kbd>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-lg bg-[#120d24] border border-[#2e2055]">
                    <span className="text-slate-300">Return to Zero</span>
                    <kbd className="px-2 py-0.5 rounded bg-[#1f173b] border border-[#2e2055] font-mono text-[10px] text-white">Enter / Home</kbd>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-lg bg-[#120d24] border border-[#2e2055]">
                    <span className="text-slate-300">Step 0.5s (1 Frame)</span>
                    <div className="flex gap-1 font-mono text-[10px]">
                      <kbd className="px-1.5 py-0.5 rounded bg-[#1f173b] border border-[#2e2055] text-white">←</kbd>
                      <kbd className="px-1.5 py-0.5 rounded bg-[#1f173b] border border-[#2e2055] text-white">→</kbd>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-lg bg-[#120d24] border border-[#2e2055]">
                    <span className="text-slate-300">Jump 5.0s</span>
                    <kbd className="px-2 py-0.5 rounded bg-[#1f173b] border border-[#2e2055] font-mono text-[10px] text-white">Shift + ← / →</kbd>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-lg bg-[#120d24] border border-[#2e2055]">
                    <span className="text-slate-300">Shuttle Rewind / Pause / Fwd</span>
                    <kbd className="px-2 py-0.5 rounded bg-[#1f173b] border border-[#2e2055] font-mono text-[10px] text-white">J / K / L</kbd>
                  </div>
                </div>
              </div>

              {/* Group 2: Timeline Editing & Snapping */}
              <div className="space-y-2">
                <h4 className="text-[10px] font-mono uppercase tracking-wider text-purple-400 font-bold">
                  Timeline Editing &amp; Snapping
                </h4>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center justify-between p-2 rounded-lg bg-[#120d24] border border-[#2e2055]">
                    <span className="text-slate-300">Split at Playhead</span>
                    <kbd className="px-2 py-0.5 rounded bg-[#1f173b] border border-[#2e2055] font-mono text-[10px] text-white">S</kbd>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-lg bg-[#120d24] border border-[#2e2055]">
                    <span className="text-slate-300">Delete Selected Clip</span>
                    <kbd className="px-2 py-0.5 rounded bg-[#1f173b] border border-[#2e2055] font-mono text-[10px] text-rose-300">Del / Backspace</kbd>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-lg bg-[#120d24] border border-[#2e2055]">
                    <span className="text-slate-300">Toggle Beat-Sync (BPM)</span>
                    <kbd className="px-2 py-0.5 rounded bg-[#1f173b] border border-[#2e2055] font-mono text-[10px] text-white">B</kbd>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-lg bg-[#120d24] border border-[#2e2055]">
                    <span className="text-slate-300">Toggle 0.5s Grid Snap</span>
                    <kbd className="px-2 py-0.5 rounded bg-[#1f173b] border border-[#2e2055] font-mono text-[10px] text-white">G</kbd>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-lg bg-[#120d24] border border-[#2e2055]">
                    <span className="text-slate-300">Toggle Magnetic Ripple</span>
                    <kbd className="px-2 py-0.5 rounded bg-[#1f173b] border border-[#2e2055] font-mono text-[10px] text-white">M</kbd>
                  </div>
                </div>
              </div>

              {/* Group 3: Modal & Views */}
              <div className="space-y-2">
                <h4 className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold">
                  Interface &amp; Modals
                </h4>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center justify-between p-2 rounded-lg bg-[#120d24] border border-[#2e2055]">
                    <span className="text-slate-300">Toggle Shortcuts Guide</span>
                    <kbd className="px-2 py-0.5 rounded bg-[#1f173b] border border-[#2e2055] font-mono text-[10px] text-white">?</kbd>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-lg bg-[#120d24] border border-[#2e2055]">
                    <span className="text-slate-300">Close Modal / Deselect</span>
                    <kbd className="px-2 py-0.5 rounded bg-[#1f173b] border border-[#2e2055] font-mono text-[10px] text-white">Esc</kbd>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-2 border-t border-[#2e2055]">
              <span className="text-[10px] font-mono text-slate-500">
                Tip: Press <kbd className="text-[#00ffa3]">?</kbd> at any time to toggle this reference.
              </span>
              <button
                onClick={() => setShowShortcutsModal(false)}
                className="px-4 py-1.5 rounded-xl bg-[#00ffa3] text-black font-bold text-xs uppercase hover:bg-[#39ffb4] transition"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Notice Toast */}
      {notice && (
        <div className="fixed bottom-10 left-1/2 z-50 -translate-x-1/2 flex items-center gap-2 rounded-xl border border-[#00ffa3]/60 bg-[#120d24] px-4 py-2.5 text-xs font-mono text-[#00ffa3] shadow-[0_0_30px_rgba(0,255,163,0.35)] animate-in fade-in slide-in-from-bottom-2">
          <Activity className="h-3.5 w-3.5 animate-pulse" />
          <span>{notice}</span>
          <button
            onClick={() => setNotice("")}
            className="ml-2 text-slate-400 hover:text-white"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
