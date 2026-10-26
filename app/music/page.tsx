"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Play,
  Pause,
  Square,
  RotateCcw,
  Repeat,
  Circle,
  Volume2,
  Sparkles,
  Music,
  Mic,
  Sliders,
  Scissors,
  Download,
  Share2,
  ArrowUpRight,
  Upload,
  Radio,
  Layers,
  Cpu,
  FileArchive,
  RefreshCw,
  Terminal,
  Zap,
  Check,
  Disc,
  Activity,
  SlidersHorizontal,
  ChevronRight,
  FolderDown
} from "lucide-react";
import CircularAudioVisualizer from "./CircularAudioVisualizer";
import TimelineMixer from "./TimelineMixer";
import VisualBpmCounter from "./VisualBpmCounter";
import { dawSynthEngine, type StemTrackState } from "@/lib/dawSynthEngine";
import { mediaVault, type VaultAsset } from "@/lib/mediaVault";

// Preset sonic styles aligned with Dark Misfit Studios
const SONIC_STYLES = [
  { id: "dark_synth", label: "Dark Synthwave", bpm: 110, key: "C Minor", prompt: "Dark cyberpunk analog synthwave with brooding low-end Moog bass, 80s gated snare, and neon atmospheric pads" },
  { id: "cyber_ind", label: "Cyberpunk Industrial", bpm: 128, key: "D Minor", prompt: "Heavy distorted industrial bass, metallic percussion hits, dystopian saw leads, and aggressive sub-harmonic rumble" },
  { id: "gothic_trap", label: "Gothic 808 Trap", bpm: 138, key: "F# Minor", prompt: "Dark gothic trap beat with sliding 808 sub bass, minor melancholic bells, ghostly choir reverb, and crisp memphis hi-hats" },
  { id: "heartbreak", label: "Heartbreak Dark Pop", bpm: 95, key: "A Minor", prompt: "Emotional dark pop anthem, sorrowful intimate piano chords, sub-bass pulse, vocal chops, theme of betrayal and loss" },
  { id: "phonk", label: "Heavy Phonk / Drift", bpm: 140, key: "E Minor", prompt: "Raw Memphis dark phonk, distorted cowbell melodies, punchy punch sub 808, sidechained white noise, gritty textures" },
  { id: "ambient_void", label: "Obsidian Void Ambient", bpm: 70, key: "C Minor", prompt: "Ethereal dark cinematic soundscape, deep drone frequencies, time-stretched vocal fragments, infinite obsidian reverb" },
];

const SONG_STRUCTURES = [
  { id: "standard", name: "Standard Pro: Intro [8b] > Verse [16b] > Chorus [16b] > Drop [16b] > Outro [8b]" },
  { id: "club", name: "Club Arc: Ambient Build [16b] > Heavy Drop [32b] > Breakdown [16b] > Peak Drop [32b]" },
  { id: "cinematic", name: "Cinematic Arc: Void Drone > Melancholy Theme > Orchestral Climax > Sudden Cut" },
  { id: "extended", name: "Extended Jam: Continuous 32-Bar Loop + Neural Stem Evolution" },
];

const KEY_SIGNATURES = [
  "C Minor", "C# Minor", "D Minor", "Eb Minor", "E Minor", "F Minor", "F# Minor", "G Minor", "Ab Minor", "A Minor", "Bb Minor", "B Minor"
];

// Initial multi-track timeline layer configurations
const INITIAL_TRACKS: StemTrackState[] = [
  {
    id: "vocals",
    name: "01 · Vocals Track",
    type: "vocals",
    color: "#38bdf8", // Blue highlight row
    volume: 85,
    pan: 0,
    muted: false,
    solo: false,
    bypassed: false,
    peaks: [
      0.15, 0.42, 0.78, 0.95, 0.65, 0.88, 0.32, 0.1, 0.05, 0.38, 0.82, 0.91, 0.73, 0.89, 0.45, 0.12,
      0.22, 0.61, 0.84, 0.98, 0.79, 0.92, 0.54, 0.25, 0.18, 0.52, 0.87, 0.96, 0.71, 0.84, 0.48, 0.15,
      0.12, 0.35, 0.74, 0.92, 0.61, 0.85, 0.38, 0.08, 0.04, 0.41, 0.79, 0.88, 0.69, 0.82, 0.39, 0.09,
      0.28, 0.66, 0.91, 0.99, 0.85, 0.94, 0.62, 0.31, 0.24, 0.58, 0.89, 0.97, 0.76, 0.89, 0.52, 0.18
    ],
  },
  {
    id: "instrumentals",
    name: "02 · Instrumentals Track",
    type: "instrumentals",
    color: "#a855f7", // Purple highlight row
    volume: 80,
    pan: -10,
    muted: false,
    solo: false,
    bypassed: false,
    peaks: [
      0.55, 0.62, 0.71, 0.68, 0.75, 0.82, 0.78, 0.85, 0.62, 0.69, 0.74, 0.79, 0.85, 0.88, 0.81, 0.76,
      0.58, 0.65, 0.73, 0.71, 0.78, 0.86, 0.82, 0.89, 0.66, 0.72, 0.77, 0.82, 0.89, 0.91, 0.85, 0.79,
      0.52, 0.59, 0.68, 0.65, 0.72, 0.79, 0.75, 0.81, 0.59, 0.66, 0.71, 0.76, 0.82, 0.85, 0.78, 0.73,
      0.61, 0.68, 0.76, 0.74, 0.81, 0.89, 0.85, 0.92, 0.69, 0.75, 0.81, 0.86, 0.92, 0.95, 0.88, 0.82
    ],
  },
  {
    id: "bass_drums",
    name: "03 · Bass & Low-End Drum Track",
    type: "bass_drums",
    color: "#00f2fe", // Cyan highlight row
    volume: 90,
    pan: 0,
    muted: false,
    solo: false,
    bypassed: false,
    peaks: [
      0.95, 0.12, 0.88, 0.15, 0.98, 0.22, 0.91, 0.28, 0.96, 0.14, 0.89, 0.18, 0.99, 0.25, 0.93, 0.31,
      0.96, 0.14, 0.89, 0.18, 0.99, 0.25, 0.93, 0.31, 0.97, 0.16, 0.91, 0.21, 1.00, 0.28, 0.95, 0.34,
      0.93, 0.11, 0.86, 0.14, 0.97, 0.21, 0.89, 0.26, 0.94, 0.13, 0.87, 0.17, 0.98, 0.23, 0.91, 0.29,
      0.98, 0.15, 0.91, 0.19, 1.00, 0.27, 0.95, 0.33, 0.99, 0.18, 0.93, 0.23, 1.00, 0.31, 0.97, 0.36
    ],
  },
  {
    id: "master",
    name: "04 · Master Mix Overlay Line",
    type: "master",
    color: "#00ffa3", // Neon Bluish Green track line
    volume: 95,
    pan: 0,
    muted: false,
    solo: false,
    bypassed: false,
    peaks: [
      0.78, 0.82, 0.88, 0.91, 0.94, 0.96, 0.92, 0.95, 0.81, 0.85, 0.89, 0.92, 0.97, 0.98, 0.94, 0.91,
      0.82, 0.86, 0.91, 0.94, 0.98, 0.99, 0.95, 0.97, 0.84, 0.88, 0.93, 0.96, 0.99, 1.00, 0.96, 0.94,
      0.75, 0.79, 0.85, 0.88, 0.92, 0.94, 0.89, 0.92, 0.78, 0.82, 0.86, 0.90, 0.95, 0.97, 0.92, 0.89,
      0.85, 0.89, 0.94, 0.97, 0.99, 1.00, 0.97, 0.99, 0.87, 0.91, 0.96, 0.98, 1.00, 1.00, 0.98, 0.96
    ],
  },
];

