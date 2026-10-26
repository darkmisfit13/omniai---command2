"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { requestLocalAi } from "@/lib/localAiRelay";
import type { MediaAsset } from "@/lib/types";
import DisplaySurface from "../hud/DisplaySurface";

/**
 * Music Video Studio (route /pulse) — a freebeat-style staged build:
 *
 *   01 SOURCE   choose a track (library or local file) and trim the clip
 *   02 CONCEPT  brief the AI director — vibe, treatment, palette, format
 *   03 BUILD    the director's workspace: agent transcript + activity steps,
 *               a Timeline document (creative read, visual style, scene plan,
 *               final video) and a Studio tab with the preview, lanes and the
 *               real MediaRecorder render
 *
 * Honesty rules kept from the rest of the deck: every number on screen comes
 * from decoded audio or real state, the AI plan is labeled with its source
 * ("ai" from the local relay, "house" when the relay is offline and the rule
 * based fallback wrote the plan), and nothing pretends to be a cloud render —
 * the film is drawn by our own audio-reactive treatments and recorded in the
 * browser.
 */

const MEDIA_BUCKET = "media";
const SIGNED_URL_TTL = 3600;
const MAX_RENDER_SECONDS = 90;
const FPS = 30;
const WAVE_BUCKETS = 480;
const MIN_CLIP_SECONDS = 3;
const CLIP_PRESETS = [10, 15, 30] as const;

type Treatment = "spectrum" | "rings" | "ecg" | "mesh" | "particles";
type PaletteName = "violet" | "crimson" | "cyan" | "mono";
type Aspect = "16:9" | "9:16" | "1:1";
type Palette = { bg: string; a: string; b: string; c: string };

type Scene = {
  start: number;
  end: number;
  title: string;
  story: string;
  treatment: Treatment;
  palette: PaletteName;
};

type DirectorRead = {
  source: "ai" | "house";
  creativeRead: string;
  lighting: string;
  texture: string;
  treatment: Treatment;
  palette: PaletteName;
  intensity: number;
  scenes: Scene[];
};

type Step = {
  key: string;
  title: string;
  sub: string;
  status: "pending" | "running" | "done";
  progress: number;
};

type Entry = { id: number; role: "agent" | "user"; text: string };

type Track = { key: string; title: string; url: string; origin: "library" | "local" };

type Frame = {
  freq: Uint8Array;
  time: Uint8Array;
  level: number;
  bass: number;
  treble: number;
};

const STAGES = [
  { n: "01", name: "SOURCE", sub: "pick & trim" },
  { n: "02", name: "CONCEPT", sub: "brief & style" },
  { n: "03", name: "BUILD", sub: "director & render" },
];

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

/* ------------------------------------------------------------------ *
 * Renderer — the same procedural treatments as before, now switched
 * per scene by the director's plan while the film plays.
 * ------------------------------------------------------------------ */

function hexA(hex: string, alpha: number): string {
  const n = Number.parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
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

function treatmentLabel(id: Treatment): string {
  return TREATMENTS.find((t) => t.id === id)?.label ?? id;
}

/* ------------------------------------------------------------------ *
 * Waveform — decoded client-side from the real file, never drawn from
 * a made-up number.
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

function drawWave(
  canvas: HTMLCanvasElement,
  peaks: Float32Array,
  rangeFrom: number,
  rangeTo: number,
  colors: { dim: string; hot: string },
  selection?: { from: number; to: number },
) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = Math.max(1, Math.round((canvas.clientWidth || canvas.width) * dpr));
  const h = Math.max(1, Math.round((canvas.clientHeight || canvas.height) * dpr));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.clearRect(0, 0, w, h);
  const span = Math.max(1, rangeTo - rangeFrom);
  const bw = Math.max(1, w / span - dpr * 0.8);

  for (let i = Math.max(0, Math.floor(rangeFrom)); i < Math.min(peaks.length, Math.ceil(rangeTo)); i += 1) {
    const rel = (i - rangeFrom) / span;
    const x = rel * w;
    const bh = Math.max(dpr, peaks[i] * h * 0.92);
    const inSelection = selection ? i >= selection.from && i < selection.to : false;
    ctx.fillStyle = inSelection ? colors.hot : colors.dim;
    ctx.globalAlpha = inSelection ? 0.95 : 0.4;
    ctx.fillRect(x, (h - bh) / 2, bw, bh);
  }
  ctx.globalAlpha = 1;
}

/* ------------------------------------------------------------------ *
 * Director — plan shape, AI prompt, defensive parsing, house fallback.
 * ------------------------------------------------------------------ */

function sceneAt(scenes: Scene[], t: number): number {
  for (let i = 0; i < scenes.length; i += 1) {
    if (t >= scenes[i].start && t < scenes[i].end) return i;
  }
  return scenes.length ? scenes.length - 1 : -1;
}

function extractJson(text: string): unknown | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(body.slice(start, end + 1));
  } catch {
    return null;
  }
}

function coercePlan(
  raw: unknown,
  opts: { length: number; treatment: Treatment; palette: PaletteName; intensity: number },
): DirectorRead | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;

  const asTreatment = (v: unknown, fb: Treatment): Treatment =>
    TREATMENTS.some((t) => t.id === v) ? (v as Treatment) : fb;
  const asPalette = (v: unknown, fb: PaletteName): PaletteName =>
    typeof v === "string" && Object.prototype.hasOwnProperty.call(PALETTES, v)
      ? (v as PaletteName)
      : fb;

  const scenesRaw = Array.isArray(obj.scenes) ? obj.scenes : [];
  const maxScenes = Math.max(1, Math.min(8, Math.floor(opts.length / 2)));
  const collected: Scene[] = [];

  for (const entry of scenesRaw) {
    if (collected.length >= maxScenes) break;
    if (!entry || typeof entry !== "object") continue;
    const e = entry as Record<string, unknown>;
    const start = Number(e.start);
    const end = Number(e.end);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue;
    collected.push({
      start: clamp(start, 0, opts.length),
      end: clamp(end, 0, opts.length),
      title:
        typeof e.title === "string" && e.title.trim()
          ? e.title.trim().slice(0, 60)
          : `Scene ${collected.length + 1}`,
      story: typeof e.story === "string" ? e.story.trim().slice(0, 400) : "",
      treatment: asTreatment(e.treatment, opts.treatment),
      palette: asPalette(e.palette, opts.palette),
    });
  }

  if (!collected.length) return null;
  collected.sort((a, b) => a.start - b.start);

  // Normalize into an ordered, gap-free cut across the whole clip.
  const n = collected.length;
  collected[0].start = 0;
  for (let i = 1; i < n; i += 1) {
    collected[i].start = clamp(collected[i].start, collected[i - 1].start + 0.4, opts.length - 0.4 * (n - i));
  }
  for (let i = 0; i < n; i += 1) {
    const nextStart = i + 1 < n ? collected[i + 1].start : opts.length;
    const low = collected[i].start + 0.4;
    collected[i].end = clamp(Math.max(collected[i].end, low), low, Math.max(low, nextStart));
  }
  collected[n - 1].end = opts.length;

  const intensityRaw = Number(obj.intensity);
  const intensity = Number.isFinite(intensityRaw)
    ? clamp(intensityRaw > 1.01 ? intensityRaw / 100 : intensityRaw, 0.2, 1)
    : opts.intensity;

  return {
    source: "ai",
    creativeRead:
      typeof obj.creativeRead === "string" && obj.creativeRead.trim()
        ? obj.creativeRead.trim().slice(0, 900)
        : "The director returned a scene cut without a written read.",
    lighting:
      typeof obj.lighting === "string" && obj.lighting.trim()
        ? obj.lighting.trim().slice(0, 300)
        : `Additive light in ${PALETTES[asPalette(obj.palette, opts.palette)].a} over a ${PALETTES[asPalette(obj.palette, opts.palette)].bg} floor.`,
    texture:
      typeof obj.texture === "string" && obj.texture.trim()
        ? obj.texture.trim().slice(0, 300)
        : "Flat vector strokes with additive blending and a closing vignette.",
    treatment: asTreatment(obj.treatment, opts.treatment),
    palette: asPalette(obj.palette, opts.palette),
    intensity,
    scenes: collected,
  };
}

function housePlan(
  title: string,
  vibe: string,
  opts: { length: number; treatment: Treatment; palette: PaletteName; intensity: number },
): DirectorRead {
  const tmeta = TREATMENTS.find((t) => t.id === opts.treatment) ?? TREATMENTS[0];
  const p = PALETTES[opts.palette];
  const count = opts.length >= 24 ? 3 : opts.length >= 12 ? 2 : 1;
  const pct = Math.round(opts.intensity * 100);
  const names = count === 1 ? ["Full pass"] : count === 2 ? ["Opening pass", "Second half"] : ["Opening pass", "Middle drive", "Close"];
  const stories = [
    `The ${tmeta.label} treatment rises out of the ${p.bg} floor — additive strokes in ${p.a} and ${p.b} finding the track's pulse.`,
    `Held at ${pct}% intensity, the ${tmeta.label} field drives the middle of the clip through the ${p.label} palette.`,
    `The picture settles back onto the ${p.bg} floor as the clip closes and the vignette tightens.`,
  ];

  const scenes: Scene[] = [];
  for (let i = 0; i < count; i += 1) {
    const start = Math.round(((opts.length * i) / count) * 10) / 10;
    const end = i === count - 1 ? opts.length : Math.round(((opts.length * (i + 1)) / count) * 10) / 10;
    scenes.push({
      start,
      end,
      title: names[Math.min(i, names.length - 1)],
      story: stories[Math.min(i, stories.length - 1)],
      treatment: opts.treatment,
      palette: opts.palette,
    });
  }

  return {
    source: "house",
    creativeRead:
      `House direction — “${title}” runs a ${pct}% ${tmeta.label} cut over ${opts.length}s` +
      (vibe.trim()
        ? `, shaped by your brief: “${vibe.trim().slice(0, 140)}”.`
        : " (no brief given, defaults held)."),
    lighting: `Radial glow of ${p.a} over the ${p.bg} floor — brightness tracks the track's live level at ${pct}% drive.`,
    texture: `${tmeta.label} strokes drawn with additive blending and a closing vignette — flat vector light, no grain.`,
    treatment: opts.treatment,
    palette: opts.palette,
    intensity: opts.intensity,
    scenes,
  };
}

function directorPrompt(input: {
  title: string;
  length: number;
  start: number;
  aspect: Aspect;
  treatment: Treatment;
  palette: PaletteName;
  intensity: number;
  vibe: string;
}): string {
  const treatments = TREATMENTS.map((t) => t.id).join("|");
  const palettes = (Object.keys(PALETTES) as PaletteName[]).join("|");
  return [
    "You are the AI director of OmniAI's Music Video Studio. The renderer is procedural and audio-reactive only: no footage, no photos, no faces — it draws abstract graphics synced to the music.",
    `Treatments: ${treatments}. Palettes: ${palettes}.`,
    `Track: "${input.title}". Clip: ${input.length}s (from ${input.start}s). Format: ${input.aspect}. Base treatment: ${input.treatment}. Base palette: ${input.palette}. Intensity: ${Math.round(input.intensity * 100)}%.`,
    `User vibe brief: ${input.vibe.trim() || "(none given)"}`,
    "Return ONLY raw JSON, no prose, no markdown fences, in exactly this shape:",
    `{"creativeRead":"2-3 sentences on the track's energy arc","lighting":"one line of lighting direction","texture":"one line of texture direction","treatment":"${treatments}","palette":"${palettes}","intensity":0.85,"scenes":[{"start":0,"end":4.5,"title":"short scene name","story":"1-2 sentences of what the procedural picture does here","treatment":"${treatments}","palette":"${palettes}"}]}`,
    `Scenes must be ordered, gap-free and cover 0 to ${input.length} exactly (at most 8 scenes, each at least 0.4s).`,
  ].join("\n");
}

function revisePrompt(input: {
  title: string;
  length: number;
  aspect: Aspect;
  plan: DirectorRead;
  feedback: string;
}): string {
  return [
    "You are the AI director of OmniAI's Music Video Studio (procedural, audio-reactive renderer only). Revise the plan for this feedback.",
    `Track: "${input.title}". Clip: ${input.length}s. Format: ${input.aspect}.`,
    `Current plan: ${JSON.stringify({
      creativeRead: input.plan.creativeRead,
      lighting: input.plan.lighting,
      texture: input.plan.texture,
      treatment: input.plan.treatment,
      palette: input.plan.palette,
      intensity: input.plan.intensity,
      scenes: input.plan.scenes.map((s) => ({
        start: s.start,
        end: s.end,
        title: s.title,
        story: s.story,
        treatment: s.treatment,
        palette: s.palette,
      })),
    })}`,
    `Feedback: ${input.feedback}`,
    `Return ONLY raw JSON in the same shape as before (creativeRead, lighting, texture, treatment, palette, intensity, scenes[]), gap-free over 0 to ${input.length}, at least 0.4s per scene.`,
  ].join("\n");
}

function makeSteps(): Step[] {
  return [
    { key: "read", title: "Reading the Track", sub: "Waiting for the source", status: "pending", progress: 0 },
    { key: "director", title: "Asking the Director", sub: "Local relay", status: "pending", progress: 0 },
    { key: "look", title: "Building the Look", sub: "Palette and treatment", status: "pending", progress: 0 },
    { key: "scenes", title: "Cutting the Scenes", sub: "Splitting the timeline", status: "pending", progress: 0 },
    { key: "render", title: "Rendering the Film", sub: "Waiting for the render", status: "pending", progress: 0 },
    { key: "finish", title: "Finishing the Cut", sub: "Packaging the file", status: "pending", progress: 0 },
  ];
}

