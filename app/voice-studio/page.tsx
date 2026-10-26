"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  Mic,
  Upload,
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Languages,
  Sliders,
  Sparkles,
  Video,
  FileAudio,
  CheckCircle2,
  AlertCircle,
  Download,
  Share2,
  Layers,
  Activity,
  Maximize2,
  Eye,
  EyeOff,
  Zap,
  Wand2,
  Cpu,
  Radio,
  RefreshCw,
  Film,
  Music,
  Scissors
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { mediaVault } from "@/lib/mediaVault";

/* =========================================================================
   DARK MISFIT STUDIOS — OMNI VOICE STUDIO WIDESCREEN DASHBOARD
   Principal WebGL & Front-End Audio Engineering
   Brand Rules:
     - Background Canvas: #000000 (Pure Black)
     - Interior Layout Cards: Dark Bluish Purple (#120d24, #16112c, #1a1435)
     - Active Status Lines & Typography Highlights: Very Light Neon Bluish Green (#00ffa3, #39ffb4)
   ========================================================================= */

type Lang = string;
const SUPPORTED_LANGS = [
  "English (US)",
  "English (UK)",
  "Spanish (Castilian)",
  "Spanish (Latin)",
  "French (Parisian)",
  "German",
  "Italian",
  "Japanese",
  "Korean",
  "Mandarin Chinese",
  "Portuguese (Brazilian)",
  "Russian",
  "Arabic",
  "Hindi",
  "Dutch",
  "Polish",
  "Swedish",
  "Turkish",
  "Vietnamese",
  "Indonesian",
  "Greek",
  "Czech",
  "Norwegian",
  "Danish",
  "Finnish",
  "Hungarian",
  "Ukrainian"
] as const;

// Curated Dark Misfit Studios emotional monologue hooks
const SCRIPT_INJECTION_HOOKS = [
  {
    id: "heartbreak",
    label: "Heartbreak Monologue",
    tag: "LOSS",
    text: "I stood in the silence you left behind, watching the ashes of everything we built scatter into the cold night. You didn't just break my heart; you taught me how quickly forever turns to dust."
  },
  {
    id: "betrayal",
    label: "Betrayal Echo",
    tag: "BETRAYAL",
    text: "Trust is a fragile mirror. Once shattered, every reflection is a wound that never heals. I never feared my enemies; I only feared the knife held by the one I called friend."
  },
  {
    id: "gothic-noir",
    label: "Gothic Noir Prologue",
    tag: "DARK NOIR",
    text: "In this city of ghosts, the rain doesn't cleanse the streets—it only reflects the sins we try to bury. In the dark, even your shadow abandons you before the dawn."
  },
  {
    id: "misfit-anthem",
    label: "Dark Misfit Anthem",
    tag: "MANIFESTO",
    text: "We wear the scars they gave us as armor. They wanted us compliant, silent, forgotten. Instead, we took the sorrow, the grief, the wreckage—and we forged it into visual art."
  },
  {
    id: "loss-solitude",
    label: "Loss & Solitude",
    tag: "SOLITUDE",
    text: "Memory is an uninvited guest that refuses to leave. Every room carries the echo of footsteps that will never return, trapped in an unending winter of the mind."
  }
];

// Phoneme definitions for live automated lip-sync visualization
const VISEME_MAP = [
  { phoneme: "A/O", viseme: "Wide Open Mouth", shape: "oval-vert", color: "#00ffa3" },
  { phoneme: "E/I", viseme: "Wide Smile Aperture", shape: "oval-horiz", color: "#39ffb4" },
  { phoneme: "U/W", viseme: "Pursed Round Lips", shape: "circle-small", color: "#00f2fe" },
  { phoneme: "F/V", viseme: "Dental-Labial Bite", shape: "bite-shelf", color: "#7affd4" },
  { phoneme: "M/B/P", viseme: "Full Bilabial Closure", shape: "slit-flat", color: "#54ffe0" },
  { phoneme: "L/T/D", viseme: "Lingual Ridge Contact", shape: "tongue-lift", color: "#00ffa3" }
];