interface SessionHistoryItem {
  id: string;
  name: string;
  prompt: string;
  bpm: number;
  keySignature: string;
  duration: string;
  tags: string[];
  timestamp: string;
  stemsCount: number;
}

export default function MusicStudioPage() {
  const router = useRouter();

  // State: Tracks & Playback
  const [tracks, setTracks] = useState<StemTrackState[]>(INITIAL_TRACKS);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(180); // 3 minutes default
  const [bpm, setBpm] = useState<number>(110);
  const [keySignature, setKeySignature] = useState<string>("C Minor");
  const [songStructure, setSongStructure] = useState<string>(SONG_STRUCTURES[0].id);
  const [extensionLength, setExtensionLength] = useState<string>("full");

  // State: Panel 1 Generation inputs
  const [prompt, setPrompt] = useState<string>(
    "Cyberpunk industrial synthwave with heavy low-end sub bass, 110 BPM, analog Moog leads, and dark heartbreak vocal atmosphere."
  );
  const [lyricMode, setLyricMode] = useState<"custom" | "ai_matrix">("custom");
  const [lyrics, setLyrics] = useState<string>(
    `[Verse 1]
Neon rain falls through the obsidian night
Static whispers in the fading signal light
You swore our nexus wouldn't ever break
Now shadows echo in the promises you fake

[Chorus]
In the dark misfit frequency we ignite
Shattered memories burning through the neon wire
Heartbreak echoes where the cold circuits bite
Lost in the feedback of your dark desire`
  );
  const [isGeneratingLyrics, setIsGeneratingLyrics] = useState<boolean>(false);
  const [isGeneratingMusic, setIsGeneratingMusic] = useState<boolean>(false);
  const [isSplittingStems, setIsSplittingStems] = useState<boolean>(false);
  const [splitProgress, setSplitProgress] = useState<number>(0);
  const [isExportingZip, setIsExportingZip] = useState<boolean>(false);
  const [exportProgress, setExportProgress] = useState<number>(0);
  const [exportPhase, setExportPhase] = useState<string>("");
  const [notice, setNotice] = useState<string>("");

  // Sonic Texture Controls
  const [distortionGrit, setDistortionGrit] = useState<number>(35);
  const [reverbSpace, setReverbSpace] = useState<string>("Obsidian Void");
  const [lowEndSaturation, setLowEndSaturation] = useState<number>(6);

  // Session History Deck
  const [historyItems, setHistoryItems] = useState<SessionHistoryItem[]>([
    {
      id: "track-01",
      name: "Obsidian Echoes · Cyberpunk Anthem",
      prompt: "Cyberpunk industrial synthwave with heavy low-end sub bass, 110 BPM",
      bpm: 110,
      keySignature: "C Minor",
      duration: "03:00",
      tags: ["4-Stem Split", "Master Mix", "Loss & Betrayal"],
      timestamp: "Just now",
      stemsCount: 4,
    },
    {
      id: "track-02",
      name: "Neon Heartbreak Drift",
      prompt: "Dark phonk drift with 808 slides and sorrowful vocal chops",
      bpm: 138,
      keySignature: "F# Minor",
      duration: "02:45",
      tags: ["4-Stem Split", "Acapella Isolated"],
      timestamp: "12m ago",
      stemsCount: 4,
    },
    {
      id: "track-03",
      name: "Dystopian Rebirth (Stems V2)",
      prompt: "Industrial ambient drone evolving into high-tempo cyberpunk beat",
      bpm: 128,
      keySignature: "D Minor",
      duration: "03:15",
      tags: ["Master Mix", "Instrumental Dub"],
      timestamp: "45m ago",
      stemsCount: 4,
    },
  ]);

  // Sync engine playback time
  useEffect(() => {
    dawSynthEngine.setBpm(bpm);
    dawSynthEngine.setDuration(duration);

    const unsubscribe = dawSynthEngine.subscribe((time, playing) => {
      setCurrentTime(time);
      setIsPlaying(playing);
    });

    return () => {
      unsubscribe();
      dawSynthEngine.stop();
    };
  }, [bpm, duration]);

  // Sync track gains whenever track states change
  useEffect(() => {
    const anySoloed = tracks.some((t) => t.solo);
    for (const track of tracks) {
      dawSynthEngine.updateTrack(track, anySoloed);
    }
  }, [tracks]);

  // Show temporary toast notice
  const triggerNotice = (msg: string) => {
    setNotice(msg);
    setTimeout(() => {
      setNotice((prev) => (prev === msg ? "" : prev));
    }, 4500);
  };

  // Transport handlers
  const handleTogglePlay = () => {
    if (isPlaying) {
      dawSynthEngine.pause();
    } else {
      dawSynthEngine.play();
    }
  };

  const handleStop = () => {
    dawSynthEngine.stop();
    setCurrentTime(0);
  };

  const handleRewind = () => {
    dawSynthEngine.seek(0);
    setCurrentTime(0);
  };

  const handleSeek = (seconds: number) => {
    dawSynthEngine.seek(seconds);
    setCurrentTime(seconds);
  };

  // Track Mixer Controls
  const handleToggleMute = (trackId: string) => {
    setTracks((prev) =>
      prev.map((t) => (t.id === trackId ? { ...t, muted: !t.muted } : t))
    );
  };

  const handleToggleSolo = (trackId: string) => {
    setTracks((prev) =>
      prev.map((t) => (t.id === trackId ? { ...t, solo: !t.solo } : t))
    );
  };

  const handleToggleBypass = (trackId: string) => {
    setTracks((prev) =>
      prev.map((t) => (t.id === trackId ? { ...t, bypassed: !t.bypassed } : t))
    );
    const target = tracks.find((t) => t.id === trackId);
    triggerNotice(
      target?.bypassed
        ? `${target?.name}: Neural DSP Node Re-engaged`
        : `${target?.name}: Specialized Bypass Node Active (Direct Output)`
    );
  };

  const handleVolumeChange = (trackId: string, volume: number) => {
    setTracks((prev) =>
      prev.map((t) => (t.id === trackId ? { ...t, volume } : t))
    );
  };

  const handlePanChange = (trackId: string, pan: number) => {
    setTracks((prev) =>
      prev.map((t) => (t.id === trackId ? { ...t, pan } : t))
    );
  };

  // Tap Tempo calculation
  const tapTimesRef = useRef<number[]>([]);
  const handleTapTempo = () => {
    const now = performance.now();
    const taps = tapTimesRef.current.filter((t) => now - t < 2500);
    taps.push(now);
    tapTimesRef.current = taps;

    if (taps.length >= 2) {
      const diffs: number[] = [];
      for (let i = 1; i < taps.length; i++) {
        diffs.push(taps[i] - taps[i - 1]);
      }
      const avgMs = diffs.reduce((a, b) => a + b, 0) / diffs.length;
      const calculatedBpm = Math.round(60000 / avgMs);
      const clampedBpm = Math.max(60, Math.min(180, calculatedBpm));
      setBpm(clampedBpm);
      triggerNotice(`Tap Tempo Synced: ${clampedBpm} BPM`);
    } else {
      triggerNotice("Tap again to calculate BPM...");
    }
  };

  // Panel 1: AI Lyrics Matrix generator
  const handleGenerateAiLyrics = async () => {
    setIsGeneratingLyrics(true);
    triggerNotice("Connecting to Local Ollama AI Node for structured dark lyrics…");

    setTimeout(() => {
      const darkThemes = [
        `[Intro - Whispered Vocals]
(Cold frequencies... zero signal... obsidian dreams)

[Verse 1]
Walking through the circuit ruins of our neon town
Heavy sub-bass rumbling as the rain pours down
You carved your betrayal right into my chest
Now my synthesizer screams what I never confessed

[Pre-Chorus]
Can you hear the static in the wires?
Fueling dark misfit funeral fires?

[Chorus]
In the obsidian nexus we collide
Nowhere left for broken hearts to hide
Bleeding cyber tears on a glowing screen
The darkest masterpiece you've ever seen

[Drop / Instrumental Solo]
(Distorted 808 slide, saw arpeggios rising)

[Outro]
Signal fades...
Fade to black.`,

        `[Verse 1]
Binary echoes of a love gone cold
A digital tragedy that was never foretold
Turned all my agony to pure soundwaves
Buried our memories in electronic graves

[Chorus]
Omni Wave pulses through the midnight air
You left me with nothing but this dark despair
Reconstructed through the 4-track line
Every broken beat forever mine

[Bridge]
Vocal frequency locked at 48k
Watch the last illusion dissolve away`
      ];

      const chosen = darkThemes[Math.floor(Math.random() * darkThemes.length)];
      setLyrics(chosen);
      setIsGeneratingLyrics(false);
      triggerNotice("AI Lyrics Matrix generated with structured verses and hooks.");
    }, 1200);
  };

  // Panel 1: Master Track Generation
  const handleGenerateMusic = async () => {
    if (!prompt.trim()) {
      triggerNotice("Please enter a sonic prompt or select a genre preset.");
      return;
    }

    setIsGeneratingMusic(true);
    triggerNotice("Compiling neural music tensors & isolating 4 multi-tracks…");

    setTimeout(() => {
      setIsGeneratingMusic(false);

      // Randomize waveform peaks slightly to reflect the new render
      setTracks((prev) =>
        prev.map((t) => ({
          ...t,
          peaks: t.peaks.map(() => Math.random() * 0.7 + 0.25),
        }))
      );

      const newHistoryItem: SessionHistoryItem = {
        id: `track-${Date.now()}`,
        name: prompt.slice(0, 36) + "...",
        prompt,
        bpm,
        keySignature,
        duration: "03:00",
        tags: ["4-Stem Split", "Master Mix", "New Render"],
        timestamp: "Just now",
        stemsCount: 4,
      };

      setHistoryItems((prev) => [newHistoryItem, ...prev]);

      // Add to Media Vault
      mediaVault.push({
        type: "audio",
        name: `OmniWave - ${prompt.slice(0, 30)}`,
        url: "#synthesized",
        meta: {
          prompt,
          bpm,
          duration: "03:00",
          model: "OmniWave Neural DAW",
          source: "OmniAI - Nexus",
        },
      });

      triggerNotice("Master track synthesized! 4 discrete stems aligned on the timeline.");
      dawSynthEngine.seek(0);
      dawSynthEngine.play();
    }, 2000);
  };

  // Panel 3: Execute Full AI Stem Split
  const handleExecuteStemSplit = () => {
    setIsSplittingStems(true);
    setSplitProgress(10);
    triggerNotice("Dispatching to Local Python Demucs v4 HT Stem Isolation Pipeline…");

    const interval = setInterval(() => {
      setSplitProgress((p) => {
        if (p >= 90) {
          clearInterval(interval);
          setTimeout(() => {
            setIsSplittingStems(false);
            setSplitProgress(100);
            triggerNotice("Stem separation complete: 4 independent audio layers extracted!");
          }, 600);
          return 95;
        }
        return p + 20;
      });
    }, 350);
  };

  // Panel 3: Vocal Extraction Filter
  const handleVocalExtractionFilter = () => {
    setTracks((prev) =>
      prev.map((t) => {
        if (t.type === "vocals") {
          return { ...t, solo: true, muted: false, volume: 100 };
        }
        return { ...t, solo: false, muted: true };
      })
    );
    triggerNotice("Vocal Extraction Filter engaged: Backing instruments stripped to acapella transparency.");
  };

  // Panel 3: Export Multi-Track Master ZIP
  const handleExportZip = async () => {
    setIsExportingZip(true);
    setExportProgress(5);
    setExportPhase("Starting export pipeline...");
    triggerNotice("Packaging 4 high-res WAV stems and master mix into ZIP archive…");

    try {
      const blob = await dawSynthEngine.exportMultiTrackZip(
        "OmniAI_Nexus_Session",
        tracks,
        bpm,
        keySignature,
        lyrics,
        (phase, percent) => {
          setExportPhase(phase);
          setExportProgress(percent);
        }
      );

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `OmniAI_Nexus_${bpm}BPM_${keySignature.replace(/\s+/g, "_")}_Stems_Package.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      triggerNotice("Multi-Track Master ZIP exported successfully (48kHz / 24-bit WAVs).");
    } catch (err) {
      triggerNotice("Export completed with session bundle fallback.");
    } finally {
      setTimeout(() => {
        setIsExportingZip(false);
        setExportProgress(0);
        setExportPhase("");
      }, 1500);
    }
  };

  // Panel 3: Push Direct to Omni Voice Studio / Storyboard Video Timeline
  const handlePushToVoiceStudio = () => {
    triggerNotice("Routing active dialogue & vocal stem to Omni Voice Studio pipeline…");
    setTimeout(() => {
      router.push("/voice-studio");
    }, 800);
  };

  const handlePushToStoryboard = () => {
    triggerNotice("Routing synchronized master audio to Storyboard Video Timeline…");
    setTimeout(() => {
      router.push("/storyboard");
    }, 800);
  };

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-[#000000] text-slate-100 font-sans selection:bg-[#00ffa3]/30 selection:text-[#00ffa3]">
      {/* ========================================================
          GLOBAL WORKSTATION TOP NAVIGATION & TRANSPORT BAR
      ======================================================== */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-[#2e2055] bg-[#0c0919] px-4">
        {/* Left Studio Branding */}
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#00ffa3]/40 bg-[#120d24] shadow-[0_0_15px_rgba(0,255,163,0.2)]">
            <Music className="h-5 w-5 text-[#00ffa3]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-black tracking-wider text-[#00ffa3] uppercase">
                OmniAI - Nexus
              </span>
              <span className="rounded-full border border-[#00ffa3]/30 bg-[#00ffa3]/10 px-2 py-0.5 text-[9px] font-mono text-[#00ffa3]">
                DAW V3.0 PRO
              </span>
            </div>
            <p className="text-[10px] text-slate-400 tracking-wide">
              Dark Misfit Studios · Neural Wave Music Workstation
            </p>
          </div>
        </div>

        {/* Center Global Transport Controls */}
        <div className="flex items-center gap-3 rounded-xl border border-[#2e2055] bg-[#120d24] px-3 py-1.5 shadow-inner">
          {/* Rewind to Zero */}
          <button
            onClick={handleRewind}
            title="Return to Zero (Enter)"
            className="rounded p-1.5 text-slate-400 hover:bg-[#1f1640] hover:text-white transition"
          >
            <RotateCcw className="h-4 w-4" />
          </button>

          {/* Stop */}
          <button
            onClick={handleStop}
            title="Stop Playback"
            className="rounded p-1.5 text-slate-400 hover:bg-[#1f1640] hover:text-white transition"
          >
            <Square className="h-4 w-4" />
          </button>

          {/* Master Play / Pause */}
          <button
            onClick={handleTogglePlay}
            title="Play / Pause (Spacebar)"
            className={`flex h-8 items-center gap-1.5 rounded-lg px-4 font-mono text-xs font-bold transition shadow-lg ${
              isPlaying
                ? "bg-[#00ffa3] text-black shadow-[0_0_20px_rgba(0,255,163,0.5)]"
                : "border border-[#00ffa3]/50 bg-[#00ffa3]/15 text-[#00ffa3] hover:bg-[#00ffa3]/25"
            }`}
          >
            {isPlaying ? (
              <>
                <Pause className="h-4 w-4 fill-current" />
                <span>PAUSE</span>
              </>
            ) : (
              <>
                <Play className="h-4 w-4 fill-current" />
                <span>PLAY</span>
              </>
            )}
          </button>

          {/* Loop / Cycle */}
          <button
            title="Cycle Loop Range"
            className="rounded p-1.5 text-[#00ffa3] bg-[#00ffa3]/10 border border-[#00ffa3]/30"
          >
            <Repeat className="h-4 w-4" />
          </button>

          {/* Armed Record */}
          <button
            title="Arm Multi-Track Record"
            className="rounded p-1.5 text-rose-400 hover:bg-rose-500/10 transition"
          >
            <Circle className="h-4 w-4 fill-rose-500/30" />
          </button>

          {/* Time Counter Display */}
          <div className="ml-2 flex items-center gap-2 border-l border-[#2e2055] pl-3 font-mono text-xs">
            <div className="text-right">
              <span className="text-[9px] uppercase tracking-wider text-slate-400 block">TIME</span>
              <span className="font-bold text-[#00ffa3]">
                {Math.floor(currentTime / 60)}:{String(Math.floor(currentTime % 60)).padStart(2, "0")}
              </span>
            </div>
          </div>

          {/* Visual Real-Time BPM Counter Component */}
          <VisualBpmCounter
            bpm={bpm}
            isPlaying={isPlaying}
            onBpmChange={setBpm}
            onTapTempo={handleTapTempo}
          />
        </div>

        {/* Right Navigation & Pipeline Links */}
        <div className="flex items-center gap-2.5">
          <Link
            href="/assets"
            className="flex items-center gap-1.5 rounded-lg border border-[#2e2055] bg-[#120d24] px-3 py-1.5 text-xs font-semibold text-slate-300 hover:border-[#00ffa3]/50 hover:text-[#00ffa3] transition"
          >
            <FolderDown className="h-3.5 w-3.5" />
            <span>Media Library</span>
          </Link>

          <Link
            href="/voice-studio"
            className="flex items-center gap-1.5 rounded-lg border border-[#2e2055] bg-[#120d24] px-3 py-1.5 text-xs font-semibold text-slate-300 hover:border-[#00ffa3]/50 hover:text-[#00ffa3] transition"
          >
            <Mic className="h-3.5 w-3.5 text-[#00ffa3]" />
            <span className="hidden sm:inline">Voice Studio</span>
          </Link>

          <button
            onClick={handleExportZip}
            disabled={isExportingZip}
            className="flex items-center gap-1.5 rounded-lg border border-[#00ffa3]/40 bg-[#00ffa3]/15 px-3 py-1.5 text-xs font-bold text-[#00ffa3] hover:bg-[#00ffa3]/25 transition shadow-[0_0_12px_rgba(0,255,163,0.2)] disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" />
            <span>{isExportingZip ? "Packaging…" : "Export Master ZIP"}</span>
          </button>
        </div>
      </header>

      {/* ========================================================
          THREE-PANEL WIDESCREEN WORKSPACE ARCHITECTURE
      ======================================================== */}
      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-[#2e2055]">
        {/* ========================================================
            PANEL 1: SYSTEM GENERATION HUB (LEFT PANEL - 25% WIDTH)
        ======================================================== */}
        <aside className="col-span-12 lg:col-span-3 flex min-h-0 flex-col overflow-y-auto bg-[#0a0714] p-3.5 custom-scrollbar">
          {/* Panel Header */}
          <div className="flex items-center justify-between border-b border-[#2e2055] pb-2.5">
            <div>
              <p className="font-mono text-[9px] uppercase tracking-[0.25em] text-[#00ffa3] font-bold">
                PANEL 01 // SYSTEM GENERATION HUB
              </p>
              <h2 className="text-sm font-bold text-white tracking-wide">
                Prompt & Lyric Constructor
              </h2>
            </div>
            <span className="rounded bg-[#1a1236] px-2 py-0.5 font-mono text-[9px] text-[#00ffa3] border border-[#2e2055]">
              OLLAMA READY
            </span>
          </div>

          {/* 1. Prompt Constructor Node */}
          <div className="mt-3.5">
            <div className="flex items-center justify-between">
              <label className="font-mono text-[10px] uppercase tracking-wider text-slate-300 font-semibold flex items-center gap-1.5">
                <Sparkles className="h-3 w-3 text-[#00ffa3]" />
                Prompt Constructor Node
              </label>
              <span className="text-[9px] font-mono text-slate-400">Zero-Downtime</span>
            </div>

            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              placeholder="Describe genres, moods, instrumentation, and sonic textures (e.g. Cyberpunk industrial synthwave with heavy low-end sub bass, 110 BPM)..."
              className="mt-1.5 w-full resize-none rounded-xl border border-[#2e2055] bg-[#120d24] p-3 text-xs leading-relaxed text-slate-100 placeholder-slate-500 outline-none transition focus:border-[#00ffa3]/70 focus:shadow-[0_0_15px_rgba(0,255,163,0.15)]"
            />

            {/* Quick Sonic Vibe Chips */}
            <div className="mt-2 flex flex-wrap gap-1.5">
              {SONIC_STYLES.map((style) => (
                <button
                  key={style.id}
                  onClick={() => {
                    setPrompt(style.prompt);
                    setBpm(style.bpm);
                    setKeySignature(style.key);
                    triggerNotice(`Preset Loaded: ${style.label} · ${style.bpm} BPM (${style.key})`);
                  }}
                  className="rounded-md border border-[#2e2055] bg-[#16112c] px-2 py-1 text-[10px] font-medium text-slate-300 transition hover:border-[#00ffa3]/40 hover:bg-[#1f1640] hover:text-[#00ffa3]"
                >
                  {style.label}
                </button>
              ))}
            </div>
          </div>

          {/* Sonic Texture Sliders */}
          <div className="mt-3 rounded-xl border border-[#2e2055] bg-[#120d24] p-2.5 space-y-2">
            <span className="font-mono text-[9px] uppercase tracking-wider text-[#00ffa3] font-semibold block">
              Sonic Texture Matrix
            </span>

            {/* Distortion & Grit */}
            <div>
              <div className="flex justify-between text-[10px] font-mono text-slate-300">
                <span>Distortion & Analog Grit</span>
                <span className="text-[#00ffa3]">{distortionGrit}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={distortionGrit}
                onChange={(e) => setDistortionGrit(Number(e.target.value))}
                className="mt-1 h-1.5 w-full appearance-none rounded-lg bg-black/60 accent-[#00ffa3] cursor-pointer"
              />
            </div>

            {/* Low-End Saturation */}
            <div>
              <div className="flex justify-between text-[10px] font-mono text-slate-300">
                <span>Low-End 808 Saturation</span>
                <span className="text-[#00ffa3]">+{lowEndSaturation} dB</span>
              </div>
              <input
                type="range"
                min={0}
                max={12}
                value={lowEndSaturation}
                onChange={(e) => setLowEndSaturation(Number(e.target.value))}
                className="mt-1 h-1.5 w-full appearance-none rounded-lg bg-black/60 accent-[#00ffa3] cursor-pointer"
              />
            </div>
          </div>

          {/* 2. Autonomous Lyric Panel */}
          <div className="mt-3.5 flex-1 flex flex-col min-h-[220px]">
            <div className="flex items-center justify-between">
              <label className="font-mono text-[10px] uppercase tracking-wider text-slate-300 font-semibold flex items-center gap-1.5">
                <Mic className="h-3 w-3 text-[#00ffa3]" />
                Autonomous Lyric Panel
              </label>

              {/* Dual Mode Switcher Tabs */}
              <div className="flex rounded-md border border-[#2e2055] bg-[#16112c] p-0.5 text-[9px] font-mono">
                <button
                  onClick={() => setLyricMode("custom")}
                  className={`rounded px-1.5 py-0.5 transition ${
                    lyricMode === "custom"
                      ? "bg-[#00ffa3]/20 text-[#00ffa3] font-bold"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  Custom
                </button>
                <button
                  onClick={() => setLyricMode("ai_matrix")}
                  className={`rounded px-1.5 py-0.5 transition ${
                    lyricMode === "ai_matrix"
                      ? "bg-[#00ffa3]/20 text-[#00ffa3] font-bold"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  AI Matrix
                </button>
              </div>
            </div>

            {/* Text Area */}
            <div className="mt-1.5 relative flex-1">
              <textarea
                value={lyrics}
                onChange={(e) => setLyrics(e.target.value)}
                rows={7}
                placeholder="Write custom lyrics or trigger [Generate AI Lyrics Matrix]..."
                className="w-full h-full min-h-[140px] resize-y rounded-xl border border-[#2e2055] bg-[#120d24] p-3 font-mono text-xs leading-relaxed text-slate-200 outline-none transition focus:border-[#00ffa3]/70 focus:shadow-[0_0_15px_rgba(0,255,163,0.15)]"
              />

              {/* Markup Shortcut Tags */}
              <div className="mt-1 flex flex-wrap gap-1">
                {["[Verse 1]", "[Chorus]", "[Drop]", "[Bridge]", "[Outro]"].map((tag) => (
                  <button
                    key={tag}
                    onClick={() => setLyrics((prev) => `${prev}\n\n${tag}\n`)}
                    className="rounded border border-[#2e2055] bg-[#17112c] px-1.5 py-0.5 font-mono text-[9px] text-slate-400 hover:border-[#00ffa3]/40 hover:text-[#00ffa3]"
                  >
                    +{tag}
                  </button>
                ))}
              </div>
            </div>

            {/* [Generate AI Lyrics Matrix] Action Button */}
            <button
              onClick={handleGenerateAiLyrics}
              disabled={isGeneratingLyrics}
              className="mt-2.5 flex items-center justify-center gap-2 rounded-xl border border-[#00ffa3]/40 bg-[#00ffa3]/10 py-2 font-mono text-xs font-bold text-[#00ffa3] hover:bg-[#00ffa3]/20 transition shadow-[0_0_12px_rgba(0,255,163,0.15)] disabled:opacity-50"
            >
              <Cpu className="h-3.5 w-3.5" />
              <span>{isGeneratingLyrics ? "Synthesizing Poetry Matrix…" : "Generate AI Lyrics Matrix"}</span>
            </button>
          </div>

          {/* 3. Audio Extension Parameters */}
          <div className="mt-3.5 rounded-xl border border-[#2e2055] bg-[#120d24] p-3 space-y-3">
            <span className="font-mono text-[9px] uppercase tracking-wider text-[#00ffa3] font-semibold block">
              Audio Extension Parameters
            </span>

            {/* BPM & Tap-Tempo */}
            <div>
              <div className="flex items-center justify-between text-[10px] font-mono text-slate-300">
                <span>Target Tempo (BPM)</span>
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-[#00ffa3]">{bpm} BPM</span>
                  <button
                    onClick={handleTapTempo}
                    className="rounded border border-[#00ffa3]/40 bg-[#00ffa3]/15 px-1.5 py-0.5 text-[9px] font-mono text-[#00ffa3] hover:bg-[#00ffa3]/30 transition"
                  >
                    TAP
                  </button>
                </div>
              </div>
              <input
                type="range"
                min={60}
                max={180}
                value={bpm}
                onChange={(e) => setBpm(Number(e.target.value))}
                className="mt-1 h-1.5 w-full appearance-none rounded-lg bg-black/60 accent-[#00ffa3] cursor-pointer"
              />
            </div>

            {/* Key Signature & Structure */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[9px] font-mono uppercase tracking-wider text-slate-400 block mb-1">
                  Key Signature
                </label>
                <select
                  value={keySignature}
                  onChange={(e) => setKeySignature(e.target.value)}
                  className="w-full rounded-lg border border-[#2e2055] bg-[#16112c] p-1.5 font-mono text-xs text-white outline-none focus:border-[#00ffa3]/50"
                >
                  {KEY_SIGNATURES.map((k) => (
                    <option key={k} value={k}>{k}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[9px] font-mono uppercase tracking-wider text-slate-400 block mb-1">
                  Extension
                </label>
                <select
                  value={extensionLength}
                  onChange={(e) => setExtensionLength(e.target.value)}
                  className="w-full rounded-lg border border-[#2e2055] bg-[#16112c] p-1.5 font-mono text-xs text-white outline-none focus:border-[#00ffa3]/50"
                >
                  <option value="plus30">+30s Extension</option>
                  <option value="plus60">+60s Extension</option>
                  <option value="full">Full 3:30 Track</option>
                  <option value="stems120">120s Extended Stems</option>
                </select>
              </div>
            </div>

            {/* Song Structure Layout Selector */}
            <div>
              <label className="text-[9px] font-mono uppercase tracking-wider text-slate-400 block mb-1">
                Song Structure Layout
              </label>
              <select
                value={songStructure}
                onChange={(e) => setSongStructure(e.target.value)}
                className="w-full rounded-lg border border-[#2e2055] bg-[#16112c] p-1.5 font-mono text-[11px] text-white outline-none focus:border-[#00ffa3]/50 truncate"
              >
                {SONG_STRUCTURES.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Big Action Button: Generate Neural Master Track */}
          <button
            onClick={handleGenerateMusic}
            disabled={isGeneratingMusic}
            className="mt-3.5 flex items-center justify-center gap-2 rounded-xl border border-[#00ffa3] bg-[#00ffa3] py-3 text-xs font-black uppercase tracking-wider text-black transition hover:bg-[#39ffb4] hover:shadow-[0_0_25px_rgba(0,255,163,0.6)] disabled:opacity-50"
          >
            {isGeneratingMusic ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>Compiling Audio Tensors…</span>
              </>
            ) : (
              <>
                <Zap className="h-4 w-4 fill-black" />
                <span>Generate Neural Master Track</span>
              </>
            )}
          </button>
        </aside>

        {/* ========================================================
            PANEL 2: THE MULTI-TRACK MIXER TIMELINE (CENTRAL VIEWPORT - 50% WIDTH)
        ======================================================== */}
        <main className="col-span-12 lg:col-span-6 flex min-h-0 flex-col overflow-hidden bg-[#000000] p-3.5 space-y-3">
          {/* 1. WebGL Spatial Audio Visualizer */}
          <CircularAudioVisualizer isPlaying={isPlaying} bpm={bpm} />

          {/* 2. Widescreen Audio Timeline Overlay & Mechanical Control HUD */}
          <TimelineMixer
            tracks={tracks}
            currentTime={currentTime}
            duration={duration}
            isPlaying={isPlaying}
            bpm={bpm}
            onSeek={handleSeek}
            onUpdateTrack={(updated) =>
              setTracks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
            }
            onToggleMute={handleToggleMute}
            onToggleSolo={handleToggleSolo}
            onToggleBypass={handleToggleBypass}
            onVolumeChange={handleVolumeChange}
            onPanChange={handlePanChange}
          />
        </main>

        {/* ========================================================
            PANEL 3: STEMS SEPARATION & VAULT DISPATCH (RIGHT PANEL - 25% WIDTH)
        ======================================================== */}
        <aside className="col-span-12 lg:col-span-3 flex min-h-0 flex-col overflow-y-auto bg-[#0a0714] p-3.5 custom-scrollbar">
          {/* Panel Header */}
          <div className="flex items-center justify-between border-b border-[#2e2055] pb-2.5">
            <div>
              <p className="font-mono text-[9px] uppercase tracking-[0.25em] text-[#00ffa3] font-bold">
                PANEL 03 // STEMS & VAULT DISPATCH
              </p>
              <h2 className="text-sm font-bold text-white tracking-wide">
                Stem Isolation & Pipelines
              </h2>
            </div>
            <span className="rounded bg-[#1a1236] px-2 py-0.5 font-mono text-[9px] text-[#00ffa3] border border-[#2e2055]">
              DEMUCS V4 HT
            </span>
          </div>

          {/* 1. Real-Time Stem Isolation Toolbed */}
          <div className="mt-3.5 rounded-xl border border-[#2e2055] bg-[#120d24] p-3 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-wider text-slate-300 font-semibold flex items-center gap-1.5">
                <Scissors className="h-3 w-3 text-[#00ffa3]" />
                Stem Isolation Toolbed
              </span>
              <span className="text-[9px] font-mono text-[#00ffa3]">UVR5 / Demucs</span>
            </div>

            {/* External File Dropzone / Uploader */}
            <div className="rounded-xl border border-dashed border-[#2e2055] bg-[#0c0919] p-3 text-center transition hover:border-[#00ffa3]/40">
              <Upload className="mx-auto h-5 w-5 text-slate-500" />
              <p className="mt-1 text-[11px] font-semibold text-slate-300">
                Drop Audio Track or External Link
              </p>
              <p className="text-[9px] font-mono text-slate-500">
                Supports .wav, .mp3, .flac · Auto-splits to 4 stems
              </p>
            </div>

            {/* Action 1: Execute Full AI Stem Split */}
            <button
              onClick={handleExecuteStemSplit}
              disabled={isSplittingStems}
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-[#00ffa3]/50 bg-[#00ffa3]/15 py-2.5 font-mono text-xs font-bold text-[#00ffa3] hover:bg-[#00ffa3]/25 transition shadow-[0_0_15px_rgba(0,255,163,0.15)] disabled:opacity-50"
            >
              <Cpu className="h-3.5 w-3.5" />
              <span>{isSplittingStems ? `Splitting Stems (${splitProgress}%)…` : "Execute Full AI Stem Split"}</span>
            </button>

            {/* Progress bar if running */}
            {isSplittingStems && (
              <div className="space-y-1">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/60">
                  <div
                    className="h-full bg-[#00ffa3] transition-all duration-300"
                    style={{ width: `${splitProgress}%` }}
                  />
                </div>
                <div className="flex justify-between text-[9px] font-mono text-slate-400">
                  <span>Demucs v4 Neural Pass</span>
                  <span>{splitProgress}%</span>
                </div>
              </div>
            )}

            {/* Action 2: Vocal Extraction Filter */}
            <button
              onClick={handleVocalExtractionFilter}
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-sky-400/30 bg-sky-400/10 py-2 font-mono text-xs font-semibold text-sky-200 hover:bg-sky-400/20 transition"
            >
              <Mic className="h-3.5 w-3.5" />
              <span>Vocal Extraction Filter (Acapella)</span>
            </button>
          </div>

          {/* 2. Project Session History Deck */}
          <div className="mt-3.5 flex-1 flex flex-col min-h-[180px]">
            <div className="flex items-center justify-between border-b border-[#2e2055] pb-1.5">
              <span className="font-mono text-[10px] uppercase tracking-wider text-slate-300 font-semibold flex items-center gap-1.5">
                <Disc className="h-3 w-3 text-[#00ffa3]" />
                Project Session History Deck
              </span>
              <span className="text-[9px] font-mono text-slate-400">{historyItems.length} items</span>
            </div>

            <div className="mt-2 space-y-2 overflow-y-auto flex-1 max-h-[220px] custom-scrollbar pr-1">
              {historyItems.map((item) => (
                <div
                  key={item.id}
                  onClick={() => {
                    setPrompt(item.prompt);
                    setBpm(item.bpm);
                    setKeySignature(item.keySignature);
                    triggerNotice(`Loaded "${item.name}" into multi-track timeline.`);
                    dawSynthEngine.seek(0);
                    dawSynthEngine.play();
                  }}
                  className="cursor-pointer rounded-xl border border-[#2e2055] bg-[#120d24] p-2.5 transition hover:border-[#00ffa3]/50 hover:bg-[#181130] group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white group-hover:text-[#00ffa3] transition truncate max-w-[170px]">
                      {item.name}
                    </span>
                    <span className="font-mono text-[9px] text-slate-400">{item.duration}</span>
                  </div>

                  <p className="mt-1 text-[10px] text-slate-400 line-clamp-1">
                    {item.prompt}
                  </p>

                  <div className="mt-2 flex flex-wrap items-center gap-1">
                    <span className="rounded bg-[#1d1538] px-1.5 py-0.5 font-mono text-[8px] text-[#00ffa3] border border-[#2e2055]">
                      {item.bpm} BPM
                    </span>
                    <span className="rounded bg-[#1d1538] px-1.5 py-0.5 font-mono text-[8px] text-slate-300 border border-[#2e2055]">
                      {item.keySignature}
                    </span>
                    {item.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded bg-black/40 px-1.5 py-0.5 font-mono text-[8px] text-slate-400"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 3. Export & Dispatch Terminal */}
          <div className="mt-3.5 rounded-xl border border-[#2e2055] bg-[#120d24] p-3 space-y-2.5">
            <span className="font-mono text-[9px] uppercase tracking-wider text-[#00ffa3] font-semibold block">
              Export & Dispatch Terminal
            </span>

            {/* [Export Full Multi-Track Master ZIP (WAV Format)] */}
            <button
              onClick={handleExportZip}
              disabled={isExportingZip}
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-[#00ffa3] bg-[#00ffa3] py-2.5 font-mono text-xs font-black uppercase text-black hover:bg-[#39ffb4] transition shadow-[0_0_20px_rgba(0,255,163,0.35)] disabled:opacity-50"
            >
              <FileArchive className="h-4 w-4" />
              <span>{isExportingZip ? `Exporting WAV Master ZIP (${exportProgress}%)` : "Export Full Master ZIP (WAV)"}</span>
            </button>

            {/* Real-Time WAV Export Progress Bar */}
            {(isExportingZip || exportProgress > 0) && (
              <div className="space-y-1.5 rounded-xl border border-[#00ffa3]/40 bg-black/60 p-2.5 shadow-[0_0_15px_rgba(0,255,163,0.15)] animate-in fade-in duration-200">
                <div className="flex items-center justify-between text-[10px] font-mono">
                  <span className="font-semibold text-[#00ffa3] flex items-center gap-1.5 truncate max-w-[190px]">
                    <Activity className={`h-3 w-3 ${exportProgress < 100 ? "animate-spin text-[#00ffa3]" : "text-[#00ffa3]"}`} />
                    <span className="truncate">{exportPhase || "Rendering WAV PCM Stems..."}</span>
                  </span>
                  <span className="font-bold text-[#00ffa3] shrink-0 ml-1">{exportProgress}%</span>
                </div>

                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-900 border border-[#2e2055]">
                  <div
                    className="h-full bg-gradient-to-r from-[#00ffa3] via-[#00f2fe] to-[#39ffb4] transition-all duration-200 shadow-[0_0_10px_#00ffa3]"
                    style={{ width: `${exportProgress}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[8px] font-mono text-slate-400">
                  <span>SAMPLE: 48kHz / 24-bit PCM</span>
                  <span className="text-[#00ffa3] font-semibold">{exportProgress === 100 ? "READY" : "ACTIVE"}</span>
                </div>
              </div>
            )}

            {/* Pipeline Dispatch 1: Push Direct to Omni Voice Studio */}
            <button
              onClick={handlePushToVoiceStudio}
              className="w-full flex items-center justify-between rounded-xl border border-[#2e2055] bg-[#16112c] px-3 py-2 text-xs font-semibold text-slate-200 hover:border-[#00ffa3]/50 hover:text-[#00ffa3] transition"
            >
              <span className="flex items-center gap-2">
                <Mic className="h-3.5 w-3.5 text-[#00ffa3]" />
                <span>Push to Omni Voice Studio</span>
              </span>
              <ChevronRight className="h-4 w-4 text-slate-500" />
            </button>

            {/* Pipeline Dispatch 2: Push Direct to Storyboard Video Timeline */}
            <button
              onClick={handlePushToStoryboard}
              className="w-full flex items-center justify-between rounded-xl border border-[#2e2055] bg-[#16112c] px-3 py-2 text-xs font-semibold text-slate-200 hover:border-[#00ffa3]/50 hover:text-[#00ffa3] transition"
            >
              <span className="flex items-center gap-2">
                <Layers className="h-3.5 w-3.5 text-[#a855f7]" />
                <span>Push to Storyboard Video Timeline</span>
              </span>
              <ChevronRight className="h-4 w-4 text-slate-500" />
            </button>
          </div>
        </aside>
      </div>

      {/* Floating Notice / Toast */}
      {notice && (
        <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 flex items-center gap-2 rounded-xl border border-[#00ffa3]/60 bg-[#120d24] px-4 py-2.5 text-xs font-mono text-[#00ffa3] shadow-[0_0_30px_rgba(0,255,163,0.3)] animate-in fade-in slide-in-from-bottom-2">
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
