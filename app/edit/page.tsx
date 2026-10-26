"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { requestLocalAi } from "@/lib/localAiRelay";
import type { MediaAsset } from "@/lib/types";
import DisplaySurface from "../hud/DisplaySurface";

/* ------------------------------------------------------------------ *
 * OmniAI Video Editor — a real multi-track cutter.
 * Every thumbnail, waveform and frame you see is decoded from your own
 * files; the Director (AI) only emits commands this editor can actually
 * execute, and when the relay is offline the house parser takes over —
 * labelled, never pretended.
 * ------------------------------------------------------------------ */

const MEDIA_BUCKET = "media";
const SIGNED_URL_TTL = 3600;
const MAX_IMPORT_BYTES = 400 * 1024 * 1024;
const MAX_EXPORT_SECONDS = 600;
const DEFAULT_PPS = 64;
const SNAP_PX = 7;
const TRANS_DEFAULT = 0.6;
const WAVE_BUCKETS = 480;

const TRACKS = [
  { role: "video", label: "VIDEO", hint: "main cuts" },
  { role: "overlay", label: "OVERLAY", hint: "stills & stickers" },
  { role: "text", label: "TEXT", hint: "titles & captions" },
  { role: "audio", label: "AUDIO", hint: "music & sound" },
] as const;

type TrackRole = (typeof TRACKS)[number]["role"];

type ClipKind = "video" | "image" | "audio" | "text" | "sticker" | "caption";

/** Which track indices each kind may live on. */
const KIND_TRACKS: Record<ClipKind, number[]> = {
  video: [0, 1],
  image: [0, 1],
  sticker: [1],
  text: [2],
  caption: [2],
  audio: [3],
};

const KIND_MEDIA = new Set<ClipKind>(["video", "image", "audio"]);

type AspectId = "16:9" | "9:16" | "1:1";

const ASPECTS: { id: AspectId; label: string; w: number; h: number }[] = [
  { id: "16:9", label: "WIDE", w: 1280, h: 720 },
  { id: "9:16", label: "VERTICAL", w: 720, h: 1280 },
  { id: "1:1", label: "SQUARE", w: 900, h: 900 },
];

type FilterId = "none" | "mono" | "noir" | "vintage" | "vivid" | "cold" | "warm" | "faded" | "cyber";

const FILTERS: { id: FilterId; label: string; hint: string }[] = [
  { id: "none", label: "CLEAN", hint: "no grade" },
  { id: "mono", label: "MONO", hint: "clean grayscale" },
  { id: "noir", label: "NOIR", hint: "grainy night black" },
  { id: "vintage", label: "VINTAGE", hint: "warm faded print" },
  { id: "vivid", label: "VIVID", hint: "punchy colour" },
  { id: "cold", label: "COLD", hint: "steel blue cast" },
  { id: "warm", label: "GOLDEN", hint: "amber cast" },
  { id: "faded", label: "FADED", hint: "lifted & soft" },
  { id: "cyber", label: "CYBER", hint: "rotated neon hue" },
];

type EffectId = "none" | "vignette" | "grain" | "scanlines" | "chroma";

const EFFECTS: { id: EffectId; label: string; hint: string }[] = [
  { id: "none", label: "NONE", hint: "raw picture" },
  { id: "vignette", label: "VIGNETTE", hint: "dark frame edges" },
  { id: "grain", label: "GRAIN", hint: "film noise" },
  { id: "scanlines", label: "SCANLINES", hint: "tube lines" },
  { id: "chroma", label: "CHROMA", hint: "rgb split fringe" },
];

type TransId = "none" | "fade" | "wipe" | "slide" | "zoom" | "flash";

const TRANSITIONS: { id: TransId; label: string; hint: string }[] = [
  { id: "none", label: "HARD CUT", hint: "no blend" },
  { id: "fade", label: "FADE", hint: "cross dissolve" },
  { id: "wipe", label: "WIPE", hint: "left to right" },
  { id: "slide", label: "SLIDE", hint: "push across" },
  { id: "zoom", label: "ZOOM", hint: "scale blend" },
  { id: "flash", label: "FLASH", hint: "white pop" },
];

type AnimId = "none" | "fade" | "slide-up" | "pop";

const ANIMS: AnimId[] = ["none", "fade", "slide-up", "pop"];

type FontId = "deck" | "sans" | "serif";

const FONTS: Record<FontId, string> = {
  deck: "ui-monospace, 'Cascadia Mono', 'Consolas', monospace",
  sans: "'Segoe UI', 'Inter', system-ui, sans-serif",
  serif: "Georgia, 'Times New Roman', serif",
};

const STICKER_GLYPHS = [
  "🔥", "⚡", "💯", "✨", "💜", "🖤", "⭐", "🎵", "🎧", "🎤",
  "👀", "😎", "🙌", "👏", "💪", "🚀", "🌙", "⚡", "💥", "🎯",
  "👑", "🤖", "👾", "🌀", "❄️", "🌊", "🌪️", "❤️", "❌", "✅",
  "⬇️", "➡️", "⬆️", "🔔", "💬", "🕒", "🎬", "📽️", "🔊", "🔇",
];

interface TextPreset {
  id: string;
  label: string;
  text: string;
  size: number;
  font: FontId;
  weight: number;
  color: string;
  x: number;
  y: number;
  align: "left" | "center" | "right";
  bg: boolean;
}

const TEXT_PRESETS: TextPreset[] = [
  { id: "title", label: "TITLE", text: "YOUR TITLE", size: 92, font: "deck", weight: 800, color: "#F4F1FF", x: 0.5, y: 0.42, align: "center", bg: false },
  { id: "sub", label: "SUBTITLE", text: "a line about the scene", size: 46, font: "sans", weight: 600, color: "#E9E4FF", x: 0.5, y: 0.66, align: "center", bg: false },
  { id: "lower", label: "LOWER THIRD", text: "NAME — ROLE", size: 40, font: "sans", weight: 700, color: "#FFFFFF", x: 0.3, y: 0.84, align: "left", bg: true },
  { id: "tag", label: "MONO TAG", text: "// OMNIAI", size: 34, font: "deck", weight: 700, color: "#00F2FE", x: 0.12, y: 0.1, align: "left", bg: false },
  { id: "neon", label: "NEON", text: "ON AIR", size: 78, font: "sans", weight: 900, color: "#FF2A6D", x: 0.5, y: 0.5, align: "center", bg: false },
  { id: "stamp", label: "STAMP", text: "REC ●", size: 40, font: "deck", weight: 700, color: "#FF3B3B", x: 0.86, y: 0.1, align: "right", bg: false },
];

interface LookTemplate {
  id: string;
  label: string;
  blurb: string;
  filter: FilterId;
  effect: EffectId;
  transition: TransId;
  adjust: Partial<Adjust>;
}

const TEMPLATES: LookTemplate[] = [
  { id: "clean", label: "CLEAN SLATE", blurb: "reset every grade, plain cuts", filter: "none", effect: "none", transition: "none", adjust: {} },
  { id: "neon", label: "NEON NIGHT", blurb: "vivid grade + chroma fringe + fades", filter: "vivid", effect: "chroma", transition: "fade", adjust: { contrast: 1.08 } },
  { id: "vhs", label: "VHS TAPE", blurb: "vintage print + scanlines + hard cuts", filter: "vintage", effect: "scanlines", transition: "none", adjust: { saturate: 1.1 } },
  { id: "film", label: "FILM GRAIN", blurb: "faded print + grain + dissolves", filter: "faded", effect: "grain", transition: "fade", adjust: {} },
  { id: "noir", label: "COLD OPEN", blurb: "noir grade + vignette + zoom blends", filter: "noir", effect: "vignette", transition: "zoom", adjust: { contrast: 1.12 } },
];

const SHORTCUTS: { tab: string; rows: [string, string][] }[] = [
  {
    tab: "Timeline",
    rows: [
      ["Split at playhead", "Ctrl B"],
      ["Split mode / select mode", "B / A"],
      ["Delete selection", "Del"],
      ["Duplicate selection", "Ctrl D"],
      ["Undo / redo", "Ctrl Z / Ctrl Y"],
      ["Toggle snapping", "N"],
      ["Zoom in / out", "+ / −"],
      ["Fit timeline", "Shift 1"],
    ],
  },
  {
    tab: "Player",
    rows: [
      ["Play / pause", "Space"],
      ["Shuttle back / forward", "J / L"],
      ["Stop (pause)", "K"],
      ["Go to start / end", "Home / End"],
      ["Trim-in to playhead", "Q"],
      ["Trim-out to playhead", "W"],
      ["Nudge playhead", "← / →"],
      ["Fullscreen preview", "F"],
    ],
  },
  {
    tab: "Director",
    rows: [
      ["Open Director chat", "Ctrl J"],
      ["Send message", "Enter"],
      ["New line in message", "Shift Enter"],
      ["Close overlays", "Esc"],
      ["Toggle shortcuts", "?"],
      ["Import files", "Ctrl I"],
      ["Export film", "Ctrl E"],
      ["Mute master", "M"],
    ],
  },
];

/* ------------------------------- types ------------------------------- */

interface Key {
  t: number;
  x?: number;
  y?: number;
  scale?: number;
  opacity?: number;
}

interface Adjust {
  brightness: number;
  contrast: number;
  saturate: number;
  temperature: number;
}

interface Clip {
  id: string;
  kind: ClipKind;
  track: number;
  start: number;
  duration: number;
  srcIn: number;
  url?: string;
  name?: string;
  mime?: string;
  text?: string;
  x?: number;
  y?: number;
  scale?: number;
  rotate?: number;
  opacity?: number;
  fontSize?: number;
  color?: string;
  font?: FontId;
  weight?: number;
  align?: "left" | "center" | "right";
  bg?: boolean;
  volume?: number;
  muted?: boolean;
  fit?: "cover" | "contain";
  filter?: FilterId;
  effect?: EffectId;
  adjust?: Adjust;
  inAnim?: AnimId;
  outAnim?: AnimId;
  keys?: Key[];
}

interface Transition {
  after: string;
  type: TransId;
  duration: number;
}

interface Project {
  name: string;
  ratio: AspectId;
  clips: Clip[];
  transitions: Transition[];
}

interface BinItem {
  id: string;
  name: string;
  url: string;
  mime: string;
  kind: "video" | "image" | "audio";
}

interface LogEntry {
  id: string;
  from: "user" | "ai" | "house" | "system";
  text: string;
}

interface ExportResult {
  url: string;
  name: string;
  mime: string;
  bytes: number;
}

/* ------------------------------- helpers ------------------------------- */

let uidCounter = 0;
function uid(prefix: string): string {
  uidCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${uidCounter}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function lerp(a: number, b: number, p: number): number {
  return a + (b - a) * p;
}

function easeInOut(p: number): number {
  return p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
}

function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

function formatTc(seconds: number): string {
  const s = Math.max(0, seconds);
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  const cs = Math.floor((s % 1) * 100);
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}

function errorText(value: unknown, fallback: string): string {
  if (value instanceof Error && value.message) return value.message;
  if (typeof value === "string" && value.trim()) return value;
  return fallback;
}

function kindFromMime(mime: string): "video" | "image" | "audio" {
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("image/")) return "image";
  return "audio";
}

function aspectOf(id: AspectId): { w: number; h: number } {
  return ASPECTS.find((a) => a.id === id) ?? ASPECTS[0];
}

function projectDuration(project: Project): number {
  let end = 0;
  for (const clip of project.clips) end = Math.max(end, clip.start + clip.duration);
  return end;
}

function selectedClip(project: Project, id: string | null): Clip | null {
  if (!id) return null;
  return project.clips.find((clip) => clip.id === id) ?? null;
}

function buildFilter(clip: Clip): string {
  const preset = FILTERS.find((f) => f.id === (clip.filter ?? "none"));
  const parts: string[] = [];
  if (preset && preset.id !== "none") {
    switch (preset.id) {
      case "mono":
        parts.push("grayscale(1)", "contrast(1.05)");
        break;
      case "noir":
        parts.push("grayscale(1)", "contrast(1.4)", "brightness(0.92)");
        break;
      case "vintage":
        parts.push("sepia(0.5)", "contrast(1.08)", "saturate(0.85)");
        break;
      case "vivid":
        parts.push("saturate(1.65)", "contrast(1.08)");
        break;
      case "cold":
        parts.push("saturate(1.1)", "hue-rotate(-14deg)", "brightness(1.03)");
        break;
      case "warm":
        parts.push("sepia(0.22)", "saturate(1.3)", "brightness(1.03)");
        break;
      case "faded":
        parts.push("contrast(0.82)", "brightness(1.12)", "saturate(0.8)");
        break;
      case "cyber":
        parts.push("hue-rotate(85deg)", "saturate(1.4)");
        break;
      default:
        break;
    }
  }
  const adjust = clip.adjust;
  if (adjust) {
    if (adjust.brightness !== 1) parts.push(`brightness(${adjust.brightness.toFixed(3)})`);
    if (adjust.contrast !== 1) parts.push(`contrast(${adjust.contrast.toFixed(3)})`);
    if (adjust.saturate !== 1) parts.push(`saturate(${adjust.saturate.toFixed(3)})`);
  }
  return parts.length ? parts.join(" ") : "none";
}

function defaultAdjust(): Adjust {
  return { brightness: 1, contrast: 1, saturate: 1, temperature: 0 };
}

function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "timeline"
  );
}

/* ------------------------------------------------------------------ *
 * Waveform — decoded from the real bytes, never invented.
 * ------------------------------------------------------------------ */

async function loadPeaks(url: string): Promise<{ peaks: Float32Array; duration: number }> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not read the audio file (HTTP ${response.status}).`);
  const raw = await response.arrayBuffer();

  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) throw new Error("This browser has no Web Audio support.");

  const ac = new Ctor();
  try {
    const buffer = await ac.decodeAudioData(raw);
    const data = buffer.getChannelData(0);
    const step = Math.max(1, Math.floor(data.length / WAVE_BUCKETS));
    const stride = Math.max(1, Math.floor(step / 64));
    const peaks = new Float32Array(WAVE_BUCKETS);

    for (let b = 0; b < WAVE_BUCKETS; b += 1) {
      const from = b * step;
      const to = Math.min(data.length, from + step);
      let peak = 0;
      for (let i = from; i < to; i += stride) {
        const v = Math.abs(data[i]);
        if (v > peak) peak = v;
      }
      peaks[b] = peak;
    }

    return { peaks, duration: buffer.duration };
  } finally {
    void ac.close();
  }
}

function drawClipWave(canvas: HTMLCanvasElement, peaks: Float32Array, hot: string, dim: string) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = Math.max(1, Math.round((canvas.clientWidth || 1) * dpr));
  const h = Math.max(1, Math.round((canvas.clientHeight || 1) * dpr));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, w, h);

  const mid = h / 2;
  const bw = Math.max(1, w / peaks.length - dpr * 0.6);
  ctx.fillStyle = dim;
  ctx.fillRect(0, mid - dpr * 0.5, w, dpr);

  for (let i = 0; i < peaks.length; i += 1) {
    const x = (i / peaks.length) * w;
    const amp = Math.max(dpr, peaks[i] * (h * 0.44));
    ctx.fillStyle = peaks[i] > 0.55 ? hot : dim;
    ctx.fillRect(x, mid - amp, bw, amp * 2);
  }
}

/* ------------------------------------------------------------------ *
 * Grain / scanline patterns (built once, reused by every frame).
 * ------------------------------------------------------------------ */

let noisePattern: CanvasPattern | null = null;
let scanPattern: CanvasPattern | null = null;

function getNoisePattern(ctx: CanvasRenderingContext2D): CanvasPattern | null {
  if (noisePattern) return noisePattern;
  const tile = document.createElement("canvas");
  tile.width = 96;
  tile.height = 96;
  const tctx = tile.getContext("2d");
  if (!tctx) return null;
  const img = tctx.createImageData(96, 96);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 110 + Math.floor(Math.random() * 145);
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = Math.random() > 0.5 ? 46 : 18;
  }
  tctx.putImageData(img, 0, 0);
  noisePattern = ctx.createPattern(tile, "repeat");
  return noisePattern;
}

function getScanPattern(ctx: CanvasRenderingContext2D): CanvasPattern | null {
  if (scanPattern) return scanPattern;
  const tile = document.createElement("canvas");
  tile.width = 4;
  tile.height = 4;
  const tctx = tile.getContext("2d");
  if (!tctx) return null;
  tctx.fillStyle = "rgba(0,0,0,0.34)";
  tctx.fillRect(0, 0, 4, 2);
  scanPattern = ctx.createPattern(tile, "repeat");
  return scanPattern;
}

/* ------------------------------------------------------------------ *
 * Frame rendering — composites the whole timeline at time t.
 * ------------------------------------------------------------------ */

function drawMediaFit(
  ctx: CanvasRenderingContext2D,
  el: HTMLVideoElement | HTMLImageElement,
  W: number,
  H: number,
  fit: "cover" | "contain",
) {
  const ew = "videoWidth" in el ? el.videoWidth : (el as HTMLImageElement).naturalWidth;
  const eh = "videoHeight" in el ? el.videoHeight : (el as HTMLImageElement).naturalHeight;
  if (!ew || !eh) return;
  const scale = fit === "contain" ? Math.min(W / ew, H / eh) : Math.max(W / ew, H / eh);
  const dw = ew * scale;
  const dh = eh * scale;
  ctx.drawImage(el, (W - dw) / 2, (H - dh) / 2, dw, dh);
}

function drawTint(ctx: CanvasRenderingContext2D, W: number, H: number, temperature: number) {
  if (!temperature) return;
  ctx.save();
  ctx.globalCompositeOperation = "soft-light";
  if (temperature > 0) {
    ctx.fillStyle = `rgba(255,158,72,${(temperature * 0.55).toFixed(3)})`;
  } else {
    ctx.fillStyle = `rgba(70,150,255,${(-temperature * 0.55).toFixed(3)})`;
  }
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

function drawEffect(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  effect: EffectId,
  phase: number,
) {
  if (effect === "none") return;
  ctx.save();
  if (effect === "vignette") {
    const grad = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.32, W / 2, H / 2, Math.max(W, H) * 0.75);
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(1, "rgba(0,0,0,0.62)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  } else if (effect === "grain") {
    const pattern = getNoisePattern(ctx);
    if (pattern) {
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = pattern;
      const ox = Math.floor(phase * 37) % 96;
      const oy = Math.floor(phase * 53) % 96;
      ctx.translate(-ox, -oy);
      ctx.fillRect(0, 0, W + 96, H + 96);
    }
  } else if (effect === "scanlines") {
    const pattern = getScanPattern(ctx);
    if (pattern) {
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = pattern;
      ctx.fillRect(0, 0, W, H);
    }
  } else if (effect === "chroma") {
    const shift = Math.max(2, Math.round(W * 0.004));
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.24;
    ctx.filter = "hue-rotate(90deg)";
    ctx.drawImage(ctx.canvas, -shift, 0);
    ctx.filter = "hue-rotate(-90deg)";
    ctx.drawImage(ctx.canvas, shift, 0);
    ctx.filter = "none";
  }
  ctx.restore();
}

interface EvalFrame {
  x: number;
  y: number;
  scale: number;
  opacity: number;
}

function evalKeys(clip: Clip, tRel: number): EvalFrame {
  const base: EvalFrame = {
    x: clip.x ?? 0.5,
    y: clip.y ?? 0.5,
    scale: clip.scale ?? 1,
    opacity: clip.opacity ?? 1,
  };
  const keys = clip.keys;
  if (!keys || keys.length === 0) return base;

  const sorted = [...keys].sort((a, b) => a.t - b.t);
  let prev: Key | null = null;
  let next: Key | null = null;
  for (const key of sorted) {
    if (key.t <= tRel) prev = key;
    if (key.t >= tRel && !next) next = key;
  }
  if (!prev && next) {
    return {
      x: next.x ?? base.x,
      y: next.y ?? base.y,
      scale: next.scale ?? base.scale,
      opacity: next.opacity ?? base.opacity,
    };
  }
  if (prev && !next) {
    return {
      x: prev.x ?? base.x,
      y: prev.y ?? base.y,
      scale: prev.scale ?? base.scale,
      opacity: prev.opacity ?? base.opacity,
    };
  }
  if (prev && next) {
    const span = Math.max(0.0001, next.t - prev.t);
    const p = easeInOut(clamp((tRel - prev.t) / span, 0, 1));
    return {
      x: lerp(prev.x ?? base.x, next.x ?? base.x, p),
      y: lerp(prev.y ?? base.y, next.y ?? base.y, p),
      scale: lerp(prev.scale ?? base.scale, next.scale ?? base.scale, p),
      opacity: lerp(prev.opacity ?? base.opacity, next.opacity ?? base.opacity, p),
    };
  }
  return base;
}

function animEnvelope(clip: Clip, tRel: number): { alpha: number; dy: number; pop: number } {
  const IN = 0.45;
  const OUT = 0.4;
  let alpha = 1;
  let dy = 0;
  let pop = 1;

  const inAnim = clip.inAnim ?? "fade";
  if (tRel < IN && inAnim !== "none") {
    const p = clamp(tRel / IN, 0, 1);
    if (inAnim === "fade") alpha *= p;
    if (inAnim === "slide-up") {
      alpha *= p;
      dy = (1 - p) * 46;
    }
    if (inAnim === "pop") pop = 0.5 + 0.5 * easeInOut(p) + Math.sin(p * Math.PI) * 0.12;
  }
  const outAnim = clip.outAnim ?? "fade";
  const left = clip.duration - tRel;
  if (left < OUT && outAnim !== "none") {
    const p = clamp(left / OUT, 0, 1);
    if (outAnim === "fade") alpha *= p;
    if (outAnim === "slide-up") {
      alpha *= p;
      dy = -(1 - p) * 32;
    }
    if (outAnim === "pop") pop *= 0.6 + 0.4 * p;
  }
  return { alpha, dy, pop };
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const out: string[] = [];
  for (const rawLine of text.split("\n")) {
    const words = rawLine.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      out.push("");
      continue;
    }
    let line = words[0];
    for (let i = 1; i < words.length; i += 1) {
      const probe = `${line} ${words[i]}`;
      if (ctx.measureText(probe).width > maxWidth) {
        out.push(line);
        line = words[i];
      } else {
        line = probe;
      }
    }
    out.push(line);
  }
  return out;
}

function drawTextClip(
  ctx: CanvasRenderingContext2D,
  clip: Clip,
  W: number,
  H: number,
  tRel: number,
  captionStyle: boolean,
) {
  const frame = evalKeys(clip, tRel);
  const env = animEnvelope(clip, tRel);
  const alpha = clamp(frame.opacity * env.alpha, 0, 1);
  if (alpha <= 0.004) return;

  const unit = H / 720;
  const size = Math.max(8, (clip.fontSize ?? (captionStyle ? 34 : 56)) * unit * frame.scale * env.pop);
  const font = clip.font ?? "sans";
  const weight = clip.weight ?? 700;
  const isCaption = captionStyle || clip.kind === "caption";

  const anchorX = isCaption ? W / 2 : (clip.x ?? frame.x) * W;
  const anchorY = (isCaption ? (clip.y ?? 0.9) : frame.y) * H + env.dy;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = `${weight} ${Math.round(size)}px ${FONTS[font]}`;
  ctx.textBaseline = "middle";

  const align = isCaption ? "center" : (clip.align ?? "center");
  ctx.textAlign = align;
  const maxW = W * 0.86;
  const lines = wrapLines(ctx, clip.text || " ", maxW);
  const lineH = size * 1.24;
  const blockTop = anchorY - ((lines.length - 1) * lineH) / 2;
  const color = clip.color ?? (isCaption ? "#FFFFFF" : "#F4F1FF");

  if (clip.bg || isCaption) {
    ctx.font = `${weight} ${Math.round(size)}px ${FONTS[font]}`;
    let widest = 0;
    for (const line of lines) widest = Math.max(widest, ctx.measureText(line).width);
    const padX = size * 0.44;
    const padY = size * 0.34;
    const bw = widest + padX * 2;
    const bh = lines.length * lineH + padY * 2;
    const bx =
      align === "center" ? anchorX - bw / 2 : align === "right" ? anchorX - bw : anchorX - padX;
    ctx.fillStyle = isCaption ? "rgba(6,5,12,0.66)" : "rgba(6,5,12,0.58)";
    ctx.beginPath();
    const r = isCaption ? size * 0.28 : 6;
    ctx.roundRect(bx, blockTop - lineH / 2 - padY, bw, bh, r);
    ctx.fill();
  }

  ctx.lineJoin = "round";
  if (!isCaption) {
    ctx.lineWidth = Math.max(2, size * 0.055);
    ctx.strokeStyle = "rgba(4,3,10,0.82)";
  } else {
    ctx.lineWidth = Math.max(1.5, size * 0.05);
    ctx.strokeStyle = "rgba(4,3,10,0.75)";
  }

  for (let i = 0; i < lines.length; i += 1) {
    const y = blockTop + i * lineH;
    ctx.strokeText(lines[i], anchorX, y);
    ctx.fillStyle = color;
    ctx.fillText(lines[i], anchorX, y);
  }
  ctx.restore();
}

function drawStickerClip(
  ctx: CanvasRenderingContext2D,
  clip: Clip,
  W: number,
  H: number,
  tRel: number,
) {
  const frame = evalKeys(clip, tRel);
  const env = animEnvelope(clip, tRel);
  const alpha = clamp(frame.opacity * env.alpha, 0, 1);
  if (alpha <= 0.004) return;
  const unit = H / 720;
  const size = Math.max(12, (clip.fontSize ?? 110) * unit * frame.scale * env.pop);

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = `${Math.round(size)}px 'Segoe UI Emoji', 'Apple Color Emoji', sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  if (clip.rotate) {
    ctx.translate((clip.x ?? frame.x) * W, (clip.y ?? frame.y) * H + env.dy);
    ctx.rotate((clip.rotate * Math.PI) / 180);
    ctx.fillText(clip.text || "✨", 0, 0);
  } else {
    ctx.fillText(clip.text || "✨", (clip.x ?? frame.x) * W, (clip.y ?? frame.y) * H + env.dy);
  }
  ctx.restore();
}

