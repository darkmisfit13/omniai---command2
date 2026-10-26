"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { MediaAsset } from "@/lib/types";
import { PromptEnhancer } from "@/app/hud/PromptEnhancer";

const MEDIA_BUCKET = "media";
const SIGNED_URL_TTL = 3600;
const MAX_PROMPT_LENGTH = 2000;

type Attempt = {
  provider: string;
  label: string;
  ok: boolean;
  reason?: "missing_key" | "quota" | "error";
  message?: string;
};

type ProviderStatus = {
  id: string;
  label: string;
  free: boolean;
  supported: boolean;
  keyRequired: boolean;
  keyConfigured: boolean;
  ready: boolean;
};

/** Style seeds — the dark, aching half of the house palette sits up front. */
const STYLE_PRESETS = [
  "Dark Alternative",
  "Cinematic",
  "Lo-Fi",
  "Ambient",
  "Synthwave",
  "Trap Soul",
  "Grunge",
  "Dream Pop",
  "Orchestral",
  "Acoustic",
  "Drill",
  "Gospel Choir",
];

const LENGTHS = [
  { label: "30 sec", seconds: 30 },
  { label: "1 min", seconds: 60 },
  { label: "2 min", seconds: 120 },
  { label: "3 min", seconds: 180 },
];

const BAR_COUNT = 56;

/**
 * Deterministic bar heights from the asset id, so every track gets a stable
 * silhouette instead of a waveform that reshuffles on every render.
 */
function barsFor(seed: string): number[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const out: number[] = [];
  for (let i = 0; i < BAR_COUNT; i += 1) {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    const noise = ((h >>> 0) % 1000) / 1000;
    // Musical envelope: quiet at both ends, energy through the middle.
    const envelope = Math.sin((i / (BAR_COUNT - 1)) * Math.PI) ** 0.45;
    out.push(0.16 + (0.22 + noise * 0.78) * envelope);
  }
  return out;
}