export default function PulseStudioPage() {
  /* ------------------------------- source ------------------------------- */
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [locals, setLocals] = useState<Record<string, { title: string; url: string }>>({});
  const [loading, setLoading] = useState(true);
  const [libraryError, setLibraryError] = useState<string | null>(null);
  const [sourceTab, setSourceTab] = useState<"library" | "upload">("library");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [decoding, setDecoding] = useState(false);
  const [peaks, setPeaks] = useState<Float32Array | null>(null);
  const [trackDuration, setTrackDuration] = useState(0);
  const [trimStart, setTrimStart] = useState(0);
  const [trimLength, setTrimLength] = useState(0);

  /* ------------------------------ concept ------------------------------- */
  const [stage, setStage] = useState(0);
  const [vibe, setVibe] = useState("");
  const [treatment, setTreatment] = useState<Treatment>("ecg");
  const [paletteName, setPaletteName] = useState<PaletteName>("violet");
  const [aspect, setAspect] = useState<Aspect>("16:9");
  const [intensity, setIntensity] = useState(0.85);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  /* -------------------------------- build ------------------------------- */
  const [tab, setTab] = useState<"timeline" | "studio">("timeline");
  const [transcript, setTranscript] = useState<Entry[]>([]);
  const [steps, setSteps] = useState<Step[]>(makeSteps);
  const [plan, setPlan] = useState<DirectorRead | null>(null);
  const [running, setRunning] = useState(false);
  const [adjust, setAdjust] = useState("");
  const [keyframes, setKeyframes] = useState<Record<number, string>>({});

  /* ------------------------------ transport ----------------------------- */
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [rendering, setRendering] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultName, setResultName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const acRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const recordDestRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const stopTimerRef = useRef<number | null>(null);
  const resultUrlRef = useRef<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const waveRef = useRef<HTMLDivElement | null>(null);
  const waveCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const structCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const laneCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const transcriptRef = useRef<HTMLDivElement | null>(null);
  const adjustRef = useRef<HTMLInputElement | null>(null);
  const capturedRef = useRef<Set<number>>(new Set());
  const playingRef = useRef(false);
  const renderingRef = useRef(false);
  const dragRef = useRef<{ mode: "move" | "start" | "end"; grab: number } | null>(null);
  const pendingRenderRef = useRef(false);
  const renderFilmRef = useRef<() => Promise<void>>(async () => {});
  const localsRef = useRef<Record<string, { title: string; url: string }>>({});

  localsRef.current = locals;
  playingRef.current = playing;
  renderingRef.current = rendering;

  const palette = PALETTES[paletteName];
  const aspectMeta = ASPECTS[aspect];

  const tracks: Track[] = [
    ...assets
      .filter((asset) => urls[asset.storage_path])
      .map((asset) => ({
        key: `asset:${asset.id}`,
        title: trackTitle(asset),
        url: urls[asset.storage_path],
        origin: "library" as const,
      })),
    ...Object.entries(locals).map(([key, value]) => ({
      key,
      title: value.title,
      url: value.url,
      origin: "local" as const,
    })),
  ];
  const selected = tracks.find((track) => track.key === selectedKey) ?? null;
  const selectedTitle = selected?.title ?? "";
  const selectedUrl = selected?.url ?? null;

  const relNow = Math.max(0, elapsed - trimStart);
  const activeIdx = plan ? sceneAt(plan.scenes, relNow) : -1;
  const activeScene = plan && activeIdx >= 0 ? plan.scenes[activeIdx] : null;
  const planReady = Boolean(plan) && !running;
  const canConfirm = Boolean(peaks) && Boolean(selected) && !decoding && trimLength >= MIN_CLIP_SECONDS;

  /* ------------------------------ loading ------------------------------- */

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
    } catch (loadError) {
      setLibraryError(errorText(loadError, "Could not load your library."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    supabase.auth
      .getSession()
      .then(({ data }) => setSignedIn(Boolean(data.session)))
      .catch(() => setSignedIn(false));
  }, [refresh]);

  useEffect(() => {
    return () => {
      for (const value of Object.values(localsRef.current)) URL.revokeObjectURL(value.url);
    };
  }, []);

  /* --------------------------- audio plumbing --------------------------- */

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

  const stopRecording = useCallback(() => {
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
  }, []);

  /** Keep the canvas at export resolution while its tab is open. */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { w, h } = ASPECTS[aspect];
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
  }, [aspect, tab]);

  /**
   * The paint loop: draws the live treatment (scene-aware), keeps the clip
   * looping inside the trim window, stops the recorder at the trim end and
   * captures one real keyframe per scene while the film runs.
   */
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

      const el = audioRef.current;
      const now = el && Number.isFinite(el.currentTime) ? el.currentTime : 0;
      const rel = trimLength > 0 ? now - trimStart : -1;

      // Scene-aware look: the director's cut picks treatment + palette live.
      let lookTreatment = treatment;
      let lookPalette = palette;
      if (plan && rel >= 0) {
        const idx = sceneAt(plan.scenes, rel);
        const scene = idx >= 0 ? plan.scenes[idx] : null;
        if (scene) {
          lookTreatment = scene.treatment;
          lookPalette = PALETTES[scene.palette];
        }
      }

      drawTreatment(
        ctx,
        canvas.width,
        canvas.height,
        { freq, time, level, bass, treble },
        lookPalette,
        lookTreatment,
        intensity,
        performance.now() / 1000,
      );

      // Clip discipline: preview loops inside the window; renders stop at its end.
      if (el && trimLength > 0) {
        if (renderingRef.current && now >= trimStart + trimLength - 0.05) {
          stopRecording();
        } else if (!renderingRef.current && playingRef.current && (now >= trimStart + trimLength || now < trimStart - 0.5)) {
          el.currentTime = trimStart;
        }
      }

      // Capture one honest keyframe per scene (drawn frames, never fakes).
      if (plan && el && !el.paused && trimLength > 0 && rel >= 0) {
        const idx = sceneAt(plan.scenes, rel);
        if (idx >= 0 && !capturedRef.current.has(idx)) {
          capturedRef.current.add(idx);
          try {
            const shot = canvas.toDataURL("image/jpeg", 0.7);
            setKeyframes((prev) => ({ ...prev, [idx]: shot }));
          } catch {
            // Capture unsupported — the card stays in its honest pending state.
          }
        }
      }
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [palette, treatment, intensity, plan, trimStart, trimLength, stopRecording]);

  /** Live clock, trim-window progress, audio-end hook. */
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;

    const onTime = () => {
      setElapsed(el.currentTime);
      if (renderingRef.current && trimLength > 0) {
        const rel = clamp(el.currentTime - trimStart, 0, trimLength);
        const pct = Math.round((rel / trimLength) * 100);
        setSteps((prev) =>
          prev.map((step) =>
            step.key === "render" && step.status === "running" && pct > step.progress
              ? { ...step, progress: pct }
              : step,
          ),
        );
      }
    };
    const onEnd = () => {
      setPlaying(false);
      if (!renderingRef.current) setElapsed(trimStart);
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
  }, [selectedKey, trimStart, trimLength]);

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

  useEffect(() => {
    const list = transcriptRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [transcript]);

  /* ------------------------------ waveform ------------------------------ */

  useEffect(() => {
    const canvas = waveCanvasRef.current;
    if (!canvas || !peaks || !trackDuration) return;
    const draw = () => {
      const from = (trimStart / trackDuration) * peaks.length;
      const to = ((trimStart + trimLength) / trackDuration) * peaks.length;
      drawWave(canvas, peaks, from, to, { dim: "#4b4370", hot: palette.a }, { from, to });
    };
    draw();
    window.addEventListener("resize", draw);
    return () => window.removeEventListener("resize", draw);
  }, [peaks, trimStart, trimLength, trackDuration, palette]);

  /** Structure strip (timeline) + audio lane (studio), drawn from real peaks. */
  useEffect(() => {
    if (!peaks || !trackDuration || trimLength <= 0) return;
    const from = (trimStart / trackDuration) * peaks.length;
    const to = ((trimStart + trimLength) / trackDuration) * peaks.length;
    const colors = { dim: "#5b5386", hot: palette.a };
    const struct = structCanvasRef.current;
    if (struct) drawWave(struct, peaks, from, to, colors);
    const lane = laneCanvasRef.current;
    if (lane) drawWave(lane, peaks, from, to, colors);
  }, [peaks, trimStart, trimLength, trackDuration, tab, palette]);

  function wavePos(clientX: number): number {
    const rect = waveRef.current?.getBoundingClientRect();
    if (!rect || !trackDuration) return 0;
    return clamp((clientX - rect.left) / Math.max(1, rect.width), 0, 1) * trackDuration;
  }

  function onWavePointerDown(mode: "move" | "start" | "end", event: React.PointerEvent<HTMLElement>) {
    if (!peaks || !trackDuration) return;
    // Handles live inside the selection div — keep their pointerdown from
    // bubbling into the selection's "move" handler and stealing the mode.
    event.stopPropagation();
    const t = wavePos(event.clientX);
    dragRef.current = { mode, grab: mode === "move" ? t - trimStart : 0 };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  function onWavePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || !trackDuration) return;
    const t = wavePos(event.clientX);

    if (drag.mode === "move") {
      setTrimStart(clamp(t - drag.grab, 0, Math.max(0, trackDuration - trimLength)));
    } else if (drag.mode === "start") {
      const end = trimStart + trimLength;
      const minLen = Math.min(MIN_CLIP_SECONDS, end);
      const start = clamp(t, 0, end - minLen);
      setTrimStart(start);
      setTrimLength(end - start);
    } else {
      const minLen = Math.min(MIN_CLIP_SECONDS, trackDuration - trimStart);
      const end = clamp(t, trimStart + minLen, trackDuration);
      setTrimLength(end - trimStart);
    }
  }

  function onWavePointerUp(event: React.PointerEvent<HTMLDivElement>) {
    dragRef.current = null;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // Pointer already released.
    }
  }

  function applyPreset(seconds: number | "full") {
    if (!trackDuration) return;
    const len = seconds === "full" ? trackDuration : Math.min(seconds, trackDuration);
    let start = trimStart;
    if (start + len > trackDuration) start = Math.max(0, trackDuration - len);
    setTrimStart(start);
    setTrimLength(Math.max(MIN_CLIP_SECONDS, Math.min(len, trackDuration - start)));
  }

  /* ------------------------------ flow: source --------------------------- */

  const selectTrack = useCallback(async (key: string, url: string) => {
    const el = audioRef.current;
    el?.pause();
    setPlaying(false);
    setSelectedKey(key);
    setError(null);
    setPeaks(null);
    setTrackDuration(0);
    setTrimStart(0);
    setTrimLength(0);
    setDecoding(true);
    try {
      const result = await loadPeaks(url);
      setPeaks(result.peaks);
      setTrackDuration(result.duration);
      setTrimLength(Math.min(15, result.duration));
    } catch (decodeError) {
      setError(errorText(decodeError, "Could not decode this track."));
    } finally {
      setDecoding(false);
    }
  }, []);

  function onFilePicked(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const looksAudio =
      file.type.startsWith("audio/") || /\.(mp3|wav|flac|m4a|aac|ogg|webm)$/i.test(file.name);
    if (!looksAudio) {
      setError("Pick an audio file (mp3, wav, flac, m4a or aac).");
      return;
    }
    const url = URL.createObjectURL(file);
    const key = `local:${Date.now()}`;
    const title = file.name.replace(/\.[^.]+$/, "").slice(0, 70) || "Local file";
    setLocals((prev) => ({ ...prev, [key]: { title, url } }));
    setError(null);
    void selectTrack(key, url);
  }

  /* ------------------------------ flow: build ---------------------------- */

  const say = (text: string) => setTranscript((prev) => [...prev, { id: prev.length, role: "agent", text }]);
  const setStep = (key: string, patch: Partial<Step>) =>
    setSteps((prev) => prev.map((step) => (step.key === key ? { ...step, ...patch } : step)));

  async function runDirector() {
    if (!selected || !peaks || trimLength < MIN_CLIP_SECONDS) {
      setError("Pick a source and confirm a clip first.");
      setStage(0);
      return;
    }

    setRunning(true);
    setPlan(null);
    setTranscript([]);
    setSteps(makeSteps());
    setKeyframes({});
    capturedRef.current = new Set();

    const opts = { length: trimLength, treatment, palette: paletteName, intensity };
    const windowLabel = `${formatClock(trimLength)} window (${formatClock(trimStart)}–${formatClock(
      trimStart + trimLength,
    )})`;

    say(`Reading “${selectedTitle}” — a ${windowLabel} in ${aspect}.`);
    setStep("read", { status: "done", progress: 100, sub: `${WAVE_BUCKETS} peak buckets ready` });
    say(`Waveform decoded — ${WAVE_BUCKETS} buckets across the clip window. Structure will map to the scene cut.`);

    setStep("director", {
      status: "running",
      sub: signedIn ? "Asking the local relay" : "No session — expecting offline",
    });

    let finalPlan: DirectorRead;
    try {
      const result = await requestLocalAi(
        "chat",
        directorPrompt({
          title: selectedTitle,
          length: trimLength,
          start: trimStart,
          aspect,
          treatment,
          palette: paletteName,
          intensity,
          vibe,
        }),
        120000,
      );
      const raw = extractJson(result.response ?? "");
      const parsed = raw ? coercePlan(raw, opts) : null;
      if (!parsed) throw new Error("the model replied without usable JSON");
      finalPlan = parsed;
      setPlan(finalPlan);
      setStep("director", { status: "done", progress: 100, sub: "creative read ready" });
      say(`Creative read ready — ${finalPlan.creativeRead.slice(0, 220)}`);
    } catch (relayError) {
      const message = errorText(relayError, "the local relay did not answer");
      finalPlan = housePlan(selectedTitle, vibe, opts);
      setPlan(finalPlan);
      setStep("director", { status: "done", progress: 100, sub: "offline · house rules" });
      say(`Local director unavailable — ${message}. The house rules wrote this plan and the plan is labeled “house rules”.`);
    }

    const lookMeta = TREATMENTS.find((t) => t.id === finalPlan.treatment) ?? TREATMENTS[0];
    const lookPalette = PALETTES[finalPlan.palette];
    setStep("look", {
      status: "done",
      progress: 100,
      sub: `${lookPalette.label} · ${lookMeta.label} · ${Math.round(finalPlan.intensity * 100)}%`,
    });
    setStep("scenes", {
      status: "done",
      progress: 100,
      sub: `${finalPlan.scenes.length} scene${finalPlan.scenes.length === 1 ? "" : "s"} · ${formatClock(trimLength)}`,
    });
    say(
      `Look locked — ${lookMeta.label} in the ${lookPalette.label} palette, cut into ${finalPlan.scenes.length} scene${finalPlan.scenes.length === 1 ? "" : "s"}. Open Studio and press Render & download when you're happy — or tell me what to adjust below.`,
    );
    setRunning(false);
  }

  function beginBuild() {
    if (!selected || !peaks || trimLength < MIN_CLIP_SECONDS) {
      setError("Confirm a clip in stage 01 first.");
      setStage(0);
      return;
    }
    setError(null);
    if (resultUrlRef.current) {
      URL.revokeObjectURL(resultUrlRef.current);
      resultUrlRef.current = null;
    }
    setResultUrl(null);
    setResultName(null);
    setKeyframes({});
    setTab("timeline");
    setStage(2);
    void runDirector();
  }

  async function sendAdjust() {
    const text = adjust.trim();
    if (!text || !plan || running) return;
    setAdjust("");
    setTranscript((prev) => [...prev, { id: prev.length, role: "user", text }]);
    setRunning(true);
    try {
      const result = await requestLocalAi(
        "chat",
        revisePrompt({
          title: selectedTitle,
          length: trimLength,
          aspect,
          plan,
          feedback: text,
        }),
        120000,
      );
      const raw = extractJson(result.response ?? "");
      const next = raw
        ? coercePlan(raw, { length: trimLength, treatment, palette: paletteName, intensity })
        : null;
      if (!next) throw new Error("the model replied without usable JSON");
      setPlan(next);
      setKeyframes({});
      capturedRef.current = new Set();
      say("Plan updated — re-render in Studio to apply the new cut.");
    } catch (relayError) {
      say(`Adjustment failed — ${errorText(relayError, "the local relay did not answer")}. Nothing changed.`);
    } finally {
      setRunning(false);
    }
  }

  function noteFeedback(kind: "up" | "down") {
    setTranscript((prev) => [
      ...prev,
      {
        id: prev.length,
        role: "user",
        text: kind === "up" ? "Direction approved." : "Direction rejected — tell me what to change.",
      },
    ]);
    if (kind === "down") adjustRef.current?.focus();
  }

  /* ---------------------------- flow: transport -------------------------- */

  async function togglePlay() {
    const el = audioRef.current;
    if (!el || !selectedUrl || trimLength < MIN_CLIP_SECONDS) return;
    setError(null);
    ensureGraph();
    if (!el.src || el.src !== selectedUrl) el.src = selectedUrl;
    if (playing) {
      el.pause();
      return;
    }
    if (el.currentTime < trimStart || el.currentTime >= trimStart + trimLength) {
      el.currentTime = trimStart;
    }
    try {
      await el.play();
    } catch (playError) {
      setError(errorText(playError, "Playback was blocked — click play again."));
    }
  }

  async function renderFilm() {
    const el = audioRef.current;
    const canvas = canvasRef.current;
    if (tab !== "studio") {
      // The render surface only lives in the Studio tab — jump there and
      // start the moment the canvas is mounted (see the pending flag effect).
      setTab("studio");
      pendingRenderRef.current = true;
      return;
    }
    if (!el || !canvas || !selectedUrl || !plan) {
      setError("Build a plan first — the director needs a track.");
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
    if (resultUrlRef.current) {
      URL.revokeObjectURL(resultUrlRef.current);
      resultUrlRef.current = null;
    }
    setResultUrl(null);
    setResultName(null);
    setKeyframes({});
    capturedRef.current = new Set();
    setRendering(true);
    setTab("studio");
    setStep("render", { status: "running", progress: 0, sub: `Recording at ${FPS} fps` });
    setStep("finish", { status: "pending", progress: 0, sub: "Packaging the file" });

    try {
      const { w, h } = ASPECTS[aspect];
      canvas.width = w;
      canvas.height = h;

      const stream = canvas.captureStream(FPS);
      const audioTrack = recordDestRef.current?.stream.getAudioTracks()[0];
      if (audioTrack) stream.addTrack(audioTrack);

      const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6_000_000 });
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
        stream.getTracks().forEach((track) => track.stop());
        if (blob.size === 0) {
          setError("The recorder produced an empty file — try a shorter clip.");
          setStep("render", { status: "pending", progress: 0, sub: "Waiting for the render" });
          return;
        }
        const url = URL.createObjectURL(blob);
        resultUrlRef.current = url;
        setResultUrl(url);
        setResultName(`omniai-mv-${plan.treatment}-${aspect.replace(":", "x")}.webm`);
        setStep("render", {
          status: "done",
          progress: 100,
          sub: `${(blob.size / 1048576).toFixed(1)} MB · ${formatClock(trimLength)}`,
        });
        setStep("finish", { status: "done", progress: 100, sub: "file ready — download below" });
        say(
          `Render complete — ${(blob.size / 1048576).toFixed(1)} MB of ${formatClock(trimLength)} at ${aspect}. Download it from Final Video.`,
        );
      };

      recorderRef.current = recorder;

      el.src = selectedUrl;
      el.currentTime = trimStart;
      await ac.resume();
      await el.play();
      setPlaying(true);

      recorder.start(250);
      stopTimerRef.current = window.setTimeout(
        () => stopRecording(),
        Math.min(MAX_RENDER_SECONDS, trimLength + 6) * 1000,
      );
    } catch (renderError) {
      setRendering(false);
      recorderRef.current = null;
      setStep("render", { status: "pending", progress: 0, sub: "Waiting for the render" });
      setError(errorText(renderError, "Render failed — try a different browser or a shorter clip."));
    }
  }

  renderFilmRef.current = renderFilm;

  /** A render requested from the Timeline tab starts once Studio mounts the canvas. */
  useEffect(() => {
    if (tab === "studio" && pendingRenderRef.current && canvasRef.current) {
      pendingRenderRef.current = false;
      void renderFilmRef.current();
    }
  }, [tab]);

  /* --------------------------------- views ------------------------------- */

  return (
    <div className="mvstudio">
      <header className="mv-head">
        <p className="mv-eyebrow">OMNIAI / STAGED MUSIC VIDEO</p>
        <h1>Music Video Studio</h1>
        <p className="mv-sub">
          Three stages, like a real production line: choose the clip, brief the AI director, then
          watch the plan build and render a beat-synced film right here in the browser. The
          director runs on your laptop’s model; if the relay is offline the house rules take over —
          and the plan always says which one wrote it.
        </p>
      </header>

      {error && (
        <p role="alert" className="mv-alert">
          {error}
        </p>
      )}

      <audio ref={audioRef} preload="metadata" crossOrigin="anonymous" className="mv-hidden" />

      <nav className="mv-rail" aria-label="Build stages">
        {STAGES.map((item, index) => {
          const status = stage > index ? "done" : stage === index ? "now" : "next";
          return (
            <button
              key={item.n}
              type="button"
              className={`mv-rail-key is-${status}`}
              onClick={() => {
                if (index <= stage) setStage(index);
              }}
              disabled={index > stage}
            >
              <span className="mv-rail-n">{status === "done" ? "✓" : item.n}</span>
              <span className="mv-rail-copy">
                <strong>{item.name}</strong>
                <small>{item.sub}</small>
              </span>
            </button>
          );
        })}
        <span className="mv-rail-note">
          {selectedTitle ? `NOW CUTTING · ${selectedTitle} · ${formatClock(trimLength)}` : "NO SOURCE YET"}
        </span>
      </nav>

      {/* ------------------------------- STAGE 01 ------------------------------ */}
      {stage === 0 && (
        <section className="mv-stage">
          <DisplaySurface accent={palette.a} state={selected ? "good" : "idle"} seed={71} />
          <div className="mv-stage-head">
            <p className="mv-label">
              STAGE <span>/</span> 01
            </p>
            <h2>Choose music</h2>
            <p className="mv-stage-sub">
              A track from your library or a file on this machine — then trim the clip the film
              will cover.
            </p>
          </div>

          <div className="mv-tabs">
            <button
              type="button"
              className={`mv-tab ${sourceTab === "library" ? "is-on" : ""}`}
              onClick={() => setSourceTab("library")}
            >
              LIBRARY
            </button>
            <button
              type="button"
              className={`mv-tab ${sourceTab === "upload" ? "is-on" : ""}`}
              onClick={() => setSourceTab("upload")}
            >
              UPLOAD
            </button>
          </div>

          {sourceTab === "library" ? (
            loading ? (
              <p className="mv-empty">Loading your library…</p>
            ) : libraryError ? (
              <p className="mv-empty is-warn">{libraryError}</p>
            ) : tracks.filter((track) => track.origin === "library").length === 0 ? (
              <div className="mv-empty-box">
                <p>No tracks in the library yet.</p>
                <p>
                  Compose one in{" "}
                  <Link href="/music" className="mv-link">
                    Music Studio →
                  </Link>{" "}
                  or drop a file in UPLOAD — this stage has no fake generators.
                </p>
              </div>
            ) : (
              <div className="mv-track-grid">
                {tracks
                  .filter((track) => track.origin === "library")
                  .map((track) => (
                    <button
                      key={track.key}
                      type="button"
                      onClick={() => void selectTrack(track.key, track.url)}
                      className={`mv-track ${track.key === selectedKey ? "is-on" : ""}`}
                    >
                      <span className="mv-track-art" aria-hidden="true">
                        ♪
                      </span>
                      <span className="mv-track-copy">
                        <strong title={track.title}>{track.title}</strong>
                        <small>{track.origin === "local" ? "this machine" : "library"}</small>
                      </span>
                      <span className="mv-track-pick" aria-hidden="true">
                        {track.key === selectedKey ? "✓" : "○"}
                      </span>
                    </button>
                  ))}
              </div>
            )
          ) : (
            <div className="mv-upload">
              <input
                ref={fileRef}
                id="mv-file"
                type="file"
                accept="audio/*"
                onChange={onFilePicked}
                className="mv-hidden"
              />
              <label htmlFor="mv-file" className="mv-upload-key">
                ⤒ Choose an audio file
              </label>
              <p className="mv-note">
                mp3 · wav · flac · m4a · aac — the file stays in this browser tab, decoded locally,
                never uploaded anywhere.
              </p>
              {tracks.filter((track) => track.origin === "local").length > 0 && (
                <div className="mv-track-grid">
                  {tracks
                    .filter((track) => track.origin === "local")
                    .map((track) => (
                      <button
                        key={track.key}
                        type="button"
                        onClick={() => void selectTrack(track.key, track.url)}
                        className={`mv-track ${track.key === selectedKey ? "is-on" : ""}`}
                      >
                        <span className="mv-track-art" aria-hidden="true">
                          ♪
                        </span>
                        <span className="mv-track-copy">
                          <strong title={track.title}>{track.title}</strong>
                          <small>this machine</small>
                        </span>
                        <span className="mv-track-pick" aria-hidden="true">
                          {track.key === selectedKey ? "✓" : "○"}
                        </span>
                      </button>
                    ))}
                </div>
              )}
            </div>
          )}

          {selected && (
            <div className="mv-trim">
              <div className="mv-trim-head">
                <p className="mv-label">
                  CLIP <span>/</span> WINDOW
                </p>
                <span className="mv-trim-title" title={selectedTitle}>
                  {selectedTitle}
                </span>
                <span className="mv-trim-times">
                  {formatClock(trimStart)} → {formatClock(trimStart + trimLength)}
                </span>
              </div>

              <div
                ref={waveRef}
                className="mv-wave"
                onPointerMove={onWavePointerMove}
                onPointerUp={onWavePointerUp}
                onPointerCancel={onWavePointerUp}
              >
                <canvas ref={waveCanvasRef} className="mv-wave-canvas" aria-hidden="true" />
                {peaks && trackDuration > 0 && (
                  <div
                    className="mv-sel"
                    style={{
                      left: `${(trimStart / trackDuration) * 100}%`,
                      width: `${Math.max(1.5, (trimLength / trackDuration) * 100)}%`,
                    }}
                    onPointerDown={(event) => onWavePointerDown("move", event)}
                  >
                    <span
                      className="mv-sel-handle is-start"
                      onPointerDown={(event) => onWavePointerDown("start", event)}
                    />
                    <span
                      className="mv-sel-handle is-end"
                      onPointerDown={(event) => onWavePointerDown("end", event)}
                    />
                  </div>
                )}
              </div>

              <div className="mv-trim-row">
                <div className="mv-presets" role="group" aria-label="Clip length presets">
                  {CLIP_PRESETS.map((seconds) => (
                    <button
                      key={seconds}
                      type="button"
                      className="mv-preset"
                      onClick={() => applyPreset(seconds)}
                      disabled={!trackDuration}
                    >
                      {seconds}s
                    </button>
                  ))}
                  <button
                    type="button"
                    className="mv-preset"
                    onClick={() => applyPreset("full")}
                    disabled={!trackDuration}
                  >
                    FULL
                  </button>
                </div>
                <button
                  type="button"
                  className="mv-key"
                  onClick={() => void togglePlay()}
                  disabled={!selectedUrl || !peaks}
                >
                  {playing ? "❚❚ Pause" : "▶ Preview clip"}
                </button>
                <span className="mv-note">
                  {decoding
                    ? "Decoding waveform from the real file…"
                    : peaks && trackDuration
                      ? `${formatClock(trackDuration)} source · ${formatClock(trimLength)} clip · drag the window to slide`
                      : "Select to decode"}
                </span>
              </div>
            </div>
          )}

          <div className="mv-stage-foot">
            <p className="mv-note">
              {peaks
                ? "The waveform is measured from the file itself — no placeholder graphics."
                : "Pick a track to decode its waveform."}
            </p>
            <button
              type="button"
              className="mv-key is-primary"
              onClick={() => setStage(1)}
              disabled={!canConfirm}
            >
              Confirm clip <span>→</span>
            </button>
          </div>
        </section>
      )}

      {/* ------------------------------- STAGE 02 ------------------------------ */}
      {stage === 1 && (
        <section className="mv-stage">
          <DisplaySurface accent={palette.b} state="busy" seed={72} />
          <div className="mv-stage-head">
            <p className="mv-label">
              STAGE <span>/</span> 02
            </p>
            <h2>What do you want to create?</h2>
            <p className="mv-stage-sub">
              Brief the director in your own words, set the look, then send it to the build.
            </p>
          </div>

          <div className="mv-chip-track">
            <span className="mv-chip-art" aria-hidden="true">
              ♪
            </span>
            <strong title={selectedTitle}>{selectedTitle || "No source"}</strong>
            <small>{formatClock(trimLength)}</small>
            <button type="button" className="mv-chip-x" onClick={() => setStage(0)} aria-label="Change source">
              ✕
            </button>
          </div>

          <div className="mv-brief">
            <textarea
              className="mv-vibe"
              value={vibe}
              onChange={(event) => setVibe(event.target.value)}
              maxLength={600}
              rows={4}
              placeholder="Describe a vibe for the AI director — e.g. dark smoky arena, hard cuts on the kick, cold blue haze…"
            />

            <div className="mv-settings">
              <div className="mv-setting">
                <span className="mv-setting-label">FORMAT</span>
                <div className="mv-seg">
                  {(Object.keys(ASPECTS) as Aspect[]).map((name) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => setAspect(name)}
                      aria-pressed={aspect === name}
                      className={aspect === name ? "is-on" : ""}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mv-setting">
                <span className="mv-setting-label">CLIP</span>
                <strong className="mv-readout">{formatClock(trimLength)}</strong>
              </div>

              <div className="mv-setting">
                <span className="mv-setting-label">PALETTE</span>
                <div className="mv-seg">
                  {(Object.keys(PALETTES) as PaletteName[]).map((name) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => setPaletteName(name)}
                      aria-pressed={paletteName === name}
                      className={paletteName === name ? "is-on" : ""}
                    >
                      <span className="mv-dot" style={{ background: PALETTES[name].a }} />
                      {PALETTES[name].label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mv-setting is-wide">
                <span className="mv-setting-label">
                  INTENSITY <b>{Math.round(intensity * 100)}%</b>
                </span>
                <input
                  type="range"
                  min={20}
                  max={100}
                  value={Math.round(intensity * 100)}
                  onChange={(event) => setIntensity(Number(event.target.value) / 100)}
                  aria-label="Intensity"
                />
              </div>
            </div>
          </div>

          <div className="mv-kinds">
            <span className="mv-setting-label">PICTURE TREATMENT</span>
            <div className="mv-chips">
              {TREATMENTS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setTreatment(option.id)}
                  aria-pressed={treatment === option.id}
                  className={`mv-chip ${treatment === option.id ? "is-on" : ""}`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <p className="mv-note">{TREATMENTS.find((item) => item.id === treatment)?.blurb}</p>
          </div>

          <p className="mv-note">
            The director may re-cut scenes and looks inside the clip — every plan field it writes is
            shown to you in stage 03, labeled with its source. No relay? The house rules write the
            plan and say so.
          </p>

          <div className="mv-stage-foot">
            <button type="button" className="mv-key" onClick={() => setStage(0)}>
              ← Source
            </button>
            <span className={`mv-engine ${signedIn === false ? "is-warn" : signedIn ? "is-ok" : ""}`}>
              <i /> DIRECTOR ·{" "}
              {signedIn === false ? "SIGN-IN NEEDED FOR AI" : signedIn ? "LOCAL AI RELAY" : "CHECKING RELAY…"}
            </span>
            <button
              type="button"
              className="mv-key is-primary"
              onClick={beginBuild}
              disabled={running || !canConfirm}
            >
              Create ✦ Build the plan
            </button>
          </div>
        </section>
      )}

      {/* ------------------------------- STAGE 03 ------------------------------ */}
      {stage === 2 && (
        <div className="mv-work">
          <div className="mv-work-bar">
            <button type="button" className="mv-key" onClick={() => setStage(0)}>
              ← Back to start
            </button>
            <div className="mv-work-tabs">
              <button
                type="button"
                className={tab === "timeline" ? "is-on" : ""}
                onClick={() => setTab("timeline")}
              >
                ▤ Timeline
              </button>
              <button
                type="button"
                className={tab === "studio" ? "is-on" : ""}
                onClick={() => setTab("studio")}
              >
                ✦ Studio
              </button>
            </div>
            <span className="mv-work-clip">
              {selectedTitle} · {formatClock(trimLength)} · {aspect}
            </span>
          </div>

          <div className="mv-work-grid">
            {/* --------------------------- director agent ------------------- */}
            <aside className="mv-agent">
              <DisplaySurface
                accent="#a78bfa"
                state={running ? "busy" : plan ? "good" : "idle"}
                seed={73}
              />
              <div className="mv-agent-head">
                <p className="mv-label">
                  MUSIC VIDEO <span>/</span> DIRECTOR
                </p>
                <span
                  className={`mv-agent-src ${plan ? (plan.source === "ai" ? "is-ai" : "is-house") : ""}`}
                >
                  {plan
                    ? plan.source === "ai"
                      ? "AI DIRECTOR"
                      : "HOUSE RULES"
                    : running
                      ? "WORKING…"
                      : "IDLE"}
                </span>
              </div>

              <div className="mv-steps">
                {steps.map((step) => (
                  <div key={step.key} className={`mv-step is-${step.status}`}>
                    <span className="mv-step-dot" aria-hidden="true">
                      {step.status === "done" ? "✓" : step.status === "running" ? "◐" : "·"}
                    </span>
                    <span className="mv-step-copy">
                      <strong>{step.title}</strong>
                      <small>{step.sub}</small>
                      <span className="mv-step-bar">
                        <i style={{ width: `${step.progress}%` }} />
                      </span>
                    </span>
                    <span className="mv-step-state">
                      {step.status === "running"
                        ? `${step.progress}%`
                        : step.status === "done"
                          ? "done"
                          : "queued"}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mv-log" ref={transcriptRef}>
                {transcript.length === 0 && (
                  <p className="mv-note">The director speaks here as the build runs.</p>
                )}
                {transcript.map((entry) => (
                  <p key={entry.id} className={`mv-line is-${entry.role}`}>
                    <b>{entry.role === "user" ? "You" : "Director"}</b> <span>{entry.text}</span>
                  </p>
                ))}
                {running && (
                  <p className="mv-line is-live">
                    <i /> working…
                  </p>
                )}
              </div>

              <div className="mv-agent-input">
                <input
                  ref={adjustRef}
                  type="text"
                  value={adjust}
                  onChange={(event) => setAdjust(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void sendAdjust();
                  }}
                  placeholder="Tell the director what to adjust…"
                  disabled={!plan || running}
                  aria-label="Adjustment for the director"
                />
                <button
                  type="button"
                  className="mv-key is-primary"
                  onClick={() => void sendAdjust()}
                  disabled={!plan || running || !adjust.trim()}
                >
                  Send
                </button>
              </div>
            </aside>

            {/* ---------------------------- document ------------------------- */}
            <div className="mv-doc-wrap">
              <DisplaySurface
                accent={planReady ? "#a78bfa" : "#6c63ff"}
                state={planReady ? "good" : running ? "busy" : "idle"}
                seed={74}
              />
              <nav className="mv-anchors" aria-label="Jump to section">
                {(
                  [
                    ["track", "♪", "Your track"],
                    ["style", "✦", "Visual style"],
                    ["scenes", "▤", "Scene plan"],
                    ["final", "◉", "Final video"],
                  ] as [string, string, string][]
                ).map(([id, glyph, label]) => (
                  <button
                    key={id}
                    type="button"
                    title={label}
                    aria-label={label}
                    onClick={() => {
                      if (tab !== "timeline") setTab("timeline");
                      window.requestAnimationFrame(() => {
                        document
                          .getElementById(`mv-sec-${id}`)
                          ?.scrollIntoView({ behavior: "smooth", block: "start" });
                      });
                    }}
                  >
                    {glyph}
                  </button>
                ))}
              </nav>

              {tab === "timeline" ? (
                <div className="mv-doc">
                  {/* ------------------------- creative read ------------------ */}
                  <section id="mv-sec-track" className="mv-card">
                    <p className="mv-card-kicker">CREATIVE READ</p>
                    <div className="mv-read-head">
                      <span className="mv-read-art" aria-hidden="true">
                        ♪
                      </span>
                      <div className="mv-read-copy">
                        <strong>{selectedTitle || "No source"}</strong>
                        <p>
                          <span>{formatClock(trimLength)} clip</span>
                          <span>{plan ? `${plan.scenes.length} scenes` : "—"}</span>
                          <span>{aspect}</span>
                          <span className={plan?.source === "house" ? "is-house" : ""}>
                            {plan ? (plan.source === "ai" ? "AI director" : "house rules") : running ? "writing…" : "—"}
                          </span>
                        </p>
                      </div>
                      <button
                        type="button"
                        className="mv-key"
                        onClick={() => void togglePlay()}
                        disabled={!selectedUrl || !peaks}
                        title="Preview the clip"
                      >
                        {playing ? "❚❚" : "▶"}
                      </button>
                    </div>

                    <p className="mv-label mv-sub-label">
                      SONG <span>/</span> STRUCTURE{" "}
                      {activeScene ? <em>now · {activeScene.title}</em> : null}
                    </p>
                    <div className="mv-structure">
                      <canvas ref={structCanvasRef} className="mv-structure-canvas" aria-hidden="true" />
                      <div className="mv-struct-scenes">
                        {plan?.scenes.map((scene, index) => (
                          <span
                            key={`${index}-${scene.title}`}
                            className={index === activeIdx ? "is-now" : ""}
                            style={{
                              left: `${(scene.start / Math.max(0.1, trimLength)) * 100}%`,
                              width: `${((scene.end - scene.start) / Math.max(0.1, trimLength)) * 100}%`,
                              borderColor: PALETTES[scene.palette].a,
                            }}
                          >
                            {scene.title}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="mv-grid2">
                      <div>
                        <p className="mv-label">
                          CREATIVE <span>/</span> READ
                        </p>
                        <p className="mv-text">
                          {plan
                            ? plan.creativeRead
                            : running
                              ? "The director is writing…"
                              : "No plan yet."}
                        </p>
                      </div>
                      <div>
                        <p className="mv-label">
                          YOUR <span>/</span> BRIEF
                        </p>
                        <p className="mv-text">{vibe.trim() || "No brief given — defaults held."}</p>
                      </div>
                    </div>
                  </section>

                  {/* -------------------------- visual style ------------------ */}
                  <section id="mv-sec-style" className="mv-card">
                    <div className="mv-card-head">
                      <div>
                        <p className="mv-card-kicker">VISUAL STYLE</p>
                        <h3>The look guiding the cut and the render.</h3>
                      </div>
                      <span
                        className={`mv-badge ${plan ? (plan.source === "ai" ? "is-ai" : "is-house") : ""}`}
                      >
                        {plan
                          ? plan.source === "ai"
                            ? "AI"
                            : "HOUSE"
                          : running
                            ? "WRITING…"
                            : "—"}
                      </span>
                    </div>

                    {plan ? (
                      <>
                        <div className="mv-swatches">
                          <span className="mv-swatch">
                            <i style={{ background: PALETTES[plan.palette].a }} />
                            {PALETTES[plan.palette].a.toUpperCase()}
                          </span>
                          <span className="mv-swatch">
                            <i style={{ background: PALETTES[plan.palette].b }} />
                            {PALETTES[plan.palette].b.toUpperCase()}
                          </span>
                          <span className="mv-swatch">
                            <i style={{ background: PALETTES[plan.palette].c }} />
                            {PALETTES[plan.palette].c.toUpperCase()}
                          </span>
                          <span className="mv-swatch">
                            <i style={{ background: PALETTES[plan.palette].bg }} />
                            {PALETTES[plan.palette].bg.toUpperCase()} FLOOR
                          </span>
                        </div>

                        <div className="mv-grid2">
                          <div>
                            <p className="mv-label">LIGHTING</p>
                            <p className="mv-text">{plan.lighting}</p>
                          </div>
                          <div>
                            <p className="mv-label">TEXTURE</p>
                            <p className="mv-text">{plan.texture}</p>
                          </div>
                        </div>

                        <div className="mv-style-foot">
                          <p className="mv-note">
                            {treatmentLabel(plan.treatment)} · {PALETTES[plan.palette].label} ·{" "}
                            {Math.round(plan.intensity * 100)}% intensity
                          </p>
                          <div className="mv-thumbs">
                            <button
                              type="button"
                              className="mv-key"
                              title="Approve the direction"
                              onClick={() => noteFeedback("up")}
                            >
                              👍
                            </button>
                            <button
                              type="button"
                              className="mv-key"
                              title="Reject and tell the director why"
                              onClick={() => noteFeedback("down")}
                            >
                              👎
                            </button>
                          </div>
                        </div>
                      </>
                    ) : (
                      <p className="mv-note">{running ? "Building the look…" : "No plan yet."}</p>
                    )}
                  </section>

                  {/* --------------------------- scene plan ------------------- */}
                  <section id="mv-sec-scenes" className="mv-card">
                    <div className="mv-card-head">
                      <div>
                        <p className="mv-card-kicker">SCENE PLAN</p>
                        <h3>
                          {plan
                            ? `${plan.scenes.length} scene${plan.scenes.length === 1 ? "" : "s"}`
                            : "Waiting for the director"}{" "}
                          · storyboard keyframes
                        </h3>
                      </div>
                      <span className="mv-badge">
                        {plan
                          ? Object.keys(keyframes).length >= plan.scenes.length
                            ? "FRAMES READY"
                            : `${Object.keys(keyframes).length}/${plan.scenes.length}`
                          : running
                            ? "PLANNING…"
                            : "—"}
                      </span>
                    </div>
                    <p className="mv-note">
                      Keyframes are captured from real rendered frames while the preview plays or
                      the film records — never stock images.
                    </p>

                    {plan ? (
                      <div className="mv-scenes">
                        {plan.scenes.map((scene, index) => (
                          <article key={`scene-${index}`} className="mv-scene">
                            <div className="mv-scene-frame">
                              {keyframes[index] ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={keyframes[index]} alt={`Keyframe for ${scene.title}`} />
                              ) : (
                                <span className="mv-scene-pending">
                                  {running ? "◐" : "▶ to capture"}
                                </span>
                              )}
                              <span className="mv-scene-no">#{index + 1}</span>
                            </div>
                            <div className="mv-scene-body">
                              <div className="mv-scene-top">
                                <strong>{scene.title}</strong>
                                <span className="mv-scene-time">
                                  {formatClock(scene.start)} – {formatClock(scene.end)}
                                </span>
                              </div>
                              <p className="mv-label">STORY</p>
                              <p className="mv-text">
                                {scene.story || "Procedural pass — the treatment carries it."}
                              </p>
                              <div className="mv-scene-meta">
                                <span>
                                  <b>TREATMENT</b> {treatmentLabel(scene.treatment)}
                                </span>
                                <span>
                                  <b>LOOK</b> {PALETTES[scene.palette].label} ·{" "}
                                  {Math.round(plan.intensity * 100)}%
                                </span>
                              </div>
                            </div>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <p className="mv-note">{running ? "Cutting the scenes…" : "No plan yet."}</p>
                    )}
                  </section>

                  {/* --------------------------- final video ------------------- */}
                  <section id="mv-sec-final" className="mv-card">
                    <div className="mv-card-head">
                      <div>
                        <p className="mv-card-kicker">FINAL VIDEO</p>
                        <h3>Your finished music video, ready to watch and download.</h3>
                      </div>
                      <span
                        className={`mv-badge ${resultUrl ? "is-ready" : rendering ? "is-rec" : ""}`}
                      >
                        {resultUrl ? "READY" : rendering ? "RENDERING" : plan ? "WAITING" : "—"}
                      </span>
                    </div>

                    {resultUrl ? (
                      <div className="mv-final">
                        <div className="mv-final-player">
                          <video
                            src={resultUrl}
                            controls
                            playsInline
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
                        <div className="mv-post">
                          <p className="mv-label">
                            POST <span>/</span> PRODUCTION
                          </p>
                          <strong>Finished music video</strong>
                          <p className="mv-note">
                            {formatClock(trimLength)} · {aspect} · {resultName ?? "webm"}
                          </p>
                          <a href={resultUrl} download={resultName ?? "omniai-mv.webm"} className="mv-key is-primary">
                            ⤓ Download WebM
                          </a>
                          <button
                            type="button"
                            className="mv-key"
                            onClick={() => setTab("studio")}
                          >
                            Open in Studio
                          </button>
                          <button
                            type="button"
                            className="mv-key"
                            onClick={() => {
                              setTab("timeline");
                              adjustRef.current?.focus();
                            }}
                          >
                            Talk to the director
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="mv-final is-waiting">
                        <p className="mv-note">
                          {running
                            ? "The plan is still building — rendering unlocks when the director is done."
                            : plan
                              ? "Render records the canvas with the clip's own audio, scene cuts included."
                              : "No plan yet."}
                        </p>
                        <button
                          type="button"
                          className="mv-key is-primary"
                          onClick={() => void renderFilm()}
                          disabled={!planReady || !selectedUrl || rendering}
                        >
                          Render &amp; download
                        </button>
                      </div>
                    )}
                  </section>
                </div>
              ) : (
                /* ------------------------------- STUDIO ------------------------- */
                <div className="mv-doc mv-studio">
                  <div className="mv-transport">
                    <button
                      type="button"
                      className="mv-key"
                      onClick={() => void togglePlay()}
                      disabled={!selectedUrl || !peaks}
                    >
                      {playing ? "❚❚ Pause" : "▶ Play"}
                    </button>
                    <span className="mv-clock">
                      {formatClock(Math.max(0, relNow))} / {formatClock(trimLength)}
                    </span>
                    {rendering ? (
                      <button type="button" className="mv-key is-danger" onClick={stopRecording}>
                        ■ Stop render
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="mv-key is-primary"
                        onClick={() => void renderFilm()}
                        disabled={!planReady || !selectedUrl}
                      >
                        {resultUrl ? "Re-render" : "Render & download"}
                      </button>
                    )}
                    {resultUrl && (
                      <a href={resultUrl} download={resultName ?? "omniai-mv.webm"} className="mv-key">
                        ⤓ Download
                      </a>
                    )}
                  </div>

                  {rendering && (
                    <p className="mv-live">
                      <span className="dms-heartbeat" aria-hidden="true" /> Recording at {FPS} fps —
                      keep this tab visible until it finishes.{" "}
                      {Math.round((relNow / Math.max(0.1, trimLength)) * 100)}%
                    </p>
                  )}

                  <div
                    className="mv-screen"
                    style={{ aspectRatio: `${aspectMeta.w} / ${aspectMeta.h}` }}
                  >
                    <canvas
                      ref={canvasRef}
                      width={aspectMeta.w}
                      height={aspectMeta.h}
                      aria-label="Music video preview"
                    />
                    {activeScene && (
                      <span className="mv-screen-scene">
                        #{activeIdx + 1} · {activeScene.title}
                      </span>
                    )}
                  </div>

                  <div className="mv-lanes">
                    <div className="mv-lane">
                      <span className="mv-lane-tag">SCENES</span>
                      <div className="mv-lane-track">
                        {plan?.scenes.map((scene, index) => (
                          <button
                            key={`clip-${index}`}
                            type="button"
                            className={`mv-clip ${index === activeIdx ? "is-now" : ""}`}
                            style={{
                              left: `${(scene.start / Math.max(0.1, trimLength)) * 100}%`,
                              width: `${((scene.end - scene.start) / Math.max(0.1, trimLength)) * 100}%`,
                              background: hexA(PALETTES[scene.palette].a, index === activeIdx ? 0.42 : 0.22),
                              borderColor: PALETTES[scene.palette].a,
                            }}
                            onClick={() => {
                              const el = audioRef.current;
                              if (!el || !selectedUrl) return;
                              if (!el.src || el.src !== selectedUrl) el.src = selectedUrl;
                              el.currentTime = trimStart + scene.start + 0.02;
                            }}
                            title={`Jump to ${scene.title}`}
                          >
                            {scene.title}
                          </button>
                        ))}
                        <span
                          className="mv-playhead"
                          style={{ left: `${(relNow / Math.max(0.1, trimLength)) * 100}%` }}
                        />
                      </div>
                    </div>
                    <div className="mv-lane">
                      <span className="mv-lane-tag">AUDIO</span>
                      <div className="mv-lane-track">
                        <canvas ref={laneCanvasRef} className="mv-lane-canvas" aria-hidden="true" />
                        <span
                          className="mv-playhead"
                          style={{ left: `${(relNow / Math.max(0.1, trimLength)) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {!plan && (
                    <p className="mv-note">No plan yet — go back and press Create to brief the director.</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      <style jsx global>{`        /* ================================================================
           Music Video Studio — staged build skin (global scoped by .mvstudio
           prefix). Every panel keeps its CSS material as the fallback and
           mounts a DisplaySurface WebGL face above it.
           ================================================================ */

        .mvstudio {
          display: flex;
          flex-direction: column;
          gap: 22px;
          color: #cfc7e8;
          padding-bottom: 40px;
        }

        .mvstudio .omni-display {
          position: absolute;
          inset: 0;
          z-index: 0;
          display: block;
          width: 100%;
          height: 100%;
          border-radius: inherit;
          pointer-events: none;
        }

        /* Content rides above the WebGL face. */
        .mv-stage > :not(.omni-display),
        .mv-agent > :not(.omni-display),
        .mv-doc-wrap > :not(.omni-display):not(.mv-anchors) {
          position: relative;
          z-index: 1;
        }

        /* ------------------------------ header --------------------------- */

        .mv-head {
          display: flex;
          flex-direction: column;
          gap: 7px;
        }

        .mv-eyebrow {
          margin: 0;
          font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.24em;
          text-transform: uppercase;
          color: #a78bfa;
        }

        .mv-head h1 {
          margin: 0;
          font-size: clamp(1.5rem, 3vw, 2.1rem);
          font-weight: 800;
          letter-spacing: -0.03em;
          color: #f1eaff;
          text-shadow: 0 0 24px rgba(108, 99, 255, 0.35);
        }

        .mv-sub {
          margin: 0;
          max-width: 74ch;
          font-size: 13px;
          line-height: 1.6;
          color: rgba(203, 195, 222, 0.78);
        }

        .mv-alert {
          margin: 0;
          padding: 10px 13px;
          border: 1px solid rgba(255, 92, 122, 0.45);
          border-radius: 12px;
          background: rgba(255, 92, 122, 0.09);
          color: #ffc4d0;
          font-size: 12.5px;
        }

        .mv-hidden {
          display: none;
        }

        /* ----------------------------- stage rail ------------------------- */

        .mv-rail {
          display: flex;
          flex-wrap: wrap;
          align-items: stretch;
          gap: 10px;
        }

        .mv-rail-key {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          padding: 9px 14px 9px 10px;
          border: 1px solid rgba(167, 139, 250, 0.2);
          border-radius: 13px;
          background: linear-gradient(160deg, rgba(23, 18, 34, 0.96), rgba(10, 9, 16, 0.98));
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.07),
            0 3px 0 -1px rgba(0, 0, 0, 0.8),
            0 10px 16px rgba(0, 0, 0, 0.35);
          color: #b9b0d6;
          cursor: pointer;
          transition:
            transform 120ms ease,
            border-color 180ms ease,
            box-shadow 120ms ease;
        }

        .mv-rail-key:hover:not(:disabled) {
          border-color: rgba(167, 139, 250, 0.42);
          transform: translateY(1px);
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.07),
            0 2px 0 -1px rgba(0, 0, 0, 0.8),
            0 6px 10px rgba(0, 0, 0, 0.3);
        }

        .mv-rail-key:active:not(:disabled) {
          transform: translateY(4px);
          box-shadow:
            inset 0 2px 5px rgba(0, 0, 0, 0.6),
            0 0 0 0 rgba(0, 0, 0, 0);
        }

        .mv-rail-key:disabled {
          opacity: 0.42;
          cursor: not-allowed;
        }

        .mv-rail-key.is-now {
          border-color: rgba(167, 139, 250, 0.65);
          color: #f1eaff;
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.1),
            0 0 22px rgba(108, 99, 255, 0.3),
            0 3px 0 -1px rgba(0, 0, 0, 0.8);
        }

        .mv-rail-key.is-done {
          border-color: rgba(110, 231, 183, 0.4);
        }

        .mv-rail-n {
          display: grid;
          place-items: center;
          width: 26px;
          height: 26px;
          border: 1px solid rgba(0, 0, 0, 0.66);
          border-radius: 8px;
          background: linear-gradient(160deg, rgba(84, 60, 136, 0.9), rgba(24, 18, 42, 0.96));
          font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
          font-size: 11px;
          font-weight: 800;
          color: #d9d1ff;
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.2),
            inset 0 -3px 5px rgba(0, 0, 0, 0.55);
        }

        .is-done .mv-rail-n {
          background: linear-gradient(160deg, rgba(34, 106, 82, 0.9), rgba(14, 34, 27, 0.96));
          color: #7dffc8;
        }

        .mv-rail-copy {
          display: flex;
          flex-direction: column;
          line-height: 1.15;
          text-align: left;
        }

        .mv-rail-copy strong {
          font-size: 12px;
          letter-spacing: 0.06em;
        }

        .mv-rail-copy small {
          font-size: 9.5px;
          color: #8d84a8;
        }

        .mv-rail-note {
          margin-left: auto;
          align-self: center;
          font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
          font-size: 9.5px;
          letter-spacing: 0.14em;
          color: #8d84a8;
          text-transform: uppercase;
        }

        /* ------------------------------ stages ---------------------------- */

        .mv-stage {
          position: relative;
          isolation: isolate;
          display: flex;
          flex-direction: column;
          gap: 16px;
          overflow: hidden;
          padding: 20px;
          border: 1px solid rgba(167, 139, 250, 0.19);
          border-radius: 18px;
          background: linear-gradient(150deg, rgba(23, 18, 34, 0.97), rgba(10, 9, 16, 0.98) 72%);
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.1),
            0 1px 0 rgba(0, 0, 0, 0.85),
            0 2px 0 rgba(255, 255, 255, 0.04),
            0 16px 34px rgba(0, 0, 0, 0.42);
        }

        .mv-stage-head {
          display: flex;
          flex-direction: column;
          gap: 5px;
          padding-bottom: 12px;
          border-bottom: 1px solid rgba(0, 0, 0, 0.6);
          box-shadow: 0 1px 0 rgba(255, 255, 255, 0.05);
        }

        .mv-label {
          margin: 0;
          font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
          font-size: 9.5px;
          font-weight: 700;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: #958ba9;
        }

        .mv-label span {
          color: #5b5376;
        }

        .mv-label em {
          margin-left: 8px;
          font-style: normal;
          color: #7dffc8;
        }

        .mv-stage-head h2 {
          margin: 0;
          font-size: clamp(1.15rem, 2vw, 1.5rem);
          font-weight: 800;
          letter-spacing: -0.02em;
          color: #f1eaff;
        }

        .mv-stage-sub {
          margin: 0;
          max-width: 72ch;
          font-size: 12.5px;
          line-height: 1.55;
          color: rgba(203, 195, 222, 0.72);
        }

        .mv-note {
          margin: 0;
          font-size: 11px;
          line-height: 1.5;
          color: #8d84a8;
        }

        .mv-empty {
          margin: 0;
          padding: 14px;
          border: 1px dashed rgba(167, 139, 250, 0.28);
          border-radius: 12px;
          font-size: 12.5px;
          color: #b9b0d6;
        }

        .mv-empty.is-warn {
          border-color: rgba(255, 184, 77, 0.4);
          color: #ffd9a0;
        }

        .mv-empty-box {
          padding: 20px;
          border: 1px dashed rgba(167, 139, 250, 0.3);
          border-radius: 13px;
          background: rgba(6, 5, 12, 0.5);
          text-align: center;
        }

        .mv-empty-box p {
          margin: 0 0 6px;
          font-size: 12.5px;
          color: #b9b0d6;
        }

        .mv-link {
          color: #a78bfa;
          text-decoration: underline;
          text-underline-offset: 3px;
        }

        /* ------------------------------ tabs / tracks ---------------------- */

        .mv-tabs {
          display: flex;
          gap: 8px;
        }

        .mv-tab {
          padding: 7px 16px;
          border: 1px solid rgba(167, 139, 250, 0.2);
          border-radius: 10px;
          background: rgba(8, 6, 15, 0.72);
          font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
          font-size: 10.5px;
          font-weight: 700;
          letter-spacing: 0.16em;
          color: #8d84a8;
          cursor: pointer;
          transition:
            transform 120ms ease,
            box-shadow 120ms ease,
            color 160ms ease,
            border-color 160ms ease;
        }

        .mv-tab:hover {
          transform: translateY(1px);
          color: #cfc7e8;
        }

        .mv-tab:active {
          transform: translateY(4px);
        }

        .mv-tab.is-on {
          border-color: rgba(167, 139, 250, 0.65);
          background: rgba(56, 36, 104, 0.45);
          color: #f1eaff;
          box-shadow: 0 0 16px rgba(108, 99, 255, 0.28);
        }

        .mv-track-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
          gap: 10px;
        }

        .mv-track {
          display: flex;
          align-items: center;
          gap: 11px;
          padding: 10px 12px;
          border: 1px solid rgba(167, 139, 250, 0.16);
          border-radius: 13px;
          background: linear-gradient(160deg, rgba(16, 12, 26, 0.92), rgba(8, 7, 14, 0.96));
          color: #cfc7e8;
          text-align: left;
          cursor: pointer;
          transition:
            transform 120ms ease,
            border-color 160ms ease,
            box-shadow 120ms ease;
        }

        .mv-track:hover {
          border-color: rgba(167, 139, 250, 0.45);
          transform: translateY(1px);
          box-shadow: 0 6px 12px rgba(0, 0, 0, 0.32);
        }

        .mv-track:active {
          transform: translateY(4px);
          box-shadow: none;
        }

        .mv-track.is-on {
          border-color: rgba(0, 242, 254, 0.6);
          background: linear-gradient(160deg, rgba(18, 34, 44, 0.9), rgba(8, 10, 16, 0.96));
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.08),
            0 0 18px rgba(0, 242, 254, 0.16);
        }

        .mv-track-art {
          display: grid;
          place-items: center;
          width: 34px;
          height: 34px;
          flex-shrink: 0;
          border: 1px solid rgba(0, 0, 0, 0.66);
          border-radius: 10px;
          background: linear-gradient(160deg, rgba(84, 60, 136, 0.9), rgba(24, 18, 42, 0.96));
          color: #d9d1ff;
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.2),
            inset 0 -3px 5px rgba(0, 0, 0, 0.55);
        }

        .mv-track-copy {
          display: flex;
          flex-direction: column;
          min-width: 0;
        }

        .mv-track-copy strong {
          overflow: hidden;
          font-size: 12.5px;
          color: #f1eaff;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .mv-track-copy small {
          font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
          font-size: 9px;
          letter-spacing: 0.14em;
          color: #8d84a8;
          text-transform: uppercase;
        }

        .mv-track-pick {
          margin-left: auto;
          font-size: 13px;
          color: #6c63ff;
        }

        .mv-track.is-on .mv-track-pick {
          color: #7dffc8;
        }

        /* ------------------------------- upload ---------------------------- */

        .mv-upload {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .mv-upload-key {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 16px;
          border: 1px dashed rgba(167, 139, 250, 0.45);
          border-radius: 13px;
          background: rgba(6, 5, 12, 0.55);
          font-size: 12.5px;
          font-weight: 700;
          color: #cfc7e8;
          cursor: pointer;
          transition:
            transform 120ms ease,
            border-color 160ms ease,
            box-shadow 120ms ease;
        }

        .mv-upload-key:hover {
          border-color: rgba(167, 139, 250, 0.8);
          transform: translateY(1px);
          box-shadow: 0 0 22px rgba(108, 99, 255, 0.25);
        }

        .mv-upload-key:active {
          transform: translateY(4px);
        }

        /* -------------------------------- trim ----------------------------- */

        .mv-trim {
          display: flex;
          flex-direction: column;
          gap: 11px;
          padding: 14px;
          border: 1px solid rgba(167, 139, 250, 0.16);
          border-radius: 15px;
          background: rgba(6, 5, 12, 0.6);
        }

        .mv-trim-head {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 10px;
        }

        .mv-trim-title {
          overflow: hidden;
          max-width: 42ch;
          font-size: 12.5px;
          font-weight: 700;
          color: #f1eaff;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .mv-trim-times {
          margin-left: auto;
          font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
          font-size: 11px;
          color: #7dffc8;
        }

        .mv-wave {
          position: relative;
          height: 96px;
          overflow: hidden;
          border: 1px solid rgba(0, 0, 0, 0.68);
          border-radius: 12px;
          background: #0a0812;
          box-shadow: inset 0 3px 9px rgba(0, 0, 0, 0.85);
          cursor: crosshair;
          touch-action: none;
          user-select: none;
        }

        .mv-wave-canvas {
          position: absolute;
          inset: 0;
          display: block;
          width: 100%;
          height: 100%;
        }

        .mv-sel {
          position: absolute;
          top: 0;
          bottom: 0;
          border-right: 1px solid rgba(167, 139, 250, 0.75);
          border-left: 1px solid rgba(167, 139, 250, 0.75);
          background: rgba(108, 99, 255, 0.13);
          cursor: grab;
        }

        .mv-sel:active {
          cursor: grabbing;
        }

        .mv-sel-handle {
          position: absolute;
          top: 0;
          bottom: 0;
          width: 14px;
          background: linear-gradient(180deg, rgba(167, 139, 250, 0.9), rgba(108, 99, 255, 0.75));
          box-shadow: 0 0 12px rgba(108, 99, 255, 0.6);
          cursor: ew-resize;
        }

        .mv-sel-handle::after {
          content: "";
          position: absolute;
          top: 50%;
          left: 50%;
          width: 4px;
          height: 18px;
          border-radius: 2px;
          background: rgba(10, 8, 18, 0.8);
          transform: translate(-50%, -50%);
        }

        .mv-sel-handle.is-start {
          left: -8px;
        }

        .mv-sel-handle.is-end {
          right: -8px;
        }

        .mv-trim-row {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 12px;
        }

        .mv-presets {
          display: flex;
          gap: 6px;
        }

        .mv-preset {
          padding: 5px 11px;
          border: 1px solid rgba(167, 139, 250, 0.24);
          border-radius: 9px;
          background: rgba(8, 6, 15, 0.8);
          font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
          font-size: 10.5px;
          font-weight: 700;
          color: #b9b0d6;
          cursor: pointer;
          transition:
            transform 120ms ease,
            box-shadow 120ms ease,
            border-color 160ms ease;
        }

        .mv-preset:hover:not(:disabled) {
          border-color: rgba(167, 139, 250, 0.6);
          transform: translateY(1px);
        }

        .mv-preset:active:not(:disabled) {
          transform: translateY(4px);
          box-shadow: inset 0 2px 5px rgba(0, 0, 0, 0.6);
        }

        .mv-preset:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        /* --------------------------- pressable keys ------------------------ */

        .mv-key {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          padding: 9px 15px;
          border: 1px solid rgba(167, 139, 250, 0.3);
          border-radius: 11px;
          background: linear-gradient(160deg, rgba(28, 21, 44, 0.96), rgba(12, 10, 20, 0.98));
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.1),
            0 3px 0 -1px rgba(0, 0, 0, 0.8),
            0 9px 14px rgba(0, 0, 0, 0.35);
          font-size: 12px;
          font-weight: 700;
          color: #d9d1ff;
          text-decoration: none;
          cursor: pointer;
          transition:
            transform 120ms ease,
            box-shadow 120ms ease,
            border-color 160ms ease;
        }

        .mv-key:hover:not(:disabled) {
          border-color: rgba(167, 139, 250, 0.62);
          transform: translateY(1px);
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.1),
            0 2px 0 -1px rgba(0, 0, 0, 0.8),
            0 6px 9px rgba(0, 0, 0, 0.3);
        }

        .mv-key:active:not(:disabled) {
          transform: translateY(4px);
          box-shadow:
            inset 0 2px 6px rgba(0, 0, 0, 0.65),
            0 0 0 0 rgba(0, 0, 0, 0);
        }

        .mv-key:disabled {
          opacity: 0.42;
          cursor: not-allowed;
        }

        .mv-key.is-primary {
          border-color: rgba(124, 58, 237, 0.75);
          background: linear-gradient(160deg, #6c4dd8, #4a2fae);
          color: #ffffff;
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.22),
            0 3px 0 -1px rgba(0, 0, 0, 0.85),
            0 10px 18px rgba(74, 47, 174, 0.4);
        }

        .mv-key.is-primary:hover:not(:disabled) {
          border-color: rgba(167, 139, 250, 0.95);
          background: linear-gradient(160deg, #7b5ce6, #5536bd);
        }

        .mv-key.is-danger {
          border-color: rgba(255, 92, 122, 0.7);
          color: #ffc4d0;
        }

        .mv-stage-foot {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 14px;
          padding-top: 14px;
          border-top: 1px solid rgba(0, 0, 0, 0.6);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
        }

        .mv-stage-foot .mv-note {
          flex: 1;
          min-width: 200px;
        }

        /* ------------------------------ concept ---------------------------- */

        .mv-chip-track {
          display: inline-flex;
          align-items: center;
          gap: 9px;
          align-self: flex-start;
          padding: 7px 9px 7px 7px;
          border: 1px solid rgba(0, 242, 254, 0.4);
          border-radius: 999px;
          background: rgba(8, 14, 20, 0.9);
        }

        .mv-chip-art {
          display: grid;
          place-items: center;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: linear-gradient(160deg, #6c63ff, #00f2fe);
          color: #07060d;
          font-size: 12px;
        }

        .mv-chip-track strong {
          max-width: 38ch;
          overflow: hidden;
          font-size: 12px;
          color: #f1eaff;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .mv-chip-track small {
          font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
          font-size: 10.5px;
          color: #7dffc8;
        }

        .mv-chip-x {
          display: grid;
          place-items: center;
          width: 20px;
          height: 20px;
          border: 1px solid rgba(255, 255, 255, 0.14);
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.05);
          color: #958ba9;
          font-size: 10px;
          cursor: pointer;
          transition: transform 120ms ease;
        }

        .mv-chip-x:hover {
          color: #ffc4d0;
          transform: translateY(1px);
        }

        .mv-chip-x:active {
          transform: translateY(3px);
        }

        .mv-brief {
          display: flex;
          flex-direction: column;
          gap: 14px;
          padding: 14px;
          border: 1px solid rgba(167, 139, 250, 0.18);
          border-radius: 15px;
          background: rgba(5, 4, 10, 0.72);
          box-shadow: inset 0 3px 10px rgba(0, 0, 0, 0.7);
        }

        .mv-vibe {
          width: 100%;
          min-height: 92px;
          resize: vertical;
          padding: 11px 13px;
          border: 1px solid rgba(0, 0, 0, 0.7);
          border-radius: 11px;
          background: #0a0812;
          box-shadow: inset 0 3px 8px rgba(0, 0, 0, 0.85);
          font-size: 13px;
          line-height: 1.55;
          color: #f1eaff;
          outline: none;
          transition: border-color 160ms ease;
        }

        .mv-vibe::placeholder {
          color: #6c6488;
        }

        .mv-vibe:focus {
          border-color: rgba(167, 139, 250, 0.6);
          box-shadow:
            inset 0 3px 8px rgba(0, 0, 0, 0.85),
            0 0 16px rgba(108, 99, 255, 0.25);
        }

        .mv-settings {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
          gap: 13px;
        }

        .mv-setting {
          display: flex;
          flex-direction: column;
          gap: 7px;
        }

        .mv-setting.is-wide {
          grid-column: 1 / -1;
        }

        .mv-setting-label {
          font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
          font-size: 9.5px;
          font-weight: 700;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: #958ba9;
        }

        .mv-setting-label b {
          color: #7dffc8;
        }

        .mv-seg {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .mv-seg button {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 11px;
          border: 1px solid rgba(167, 139, 250, 0.22);
          border-radius: 9px;
          background: rgba(8, 6, 15, 0.85);
          font-size: 11px;
          font-weight: 700;
          color: #8d84a8;
          cursor: pointer;
          transition:
            transform 120ms ease,
            border-color 160ms ease,
            color 160ms ease,
            box-shadow 160ms ease;
        }

        .mv-seg button:hover {
          border-color: rgba(167, 139, 250, 0.55);
          color: #cfc7e8;
          transform: translateY(1px);
        }

        .mv-seg button:active {
          transform: translateY(3px);
        }

        .mv-seg button.is-on {
          border-color: rgba(167, 139, 250, 0.8);
          background: rgba(56, 36, 104, 0.5);
          color: #f1eaff;
          box-shadow: 0 0 14px rgba(108, 99, 255, 0.3);
        }

        .mv-dot {
          width: 9px;
          height: 9px;
          border: 1px solid rgba(0, 0, 0, 0.6);
          border-radius: 50%;
        }

        .mv-readout {
          align-self: flex-start;
          padding: 6px 12px;
          border: 1px solid rgba(0, 0, 0, 0.7);
          border-radius: 9px;
          background: #0a0812;
          box-shadow: inset 0 3px 7px rgba(0, 0, 0, 0.85);
          font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
          font-size: 13px;
          color: #7dffc8;
        }

        .mv-setting input[type="range"] {
          width: 100%;
          accent-color: #a78bfa;
        }

        .mv-kinds {
          display: flex;
          flex-direction: column;
          gap: 9px;
          padding-top: 4px;
        }

        .mv-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .mv-chip {
          padding: 8px 14px;
          border: 1px solid rgba(167, 139, 250, 0.22);
          border-radius: 999px;
          background: rgba(8, 6, 15, 0.85);
          font-size: 12px;
          font-weight: 700;
          color: #8d84a8;
          cursor: pointer;
          transition:
            transform 120ms ease,
            border-color 160ms ease,
            color 160ms ease,
            box-shadow 160ms ease;
        }

        .mv-chip:hover {
          border-color: rgba(167, 139, 250, 0.55);
          color: #cfc7e8;
          transform: translateY(1px);
        }

        .mv-chip:active {
          transform: translateY(4px);
        }

        .mv-chip.is-on {
          border-color: rgba(0, 242, 254, 0.7);
          background: rgba(10, 40, 48, 0.6);
          color: #aef6ff;
          box-shadow: 0 0 16px rgba(0, 242, 254, 0.25);
        }

        .mv-engine {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
          font-size: 9.5px;
          font-weight: 700;
          letter-spacing: 0.14em;
          color: #958ba9;
        }

        .mv-engine i {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #8d84a8;
          box-shadow: 0 0 8px currentColor;
        }

        .mv-engine.is-ok {
          color: #7dffc8;
        }

        .mv-engine.is-ok i {
          background: #7dffc8;
        }

        .mv-engine.is-warn {
          color: #ffb84d;
        }

        .mv-engine.is-warn i {
          background: #ffb84d;
        }

        /* ------------------------------ workspace --------------------------- */

        .mv-work {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .mv-work-bar {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 12px;
        }

        .mv-work-tabs {
          display: flex;
          gap: 4px;
          margin: 0 auto;
          padding: 4px;
          border: 1px solid rgba(167, 139, 250, 0.24);
          border-radius: 12px;
          background: rgba(7, 6, 13, 0.9);
          box-shadow: inset 0 2px 7px rgba(0, 0, 0, 0.7);
        }

        .mv-work-tabs button {
          padding: 7px 18px;
          border: 1px solid transparent;
          border-radius: 9px;
          background: transparent;
          font-size: 12px;
          font-weight: 700;
          color: #8d84a8;
          cursor: pointer;
          transition:
            transform 120ms ease,
            background 160ms ease,
            color 160ms ease,
            box-shadow 160ms ease;
        }

        .mv-work-tabs button:hover {
          color: #cfc7e8;
          transform: translateY(1px);
        }

        .mv-work-tabs button:active {
          transform: translateY(3px);
        }

        .mv-work-tabs button.is-on {
          background: linear-gradient(160deg, #6c4dd8, #4a2fae);
          color: #fff;
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.25),
            0 4px 10px rgba(74, 47, 174, 0.5);
        }

        .mv-work-clip {
          font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
          font-size: 9.5px;
          letter-spacing: 0.12em;
          color: #8d84a8;
          text-transform: uppercase;
        }

        .mv-work-grid {
          display: grid;
          grid-template-columns: minmax(300px, 352px) minmax(0, 1fr);
          gap: 16px;
          align-items: start;
        }

        /* ------------------------------- agent ------------------------------ */

        .mv-agent {
          position: sticky;
          top: 14px;
          isolation: isolate;
          display: flex;
          flex-direction: column;
          gap: 13px;
          overflow: hidden;
          max-height: calc(100vh - 28px);
          padding: 16px;
          border: 1px solid rgba(167, 139, 250, 0.19);
          border-radius: 18px;
          background: linear-gradient(150deg, rgba(23, 18, 34, 0.97), rgba(10, 9, 16, 0.98) 72%);
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.1),
            0 16px 34px rgba(0, 0, 0, 0.45);
        }

        .mv-agent-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding-bottom: 10px;
          border-bottom: 1px solid rgba(0, 0, 0, 0.6);
          box-shadow: 0 1px 0 rgba(255, 255, 255, 0.05);
        }

        .mv-agent-src {
          padding: 4px 9px;
          border: 1px solid rgba(167, 139, 250, 0.3);
          border-radius: 999px;
          font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
          font-size: 8.5px;
          font-weight: 800;
          letter-spacing: 0.14em;
          color: #8d84a8;
        }

        .mv-agent-src.is-ai {
          border-color: rgba(167, 139, 250, 0.75);
          color: #c4b5fd;
          box-shadow: 0 0 12px rgba(167, 139, 250, 0.3);
        }

        .mv-agent-src.is-house {
          border-color: rgba(255, 184, 77, 0.6);
          color: #ffd9a0;
        }

        .mv-steps {
          display: flex;
          flex-direction: column;
          gap: 7px;
        }

        .mv-step {
          display: grid;
          grid-template-columns: 18px minmax(0, 1fr) auto;
          gap: 9px;
          align-items: start;
          padding: 9px 10px;
          border: 1px solid rgba(167, 139, 250, 0.13);
          border-radius: 11px;
          background: rgba(7, 6, 13, 0.72);
          transition: border-color 200ms ease;
        }

        .mv-step.is-running {
          border-color: rgba(167, 139, 250, 0.6);
          background: rgba(35, 22, 66, 0.5);
          box-shadow: 0 0 16px rgba(108, 99, 255, 0.22);
        }

        .mv-step.is-done {
          border-color: rgba(110, 231, 183, 0.3);
        }

        .mv-step-dot {
          display: grid;
          place-items: center;
          width: 18px;
          height: 18px;
          border: 1px solid rgba(167, 139, 250, 0.4);
          border-radius: 50%;
          font-size: 10px;
          color: #8d84a8;
        }

        .mv-step.is-done .mv-step-dot {
          border-color: rgba(110, 231, 183, 0.6);
          background: rgba(110, 231, 183, 0.12);
          color: #7dffc8;
        }

        .mv-step.is-running .mv-step-dot {
          color: #c4b5fd;
          animation: mv-spin 1.6s linear infinite;
        }

        .mv-step-copy {
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-width: 0;
        }

        .mv-step-copy strong {
          font-size: 11.5px;
          color: #f1eaff;
        }

        .mv-step-copy small {
          font-size: 10px;
          color: #8d84a8;
        }

        .mv-step-bar {
          display: block;
          height: 4px;
          margin-top: 5px;
          overflow: hidden;
          border-radius: 2px;
          background: #141024;
          box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.8);
        }

        .mv-step-bar i {
          display: block;
          height: 100%;
          border-radius: 2px;
          background: linear-gradient(90deg, #6c63ff, #00f2fe);
          box-shadow: 0 0 8px rgba(108, 99, 255, 0.7);
          transition: width 300ms ease;
        }

        .mv-step.is-done .mv-step-bar i {
          background: linear-gradient(90deg, #3ecf9a, #7dffc8);
        }

        .mv-step-state {
          font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
          font-size: 9px;
          letter-spacing: 0.08em;
          color: #8d84a8;
          text-transform: uppercase;
        }

        .mv-step.is-done .mv-step-state {
          color: #7dffc8;
        }

        .mv-log {
          flex: 1;
          min-height: 120px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding: 10px;
          border: 1px solid rgba(0, 0, 0, 0.62);
          border-radius: 12px;
          background: rgba(5, 4, 10, 0.8);
          box-shadow: inset 0 3px 9px rgba(0, 0, 0, 0.75);
        }

        .mv-line {
          margin: 0;
          font-size: 11.5px;
          line-height: 1.55;
          color: #b9b0d6;
        }

        .mv-line b {
          font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
          font-size: 9px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
        }

        .mv-line.is-agent b {
          color: #a78bfa;
        }

        .mv-line.is-user b {
          color: #7dffc8;
        }

        .mv-line.is-live {
          display: flex;
          align-items: center;
          gap: 7px;
          color: #7dffc8;
        }

        .mv-line.is-live i {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #7dffc8;
          animation: mv-pulse 1.1s ease-in-out infinite;
        }

        .mv-agent-input {
          display: flex;
          gap: 8px;
        }

        .mv-agent-input input {
          flex: 1;
          min-width: 0;
          padding: 9px 12px;
          border: 1px solid rgba(0, 0, 0, 0.7);
          border-radius: 10px;
          background: #0a0812;
          box-shadow: inset 0 3px 7px rgba(0, 0, 0, 0.85);
          font-size: 12px;
          color: #f1eaff;
          outline: none;
        }

        .mv-agent-input input::placeholder {
          color: #6c6488;
        }

        .mv-agent-input input:focus {
          border-color: rgba(167, 139, 250, 0.6);
        }

        .mv-agent-input input:disabled {
          opacity: 0.5;
        }

        /* ------------------------------ document ---------------------------- */

        .mv-doc-wrap {
          position: relative;
          isolation: isolate;
          overflow: hidden;
          min-width: 0;
          border: 1px solid rgba(167, 139, 250, 0.19);
          border-radius: 18px;
          background: linear-gradient(150deg, rgba(20, 16, 31, 0.97), rgba(9, 8, 15, 0.98) 72%);
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.1),
            0 16px 34px rgba(0, 0, 0, 0.45);
        }

        .mv-anchors {
          position: absolute;
          top: 14px;
          right: 10px;
          z-index: 2;
          display: flex;
          flex-direction: column;
          gap: 7px;
        }

        .mv-anchors button {
          display: grid;
          place-items: center;
          width: 30px;
          height: 30px;
          border: 1px solid rgba(167, 139, 250, 0.26);
          border-radius: 9px;
          background: rgba(8, 6, 15, 0.9);
          color: #958ba9;
          font-size: 13px;
          cursor: pointer;
          transition:
            transform 120ms ease,
            color 160ms ease,
            border-color 160ms ease,
            box-shadow 160ms ease;
        }

        .mv-anchors button:hover {
          color: #f1eaff;
          border-color: rgba(167, 139, 250, 0.7);
          transform: translateY(1px);
          box-shadow: 0 0 14px rgba(108, 99, 255, 0.35);
        }

        .mv-anchors button:active {
          transform: translateY(4px);
          box-shadow: none;
        }

        .mv-doc {
          display: flex;
          flex-direction: column;
          gap: 16px;
          padding: 17px;
          padding-right: 56px;
        }

        .mv-card {
          display: flex;
          flex-direction: column;
          gap: 12px;
          padding: 15px;
          border: 1px solid rgba(167, 139, 250, 0.15);
          border-radius: 14px;
          background: rgba(8, 7, 15, 0.78);
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.05),
            0 10px 20px rgba(0, 0, 0, 0.3);
        }

        .mv-card-kicker {
          margin: 0;
          font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 0.22em;
          color: #7d74a0;
        }

        .mv-card-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
        }

        .mv-card-head h3 {
          margin: 3px 0 0;
          font-size: 14px;
          font-weight: 800;
          letter-spacing: -0.01em;
          color: #f1eaff;
        }

        .mv-badge {
          padding: 4px 10px;
          border: 1px solid rgba(167, 139, 250, 0.3);
          border-radius: 999px;
          font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
          font-size: 8.5px;
          font-weight: 800;
          letter-spacing: 0.14em;
          color: #958ba9;
          white-space: nowrap;
        }

        .mv-badge.is-ai {
          border-color: rgba(167, 139, 250, 0.75);
          color: #c4b5fd;
          box-shadow: 0 0 12px rgba(167, 139, 250, 0.3);
        }

        .mv-badge.is-house {
          border-color: rgba(255, 184, 77, 0.6);
          color: #ffd9a0;
        }

        .mv-badge.is-ready {
          border-color: rgba(110, 231, 183, 0.65);
          color: #7dffc8;
          box-shadow: 0 0 12px rgba(110, 231, 183, 0.3);
        }

        .mv-badge.is-rec {
          border-color: rgba(255, 92, 122, 0.7);
          color: #ffc4d0;
        }

        .mv-read-head {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .mv-read-art {
          display: grid;
          place-items: center;
          width: 44px;
          height: 44px;
          flex-shrink: 0;
          border: 1px solid rgba(0, 0, 0, 0.68);
          border-radius: 12px;
          background: linear-gradient(160deg, #6c63ff, #00f2fe);
          color: #07060d;
          font-size: 18px;
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.35),
            0 8px 16px rgba(0, 0, 0, 0.4);
        }

        .mv-read-copy {
          flex: 1;
          min-width: 0;
        }

        .mv-read-copy strong {
          display: block;
          overflow: hidden;
          font-size: 13.5px;
          color: #f1eaff;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .mv-read-copy p {
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
          margin: 5px 0 0;
        }

        .mv-read-copy p span {
          padding: 3px 8px;
          border: 1px solid rgba(167, 139, 250, 0.2);
          border-radius: 999px;
          font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
          font-size: 9px;
          letter-spacing: 0.08em;
          color: #958ba9;
        }

        .mv-read-copy p span.is-house {
          border-color: rgba(255, 184, 77, 0.55);
          color: #ffd9a0;
        }

        .mv-sub-label {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .mv-sub-label em {
          margin-left: auto;
        }

        .mv-structure {
          position: relative;
          height: 58px;
          overflow: hidden;
          border: 1px solid rgba(0, 0, 0, 0.66);
          border-radius: 11px;
          background: #0a0812;
          box-shadow: inset 0 3px 8px rgba(0, 0, 0, 0.8);
        }

        .mv-structure-canvas {
          position: absolute;
          inset: 0;
          display: block;
          width: 100%;
          height: 100%;
        }

        .mv-struct-scenes {
          position: absolute;
          inset: 6px 0;
        }

        .mv-struct-scenes span {
          position: absolute;
          top: 0;
          bottom: 0;
          overflow: hidden;
          padding: 4px 6px;
          border: 1px solid;
          border-radius: 5px;
          background: rgba(5, 4, 10, 0.62);
          font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
          font-size: 8.5px;
          letter-spacing: 0.06em;
          color: #cfc7e8;
          text-overflow: ellipsis;
          white-space: nowrap;
          transition: background 200ms ease;
        }

        .mv-struct-scenes span.is-now {
          background: rgba(108, 99, 255, 0.4);
          color: #fff;
        }

        .mv-grid2 {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 13px;
        }

        .mv-text {
          margin: 5px 0 0;
          font-size: 12.5px;
          line-height: 1.6;
          color: #b9b0d6;
        }

        .mv-swatches {
          display: flex;
          flex-wrap: wrap;
          gap: 9px;
        }

        .mv-swatch {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 5px 10px;
          border: 1px solid rgba(0, 0, 0, 0.6);
          border-radius: 999px;
          background: rgba(5, 4, 10, 0.85);
          font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
          font-size: 9.5px;
          color: #cfc7e8;
        }

        .mv-swatch i {
          width: 12px;
          height: 12px;
          border: 1px solid rgba(255, 255, 255, 0.22);
          border-radius: 50%;
        }

        .mv-style-foot {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding-top: 10px;
          border-top: 1px solid rgba(0, 0, 0, 0.55);
        }

        .mv-thumbs {
          display: flex;
          gap: 7px;
        }

        .mv-thumbs .mv-key {
          padding: 6px 10px;
          font-size: 13px;
        }

        /* ----------------------------- scene plan --------------------------- */

        .mv-scenes {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .mv-scene {
          display: grid;
          grid-template-columns: 168px minmax(0, 1fr);
          gap: 13px;
          padding: 12px;
          border: 1px solid rgba(167, 139, 250, 0.15);
          border-radius: 13px;
          background: rgba(6, 5, 12, 0.7);
          transition: border-color 200ms ease;
        }

        .mv-scene:hover {
          border-color: rgba(167, 139, 250, 0.4);
        }

        .mv-scene-frame {
          position: relative;
          overflow: hidden;
          aspect-ratio: 16 / 10;
          border: 1px solid rgba(0, 0, 0, 0.7);
          border-radius: 10px;
          background: #050409;
          box-shadow: inset 0 3px 9px rgba(0, 0, 0, 0.85);
        }

        .mv-scene-frame img {
          display: block;
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .mv-scene-pending {
          position: absolute;
          inset: 0;
          display: grid;
          place-items: center;
          font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
          font-size: 9px;
          letter-spacing: 0.1em;
          color: #6c6488;
          text-transform: uppercase;
          text-align: center;
          padding: 6px;
        }

        .mv-scene-no {
          position: absolute;
          top: 6px;
          left: 6px;
          padding: 2px 7px;
          border: 1px solid rgba(255, 255, 255, 0.14);
          border-radius: 999px;
          background: rgba(4, 3, 9, 0.8);
          font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
          font-size: 8.5px;
          color: #cfc7e8;
        }

        .mv-scene-body {
          display: flex;
          flex-direction: column;
          gap: 4px;
          min-width: 0;
        }

        .mv-scene-top {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 10px;
        }

        .mv-scene-top strong {
          font-size: 13px;
          color: #f1eaff;
        }

        .mv-scene-time {
          font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
          font-size: 10px;
          color: #7dffc8;
        }

        .mv-scene-body .mv-text {
          margin-top: 2px;
          font-size: 12px;
        }

        .mv-scene-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 14px;
          margin-top: 6px;
          font-size: 10.5px;
          color: #8d84a8;
        }

        .mv-scene-meta b {
          font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
          font-size: 8.5px;
          letter-spacing: 0.14em;
          color: #6c6488;
        }

        /* ----------------------------- final video -------------------------- */

        .mv-final {
          display: grid;
          grid-template-columns: minmax(0, 1.6fr) minmax(220px, 1fr);
          gap: 14px;
        }

        .mv-final.is-waiting {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 12px;
          padding: 18px;
          border: 1px dashed rgba(167, 139, 250, 0.3);
          border-radius: 13px;
          background: rgba(5, 4, 10, 0.55);
        }

        .mv-final-player {
          overflow: hidden;
          border: 1px solid rgba(167, 139, 250, 0.3);
          border-radius: 13px;
          background: #000;
          box-shadow: 0 14px 28px rgba(0, 0, 0, 0.5);
        }

        .mv-final-player video {
          display: block;
          width: 100%;
        }

        .mv-post {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 9px;
          padding: 15px;
          border: 1px solid rgba(167, 139, 250, 0.18);
          border-radius: 13px;
          background: rgba(6, 5, 12, 0.8);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
        }

        .mv-post strong {
          font-size: 13.5px;
          color: #f1eaff;
        }

        /* ------------------------------- studio ----------------------------- */

        .mv-transport {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 10px;
        }

        .mv-clock {
          font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
          font-size: 12px;
          color: #7dffc8;
        }

        .mv-live {
          display: flex;
          align-items: center;
          gap: 8px;
          margin: 0;
          font-size: 11.5px;
          color: #7dffc8;
        }

        .mv-live .dms-heartbeat {
          display: inline-block;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #7dffc8;
          animation: mv-pulse 1.1s ease-in-out infinite;
        }

        .mv-screen {
          position: relative;
          overflow: hidden;
          border: 1px solid rgba(167, 139, 250, 0.3);
          border-radius: 14px;
          background: #050409;
          box-shadow:
            inset 0 0 44px rgba(0, 0, 0, 0.7),
            0 16px 32px rgba(0, 0, 0, 0.45);
        }

        .mv-screen canvas {
          display: block;
          width: 100%;
          height: 100%;
        }

        .mv-screen-scene {
          position: absolute;
          left: 12px;
          bottom: 10px;
          padding: 4px 10px;
          border: 1px solid rgba(255, 255, 255, 0.14);
          border-radius: 999px;
          background: rgba(4, 3, 9, 0.78);
          font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
          font-size: 9.5px;
          letter-spacing: 0.08em;
          color: #cfc7e8;
        }

        .mv-lanes {
          display: flex;
          flex-direction: column;
          gap: 9px;
        }

        .mv-lane {
          display: grid;
          grid-template-columns: 62px minmax(0, 1fr);
          gap: 10px;
          align-items: center;
        }

        .mv-lane-tag {
          font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
          font-size: 8.5px;
          font-weight: 800;
          letter-spacing: 0.16em;
          color: #7d74a0;
        }

        .mv-lane-track {
          position: relative;
          height: 46px;
          overflow: hidden;
          border: 1px solid rgba(0, 0, 0, 0.66);
          border-radius: 10px;
          background: #0a0812;
          box-shadow: inset 0 3px 8px rgba(0, 0, 0, 0.8);
        }

        .mv-lane-canvas {
          position: absolute;
          inset: 0;
          display: block;
          width: 100%;
          height: 100%;
        }

        .mv-clip {
          position: absolute;
          top: 6px;
          bottom: 6px;
          min-width: 12px;
          overflow: hidden;
          padding: 0 7px;
          border: 1px solid;
          border-radius: 6px;
          font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
          font-size: 8.5px;
          color: #efeaff;
          text-align: left;
          text-overflow: ellipsis;
          white-space: nowrap;
          cursor: pointer;
          transition:
            transform 120ms ease,
            filter 160ms ease;
        }

        .mv-clip:hover {
          transform: translateY(1px);
          filter: brightness(1.35);
        }

        .mv-clip:active {
          transform: translateY(3px);
        }

        .mv-clip.is-now {
          box-shadow: 0 0 12px rgba(167, 139, 250, 0.45);
          color: #fff;
        }

        .mv-playhead {
          position: absolute;
          top: 0;
          bottom: 0;
          z-index: 2;
          width: 2px;
          background: #7dffc8;
          box-shadow: 0 0 8px rgba(125, 255, 200, 0.8);
          transition: left 150ms linear;
        }

        /* ----------------------------- motion / responsive ------------------- */

        @keyframes mv-spin {
          to {
            transform: rotate(360deg);
          }
        }

        @keyframes mv-pulse {
          0%,
          100% {
            opacity: 0.35;
            transform: scale(0.85);
          }
          50% {
            opacity: 1;
            transform: scale(1.15);
          }
        }

        @media (max-width: 1080px) {
          .mv-work-grid {
            grid-template-columns: minmax(0, 1fr);
          }

          .mv-agent {
            /* Keep a positioned containing block, or the absolutely
               positioned WebGL face escapes the panel. */
            position: relative;
            top: auto;
            max-height: none;
          }

          .mv-log {
            max-height: 300px;
          }

          .mv-doc {
            padding-right: 17px;
          }

          .mv-anchors {
            display: none;
          }

          .mv-final {
            grid-template-columns: minmax(0, 1fr);
          }
        }

        @media (max-width: 720px) {
          .mv-rail-note {
            display: none;
          }

          .mv-scene {
            grid-template-columns: minmax(0, 1fr);
          }

          .mv-work-tabs {
            margin: 0;
          }

          .mv-lane {
            grid-template-columns: minmax(0, 1fr);
          }

          .mv-lane-tag {
            display: none;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .mvstudio *,
          .mvstudio *::before,
          .mvstudio *::after {
            transition: none !important;
            animation: none !important;
          }
        }`}</style>
    </div>
  );
}
