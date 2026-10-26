"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { MediaAsset } from "@/lib/types";

const MEDIA_BUCKET = "media";
const SIGNED_URL_TTL = 3600;
const MAX_RENDER_SECONDS = 90;
const FPS = 30;

type Treatment = "spectrum" | "rings" | "ecg" | "mesh" | "particles";
type PaletteName = "violet" | "crimson" | "cyan" | "mono";
type Aspect = "16:9" | "9:16" | "1:1";

type Palette = { bg: string; a: string; b: string; c: string };

const TREATMENTS: { id: Treatment; label: string; blurb: string }[] = [
  { id: "ecg", label: "Heartbeat", blurb: "An ECG trace that spikes on the beat — the house mark." },
  { id: "spectrum", label: "Spectrum", blurb: "Frequency bars, mirrored top and bottom." },
  { id: "rings", label: "Pulse rings", blurb: "Concentric rings blooming outward on every kick." },
  { id: "mesh", label: "Mesh field", blurb: "The OmniAI mesh, lifted by the track's energy." },
  { id: "particles", label: "Particles", blurb: "A drift of motes pushed outward by the bass." },
];

const PALETTES: Record<PaletteName, { label: string } & Palette> = {
  violet: { label: "Violet", bg: "#0B0A14", a: "#6C63FF", b: "#00F2FE", c: "#FF2A6D" },
  crimson: { label: "Crimson", bg: "#120709", a: "#FF2A6D", b: "#FF9AB4", c: "#6C63FF" },
  cyan: { label: "Cyan", bg: "#06121A", a: "#00F2FE", b: "#6C63FF", c: "#FFFFFF" },
  mono: { label: "Monochrome", bg: "#0B0A0F", a: "#F2F0FF", b: "#8B8BA0", c: "#4A4A5C" },
};

const ASPECTS: Record<Aspect, { label: string; w: number; h: number }> = {
  "16:9": { label: "Landscape 16:9", w: 1280, h: 720 },
  "9:16": { label: "Vertical 9:16", w: 720, h: 1280 },
  "1:1": { label: "Square 1:1", w: 1080, h: 1080 },
};

type Frame = {
  freq: Uint8Array;
  time: Uint8Array;
  level: number;
  bass: number;
  treble: number;
};