function formatClock(seconds: number | null): string {
  if (!seconds || seconds < 0 || !Number.isFinite(seconds)) return "--:--";
  const whole = Math.round(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

function errorText(value: unknown, fallback: string): string {
  return value instanceof Error ? value.message : fallback;
}

function trackTitle(asset: MediaAsset): string {
  const first = (asset.prompt ?? "").split("\n").find((line) => line.trim());
  if (!first) return "Untitled track";
  return first.trim().slice(0, 90);
}

/** Provider labels carry long setup hints — pills want the short name. */
const SHORT_NAMES: Record<string, string> = {
  huggingface: "Hugging Face",
  pixazo: "Pixazo",
  elevenlabs: "ElevenLabs",
  pollinations_gen: "Pollinations",
  apiframe: "APIFrame",
  fal: "FAL",
  cloudflare: "Cloudflare",
  zsky: "ZSky",
};

function shortName(entry: { id?: string; provider?: string; label: string }): string {
  const key = entry.id ?? entry.provider ?? "";
  return SHORT_NAMES[key] ?? entry.label.split(" (")[0];
}

/**
 * Some providers answer with a raw JSON body. Keep the sentence a human wrote
 * and drop the blob, so the attempts list stays readable.
 */
function tidyMessage(message?: string): string | null {
  if (!message) return null;
  const cleaned = message.replace(/\s*\{[\s\S]*\}\s*$/, "").trim();
  if (!cleaned) return null;
  return cleaned.length > 175 ? `${cleaned.slice(0, 172)}…` : cleaned;
}

export default function MusicStudioPage() {
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const [description, setDescription] = useState("");
  const [styleText, setStyleText] = useState("");
  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);
  const [lyrics, setLyrics] = useState("");
  const [instrumental, setInstrumental] = useState(false);
  const [lengthIndex, setLengthIndex] = useState(1);

  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [providers, setProviders] = useState<ProviderStatus[]>([]);

  const [playingId, setPlayingId] = useState<string | null>(null);
  const [progress, setProgress] = useState<Record<string, number>>({});

  const playerRef = useRef<HTMLAudioElement | null>(null);
  const playingRef = useRef<string | null>(null);
  const sourceRef = useRef<string | null>(null);

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
      setError(errorText(loadError, "Could not load your tracks."));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadPipeline = useCallback(async () => {
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session) return;
      const response = await fetch("/api/generate/providers", {
        headers: { Authorization: `Bearer ${data.session.access_token}` },
      });
      if (!response.ok) return;
      const payload = (await response.json().catch(() => null)) as {
        pipelines?: { music?: ProviderStatus[] };
      } | null;
      const list = payload?.pipelines?.music;
      if (Array.isArray(list)) setProviders(list);
    } catch {
      // The pipeline strip is decoration — never block the studio on it.
    }
  }, []);

  useEffect(() => {
    void refresh();
    void loadPipeline();
    return () => {
      playerRef.current?.pause();
    };
  }, [refresh, loadPipeline]);

  function ensureAudio(): HTMLAudioElement {
    if (playerRef.current) return playerRef.current;
    const el = new Audio();
    el.preload = "metadata";

    el.addEventListener("timeupdate", () => {
      const id = playingRef.current;
      if (!id || !Number.isFinite(el.duration) || el.duration === 0) return;
      const ratio = el.currentTime / el.duration;
      setProgress((prev) =>
        Math.abs((prev[id] ?? 0) - ratio) < 0.004 ? prev : { ...prev, [id]: ratio },
      );
    });

    el.addEventListener("ended", () => {
      const id = playingRef.current;
      if (id) setProgress((prev) => ({ ...prev, [id]: 0 }));
      playingRef.current = null;
      setPlayingId(null);
    });

    el.addEventListener("error", () => {
      playingRef.current = null;
      setPlayingId(null);
    });

    playerRef.current = el;
    return el;
  }

  async function togglePlay(asset: MediaAsset) {
    const url = urls[asset.storage_path];
    if (!url) return;

    const el = ensureAudio();

    if (playingRef.current === asset.id) {
      el.pause();
      playingRef.current = null;
      setPlayingId(null);
      return;
    }

    if (sourceRef.current !== url) {
      el.src = url;
      sourceRef.current = url;
    }

    playingRef.current = asset.id;
    setPlayingId(asset.id);
    try {
      await el.play();
    } catch {
      playingRef.current = null;
      setPlayingId(null);
      setError("Playback was blocked — click the play button again.");
    }
  }

  async function seek(event: ReactMouseEvent<HTMLDivElement>, asset: MediaAsset) {
    const url = urls[asset.storage_path];
    if (!url) return;

    const el = ensureAudio();
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));

    if (sourceRef.current !== url) {
      el.src = url;
      sourceRef.current = url;
    }

    setProgress((prev) => ({ ...prev, [asset.id]: ratio }));

    if (Number.isFinite(el.duration) && el.duration > 0) {
      el.currentTime = ratio * el.duration;
    }

    playingRef.current = asset.id;
    setPlayingId(asset.id);
    try {
      await el.play();
    } catch {
      playingRef.current = null;
      setPlayingId(null);
    }
  }

  function toggleStyle(style: string) {
    setSelectedStyles((prev) =>
      prev.includes(style) ? prev.filter((entry) => entry !== style) : [...prev, style],
    );
  }

  function composePrompt(): string | null {
    const desc = description.trim();
    const lyr = lyrics.trim();
    const style = [...selectedStyles, styleText.trim()].filter(Boolean).join(", ");

    if (!desc && !style && !lyr) return null;

    const blocks: string[] = [];
    if (desc) blocks.push(desc);
    else blocks.push(`A ${style || "dark"} song with an ache underneath it.`);
    if (style) blocks.push(`Style: ${style}`);
    if (instrumental) blocks.push("Instrumental. No vocals.");
    else if (lyr) blocks.push(`Lyrics:\n${lyr}`);

    return blocks.join("\n\n");
  }

  async function generate() {
    const prompt = composePrompt();
    if (!prompt) {
      setError("Describe the song, or pick at least one style.");
      return;
    }
    if (prompt.length > MAX_PROMPT_LENGTH) {
      setError(`Keep the brief under ${MAX_PROMPT_LENGTH} characters.`);
      return;
    }

    setGenerating(true);
    setError(null);
    setNotice(null);
    setAttempts([]);

    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session) throw new Error("Sign in again to generate.");

      const response = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${data.session.access_token}`,
        },
        body: JSON.stringify({
          pipeline: "music",
          prompt,
          options: { durationSeconds: LENGTHS[lengthIndex].seconds },
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        guidance?: string;
        attempts?: Attempt[];
      };
      if (payload.attempts) setAttempts(payload.attempts);

      if (!response.ok) {
        setError(payload.error ?? "Generation failed.");
        if (payload.guidance) setNotice(payload.guidance);
        else if (payload.error) setNotice("Add or rotate a free key in Media Studio — music never falls back to local generation.");
        await refresh();
        return;
      }

      setNotice("Track generated and saved to your library.");
      await refresh();
    } catch (generateError) {
      setError(errorText(generateError, "Generation failed."));
    } finally {
      setGenerating(false);
    }
  }

  async function removeAsset(asset: MediaAsset) {
    if (playingId === asset.id) {
      playerRef.current?.pause();
      playingRef.current = null;
      setPlayingId(null);
    }
    setError(null);

    const { error: deleteError } = await supabase.storage
      .from(MEDIA_BUCKET)
      .remove([asset.storage_path]);

    if (deleteError) {
      setError(`Could not delete: ${deleteError.message}`);
      return;
    }

    await supabase.from("media_assets").delete().eq("id", asset.id);
    await refresh();
  }

  async function downloadAsset(asset: MediaAsset) {
    const url = urls[asset.storage_path];
    if (!url) return;
    setError(null);
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Download failed (HTTP ${response.status}).`);
      const blob = await response.blob();
      const href = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = href;
      anchor.download = `omniai-${asset.id}.mp3`;
      anchor.click();
      URL.revokeObjectURL(href);
    } catch (downloadError) {
      setError(errorText(downloadError, "Could not download this track."));
    }
  }

  const readyProviders = providers.filter((provider) => provider.supported);
  const blocked = readyProviders.length > 0 && readyProviders.every((p) => !p.ready);

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-1">
      <header className="space-y-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-signal">
          OmniAI / Composition desk
        </p>
        <h1 className="pilot-voice text-2xl text-ink">Music Studio</h1>
        <p className="max-w-2xl text-sm text-ash">
          Write the brief, choose a style, drop your lyrics. OmniAI turns it into a track through
          the free-first provider pipeline and stores it in your library — heavy media never runs
          on this machine.
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
      {notice && (
        <p
          role="status"
          className="rounded border border-signal/40 bg-signal/10 px-3 py-2 text-sm text-signal"
        >
          {notice}
        </p>
      )}

      {attempts.length > 0 && (
        <section className="space-y-2 rounded border border-ash/30 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-ash">
              Provider attempts
            </h2>
            {attempts.some((attempt) => attempt.reason === "missing_key" || attempt.reason === "quota") && (
              <a
                href="/media"
                className="text-[11px] text-signal underline-offset-2 hover:underline"
              >
                Add or rotate a key →
              </a>
            )}
          </div>
          <ul className="space-y-1">
            {attempts.map((attempt, index) => {
              const message = tidyMessage(attempt.message);
              return (
                <li
                  key={`${attempt.provider}-${index}`}
                  className={`text-xs ${attempt.ok ? "text-emerald-300" : "text-amber-200"}`}
                >
                  <span className="font-semibold uppercase">
                    {attempt.ok ? "ok" : attempt.reason}
                  </span>{" "}
                  · {shortName(attempt)}
                  {message && <span className="text-ash"> — {message}</span>}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
        {/* ---------------------------------------------------- compose */}
        <div className="space-y-5 rounded border border-ash/30 p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-ink">Compose</h2>
            <span className="font-mono text-[10px] uppercase tracking-wide text-ash">
              {generating ? "generating" : "ready"}
            </span>
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label
                htmlFor="music-description"
                className="font-mono text-[10px] uppercase tracking-[0.16em] text-ash"
              >
                The song
              </label>
              <PromptEnhancer
                value={description}
                onApply={setDescription}
                goal="a music generation model that writes and produces a finished song"
                context={
                  [...selectedStyles, styleText.trim()].filter(Boolean).length
                    ? `The style is already fixed as ${[...selectedStyles, styleText.trim()]
                        .filter(Boolean)
                        .join(", ")} — keep the rewrite inside that style`
                    : undefined
                }
              />
            </div>
            <textarea
              id="music-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              placeholder="A slow burn about realizing they were never coming back…"
              className="w-full resize-y rounded border border-ash/40 bg-transparent px-3 py-2 text-sm text-ink placeholder:text-ash/60 focus:border-signal focus:outline-none"
            />
          </div>

          <div className="space-y-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ash">
              Style
            </span>
            <div className="flex flex-wrap gap-2">
              {STYLE_PRESETS.map((style) => {
                const active = selectedStyles.includes(style);
                return (
                  <button
                    key={style}
                    type="button"
                    onClick={() => toggleStyle(style)}
                    aria-pressed={active}
                    className={`rounded-full border px-3 py-1 text-xs transition ${
                      active
                        ? "border-signal bg-signal/10 text-signal"
                        : "border-ash/40 text-ash hover:border-signal hover:text-signal"
                    }`}
                  >
                    {style}
                  </button>
                );
              })}
            </div>
            <input
              value={styleText}
              onChange={(event) => setStyleText(event.target.value)}
              placeholder="Or describe your own — 808s, tape hiss, distant vocal…"
              className="w-full rounded border border-ash/40 bg-transparent px-3 py-2 text-sm text-ink placeholder:text-ash/60 focus:border-signal focus:outline-none"
            />
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <label
                htmlFor="music-lyrics"
                className="font-mono text-[10px] uppercase tracking-[0.16em] text-ash"
              >
                Lyrics
              </label>
              <span className="flex flex-wrap items-center gap-3">
                {!instrumental && (
                  <PromptEnhancer
                    value={lyrics}
                    onApply={setLyrics}
                    goal="the finished song lyrics, written to fit the brief and the style above, with section tags such as [Verse] and [Chorus]"
                    kind="text"
                    context={description.trim() ? `Song brief: ${description.trim()}` : undefined}
                  />
                )}
                <label className="flex cursor-pointer items-center gap-2 text-xs text-ash">
                  <input
                    type="checkbox"
                    checked={instrumental}
                    onChange={(event) => setInstrumental(event.target.checked)}
                    className="h-3.5 w-3.5 accent-signal"
                  />
                  Instrumental
                </label>
              </span>
            </div>
            <textarea
              id="music-lyrics"
              value={lyrics}
              onChange={(event) => setLyrics(event.target.value)}
              rows={instrumental ? 2 : 7}
              disabled={instrumental}
              placeholder={"[Verse 1]\nYou said forever like it cost you nothing…\n\n[Chorus]\nStill I'm waiting on a signal that never comes"}
              className="w-full resize-y rounded border border-ash/40 bg-transparent px-3 py-2 text-sm leading-6 text-ink placeholder:text-ash/60 focus:border-signal focus:outline-none disabled:opacity-40"
            />
            <p className="text-[11px] text-ash/70">
              Section tags like <span className="text-signal">[Verse]</span> and{" "}
              <span className="text-signal">[Chorus]</span> are passed through to the provider.
            </p>
          </div>

          <div className="space-y-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ash">
              Length
            </span>
            <div className="flex flex-wrap gap-2">
              {LENGTHS.map((length, index) => (
                <button
                  key={length.seconds}
                  type="button"
                  onClick={() => setLengthIndex(index)}
                  className={`rounded border px-3 py-1 text-xs ${
                    lengthIndex === index
                      ? "border-signal text-signal"
                      : "border-ash/40 text-ash hover:border-signal"
                  }`}
                >
                  {length.label}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => void generate()}
            disabled={generating}
            className="w-full rounded bg-[#5b39b4] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-wine disabled:cursor-wait disabled:opacity-60"
          >
            {generating ? "Composing…" : "Compose track"}
          </button>

          {generating && (
            <p className="flex items-center gap-2 text-xs text-signal">
              <span className="dms-heartbeat h-1.5 w-1.5 rounded-full bg-signal" aria-hidden="true" />
              Running the free-first pipeline — this can take up to a minute.
            </p>
          )}

          {blocked && (
            <p className="text-xs text-amber-200">
              Every music provider needs a key right now.{" "}
              <a href="/media" className="underline hover:text-amber-100">
                Add one in Media Studio →
              </a>
            </p>
          )}

          {readyProviders.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 border-t border-ash/20 pt-3">
              <span className="font-mono text-[10px] uppercase tracking-wide text-ash">
                Pipeline
              </span>
              {readyProviders.map((provider) => (
                <span
                  key={provider.id}
                  title={`${provider.label} — ${provider.ready ? "ready" : "key required"}`}
                  className={`rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase ${
                    provider.ready
                      ? "border-emerald-500/40 text-emerald-300"
                      : "border-amber-500/40 text-amber-200"
                  }`}
                >
                  {shortName(provider)}
                  {!provider.ready && " · key"}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* ----------------------------------------------------- tracks */}
        <div className="space-y-4 rounded border border-ash/30 p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-ink">Your tracks</h2>
            <button
              type="button"
              onClick={() => void refresh()}
              className="rounded border border-ash/50 px-3 py-1 text-xs text-signal hover:bg-signal/10"
            >
              {loading ? "Loading…" : "Refresh"}
            </button>
          </div>

          {loading ? (
            <p className="py-8 text-center text-sm text-ash">Loading your library…</p>
          ) : assets.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded border border-dashed border-ash/30 px-4 py-10 text-center">
              <div className="flex h-10 items-end gap-1" aria-hidden="true">
                {[3, 7, 5, 9, 4, 8, 6, 10, 5, 7].map((height, index) => (
                  <span
                    key={index}
                    className="dms-heartbeat w-1 rounded-full bg-signal/70"
                    style={{
                      height: `${height * 3}px`,
                      animationDelay: `${index * 0.12}s`,
                    }}
                  />
                ))}
              </div>
              <p className="text-sm text-ash">No tracks yet.</p>
              <p className="max-w-xs text-xs text-ash/70">
                Write a brief on the left and hit compose — your first track lands here.
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {assets.map((asset) => {
                const url = urls[asset.storage_path];
                const bars = barsFor(asset.id);
                const ratio = progress[asset.id] ?? 0;
                const active = playingId === asset.id;

                return (
                  <li
                    key={asset.id}
                    className={`rounded border p-3 transition ${
                      active ? "border-signal/60 bg-signal/5" : "border-ash/30"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <button
                        type="button"
                        onClick={() => void togglePlay(asset)}
                        disabled={!url}
                        aria-label={active ? "Pause track" : "Play track"}
                        className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-signal/50 text-signal transition hover:bg-signal/15 disabled:opacity-40"
                      >
                        {active ? (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                            <rect x="6" y="5" width="4" height="14" rx="1" />
                            <rect x="14" y="5" width="4" height="14" rx="1" />
                          </svg>
                        ) : (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                            <path d="M8 5.5v13l11-6.5-11-6.5Z" />
                          </svg>
                        )}
                      </button>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-ink" title={trackTitle(asset)}>
                          {trackTitle(asset)}
                        </p>
                        <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wide text-ash">
                          {asset.provider ?? "provider"} · {formatClock(asset.duration_seconds)} ·{" "}
                          {new Date(asset.created_at).toLocaleDateString()}
                        </p>

                        <div
                          role={url ? "button" : undefined}
                          tabIndex={url ? 0 : undefined}
                          onClick={url ? (event) => void seek(event, asset) : undefined}
                          onKeyDown={
                            url
                              ? (event) => {
                                  if (event.key === "Enter" || event.key === " ") {
                                    event.preventDefault();
                                    void togglePlay(asset);
                                  }
                                }
                              : undefined
                          }
                          className={`mt-2.5 flex h-11 items-center gap-[2px] ${
                            url ? "cursor-pointer" : "opacity-40"
                          }`}
                          aria-label="Seek within track"
                        >
                          {bars.map((height, index) => {
                            const played = index / BAR_COUNT < ratio;
                            return (
                              <span
                                key={index}
                                className={`min-w-[2px] flex-1 rounded-full transition-colors duration-150 ${
                                  played ? "bg-signal" : "bg-ash/40"
                                }`}
                                style={{ height: `${Math.round(height * 100)}%` }}
                              />
                            );
                          })}
                        </div>

                        <div className="mt-1 flex items-center justify-between font-mono text-[10px] text-ash">
                          <span>{formatClock(ratio * (asset.duration_seconds ?? 0))}</span>
                          <span>{asset.model ?? asset.mime_type?.split("/")[1] ?? "audio"}</span>
                        </div>
                      </div>

                      <div className="flex shrink-0 flex-col gap-1.5">
                        <button
                          type="button"
                          onClick={() => void downloadAsset(asset)}
                          disabled={!url}
                          className="rounded border border-ash/50 px-2 py-1 text-[11px] text-signal hover:bg-signal/10 disabled:opacity-40"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => void removeAsset(asset)}
                          className="rounded border border-ash/50 px-2 py-1 text-[11px] text-ash hover:border-rose-400/60 hover:text-rose-300"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