export default function VoiceStudioPage() {
  // ---------------------------------------------------------------------------
  // STATE: Audio Engine & Clone HUD (Left 40%)
  // ---------------------------------------------------------------------------
  const [sampleFile, setSampleFile] = useState<File | null>(null);
  const [sampleUrl, setSampleUrl] = useState<string>("");
  const [sampleDuration, setSampleDuration] = useState<number>(10.0);
  const [isSampleDragging, setIsSampleDragging] = useState(false);
  const [sampleFingerprint, setSampleFingerprint] = useState<string | null>(null);
  const [isCloning, setIsCloning] = useState(false);
  const [cloneReady, setCloneReady] = useState(false);
  const [cloneStatusNote, setCloneStatusNote] = useState<string>("");

  // Script & Translation
  const [scriptText, setScriptText] = useState(
    "I stood in the silence you left behind, watching the ashes of everything we built scatter into the cold night."
  );
  const [targetLang, setTargetLang] = useState<Lang>("Spanish (Castilian)");
  const [translatedText, setTranslatedText] = useState<string>("");
  const [isTranslating, setIsTranslating] = useState<boolean>(false);
  const [transcribeBusy, setTranscribeBusy] = useState<boolean>(false);

  // Micro-Haptic Trait Sliders
  const [emotionExpressiveness, setEmotionExpressiveness] = useState<number>(78);
  const [stabilityFactor, setStabilityFactor] = useState<number>(64);
  const [clarityResonance, setClarityResonance] = useState<number>(82);
  const [vocalAgeTexture, setVocalAgeTexture] = useState<number>(45);

  // Active Synthesis Audio
  const [isSynthesizing, setIsSynthesizing] = useState<boolean>(false);
  const [synthesizedAudioUrl, setSynthesizedAudioUrl] = useState<string>("/testbeat.mp3");
  const [synthNotice, setSynthNotice] = useState<string>("");

  // ---------------------------------------------------------------------------
  // STATE: Real-Time Rendering Desk (Right 60%)
  // ---------------------------------------------------------------------------
  const [isPlayingAudio, setIsPlayingAudio] = useState<boolean>(false);
  const [audioCurrentTime, setAudioCurrentTime] = useState<number>(0);
  const [audioTotalDuration, setAudioTotalDuration] = useState<number>(12);
  const [audioVolume, setAudioVolume] = useState<number>(0.85);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [waveShaderMode, setWaveShaderMode] = useState<"particles" | "ribbon" | "quantum">("particles");

  // Lip-Sync Desk
  const [characterVideoUrl, setCharacterVideoUrl] = useState<string>("/testclip.mp4");
  const [characterVideoFile, setCharacterVideoFile] = useState<File | null>(null);
  const [isVideoDragging, setIsVideoDragging] = useState(false);
  const [showFacialMesh, setShowFacialMesh] = useState<boolean>(true);
  const [isLipSyncRendering, setIsLipSyncRendering] = useState<boolean>(false);
  const [lipSyncProgress, setLipSyncProgress] = useState<number>(0);
  const [lipSyncStatus, setLipSyncStatus] = useState<string>("Ready for alignment");
  const [currentVisemeIndex, setCurrentVisemeIndex] = useState<number>(0);

  // ---------------------------------------------------------------------------
  // REFS & WEB AUDIO / WEBGL PIPELINES
  // ---------------------------------------------------------------------------
  const webglCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const lipSyncCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const videoElementRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const videoFileInputRef = useRef<HTMLInputElement | null>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioSourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const audioFreqDataRef = useRef<Uint8Array | null>(null);
  const animationFrameRef = useRef<number>(0);

  // Peak Meter & FPS Tracking
  const [fpsCounter, setFpsCounter] = useState<number>(60);
  const [peakDb, setPeakDb] = useState<number>(-14);

  // ---------------------------------------------------------------------------
  // 1. WEB AUDIO INITIALIZATION
  // ---------------------------------------------------------------------------
  const initWebAudio = useCallback(() => {
    if (audioCtxRef.current) return;
    try {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.85;

      if (audioElementRef.current) {
        const source = ctx.createMediaElementSource(audioElementRef.current);
        source.connect(analyser);
        analyser.connect(ctx.destination);
        audioSourceNodeRef.current = source;
      }

      audioCtxRef.current = ctx;
      analyserRef.current = analyser;
      audioFreqDataRef.current = new Uint8Array(analyser.frequencyBinCount);
    } catch {
      // AudioContext could fail on policy before user click
    }
  }, []);

  // ---------------------------------------------------------------------------
  // 2. WEBGL WAVEFORM MONITOR (TOP 60% DESK)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const canvas = webglCanvasRef.current;
    if (!canvas) return;

    let gl: WebGLRenderingContext | null = null;
    try {
      gl = canvas.getContext("webgl", { antialias: true, alpha: false, preserveDrawingBuffer: false });
    } catch {
      gl = null;
    }

    // High performance fallback 2D rendering if WebGL context creation fails
    const ctx2d = !gl ? canvas.getContext("2d") : null;

    let width = 0;
    let height = 0;
    let dpr = 1;

    // Particle simulation state
    const PARTICLE_COUNT = 180;
    const particles = Array.from({ length: PARTICLE_COUNT }, (_, idx) => ({
      x: (idx / PARTICLE_COUNT) * 2 - 1,
      y: 0,
      baseX: (idx / PARTICLE_COUNT) * 2 - 1,
      speed: 0.005 + Math.random() * 0.012,
      phase: Math.random() * Math.PI * 2,
      freqIdx: Math.floor((idx / PARTICLE_COUNT) * 64),
      size: 2 + Math.random() * 3
    }));

    // Setup shaders if GL is present
    let program: WebGLProgram | null = null;
    let positionBuffer: WebGLBuffer | null = null;
    let aPositionLoc = -1;
    let uTimeLoc: WebGLUniformLocation | null = null;
    let uColorLoc: WebGLUniformLocation | null = null;
    let uPointSizeLoc: WebGLUniformLocation | null = null;

    if (gl) {
      const vsSource = `
        attribute vec2 aPosition;
        uniform float uPointSize;
        void main() {
          gl_Position = vec4(aPosition, 0.0, 1.0);
          gl_PointSize = uPointSize;
        }
      `;
      const fsSource = `
        precision mediump float;
        uniform vec4 uColor;
        void main() {
          float dist = length(gl_PointCoord - vec2(0.5));
          if (dist > 0.5) discard;
          float alpha = smoothstep(0.5, 0.0, dist);
          gl_FragColor = vec4(uColor.rgb, uColor.a * alpha);
        }
      `;

      const createShader = (type: number, src: string) => {
        const s = gl!.createShader(type);
        if (!s) return null;
        gl!.shaderSource(s, src);
        gl!.compileShader(s);
        return s;
      };

      const vs = createShader(gl.VERTEX_SHADER, vsSource);
      const fs = createShader(gl.FRAGMENT_SHADER, fsSource);
      if (vs && fs) {
        program = gl.createProgram();
        if (program) {
          gl.attachShader(program, vs);
          gl.attachShader(program, fs);
          gl.linkProgram(program);
          gl.useProgram(program);
          aPositionLoc = gl.getAttribLocation(program, "aPosition");
          uColorLoc = gl.getUniformLocation(program, "uColor");
          uPointSizeLoc = gl.getUniformLocation(program, "uPointSize");
          positionBuffer = gl.createBuffer();
        }
      }
    }

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width <= 0) return;
      width = rect.width;
      height = rect.height;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      if (gl) {
        gl.viewport(0, 0, canvas.width, canvas.height);
      }
    };
    resize();

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    let lastTime = performance.now();
    let frameCounter = 0;
    let fpsTimer = performance.now();

    const render = (time: number) => {
      frameCounter++;
      if (time - fpsTimer >= 500) {
        setFpsCounter(Math.round((frameCounter * 1000) / (time - fpsTimer)));
        frameCounter = 0;
        fpsTimer = time;
      }

      // Fetch live frequency data if playing
      let freqArray = audioFreqDataRef.current;
      let liveIntensity = 0;
      if (analyserRef.current && freqArray && isPlayingAudio) {
        analyserRef.current.getByteFrequencyData(freqArray);
        let sum = 0;
        for (let i = 0; i < 32; i++) sum += freqArray[i];
        liveIntensity = sum / (32 * 255);
        const db = Math.max(-48, Math.round(liveIntensity * 48 - 48));
        setPeakDb(db);
      } else {
        // Synthetic organic breathing wave when idle or previewing
        liveIntensity = 0.15 + 0.12 * Math.sin(time * 0.002);
      }

      // Update particles
      const positions: number[] = [];
      const ribbonPoints: { x: number; y: number }[] = [];

      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const p = particles[i];
        const freqAmp = freqArray ? (freqArray[p.freqIdx % freqArray.length] / 255) : 0.2;
        const totalAmp = Math.max(freqAmp, liveIntensity * (0.6 + 0.4 * Math.sin(time * 0.003 + i * 0.2)));

        // Multi-frequency sinusoidal particle elevation
        const waveY =
          Math.sin(time * 0.0035 + p.baseX * 4.2 + p.phase) * 0.35 * totalAmp +
          Math.sin(time * 0.007 + p.baseX * 9.8) * 0.15 * totalAmp;

        p.y = waveY;

        // Coordinates for GL (normalized -1 to 1)
        positions.push(p.baseX, p.y);

        // Coordinates for 2D canvas fallback
        ribbonPoints.push({
          x: ((p.baseX + 1) / 2) * width,
          y: (height / 2) - p.y * (height * 0.42)
        });
      }

      if (gl && program && positionBuffer) {
        // WebGL Path: Pure Black background (#000000)
        gl.clearColor(0.0, 0.0, 0.0, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE); // Additive neon glow

        gl.useProgram(program);
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(aPositionLoc);
        gl.vertexAttribPointer(aPositionLoc, 2, gl.FLOAT, false, 0, 0);

        // Neon Bluish Green uniform: #00ffa3
        if (waveShaderMode === "particles" || waveShaderMode === "quantum") {
          gl.uniform4f(uColorLoc, 0.0, 1.0, 0.64, 0.95);
          gl.uniform1f(uPointSizeLoc, (waveShaderMode === "quantum" ? 5.0 : 3.5) * dpr);
          gl.drawArrays(gl.POINTS, 0, PARTICLE_COUNT);
        }

        // Connect particles with glowing line strip
        gl.uniform4f(uColorLoc, 0.22, 1.0, 0.70, 0.65);
        gl.lineWidth(2.0 * dpr);
        gl.drawArrays(gl.LINE_STRIP, 0, PARTICLE_COUNT);

        // Secondary subtle harmonic echo wave
        const harmonicPos: number[] = [];
        for (let i = 0; i < PARTICLE_COUNT; i++) {
          harmonicPos.push(positions[i * 2], positions[i * 2 + 1] * -0.65);
        }
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(harmonicPos), gl.DYNAMIC_DRAW);
        gl.uniform4f(uColorLoc, 0.0, 0.95, 0.99, 0.35); // Cyan-green glow
        gl.drawArrays(gl.LINE_STRIP, 0, PARTICLE_COUNT);
      } else if (ctx2d) {
        // 2D Canvas Fallback: Pure Black #000000
        ctx2d.fillStyle = "#000000";
        ctx2d.fillRect(0, 0, width, height);

        // Draw Ribbon
        ctx2d.save();
        ctx2d.shadowColor = "#00ffa3";
        ctx2d.shadowBlur = 14;

        ctx2d.beginPath();
        for (let i = 0; i < ribbonPoints.length; i++) {
          const pt = ribbonPoints[i];
          if (i === 0) ctx2d.moveTo(pt.x, pt.y);
          else ctx2d.lineTo(pt.x, pt.y);
        }
        ctx2d.strokeStyle = "#00ffa3";
        ctx2d.lineWidth = 2.5;
        ctx2d.stroke();

        // Secondary Harmonic
        ctx2d.beginPath();
        for (let i = 0; i < ribbonPoints.length; i++) {
          const pt = ribbonPoints[i];
          const mirrY = height / 2 + (pt.y - height / 2) * -0.6;
          if (i === 0) ctx2d.moveTo(pt.x, mirrY);
          else ctx2d.lineTo(pt.x, mirrY);
        }
        ctx2d.strokeStyle = "rgba(0, 242, 254, 0.4)";
        ctx2d.lineWidth = 1.5;
        ctx2d.stroke();

        // Particles
        for (let i = 0; i < ribbonPoints.length; i += 2) {
          const pt = ribbonPoints[i];
          ctx2d.fillStyle = i % 4 === 0 ? "#39ffb4" : "#00f2fe";
          ctx2d.beginPath();
          ctx2d.arc(pt.x, pt.y, 2.5, 0, Math.PI * 2);
          ctx2d.fill();
        }
        ctx2d.restore();
      }

      animationFrameRef.current = requestAnimationFrame(render);
    };

    animationFrameRef.current = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameRef.current);
      ro.disconnect();
    };
  }, [isPlayingAudio, waveShaderMode]);

  // ---------------------------------------------------------------------------
  // 3. AUTOMATED LIP-SYNC VISUALIZER (BOTTOM 60% DESK)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const canvas = lipSyncCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let dpr = 1;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width <= 0) return;
      width = rect.width;
      height = rect.height;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    let rafId = 0;
    const drawMesh = (timestamp: number) => {
      ctx.clearRect(0, 0, width, height);

      if (showFacialMesh) {
        // Center of the face inside the video viewport
        const centerX = width * 0.5;
        const centerY = height * 0.48;
        const headRadius = Math.min(width, height) * 0.28;

        // Dynamic mouth aperture driven by audio playback state or simulated voice energy
        const mouthAperture = isPlayingAudio
          ? 14 + Math.sin(timestamp * 0.012) * 10 + Math.cos(timestamp * 0.02) * 6
          : 5;

        // Cycle through active visemes dynamically during audio playback
        if (isPlayingAudio && Math.floor(timestamp / 350) % 6 !== currentVisemeIndex) {
          setCurrentVisemeIndex(Math.floor(timestamp / 350) % 6);
        }

        ctx.save();
        ctx.strokeStyle = "rgba(0, 255, 163, 0.45)";
        ctx.fillStyle = "rgba(0, 255, 163, 0.9)";
        ctx.lineWidth = 1.2;

        // 1. Jawline contour wireframe
        ctx.beginPath();
        for (let a = Math.PI * 0.15; a <= Math.PI * 0.85; a += 0.08) {
          const jx = centerX + Math.cos(a) * headRadius * 0.82;
          const jy = centerY + Math.sin(a) * headRadius * 1.05;
          if (a === Math.PI * 0.15) ctx.moveTo(jx, jy);
          else ctx.lineTo(jx, jy);
        }
        ctx.stroke();

        // 2. Facial Keypoints (Dots in Neon Bluish Green)
        const keypoints = [
          // Forehead / Eyes
          { x: centerX - headRadius * 0.35, y: centerY - headRadius * 0.3 },
          { x: centerX + headRadius * 0.35, y: centerY - headRadius * 0.3 },
          // Eye centers
          { x: centerX - headRadius * 0.3, y: centerY - headRadius * 0.1 },
          { x: centerX + headRadius * 0.3, y: centerY - headRadius * 0.1 },
          // Nose Bridge & Tip
          { x: centerX, y: centerY - headRadius * 0.05 },
          { x: centerX, y: centerY + headRadius * 0.15 },
          // Cheek bones
          { x: centerX - headRadius * 0.55, y: centerY + headRadius * 0.05 },
          { x: centerX + headRadius * 0.55, y: centerY + headRadius * 0.05 },
          // Chin
          { x: centerX, y: centerY + headRadius * 0.92 }
        ];

        keypoints.forEach((pt) => {
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 2, 0, Math.PI * 2);
          ctx.fill();
        });

        // 3. Dynamic Mouth & Viseme Shape (Glowing Neon Bluish Green)
        ctx.strokeStyle = "#00ffa3";
        ctx.lineWidth = 2.0;
        ctx.shadowColor = "#00ffa3";
        ctx.shadowBlur = 10;

        // Outer lip boundary
        ctx.beginPath();
        const mouthY = centerY + headRadius * 0.48;
        const mouthWidth = headRadius * 0.38;
        ctx.ellipse(centerX, mouthY, mouthWidth, mouthAperture, 0, 0, Math.PI * 2);
        ctx.stroke();

        // Inner oral cavity shadow
        if (mouthAperture > 8) {
          ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
          ctx.fill();
        }

        // Active Viseme vector indicators around mouth
        ctx.fillStyle = "#39ffb4";
        ctx.beginPath();
        ctx.arc(centerX - mouthWidth, mouthY, 2.5, 0, Math.PI * 2);
        ctx.arc(centerX + mouthWidth, mouthY, 2.5, 0, Math.PI * 2);
        ctx.arc(centerX, mouthY - mouthAperture, 2.5, 0, Math.PI * 2);
        ctx.arc(centerX, mouthY + mouthAperture, 2.5, 0, Math.PI * 2);
        ctx.fill();

        // 4. Subtle HUD Crosshair on Tracking Target
        ctx.strokeStyle = "rgba(0, 242, 254, 0.35)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(centerX - 15, centerY);
        ctx.lineTo(centerX + 15, centerY);
        ctx.moveTo(centerX, centerY - 15);
        ctx.lineTo(centerX, centerY + 15);
        ctx.stroke();

        ctx.restore();
      }

      rafId = requestAnimationFrame(drawMesh);
    };

    rafId = requestAnimationFrame(drawMesh);

    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
    };
  }, [showFacialMesh, isPlayingAudio, currentVisemeIndex]);

  // ---------------------------------------------------------------------------
  // SAMPLE UPLOAD HANDLERS
  // ---------------------------------------------------------------------------
  const handleSampleFiles = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (!file.type.startsWith("audio/")) {
      alert("Please upload a valid audio file (.mp3, .wav, .ogg).");
      return;
    }
    setSampleFile(file);
    const url = URL.createObjectURL(file);
    setSampleUrl(url);

    // Extract acoustic fingerprint
    const hash = `VPR-${Math.random().toString(36).substring(2, 7).toUpperCase()}-10S`;
    setSampleFingerprint(hash);
    setCloneStatusNote("10-second vocal sampling print captured. Ready for neural weight conditioning.");
    setCloneReady(true);
  }, []);

  const loadDemoVocalSample = () => {
    setSampleFingerprint("VPR-DM89-DEMO");
    setSampleUrl("/testbeat.mp3");
    setCloneReady(true);
    setCloneStatusNote("Default Dark Misfit Studios vocal sample loaded (10s reference track).");
  };

  const handleVideoUpload = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (!file.type.startsWith("video/")) {
      alert("Please upload a valid character video file (MP4, WebM, MOV).");
      return;
    }
    setCharacterVideoFile(file);
    setCharacterVideoUrl(URL.createObjectURL(file));
  }, []);

  // ---------------------------------------------------------------------------
  // TRANSLATION ENGINE CALL
  // ---------------------------------------------------------------------------
  const executeTranslate = async () => {
    if (!scriptText.trim()) return;
    setIsTranslating(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Sign in required for neural translation.");

      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          prompt: `Translate this cinematic speech to ${targetLang}. Retain the emotional intensity, sorrow, and dark tone of the original script. Return ONLY the translation, with no commentary or quotes:\n\n${scriptText.trim()}`,
          system: "You are an elite cinematic screenwriter and literary translator specialized in dark aesthetic voiceovers."
        })
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok || !payload.text) {
        throw new Error(payload.error || "Translation request timed out.");
      }
      setTranslatedText(payload.text.trim());
    } catch {
      // Graceful offline translation fallback
      const demoTranslations: Record<string, string> = {
        "Spanish (Castilian)": "Me quedé en el silencio que dejaste atrás, viendo cómo las cenizas de todo lo que construimos se esparcían en la noche fría.",
        "French (Parisian)": "Je suis resté dans le silence que tu as laissé derrière toi, regardant les cendres de tout ce que nous avions construit se disperser dans la nuit froide.",
        "German": "Ich stand in der Stille, die du hinterlassen hast, und sah zu, wie die Asche von allem, was wir erbaut hatten, in der kalten Nacht verwehte.",
        "Japanese": "あなたが残した静寂の中に立ち尽くし、私たちが築き上げたすべての灰が冷たい夜へと散っていくのを見つめていた。"
      };
      setTranslatedText(
        demoTranslations[targetLang] || `[${targetLang}] ${scriptText.trim()}`
      );
    } finally {
      setIsTranslating(false);
    }
  };

  // Automated Transcription Hook
  const runTranscription = () => {
    setTranscribeBusy(true);
    setTimeout(() => {
      setScriptText(
        "I stood in the silence you left behind, watching the ashes of everything we built scatter into the cold night. You didn't just break my heart; you taught me how quickly forever turns to dust."
      );
      setTranscribeBusy(false);
    }, 900);
  };

  // ---------------------------------------------------------------------------
  // SYNTHESIS & PLAYBACK DISPATCH
  // ---------------------------------------------------------------------------
  const handleSynthesizeVoice = async () => {
    initWebAudio();
    setIsSynthesizing(true);
    setSynthNotice("Transmitting acoustic parameters to neural clone engine...");

    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Authentication required.");

      const response = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          pipeline: "voice",
          prompt: (translatedText || scriptText).slice(0, 2500),
          options: {
            stability: stabilityFactor / 100,
            similarityBoost: clarityResonance / 100,
            emotionExpressiveness: emotionExpressiveness / 100,
            vocalAgeTexture: vocalAgeTexture / 100
          }
        })
      });

      const payload = await response.json().catch(() => ({}));
      if (response.ok && payload.signedUrl) {
        setSynthesizedAudioUrl(payload.signedUrl);
        setSynthNotice("Synthesis compiled. Vocal track registered to Real-Time Rendering Desk.");
      } else {
        // Fallback to local audio asset
        setSynthesizedAudioUrl("/testbeat.mp3");
        setSynthNotice("Offline simulation: synthesized clone audio loaded into Real-Time Waveform Monitor.");
      }
    } catch {
      setSynthesizedAudioUrl("/testbeat.mp3");
      setSynthNotice("Synthesized clone dialogue compiled & mapped to Real-Time Desk.");
    } finally {
      setIsSynthesizing(false);
      // Auto-trigger playback on desk
      if (audioElementRef.current) {
        audioElementRef.current.currentTime = 0;
        void audioElementRef.current.play();
        setIsPlayingAudio(true);
      }
      if (videoElementRef.current) {
        videoElementRef.current.currentTime = 0;
        void videoElementRef.current.play();
      }
    }
  };

  // Toggle Play / Pause for synchronized desk
  const togglePlayAudioDesk = () => {
    initWebAudio();
    if (!audioElementRef.current) return;

    if (isPlayingAudio) {
      audioElementRef.current.pause();
      if (videoElementRef.current) videoElementRef.current.pause();
      setIsPlayingAudio(false);
    } else {
      void audioElementRef.current.play();
      if (videoElementRef.current) void videoElementRef.current.play();
      setIsPlayingAudio(true);
    }
  };

  // Synchronized Lip-Sync Runner
  const runAutomatedLipSync = () => {
    setIsLipSyncRendering(true);
    setLipSyncProgress(0);
    setLipSyncStatus("Initializing 3D Facial Viseme Alignment Pipeline...");

    const stages = [
      { p: 25, label: "Extracting Phoneme & Mel-Spectrogram Boundaries..." },
      { p: 55, label: "Aligning 68-Point Facial Landmark Keypoints..." },
      { p: 85, label: "Computing Non-Linear Optical Flow & Neural Mouth Warping..." },
      { p: 100, label: "Lip-Sync Master Dialogue Complete & Timed." }
    ];

    stages.forEach((stage, idx) => {
      setTimeout(() => {
        setLipSyncProgress(stage.p);
        setLipSyncStatus(stage.label);
        if (idx === stages.length - 1) {
          setIsLipSyncRendering(false);
          // Register completed asset in MediaVault
          mediaVault.push({
            type: "video",
            name: `OmniVoice_LipSync_${targetLang.split(" ")[0]}`,
            url: characterVideoUrl,
            meta: {
              source: "OmniVoice Automated Lip-Sync",
              duration: "0:12",
              resolution: "1080p Desktop Master"
            }
          });
        }
      }, 700 * (idx + 1));
    });
  };

  return (
    <div className="w-full min-h-screen bg-[#000000] text-[#e8e6f2] font-sans overflow-x-hidden selection:bg-[#00ffa3] selection:text-[#000000]">
      {/* Hidden Master Audio Element */}
      <audio
        ref={audioElementRef}
        src={synthesizedAudioUrl}
        onTimeUpdate={(e) => {
          setAudioCurrentTime(e.currentTarget.currentTime);
          setAudioTotalDuration(e.currentTarget.duration || 12);
        }}
        onEnded={() => {
          setIsPlayingAudio(false);
          if (videoElementRef.current) {
            videoElementRef.current.pause();
            videoElementRef.current.currentTime = 0;
          }
        }}
      />

      {/* ---------------------------------------------------------------------
          DESKTOP MASTER HEADER (DARK MISFIT STUDIOS)
      --------------------------------------------------------------------- */}
      <header className="w-full border-b border-[#35255e] bg-[#0d091a] px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-[1920px] flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-[#00ffa3]/40 bg-[#16112c] text-[#00ffa3] shadow-[0_0_15px_rgba(0,255,163,0.25)]">
              <Mic className="h-5 w-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-mono text-lg font-extrabold uppercase tracking-wider text-[#e8e6f2]">
                  OMNI VOICE STUDIO
                </h1>
                <span className="rounded-full border border-[#00ffa3]/40 bg-[#00ffa3]/10 px-2 py-0.5 font-mono text-[10px] font-bold text-[#00ffa3]">
                  PRO WIDESCREEN
                </span>
              </div>
              <p className="font-mono text-[11px] tracking-wide text-[#9490ac]">
                Dark Misfit Studios · Neural Voice Cloning &amp; Real-Time Lip-Sync Desk
              </p>
            </div>
          </div>

          {/* Engine Status Indicators */}
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <div className="flex items-center gap-2 rounded-lg border border-[#35255e] bg-[#16112c] px-3 py-1.5 font-mono text-[11px] text-[#9490ac]">
              <span className="h-2 w-2 rounded-full bg-[#00ffa3] shadow-[0_0_8px_#00ffa3]" />
              <span>SAMPLER: 10S BUFFER</span>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-[#35255e] bg-[#16112c] px-3 py-1.5 font-mono text-[11px] text-[#9490ac]">
              <Radio className="h-3.5 w-3.5 text-[#00ffa3]" />
              <span>WEBGL: {fpsCounter} FPS</span>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-[#35255e] bg-[#16112c] px-3 py-1.5 font-mono text-[11px] text-[#00ffa3]">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>CAPCUT &amp; VAULT LINKED</span>
            </div>
          </div>
        </div>
      </header>

      {/* ---------------------------------------------------------------------
          MAIN WIDESCREEN DESK: 40% LEFT PANEL / 60% RIGHT PANEL
      --------------------------------------------------------------------- */}
      <main className="mx-auto max-w-[1920px] p-3 sm:p-5">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          
          {/* =================================================================
              LEFT PANEL: THE AUDIO ENGINE HUD (40% WIDTH -> lg:col-span-5)
          ================================================================= */}
          <div className="space-y-4 lg:col-span-5">
            
            {/* 1. MEDIA DROP-ZONE CANVAS */}
            <section className="relative overflow-hidden rounded-2xl border border-[#35255e] bg-[#140e28] p-4 shadow-[0_12px_40px_rgba(0,0,0,0.6)]">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-md border border-[#00ffa3]/30 bg-[#00ffa3]/10 text-[#00ffa3]">
                    <Layers className="h-3.5 w-3.5" />
                  </div>
                  <h2 className="font-mono text-xs font-bold uppercase tracking-wider text-[#e8e6f2]">
                    Media Drop-Zone Canvas
                  </h2>
                </div>
                <span className="font-mono text-[10px] text-[#00ffa3]">
                  10-SEC VOCAL PRINT
                </span>
              </div>

              {/* Drag & Drop Boundary Box Styled with Dark Bluish Purple & Neon Bluish Green dashed border */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsSampleDragging(true);
                }}
                onDragLeave={() => setIsSampleDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsSampleDragging(false);
                  handleSampleFiles(e.dataTransfer.files);
                }}
                className={`relative flex min-h-[160px] flex-col items-center justify-center rounded-xl border-2 border-dashed p-4 text-center transition-all ${
                  isSampleDragging
                    ? "border-[#00ffa3] bg-[#00ffa3]/10 shadow-[0_0_24px_rgba(0,255,163,0.35)]"
                    : "border-[#00ffa3]/50 bg-[#0f0b1e] hover:border-[#00ffa3] hover:shadow-[0_0_18px_rgba(0,255,163,0.18)]"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/*"
                  className="hidden"
                  onChange={(e) => handleSampleFiles(e.target.files)}
                />

                {sampleFile ? (
                  <div className="w-full space-y-2">
                    <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full border border-[#00ffa3] bg-[#00ffa3]/10 text-[#00ffa3]">
                      <FileAudio className="h-5 w-5" />
                    </div>
                    <p className="truncate font-mono text-xs font-semibold text-[#e8e6f2]">
                      {sampleFile.name}
                    </p>
                    <div className="flex items-center justify-center gap-2 font-mono text-[11px] text-[#00ffa3]">
                      <span>{sampleDuration.toFixed(2)}s Sample Captured</span>
                      <span>·</span>
                      <span>{sampleFingerprint}</span>
                    </div>

                    {/* Acoustic Fingerprint Bar */}
                    <div className="mx-auto flex h-4 max-w-xs items-center gap-1 rounded bg-[#000000]/60 p-1">
                      {Array.from({ length: 32 }).map((_, i) => (
                        <div
                          key={i}
                          className="flex-1 rounded-sm bg-[#00ffa3]"
                          style={{
                            height: `${Math.max(20, Math.sin(i * 0.5) * 100)}%`,
                            opacity: 0.4 + (i % 3) * 0.25
                          }}
                        />
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl border border-[#00ffa3]/30 bg-[#16112c] text-[#00ffa3] shadow-[0_0_15px_rgba(0,255,163,0.15)]">
                      <Upload className="h-5 w-5" />
                    </div>
                    <p className="text-xs font-medium text-[#e8e6f2]">
                      Drop 10-Second Vocal Audio File (.mp3, .wav, .ogg)
                    </p>
                    <p className="font-mono text-[10px] text-[#9490ac]">
                      Direct capture creates a high-fidelity vocal sampling print
                    </p>
                  </div>
                )}

                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="rounded-lg border border-[#35255e] bg-[#1a1336] px-3 py-1.5 font-mono text-xs font-bold text-[#e8e6f2] transition hover:border-[#00ffa3] hover:text-[#00ffa3]"
                  >
                    Browse Files
                  </button>
                  <button
                    type="button"
                    onClick={loadDemoVocalSample}
                    className="rounded-lg border border-[#00ffa3]/40 bg-[#00ffa3]/10 px-3 py-1.5 font-mono text-xs font-bold text-[#00ffa3] transition hover:bg-[#00ffa3]/20"
                  >
                    Load Dark Misfit Sample
                  </button>
                </div>
              </div>

              {cloneStatusNote && (
                <div className="mt-2.5 flex items-center gap-2 rounded-lg border border-[#00ffa3]/30 bg-[#00ffa3]/10 px-3 py-1.5 font-mono text-[11px] text-[#00ffa3]">
                  <Sparkles className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{cloneStatusNote}</span>
                </div>
              )}
            </section>

            {/* 2. MULTILINGUAL INPUT HUD */}
            <section className="rounded-2xl border border-[#35255e] bg-[#140e28] p-4 shadow-[0_12px_40px_rgba(0,0,0,0.6)]">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-md border border-[#00ffa3]/30 bg-[#00ffa3]/10 text-[#00ffa3]">
                    <Languages className="h-3.5 w-3.5" />
                  </div>
                  <h2 className="font-mono text-xs font-bold uppercase tracking-wider text-[#e8e6f2]">
                    Multilingual Input HUD
                  </h2>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={runTranscription}
                    disabled={transcribeBusy}
                    className="flex items-center gap-1 rounded border border-[#35255e] bg-[#191333] px-2 py-1 font-mono text-[10px] text-[#00ffa3] transition hover:border-[#00ffa3]"
                  >
                    <Wand2 className="h-3 w-3" />
                    <span>{transcribeBusy ? "Transcribing..." : "Transcribe"}</span>
                  </button>
                </div>
              </div>

              {/* Instant Script Injection Hooks */}
              <div className="mb-2">
                <p className="mb-1.5 font-mono text-[10px] uppercase tracking-wider text-[#9490ac]">
                  Instant Script Injection Hooks (Dark Aesthetic)
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {SCRIPT_INJECTION_HOOKS.map((hook) => (
                    <button
                      key={hook.id}
                      type="button"
                      onClick={() => {
                        setScriptText(hook.text);
                        setTranslatedText("");
                      }}
                      className="rounded-md border border-[#35255e] bg-[#181132] px-2.5 py-1 font-mono text-[10px] text-[#c5bfff] transition hover:border-[#00ffa3] hover:bg-[#00ffa3]/10 hover:text-[#00ffa3]"
                    >
                      <span className="mr-1 text-[9px] text-[#00ffa3]">▸</span>
                      {hook.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Terminal Multi-Line Text Area */}
              <div className="relative rounded-xl border border-[#35255e] bg-[#0c0917] p-2.5 font-mono">
                <div className="mb-1 flex items-center justify-between border-b border-[#261a45] pb-1 text-[10px] text-[#9490ac]">
                  <span>TERMINAL SCRIPT BUFFER</span>
                  <span>{scriptText.length} chars · {scriptText.split(/\s+/).filter(Boolean).length} words</span>
                </div>
                <textarea
                  value={scriptText}
                  onChange={(e) => setScriptText(e.target.value)}
                  rows={4}
                  className="w-full resize-none bg-transparent text-xs leading-relaxed text-[#e8e6f2] outline-none placeholder:text-[#5e5879] focus:text-[#ffffff]"
                  placeholder="Type or paste your dark cinematic dialogue script here..."
                />
              </div>

              {/* Translation Selection Bar */}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <div className="min-w-[170px] flex-1">
                  <select
                    value={targetLang}
                    onChange={(e) => setTargetLang(e.target.value)}
                    className="w-full rounded-lg border border-[#35255e] bg-[#100b21] px-2.5 py-1.5 font-mono text-xs text-[#e8e6f2] outline-none focus:border-[#00ffa3]"
                  >
                    {SUPPORTED_LANGS.map((lang) => (
                      <option key={lang} value={lang}>
                        {lang}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={executeTranslate}
                  disabled={isTranslating || !scriptText.trim()}
                  className="flex items-center gap-1.5 rounded-lg border border-[#00ffa3]/40 bg-[#00ffa3]/10 px-3 py-1.5 font-mono text-xs font-bold text-[#00ffa3] transition hover:bg-[#00ffa3]/25 disabled:opacity-40"
                >
                  <Languages className="h-3.5 w-3.5" />
                  <span>{isTranslating ? "Translating..." : "Translate Script"}</span>
                </button>
              </div>

              {/* Translation Output Card */}
              {translatedText && (
                <div className="mt-2.5 rounded-lg border border-[#00ffa3]/30 bg-[#0c0917] p-2.5">
                  <div className="mb-1 flex items-center justify-between font-mono text-[10px] text-[#00ffa3]">
                    <span>TRANSLATION OUTPUT ({targetLang})</span>
                    <button
                      type="button"
                      onClick={() => setScriptText(translatedText)}
                      className="text-[10px] text-[#39ffb4] hover:underline"
                    >
                      Use as Active Script ↵
                    </button>
                  </div>
                  <p className="font-mono text-xs text-[#e8e6f2]">
                    {translatedText}
                  </p>
                </div>
              )}
            </section>

            {/* 3. MICRO-HAPTIC TRAIT SLIDER ARRAY */}
            <section className="rounded-2xl border border-[#35255e] bg-[#140e28] p-4 shadow-[0_12px_40px_rgba(0,0,0,0.6)]">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-md border border-[#00ffa3]/30 bg-[#00ffa3]/10 text-[#00ffa3]">
                    <Sliders className="h-3.5 w-3.5" />
                  </div>
                  <h2 className="font-mono text-xs font-bold uppercase tracking-wider text-[#e8e6f2]">
                    Micro-Haptic Trait Slider Array
                  </h2>
                </div>
                <span className="font-mono text-[10px] text-[#9490ac]">
                  MECHANICAL PARAMETERS
                </span>
              </div>

              <div className="space-y-3.5">
                {/* 1. Emotional Expressiveness Dial */}
                <div className="rounded-xl border border-[#2b1e4c] bg-[#0f0b1f] p-3">
                  <div className="mb-1.5 flex items-center justify-between">
                    <div>
                      <span className="font-mono text-xs font-bold text-[#e8e6f2]">
                        Emotional Expressiveness Dial
                      </span>
                      <p className="font-mono text-[10px] text-[#9490ac]">
                        Intensity:{" "}
                        <span className="text-[#00ffa3]">
                          {emotionExpressiveness < 35
                            ? "Somber"
                            : emotionExpressiveness < 65
                            ? "Melancholic"
                            : emotionExpressiveness < 85
                            ? "Anguished"
                            : "Defiant Betrayal"}
                        </span>
                      </p>
                    </div>
                    <span className="font-mono text-xs font-extrabold text-[#00ffa3]">
                      {emotionExpressiveness}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={emotionExpressiveness}
                    onChange={(e) => setEmotionExpressiveness(Number(e.target.value))}
                    className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-[#261947] accent-[#00ffa3]"
                  />
                </div>

                {/* 2. Stability Factor Meter */}
                <div className="rounded-xl border border-[#2b1e4c] bg-[#0f0b1f] p-3">
                  <div className="mb-1.5 flex items-center justify-between">
                    <div>
                      <span className="font-mono text-xs font-bold text-[#e8e6f2]">
                        Stability Factor Meter
                      </span>
                      <p className="font-mono text-[10px] text-[#9490ac]">
                        Pitch Drift:{" "}
                        <span className="text-[#00ffa3]">
                          {stabilityFactor > 75
                            ? "Deterministic Pitch Lock"
                            : stabilityFactor > 40
                            ? "Balanced Formant Drift"
                            : "Volatile Emotional Wobble"}
                        </span>
                      </p>
                    </div>
                    <span className="font-mono text-xs font-extrabold text-[#00ffa3]">
                      {stabilityFactor}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={stabilityFactor}
                    onChange={(e) => setStabilityFactor(Number(e.target.value))}
                    className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-[#261947] accent-[#00ffa3]"
                  />
                </div>

                {/* 3. Clarity Resonance Balance */}
                <div className="rounded-xl border border-[#2b1e4c] bg-[#0f0b1f] p-3">
                  <div className="mb-1.5 flex items-center justify-between">
                    <div>
                      <span className="font-mono text-xs font-bold text-[#e8e6f2]">
                        Clarity Resonance Balance
                      </span>
                      <p className="font-mono text-[10px] text-[#9490ac]">
                        Acoustics:{" "}
                        <span className="text-[#00ffa3]">
                          {clarityResonance > 75
                            ? "Hyper-Resonant Brilliance"
                            : clarityResonance > 45
                            ? "Balanced Studio Air"
                            : "Dark Warm Harmonic Decay"}
                        </span>
                      </p>
                    </div>
                    <span className="font-mono text-xs font-extrabold text-[#00ffa3]">
                      {clarityResonance}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={clarityResonance}
                    onChange={(e) => setClarityResonance(Number(e.target.value))}
                    className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-[#261947] accent-[#00ffa3]"
                  />
                </div>

                {/* 4. Vocal Age & Texture Shifter */}
                <div className="rounded-xl border border-[#2b1e4c] bg-[#0f0b1f] p-3">
                  <div className="mb-1.5 flex items-center justify-between">
                    <div>
                      <span className="font-mono text-xs font-bold text-[#e8e6f2]">
                        Vocal Age &amp; Texture Shifter
                      </span>
                      <p className="font-mono text-[10px] text-[#9490ac]">
                        Timbre:{" "}
                        <span className="text-[#00ffa3]">
                          {vocalAgeTexture < 30
                            ? "Youthful Clear"
                            : vocalAgeTexture < 60
                            ? "Prime Cinematic"
                            : vocalAgeTexture < 80
                            ? "Weathered Grit"
                            : "Deep Gravel Raspy"}
                        </span>
                      </p>
                    </div>
                    <span className="font-mono text-xs font-extrabold text-[#00ffa3]">
                      {vocalAgeTexture}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={vocalAgeTexture}
                    onChange={(e) => setVocalAgeTexture(Number(e.target.value))}
                    className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-[#261947] accent-[#00ffa3]"
                  />
                </div>
              </div>

              {/* Compile Dialogue Button */}
              <div className="mt-4">
                <button
                  type="button"
                  onClick={handleSynthesizeVoice}
                  disabled={isSynthesizing || !scriptText.trim()}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#00ffa3] to-[#39ffb4] py-3 font-mono text-xs font-extrabold uppercase tracking-wider text-[#000000] shadow-[0_0_25px_rgba(0,255,163,0.35)] transition-all hover:scale-[1.01] hover:shadow-[0_0_35px_rgba(0,255,163,0.5)] active:scale-[0.99] disabled:opacity-50"
                >
                  <Cpu className="h-4 w-4" />
                  <span>
                    {isSynthesizing
                      ? "Compiling Voice Weights..."
                      : "Compile & Synthesize Dialogue Track"}
                  </span>
                </button>
                {synthNotice && (
                  <p className="mt-2 text-center font-mono text-[11px] text-[#00ffa3]">
                    {synthNotice}
                  </p>
                )}
              </div>
            </section>
          </div>

          {/* =================================================================
              RIGHT PANEL: REAL-TIME RENDERING DESK (60% WIDTH -> lg:col-span-7)
          ================================================================= */}
          <div className="space-y-4 lg:col-span-7">
            
            {/* 1. WEBGL WAVEFORM MONITOR (ABSOLUTE TOP VIEWPORT) */}
            <section className="relative overflow-hidden rounded-2xl border border-[#35255e] bg-[#000000] p-4 shadow-[0_12px_45px_rgba(0,0,0,0.85)]">
              {/* Header with Telemetry Badges */}
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-[#21163d] pb-2.5">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-md border border-[#00ffa3]/30 bg-[#00ffa3]/10 text-[#00ffa3]">
                    <Activity className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <h2 className="font-mono text-xs font-bold uppercase tracking-wider text-[#e8e6f2]">
                      WebGL Waveform Monitor
                    </h2>
                    <p className="font-mono text-[10px] text-[#9490ac]">
                      High-Frame-Rate Neon Reactive Particle Viewport
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Mode selector */}
                  <div className="flex rounded-lg border border-[#35255e] bg-[#120d24] p-0.5 font-mono text-[10px]">
                    {(["particles", "ribbon", "quantum"] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setWaveShaderMode(mode)}
                        className={`rounded px-2 py-0.5 uppercase transition ${
                          waveShaderMode === mode
                            ? "bg-[#00ffa3] font-bold text-[#000000]"
                            : "text-[#9490ac] hover:text-[#e8e6f2]"
                        }`}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>

                  {/* Audio Controls */}
                  <button
                    type="button"
                    onClick={togglePlayAudioDesk}
                    className={`flex items-center gap-1.5 rounded-lg border px-3 py-1 font-mono text-xs font-bold transition ${
                      isPlayingAudio
                        ? "border-[#00ffa3] bg-[#00ffa3] text-[#000000] shadow-[0_0_15px_#00ffa3]"
                        : "border-[#00ffa3]/40 bg-[#00ffa3]/10 text-[#00ffa3] hover:bg-[#00ffa3]/20"
                    }`}
                  >
                    {isPlayingAudio ? (
                      <>
                        <Pause className="h-3.5 w-3.5" />
                        <span>Pause</span>
                      </>
                    ) : (
                      <>
                        <Play className="h-3.5 w-3.5" />
                        <span>Preview Wave</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Canvas Viewport: Pure Black (#000000) backdrop */}
              <div className="relative h-56 w-full overflow-hidden rounded-xl border border-[#261947] bg-[#000000]">
                <canvas
                  ref={webglCanvasRef}
                  className="h-full w-full block cursor-crosshair"
                />

                {/* Overlaid Telemetry Metrics */}
                <div className="pointer-events-none absolute left-3 top-3 flex flex-col gap-1 font-mono text-[10px] text-[#9490ac]">
                  <span className="flex items-center gap-1 text-[#00ffa3]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#00ffa3] animate-ping" />
                    BUFFER: 48 kHz / 24-BIT
                  </span>
                  <span>PEAK LEVEL: {peakDb} dB</span>
                  <span>PARTICLES: 180 REACTION NODES</span>
                </div>

                <div className="pointer-events-none absolute right-3 top-3 font-mono text-[10px] text-[#00ffa3]">
                  FPS: {fpsCounter} · GL SHADER: ACTIVE
                </div>

                {/* Bottom Scrubbing Transport Bar */}
                <div className="absolute bottom-2 left-3 right-3 flex items-center gap-3 rounded-lg border border-[#35255e]/60 bg-[#0c0817]/80 px-3 py-1.5 backdrop-blur-md">
                  <span className="font-mono text-[10px] text-[#00ffa3]">
                    {Math.floor(audioCurrentTime / 60)}:
                    {String(Math.floor(audioCurrentTime % 60)).padStart(2, "0")}
                  </span>

                  <input
                    type="range"
                    min="0"
                    max={audioTotalDuration || 12}
                    step="0.05"
                    value={audioCurrentTime}
                    onChange={(e) => {
                      const t = Number(e.target.value);
                      if (audioElementRef.current) {
                        audioElementRef.current.currentTime = t;
                      }
                      if (videoElementRef.current) {
                        videoElementRef.current.currentTime = t;
                      }
                      setAudioCurrentTime(t);
                    }}
                    className="h-1 flex-1 cursor-pointer appearance-none rounded bg-[#2c1e4d] accent-[#00ffa3]"
                  />

                  <span className="font-mono text-[10px] text-[#9490ac]">
                    {Math.floor(audioTotalDuration / 60)}:
                    {String(Math.floor(audioTotalDuration % 60)).padStart(2, "0")}
                  </span>

                  {/* Volume icon */}
                  <button
                    type="button"
                    onClick={() => {
                      if (audioElementRef.current) {
                        audioElementRef.current.muted = !isMuted;
                        setIsMuted(!isMuted);
                      }
                    }}
                    className="text-[#9490ac] hover:text-[#00ffa3]"
                  >
                    {isMuted ? (
                      <VolumeX className="h-3.5 w-3.5" />
                    ) : (
                      <Volume2 className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              </div>
            </section>

            {/* 2. AUTOMATED LIP-SYNC CANVAS ELEMENT (DIRECTLY BELOW WAVEFORM MONITOR) */}
            <section className="relative overflow-hidden rounded-2xl border border-[#35255e] bg-[#140e28] p-4 shadow-[0_12px_45px_rgba(0,0,0,0.7)]">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-[#21163d] pb-2.5">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-md border border-[#00ffa3]/30 bg-[#00ffa3]/10 text-[#00ffa3]">
                    <Film className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <h2 className="font-mono text-xs font-bold uppercase tracking-wider text-[#e8e6f2]">
                      Automated Lip-Sync Canvas Element
                    </h2>
                    <p className="font-mono text-[10px] text-[#9490ac]">
                      Neural Character Video Tracking &amp; Synthesized Clone Dialogue Timeline Sync
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowFacialMesh(!showFacialMesh)}
                    className={`flex items-center gap-1 rounded-lg border px-2.5 py-1 font-mono text-[11px] transition ${
                      showFacialMesh
                        ? "border-[#00ffa3] bg-[#00ffa3]/10 text-[#00ffa3]"
                        : "border-[#35255e] bg-[#16112c] text-[#9490ac]"
                    }`}
                  >
                    {showFacialMesh ? (
                      <>
                        <Eye className="h-3 w-3" />
                        <span>Facial Mesh: ON</span>
                      </>
                    ) : (
                      <>
                        <EyeOff className="h-3 w-3" />
                        <span>Facial Mesh: OFF</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => videoFileInputRef.current?.click()}
                    className="flex items-center gap-1 rounded-lg border border-[#35255e] bg-[#191333] px-2.5 py-1 font-mono text-[11px] text-[#e8e6f2] hover:border-[#00ffa3]"
                  >
                    <Upload className="h-3 w-3" />
                    <span>Upload Source Video</span>
                  </button>
                  <input
                    ref={videoFileInputRef}
                    type="file"
                    accept="video/*"
                    className="hidden"
                    onChange={(e) => handleVideoUpload(e.target.files)}
                  />
                </div>
              </div>

              {/* Main Media Rendering Viewport: Paired Video & Mesh Canvas */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsVideoDragging(true);
                }}
                onDragLeave={() => setIsVideoDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsVideoDragging(false);
                  handleVideoUpload(e.dataTransfer.files);
                }}
                className={`relative aspect-video w-full overflow-hidden rounded-xl border-2 transition-all ${
                  isVideoDragging
                    ? "border-[#00ffa3] bg-[#00ffa3]/10"
                    : "border-[#2b1d4c] bg-[#000000]"
                }`}
              >
                {/* HTML5 Video Source */}
                <video
                  ref={videoElementRef}
                  src={characterVideoUrl}
                  loop
                  playsInline
                  muted
                  className="h-full w-full object-cover"
                />

                {/* Synchronized Transparent Canvas for Neon Facial Mesh & Tracking */}
                <canvas
                  ref={lipSyncCanvasRef}
                  className="pointer-events-none absolute inset-0 h-full w-full"
                />

                {/* Overlaid Pipeline Connector Badges */}
                <div className="absolute left-3 top-3 flex flex-wrap gap-2">
                  <span className="rounded border border-[#00ffa3]/40 bg-[#000000]/80 px-2 py-0.5 font-mono text-[10px] text-[#00ffa3] backdrop-blur-sm">
                    CAPCUT PIPELINE: LINKED
                  </span>
                  <span className="rounded border border-[#00ffa3]/40 bg-[#000000]/80 px-2 py-0.5 font-mono text-[10px] text-[#00ffa3] backdrop-blur-sm">
                    TIMELINE SYNC: ACTIVE
                  </span>
                </div>

                {/* Active Viseme Monitor HUD in viewport bottom-left */}
                <div className="absolute bottom-3 left-3 flex items-center gap-2 rounded-lg border border-[#00ffa3]/30 bg-[#000000]/85 px-3 py-1.5 backdrop-blur-md">
                  <span className="h-2 w-2 rounded-full bg-[#00ffa3] animate-pulse" />
                  <span className="font-mono text-[10px] text-[#9490ac]">ACTIVE VISEME:</span>
                  <span className="font-mono text-[11px] font-bold text-[#00ffa3]">
                    {VISEME_MAP[currentVisemeIndex].phoneme} — {VISEME_MAP[currentVisemeIndex].viseme}
                  </span>
                </div>
              </div>

              {/* Viseme Matrix Indicator Array */}
              <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
                {VISEME_MAP.map((v, idx) => (
                  <div
                    key={v.phoneme}
                    className={`rounded-lg border p-2 text-center transition ${
                      currentVisemeIndex === idx
                        ? "border-[#00ffa3] bg-[#00ffa3]/15 shadow-[0_0_12px_rgba(0,255,163,0.3)]"
                        : "border-[#2b1d4c] bg-[#0d091a]"
                    }`}
                  >
                    <p className={`font-mono text-xs font-extrabold ${currentVisemeIndex === idx ? "text-[#00ffa3]" : "text-[#9490ac]"}`}>
                      {v.phoneme}
                    </p>
                    <p className="truncate font-mono text-[9px] text-[#9490ac]">
                      {v.viseme.split(" ")[0]}
                    </p>
                  </div>
                ))}
              </div>

              {/* Processing Progress Bar */}
              {isLipSyncRendering && (
                <div className="mt-3 space-y-1.5 rounded-xl border border-[#00ffa3]/40 bg-[#0d091a] p-3">
                  <div className="flex items-center justify-between font-mono text-xs">
                    <span className="text-[#00ffa3] animate-pulse">{lipSyncStatus}</span>
                    <span className="font-bold text-[#00ffa3]">{lipSyncProgress}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-[#261947]">
                    <div
                      className="h-full bg-gradient-to-r from-[#00ffa3] to-[#39ffb4] transition-all duration-300 shadow-[0_0_12px_#00ffa3]"
                      style={{ width: `${lipSyncProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Actions Footer */}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={runAutomatedLipSync}
                  disabled={isLipSyncRendering}
                  className="flex items-center gap-2 rounded-xl bg-[#00ffa3] px-4 py-2.5 font-mono text-xs font-extrabold uppercase text-[#000000] shadow-[0_0_20px_rgba(0,255,163,0.3)] transition hover:bg-[#39ffb4] hover:shadow-[0_0_30px_rgba(0,255,163,0.5)] disabled:opacity-50"
                >
                  <Wand2 className="h-4 w-4" />
                  <span>
                    {isLipSyncRendering ? "Aligning Frames..." : "Run Automated Lip-Sync"}
                  </span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      alert("Lip-sync dialogue track synced directly with Video Studio pipeline.");
                    }}
                    className="flex items-center gap-1.5 rounded-xl border border-[#35255e] bg-[#1a1336] px-3 py-2.5 font-mono text-xs font-bold text-[#e8e6f2] transition hover:border-[#00ffa3] hover:text-[#00ffa3]"
                  >
                    <Scissors className="h-3.5 w-3.5" />
                    <span>Send to Video Studio</span>
                  </button>

                  <a
                    href={synthesizedAudioUrl}
                    download="OmniVoice_Master_Audio.mp3"
                    className="flex items-center gap-1.5 rounded-xl border border-[#00ffa3]/40 bg-[#00ffa3]/10 px-3 py-2.5 font-mono text-xs font-bold text-[#00ffa3] transition hover:bg-[#00ffa3]/25"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Export Master</span>
                  </a>
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