function hexA(hex: string, alpha: number): string {
  const n = Number.parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

function avg(arr: Uint8Array, from: number, to: number): number {
  const end = Math.min(to, arr.length);
  let sum = 0;
  let count = 0;
  for (let i = from; i < end; i += 1) {
    sum += arr[i];
    count += 1;
  }
  return count ? sum / count : 0;
}

function rms(arr: Uint8Array): number {
  let sum = 0;
  for (let i = 0; i < arr.length; i += 1) {
    const v = (arr[i] - 128) / 128;
    sum += v * v;
  }
  return Math.sqrt(sum / Math.max(1, arr.length));
}

/** Deterministic per-index noise so particle fields are stable frame to frame. */
function noise(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function drawTreatment(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  frame: Frame,
  palette: Palette,
  treatment: Treatment,
  intensity: number,
  time: number,
) {
  const { level, bass, treble, freq } = frame;
  const min = Math.min(w, h);

  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = palette.bg;
  ctx.fillRect(0, 0, w, h);

  const glow = ctx.createRadialGradient(w / 2, h * 0.5, 0, w / 2, h * 0.5, min * 0.8);
  glow.addColorStop(0, hexA(palette.a, 0.06 + level * 0.22 * intensity));
  glow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (treatment === "spectrum") {
    const bars = 72;
    const bw = w / bars;

    for (let i = 0; i < bars; i += 1) {
      const bin = Math.floor((i / bars) * freq.length * 0.66);
      const v = freq[bin] / 255;
      const bh = Math.max(min * 0.006, v * h * 0.46 * intensity);

      const grad = ctx.createLinearGradient(0, h, 0, h - bh);
      grad.addColorStop(0, palette.a);
      grad.addColorStop(1, palette.b);
      ctx.fillStyle = grad;

      const x = i * bw;
      ctx.fillRect(x + bw * 0.14, h - bh, bw * 0.72, bh);

      ctx.globalAlpha = 0.3 + treble * 0.4;
      ctx.fillRect(x + bw * 0.14, 0, bw * 0.72, bh * 0.8);
      ctx.globalAlpha = 1;
    }
  } else if (treatment === "rings") {
    const rings = 9;

    for (let i = 0; i < rings; i += 1) {
      const phase = (time * (0.16 + level * 0.9) + i / rings) % 1;
      const r = phase * min * 0.56;
      const hue = i % 2 === 0 ? palette.a : palette.b;

      ctx.strokeStyle = hue;
      ctx.lineWidth = Math.max(1, 1 + bass * min * 0.012 * intensity);
      ctx.globalAlpha = (1 - phase) * (0.18 + level * 0.82);
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.globalAlpha = 0.5 + level * 0.5;
    ctx.fillStyle = palette.c;
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, min * 0.012 + bass * min * 0.05 * intensity, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  } else if (treatment === "ecg") {
    const baseline = h * 0.54;
    const sweep = (time * 0.42) % 1;

    ctx.strokeStyle = hexA(palette.a, 0.22);
    ctx.lineWidth = Math.max(1, min * 0.002);
    ctx.beginPath();
    ctx.moveTo(0, baseline);
    ctx.lineTo(w, baseline);
    ctx.stroke();

    ctx.strokeStyle = palette.a;
    ctx.lineWidth = Math.max(2, min * 0.008);
    ctx.shadowColor = palette.a;
    ctx.shadowBlur = min * 0.03;
    ctx.beginPath();

    let headX = 0;
    let headY = baseline;

    for (let x = 0; x <= w; x += 2) {
      const rel = x / w;
      const wobble = Math.sin(rel * 26 + time * 1.6) * h * 0.006;
      let y = baseline + wobble;

      const beat = ((rel * 5 - sweep * 5) % 1 + 1) % 1;
      if (beat > 0.4 && beat < 0.62) {
        const t2 = (beat - 0.4) / 0.22;
        const spike = Math.exp(-Math.pow((t2 - 0.52) * 4.4, 2));
        y -= spike * h * (0.16 + level * 0.34) * intensity;
      }

      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);

      if (Math.abs(rel - sweep) < 0.002) {
        headX = x;
        headY = y;
      }
    }

    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.globalAlpha = 0.85;
    ctx.fillStyle = palette.c;
    ctx.beginPath();
    ctx.arc(headX, headY, Math.max(2, min * 0.012 + level * min * 0.02), 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  } else if (treatment === "mesh") {
    const cols = 30;
    const rows = 15;
    const horizon = h * 0.52;

    for (let r = 0; r <= rows; r += 1) {
      const depth = r / rows;
      const y0 = horizon + Math.pow(depth, 1.7) * h * 0.58;

      ctx.strokeStyle = hexA(r % 3 === 0 ? palette.b : palette.a, 0.1 + (1 - depth) * 0.28);
      ctx.lineWidth = Math.max(1, (1 - depth) * min * 0.004);
      ctx.beginPath();

      for (let c = 0; c <= cols; c += 1) {
        const px = (c / cols) * w;
        const bin = Math.floor((c / cols) * freq.length * 0.5);
        const lift =
          (freq[bin] / 255) * h * 0.09 * intensity * (0.35 + (1 - depth) * 0.9) +
          Math.sin(c * 0.55 + time * 1.5 + depth * 5) * h * 0.012 * (1 - depth);
        const y = y0 - lift;
        if (c === 0) ctx.moveTo(px, y);
        else ctx.lineTo(px, y);
      }

      ctx.stroke();
    }

    ctx.strokeStyle = hexA(palette.c, 0.14 + level * 0.3);
    ctx.lineWidth = 1;
    for (let c = 0; c <= cols; c += 2) {
      const px = (c / cols) * w;
      ctx.beginPath();
      ctx.moveTo(px, horizon - h * 0.02);
      ctx.lineTo(px, h);
      ctx.stroke();
    }
  } else {
    const motes = 120;

    for (let i = 0; i < motes; i += 1) {
      const seed = i * 1.7;
      const angle = noise(seed) * Math.PI * 2;
      const dist = (0.15 + noise(seed + 3) * 0.85) * (0.35 + bass * 0.75) * min * 0.52;
      const x = w / 2 + Math.cos(angle + time * 0.08) * dist;
      const y = h / 2 + Math.sin(angle + time * 0.08) * dist * 0.92;
      const size = (0.6 + treble * 2.6 + noise(seed + 9) * 1.6) * (min / 720);

      ctx.fillStyle = i % 5 === 0 ? palette.c : i % 2 === 0 ? palette.a : palette.b;
      ctx.globalAlpha = 0.18 + level * 0.6 + noise(seed + 5) * 0.25;
      ctx.beginPath();
      ctx.arc(x, y, Math.max(0.7, size) * (1 + intensity * 0.7), 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1;
    ctx.strokeStyle = hexA(palette.a, 0.1 + level * 0.4);
    ctx.lineWidth = Math.max(1, min * 0.003 + level * min * 0.01);
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, min * (0.06 + level * 0.12 * intensity), 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();

  // Letterbox-safe vignette so captions never sit on a bright edge.
  const vignette = ctx.createRadialGradient(w / 2, h / 2, min * 0.25, w / 2, h / 2, min * 0.85);
  vignette.addColorStop(0, "rgba(0,0,0,0)");
  vignette.addColorStop(1, "rgba(0,0,0,0.55)");
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, w, h);
}

function pickMime(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm;codecs=vp9",
    "video/webm",
  ];
  return candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate)) ?? null;
}

function formatClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "--:--";
  const whole = Math.round(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

function errorText(value: unknown, fallback: string): string {
  return value instanceof Error ? value.message : fallback;
}

function trackTitle(asset: MediaAsset): string {
  const first = (asset.prompt ?? "").split("\n").find((line) => line.trim());
  return first ? first.trim().slice(0, 70) : "Untitled track";
}

export default function PulseStudioPage() {
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [treatment, setTreatment] = useState<Treatment>("ecg");
  const [paletteName, setPaletteName] = useState<PaletteName>("violet");
  const [aspect, setAspect] = useState<Aspect>("16:9");
  const [intensity, setIntensity] = useState(0.85);

  const [playing, setPlaying] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultName, setResultName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [duration, setDuration] = useState(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const acRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const recordDestRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const stopTimerRef = useRef<number | null>(null);
  const resultUrlRef = useRef<string | null>(null);

  const selected = assets.find((asset) => asset.id === selectedId) ?? null;
  const selectedUrl = selected ? urls[selected.storage_path] : undefined;
  const palette = PALETTES[paletteName];

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const { data: rows, error: listError } = await supabase
        .from("media_assets")
        .select("*")
        .eq("kind", "audio")
        .order("created_at", { ascending: false })
        .limit(100);
      if (listError) throw new Error(listError.message);

      const list = (rows ?? []) as MediaAsset[];
      setAssets(list);

      if (list.length === 0) {
        setUrls({});
        setSelectedId(null);
        return;
      }

      const { data: signed } = await supabase.storage
        .from(MEDIA_BUCKET)
        .createSignedUrls(list.map((asset) => asset.storage_path), SIGNED_URL_TTL);

      const map: Record<string, string> = {};
      for (const entry of signed ?? []) {
        if (entry.signedUrl && entry.path) map[entry.path] = entry.signedUrl;
      }
      setUrls(map);
      setSelectedId((current) => current ?? list[0].id);
    } catch (loadError) {
      setError(errorText(loadError, "Could not load your tracks."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /** Wire the element through an analyser once — an element can only be sourced once. */
  function ensureGraph(): AudioContext | null {
    const el = audioRef.current;
    if (!el) return null;
    if (!acRef.current) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      const ac = new Ctor();
      const source = ac.createMediaElementSource(el);
      const analyser = ac.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);
      analyser.connect(ac.destination);
      const dest = ac.createMediaStreamDestination();
      source.connect(dest);
      acRef.current = ac;
      analyserRef.current = analyser;
      recordDestRef.current = dest;
    }
    void acRef.current.resume();
    return acRef.current;
  }

  /** Keep the canvas at export resolution and paint every frame while mounted. */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { w, h } = ASPECTS[aspect];
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
  }, [aspect]);

  useEffect(() => {
    let raf = 0;
    const freq = new Uint8Array(1024);
    const time = new Uint8Array(1024);

    const loop = () => {
      raf = requestAnimationFrame(loop);
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) return;

      let level = 0;
      let bass = 0;
      let treble = 0;
      const analyser = analyserRef.current;

      if (analyser) {
        analyser.getByteFrequencyData(freq);
        analyser.getByteTimeDomainData(time);
        level = Math.min(1, rms(time) * 2.6);
        bass = avg(freq, 1, 20) / 255;
        treble = avg(freq, 180, 480) / 255;
      }

      drawTreatment(
        ctx,
        canvas.width,
        canvas.height,
        { freq, time, level, bass, treble },
        palette,
        treatment,
        intensity,
        performance.now() / 1000,
      );
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [palette, treatment, intensity]);

  /** Live clock + audio-end hook for the preview and the recorder. */
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;

    const onTime = () => {
      setElapsed(el.currentTime);
      if (Number.isFinite(el.duration)) setDuration(el.duration);
    };
    const onEnd = () => {
      setPlaying(false);
      setElapsed(0);
    };
    const onPause = () => setPlaying(false);
    const onPlay = () => setPlaying(true);

    el.addEventListener("timeupdate", onTime);
    el.addEventListener("loadedmetadata", onTime);
    el.addEventListener("ended", onEnd);
    el.addEventListener("pause", onPause);
    el.addEventListener("play", onPlay);

    return () => {
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("loadedmetadata", onTime);
      el.removeEventListener("ended", onEnd);
      el.removeEventListener("pause", onPause);
      el.removeEventListener("play", onPlay);
    };
  }, [selectedId, selectedUrl]);

  useEffect(() => {
    return () => {
      if (stopTimerRef.current) window.clearTimeout(stopTimerRef.current);
      try {
        recorderRef.current?.stop();
      } catch {
        // Already stopped.
      }
      void acRef.current?.close();
      if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current);
    };
  }, []);

  async function togglePlay() {
    const el = audioRef.current;
    if (!el || !selectedUrl) return;
    setError(null);
    ensureGraph();

    if (!el.src || el.src !== selectedUrl) {
      el.src = selectedUrl;
    }

    if (playing) {
      el.pause();
      return;
    }

    try {
      await el.play();
    } catch (playError) {
      setError(errorText(playError, "Playback was blocked — click play again."));
    }
  }

  function stopRecording() {
    if (stopTimerRef.current) {
      window.clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }
    try {
      recorderRef.current?.stop();
    } catch {
      // Already stopped.
    }
    recorderRef.current = null;
    audioRef.current?.pause();
    setPlaying(false);
  }

  async function render() {
    const el = audioRef.current;
    const canvas = canvasRef.current;
    if (!el || !canvas || !selectedUrl) {
      setError("Pick a track first — make one in Music Studio if you have none.");
      return;
    }
    const mime = pickMime();
    if (!mime) {
      setError("This browser cannot record canvas video. Try a recent Chrome, Edge or Firefox.");
      return;
    }

    const ac = ensureGraph();
    if (!ac) {
      setError("Audio is unavailable in this browser.");
      return;
    }

    setError(null);
    stopRecording();
    setResultUrl(null);
    setResultName(null);
    setRendering(true);

    try {
      if (resultUrlRef.current) {
        URL.revokeObjectURL(resultUrlRef.current);
        resultUrlRef.current = null;
      }

      const { w, h } = ASPECTS[aspect];
      canvas.width = w;
      canvas.height = h;

      const stream = canvas.captureStream(FPS);
      const audioTrack = recordDestRef.current?.stream.getAudioTracks()[0];
      if (audioTrack) stream.addTrack(audioTrack);

      const recorder = new MediaRecorder(stream, {
        mimeType: mime,
        videoBitsPerSecond: 6_000_000,
      });
      const chunks: Blob[] = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      recorder.onstop = () => {
        recorderRef.current = null;
        if (stopTimerRef.current) {
          window.clearTimeout(stopTimerRef.current);
          stopTimerRef.current = null;
        }
        el.pause();
        setPlaying(false);
        setRendering(false);
        const blob = new Blob(chunks, { type: "video/webm" });
        if (blob.size === 0) {
          setError("The recorder produced an empty file — try a shorter track.");
          return;
        }
        const url = URL.createObjectURL(blob);
        resultUrlRef.current = url;
        setResultUrl(url);
        setResultName(`omniai-pulse-${treatment}-${aspect.replace(":", "x")}.webm`);
        stream.getTracks().forEach((track) => track.stop());
      };

      recorderRef.current = recorder;

      el.src = selectedUrl;
      el.currentTime = 0;
      await ac.resume();
      await el.play();
      setPlaying(true);

      recorder.start(250);

      const finish = () => stopRecording();
      el.addEventListener("ended", finish, { once: true });
      stopTimerRef.current = window.setTimeout(finish, MAX_RENDER_SECONDS * 1000);
    } catch (renderError) {
      setRendering(false);
      recorderRef.current = null;
      setError(errorText(renderError, "Render failed — try a different browser or a shorter track."));
    }
  }

  const aspectMeta = ASPECTS[aspect];
  const canRender = Boolean(selectedUrl) && !rendering;

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-1">
      <header className="space-y-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-signal">
          OmniAI / Audio-reactive video
        </p>
        <h1 className="pilot-voice text-2xl text-ink">Pulse Studio</h1>
        <p className="max-w-2xl text-sm text-ash">
          Turn any track into a music video. Pick a source from your library, choose how the
          picture moves, and render a beat-synced file. Pulse works in the browser, so it needs no
          provider key and never falls back to local heavy generation.
        </p>
      </header>

      {error && (
        <p
          role="alert"
          className="rounded border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200"
        >
          {error}
        </p>
      )}

      <audio ref={audioRef} preload="metadata" crossOrigin="anonymous" className="hidden" />

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        {/* ------------------------------------------------------- canvas */}
        <div className="space-y-3 rounded border border-ash/30 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-ink">Preview</h2>
            <span className="font-mono text-[10px] uppercase tracking-wide text-ash">
              {aspectMeta.label} · {aspectMeta.w}×{aspectMeta.h}
            </span>
          </div>

          <div className="overflow-hidden rounded border border-ash/30 bg-black">
            <canvas
              ref={canvasRef}
              width={aspectMeta.w}
              height={aspectMeta.h}
              className="block h-auto w-full"
              aria-label="Music video preview"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void togglePlay()}
              disabled={!selectedUrl}
              className="rounded border border-signal/50 px-4 py-2 text-sm text-signal transition hover:bg-signal/10 disabled:opacity-40"
            >
              {playing && !rendering ? "Pause" : "Play preview"}
            </button>

            <div className="font-mono text-xs tabular-nums text-ash">
              {formatClock(elapsed)} <span className="opacity-50">/</span> {formatClock(duration)}
            </div>

            <div className="ml-auto flex items-center gap-2">
              {rendering ? (
                <button
                  type="button"
                  onClick={stopRecording}
                  className="rounded border border-rose-400/50 px-4 py-2 text-sm text-rose-300 hover:bg-rose-500/10"
                >
                  Stop render
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void render()}
                  disabled={!canRender}
                  className="rounded bg-[#5b39b4] px-4 py-2 text-sm font-semibold text-white transition hover:bg-wine disabled:opacity-40"
                >
                  Render music video
                </button>
              )}
            </div>
          </div>

          {rendering && (
            <p className="flex items-center gap-2 text-xs text-signal">
              <span className="dms-heartbeat h-1.5 w-1.5 rounded-full bg-signal" aria-hidden="true" />
              Recording at {FPS} fps — keep this tab visible until it finishes.
            </p>
          )}

          {resultUrl && (
            <div className="space-y-2 rounded border border-signal/40 bg-signal/5 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-signal">Render complete.</p>
                <a
                  href={resultUrl}
                  download={resultName ?? "pulse.webm"}
                  className="rounded border border-signal/50 px-3 py-1 text-xs text-signal hover:bg-signal/10"
                >
                  Download WebM
                </a>
              </div>
              <video
                src={resultUrl}
                controls
                playsInline
                className="w-full rounded border border-ash/30"
                onLoadedMetadata={(event) => {
                  // MediaRecorder writes no Duration element, so the browser
                  // reports Infinity until it has seen the end. Seeking past
                  // the end forces it to work the duration out.
                  const el = event.currentTarget;
                  if (el.duration !== Infinity) return;
                  const settle = () => {
                    el.currentTime = 0;
                    el.removeEventListener("timeupdate", settle);
                  };
                  el.currentTime = 1e101;
                  el.addEventListener("timeupdate", settle);
                }}
              />
            </div>
          )}
        </div>

        {/* ------------------------------------------------------ controls */}
        <div className="space-y-5 rounded border border-ash/30 p-5">
          <h2 className="text-sm font-semibold text-ink">Source track</h2>

          {loading ? (
            <p className="text-sm text-ash">Loading your library…</p>
          ) : assets.length === 0 ? (
            <div className="rounded border border-dashed border-ash/30 p-4 text-center">
              <p className="text-sm text-ash">No tracks yet.</p>
              <p className="mt-1 text-xs text-ash/70">
                Compose one in{" "}
                <a href="/music" className="text-signal underline-offset-2 hover:underline">
                  Music Studio →
                </a>
              </p>
            </div>
          ) : (
            <div className="max-h-56 space-y-1.5 overflow-y-auto pr-1">
              {assets.map((asset) => {
                const active = asset.id === selectedId;
                return (
                  <button
                    key={asset.id}
                    type="button"
                    onClick={() => {
                      audioRef.current?.pause();
                      setPlaying(false);
                      setSelectedId(asset.id);
                    }}
                    className={`flex w-full items-center justify-between gap-3 rounded border px-3 py-2 text-left transition ${
                      active
                        ? "border-signal/60 bg-signal/10 text-signal"
                        : "border-ash/30 text-ash hover:border-signal hover:text-signal"
                    }`}
                  >
                    <span className="min-w-0 truncate text-xs" title={trackTitle(asset)}>
                      {trackTitle(asset)}
                    </span>
                    <span className="shrink-0 font-mono text-[10px] uppercase opacity-70">
                      {asset.provider ?? "audio"}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          <div className="space-y-2 border-t border-ash/20 pt-4">
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ash">
              Treatment
            </span>
            <div className="space-y-1.5">
              {TREATMENTS.map((option) => {
                const active = option.id === treatment;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setTreatment(option.id)}
                    aria-pressed={active}
                    className={`w-full rounded border px-3 py-2 text-left transition ${
                      active
                        ? "border-signal bg-signal/10"
                        : "border-ash/30 hover:border-signal/60"
                    }`}
                  >
                    <span
                      className={`block text-xs font-semibold ${active ? "text-signal" : "text-ink"}`}
                    >
                      {option.label}
                    </span>
                    <span className="block text-[11px] leading-snug text-ash/80">
                      {option.blurb}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2 border-t border-ash/20 pt-4">
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ash">
              Palette
            </span>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(PALETTES) as PaletteName[]).map((name) => {
                const entry = PALETTES[name];
                const active = name === paletteName;
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => setPaletteName(name)}
                    aria-pressed={active}
                    className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition ${
                      active
                        ? "border-signal text-signal"
                        : "border-ash/40 text-ash hover:border-signal"
                    }`}
                  >
                    <span className="flex" aria-hidden="true">
                      <span
                        className="h-3 w-3 rounded-full border border-black/40"
                        style={{ background: entry.a }}
                      />
                      <span
                        className="-ml-1 h-3 w-3 rounded-full border border-black/40"
                        style={{ background: entry.b }}
                      />
                    </span>
                    {entry.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2 border-t border-ash/20 pt-4">
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ash">
              Format
            </span>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(ASPECTS) as Aspect[]).map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => setAspect(name)}
                  className={`rounded border px-3 py-1 text-xs transition ${
                    aspect === name
                      ? "border-signal text-signal"
                      : "border-ash/40 text-ash hover:border-signal"
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2 border-t border-ash/20 pt-4">
            <label
              htmlFor="pulse-intensity"
              className="font-mono text-[10px] uppercase tracking-[0.16em] text-ash"
            >
              Intensity <span className="text-signal">{Math.round(intensity * 100)}%</span>
            </label>
            <input
              id="pulse-intensity"
              type="range"
              min={20}
              max={100}
              value={Math.round(intensity * 100)}
              onChange={(event) => setIntensity(Number(event.target.value) / 100)}
              className="w-full accent-signal"
            />
          </div>
        </div>
      </section>
    </div>
  );
}