/** A transition registered between clip A and the clip that starts where A ends. */
function transitionFor(project: Project, clipId: string): Transition | null {
  return project.transitions.find((entry) => entry.after === clipId) ?? null;
}

function renderFrame(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  t: number,
  project: Project,
  getEl: (clip: Clip) => HTMLVideoElement | HTMLImageElement | null,
  guides: { selectedId: string | null; show: boolean },
) {
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.filter = "none";
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "#05040A";
  ctx.fillRect(0, 0, W, H);

  const byTrack = (track: number) =>
    project.clips
      .filter((clip) => clip.track === track)
      .sort((a, b) => a.start - b.start);

  /* --- media tracks: 0 (video) then 1 (overlay) --- */
  for (const track of [0, 1]) {
    const clips = byTrack(track);
    for (const clip of clips) {
      if (t < clip.start || t >= clip.start + clip.duration) continue;
      const el = getEl(clip);
      if (!el) continue;
      if (clip.kind === "video" && (el as HTMLVideoElement).readyState < 2) continue;

      const trans = transitionFor(project, clip.id);
      const next = clips.find((c) => c.start >= clip.start + clip.duration - 0.001 && c.id !== clip.id);
      const inWindow =
        trans && trans.type !== "none" && next
          ? { trans, next, from: next.start - trans.duration }
          : null;

      const drawSelf = (alpha: number, time: number) => {
        const local = time - clip.start;
        if (local < 0 || local >= clip.duration) return;
        ctx.save();
        ctx.globalAlpha = alpha * (clip.opacity ?? 1);
        ctx.filter = buildFilter(clip);
        drawMediaFit(ctx, el, W, H, clip.fit ?? "cover");
        ctx.filter = "none";
        ctx.restore();
        const adjust = clip.adjust;
        if (adjust && adjust.temperature !== 0 && alpha > 0.98) {
          drawTint(ctx, W, H, adjust.temperature);
        }
        if ((clip.effect ?? "none") !== "none" && alpha > 0.98) {
          drawEffect(ctx, W, H, clip.effect ?? "none", t);
        }
      };

      if (inWindow && t >= inWindow.from) {
        const { trans: tr, next: nextClip } = inWindow;
        const p = clamp((t - inWindow.from) / Math.max(0.05, tr.duration), 0, 1);
        const nextEl = getEl(nextClip);
        const nextReady =
          nextEl && (nextClip.kind !== "video" || (nextEl as HTMLVideoElement).readyState >= 2);
        const nextTime = nextClip.start + (t - inWindow.from);
        const drawNext = (alpha: number) => {
          if (!nextEl || !nextReady) return;
          ctx.save();
          ctx.globalAlpha = alpha * (nextClip.opacity ?? 1);
          ctx.filter = buildFilter(nextClip);
          drawMediaFit(ctx, nextEl, W, H, nextClip.fit ?? "cover");
          ctx.filter = "none";
          ctx.restore();
        };

        if (tr.type === "fade") {
          drawSelf(1, t);
          drawNext(p);
        } else if (tr.type === "wipe") {
          drawSelf(1, t);
          ctx.save();
          ctx.beginPath();
          ctx.rect(0, 0, W * p, H);
          ctx.clip();
          drawNext(1);
          ctx.restore();
        } else if (tr.type === "slide") {
          ctx.save();
          ctx.translate(-W * p, 0);
          drawSelf(1, t);
          ctx.restore();
          ctx.save();
          ctx.translate(W * (1 - p), 0);
          drawNext(1);
          ctx.restore();
        } else if (tr.type === "zoom") {
          ctx.save();
          const s = 1 + p * 0.16;
          ctx.translate(W / 2, H / 2);
          ctx.scale(s, s);
          ctx.translate(-W / 2, -H / 2);
          drawSelf(1 - p, t);
          ctx.restore();
          ctx.save();
          const s2 = 1.18 - p * 0.18;
          ctx.translate(W / 2, H / 2);
          ctx.scale(s2, s2);
          ctx.translate(-W / 2, -H / 2);
          drawNext(p);
          ctx.restore();
        } else if (tr.type === "flash") {
          drawSelf(1, t);
          ctx.save();
          ctx.globalAlpha = Math.sin(p * Math.PI);
          ctx.fillStyle = "#FFFFFF";
          ctx.fillRect(0, 0, W, H);
          ctx.restore();
          drawNext(p);
        } else {
          if (p < 1) drawSelf(1, t);
          else drawNext(1);
        }

        if (p >= 1 && nextClip) {
          const nextTrans = transitionFor(project, nextClip.id);
          if (!nextTrans || nextTrans.type === "none") drawNext(1);
          if ((nextClip.effect ?? "none") !== "none") {
            drawEffect(ctx, W, H, nextClip.effect ?? "none", t);
          }
        }
        void nextTime;
      } else if (!trans || trans.type === "none" || !next) {
        drawSelf(1, t);
      } else if (t < (next ? next.start - trans.duration : Infinity)) {
        drawSelf(1, t);
      }
    }
  }

  /* --- text track (titles, stickers, captions) --- */
  for (const clip of byTrack(2)) {
    if (t < clip.start || t >= clip.start + clip.duration) continue;
    const tRel = t - clip.start;
    if (clip.kind === "sticker") drawStickerClip(ctx, clip, W, H, tRel);
    else drawTextClip(ctx, clip, W, H, tRel, clip.kind === "caption");
  }

  /* --- selection outline (preview only, never recorded) --- */
  if (guides.show && guides.selectedId) {
    const clip = project.clips.find((c) => c.id === guides.selectedId);
    if (clip && (clip.track === 1 || clip.track === 2) && t >= clip.start && t < clip.start + clip.duration) {
      const tRel = t - clip.start;
      const frame = evalKeys(clip, tRel);
      ctx.save();
      ctx.strokeStyle = "rgba(0,242,254,0.9)";
      ctx.setLineDash([8, 6]);
      ctx.lineWidth = 2;
      const bw = clip.track === 2 && clip.kind !== "sticker" ? W * 0.8 : W * 0.34;
      const bh = clip.kind === "sticker" ? Math.min(W, H) * 0.24 : (clip.track === 2 ? H * 0.14 : H * 0.3);
      ctx.strokeRect(frame.x * W - bw / 2, frame.y * H - bh / 2 + (clip.track === 2 && clip.kind !== "sticker" ? 0 : 0), bw, bh);
      ctx.restore();
    }
  }

  ctx.restore();
}

/* ------------------------------------------------------------------ *
 * Director — AI command protocol. The model never touches the DOM; it
 * only returns commands this editor knows how to run.
 * ------------------------------------------------------------------ */

type Cmd =
  | { op: "split"; at?: number }
  | { op: "delete"; target: "selected" | "all" }
  | { op: "duplicate" }
  | { op: "seek"; to: number }
  | { op: "play" }
  | { op: "pause" }
  | { op: "undo" }
  | { op: "ratio"; value: AspectId }
  | { op: "volume"; value: number; target: "selected" | "all-audio" }
  | { op: "mute"; target: "selected" | "all-audio"; value: boolean }
  | { op: "filter"; value: FilterId; target: "selected" | "all" }
  | { op: "effect"; value: EffectId; target: "selected" | "all" }
  | { op: "adjust"; brightness?: number; contrast?: number; saturate?: number; temperature?: number; target: "selected" | "all" }
  | { op: "transition"; value: TransId; target: "selected" | "all-cuts"; duration?: number }
  | { op: "text"; text: string; at?: number; duration?: number; where?: "center" | "top" | "bottom"; kind?: "text" | "caption" }
  | { op: "sticker"; glyph: string; at?: number; duration?: number }
  | { op: "zoom"; value: number }
  | { op: "template"; value: string };

const FILTER_IDS = FILTERS.map((f) => f.id) as string[];
const EFFECT_IDS = EFFECTS.map((f) => f.id) as string[];
const TRANS_IDS = TRANSITIONS.map((t) => t.id) as string[];
const ASPECT_IDS = ASPECTS.map((a) => a.id) as string[];

function asEnum<T extends string>(value: unknown, allowed: string[], fallback: T): T {
  return typeof value === "string" && allowed.includes(value) ? (value as T) : fallback;
}

function asNumber(value: unknown, fallback: number, min: number, max: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return clamp(n, min, max);
}

function asTarget(value: unknown, allowed: string[], fallback: string): string {
  return typeof value === "string" && allowed.includes(value) ? value : fallback;
}

/** Strictly validate whatever the model returned — garbage in, dropped out. */
function coerceCommands(replyRaw: unknown, commandsRaw: unknown): { reply: string; commands: Cmd[] } {
  const reply =
    typeof replyRaw === "string" && replyRaw.trim()
      ? replyRaw.trim().slice(0, 600)
      : "On it.";
  const commands: Cmd[] = [];
  if (!Array.isArray(commandsRaw)) return { reply, commands };

  for (const raw of commandsRaw.slice(0, 8)) {
    if (!raw || typeof raw !== "object") continue;
    const op = (raw as { op?: unknown }).op;
    if (typeof op !== "string") continue;
    const r = raw as Record<string, unknown>;
    switch (op) {
      case "split":
        commands.push({ op: "split", at: r.at === undefined ? undefined : asNumber(r.at, 0, 0, 1e6) });
        break;
      case "delete":
        commands.push({ op: "delete", target: asTarget(r.target, ["selected", "all"], "selected") as "selected" | "all" });
        break;
      case "duplicate":
      case "play":
      case "pause":
      case "undo":
        commands.push({ op } as Cmd);
        break;
      case "seek":
        commands.push({ op: "seek", to: asNumber(r.to, 0, 0, 1e6) });
        break;
      case "ratio":
        commands.push({ op: "ratio", value: asEnum<AspectId>(r.value, ASPECT_IDS, "16:9") });
        break;
      case "volume":
        commands.push({
          op: "volume",
          value: asNumber(r.value, 1, 0, 1),
          target: asTarget(r.target, ["selected", "all-audio"], "selected") as "selected" | "all-audio",
        });
        break;
      case "mute":
        commands.push({
          op: "mute",
          target: asTarget(r.target, ["selected", "all-audio"], "all-audio") as "selected" | "all-audio",
          value: r.value === undefined ? true : Boolean(r.value),
        });
        break;
      case "filter":
        commands.push({
          op: "filter",
          value: asEnum<FilterId>(r.value, FILTER_IDS, "none"),
          target: asTarget(r.target, ["selected", "all"], "all") as "selected" | "all",
        });
        break;
      case "effect":
        commands.push({
          op: "effect",
          value: asEnum<EffectId>(r.value, EFFECT_IDS, "none"),
          target: asTarget(r.target, ["selected", "all"], "all") as "selected" | "all",
        });
        break;
      case "adjust":
        commands.push({
          op: "adjust",
          brightness: r.brightness === undefined ? undefined : asNumber(r.brightness, 1, 0.3, 2.2),
          contrast: r.contrast === undefined ? undefined : asNumber(r.contrast, 1, 0.3, 2.2),
          saturate: r.saturate === undefined ? undefined : asNumber(r.saturate, 1, 0, 2.6),
          temperature: r.temperature === undefined ? undefined : asNumber(r.temperature, 0, -1, 1),
          target: asTarget(r.target, ["selected", "all"], "selected") as "selected" | "all",
        });
        break;
      case "transition":
        commands.push({
          op: "transition",
          value: asEnum<TransId>(r.value, TRANS_IDS, "fade"),
          target: asTarget(r.target, ["selected", "all-cuts"], "all-cuts") as "selected" | "all-cuts",
          duration: r.duration === undefined ? undefined : asNumber(r.duration, TRANS_DEFAULT, 0.2, 2.5),
        });
        break;
      case "text": {
        const text = typeof r.text === "string" ? r.text.trim().slice(0, 300) : "";
        if (text) {
          commands.push({
            op: "text",
            text,
            at: r.at === undefined ? undefined : asNumber(r.at, 0, 0, 1e6),
            duration: r.duration === undefined ? undefined : asNumber(r.duration, 3, 0.5, 60),
            where: asEnum<"center" | "top" | "bottom">(r.where, ["center", "top", "bottom"], "center"),
            kind: r.kind === "caption" ? "caption" : "text",
          });
        }
        break;
      }
      case "sticker": {
        const glyph = typeof r.glyph === "string" && r.glyph.trim() ? r.glyph.trim().slice(0, 4) : "✨";
        commands.push({
          op: "sticker",
          glyph,
          at: r.at === undefined ? undefined : asNumber(r.at, 0, 0, 1e6),
          duration: r.duration === undefined ? undefined : asNumber(r.duration, 3, 0.5, 60),
        });
        break;
      }
      case "zoom":
        commands.push({ op: "zoom", value: asNumber(r.value, DEFAULT_PPS, 8, 400) });
        break;
      case "template":
        commands.push({ op: "template", value: asEnum(r.value, TEMPLATES.map((t) => t.id), "clean") });
        break;
      default:
        break;
    }
  }
  return { reply, commands };
}

function extractJson(raw: string): unknown {
  const start = raw.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < raw.length; i += 1) {
    const ch = raw[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === "\\") {
      escape = true;
      continue;
    }
    if (ch === '"') inString = !inString;
    if (inString) continue;
    if (ch === "{") depth += 1;
    if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        try {
          return JSON.parse(raw.slice(start, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

function timelineSummary(project: Project, playhead: number, selectedId: string | null): string {
  const lines: string[] = [];
  lines.push(`project "${project.name}" ratio ${project.ratio} duration ${projectDuration(project).toFixed(1)}s playhead ${playhead.toFixed(1)}s selected ${selectedId ?? "none"}`);
  for (const clip of [...project.clips].sort((a, b) => a.start - b.start).slice(0, 24)) {
    const meta = clip.kind === "text" || clip.kind === "caption"
      ? `"${(clip.text ?? "").slice(0, 40)}"`
      : (clip.name ?? clip.kind);
    lines.push(
      `#${clip.id} ${clip.kind} track ${clip.track} ${clip.start.toFixed(1)}→${(clip.start + clip.duration).toFixed(1)}s ${meta}` +
        (clip.filter && clip.filter !== "none" ? ` filter:${clip.filter}` : ""),
    );
  }
  if (project.transitions.length) {
    lines.push(`transitions: ${project.transitions.map((t) => `${t.after}=${t.type}`).join(", ")}`);
  }
  return lines.join("\n");
}

function directorSystem(context: string): string {
  return `You are the Director inside the OmniAI Video Editor — a real multi-track timeline in the browser.
You cannot see the screen; act only on the context below. Answer briefly, then emit commands.

STRICT OUTPUT: raw JSON only, no markdown fences:
{"reply":"one or two sentences","commands":[{"op":"..."}]}

OPS (only these; numbers are seconds unless said otherwise):
- {"op":"split","at":SEC?} cut every clip crossing the playhead/at time (default: playhead)
- {"op":"delete","target":"selected"|"all"} remove clips
- {"op":"duplicate"} copy the selection right after itself
- {"op":"seek","to":SEC} {"op":"play"} {"op":"pause"} {"op":"undo"}
- {"op":"ratio","value":"16:9"|"9:16"|"1:1"}
- {"op":"volume","value":0..1,"target":"selected"|"all-audio"} {"op":"mute","target":"selected"|"all-audio","value":true|false}
- {"op":"filter","value":"none|mono|noir|vintage|vivid|cold|warm|faded|cyber","target":"selected"|"all"}
- {"op":"effect","value":"none|vignette|grain|scanlines|chroma","target":"selected"|"all"}
- {"op":"adjust","brightness":0.3..2.2,"contrast":0.3..2.2,"saturate":0..2.6,"temperature":-1..1,"target":"selected"|"all"}
- {"op":"transition","value":"none|fade|wipe|slide|zoom|flash","target":"selected"|"all-cuts","duration":0.2..2.5}
- {"op":"text","text":"...","at":SEC?,"duration":SEC?,"where":"center|top|bottom","kind":"text"|"caption"}
- {"op":"sticker","glyph":"🔥","at":SEC?,"duration":SEC?}
- {"op":"zoom","value":8..400} timeline px per second
- {"op":"template","value":"clean|neon|vhs|film|noir"} apply a look across the timeline

RULES: never invent clip ids or ops. If asked for something impossible, reply honestly instead of faking it.
CONTEXT:\n${context}`;
}

/* The offline fallback — keyword parsing, honestly labelled "house rules". */
function houseCommand(text: string, playhead: number): { reply: string; commands: Cmd[] } {
  const q = text.toLowerCase();
  const commands: Cmd[] = [];
  let reply = "";

  const ratioMatch = q.match(/1\s*:\s*1|square/);
  const vertical = q.match(/9\s*:\s*16|vertical|portrait|tiktok|reels?/);
  const wide = q.match(/16\s*:\s*9|widescreen|landscape/);
  if (ratioMatch) {
    commands.push({ op: "ratio", value: "1:1" });
    reply = "Switching the canvas to 1:1.";
  } else if (vertical) {
    commands.push({ op: "ratio", value: "9:16" });
    reply = "Switching the canvas to vertical 9:16.";
  } else if (wide) {
    commands.push({ op: "ratio", value: "16:9" });
    reply = "Switching the canvas back to 16:9.";
  } else if (/(split|cut) (it |at |everything|the playhead|here)|chop/.test(q)) {
    commands.push({ op: "split" });
    reply = "Splitting every clip at the playhead.";
  } else if (/delete|remove|trash/.test(q)) {
    commands.push({ op: "delete", target: "selected" });
    reply = "Deleting the selection.";
  } else if (/undo/.test(q)) {
    commands.push({ op: "undo" });
    reply = "Undoing the last action.";
  } else if (/fade|dissolve/.test(q)) {
    commands.push({ op: "transition", value: "fade", target: "all-cuts" });
    reply = "Adding crossfades at every cut.";
  } else if (/wipe/.test(q)) {
    commands.push({ op: "transition", value: "wipe", target: "all-cuts" });
    reply = "Adding wipes at every cut.";
  } else if (/slide|push/.test(q)) {
    commands.push({ op: "transition", value: "slide", target: "all-cuts" });
    reply = "Adding slide pushes at every cut.";
  } else if (/grain/.test(q)) {
    commands.push({ op: "effect", value: "grain", target: "all" });
    reply = "Film grain across the whole timeline.";
  } else if (/scanline|vhs|crt/.test(q)) {
    commands.push({ op: "effect", value: "scanlines", target: "all" });
    if (!/filter|grade|look/.test(q)) commands.push({ op: "filter", value: "vintage", target: "all" });
    reply = "VHS treatment: scanlines (plus a vintage grade).";
  } else if (/mono|black and white|b&w|greyscale|grayscale/.test(q)) {
    commands.push({ op: "filter", value: "mono", target: "all" });
    reply = "Grayscale grade across every clip.";
  } else if (/noir/.test(q)) {
    commands.push({ op: "filter", value: "noir", target: "all" });
    commands.push({ op: "effect", value: "vignette", target: "all" });
    reply = "Noir grade with vignette.";
  } else if (/neon|vivid|punch/.test(q)) {
    commands.push({ op: "template", value: "neon" });
    reply = "Applying the Neon Night look.";
  } else if (/mute/.test(q)) {
    commands.push({ op: "mute", target: "all-audio", value: true });
    reply = "Muting every audio clip.";
  } else if (/unmute/.test(q)) {
    commands.push({ op: "mute", target: "all-audio", value: false });
    reply = "Unmuting every audio clip.";
  } else if (/louder|volume up|raise the (volume|audio)/.test(q)) {
    commands.push({ op: "volume", value: 1, target: "all-audio" });
    reply = "Audio clips to full volume.";
  } else if (/quieter|volume down|lower the (volume|audio)/.test(q)) {
    commands.push({ op: "volume", value: 0.4, target: "all-audio" });
    reply = "Dropping audio clips to 40%.";
  } else if (/play/.test(q)) {
    commands.push({ op: "play" });
    reply = "Playing.";
  } else if (/pause|stop/.test(q)) {
    commands.push({ op: "pause" });
    reply = "Pausing.";
  } else if (/start|beginning|home/.test(q)) {
    commands.push({ op: "seek", to: 0 });
    reply = "Back to the start.";
  } else if (/(add|put|insert).*(text|title|caption)|caption/.test(q)) {
    const said = text.replace(/^(add|insert|put)\s+(a\s+)?(text|title|caption)\s*(:|saying|that says)?\s*/i, "").trim();
    const body = said || "YOUR TEXT";
    const isCap = /caption/.test(q);
    commands.push({
      op: "text",
      text: body.slice(0, 160),
      at: playhead,
      duration: 3,
      where: isCap ? "bottom" : "center",
      kind: isCap ? "caption" : "text",
    });
    reply = isCap ? "Caption added at the playhead." : "Text added at the playhead.";
  } else if (/fire|flame/.test(q)) {
    commands.push({ op: "sticker", glyph: "🔥", at: playhead, duration: 3 });
    reply = "Fire sticker added at the playhead.";
  } else if (/zoom in/.test(q)) {
    commands.push({ op: "zoom", value: Math.min(400, Math.round(playhead > 0 ? 160 : 140)) });
    reply = "Zooming the timeline in.";
  } else if (/zoom out|fit/.test(q)) {
    commands.push({ op: "zoom", value: 24 });
    reply = "Zooming the timeline out.";
  }

  return {
    reply: reply || "",
    commands,
  };
}

/* ------------------------------------------------------------------ *
 * Timeline audio clip — real waveform slice for the trimmed range.
 * ------------------------------------------------------------------ */

function ClipWave({
  wave,
  srcIn,
  clipDur,
}: {
  wave: { peaks: Float32Array; dur: number };
  srcIn: number;
  clipDur: number;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !wave.peaks.length || !wave.dur) return;
    const len = wave.peaks.length;
    const from = clamp(Math.floor((srcIn / wave.dur) * len), 0, len - 1);
    const to = clamp(Math.ceil(((srcIn + clipDur) / wave.dur) * len), from + 1, len);
    const slice = wave.peaks.slice(from, to);
    const paint = () => drawClipWave(canvas, slice, "#00F2FE", "rgba(167,139,250,0.75)");
    paint();
    window.addEventListener("resize", paint);
    return () => window.removeEventListener("resize", paint);
  }, [wave, srcIn, clipDur]);

  return <canvas className="ve-clip-wave" ref={ref} />;
}

/* ================================================================== *
 * Component
 * ================================================================== */

type ToolId =
  | "media"
  | "audio"
  | "text"
  | "stickers"
  | "effects"
  | "transitions"
  | "captions"
  | "filters"
  | "adjust"
  | "templates";

export default function VideoEditorPage() {
  /* ------------------------------ refs ------------------------------ */

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const meterRef = useRef<HTMLCanvasElement | null>(null);
  const tcRef = useRef<HTMLSpanElement | null>(null);
  const playheadRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const laneRefs = useRef<(HTMLDivElement | null)[]>([]);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const playerBoxRef = useRef<HTMLDivElement | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const capRecRef = useRef<{ stop: () => void } | null>(null);

  const timeRef = useRef(0);
  const playingRef = useRef(false);
  const dirtyRef = useRef(true);
  const ppsRef = useRef(DEFAULT_PPS);
  const snapRef = useRef(true);
  const masterMutedRef = useRef(false);
  const selectedRef = useRef<string | null>(null);
  const exportingRef = useRef(false);
  const exportStopRef = useRef(0);
  const recRef = useRef<MediaRecorder | null>(null);
  const recDoneRef = useRef<Promise<Blob> | null>(null);
  const recNoteRef = useRef<string | null>(null);

  const elsRef = useRef<Map<string, { el: HTMLVideoElement | HTMLAudioElement; url: string }>>(new Map());
  const imgsRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const histRef = useRef<{ past: Project[]; future: Project[] }>({ past: [], future: [] });
  const acRef = useRef<AudioContext | null>(null);
  const srcCacheRef = useRef<Map<HTMLMediaElement, MediaElementAudioSourceNode>>(new Map());
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamDestRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const wavesTriedRef = useRef<Set<string>>(new Set());
  const dragRef = useRef<
    | {
        clipId: string;
        mode: "move" | "in" | "out";
        originX: number;
        origStart: number;
        origDur: number;
        origSrcIn: number;
        laneRects: { index: number; rect: DOMRect }[];
        changed: boolean;
      }
    | null
  >(null);
  const keysRef = useRef<(e: KeyboardEvent) => void>(() => {});

  /* Live mirrors — RAF / key handlers always read the freshest values. */
  const projectStateRef = useRef<Project>({ name: "TIMELINE 01", ratio: "16:9", clips: [], transitions: [] });
  const binStateRef = useRef<BinItem[]>([]);
  const binUrlsRef = useRef<Set<string>>(new Set());

  /* ------------------------------ state ------------------------------ */

  const [project, setProject] = useState<Project>({
    name: "TIMELINE 01",
    ratio: "16:9",
    clips: [],
    transitions: [],
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tool, setTool] = useState<ToolId>("media");
  const [mode, setMode] = useState<"select" | "split">("select");
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [pps, setPps] = useState(DEFAULT_PPS);
  const [snap, setSnap] = useState(true);
  const [masterMuted, setMasterMuted] = useState(false);
  const [bin, setBin] = useState<BinItem[]>([]);
  const [binTab, setBinTab] = useState<"local" | "cloud">("local");
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [libUrls, setLibUrls] = useState<Record<string, string>>({});
  const [loadingLib, setLoadingLib] = useState(false);
  const [libError, setLibError] = useState<string | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [waves, setWaves] = useState<Record<string, { peaks: Float32Array; dur: number }>>({});
  const [log, setLog] = useState<LogEntry[]>([
    {
      id: uid("l"),
      from: "system",
      text: "Director online. I can cut, grade, transition and caption this timeline — sign in for the AI model, or the house parser handles the basics.",
    },
  ]);
  const [chat, setChat] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [directorOpen, setDirectorOpen] = useState(false);
  const [toasts, setToasts] = useState<{ id: string; text: string; tone: "info" | "warn" | "ok" }[]>([]);
  const [showKeys, setShowKeys] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportP, setExportP] = useState(0);
  const [result, setResult] = useState<ExportResult | null>(null);
  const [exportNote, setExportNote] = useState<string | null>(null);
  const [exportOpts, setExportOpts] = useState({ height: 720, fps: 30, mp4: true });
  const [capState, setCapState] = useState<string | null>(null);
  const [draftText, setDraftText] = useState("");
  const [capDraft, setCapDraft] = useState("");
  const [transDur, setTransDur] = useState(TRANS_DEFAULT);
  const [keysTab, setKeysTab] = useState(0);

  /* -------------------------- live mirrors -------------------------- */

  projectStateRef.current = project;
  binStateRef.current = bin;
  selectedRef.current = selectedId;
  ppsRef.current = pps;
  snapRef.current = snap;
  masterMutedRef.current = masterMuted;

  const duration = useMemo(() => projectDuration(project), [project]);
  const current = selectedClip(project, selectedId);
  const mediaCount = project.clips.filter((clip) => KIND_MEDIA.has(clip.kind)).length;

  const toast = useCallback((text: string, tone: "info" | "warn" | "ok" = "info") => {
    const id = uid("t");
    setToasts((prev) => [...prev.slice(-3), { id, text, tone }]);
    window.setTimeout(() => setToasts((prev) => prev.filter((entry) => entry.id !== id)), 4200);
  }, []);

  const pushLog = useCallback((from: LogEntry["from"], text: string) => {
    setLog((prev) => [...prev.slice(-48), { id: uid("l"), from, text }]);
  }, []);

  /* ---------------------------- history ----------------------------- */

  const pushHistory = useCallback(() => {
    const snapshot = structuredClone(projectStateRef.current);
    histRef.current.past.push(snapshot);
    if (histRef.current.past.length > 60) histRef.current.past.shift();
    histRef.current.future = [];
  }, []);

  const undo = useCallback(() => {
    const prev = histRef.current.past.pop();
    if (!prev) {
      toast("Nothing to undo.", "warn");
      return;
    }
    histRef.current.future.push(structuredClone(projectStateRef.current));
    setProject(prev);
    pushLog("system", "Undo.");
  }, [pushLog, toast]);

  const redo = useCallback(() => {
    const next = histRef.current.future.pop();
    if (!next) {
      toast("Nothing to redo.", "warn");
      return;
    }
    histRef.current.past.push(structuredClone(projectStateRef.current));
    setProject(next);
    pushLog("system", "Redo.");
  }, [pushLog, toast]);

  const commit = useCallback(
    (mutate: (draft: Project) => void) => {
      pushHistory();
      setProject((prev) => {
        const draft = structuredClone(prev);
        mutate(draft);
        return draft;
      });
    },
    [pushHistory],
  );

  /* --------------------------- audio graph --------------------------- */

  const ensureGraph = useCallback((): AudioContext | null => {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    if (!acRef.current) {
      try {
        acRef.current = new Ctor();
      } catch {
        return null;
      }
    }
    const ac = acRef.current;
    void ac.resume().catch(() => {});
    if (!analyserRef.current) {
      try {
        const analyser = ac.createAnalyser();
        analyser.fftSize = 1024;
        analyser.connect(ac.destination);
        analyserRef.current = analyser;
      } catch {
        /* keep playback without the meter */
      }
    }
    for (const { el } of elsRef.current.values()) {
      if (srcCacheRef.current.has(el)) continue;
      try {
        const source = ac.createMediaElementSource(el);
        if (analyserRef.current) source.connect(analyserRef.current);
        srcCacheRef.current.set(el, source);
      } catch {
        /* element stays on its direct output — export will note it */
      }
    }
    return ac;
  }, []);

  /* --------------------------- element pool -------------------------- */

  useEffect(() => {
    const map = elsRef.current;
    const live = new Set<string>();
    for (const clip of project.clips) {
      if (!KIND_MEDIA.has(clip.kind) || !clip.url || clip.kind === "image") continue;
      live.add(clip.id);
      const entry = map.get(clip.id);
      if (entry && entry.url === clip.url) continue;
      if (entry) {
        entry.el.pause();
        entry.el.removeAttribute("src");
      }
      const el =
        clip.kind === "video" ? (document.createElement("video") as HTMLVideoElement) : document.createElement("audio");
      el.preload = "auto";
      el.crossOrigin = "anonymous";
      if (el instanceof HTMLVideoElement) {
        el.playsInline = true;
      }
      el.addEventListener("loadeddata", () => {
        dirtyRef.current = true;
      });
      el.addEventListener("seeked", () => {
        dirtyRef.current = true;
      });
      el.src = clip.url;
      map.set(clip.id, { el, url: clip.url });
    }
    for (const [id, entry] of map.entries()) {
      if (!live.has(id)) {
        entry.el.pause();
        entry.el.removeAttribute("src");
        map.delete(id);
      }
    }
  }, [project.clips]);

  const getEl = useCallback((clip: Clip): HTMLVideoElement | HTMLImageElement | null => {
    if (clip.kind === "image" && clip.url) {
      const cached = imgsRef.current.get(clip.url);
      if (cached) return cached.complete && cached.naturalWidth > 0 ? cached : null;
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = clip.url;
      img.onload = () => {
        dirtyRef.current = true;
      };
      imgsRef.current.set(clip.url, img);
      return null;
    }
    const entry = elsRef.current.get(clip.id);
    if (!entry) return null;
    return entry.el as HTMLVideoElement;
  }, []);

  /* --------------------------- audio sync ---------------------------- */

  const syncAudio = useCallback(
    (t: number, force: boolean) => {
      const proj = projectStateRef.current;
      const playingNow = playingRef.current && !masterMutedRef.current;
      for (const clip of proj.clips) {
        if (!KIND_MEDIA.has(clip.kind) || !clip.url || clip.kind === "image") continue;
        const entry = elsRef.current.get(clip.id);
        if (!entry) continue;

        const inRange = t >= clip.start && t < clip.start + clip.duration;

        /* audio crossfade: duck A while the tail transition plays, swell B in */
        let gain = 1;
        let active = inRange;
        let target = clip.srcIn + Math.max(0, t - clip.start);
        if (inRange) {
          const trans = transitionFor(proj, clip.id);
          if (trans && trans.type !== "none") {
            const next = proj.clips
              .filter((c) => c.track === clip.track && c.id !== clip.id)
              .find((c) => Math.abs(c.start - (clip.start + clip.duration)) < 0.001);
            if (next) {
              const from = next.start - trans.duration;
              if (t >= from) {
                const p = clamp((t - from) / Math.max(0.05, trans.duration), 0, 1);
                gain = 1 - p;
              }
            }
          }
        } else {
          const pred = proj.clips
            .filter((c) => c.track === clip.track && c.id !== clip.id)
            .find((c) => Math.abs(clip.start - (c.start + c.duration)) < 0.001);
          if (pred) {
            const trans = transitionFor(proj, pred.id);
            if (trans && trans.type !== "none") {
              const from = clip.start - trans.duration;
              if (t >= from && t < clip.start) {
                active = true;
                target = clip.srcIn;
                gain = clamp((t - from) / Math.max(0.05, trans.duration), 0, 1);
              }
            }
          }
        }

        if (active && playingNow && !clip.muted) {
          if (entry.el.paused) void entry.el.play().catch(() => {});
          const drift = Math.abs(entry.el.currentTime - target);
          if (drift > 0.3 || force) {
            try {
              entry.el.currentTime = target;
            } catch {
              /* seek before metadata — retried next frame */
            }
          }
          entry.el.volume = clamp((clip.volume ?? 1) * gain, 0, 1);
          entry.el.muted = false;
        } else {
          if (!entry.el.paused) entry.el.pause();
          if (force && active) {
            try {
              entry.el.currentTime = target;
            } catch {
              /* ignore */
            }
          }
        }
      }
    },
    [],
  );

  /* ------------------------------ draw ------------------------------- */

  const drawNow = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const proj = projectStateRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { w, h } = aspectOf(proj.ratio);

    let W: number;
    let H: number;
    if (exportingRef.current) {
      W = canvas.width;
      H = canvas.height;
    } else {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const cw = canvas.clientWidth || 640;
      W = Math.max(64, Math.round(cw * dpr));
      H = Math.max(36, Math.round((W * h) / w));
      if (canvas.width !== W || canvas.height !== H) {
        canvas.width = W;
        canvas.height = H;
      }
    }

    renderFrame(ctx, W, H, timeRef.current, proj, getEl, {
      selectedId: selectedRef.current,
      show: !exportingRef.current,
    });
  }, [getEl]);

  const drawMeter = useCallback(() => {
    const canvas = meterRef.current;
    if (!canvas) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
    const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, w, h);

    const analyser = analyserRef.current;
    if (!analyser || !playingRef.current) {
      ctx.fillStyle = "rgba(167,139,250,0.35)";
      for (let i = 0; i < 5; i += 1) {
        const x = (i / 5) * w + w / 12;
        ctx.fillRect(x - dpr, h / 2 - h * 0.14, dpr * 2, h * 0.28);
      }
      return;
    }
    const buf = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(buf);
    let sum = 0;
    for (let i = 0; i < buf.length; i += 1) {
      const v = (buf[i] - 128) / 128;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / buf.length);
    const level = clamp(rms * 3.2, 0, 1);
    const bars = 12;
    for (let i = 0; i < bars; i += 1) {
      const lit = i / bars < level;
      ctx.fillStyle = lit
        ? i > bars - 3
          ? "#FF2A6D"
          : i > bars - 6
            ? "#FFB84D"
            : "#00F2FE"
        : "rgba(167,139,250,0.22)";
      const x = (i / bars) * w + w / (bars * 2);
      const bh = h * (0.3 + (i / bars) * 0.62);
      ctx.fillRect(x - w / (bars * 4), h - bh, Math.max(2, w / bars - dpr * 2), bh);
    }
  }, []);

  /* --------------------------- transport ----------------------------- */

  const play = useCallback(() => {
    if (projectStateRef.current.clips.length === 0) {
      toast("Timeline is empty — import a file first.", "warn");
      return;
    }
    if (timeRef.current >= projectDuration(projectStateRef.current) - 0.02) {
      timeRef.current = 0;
      setTime(0);
    }
    ensureGraph();
    playingRef.current = true;
    setPlaying(true);
    syncAudio(timeRef.current, true);
    dirtyRef.current = true;
  }, [ensureGraph, syncAudio, toast]);

  const pause = useCallback(() => {
    playingRef.current = false;
    setPlaying(false);
    syncAudio(timeRef.current, true);
    dirtyRef.current = true;
  }, [syncAudio]);

  const seek = useCallback(
    (t: number) => {
      timeRef.current = clamp(t, 0, Math.max(0, projectDuration(projectStateRef.current)));
      setTime(Math.round(timeRef.current * 10) / 10);
      syncAudio(timeRef.current, true);
      dirtyRef.current = true;
      if (tcRef.current) tcRef.current.textContent = formatTc(timeRef.current);
      if (playheadRef.current) playheadRef.current.style.left = `${timeRef.current * ppsRef.current}px`;
    },
    [syncAudio],
  );

  /* --------------------------- clock loop ---------------------------- */

  const finishExportRef = useRef<() => void>(() => {});
  finishExportRef.current = () => {
    const rec = recRef.current;
    const done = recDoneRef.current;
    playingRef.current = false;
    setPlaying(false);
    syncAudio(timeRef.current, true);
    for (const { el } of elsRef.current.values()) el.pause();
    exportingRef.current = false;
    if (rec && rec.state !== "inactive") rec.stop();
    const note = recNoteRef.current;
    recRef.current = null;
    recDoneRef.current = null;
    recNoteRef.current = null;

    void (async () => {
      if (done) {
        try {
          const blob = await done;
          const ext = blob.type.includes("mp4") ? "mp4" : "webm";
          setResult({
            url: URL.createObjectURL(blob),
            name: `${slugify(projectStateRef.current.name)}.${ext}`,
            mime: blob.type || "video/webm",
            bytes: blob.size,
          });
        } catch (recordError) {
          toast(errorText(recordError, "Recording failed."), "warn");
        }
      }
      setExporting(false);
      setExportP(1);
      dirtyRef.current = true;
      if (note) {
        pushLog("system", note);
        setExportNote(note);
      } else {
        setExportNote(null);
      }
      pushLog("system", "Export finished — your file is ready below.");
      drawNow();
    })();
  };

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let acc = 0;

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.25, (now - last) / 1000);
      last = now;

      if (playingRef.current) {
        const dur = projectDuration(projectStateRef.current);
        let t = timeRef.current + dt;
        if (exportingRef.current && t >= exportStopRef.current) {
          t = exportStopRef.current;
          timeRef.current = t;
          finishExportRef.current();
        } else if (t >= dur) {
          timeRef.current = dur;
          playingRef.current = false;
          setPlaying(false);
          syncAudio(dur, true);
        } else {
          timeRef.current = t;
          syncAudio(t, false);
        }
        dirtyRef.current = true;
      }

      acc += dt;
      if (acc >= 0.1) {
        acc = 0;
        const t = timeRef.current;
        if (tcRef.current) tcRef.current.textContent = formatTc(t);
        if (playheadRef.current) {
          playheadRef.current.style.left = `${t * ppsRef.current}px`;
          const scroll = scrollRef.current;
          if (scroll && playingRef.current) {
            const x = t * ppsRef.current;
            if (x > scroll.scrollLeft + scroll.clientWidth - 90) {
              scroll.scrollLeft = x - scroll.clientWidth + 160;
            }
          }
        }
        setTime((prev) => {
          const next = Math.round(t * 10) / 10;
          return prev === next ? prev : next;
        });
        if (exportingRef.current) {
          const span = Math.max(0.001, exportStopRef.current);
          setExportP(clamp(timeRef.current / span, 0, 1));
        }
      }

      if (dirtyRef.current || playingRef.current) {
        dirtyRef.current = false;
        drawNow();
      }
      drawMeter();
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [drawNow, drawMeter, syncAudio]);

  useEffect(() => {
    dirtyRef.current = true;
  }, [project, selectedId, thumbs]);

  /* ---------------------------- library ------------------------------ */

  const refreshLibrary = useCallback(async () => {
    setLoadingLib(true);
    setLibError(null);
    try {
      const { data: rows, error: listError } = await supabase
        .from("media_assets")
        .select("*")
        .in("kind", ["video", "image", "audio"])
        .order("created_at", { ascending: false })
        .limit(60);
      if (listError) throw new Error(listError.message);
      const list = (rows ?? []) as MediaAsset[];
      setAssets(list);
      if (list.length === 0) {
        setLibUrls({});
        return;
      }
      const { data: signed } = await supabase.storage
        .from(MEDIA_BUCKET)
        .createSignedUrls(list.map((asset) => asset.storage_path), SIGNED_URL_TTL);
      const map: Record<string, string> = {};
      for (const entry of signed ?? []) {
        if (entry.signedUrl && entry.path) map[entry.path] = entry.signedUrl;
      }
      setLibUrls(map);
    } catch (loadError) {
      setLibError(errorText(loadError, "Could not load your library."));
    } finally {
      setLoadingLib(false);
    }
  }, []);

  useEffect(() => {
    void refreshLibrary();
    supabase.auth
      .getSession()
      .then(({ data }) => setSignedIn(Boolean(data.session)))
      .catch(() => setSignedIn(false));
  }, [refreshLibrary]);

  /* --------------------------- import -------------------------------- */

  const probeDuration = useCallback((url: string, kind: "video" | "audio"): Promise<number> => {
    return new Promise((resolve) => {
      const el = document.createElement(kind === "video" ? "video" : "audio");
      const done = (value: number) => {
        el.removeAttribute("src");
        resolve(value);
      };
      const timer = window.setTimeout(() => done(0), 8000);
      el.preload = "metadata";
      el.onloadedmetadata = () => {
        window.clearTimeout(timer);
        done(Number.isFinite(el.duration) ? el.duration : 0);
      };
      el.onerror = () => {
        window.clearTimeout(timer);
        done(0);
      };
      el.src = url;
    });
  }, []);

  const importFiles = useCallback(
    async (files: FileList | File[]) => {
      const next: BinItem[] = [];
      let skipped = 0;
      for (const file of Array.from(files)) {
        if (file.size > MAX_IMPORT_BYTES) {
          skipped += 1;
          continue;
        }
        const kind = kindFromMime(file.type || "");
        next.push({
          id: uid("bin"),
          name: file.name,
          url: URL.createObjectURL(file),
          mime: file.type || `${kind}/bin`,
          kind,
        });
      }
      if (next.length) {
        for (const item of next) binUrlsRef.current.add(item.url);
        setBin((prev) => [...next, ...prev]);
        setBinTab("local");
        setTool("media");
        toast(`${next.length} file${next.length === 1 ? "" : "s"} imported to the bin.`, "ok");
      }
      if (skipped) toast(`${skipped} file(s) over 400 MB skipped.`, "warn");
    },
    [toast],
  );

  const addToTimeline = useCallback(
    async (item: { url: string; name: string; kind: "video" | "image" | "audio"; mime?: string }) => {
      const proj = projectStateRef.current;
      let track = item.kind === "audio" ? 3 : 0;
      const at = timeRef.current;
      let lastEnd = 0;
      for (const clip of proj.clips) {
        if (clip.track === track) lastEnd = Math.max(lastEnd, clip.start + clip.duration);
      }
      let start = at;
      const collides = proj.clips.some(
        (clip) => clip.track === track && at < clip.start + clip.duration && at + 1 > clip.start,
      );
      if (collides) {
        start = lastEnd;
        toast("Playhead spot was taken — placed at the end of the track instead.", "info");
      }

      let srcDur = 0;
      if (item.kind === "image") srcDur = 4;
      else srcDur = await probeDuration(item.url, item.kind);
      const duration = clamp(srcDur || (item.kind === "image" ? 4 : 5), 0.3, 600);

      const clip: Clip = {
        id: uid("clip"),
        kind: item.kind,
        track,
        start,
        duration: item.kind === "image" ? duration : Math.min(duration, 600),
        srcIn: 0,
        url: item.url,
        name: item.name,
        mime: item.mime,
        ...(item.kind === "image" ? {} : { volume: 1 }),
      };
      if (item.kind === "image") {
        clip.fit = "cover";
        clip.opacity = 1;
      }
      commit((draft) => {
        draft.clips.push(clip);
      });
      setSelectedId(clip.id);
      setTool(item.kind === "audio" ? "audio" : "media");
      pushLog("system", `Added "${item.name}" to ${TRACKS[track].label} at ${formatClock(start)}.`);
      dirtyRef.current = true;
      return clip;
    },
    [commit, probeDuration, pushLog, toast],
  );

  /* --------------------------- thumbnails ---------------------------- */

  useEffect(() => {
    if (playing) return;
    let cancelled = false;
    const targets = project.clips.filter(
      (clip) => clip.kind === "video" && clip.url && !thumbs[clip.id],
    );
    if (targets.length === 0) return;

    const capture = async (clip: Clip) => {
      const entry = elsRef.current.get(clip.id);
      if (!entry) return;
      const el = entry.el as HTMLVideoElement;
      if (el.readyState < 1) {
        await new Promise<void>((resolve) => {
          const onReady = () => {
            el.removeEventListener("loadeddata", onReady);
            resolve();
          };
          el.addEventListener("loadeddata", onReady);
          window.setTimeout(resolve, 4000);
        });
      }
      if (cancelled || playingRef.current) return;
      const mark = clip.srcIn + 0.05;
      try {
        if (Math.abs(el.currentTime - mark) > 0.02) {
          await new Promise<void>((resolve) => {
            const onSeek = () => {
              el.removeEventListener("seeked", onSeek);
              resolve();
            };
            el.addEventListener("seeked", onSeek);
            el.currentTime = mark;
            window.setTimeout(resolve, 4000);
          });
        }
      } catch {
        return;
      }
      if (cancelled || playingRef.current || el.readyState < 2) return;
      try {
        const c = document.createElement("canvas");
        c.width = 128;
        c.height = 72;
        const ctx = c.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(el, 0, 0, c.width, c.height);
        const url = c.toDataURL("image/jpeg", 0.62);
        setThumbs((prev) => (prev[clip.id] ? prev : { ...prev, [clip.id]: url }));
      } catch {
        /* tainted or not ready — timeline falls back to a label */
      }
    };

    void (async () => {
      for (const clip of targets.slice(0, 6)) {
        await capture(clip);
        if (cancelled) return;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [project.clips, thumbs, playing]);

  /* ---------------------------- waveforms ---------------------------- */

  useEffect(() => {
    for (const clip of project.clips) {
      if (clip.kind !== "audio" || !clip.url) continue;
      if (waves[clip.url] || wavesTriedRef.current.has(clip.url)) continue;
      wavesTriedRef.current.add(clip.url);
      void loadPeaks(clip.url)
        .then((data) => {
          setWaves((prev) => ({ ...prev, [clip.url as string]: { peaks: data.peaks, dur: data.duration } }));
        })
        .catch(() => {
          pushLog("system", `No waveform for "${clip.name ?? "audio"}" — the file wouldn't decode here.`);
        });
    }
  }, [project.clips, waves, pushLog]);

  /* --------------------------- clip editing --------------------------- */

  const splitAt = useCallback(
    (at: number) => {
      let cuts = 0;
      commit((draft) => {
        const additions: Clip[] = [];
        for (const clip of draft.clips) {
          if (at > clip.start + 0.05 && at < clip.start + clip.duration - 0.05) {
            const leftDur = at - clip.start;
            const right: Clip = structuredClone(clip);
            right.id = uid("clip");
            right.start = at;
            right.srcIn = clip.srcIn + leftDur;
            right.duration = clip.duration - leftDur;
            right.keys = clip.keys
              ?.filter((key) => key.t > leftDur)
              .map((key) => ({ ...key, t: key.t - leftDur }));
            clip.duration = leftDur;
            additions.push(right);
            cuts += 1;
          }
        }
        draft.clips.push(...additions);
      });
      if (cuts) pushLog("system", `Split ${cuts} clip${cuts === 1 ? "" : "s"} at ${formatClock(at)}.`);
      else toast("Nothing crosses that point.", "warn");
      dirtyRef.current = true;
    },
    [commit, pushLog, toast],
  );

  const deleteSelected = useCallback(() => {
    const id = selectedRef.current;
    if (!id) {
      toast("Select a clip first.", "warn");
      return;
    }
    commit((draft) => {
      draft.clips = draft.clips.filter((clip) => clip.id !== id);
      draft.transitions = draft.transitions.filter((entry) => entry.after !== id);
    });
    setSelectedId(null);
    pushLog("system", "Deleted the selection.");
    dirtyRef.current = true;
  }, [commit, pushLog, toast]);

  const duplicateSelected = useCallback(() => {
    const id = selectedRef.current;
    const source = selectedClip(projectStateRef.current, id);
    if (!source) {
      toast("Select a clip first.", "warn");
      return;
    }
    const copy: Clip = structuredClone(source);
    copy.id = uid("clip");
    copy.start = source.start + source.duration;
    commit((draft) => {
      draft.clips.push(copy);
    });
    setSelectedId(copy.id);
    pushLog("system", "Duplicated the selection.");
    dirtyRef.current = true;
  }, [commit, pushLog, toast]);

  const patchClip = useCallback(
    (id: string, patch: Partial<Clip>) => {
      commit((draft) => {
        const clip = draft.clips.find((c) => c.id === id);
        if (clip) Object.assign(clip, patch);
      });
      dirtyRef.current = true;
    },
    [commit],
  );

  const patchProject = useCallback(
    (patch: Partial<Project>) => {
      commit((draft) => {
        Object.assign(draft, patch);
      });
      dirtyRef.current = true;
    },
    [commit],
  );

  const applyTemplate = useCallback(
    (templateId: string) => {
      const tpl = TEMPLATES.find((t) => t.id === templateId);
      if (!tpl) return;
      commit((draft) => {
        for (const clip of draft.clips) {
          if (!KIND_MEDIA.has(clip.kind)) continue;
          clip.filter = tpl.filter;
          clip.effect = tpl.effect;
          clip.adjust = { brightness: 1, contrast: 1, saturate: 1, temperature: 0, ...tpl.adjust };
        }
        draft.transitions = [];
        if (tpl.transition !== "none") {
          for (const clip of [...draft.clips].sort((a, b) => a.start - b.start)) {
            const next = draft.clips.find(
              (c) => c.track === clip.track && c.id !== clip.id && Math.abs(c.start - (clip.start + clip.duration)) < 0.05,
            );
            if (next) draft.transitions.push({ after: clip.id, type: tpl.transition, duration: TRANS_DEFAULT });
          }
        }
      });
      pushLog("system", `Look "${tpl.label}" applied across the timeline.`);
      toast(`${tpl.label} applied.`, "ok");
      dirtyRef.current = true;
    },
    [commit, pushLog, toast],
  );

  const setTransitionOnSelected = useCallback(
    (type: TransId, duration?: number) => {
      const id = selectedRef.current;
      const proj = projectStateRef.current;
      const clip = selectedClip(proj, id);
      if (!clip) {
        toast("Select a clip first — the transition attaches to its outgoing cut.", "warn");
        return;
      }
      const next = proj.clips
        .filter((c) => c.track === clip.track && c.id !== clip.id)
        .sort((a, b) => a.start - b.start)
        .find((c) => Math.abs(c.start - (clip.start + clip.duration)) < 0.5);
      if (!next) {
        toast("Needs a clip right after the selection on the same track.", "warn");
        return;
      }
      commit((draft) => {
        draft.transitions = draft.transitions.filter((entry) => entry.after !== clip.id);
        if (type !== "none") {
          draft.transitions.push({
            after: clip.id,
            type,
            duration: clamp(duration ?? TRANS_DEFAULT, 0.2, 2.5),
          });
        }
      });
      pushLog("system", `Cut ${formatClock(clip.start)} → ${formatClock(next.start)} is now ${type.toUpperCase()}.`);
      dirtyRef.current = true;
    },
    [commit, pushLog, toast],
  );

  /* ---------------------------- pointer ------------------------------ */

  const snapValue = useCallback((value: number, ignoreClipId: string | null): number => {
    if (!snapRef.current) return value;
    const proj = projectStateRef.current;
    const points = [0, timeRef.current];
    for (const clip of proj.clips) {
      if (clip.id === ignoreClipId) continue;
      points.push(clip.start, clip.start + clip.duration);
    }
    const threshold = SNAP_PX / Math.max(4, ppsRef.current);
    let best = value;
    let bestDist = threshold;
    for (const p of points) {
      const dist = Math.abs(p - value);
      if (dist < bestDist) {
        best = p;
        bestDist = dist;
      }
    }
    return best;
  }, []);

  const onClipPointerDown = useCallback(
    (event: React.PointerEvent<HTMLElement>, clip: Clip) => {
      event.stopPropagation();
      const target = event.target as HTMLElement;
      const handle = target.dataset.handle as "in" | "out" | undefined;

      if (mode === "split" && !handle) {
        const rect = event.currentTarget.getBoundingClientRect();
        const at = clip.start + ((event.clientX - rect.left) / Math.max(1, rect.width)) * clip.duration;
        splitAt(at);
        return;
      }

      setSelectedId(clip.id);
      selectedRef.current = clip.id;
      dirtyRef.current = true;

      pushHistory();
      const laneRects = laneRefs.current
        .map((el, index) => (el ? { index, rect: el.getBoundingClientRect() } : null))
        .filter((x): x is { index: number; rect: DOMRect } => x !== null);

      const originX = event.clientX;
      dragRef.current = {
        clipId: clip.id,
        mode: handle ?? "move",
        originX,
        origStart: clip.start,
        origDur: clip.duration,
        origSrcIn: clip.srcIn,
        laneRects,
        changed: false,
      };

      const onMove = (moveEvent: PointerEvent) => {
        const drag = dragRef.current;
        if (!drag) return;
        const proj = projectStateRef.current;
        const targetClip = proj.clips.find((c) => c.id === drag.clipId);
        if (!targetClip) return;
        const deltaT = (moveEvent.clientX - drag.originX) / ppsRef.current;
        drag.changed = true;

        if (drag.mode === "move") {
          let nextStart = Math.max(0, drag.origStart + deltaT);
          nextStart = snapValue(nextStart, drag.clipId);

          let nextTrack = targetClip.track;
          for (const lane of drag.laneRects) {
            if (moveEvent.clientY >= lane.rect.top && moveEvent.clientY <= lane.rect.bottom) {
              nextTrack = lane.index;
              break;
            }
          }
          if (!KIND_TRACKS[targetClip.kind].includes(nextTrack)) {
            const allowed = KIND_TRACKS[targetClip.kind];
            nextTrack = allowed.reduce((bestIdx, idx) => {
              const lane = drag.laneRects.find((l) => l.index === idx);
              const bestLane = drag.laneRects.find((l) => l.index === bestIdx);
              if (!lane) return bestIdx;
              const dist = Math.abs(moveEvent.clientY - (lane.rect.top + lane.rect.height / 2));
              const bestDist = bestLane
                ? Math.abs(moveEvent.clientY - (bestLane.rect.top + bestLane.rect.height / 2))
                : Infinity;
              return dist < bestDist ? idx : bestIdx;
            }, targetClip.track);
          }

          setProject((prev) => ({
            ...prev,
            clips: prev.clips.map((c) =>
              c.id === drag.clipId ? { ...c, start: nextStart, track: nextTrack } : c,
            ),
          }));
        } else if (drag.mode === "in") {
          let shift = deltaT;
          if (drag.origSrcIn + shift < 0) shift = -drag.origSrcIn;
          if (drag.origDur - shift < 0.2) shift = drag.origDur - 0.2;
          const snapped = snapValue(drag.origStart + shift, drag.clipId) - drag.origStart;
          const safeShift = Math.abs(snapped - shift) < 0.35 ? snapped : shift;
          setProject((prev) => ({
            ...prev,
            clips: prev.clips.map((c) =>
              c.id === drag.clipId
                ? {
                    ...c,
                    start: drag.origStart + safeShift,
                    duration: drag.origDur - safeShift,
                    srcIn: Math.max(0, drag.origSrcIn + safeShift),
                  }
                : c,
            ),
          }));
        } else {
          let nextDur = Math.max(0.2, drag.origDur + deltaT);
          const snapped = snapValue(drag.origStart + nextDur, drag.clipId) - drag.origStart;
          if (Math.abs(snapped - nextDur) < 0.35) nextDur = snapped;
          nextDur = Math.max(0.2, nextDur);
          setProject((prev) => ({
            ...prev,
            clips: prev.clips.map((c) => (c.id === drag.clipId ? { ...c, duration: nextDur } : c)),
          }));
        }
        dirtyRef.current = true;
      };

      const onUp = () => {
        const drag = dragRef.current;
        dragRef.current = null;
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        if (drag?.changed) dirtyRef.current = true;
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [mode, pushHistory, snapValue, splitAt],
  );

  const onLanePointerDown = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (event.button !== 0) return;
      const rect = event.currentTarget.getBoundingClientRect();
      seek((event.clientX - rect.left) / ppsRef.current);
      const onMove = (moveEvent: PointerEvent) => {
        seek((moveEvent.clientX - rect.left) / ppsRef.current);
      };
      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [seek],
  );

  /* ----------------------------- director ----------------------------- */

  const runCommands = useCallback(
    (commands: Cmd[], reply: string, from: "ai" | "house") => {
      const historyWorthy = commands.some(
        (c) => !["play", "pause", "seek", "undo", "zoom"].includes(c.op),
      );
      if (historyWorthy) pushHistory();

      const mutate = (fn: (draft: Project) => void) => {
        setProject((prev) => {
          const draft = structuredClone(prev);
          fn(draft);
          return draft;
        });
      };

      const playhead = timeRef.current;
      let affected = 0;

      for (const cmd of commands) {
        switch (cmd.op) {
          case "split":
            mutate((draft) => {
              const at = cmd.at ?? playhead;
              const additions: Clip[] = [];
              for (const clip of draft.clips) {
                if (at > clip.start + 0.05 && at < clip.start + clip.duration - 0.05) {
                  const leftDur = at - clip.start;
                  const right: Clip = structuredClone(clip);
                  right.id = uid("clip");
                  right.start = at;
                  right.srcIn = clip.srcIn + leftDur;
                  right.duration = clip.duration - leftDur;
                  clip.duration = leftDur;
                  additions.push(right);
                  affected += 1;
                }
              }
              draft.clips.push(...additions);
            });
            break;
          case "delete":
            mutate((draft) => {
              if (cmd.target === "all") {
                affected += draft.clips.length;
                draft.clips = [];
                draft.transitions = [];
              } else if (selectedRef.current) {
                draft.clips = draft.clips.filter((clip) => clip.id !== selectedRef.current);
                draft.transitions = draft.transitions.filter((entry) => entry.after !== selectedRef.current);
                affected += 1;
              }
            });
            if (cmd.target === "selected") setSelectedId(null);
            break;
          case "duplicate": {
            const source = selectedClip(projectStateRef.current, selectedRef.current);
            if (source) {
              const copy: Clip = structuredClone(source);
              copy.id = uid("clip");
              copy.start = source.start + source.duration;
              mutate((draft) => {
                draft.clips.push(copy);
              });
              setSelectedId(copy.id);
              affected += 1;
            }
            break;
          }
          case "seek":
            seek(cmd.to);
            break;
          case "play":
            play();
            break;
          case "pause":
            pause();
            break;
          case "undo":
            undo();
            break;
          case "ratio":
            mutate((draft) => {
              draft.ratio = cmd.value;
            });
            dirtyRef.current = true;
            break;
          case "volume":
            mutate((draft) => {
              for (const clip of draft.clips) {
                const match =
                  cmd.target === "all-audio"
                    ? KIND_MEDIA.has(clip.kind) && clip.kind !== "image"
                    : clip.id === selectedRef.current;
                if (match && clip.kind !== "image") {
                  clip.volume = cmd.value;
                  clip.muted = false;
                  affected += 1;
                }
              }
            });
            break;
          case "mute":
            mutate((draft) => {
              for (const clip of draft.clips) {
                const match =
                  cmd.target === "all-audio"
                    ? KIND_MEDIA.has(clip.kind) && clip.kind !== "image"
                    : clip.id === selectedRef.current;
                if (match && clip.kind !== "image") {
                  clip.muted = cmd.value;
                  affected += 1;
                }
              }
            });
            break;
          case "filter":
            mutate((draft) => {
              for (const clip of draft.clips) {
                const match = cmd.target === "all" ? KIND_MEDIA.has(clip.kind) : clip.id === selectedRef.current;
                if (match) {
                  clip.filter = cmd.value;
                  affected += 1;
                }
              }
            });
            break;
          case "effect":
            mutate((draft) => {
              for (const clip of draft.clips) {
                const match = cmd.target === "all" ? KIND_MEDIA.has(clip.kind) : clip.id === selectedRef.current;
                if (match) {
                  clip.effect = cmd.value;
                  affected += 1;
                }
              }
            });
            break;
          case "adjust":
            mutate((draft) => {
              for (const clip of draft.clips) {
                const match = cmd.target === "all" ? KIND_MEDIA.has(clip.kind) : clip.id === selectedRef.current;
                if (!match || !KIND_MEDIA.has(clip.kind)) continue;
                clip.adjust = clip.adjust ?? defaultAdjust();
                if (cmd.brightness !== undefined) clip.adjust.brightness = cmd.brightness;
                if (cmd.contrast !== undefined) clip.adjust.contrast = cmd.contrast;
                if (cmd.saturate !== undefined) clip.adjust.saturate = cmd.saturate;
                if (cmd.temperature !== undefined) clip.adjust.temperature = cmd.temperature;
                affected += 1;
              }
            });
            break;
          case "transition":
            mutate((draft) => {
              const targets: Clip[] = [];
              if (cmd.target === "selected") {
                const clip = selectedClip(draft, selectedRef.current);
                if (clip) targets.push(clip);
              } else {
                const sorted = [...draft.clips].sort((a, b) => a.start - b.start);
                for (const clip of sorted) {
                  const next = sorted.find(
                    (c) => c.track === clip.track && c.id !== clip.id && Math.abs(c.start - (clip.start + clip.duration)) < 0.5,
                  );
                  if (next) targets.push(clip);
                }
              }
              for (const clip of targets) {
                draft.transitions = draft.transitions.filter((entry) => entry.after !== clip.id);
                if (cmd.value !== "none") {
                  draft.transitions.push({
                    after: clip.id,
                    type: cmd.value,
                    duration: clamp(cmd.duration ?? TRANS_DEFAULT, 0.2, 2.5),
                  });
                  affected += 1;
                }
              }
            });
            break;
          case "text":
            mutate((draft) => {
              const at = Math.min(cmd.at ?? playhead, Math.max(playhead, projectDuration(draft)));
              const kind: ClipKind = cmd.kind === "caption" ? "caption" : "text";
              draft.clips.push({
                id: uid("clip"),
                kind,
                track: 2,
                start: at,
                duration: clamp(cmd.duration ?? 3, 0.5, 60),
                srcIn: 0,
                text: cmd.text,
                x: cmd.where === "top" ? 0.5 : cmd.where === "bottom" ? 0.5 : 0.5,
                y: kind === "caption" ? 0.9 : cmd.where === "top" ? 0.14 : cmd.where === "bottom" ? 0.86 : 0.5,
                fontSize: kind === "caption" ? 34 : 64,
                color: kind === "caption" ? "#FFFFFF" : "#F4F1FF",
                font: "sans",
                weight: 700,
                align: "center",
                bg: kind === "caption",
                inAnim: "fade",
                outAnim: "fade",
              });
              affected += 1;
            });
            break;
          case "sticker":
            mutate((draft) => {
              draft.clips.push({
                id: uid("clip"),
                kind: "sticker",
                track: 1,
                start: cmd.at ?? playhead,
                duration: clamp(cmd.duration ?? 3, 0.5, 60),
                srcIn: 0,
                text: cmd.glyph,
                x: 0.5,
                y: 0.42,
                fontSize: 120,
                opacity: 1,
                scale: 1,
              });
              affected += 1;
            });
            break;
          case "zoom":
            setPps(Math.round(clamp(cmd.value, 8, 400)));
            break;
          case "template":
            applyTemplate(cmd.value);
            break;
          default:
            break;
        }
      }

      dirtyRef.current = true;
      const label = from === "ai" ? "AI" : "House rules";
      pushLog(from, `${reply}${affected ? ` — ${affected} change${affected === 1 ? "" : "s"} applied.` : ""}`);
      toast(`${label}: ${reply || "done."}`, from === "ai" ? "ok" : "info");
    },
    [applyTemplate, pause, play, pushHistory, pushLog, seek, toast, undo],
  );

  const sendDirector = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text || aiBusy) return;
      pushLog("user", text);
      setChat("");
      setAiBusy(true);
      const context = timelineSummary(projectStateRef.current, timeRef.current, selectedRef.current);
      try {
        const response = await requestLocalAi("chat", directorSystem(context), 120000);
        const parsed = extractJson(typeof response === "string" ? response : String(response));
        if (parsed && typeof parsed === "object") {
          const payload = parsed as { reply?: unknown; commands?: unknown };
          const { reply, commands } = coerceCommands(payload.reply, payload.commands);
          runCommands(commands, reply, "ai");
        } else {
          const plain = (typeof response === "string" ? response : String(response)).slice(0, 600);
          pushLog("ai", plain || "…");
        }
      } catch (relayError) {
        const { reply, commands } = houseCommand(text, timeRef.current);
        if (commands.length) {
          runCommands(commands, reply || "Done.", "house");
        } else {
          pushLog(
            "house",
            `No local action matched. (AI relay offline — ${errorText(relayError, "not reachable")})`,
          );
          toast("Sign in for the AI Director — house rules couldn't map that.", "warn");
        }
      } finally {
        setAiBusy(false);
      }
    },
    [aiBusy, pushLog, runCommands, toast],
  );

  /* -------------------------- auto captions --------------------------- */

  const toggleAutoCaptions = useCallback(() => {
    if (capRecRef.current) {
      capRecRef.current.stop();
      capRecRef.current = null;
      return;
    }
    type SRConstructor = new () => {
      continuous: boolean;
      interimResults: boolean;
      lang: string;
      onresult: ((event: { results: { length: number; [i: number]: { isFinal: boolean; 0: { transcript: string } } } }) => void) | null;
      onerror: ((event: { error?: string }) => void) | null;
      onend: (() => void) | null;
      start: () => void;
      stop: () => void;
    };
    const w = window as unknown as { SpeechRecognition?: SRConstructor; webkitSpeechRecognition?: SRConstructor };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) {
      setCapState("This browser has no speech recognition — type captions or ask the Director (AI needs sign-in).");
      pushLog("system", "Auto captions unavailable in this browser — honest fallback: manual captions.");
      return;
    }
    if (!playingRef.current) {
      setCapState("Press play first — it captions what the microphone hears while the timeline runs.");
      return;
    }
    let count = 0;
    try {
      const rec = new Ctor();
      rec.continuous = true;
      rec.interimResults = false;
      rec.lang = navigator.language || "en-US";
      rec.onresult = (event) => {
        const results = event.results;
        for (let i = 0; i < results.length; i += 1) {
          const entry = results[i];
          if (!entry.isFinal) continue;
          const text = entry[0].transcript.trim();
          if (!text) continue;
          count += 1;
          const at = Math.max(0, timeRef.current - 0.4);
          pushHistory();
          setProject((prev) => ({
            ...prev,
            clips: [
              ...prev.clips,
              {
                id: uid("clip"),
                kind: "caption",
                track: 2,
                start: at,
                duration: 2.6,
                srcIn: 0,
                text,
                y: 0.9,
                fontSize: 34,
                color: "#FFFFFF",
                font: "sans",
                weight: 700,
                align: "center",
                bg: true,
                inAnim: "fade",
                outAnim: "fade",
              },
            ],
          }));
        }
      };
      rec.onerror = (event) => {
        setCapState(`Microphone blocked (${event.error ?? "error"}) — type captions instead.`);
        pushLog("system", `Auto captions stopped: ${event.error ?? "error"}.`);
      };
      rec.onend = () => {
        capRecRef.current = null;
        setCapState(count ? `Done — ${count} caption${count === 1 ? "" : "s"} added.` : null);
        dirtyRef.current = true;
      };
      rec.start();
      capRecRef.current = rec;
      setCapState("Listening… captions land on the TEXT track as it hears them. Experimental: uses your microphone.");
      pushLog("system", "Auto captions running (experimental — microphone hears the room, not the file).");
    } catch (captionError) {
      setCapState(errorText(captionError, "Could not start speech recognition."));
    }
  }, [pushHistory, pushLog]);

  /* ----------------------------- export ------------------------------- */

  const startExport = useCallback(async () => {
    if (exportingRef.current) return;
    const proj = projectStateRef.current;
    if (proj.clips.length === 0) {
      toast("Timeline is empty — nothing to export.", "warn");
      return;
    }
    const dur = projectDuration(proj);
    if (dur <= 0.05) {
      toast("Timeline has no duration yet.", "warn");
      return;
    }
    if (dur > MAX_EXPORT_SECONDS) {
      toast(`Exports are capped at ${MAX_EXPORT_SECONDS / 60} minutes — trim the timeline first.`, "warn");
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;

    const { w, h } = aspectOf(proj.ratio);
    const targetH = exportOpts.height;
    const ew = Math.round((w * targetH) / h / 2) * 2;
    const eh = Math.round(targetH / 2) * 2;
    canvas.width = ew;
    canvas.height = eh;

    const stream = canvas.captureStream(exportOpts.fps);
    let audioNote: string | null = null;
    const ac = ensureGraph();
    if (ac && mediaCount > 0) {
      try {
        if (!streamDestRef.current) streamDestRef.current = ac.createMediaStreamDestination();
        for (const source of srcCacheRef.current.values()) {
          try {
            source.connect(streamDestRef.current);
          } catch {
            /* already connected */
          }
        }
        const audioTracks = streamDestRef.current.stream.getAudioTracks();
        if (audioTracks.length) {
          for (const track of audioTracks) stream.addTrack(track);
        } else {
          audioNote = "Exported without audio — the browser refused the audio graph.";
        }
      } catch {
        audioNote = "Exported without audio — the browser refused the audio graph.";
      }
    } else if (mediaCount > 0 && !ac) {
      audioNote = "Exported without audio — Web Audio is unavailable in this browser.";
    }

    const candidates = [
      ...(exportOpts.mp4 ? ["video/mp4;codecs=avc1.42E01E,mp4a.40.2", "video/mp4"] : []),
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm",
    ];
    const mimeType = candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
    if (!mimeType) {
      toast("This browser can't record video (no MediaRecorder).", "warn");
      return;
    }

    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: eh >= 1080 ? 12_000_000 : 6_000_000,
      });
    } catch (recordError) {
      toast(errorText(recordError, "Could not start the recorder."), "warn");
      return;
    }

    const chunks: BlobPart[] = [];
    const done = new Promise<Blob>((resolve, reject) => {
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size) chunks.push(event.data);
      };
      recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType.split(";")[0] }));
      recorder.onerror = (event) => reject((event as unknown as { error?: Error }).error ?? new Error("Recorder error"));
    });

    recRef.current = recorder;
    recDoneRef.current = done;
    recNoteRef.current = audioNote;
    exportingRef.current = true;
    exportStopRef.current = Math.min(dur, MAX_EXPORT_SECONDS);
    setResult(null);
    setExportNote(null);
    setExportP(0);
    setExporting(true);
    setShowExport(true);

    recorder.start(600);
    timeRef.current = 0;
    setTime(0);
    seek(0);
    playingRef.current = true;
    setPlaying(true);
    ensureGraph();
    syncAudio(0, true);
    dirtyRef.current = true;
    pushLog(
      "system",
      `Export running — recording in real time (${exportOpts.height}p · ${exportOpts.fps}fps · ${mimeType.includes("mp4") ? "MP4" : "WebM"}). Keep this tab visible.`,
    );
  }, [ensureGraph, exportOpts, mediaCount, pushLog, seek, syncAudio, toast]);

  const cancelExport = useCallback(() => {
    if (!exportingRef.current) return;
    recNoteRef.current = "Export cancelled before the end — no file was saved.";
    exportStopRef.current = timeRef.current;
    finishExportRef.current();
  }, []);

  /* ---------------------------- shortcuts ----------------------------- */

  keysRef.current = (event: KeyboardEvent) => {
    const target = event.target as HTMLElement | null;
    const typing =
      target &&
      (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);

    if (event.key === "Escape") {
      setShowKeys(false);
      setShowExport(false);
      if (typing) (target as HTMLInputElement).blur();
      return;
    }
    if (typing) return;

    const mod = event.ctrlKey || event.metaKey;
    const key = event.key.toLowerCase();

    if (mod && key === "z" && !event.shiftKey) {
      event.preventDefault();
      undo();
    } else if ((mod && key === "y") || (mod && event.shiftKey && key === "z")) {
      event.preventDefault();
      redo();
    } else if (mod && key === "b") {
      event.preventDefault();
      splitAt(timeRef.current);
    } else if (mod && key === "d") {
      event.preventDefault();
      duplicateSelected();
    } else if (mod && key === "i") {
      event.preventDefault();
      fileRef.current?.click();
    } else if (mod && key === "e") {
      event.preventDefault();
      setResult(null);
      setShowExport(true);
    } else if (mod && key === "j") {
      event.preventDefault();
      setDirectorOpen(true);
    } else if (event.key === " ") {
      event.preventDefault();
      if (playingRef.current) pause();
      else play();
    } else if (key === "b") {
      setMode("split");
    } else if (key === "a") {
      setMode("select");
    } else if (key === "delete" || key === "backspace") {
      event.preventDefault();
      deleteSelected();
    } else if (key === "j") {
      seek(timeRef.current - 2);
    } else if (key === "k") {
      pause();
    } else if (key === "l") {
      seek(timeRef.current + 2);
    } else if (key === "q") {
      const clip = selectedClip(projectStateRef.current, selectedRef.current);
      if (clip && timeRef.current > clip.start && timeRef.current < clip.start + clip.duration) {
        const shift = timeRef.current - clip.start;
        patchClip(clip.id, {
          start: clip.start + shift,
          duration: clip.duration - shift,
          srcIn: clip.srcIn + shift,
        });
        pushLog("system", `Trimmed-in "${clip.name ?? clip.kind}" to ${formatClock(timeRef.current)}.`);
      }
    } else if (key === "w") {
      const clip = selectedClip(projectStateRef.current, selectedRef.current);
      if (clip && timeRef.current > clip.start + 0.2) {
        patchClip(clip.id, { duration: timeRef.current - clip.start });
        pushLog("system", `Trimmed-out "${clip.name ?? clip.kind}" to ${formatClock(timeRef.current)}.`);
      }
    } else if (key === "n") {
      setSnap((prev) => !prev);
    } else if (key === "m") {
      setMasterMuted((prev) => !prev);
    } else if (key === "f") {
      const box = playerBoxRef.current;
      if (!document.fullscreenElement) void box?.requestFullscreen().catch(() => {});
      else void document.exitFullscreen().catch(() => {});
    } else if (key === "?" || (event.shiftKey && event.key === "/")) {
      setShowKeys((prev) => !prev);
    } else if (event.key === "+" || event.key === "=") {
      setPps((prev) => clamp(Math.round(prev * 1.4), 8, 400));
    } else if (event.key === "-" || event.key === "_") {
      setPps((prev) => clamp(Math.round(prev / 1.4), 8, 400));
    } else if (event.key === "Home") {
      seek(0);
    } else if (event.key === "End") {
      seek(projectDuration(projectStateRef.current));
    } else if (event.key === "ArrowLeft") {
      seek(timeRef.current - (event.shiftKey ? 1 : 1 / 10));
    } else if (event.key === "ArrowRight") {
      seek(timeRef.current + (event.shiftKey ? 1 : 1 / 10));
    } else if (event.key === "!" || (event.shiftKey && event.key === "1")) {
      setPps(24);
    }
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => keysRef.current(e);
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  /* ----------------------------- cleanup ------------------------------ */

  useEffect(() => {
    const elements = elsRef.current;
    const urls = binUrlsRef.current;
    return () => {
      for (const { el } of elements.values()) {
        el.pause();
        el.removeAttribute("src");
      }
      for (const url of urls) URL.revokeObjectURL(url);
      urls.clear();
      if (capRecRef.current) capRecRef.current.stop();
      void acRef.current?.close().catch(() => {});
    };
  }, []);

  /* ------------------------------ views ------------------------------ */

  const patchClipLive = useCallback((id: string, patch: Partial<Clip>) => {
    setProject((prev) => ({
      ...prev,
      clips: prev.clips.map((clip) => (clip.id === id ? { ...clip, ...patch } : clip)),
    }));
    dirtyRef.current = true;
  }, []);

  const TOOLS: { id: ToolId; label: string; icon: string }[] = [
    { id: "media", label: "Media", icon: "▣" },
    { id: "audio", label: "Audio", icon: "♪" },
    { id: "text", label: "Text", icon: "T" },
    { id: "stickers", label: "Stickers", icon: "✦" },
    { id: "effects", label: "Effects", icon: "✱" },
    { id: "transitions", label: "Transitions", icon: "◇" },
    { id: "captions", label: "Captions", icon: "▤" },
    { id: "filters", label: "Filters", icon: "◐" },
    { id: "adjust", label: "Adjust", icon: "◍" },
    { id: "templates", label: "Looks", icon: "▦" },
  ];

  const CHIPS = [
    "Split at the playhead",
    "Make it 9:16 vertical",
    "Add fade transitions",
    "Film grain over everything",
    "Add text: NEW TITLE",
  ];

  const aspect = aspectOf(project.ratio);

  const mp4Supported = useMemo(() => {
    try {
      return (
        typeof MediaRecorder !== "undefined" &&
        (MediaRecorder.isTypeSupported("video/mp4;codecs=avc1.42E01E,mp4a.40.2") ||
          MediaRecorder.isTypeSupported("video/mp4"))
      );
    } catch {
      return false;
    }
  }, []);

  const rulerTicks = useMemo(() => {
    const span = Math.max(duration + 12, 30);
    const steps = [0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300];
    const step = steps.find((s) => s * pps >= 74) ?? 600;
    const out: number[] = [];
    for (let t = 0; t <= span; t += step) out.push(Number(t.toFixed(2)));
    return out;
  }, [duration, pps]);

  useEffect(() => {
    if (playheadRef.current) playheadRef.current.style.left = `${timeRef.current * pps}px`;
  }, [pps]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ block: "end" });
  }, [log, aiBusy]);

  const assetName = (asset: MediaAsset): string => {
    const first = (asset.prompt ?? "").split("\n").find((line) => line.trim());
    if (first) return first.trim().slice(0, 64);
    return asset.storage_path.split("/").pop() || `omniai-${asset.kind}`;
  };

  const addTextClip = (partial: Partial<Clip> & { text: string }) => {
    const clip: Clip = {
      id: uid("clip"),
      kind: "text",
      track: 2,
      start: timeRef.current,
      duration: 3,
      srcIn: 0,
      x: 0.5,
      y: 0.5,
      fontSize: 56,
      color: "#F4F1FF",
      font: "sans",
      weight: 700,
      align: "center",
      bg: false,
      opacity: 1,
      scale: 1,
      inAnim: "fade",
      outAnim: "fade",
      ...partial,
    };
    commit((draft) => {
      draft.clips.push(clip);
    });
    setSelectedId(clip.id);
    pushLog("system", `Text clip added at ${formatClock(clip.start)}.`);
    dirtyRef.current = true;
  };

  const addStickerClip = (glyph: string) => {
    const clip: Clip = {
      id: uid("clip"),
      kind: "sticker",
      track: 1,
      start: timeRef.current,
      duration: 3,
      srcIn: 0,
      text: glyph,
      x: 0.5,
      y: 0.42,
      fontSize: 120,
      opacity: 1,
      scale: 1,
      rotate: 0,
      inAnim: "pop",
      outAnim: "fade",
    };
    commit((draft) => {
      draft.clips.push(clip);
    });
    setSelectedId(clip.id);
    pushLog("system", `Sticker ${glyph} added at ${formatClock(clip.start)}.`);
    dirtyRef.current = true;
  };

  const applyLookField = (field: "filter" | "effect", value: FilterId | EffectId) => {
    if (!current || !KIND_MEDIA.has(current.kind)) {
      toast("Select a video/image clip on the timeline first.", "warn");
      return;
    }
    patchClip(current.id, { [field]: value } as Partial<Clip>);
  };

  const mediaBin = bin;
  const audioBin = bin.filter((item) => item.kind === "audio");
  const captionClips = project.clips
    .filter((clip) => clip.kind === "caption")
    .sort((a, b) => a.start - b.start);

  function renderPanel(): React.ReactNode {
    const head = (label: string, hint: string) => (
      <div className="ve-panel-head">
        <b>{label}</b>
        <span>{hint}</span>
      </div>
    );

    switch (tool) {
      case "media":
        return (
          <>
            {head("MEDIA", "import your own files — nothing stock")}
            <div className="ve-panel-tabs">
              <button type="button" className={binTab === "local" ? "is-on" : ""} onClick={() => setBinTab("local")}>
                THIS MACHINE
              </button>
              <button type="button" className={binTab === "cloud" ? "is-on" : ""} onClick={() => setBinTab("cloud")}>
                CLOUD LIBRARY
              </button>
            </div>
            <div className="ve-panel-scroll">
              {binTab === "local" ? (
                <>
                  <button type="button" className="ve-import" onClick={() => fileRef.current?.click()}>
                    <b>＋ IMPORT</b>
                    <span>video · audio · images — or Ctrl I</span>
                  </button>
                  {mediaBin.length === 0 ? (
                    <p className="ve-empty-note">
                      Nothing imported yet. Files stay on this machine — object URLs, revoked when you leave.
                    </p>
                  ) : (
                    <div className="ve-bin">
                      {mediaBin.map((item) => (
                        <div key={item.id} className="ve-bin-card">
                          <span className="ve-bin-kind">
                            {item.kind === "video" ? "▶" : item.kind === "audio" ? "♪" : "▣"}
                          </span>
                          <span className="ve-bin-name" title={item.name}>
                            {item.name}
                          </span>
                          <div className="ve-bin-acts">
                            <button type="button" onClick={() => void addToTimeline(item)}>
                              ＋ timeline
                            </button>
                            <button
                              type="button"
                              title="Remove from bin"
                              onClick={() => {
                                setBin((b) => b.filter((x) => x.id !== item.id));
                                const stillUsed = projectStateRef.current.clips.some(
                                  (clip) => clip.url === item.url,
                                );
                                if (!stillUsed) {
                                  URL.revokeObjectURL(item.url);
                                  binUrlsRef.current.delete(item.url);
                                }
                              }}
                            >
                              ×
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <>
                  {loadingLib && <p className="ve-empty-note">Loading your library…</p>}
                  {!loadingLib && libError && <p className="ve-alert">{libError}</p>}
                  {!loadingLib && !libError && assets.length === 0 && (
                    <p className="ve-empty-note">
                      {signedIn ? (
                        "Cloud library is empty — upload from the Media Studio."
                      ) : (
                        <>
                          Sign in to reach your cloud library — or stay local.{" "}
                          <Link href="/studio/assets">Media Library →</Link>
                        </>
                      )}
                    </p>
                  )}
                  {!loadingLib && !libError && assets.length > 0 && (
                    <div className="ve-bin">
                      {assets.map((asset) => {
                        const url = libUrls[asset.storage_path];
                        return (
                          <div key={asset.id} className="ve-bin-card">
                            <span className="ve-bin-kind">
                              {asset.kind === "video" ? "▶" : asset.kind === "audio" ? "♪" : "▣"}
                            </span>
                            <span className="ve-bin-name" title={assetName(asset)}>
                              {assetName(asset)}
                            </span>
                            <div className="ve-bin-acts">
                              <button
                                type="button"
                                disabled={!url}
                                onClick={() =>
                                  void addToTimeline({
                                    url: url as string,
                                    name: assetName(asset),
                                    kind: asset.kind,
                                    mime: asset.mime_type ?? "",
                                  })
                                }
                              >
                                ＋ timeline
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        );

      case "audio":
        return (
          <>
            {head("AUDIO", "music & sound land on the AUDIO lane")}
            <div className="ve-panel-scroll">
              <p className="ve-note">
                Want new music? Compose it first in the{" "}
                <Link href="/music">Music Studio →</Link> then pull it from the cloud library.
              </p>
              <button type="button" className="ve-import" onClick={() => fileRef.current?.click()}>
                <b>＋ IMPORT AUDIO</b>
                <span>mp3 · wav · m4a · ogg — or Ctrl I</span>
              </button>
              {audioBin.length === 0 ? (
                <p className="ve-empty-note">No audio files in the bin yet.</p>
              ) : (
                <div className="ve-bin">
                  {audioBin.map((item) => (
                    <div key={item.id} className="ve-bin-card">
                      <span className="ve-bin-kind">♪</span>
                      <span className="ve-bin-name" title={item.name}>
                        {item.name}
                      </span>
                      <div className="ve-bin-acts">
                        <button type="button" onClick={() => void addToTimeline(item)}>
                          ＋ timeline
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <p className="ve-empty-note">Select an audio clip for volume + waveform in the inspector.</p>
            </div>
          </>
        );

      case "text":
        return (
          <>
            {head("TEXT", "titles ride the TEXT track at the playhead")}
            <div className="ve-panel-scroll">
              <div className="ve-preset-grid">
                {TEXT_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    className="ve-preset"
                    onClick={() =>
                      addTextClip({
                        text: preset.text,
                        fontSize: preset.size,
                        font: preset.font,
                        weight: preset.weight,
                        color: preset.color,
                        x: preset.x,
                        y: preset.y,
                        align: preset.align,
                        bg: preset.bg,
                      })
                    }
                  >
                    <span
                      style={{
                        fontFamily: FONTS[preset.font],
                        color: preset.color,
                        fontWeight: preset.weight,
                        textAlign: preset.align,
                      }}
                    >
                      {preset.text}
                    </span>
                    <em>{preset.label}</em>
                  </button>
                ))}
              </div>
              <div className="ve-composer">
                <textarea
                  rows={2}
                  value={draftText}
                  placeholder="Type your own line…"
                  onChange={(e) => setDraftText(e.target.value)}
                />
                <button
                  type="button"
                  className="ve-key"
                  onClick={() => {
                    const body = draftText.trim() || "YOUR TEXT";
                    addTextClip({ text: body.slice(0, 300) });
                    setDraftText("");
                  }}
                >
                  ＋ Add at playhead
                </button>
              </div>
            </div>
          </>
        );

      case "stickers":
        return (
          <>
            {head("STICKERS", "unicode glyphs — real glyphs, no fake packs")}
            <div className="ve-panel-scroll">
              <div className="ve-glyphs">
                {STICKER_GLYPHS.map((glyph, i) => (
                  <button key={`${glyph}-${i}`} type="button" onClick={() => addStickerClip(glyph)}>
                    {glyph}
                  </button>
                ))}
              </div>
              <p className="ve-empty-note">Stickers land on the OVERLAY track — drag to reposition, size in the inspector.</p>
            </div>
          </>
        );

      case "effects":
        return (
          <>
            {head("EFFECTS", "per-clip stylisation drawn on the canvas")}
            <div className="ve-panel-scroll">
              <p className="ve-note">
                {current ? `Applying to: ${current.name ?? current.text ?? current.kind}` : "Select a clip on the timeline first."}
              </p>
              <div className="ve-card-grid">
                {EFFECTS.map((fx) => (
                  <button
                    key={fx.id}
                    type="button"
                    className={`ve-look${current?.effect === fx.id ? " is-on" : ""}`}
                    onClick={() => applyLookField("effect", fx.id)}
                  >
                    <b>{fx.label}</b>
                    <span>{fx.hint}</span>
                  </button>
                ))}
              </div>
            </div>
          </>
        );

      case "filters":
        return (
          <>
            {head("FILTERS", "colour grades via the canvas filter chain")}
            <div className="ve-panel-scroll">
              <p className="ve-note">
                {current ? `Applying to: ${current.name ?? current.text ?? current.kind}` : "Select a clip on the timeline first."}
              </p>
              <div className="ve-card-grid">
                {FILTERS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    className={`ve-look${current?.filter === f.id ? " is-on" : ""}`}
                    onClick={() => applyLookField("filter", f.id)}
                  >
                    <b>{f.label}</b>
                    <span>{f.hint}</span>
                  </button>
                ))}
              </div>
            </div>
          </>
        );

      case "transitions":
        return (
          <>
            {head("TRANSITIONS", "attaches to the outgoing cut of your selection")}
            <div className="ve-panel-scroll">
              <label className="ve-field">
                <span>DURATION {transDur.toFixed(2)}s</span>
                <input
                  type="range"
                  min={0.2}
                  max={2.5}
                  step={0.1}
                  value={transDur}
                  onChange={(e) => setTransDur(Number(e.target.value))}
                />
              </label>
              <div className="ve-card-grid">
                {TRANSITIONS.map((tr) => (
                  <button
                    key={tr.id}
                    type="button"
                    className="ve-look"
                    onClick={() => setTransitionOnSelected(tr.id, transDur)}
                  >
                    <b>{tr.label}</b>
                    <span>{tr.hint}</span>
                  </button>
                ))}
              </div>
              <p className="ve-empty-note">
                Select a clip that has a neighbour right after it on the same track. Or ask the Director for
                &quot;fades at every cut&quot;.
              </p>
            </div>
          </>
        );

      case "captions":
        return (
          <>
            {head("CAPTIONS", "bottom-band text on the TEXT track")}
            <div className="ve-panel-scroll">
              <div className="ve-composer">
                <textarea
                  rows={2}
                  value={capDraft}
                  placeholder="Type a caption…"
                  onChange={(e) => setCapDraft(e.target.value)}
                />
                <button
                  type="button"
                  className="ve-key"
                  onClick={() => {
                    const body = capDraft.trim();
                    if (!body) {
                      toast("Type the caption first.", "warn");
                      return;
                    }
                    addTextClip({
                      kind: "caption",
                      text: body.slice(0, 300),
                      y: 0.9,
                      fontSize: 34,
                      color: "#FFFFFF",
                      bg: true,
                      align: "center",
                    });
                    setCapDraft("");
                  }}
                >
                  ＋ Add at playhead
                </button>
              </div>
              <button type="button" className="ve-import" onClick={toggleAutoCaptions}>
                <b>{capRecRef.current ? "■ STOP LISTENING" : "● AUTO CAPTIONS (experimental)"}</b>
                <span>uses your microphone to hear the room while the timeline plays</span>
              </button>
              {capState && <p className="ve-note">{capState}</p>}
              {captionClips.length === 0 ? (
                <p className="ve-empty-note">No captions yet.</p>
              ) : (
                <div className="ve-bin">
                  {captionClips.map((clip) => (
                    <div
                      key={clip.id}
                      className={`ve-bin-card${clip.id === selectedId ? " is-on" : ""}`}
                      onClick={() => {
                        setSelectedId(clip.id);
                        seek(clip.start);
                      }}
                    >
                      <span className="ve-bin-kind">▤</span>
                      <span className="ve-bin-name" title={clip.text}>
                        {formatClock(clip.start)} — {clip.text}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        );

      case "adjust":
        return (
          <>
            {head("ADJUST", "brightness · contrast · saturation · temperature")}
            <div className="ve-panel-scroll">
              {!current || !KIND_MEDIA.has(current.kind) ? (
                <p className="ve-empty-note">Select a video/image clip on the timeline to grade it.</p>
              ) : (
                <>
                  <p className="ve-note">Grading: {current.name ?? current.kind}</p>
                  {(
                    [
                      ["brightness", 0.3, 2.2],
                      ["contrast", 0.3, 2.2],
                      ["saturate", 0, 2.6],
                      ["temperature", -1, 1],
                    ] as const
                  ).map(([key, min, max]) => {
                    const value = (current.adjust ?? defaultAdjust())[key];
                    return (
                      <label key={key} className="ve-field">
                        <span>
                          {key.toUpperCase()} {value.toFixed(2)}
                        </span>
                        <input
                          type="range"
                          min={min}
                          max={max}
                          step={0.01}
                          value={value}
                          onPointerDown={pushHistory}
                          onChange={(e) =>
                            patchClipLive(current.id, {
                              adjust: { ...(current.adjust ?? defaultAdjust()), [key]: Number(e.target.value) },
                            })
                          }
                        />
                      </label>
                    );
                  })}
                  <button
                    type="button"
                    className="ve-tbtn"
                    onClick={() => patchClip(current.id, { adjust: defaultAdjust() })}
                  >
                    RESET GRADE
                  </button>
                </>
              )}
            </div>
          </>
        );

      case "templates":
        return (
          <>
            {head("LOOKS", "one click re-grades the whole timeline")}
            <div className="ve-panel-scroll">
              <div className="ve-card-grid">
                {TEMPLATES.map((tpl) => (
                  <button key={tpl.id} type="button" className="ve-look" onClick={() => applyTemplate(tpl.id)}>
                    <b>{tpl.label}</b>
                    <span>{tpl.blurb}</span>
                  </button>
                ))}
              </div>
              <p className="ve-empty-note">Looks overwrite per-clip grades and set transitions at every cut.</p>
            </div>
          </>
        );

      default:
        return null;
    }
  }

  return (
    <div
      className="ve h-screen overflow-hidden"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        void importFiles(e.dataTransfer.files);
      }}
    >
      <header className="ve-head">
        <div className="ve-title">
          <p className="ve-eyebrow">OMNIAI / MULTI-TRACK CUTTER</p>
          <h1>OmniMotion</h1>
        </div>
        <label className="ve-namefield">
          <span>TIMELINE</span>
          <input
            value={project.name}
            onChange={(e) => setProject((prev) => ({ ...prev, name: e.target.value }))}
            maxLength={40}
          />
        </label>
        <div className="ve-head-acts">
          <button type="button" className="ve-chip" onClick={() => setShowKeys(true)} title="Shortcuts (?)">
            ⌨ SHORTCUTS
          </button>
          <button
            type="button"
            className={`ve-chip${directorOpen ? " is-on" : ""}`}
            onClick={() => setDirectorOpen((v) => !v)}
            title="Ctrl J"
          >
            ✦ DIRECTOR{aiBusy ? " …" : ""}
          </button>
          <button
            type="button"
            className="ve-key"
            onClick={() => {
              setResult(null);
              setShowExport(true);
            }}
            title="Ctrl E"
          >
            ⬇ EXPORT
          </button>
        </div>
      </header>

      <div className="ve-body">
        <div className="ve-controls">
        <nav className="ve-rail" aria-label="Editor tools">
          {TOOLS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className={`ve-rail-btn${tool === entry.id ? " is-on" : ""}`}
              onClick={() => setTool(entry.id)}
              title={entry.label}
            >
              <i>{entry.icon}</i>
              <span>{entry.label}</span>
            </button>
          ))}
        </nav>

        <section className="ve-panel">
          <DisplaySurface accent="#6C63FF" state={aiBusy ? "busy" : playing ? "good" : "idle"} seed={21} />
          <div className="ve-panel-in">{renderPanel()}</div>
        </section>
        <aside className="ve-details">
          <DisplaySurface accent="#00F2FE" state={exporting ? "busy" : playing ? "good" : "idle"} seed={44} />
          <div className="ve-det-in">
            <p className="ve-kicker">DETAILS</p>
            <div className="ve-row">
              <span>ASPECT</span>
              <div className="ve-seg">
                {ASPECTS.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    className={project.ratio === a.id ? "is-on" : ""}
                    onClick={() => patchProject({ ratio: a.id })}
                  >
                    {a.id}
                  </button>
                ))}
              </div>
            </div>
            <div className="ve-row">
              <span>CANVAS</span>
              <b>
                {aspect.w} × {aspect.h}
              </b>
            </div>
            <div className="ve-row">
              <span>DURATION</span>
              <b>{formatClock(duration)}</b>
            </div>
            <div className="ve-row">
              <span>CLIPS</span>
              <b>
                {project.clips.length} · {project.transitions.length} trans
              </b>
            </div>
            <div className="ve-row">
              <span>EXPORT</span>
              <b>
                real-time · {exportOpts.height}p · {exportOpts.fps}fps
              </b>
            </div>

            {current ? (
              <div className="ve-insp">
                <p className="ve-kicker">
                  SELECTED · {current.kind.toUpperCase()}
                </p>
                <div className="ve-row">
                  <span>IN</span>
                  <b>{formatClock(current.start)}</b>
                </div>
                <div className="ve-row">
                  <span>LENGTH</span>
                  <b>{formatClock(current.duration)}</b>
                </div>
                <div className="ve-row">
                  <span>SOURCE</span>
                  <b>{formatClock(current.srcIn)}</b>
                </div>

                {(current.kind === "video" || current.kind === "audio") && (
                  <label className="ve-field">
                    <span>VOLUME {(current.volume ?? 1).toFixed(2)}</span>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.01}
                      value={current.volume ?? 1}
                      onPointerDown={pushHistory}
                      onChange={(e) => patchClipLive(current.id, { volume: Number(e.target.value) })}
                    />
                  </label>
                )}

                <div className="ve-btnrow">
                  {KIND_MEDIA.has(current.kind) && (
                    <button
                      type="button"
                      className={`ve-tbtn${current.muted ? " is-on" : ""}`}
                      onClick={() => patchClip(current.id, { muted: !current.muted })}
                    >
                      {current.muted ? "MUTED" : "MUTE"}
                    </button>
                  )}
                  {KIND_MEDIA.has(current.kind) && current.kind !== "audio" && (
                    <button
                      type="button"
                      className="ve-tbtn"
                      onClick={() => patchClip(current.id, { fit: current.fit === "contain" ? "cover" : "contain" })}
                    >
                      {current.fit === "contain" ? "CONTAIN" : "COVER"}
                    </button>
                  )}
                  {KIND_MEDIA.has(current.kind) && (
                    <button
                      type="button"
                      className="ve-tbtn"
                      onClick={() =>
                        patchClip(current.id, { filter: "none", effect: "none", adjust: defaultAdjust() })
                      }
                    >
                      RESET LOOK
                    </button>
                  )}
                </div>

                {(current.kind === "text" || current.kind === "caption") && (
                  <label className="ve-field ve-field-wide">
                    <span>CONTENT</span>
                    <textarea
                      rows={2}
                      value={current.text ?? ""}
                      onFocus={pushHistory}
                      onChange={(e) => patchClipLive(current.id, { text: e.target.value })}
                    />
                  </label>
                )}

                {(current.kind === "text" || current.kind === "caption") && (
                  <>
                    <div className="ve-btnrow">
                      {(Object.keys(FONTS) as FontId[]).map((f) => (
                        <button
                          key={f}
                          type="button"
                          className={`ve-tbtn${current.font === f ? " is-on" : ""}`}
                          onClick={() => patchClip(current.id, { font: f })}
                        >
                          {f.toUpperCase()}
                        </button>
                      ))}
                    </div>
                    <label className="ve-field">
                      <span>SIZE {current.fontSize ?? 56}</span>
                      <input
                        type="range"
                        min={18}
                        max={180}
                        step={1}
                        value={current.fontSize ?? 56}
                        onPointerDown={pushHistory}
                        onChange={(e) => patchClipLive(current.id, { fontSize: Number(e.target.value) })}
                      />
                    </label>
                    <div className="ve-btnrow">
                      <input
                        type="color"
                        className="ve-color"
                        value={current.color ?? "#F4F1FF"}
                        onPointerDown={pushHistory}
                        onChange={(e) => patchClipLive(current.id, { color: e.target.value })}
                      />
                      {(["left", "center", "right"] as const).map((a) => (
                        <button
                          key={a}
                          type="button"
                          className={`ve-tbtn${current.align === a ? " is-on" : ""}`}
                          onClick={() => patchClip(current.id, { align: a })}
                        >
                          {a[0].toUpperCase()}
                        </button>
                      ))}
                      <button
                        type="button"
                        className={`ve-tbtn${current.bg ? " is-on" : ""}`}
                        onClick={() => patchClip(current.id, { bg: !current.bg })}
                      >
                        BG
                      </button>
                    </div>
                    <div className="ve-btnrow">
                      <span className="ve-mini">IN</span>
                      {ANIMS.map((a) => (
                        <button
                          key={`in-${a}`}
                          type="button"
                          className={`ve-tbtn${current.inAnim === a ? " is-on" : ""}`}
                          onClick={() => patchClip(current.id, { inAnim: a })}
                        >
                          {a}
                        </button>
                      ))}
                    </div>
                    <div className="ve-btnrow">
                      <span className="ve-mini">OUT</span>
                      {ANIMS.map((a) => (
                        <button
                          key={`out-${a}`}
                          type="button"
                          className={`ve-tbtn${current.outAnim === a ? " is-on" : ""}`}
                          onClick={() => patchClip(current.id, { outAnim: a })}
                        >
                          {a}
                        </button>
                      ))}
                    </div>
                  </>
                )}

                {current.kind === "sticker" && (
                  <>
                    <label className="ve-field">
                      <span>SIZE {current.fontSize ?? 120}</span>
                      <input
                        type="range"
                        min={40}
                        max={280}
                        step={1}
                        value={current.fontSize ?? 120}
                        onPointerDown={pushHistory}
                        onChange={(e) => patchClipLive(current.id, { fontSize: Number(e.target.value) })}
                      />
                    </label>
                    <label className="ve-field">
                      <span>ROTATE {current.rotate ?? 0}°</span>
                      <input
                        type="range"
                        min={-180}
                        max={180}
                        step={1}
                        value={current.rotate ?? 0}
                        onPointerDown={pushHistory}
                        onChange={(e) => patchClipLive(current.id, { rotate: Number(e.target.value) })}
                      />
                    </label>
                  </>
                )}

                {(current.track === 1 || current.track === 2) && (
                  <>
                    <label className="ve-field">
                      <span>OPACITY {Math.round((current.opacity ?? 1) * 100)}%</span>
                      <input
                        type="range"
                        min={0.05}
                        max={1}
                        step={0.01}
                        value={current.opacity ?? 1}
                        onPointerDown={pushHistory}
                        onChange={(e) => patchClipLive(current.id, { opacity: Number(e.target.value) })}
                      />
                    </label>
                    <div className="ve-field">
                      <span>KEYFRAMES {current.keys?.length ?? 0}</span>
                      <div className="ve-btnrow">
                        <button
                          type="button"
                          className="ve-tbtn"
                          onClick={() => {
                            const tRel = Math.max(0, timeRef.current - current.start);
                            const frame = evalKeys(current, tRel);
                            pushHistory();
                            patchClipLive(current.id, {
                              keys: [
                                ...(current.keys ?? []),
                                {
                                  t: Number(tRel.toFixed(2)),
                                  x: frame.x,
                                  y: frame.y,
                                  scale: frame.scale,
                                  opacity: frame.opacity,
                                },
                              ].sort((a, b) => a.t - b.t),
                            });
                            toast("Keyframe added at the playhead.", "ok");
                          }}
                        >
                          ＋ AT PLAYHEAD
                        </button>
                        {(current.keys?.length ?? 0) > 0 && (
                          <button
                            type="button"
                            className="ve-tbtn"
                            onClick={() => patchClip(current.id, { keys: [] })}
                          >
                            CLEAR
                          </button>
                        )}
                      </div>
                      {(current.keys?.length ?? 0) > 0 && (
                        <ul className="ve-keys">
                          {(current.keys ?? []).map((k, i) => (
                            <li key={`${k.t}-${i}`}>
                              <span>t {k.t.toFixed(1)}s</span>
                              <button
                                type="button"
                                onClick={() => {
                                  pushHistory();
                                  patchClipLive(current.id, { keys: (current.keys ?? []).filter((_, j) => j !== i) });
                                }}
                              >
                                ×
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </>
                )}

                <div className="ve-btnrow ve-insp-acts">
                  <button type="button" className="ve-tbtn" onClick={duplicateSelected}>
                    ⧉ DUPLICATE
                  </button>
                  <button type="button" className="ve-tbtn is-danger" onClick={deleteSelected}>
                    🗑 DELETE
                  </button>
                </div>
              </div>
            ) : (
              <p className="ve-empty-note">
                Select a clip on the timeline to edit it. Everything here renders from your own files — no stock,
                no filler.
              </p>
            )}
          </div>
        </aside>
        </div>
        <section className="ve-center">
          <div className="ve-player" ref={playerBoxRef}>
            <div className="ve-screen" style={{ aspectRatio: `${aspect.w} / ${aspect.h}` }}>
              <canvas ref={canvasRef} />
              {project.clips.length === 0 && (
                <div className="ve-screen-empty">
                  <p>NO CLIPS ON THE TIMELINE</p>
                  <button type="button" className="ve-key" onClick={() => fileRef.current?.click()}>
                    ＋ Import media
                  </button>
                </div>
              )}
            </div>
            <div className="ve-transport">
              <button
                type="button"
                className="ve-play"
                onClick={() => {
                  if (playingRef.current) pause();
                  else play();
                }}
                title="Space"
              >
                {playing ? "❚❚" : "▶"}
              </button>
              <span className="ve-tc" ref={tcRef}>
                00:00.00
              </span>
              <span className="ve-tcdur">/ {formatClock(duration)}</span>
              <span className="ve-spacer" />
              <button
                type="button"
                className={`ve-tbtn${masterMuted ? " is-on" : ""}`}
                onClick={() => setMasterMuted((v) => !v)}
                title="M"
              >
                {masterMuted ? "🔇" : "🔊"}
              </button>
              <button
                type="button"
                className="ve-tbtn"
                onClick={() => {
                  const box = playerBoxRef.current;
                  if (!document.fullscreenElement) void box?.requestFullscreen().catch(() => {});
                  else void document.exitFullscreen().catch(() => {});
                }}
                title="F"
              >
                ⛶
              </button>
            </div>
          </div>
        </section>
      </div>      <section className="ve-timeline">
        <div className="ve-tl-bar">
          <button
            type="button"
            className="ve-tbtn"
            onClick={() => fileRef.current?.click()}
            title="Import (Ctrl I)"
          >
            ＋
          </button>
          <div className="ve-mode">
            <button
              type="button"
              className={`ve-tbtn${mode === "select" ? " is-on" : ""}`}
              onClick={() => setMode("select")}
              title="A"
            >
              ↖ SELECT
            </button>
            <button
              type="button"
              className={`ve-tbtn${mode === "split" ? " is-on" : ""}`}
              onClick={() => setMode("split")}
              title="B"
            >
              ✂ SPLIT
            </button>
          </div>
          <span className="ve-sep" />
          <button type="button" className="ve-tbtn" onClick={undo} title="Ctrl Z">
            ↺
          </button>
          <button type="button" className="ve-tbtn" onClick={redo} title="Ctrl Y">
            ↻
          </button>
          <button type="button" className="ve-tbtn" onClick={() => splitAt(timeRef.current)} title="Ctrl B">
            ✂ CUT
          </button>
          <button type="button" className="ve-tbtn" onClick={duplicateSelected} title="Ctrl D">
            ⧉
          </button>
          <button type="button" className="ve-tbtn" onClick={deleteSelected} title="Del">
            🗑
          </button>
          <span className="ve-sep" />
          <button
            type="button"
            className={`ve-tbtn${snap ? " is-on" : ""}`}
            onClick={() => setSnap((v) => !v)}
            title="N"
          >
            🧲 SNAP
          </button>
          <span className="ve-sep" />
          <button
            type="button"
            className="ve-tbtn"
            onClick={() => setPps((prev) => clamp(Math.round(prev / 1.4), 8, 400))}
          >
            −
          </button>
          <input
            className="ve-zoom"
            type="range"
            min={8}
            max={400}
            step={1}
            value={pps}
            onChange={(e) => setPps(Number(e.target.value))}
          />
          <button
            type="button"
            className="ve-tbtn"
            onClick={() => setPps((prev) => clamp(Math.round(prev * 1.4), 8, 400))}
          >
            ＋
          </button>
          <button type="button" className="ve-tbtn" onClick={() => setPps(24)} title="Shift 1">
            FIT
          </button>
          <span className="ve-spacer" />
          <canvas className="ve-meter" ref={meterRef} title="Audio meter" />
          <span className="ve-tl-tc">{formatClock(duration)}</span>
        </div>

        <div className="ve-tl-scroll" ref={scrollRef}>
          <div
            className="ve-tl-inner"
            style={{ width: Math.max((duration + 10) * pps, 900) }}
          >
            <div className="ve-ruler" onPointerDown={onLanePointerDown}>
              {rulerTicks.map((tick) => (
                <span key={tick} className="ve-tick" style={{ left: tick * pps }}>
                  {formatClock(tick)}
                </span>
              ))}
            </div>
            <div className="ve-lanes">
              {TRACKS.map((track, ti) => (
                <div
                  key={track.label}
                  className="ve-lane"
                  ref={(el) => {
                    laneRefs.current[ti] = el;
                  }}
                  onPointerDown={onLanePointerDown}
                >
                  <span className="ve-lane-tag">
                    {track.label}
                    <em>{track.hint}</em>
                  </span>
                  {project.clips
                    .filter((clip) => clip.track === ti)
                    .sort((a, b) => a.start - b.start)
                    .map((clip) => {
                      const isSelected = clip.id === selectedId;
                      const wave = clip.kind === "audio" && clip.url ? waves[clip.url] : null;
                      const thumb = thumbs[clip.id];
                      return (
                        <div
                          key={clip.id}
                          className={`ve-clip is-${clip.kind}${isSelected ? " is-sel" : ""}${clip.muted ? " is-mute" : ""}`}
                          style={{ left: clip.start * pps, width: Math.max(8, clip.duration * pps) }}
                          onPointerDown={(e) => onClipPointerDown(e, clip)}
                          title={clip.name ?? clip.text ?? clip.kind}
                        >
                          {clip.kind === "video" && thumb && (
                            <span className="ve-clip-thumb" style={{ backgroundImage: `url(${thumb})` }} />
                          )}
                          {clip.kind === "image" && clip.url && (
                            <span className="ve-clip-thumb" style={{ backgroundImage: `url(${clip.url})` }} />
                          )}
                          {wave ? <ClipWave wave={wave} srcIn={clip.srcIn} clipDur={clip.duration} /> : null}
                          <span className="ve-clip-label">
                            {clip.kind === "text" || clip.kind === "caption"
                              ? `T ${clip.text ?? ""}`
                              : clip.kind === "sticker"
                                ? clip.text
                                : clip.name ?? clip.kind}
                          </span>
                          <span className="ve-clip-time">{formatClock(clip.duration)}</span>
                          <span className="ve-clip-h" data-handle="in" />
                          <span className="ve-clip-h is-out" data-handle="out" />
                        </div>
                      );
                    })}
                </div>
              ))}
            </div>
            <div className="ve-playhead" ref={playheadRef}>
              <span className="ve-ph-cap" />
            </div>
            {project.clips.length === 0 && (
              <p className="ve-tl-empty">Drop files here and start to create — or press Ctrl I</p>
            )}
          </div>
        </div>
      </section>

      {directorOpen && (
        <aside className="ve-director">
          <DisplaySurface accent="#A78BFA" state={aiBusy ? "busy" : "good"} seed={91} />
          <div className="ve-dir-in">
            <header className="ve-dir-head">
              <p className="ve-kicker">✦ DIRECTOR</p>
              <span className={`ve-chip-mini${signedIn ? " is-ai" : " is-house"}`}>
                {signedIn ? "AI MODEL" : "OFFLINE · HOUSE"}
              </span>
              <button type="button" className="ve-x" onClick={() => setDirectorOpen(false)}>
                ×
              </button>
            </header>
            <div className="ve-dir-log">
              {log.map((entry) => (
                <p key={entry.id} className={`ve-line is-${entry.from}`}>
                  <b>{entry.from === "user" ? "YOU" : entry.from === "ai" ? "AI" : entry.from === "house" ? "HOUSE" : "SYS"}</b>
                  <span>{entry.text}</span>
                </p>
              ))}
              {aiBusy && (
                <p className="ve-line is-busy">
                  <b>AI</b>
                  <span>Thinking…</span>
                </p>
              )}
              <div ref={chatEndRef} />
            </div>
            <div className="ve-chips">
              {CHIPS.map((chip) => (
                <button key={chip} type="button" onClick={() => void sendDirector(chip)} disabled={aiBusy}>
                  {chip}
                </button>
              ))}
            </div>
            <form
              className="ve-dir-form"
              onSubmit={(e) => {
                e.preventDefault();
                void sendDirector(chat);
              }}
            >
              <textarea
                rows={2}
                value={chat}
                placeholder="Describe an edit — or let the house parser try it (Ctrl J)"
                onChange={(e) => setChat(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void sendDirector(chat);
                  }
                }}
              />
              <button type="submit" className="ve-send" disabled={aiBusy || !chat.trim()}>
                ↑
              </button>
            </form>
            <p className="ve-dir-note">
              {signedIn
                ? "Commands run through your laptop’s model via the relay."
                : "Sign in to reach the model — until then every line is labelled house rules."}
            </p>
          </div>
        </aside>
      )}

      {showKeys && (
        <div className="ve-modal" role="dialog" aria-label="Shortcuts" onClick={() => setShowKeys(false)}>
          <div className="ve-sheet ve-sheet-keys" onClick={(e) => e.stopPropagation()}>
            <header className="ve-sheet-head">
              <p className="ve-kicker">SHORTCUTS</p>
              <button type="button" className="ve-x" onClick={() => setShowKeys(false)}>
                ×
              </button>
            </header>
            <div className="ve-seg">
              {SHORTCUTS.map((group, i) => (
                <button
                  key={group.tab}
                  type="button"
                  className={keysTab === i ? "is-on" : ""}
                  onClick={() => setKeysTab(i)}
                >
                  {group.tab}
                </button>
              ))}
            </div>
            <table className="ve-keys-table">
              <tbody>
                {SHORTCUTS[keysTab].rows.map(([label, keys]) => (
                  <tr key={label}>
                    <td>{label}</td>
                    <td>
                      <kbd>{keys}</kbd>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showExport && (
        <div className="ve-modal" role="dialog" aria-label="Export" onClick={() => setShowExport(true)}>
          <div
            className="ve-sheet"
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            <header className="ve-sheet-head">
              <p className="ve-kicker">EXPORT FILM</p>
              <button
                type="button"
                className="ve-x"
                onClick={() => {
                  if (!exportingRef.current) setShowExport(false);
                }}
              >
                ×
              </button>
            </header>
            {exporting ? (
              <div className="ve-export-run">
                <div className="ve-progress">
                  <span style={{ width: `${Math.round(exportP * 100)}%` }} />
                </div>
                <p>
                  Recording in real time — {Math.round(exportP * 100)}% · keep this tab visible.
                </p>
                <button type="button" className="ve-key" onClick={cancelExport}>
                  Stop &amp; save what we have
                </button>
              </div>
            ) : result ? (
              <div className="ve-export-done">
                <video src={result.url} controls className="ve-result-video" />
                <div className="ve-result-meta">
                  <b>{result.name}</b>
                  <span>
                    {(result.bytes / 1048576).toFixed(1)} MB · {result.mime}
                  </span>
                </div>
                {exportNote && <p className="ve-alert">{exportNote}</p>}
                <div className="ve-btnrow">
                  <a className="ve-key" href={result.url} download={result.name}>
                    ⬇ Download
                  </a>
                  <button
                    type="button"
                    className="ve-tbtn"
                    onClick={() => {
                      setResult(null);
                      setExportP(0);
                    }}
                  >
                    EXPORT AGAIN
                  </button>
                </div>
              </div>
            ) : (
              <div className="ve-export-setup">
                <div className="ve-opt-group">
                  <span>HEIGHT</span>
                  <div className="ve-seg">
                    {[480, 720, 1080].map((h) => (
                      <button
                        key={h}
                        type="button"
                        className={exportOpts.height === h ? "is-on" : ""}
                        onClick={() => setExportOpts((o) => ({ ...o, height: h }))}
                      >
                        {h}p
                      </button>
                    ))}
                  </div>
                </div>
                <div className="ve-opt-group">
                  <span>FPS</span>
                  <div className="ve-seg">
                    {[24, 30].map((f) => (
                      <button
                        key={f}
                        type="button"
                        className={exportOpts.fps === f ? "is-on" : ""}
                        onClick={() => setExportOpts((o) => ({ ...o, fps: f }))}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="ve-opt-group">
                  <span>FORMAT</span>
                  <div className="ve-seg">
                    <button
                      type="button"
                      disabled={!mp4Supported}
                      className={exportOpts.mp4 ? "is-on" : ""}
                      onClick={() => setExportOpts((o) => ({ ...o, mp4: true }))}
                      title={mp4Supported ? "H.264 in an MP4 container" : "This browser can’t write MP4"}
                    >
                      MP4
                    </button>
                    <button
                      type="button"
                      className={!exportOpts.mp4 ? "is-on" : ""}
                      onClick={() => setExportOpts((o) => ({ ...o, mp4: false }))}
                    >
                      WEBM
                    </button>
                  </div>
                </div>
                <p className="ve-note">
                  Real-time canvas capture at {aspect.w}×{aspect.h} base → {exportOpts.height}p.{" "}
                  {mediaCount ? "Audio mixes from every clip on the timeline." : "No media clips yet — video will be silent."}{" "}
                  Capped at {MAX_EXPORT_SECONDS / 60} minutes.
                </p>
                <button type="button" className="ve-key ve-key-lg" onClick={() => void startExport()}>
                  ● Start export
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="ve-toasts">
        {toasts.map((t) => (
          <div key={t.id} className={`ve-toast is-${t.tone}`}>
            {t.text}
          </div>
        ))}
      </div>

      <input
        ref={fileRef}
        type="file"
        multiple
        accept="video/*,audio/*,image/*"
        className="ve-hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length) void importFiles(e.target.files);
          e.target.value = "";
        }}
      />

      <style jsx global>{`/* ================================================================
   Video Editor — deck skin, global scoped by the .ve prefix.
   Every panel keeps its CSS material and mounts a DisplaySurface
   WebGL face above it (same rule as the Music Video Studio).
   ================================================================ */

.ve {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
  height: 100vh;
  height: 100dvh;
  min-height: 0;
  overflow: hidden;
  color: #cfc7e8;
}

.ve-head {
  flex: none;
}

.ve-controls {
  display: grid;
  grid-template-columns: 54px minmax(0, 1fr);
  grid-template-rows: minmax(0, 1fr) minmax(0, 0.72fr);
  gap: 8px;
  min-width: 0;
  min-height: 0;
}

.ve-controls .ve-rail {
  grid-column: 1;
  grid-row: 1 / span 2;
}

.ve-controls .ve-panel {
  grid-column: 2;
  grid-row: 1;
}

.ve-controls .ve-details {
  grid-column: 2;
  grid-row: 2;
}

.ve .omni-display {
  position: absolute;
  inset: 0;
  z-index: 0;
  display: block;
  width: 100%;
  height: 100%;
  border-radius: inherit;
  pointer-events: none;
}

.ve-panel > :not(.omni-display),
.ve-details > :not(.omni-display),
.ve-director > :not(.omni-display) {
  position: relative;
  z-index: 1;
}

.ve-hidden {
  display: none;
}

.ve button {
  font: inherit;
  color: inherit;
  cursor: pointer;
}

.ve button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.ve kbd {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 10.5px;
  padding: 2px 7px;
  border: 1px solid rgba(167, 139, 250, 0.35);
  border-bottom-width: 2px;
  border-radius: 6px;
  background: rgba(167, 139, 250, 0.1);
  color: #d9d1ff;
  white-space: nowrap;
}

.ve ::-webkit-scrollbar {
  width: 9px;
  height: 9px;
}
.ve ::-webkit-scrollbar-track {
  background: rgba(10, 8, 18, 0.6);
}
.ve ::-webkit-scrollbar-thumb {
  background: rgba(120, 104, 190, 0.42);
  border-radius: 8px;
}
.ve ::-webkit-scrollbar-thumb:hover {
  background: rgba(167, 139, 250, 0.6);
}

/* ------------------------------ header --------------------------- */

.ve-head {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
  padding: 9px 14px;
  border: 1px solid #262140;
  border-radius: 14px;
  background: linear-gradient(180deg, rgba(20, 18, 31, 0.96), rgba(13, 11, 22, 0.96));
  box-shadow: 0 16px 44px rgba(0, 0, 0, 0.35);
}

.ve-title {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.ve-eyebrow {
  margin: 0;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.24em;
  text-transform: uppercase;
  color: #a78bfa;
}

.ve-title h1 {
  margin: 0;
  font-size: 1.18rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: #f1eaff;
  text-shadow: 0 0 22px rgba(108, 99, 255, 0.35);
}

.ve-namefield {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.ve-namefield span {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.2em;
  color: #8b7fff;
}

.ve-namefield input {
  width: 190px;
  max-width: 34vw;
  padding: 6px 10px;
  border: 1px solid #2c2748;
  border-radius: 9px;
  background: rgba(8, 7, 15, 0.8);
  color: #efeaff;
  font-size: 12.5px;
  font-weight: 600;
}

.ve-namefield input:focus {
  outline: none;
  border-color: #6c63ff;
  box-shadow: 0 0 0 3px rgba(108, 99, 255, 0.2);
}

.ve-head-acts {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
}

.ve-chip {
  padding: 7px 12px;
  border: 1px solid #2f2a4d;
  border-radius: 999px;
  background: rgba(30, 26, 50, 0.75);
  color: #cfc7e8;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.ve-chip:hover {
  border-color: #6c63ff;
  color: #fff;
}

.ve-chip.is-on {
  background: rgba(108, 99, 255, 0.24);
  border-color: #8b7fff;
  color: #fff;
}

.ve-key {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 8px 15px;
  border: 1px solid rgba(0, 242, 254, 0.4);
  border-radius: 10px;
  background: linear-gradient(135deg, rgba(0, 242, 254, 0.16), rgba(108, 99, 255, 0.2));
  color: #d8fbff;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  text-decoration: none;
}

.ve-key:hover {
  border-color: #00f2fe;
  box-shadow: 0 0 18px rgba(0, 242, 254, 0.28);
}

.ve-key-lg {
  width: 100%;
  padding: 12px;
  font-size: 12.5px;
}

/* ------------------------------- body ---------------------------- */

.ve-body {
  display: grid;
  grid-template-columns: minmax(360px, 0.86fr) minmax(0, 1.42fr);
  gap: 10px;
  flex: 1 1 0;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.ve-center {
  min-width: 0;
  min-height: 0;
}

.ve-tl-scroll {
  flex: 1 1 0;
  min-height: 0;
}

/* rail */

.ve-rail {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 6px 4px;
  border: 1px solid #262140;
  border-radius: 13px;
  background: rgba(15, 13, 25, 0.92);
  overflow-y: auto;
}

.ve-rail-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 7px 2px;
  border: 1px solid transparent;
  border-radius: 9px;
  background: transparent;
  color: #9d93c4;
}

.ve-rail-btn i {
  font-style: normal;
  font-size: 14px;
  line-height: 1;
}

.ve-rail-btn span {
  font-size: 8.5px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.ve-rail-btn:hover {
  background: rgba(108, 99, 255, 0.14);
  color: #ded6ff;
}

.ve-rail-btn.is-on {
  background: linear-gradient(160deg, rgba(108, 99, 255, 0.32), rgba(0, 242, 254, 0.1));
  border-color: #6c63ff;
  color: #fff;
  box-shadow: 0 0 16px rgba(108, 99, 255, 0.3);
}

/* left panel */

.ve-panel {
  position: relative;
  display: flex;
  min-height: 0;
  border: 1px solid #262140;
  border-radius: 13px;
  background: rgba(13, 11, 22, 0.94);
  overflow: hidden;
}

.ve-panel-in {
  display: flex;
  flex-direction: column;
  min-height: 0;
  width: 100%;
  gap: 8px;
  padding: 11px;
}

.ve-panel-head {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.ve-panel-head b {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 11px;
  letter-spacing: 0.16em;
  color: #00f2fe;
}

.ve-panel-head span {
  font-size: 11px;
  color: rgba(203, 195, 222, 0.7);
}

.ve-panel-tabs {
  display: flex;
  gap: 5px;
}

.ve-panel-tabs button {
  flex: 1;
  padding: 6px 6px;
  border: 1px solid #2c2748;
  border-radius: 8px;
  background: rgba(24, 21, 40, 0.8);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 9.5px;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: #9d93c4;
}

.ve-panel-tabs button.is-on {
  background: rgba(108, 99, 255, 0.26);
  border-color: #8b7fff;
  color: #fff;
}

.ve-panel-scroll {
  display: flex;
  flex-direction: column;
  gap: 9px;
  min-height: 0;
  flex: 1;
  overflow-y: auto;
  padding-right: 2px;
}

.ve-import {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  width: 100%;
  padding: 16px 10px;
  border: 1.5px dashed rgba(108, 99, 255, 0.55);
  border-radius: 11px;
  background: rgba(108, 99, 255, 0.08);
}

.ve-import:hover {
  border-color: #00f2fe;
  background: rgba(0, 242, 254, 0.07);
}

.ve-import b {
  font-size: 12px;
  letter-spacing: 0.12em;
  color: #efeaff;
}

.ve-import span {
  font-size: 10px;
  color: rgba(203, 195, 222, 0.62);
}

.ve-empty-note {
  margin: 0;
  padding: 9px 10px;
  border: 1px dashed rgba(157, 147, 196, 0.3);
  border-radius: 9px;
  font-size: 11px;
  line-height: 1.55;
  color: rgba(203, 195, 222, 0.68);
}

.ve-empty-note a {
  color: #00f2fe;
}

.ve-note {
  margin: 0;
  font-size: 11px;
  line-height: 1.55;
  color: rgba(203, 195, 222, 0.78);
}

.ve-note a {
  color: #00f2fe;
}

.ve-alert {
  margin: 0;
  padding: 8px 10px;
  border: 1px solid rgba(255, 92, 122, 0.45);
  border-radius: 9px;
  background: rgba(255, 92, 122, 0.09);
  color: #ffc4d0;
  font-size: 11.5px;
}

.ve-bin {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.ve-bin-card {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 9px;
  border: 1px solid #262140;
  border-radius: 9px;
  background: rgba(24, 21, 40, 0.72);
}

.ve-bin-card:hover {
  border-color: #4a4270;
}

.ve-bin-card.is-on {
  border-color: #00f2fe;
  background: rgba(0, 242, 254, 0.08);
}

.ve-bin-kind {
  flex: none;
  width: 22px;
  text-align: center;
  font-size: 12px;
  color: #00f2fe;
}

.ve-bin-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 11.5px;
  color: #ded6ff;
}

.ve-bin-acts {
  display: flex;
  gap: 4px;
}

.ve-bin-acts button {
  padding: 4px 8px;
  border: 1px solid #37315a;
  border-radius: 7px;
  background: rgba(40, 35, 66, 0.9);
  font-size: 10px;
  font-weight: 700;
  color: #cfc7e8;
}

.ve-bin-acts button:hover {
  border-color: #6c63ff;
  color: #fff;
}

.ve-bin-card {
  cursor: default;
}

.ve-preset-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 7px;
}

.ve-preset {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 8px;
  border: 1px solid #262140;
  border-radius: 10px;
  background: rgba(24, 21, 40, 0.72);
  overflow: hidden;
}

.ve-preset:hover {
  border-color: #6c63ff;
}

.ve-preset span {
  font-size: 13px;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ve-preset em {
  font-style: normal;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 8.5px;
  letter-spacing: 0.14em;
  color: #8b7fff;
}

.ve-composer {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.ve-composer textarea,
.ve-field textarea {
  width: 100%;
  resize: vertical;
  padding: 8px 10px;
  border: 1px solid #2c2748;
  border-radius: 9px;
  background: rgba(8, 7, 15, 0.85);
  color: #efeaff;
  font-size: 12.5px;
}

.ve-composer textarea:focus,
.ve-field textarea:focus {
  outline: none;
  border-color: #6c63ff;
}

.ve-glyphs {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 5px;
}

.ve-glyphs button {
  padding: 8px 4px;
  border: 1px solid #262140;
  border-radius: 9px;
  background: rgba(24, 21, 40, 0.72);
  font-size: 19px;
  line-height: 1;
}

.ve-glyphs button:hover {
  border-color: #6c63ff;
  transform: translateY(-1px);
}

.ve-card-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 7px;
}

.ve-look {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 9px;
  border: 1px solid #262140;
  border-radius: 10px;
  background: rgba(24, 21, 40, 0.72);
  text-align: left;
}

.ve-look:hover {
  border-color: #6c63ff;
}

.ve-look.is-on {
  border-color: #00f2fe;
  background: rgba(0, 242, 254, 0.09);
  box-shadow: 0 0 14px rgba(0, 242, 254, 0.16);
}

.ve-look b {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 10.5px;
  letter-spacing: 0.1em;
  color: #efeaff;
}

.ve-look span {
  font-size: 10px;
  color: rgba(203, 195, 222, 0.62);
}

/* ------------------------------ player --------------------------- */

.ve-center {
  display: flex;
  min-width: 0;
  min-height: 0;
}

.ve-player {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
  min-width: 0;
  min-height: 0;
}

.ve-screen {
  position: relative;
  flex: 1;
  min-height: 0;
  align-self: center;
  width: 100%;
  max-height: 100%;
  border: 1px solid #262140;
  border-radius: 12px;
  background: #05040a;
  overflow: hidden;
  box-shadow:
    inset 0 0 60px rgba(0, 0, 0, 0.65),
    0 18px 44px rgba(0, 0, 0, 0.4);
}

.ve-screen canvas {
  display: block;
  width: 100%;
  height: 100%;
}

.ve-screen-empty {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  background: radial-gradient(ellipse at 50% 40%, rgba(108, 99, 255, 0.12), rgba(5, 4, 10, 0.88));
}

.ve-screen-empty p {
  margin: 0;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 11px;
  letter-spacing: 0.24em;
  color: rgba(203, 195, 222, 0.72);
}

.ve-transport {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 11px;
  border: 1px solid #262140;
  border-radius: 11px;
  background: rgba(15, 13, 25, 0.92);
}

.ve-play {
  width: 34px;
  height: 30px;
  border: 1px solid rgba(108, 99, 255, 0.55);
  border-radius: 8px;
  background: rgba(108, 99, 255, 0.22);
  font-size: 13px;
  color: #fff;
}

.ve-play:hover {
  background: rgba(108, 99, 255, 0.4);
}

.ve-tc {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 13px;
  font-weight: 700;
  color: #00f2fe;
  text-shadow: 0 0 12px rgba(0, 242, 254, 0.45);
}

.ve-tcdur {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 11px;
  color: rgba(203, 195, 222, 0.6);
}

.ve-spacer {
  flex: 1;
}

.ve-tbtn {
  padding: 5px 9px;
  border: 1px solid #2f2a4d;
  border-radius: 8px;
  background: rgba(30, 26, 50, 0.8);
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.05em;
  color: #cfc7e8;
  white-space: nowrap;
}

.ve-tbtn:hover {
  border-color: #6c63ff;
  color: #fff;
}

.ve-tbtn.is-on {
  background: rgba(108, 99, 255, 0.3);
  border-color: #8b7fff;
  color: #fff;
}

.ve-tbtn.is-danger {
  border-color: rgba(255, 92, 122, 0.5);
  color: #ffc4d0;
}

.ve-tbtn.is-danger:hover {
  background: rgba(255, 92, 122, 0.16);
}

/* ----------------------------- details --------------------------- */

.ve-details {
  position: relative;
  min-height: 0;
  border: 1px solid #262140;
  border-radius: 13px;
  background: rgba(13, 11, 22, 0.94);
  overflow: hidden;
}

.ve-det-in {
  display: flex;
  flex-direction: column;
  gap: 7px;
  min-height: 0;
  height: 100%;
  padding: 11px;
  overflow-y: auto;
}

.ve-kicker {
  margin: 0;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 9.5px;
  font-weight: 700;
  letter-spacing: 0.2em;
  color: #00f2fe;
}

.ve-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 11px;
}

.ve-row span {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 9px;
  letter-spacing: 0.14em;
  color: #8b7fff;
}

.ve-row b {
  font-size: 11px;
  font-weight: 700;
  color: #ded6ff;
  text-align: right;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ve-seg {
  display: flex;
  gap: 4px;
}

.ve-seg button {
  padding: 4px 8px;
  border: 1px solid #2f2a4d;
  border-radius: 7px;
  background: rgba(30, 26, 50, 0.8);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 9.5px;
  font-weight: 700;
  color: #9d93c4;
}

.ve-seg button.is-on {
  background: rgba(108, 99, 255, 0.32);
  border-color: #8b7fff;
  color: #fff;
}

.ve-insp {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 6px;
  border-top: 1px dashed rgba(157, 147, 196, 0.28);
}

.ve-field {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.ve-field > span {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 9px;
  letter-spacing: 0.14em;
  color: #8b7fff;
}

.ve-btnrow {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  align-items: center;
}

.ve-mini {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 9px;
  letter-spacing: 0.12em;
  color: #8b7fff;
}

.ve-color {
  width: 34px;
  height: 26px;
  padding: 2px;
  border: 1px solid #2f2a4d;
  border-radius: 7px;
  background: rgba(30, 26, 50, 0.8);
}

.ve-field input[type="range"] {
  width: 100%;
  height: 4px;
  appearance: none;
  -webkit-appearance: none;
  background: linear-gradient(90deg, rgba(108, 99, 255, 0.65), rgba(0, 242, 254, 0.5));
  border-radius: 4px;
  outline: none;
}

.ve-field input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 14px;
  height: 14px;
  border: 2px solid #0b0913;
  border-radius: 50%;
  background: #00f2fe;
  box-shadow: 0 0 10px rgba(0, 242, 254, 0.6);
  cursor: pointer;
}

.ve-keys {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 6px 0 0;
  padding: 0;
  list-style: none;
}

.ve-keys li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 3px 7px;
  border: 1px solid #262140;
  border-radius: 7px;
  background: rgba(24, 21, 40, 0.7);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 10px;
  color: #ded6ff;
}

.ve-keys li button {
  border: none;
  background: none;
  color: #ff7a95;
  font-size: 13px;
}

.ve-insp-acts {
  padding-top: 4px;
}

/* ---------------------------- timeline --------------------------- */

.ve-timeline {
  display: flex;
  flex-direction: column;
  border: 1px solid #262140;
  border-radius: 13px;
  background: rgba(13, 11, 22, 0.96);
  overflow: hidden;
  flex: 0 0 clamp(190px, 29vh, 330px);
  min-height: 170px;
  max-height: 38vh;
}

.ve-tl-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  padding: 6px 9px;
  border-bottom: 1px solid #262140;
  background: rgba(18, 15, 30, 0.95);
}

.ve-mode {
  display: flex;
  gap: 4px;
}

.ve-sep {
  width: 1px;
  height: 18px;
  background: rgba(157, 147, 196, 0.3);
}

.ve-zoom {
  width: 90px;
  height: 4px;
  appearance: none;
  -webkit-appearance: none;
  background: rgba(108, 99, 255, 0.5);
  border-radius: 4px;
  outline: none;
}

.ve-zoom::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 12px;
  height: 12px;
  border: 2px solid #0b0913;
  border-radius: 50%;
  background: #a78bfa;
  cursor: pointer;
}

.ve-meter {
  width: 86px;
  height: 20px;
  border: 1px solid #262140;
  border-radius: 6px;
  background: rgba(8, 7, 15, 0.85);
}

.ve-tl-tc {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 10.5px;
  font-weight: 700;
  color: #a78bfa;
}

.ve-tl-scroll {
  overflow-x: auto;
  overflow-y: hidden;
  min-height: 0;
}

.ve-tl-inner {
  position: relative;
  min-height: 100%;
}

.ve-ruler {
  position: relative;
  height: 22px;
  border-bottom: 1px solid #262140;
  background: rgba(18, 15, 30, 0.9);
  cursor: text;
}

.ve-tick {
  position: absolute;
  top: 3px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 8.5px;
  color: rgba(203, 195, 222, 0.55);
  padding-left: 4px;
  border-left: 1px solid rgba(157, 147, 196, 0.35);
  height: 16px;
  pointer-events: none;
}

.ve-lanes {
  display: flex;
  flex-direction: column;
}

.ve-lane {
  position: relative;
  height: 46px;
  border-bottom: 1px solid rgba(38, 33, 64, 0.75);
  background:
    repeating-linear-gradient(
      90deg,
      rgba(157, 147, 196, 0.05) 0 1px,
      transparent 1px 100%
    );
}

.ve-lane:nth-child(even) {
  background-color: rgba(24, 21, 40, 0.4);
}

.ve-lane-tag {
  position: sticky;
  left: 6px;
  z-index: 3;
  display: inline-flex;
  flex-direction: column;
  gap: 1px;
  margin-top: 6px;
  padding: 3px 8px;
  border: 1px solid rgba(108, 99, 255, 0.35);
  border-radius: 7px;
  background: rgba(10, 8, 18, 0.88);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 8.5px;
  font-weight: 800;
  letter-spacing: 0.16em;
  color: #a78bfa;
  pointer-events: none;
}

.ve-lane-tag em {
  font-style: normal;
  font-size: 7.5px;
  font-weight: 500;
  letter-spacing: 0.06em;
  color: rgba(203, 195, 222, 0.5);
}

/* clips */

.ve-clip {
  position: absolute;
  top: 5px;
  height: 36px;
  border: 1px solid rgba(108, 99, 255, 0.65);
  border-radius: 8px;
  background: linear-gradient(180deg, rgba(62, 55, 110, 0.95), rgba(40, 35, 74, 0.95));
  overflow: hidden;
  cursor: grab;
  user-select: none;
  touch-action: none;
}

.ve-clip:active {
  cursor: grabbing;
}

.ve-clip.is-image {
  border-color: rgba(64, 224, 208, 0.6);
}

.ve-clip.is-audio {
  border-color: rgba(0, 242, 254, 0.65);
  background: linear-gradient(180deg, rgba(16, 64, 74, 0.95), rgba(12, 44, 52, 0.95));
}

.ve-clip.is-text {
  border-color: rgba(255, 122, 149, 0.65);
  background: linear-gradient(180deg, rgba(96, 34, 60, 0.95), rgba(70, 26, 46, 0.95));
}

.ve-clip.is-caption {
  border-color: rgba(255, 177, 94, 0.6);
  background: linear-gradient(180deg, rgba(94, 62, 24, 0.95), rgba(66, 44, 18, 0.95));
}

.ve-clip.is-sticker {
  border-color: rgba(255, 184, 77, 0.65);
  background: linear-gradient(180deg, rgba(90, 66, 16, 0.95), rgba(64, 47, 12, 0.95));
}

.ve-clip.is-sel {
  border-color: #00f2fe;
  box-shadow:
    0 0 0 1.5px rgba(0, 242, 254, 0.75),
    0 0 18px rgba(0, 242, 254, 0.4);
  z-index: 4;
}

.ve-clip.is-mute {
  opacity: 0.55;
}

.ve-clip-thumb {
  position: absolute;
  inset: 0;
  background-size: auto 100%;
  background-repeat: repeat-x;
  opacity: 0.85;
}

.ve-clip-wave {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.ve-clip-label {
  position: absolute;
  left: 7px;
  top: 50%;
  transform: translateY(-50%);
  max-width: calc(100% - 52px);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 9.5px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.92);
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.9);
  pointer-events: none;
}

.ve-clip-time {
  position: absolute;
  right: 7px;
  top: 50%;
  transform: translateY(-50%);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 8.5px;
  color: rgba(255, 255, 255, 0.6);
  pointer-events: none;
}

.ve-clip-h {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: 7px;
  background: rgba(0, 242, 254, 0);
  cursor: ew-resize;
}

.ve-clip-h::after {
  content: "";
  position: absolute;
  top: 50%;
  left: 2px;
  width: 3px;
  height: 12px;
  transform: translateY(-50%);
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.45);
  opacity: 0;
}

.ve-clip-h.is-out {
  left: auto;
  right: 0;
}

.ve-clip:hover .ve-clip-h {
  background: rgba(0, 242, 254, 0.28);
}

.ve-clip:hover .ve-clip-h::after {
  opacity: 1;
}

.ve-playhead {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: 2px;
  background: #ff2a6d;
  box-shadow: 0 0 10px rgba(255, 42, 109, 0.7);
  z-index: 6;
  pointer-events: none;
}

.ve-ph-cap {
  position: absolute;
  top: 0;
  left: 50%;
  width: 11px;
  height: 11px;
  transform: translateX(-50%);
  background: #ff2a6d;
  clip-path: polygon(0 0, 100% 0, 50% 100%);
}

.ve-tl-empty {
  position: absolute;
  top: 50px;
  left: 50%;
  transform: translateX(-50%);
  margin: 0;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 11px;
  letter-spacing: 0.14em;
  color: rgba(203, 195, 222, 0.55);
  pointer-events: none;
  white-space: nowrap;
}

/* ----------------------------- director -------------------------- */

.ve-director {
  position: fixed;
  right: 16px;
  bottom: 16px;
  z-index: 60;
  width: min(392px, calc(100vw - 32px));
  max-height: min(560px, calc(100vh - 48px));
  display: flex;
  border: 1px solid rgba(167, 139, 250, 0.5);
  border-radius: 15px;
  background: rgba(13, 11, 22, 0.97);
  box-shadow:
    0 24px 70px rgba(0, 0, 0, 0.6),
    0 0 34px rgba(167, 139, 250, 0.22);
  overflow: hidden;
}

.ve-dir-in {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
  min-height: 0;
  padding: 11px;
}

.ve-dir-head {
  display: flex;
  align-items: center;
  gap: 9px;
}

.ve-chip-mini {
  padding: 3px 8px;
  border-radius: 999px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 8.5px;
  font-weight: 800;
  letter-spacing: 0.12em;
}

.ve-chip-mini.is-ai {
  background: rgba(0, 242, 254, 0.16);
  border: 1px solid rgba(0, 242, 254, 0.5);
  color: #9ffcff;
}

.ve-chip-mini.is-house {
  background: rgba(255, 184, 77, 0.14);
  border: 1px solid rgba(255, 184, 77, 0.5);
  color: #ffd9a0;
}

.ve-x {
  margin-left: auto;
  width: 26px;
  height: 26px;
  border: 1px solid #2f2a4d;
  border-radius: 8px;
  background: rgba(30, 26, 50, 0.8);
  font-size: 14px;
  color: #cfc7e8;
}

.ve-x:hover {
  border-color: #ff7a95;
  color: #fff;
}

.ve-dir-log {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-height: 120px;
  max-height: 260px;
  overflow-y: auto;
  padding-right: 3px;
}

.ve-line {
  display: flex;
  gap: 8px;
  margin: 0;
  padding: 7px 9px;
  border: 1px solid #262140;
  border-radius: 9px;
  background: rgba(24, 21, 40, 0.72);
  font-size: 11.5px;
  line-height: 1.5;
}

.ve-line b {
  flex: none;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 8.5px;
  font-weight: 800;
  letter-spacing: 0.1em;
  padding-top: 2px;
}

.ve-line.is-user {
  background: rgba(108, 99, 255, 0.14);
  border-color: rgba(108, 99, 255, 0.45);
}
.ve-line.is-user b {
  color: #b9aeff;
}

.ve-line.is-ai {
  background: rgba(0, 242, 254, 0.08);
  border-color: rgba(0, 242, 254, 0.4);
}
.ve-line.is-ai b {
  color: #00f2fe;
}

.ve-line.is-house {
  background: rgba(255, 184, 77, 0.08);
  border-color: rgba(255, 184, 77, 0.42);
}
.ve-line.is-house b {
  color: #ffb84d;
}

.ve-line.is-system b {
  color: #8b7fff;
}

.ve-line.is-busy b,
.ve-line.is-busy span {
  color: #a78bfa;
  animation: ve-pulse 1.1s ease-in-out infinite;
}

@keyframes ve-pulse {
  50% {
    opacity: 0.45;
  }
}

.ve-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.ve-chips button {
  padding: 5px 9px;
  border: 1px solid #2f2a4d;
  border-radius: 999px;
  background: rgba(30, 26, 50, 0.8);
  font-size: 10px;
  color: #cfc7e8;
}

.ve-chips button:hover {
  border-color: #00f2fe;
  color: #fff;
}

.ve-dir-form {
  display: flex;
  gap: 6px;
  align-items: flex-end;
}

.ve-dir-form textarea {
  flex: 1;
  resize: none;
  padding: 8px 10px;
  border: 1px solid #2c2748;
  border-radius: 9px;
  background: rgba(8, 7, 15, 0.88);
  color: #efeaff;
  font-size: 12px;
}

.ve-dir-form textarea:focus {
  outline: none;
  border-color: #a78bfa;
}

.ve-send {
  width: 36px;
  height: 34px;
  border: 1px solid rgba(167, 139, 250, 0.55);
  border-radius: 9px;
  background: rgba(167, 139, 250, 0.24);
  font-size: 15px;
  color: #fff;
}

.ve-send:hover:not(:disabled) {
  background: rgba(167, 139, 250, 0.42);
}

.ve-dir-note {
  margin: 0;
  font-size: 10px;
  line-height: 1.5;
  color: rgba(203, 195, 222, 0.58);
}

/* ------------------------------ modals --------------------------- */

.ve-modal {
  position: fixed;
  inset: 0;
  z-index: 80;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 18px;
  background: rgba(5, 4, 10, 0.72);
  backdrop-filter: blur(6px);
}

.ve-sheet {
  width: min(460px, 100%);
  max-height: calc(100vh - 40px);
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  border: 1px solid #332c55;
  border-radius: 16px;
  background: linear-gradient(180deg, rgba(20, 18, 31, 0.99), rgba(13, 11, 22, 0.99));
  box-shadow: 0 30px 90px rgba(0, 0, 0, 0.65);
  overflow-y: auto;
}

.ve-sheet-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.ve-opt-group {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.ve-opt-group > span {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 9.5px;
  letter-spacing: 0.16em;
  color: #8b7fff;
}

.ve-export-run {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.ve-export-run p {
  margin: 0;
  font-size: 12px;
  color: rgba(203, 195, 222, 0.8);
}

.ve-progress {
  height: 10px;
  border: 1px solid #2c2748;
  border-radius: 999px;
  background: rgba(8, 7, 15, 0.9);
  overflow: hidden;
}

.ve-progress span {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, #6c63ff, #00f2fe);
  box-shadow: 0 0 16px rgba(0, 242, 254, 0.55);
  transition: width 0.15s linear;
}

.ve-export-done {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.ve-result-video {
  width: 100%;
  border: 1px solid #2c2748;
  border-radius: 11px;
  background: #000;
}

.ve-result-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.ve-result-meta b {
  font-size: 13px;
  color: #efeaff;
}

.ve-result-meta span {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 10.5px;
  color: #00f2fe;
}

.ve-keys-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.ve-keys-table td {
  padding: 7px 6px;
  border-bottom: 1px solid rgba(38, 33, 64, 0.8);
  color: rgba(222, 214, 255, 0.88);
}

.ve-keys-table td:last-child {
  text-align: right;
  width: 150px;
}

/* ------------------------------ toasts --------------------------- */

.ve-toasts {
  position: fixed;
  top: 78px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 90;
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: center;
  pointer-events: none;
}

.ve-toast {
  padding: 8px 14px;
  border: 1px solid #37315a;
  border-radius: 999px;
  background: rgba(13, 11, 22, 0.96);
  box-shadow: 0 12px 34px rgba(0, 0, 0, 0.5);
  font-size: 11.5px;
  color: #ded6ff;
  animation: ve-rise 0.22s ease-out;
}

.ve-toast.is-warn {
  border-color: rgba(255, 184, 77, 0.55);
  color: #ffd9a0;
}

.ve-toast.is-ok {
  border-color: rgba(0, 242, 254, 0.55);
  color: #9ffcff;
}

@keyframes ve-rise {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
}

/* --------------------------- fullscreen -------------------------- */

.ve-player:fullscreen {
  background: #05040a;
  padding: 14px;
  justify-content: center;
}

.ve-player:fullscreen .ve-screen {
  max-height: calc(100vh - 70px);
}

/* -------------------------- responsive --------------------------- */

@media (max-width: 990px) {
  .ve-body {
    grid-template-columns: minmax(300px, 0.9fr) minmax(0, 1.2fr);
  }

  .ve-controls {
    grid-template-columns: 46px minmax(0, 1fr);
  }

  .ve-controls .ve-details {
    display: none;
  }
}

@media (max-width: 860px) {
  .ve {
    height: 100vh;
    height: 100dvh;
    min-height: 0;
    overflow: hidden;
  }

  .ve-head {
    gap: 8px;
    padding: 7px 9px;
  }

  .ve-body {
    grid-template-columns: minmax(0, 0.92fr) minmax(0, 1.08fr);
    gap: 7px;
  }

  .ve-controls {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-height: 0;
  }

  .ve-rail {
    flex: none;
    flex-direction: row;
    overflow-x: auto;
    overflow-y: hidden;
    padding: 4px;
  }

  .ve-rail-btn {
    flex: none;
    min-width: 54px;
    padding: 5px 4px;
  }

  .ve-panel {
    flex: 1 1 0;
    min-height: 0;
    max-height: none;
  }

  .ve-panel-in {
    padding: 8px;
  }

  .ve-center {
    min-width: 0;
    min-height: 0;
  }

  .ve-controls .ve-details {
    display: none;
  }

  .ve-timeline {
    flex-basis: clamp(150px, 25vh, 230px);
    min-height: 130px;
    max-height: 31vh;
  }

  .ve-tl-scroll {
    max-height: none;
  }
}

@media (max-width: 520px) {
  .ve {
    gap: 6px;
  }

  .ve-title h1 {
    font-size: 18px;
  }

  .ve-head-acts {
    gap: 4px;
  }

  .ve-head-acts .ve-chip {
    padding: 5px 7px;
    font-size: 8px;
  }

  .ve-body {
    grid-template-columns: minmax(0, 0.88fr) minmax(0, 1.12fr);
    gap: 5px;
  }

  .ve-rail-btn {
    min-width: 48px;
  }

  .ve-timeline {
    flex-basis: clamp(125px, 23vh, 180px);
    min-height: 115px;
  }

  .ve-tl-bar {
    gap: 3px;
    padding: 4px;
  }
}
`}</style>
    </div>
  );
}
