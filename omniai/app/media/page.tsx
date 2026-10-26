"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { zipSync } from "fflate";
import type { MediaAsset, MediaKind, ProviderAlert } from "@/lib/types";
import { PromptEnhancer } from "@/app/hud/PromptEnhancer";

const MEDIA_BUCKET = "media";
const MAX_UPLOAD_BYTES = 200 * 1024 * 1024; // 200 MB
const SIGNED_URL_TTL = 3600;

type Pipeline = "image" | "music" | "video";

type Attempt = {
  provider: string;
  label: string;
  ok: boolean;
  reason?: "missing_key" | "quota" | "error";
  message?: string;
};

type CredentialSource = "env" | "app" | null;

type ProviderStatus = {
  id: string;
  label: string;
  transport: string;
  model: string | null;
  free: boolean;
  supported: boolean;
  keyRequired: boolean;
  keyEnv: string | null;
  keyConfigured: boolean;
  keySource: CredentialSource;
  accountEnv: string | null;
  accountConfigured: boolean;
  accountSource: CredentialSource;
  docs: string | null;
  ready: boolean;
};

type TestResult = {
  ok: boolean;
  provider: string;
  label: string;
  model: string | null;
  reason?: "missing_key" | "quota" | "error";
  status?: number;
  message?: string;
  latencyMs?: number;
  bytes?: number;
  contentType?: string;
  previewDataUrl?: string;
};

const PIPELINES: { id: Pipeline; label: string; hint: string }[] = [
  { id: "image", label: "Image", hint: "Free via Pollinations — no key needed." },
  { id: "music", label: "Music", hint: "Free tier via Hugging Face (needs a key)." },
  { id: "video", label: "Video", hint: "Needs Pollen credits — free cloud video is scarce." },
];

const IMAGE_SIZES = [
  { label: "Square 1024", width: 1024, height: 1024 },
  { label: "Landscape 1280×720", width: 1280, height: 720 },
  { label: "Portrait 720×1280", width: 720, height: 1280 },
];

function kindFromMime(mime: string): MediaKind | null {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  return null;
}

function errorText(value: unknown, fallback: string): string {
  return value instanceof Error ? value.message : fallback;
}

export default function MediaStudioPage() {
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [previewAsset, setPreviewAsset] = useState<MediaAsset | null>(null);
  const [zipDownloading, setZipDownloading] = useState(false);
  const [alerts, setAlerts] = useState<ProviderAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [attempts, setAttempts] = useState<Attempt[]>([]);

  const [providerStatus, setProviderStatus] = useState<Record<Pipeline, ProviderStatus[]> | null>(
    null
  );
  const [providersError, setProvidersError] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({});
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testingAll, setTestingAll] = useState(false);
  const [secretConfigured, setSecretConfigured] = useState(true);
  const [keyDrafts, setKeyDrafts] = useState<Record<string, string>>({});
  const [savingEnv, setSavingEnv] = useState<string | null>(null);

  const [pipeline, setPipeline] = useState<Pipeline>("image");
  const [prompt, setPrompt] = useState("");
  const [sizeIndex, setSizeIndex] = useState(0);
  const [duration, setDuration] = useState(4);

  const fileInput = useRef<HTMLInputElement | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: rows, error: listError } = await supabase
        .from("media_assets")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (listError) {
        if (listError.message.toLowerCase().includes("media_assets")) {
          throw new Error(
            "Your database isn't set up yet: the media tables are missing. Run omniai/supabase/migrations/20261012120000_add_media_library.sql in the Supabase SQL Editor (see docs/FREE_MEDIA_SETUP.md, step 0)."
          );
        }
        throw new Error(listError.message);
      }

      const list = (rows ?? []) as MediaAsset[];
      setAssets(list);

      if (list.length > 0) {
        const { data: signed } = await supabase.storage
          .from(MEDIA_BUCKET)
          .createSignedUrls(list.map((asset) => asset.storage_path), SIGNED_URL_TTL);
        const map: Record<string, string> = {};
        for (const entry of signed ?? []) {
          if (entry.signedUrl && entry.path) map[entry.path] = entry.signedUrl;
        }
        setUrls(map);
      } else {
        setUrls({});
      }

      const { data: alertRows } = await supabase
        .from("provider_alerts")
        .select("*")
        .eq("acknowledged", false)
        .order("created_at", { ascending: false })
        .limit(20);
      setAlerts((alertRows ?? []) as ProviderAlert[]);
    } catch (loadError) {
      setError(errorText(loadError, "Could not load your media library."));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadProviders = useCallback(async () => {
    try {
      setProvidersError(null);
      const { data } = await supabase.auth.getSession();
      if (!data.session) return;
      const response = await fetch("/api/generate/providers", {
        headers: { Authorization: `Bearer ${data.session.access_token}` },
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? "Could not load provider status.");
      }
      const payload = (await response.json()) as {
        pipelines: Record<Pipeline, ProviderStatus[]>;
        secrets?: { configured?: boolean };
      };
      setProviderStatus(payload.pipelines);
      setSecretConfigured(payload.secrets?.configured ?? true);
    } catch (providersLoadError) {
      setProvidersError(errorText(providersLoadError, "Could not load provider status."));
    }
  }, []);

  useEffect(() => {
    void refresh();
    void loadProviders();
  }, [refresh, loadProviders]);

  async function requireSession() {
    const { data, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !data.session) {
      throw new Error("Your sign-in expired. Sign in again.");
    }
    return data.session;
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);
    setNotice(null);
    try {
      const session = await requireSession();
      const userId = session.user.id;
      let uploaded = 0;

      for (const file of Array.from(files)) {
        const kind = kindFromMime(file.type);
        if (!kind) {
          setError(`${file.name}: unsupported file type.`);
          continue;
        }
        if (file.size > MAX_UPLOAD_BYTES) {
          setError(`${file.name}: larger than 200 MB.`);
          continue;
        }

        const ext = file.name.includes(".") ? file.name.split(".").pop() : "bin";
        const id = crypto.randomUUID();
        const path = `${userId}/${id}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from(MEDIA_BUCKET)
          .upload(path, file, { contentType: file.type, upsert: false });
        if (uploadError) throw new Error(`${file.name}: ${uploadError.message}`);

        const { error: insertError } = await supabase.from("media_assets").insert({
          id,
          kind,
          source: "upload",
          prompt: null,
          provider: null,
          model: null,
          storage_path: path,
          mime_type: file.type,
          size_bytes: file.size,
        });
        if (insertError) throw new Error(`${file.name}: ${insertError.message}`);
        uploaded += 1;
      }

      setNotice(`Uploaded ${uploaded} file${uploaded === 1 ? "" : "s"}.`);
      if (fileInput.current) fileInput.current.value = "";
      await refresh();
    } catch (uploadError) {
      setError(errorText(uploadError, "Upload failed."));
    } finally {
      setUploading(false);
    }
  }

  async function generate() {
    if (!prompt.trim()) {
      setError("Enter a prompt first.");
      return;
    }
    setGenerating(true);
    setError(null);
    setNotice(null);
    setAttempts([]);
    try {
      const session = await requireSession();
      const options: Record<string, number> =
        pipeline === "image"
          ? { width: IMAGE_SIZES[sizeIndex].width, height: IMAGE_SIZES[sizeIndex].height }
          : {};
      if (pipeline === "video") options.durationSeconds = duration;

      const response = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ pipeline, prompt, options }),
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
        await refresh();
        return;
      }

      setNotice("Generated and saved to your library.");
      setPrompt("");
      await refresh();
    } catch (generateError) {
      setError(errorText(generateError, "Generation failed."));
    } finally {
      setGenerating(false);
    }
  }

  async function removeAsset(asset: MediaAsset) {
    setError(null);
    try {
      await supabase.storage.from(MEDIA_BUCKET).remove([asset.storage_path]);
      const { error: deleteError } = await supabase
        .from("media_assets")
        .delete()
        .eq("id", asset.id);
      if (deleteError) throw new Error(deleteError.message);
      setAssets((previous) => previous.filter((item) => item.id !== asset.id));
      setSelectedAssetIds((previous) => previous.filter((id) => id !== asset.id));
      setPreviewAsset((previous) => previous?.id === asset.id ? null : previous);
    } catch (deleteError) {
      setError(errorText(deleteError, "Could not delete that item."));
    }
  }

  async function downloadAsset(asset: MediaAsset) {
    setError(null);
    setNotice(null);

    try {
      const url = urls[asset.storage_path];
      if (!url) {
        throw new Error("Download link unavailable. Refresh the library and try again.");
      }

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Download failed (${response.status}). Refresh the library and try again.`);
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      const filename = asset.storage_path.split("/").pop() || `omniai-${asset.kind}`;

      anchor.href = objectUrl;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();

      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      setNotice(`Download started: ${filename}`);
    } catch (downloadError) {
      setError(errorText(downloadError, "Could not download this file."));
    }
  }
  function toggleAssetSelection(assetId: string) {
    setSelectedAssetIds((previous) =>
      previous.includes(assetId)
        ? previous.filter((id) => id !== assetId)
        : [...previous, assetId]
    );
  }

  function toggleSelectAll() {
    const allSelected =
      assets.length > 0 && assets.every((asset) => selectedAssetIds.includes(asset.id));

    setSelectedAssetIds(allSelected ? [] : assets.map((asset) => asset.id));
  }

  async function downloadSelectedZip() {
    const selectedAssets = assets.filter((asset) => selectedAssetIds.includes(asset.id));
    if (selectedAssets.length === 0) {
      setError("Select at least one library item first.");
      return;
    }

    // Avoid building an excessively large archive in browser memory.
    const estimatedBytes = selectedAssets.reduce(
      (total, asset) => total + (Number(asset.size_bytes) || 0),
      0
    );
    if (estimatedBytes > 300 * 1024 * 1024) {
      setError("Your selection exceeds the 300 MB ZIP limit. Select fewer or smaller files.");
      return;
    }

    setZipDownloading(true);
    setError(null);
    setNotice(null);

    try {
      const files: Record<string, Uint8Array> = {};
      const usedNames = new Set<string>();

      for (const asset of selectedAssets) {
        const url = urls[asset.storage_path];
        if (!url) {
          throw new Error("A download link has expired or is missing. Refresh the library and try again.");
        }

        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Could not download a selected file (${response.status}). Refresh and try again.`);
        }

        const bytes = new Uint8Array(await response.arrayBuffer());
        const originalName =
          asset.storage_path.split("/").pop() || `omniai-${asset.kind}-${asset.id}`;
        let filename = originalName;
        let counter = 2;

        while (usedNames.has(filename.toLowerCase())) {
          const dot = originalName.lastIndexOf(".");
          filename =
            dot > 0
              ? `${originalName.slice(0, dot)}-${counter}${originalName.slice(dot)}`
              : `${originalName}-${counter}`;
          counter += 1;
        }

        usedNames.add(filename.toLowerCase());
        files[filename] = bytes;
      }

      const archive = zipSync(files, { level: 1 });
      const archiveBuffer = archive.buffer.slice(
        archive.byteOffset,
        archive.byteOffset + archive.byteLength
      ) as ArrayBuffer;
      const objectUrl = URL.createObjectURL(
        new Blob([archiveBuffer], { type: "application/zip" })
      );
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = `omniai-media-${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 2000);

      setNotice(`ZIP download started with ${selectedAssets.length} file(s).`);
    } catch (zipError) {
      setError(errorText(zipError, "Could not create the ZIP download."));
    } finally {
      setZipDownloading(false);
    }
  }

  async function acknowledgeAlert(id: string) {
    const { error: updateError } = await supabase
      .from("provider_alerts")
      .update({ acknowledged: true })
      .eq("id", id);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setAlerts((previous) => previous.filter((alert) => alert.id !== id));
  }

  async function testProvider(providerId: string) {
    setTestingId(providerId);
    setTestResults((previous) => {
      const next = { ...previous };
      delete next[providerId];
      return next;
    });
    try {
      const session = await requireSession();
      const response = await fetch("/api/generate/providers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ pipeline, provider: providerId }),
      });
      const payload = (await response.json().catch(() => ({}))) as TestResult;
      setTestResults((previous) => ({ ...previous, [providerId]: payload }));
    } catch (testError) {
      setTestResults((previous) => ({
        ...previous,
        [providerId]: {
          ok: false,
          provider: providerId,
          label: providerId,
          model: null,
          reason: "error",
          message: errorText(testError, "Test failed."),
        },
      }));
    } finally {
      setTestingId(null);
    }
  }

  async function testAllProviders() {
    const list = providerStatus?.[pipeline] ?? [];
    if (list.length === 0) return;
    setTestingAll(true);
    try {
      for (const provider of list) {
        await testProvider(provider.id);
      }
    } finally {
      setTestingAll(false);
    }
  }

  async function saveProviderKey(envName: string) {
    const value = (keyDrafts[envName] ?? "").trim();
    if (!value) return;
    setSavingEnv(envName);
    setError(null);
    setNotice(null);
    try {
      const session = await requireSession();
      const response = await fetch("/api/generate/keys", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ envName, value }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Could not save the key.");
      setKeyDrafts((previous) => ({ ...previous, [envName]: "" }));
      setNotice(`Saved ${envName}. It is stored encrypted and never shown again.`);
      await loadProviders();
    } catch (saveError) {
      setError(errorText(saveError, "Could not save the key."));
    } finally {
      setSavingEnv(null);
    }
  }

  async function removeProviderKey(envName: string) {
    setSavingEnv(envName);
    setError(null);
    setNotice(null);
    try {
      const session = await requireSession();
      const response = await fetch("/api/generate/keys", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ envName }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Could not remove the key.");
      setNotice(`Removed ${envName}.`);
      await loadProviders();
    } catch (removeError) {
      setError(errorText(removeError, "Could not remove the key."));
    } finally {
      setSavingEnv(null);
    }
  }

  function credentialEditor(
    envName: string,
    label: string,
    source: CredentialSource,
    secret: boolean
  ) {
    const busy = savingEnv === envName;
    const draft = keyDrafts[envName] ?? "";
    return (
      <div key={envName} className="space-y-1.5">
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-ash">
          <span className="font-mono text-[10px] uppercase tracking-wide text-signal">{envName}</span>
          <span className="text-ash/70">· {label}</span>
          {source === "env" && (
            <span className="rounded border border-emerald-400/30 px-1.5 py-0.5 text-[10px] uppercase text-emerald-300">
              from server env
            </span>
          )}
          {source === "app" && (
            <span className="rounded border border-signal/40 px-1.5 py-0.5 text-[10px] uppercase text-signal">
              saved in app
            </span>
          )}
        </div>

        {source !== "env" && (
          <div className="flex items-center gap-2">
            <input
              type={secret ? "password" : "text"}
              autoComplete="off"
              spellCheck={false}
              placeholder={secret ? "Paste key…" : "Paste value…"}
              value={draft}
              onChange={(event) =>
                setKeyDrafts((previous) => ({ ...previous, [envName]: event.target.value }))
              }
              disabled={!secretConfigured || busy}
              className="min-w-0 flex-1 rounded border border-ash/40 bg-transparent px-2 py-1 text-xs text-ink placeholder:text-ash/50 focus:border-signal focus:outline-none disabled:opacity-50"
            />
            <button
              type="button"
              disabled={!secretConfigured || busy || !draft.trim()}
              onClick={() => void saveProviderKey(envName)}
              className="shrink-0 rounded border border-signal/40 px-2 py-1 text-[11px] text-signal hover:border-signal hover:bg-signal/10 disabled:opacity-50"
            >
              {busy ? "Saving…" : source === "app" ? "Replace" : "Save"}
            </button>
            {source === "app" && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void removeProviderKey(envName)}
                className="shrink-0 rounded border border-ash/40 px-2 py-1 text-[11px] text-ash hover:border-rose-400 hover:text-rose-200 disabled:opacity-50"
              >
                Remove
              </button>
            )}
          </div>
        )}

        {!secretConfigured && (
          <p className="text-[11px] text-amber-200/80">
            Set OMNIAI_KEY_SECRET to save keys here, or add {envName} as a server environment
            variable instead.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header className="space-y-1">
        <h1 className="pilot-voice text-2xl text-ink">Media Studio</h1>
        <p className="text-sm text-ash">
          Upload images, video or audio, and generate new media with free-first cloud providers.
          Heavy media never runs locally.
        </p>
      </header>

      {error && (
        <p role="alert" className="rounded border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="rounded border border-signal/40 bg-signal/10 px-3 py-2 text-sm text-signal">
          {notice}
        </p>
      )}

      {alerts.length > 0 && (
        <section className="space-y-2 rounded border border-amber-500/40 bg-amber-500/5 p-4">
          <h2 className="text-sm font-semibold text-amber-200">Provider notices</h2>
          <p className="text-xs text-amber-200/80">
            A free provider is out of quota or missing a key. Add or rotate a key — media does not
            fall back to local generation.
          </p>
          {alerts.map((alert) => (
            <div key={alert.id} className="flex items-start justify-between gap-3 rounded border border-amber-500/20 px-3 py-2">
              <div className="text-xs text-amber-100">
                <span className="font-semibold uppercase">{alert.pipeline}</span> · {alert.provider} ·{" "}
                {alert.reason}
                <div className="text-amber-100/80">{alert.message}</div>
              </div>
              <button
                type="button"
                onClick={() => void acknowledgeAlert(alert.id)}
                className="shrink-0 rounded border border-amber-400/40 px-2 py-1 text-xs text-amber-100 hover:border-amber-300"
              >
                Dismiss
              </button>
            </div>
          ))}
        </section>
      )}

      <section className="grid gap-6 md:grid-cols-2">
        <div className="space-y-3 rounded border border-ash/30 p-4">
          <h2 className="text-sm font-semibold text-ink">Upload</h2>
          <p className="text-xs text-ash">Images, video and audio up to 200 MB each.</p>
          <input
            ref={fileInput}
            type="file"
            multiple
            accept="image/*,video/*,audio/*"
            disabled={uploading}
            onChange={(event) => void handleFiles(event.target.files)}
            className="block w-full text-xs text-ash file:mr-3 file:rounded file:border file:border-ash/40 file:bg-transparent file:px-3 file:py-1 file:text-xs file:text-ink hover:file:border-signal"
          />
          {uploading && <p className="text-xs text-signal">Uploading…</p>}
        </div>

        <div className="space-y-3 rounded border border-ash/30 p-4">
          <h2 className="text-sm font-semibold text-ink">Generate</h2>
          <div className="flex flex-wrap gap-2">
            {PIPELINES.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setPipeline(option.id)}
                className={`rounded border px-3 py-1 text-xs ${
                  pipeline === option.id
                    ? "border-signal text-signal"
                    : "border-ash/40 text-ash hover:border-signal"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-ash">{PIPELINES.find((p) => p.id === pipeline)?.hint}</p>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <label
              htmlFor="media-prompt"
              className="font-mono text-[10px] uppercase tracking-[0.16em] text-ash"
            >
              Prompt
            </label>
            <PromptEnhancer
              value={prompt}
              onApply={setPrompt}
              goal={
                pipeline === "image"
                  ? "an image generation model"
                  : pipeline === "video"
                    ? "a video generation model"
                    : "a music generation model"
              }
              context={
                pipeline === "image"
                  ? `Output size is fixed at ${IMAGE_SIZES[sizeIndex].label}`
                  : pipeline === "video"
                    ? `Output length is fixed at about ${duration} seconds`
                    : undefined
              }
            />
          </div>

          <textarea
            id="media-prompt"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            rows={3}
            placeholder="Describe what to make…"
            className="w-full rounded border border-ash/40 bg-transparent px-3 py-2 text-sm text-ink placeholder:text-ash/60 focus:border-signal focus:outline-none"
          />

          {pipeline === "image" && (
            <label className="block text-xs text-ash">
              Size
              <select
                value={sizeIndex}
                onChange={(event) => setSizeIndex(Number(event.target.value))}
                className="mt-1 block w-full rounded border border-ash/40 bg-[#0b0a14] px-2 py-1 text-sm text-ink focus:border-signal focus:outline-none"
              >
                {IMAGE_SIZES.map((size, index) => (
                  <option key={size.label} value={index}>
                    {size.label}
                  </option>
                ))}
              </select>
            </label>
          )}

          {pipeline === "video" && (
            <label className="block text-xs text-ash">
              Duration (seconds)
              <input
                type="number"
                min={2}
                max={12}
                value={duration}
                onChange={(event) => setDuration(Number(event.target.value))}
                className="mt-1 block w-full rounded border border-ash/40 bg-[#0b0a14] px-2 py-1 text-sm text-ink focus:border-signal focus:outline-none"
              />
            </label>
          )}

          <button
            type="button"
            disabled={generating || !prompt.trim()}
            onClick={() => void generate()}
            className="rounded bg-wine px-4 py-2 text-sm text-white hover:opacity-90 disabled:opacity-50"
          >
            {generating ? "Generating…" : `Generate ${pipeline}`}
          </button>

          {attempts.length > 0 && (
            <ul className="space-y-1 text-xs">
              {attempts.map((attempt) => (
                <li key={attempt.provider} className={attempt.ok ? "text-emerald-300" : "text-ash"}>
                  {attempt.ok ? "✓" : "✕"} {attempt.label}
                  {attempt.message ? ` — ${attempt.message}` : ""}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">Providers</h2>
          <button
            type="button"
            disabled={testingAll || (providerStatus?.[pipeline]?.length ?? 0) === 0}
            onClick={() => void testAllProviders()}
            className="rounded border border-ash/40 px-3 py-1 text-xs text-ash hover:border-signal disabled:opacity-50"
          >
            {testingAll ? "Testing…" : "Test all in order"}
          </button>
        </div>
        <p className="text-xs text-ash">
          Each provider is tested with a tiny throwaway request — nothing is stored. A green check
          means the key works. Video tests may consume Pollen credits.
        </p>
        <p className="text-xs text-ash">
          Paste a key below to save it for this app. Keys are encrypted server-side and never shown
          again. A real server environment variable always takes precedence.
        </p>

        {!secretConfigured && (
          <div className="rounded border border-amber-400/40 bg-amber-400/5 px-3 py-2 text-xs text-amber-100">
            <p className="font-semibold">In-app key saving is off — the paste boxes are disabled.</p>
            <p className="mt-1 text-amber-100/80">
              Set <code className="font-mono">OMNIAI_KEY_SECRET</code> to a long random value in your
              server environment, then reload:
            </p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-amber-100/80">
              <li>
                Local: add it to <code className="font-mono">omniai/.env.local</code> and restart{" "}
                <code className="font-mono">next dev</code>.
              </li>
              <li>
                Vercel: Settings → Environment Variables → add it, then <b>redeploy</b>.
              </li>
            </ul>
            <p className="mt-1 text-amber-100/80">
              Or skip the box entirely and add the provider key as a normal server environment
              variable.
            </p>
          </div>
        )}

        {providersError && <p className="text-xs text-rose-200">{providersError}</p>}

        {!providerStatus ? (
          <p className="text-xs text-ash">Loading providers…</p>
        ) : (
          <ul className="space-y-2">
            {(providerStatus[pipeline] ?? []).map((provider) => {
              const result = testResults[provider.id];
              const busy = testingId === provider.id;
              return (
                <li key={provider.id} className="rounded border border-ash/30 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs">
                      <span className="text-ink">{provider.label}</span>
                      {provider.model && <span className="text-ash"> · {provider.model}</span>}
                      <div className="mt-1 flex flex-wrap gap-1">
                        <span className="rounded border border-ash/30 px-1.5 py-0.5 text-[10px] uppercase text-ash">
                          {provider.transport}
                        </span>
                        {provider.free && (
                          <span className="rounded border border-emerald-400/30 px-1.5 py-0.5 text-[10px] uppercase text-emerald-300">
                            free
                          </span>
                        )}
                        <span
                          className={`rounded border px-1.5 py-0.5 text-[10px] uppercase ${
                            provider.ready
                              ? "border-emerald-400/30 text-emerald-300"
                              : provider.keyConfigured
                                ? "border-amber-400/30 text-amber-200"
                                : "border-rose-400/30 text-rose-200"
                          }`}
                        >
                          {provider.ready
                            ? "ready"
                            : !provider.supported
                              ? "not supported"
                              : provider.keyConfigured
                                ? "key set"
                                : `needs ${provider.keyEnv ?? "key"}`}
                        </span>
                        {provider.accountEnv && !provider.accountConfigured && (
                          <span className="rounded border border-rose-400/30 px-1.5 py-0.5 text-[10px] uppercase text-rose-200">
                            needs {provider.accountEnv}
                          </span>
                        )}
                        {!provider.ready && provider.docs && (
                          <a
                            href={provider.docs}
                            target="_blank"
                            rel="noreferrer"
                            title={`Get a key: ${provider.docs}`}
                            className="rounded border border-signal/40 px-1.5 py-0.5 text-[10px] uppercase text-signal hover:border-signal hover:bg-signal/10"
                          >
                            Get key ↗
                          </a>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={busy || testingAll || !provider.supported}
                      onClick={() => void testProvider(provider.id)}
                      className="rounded border border-ash/40 px-3 py-1 text-xs text-ash hover:border-signal disabled:opacity-50"
                    >
                      {busy ? "Testing…" : "Test"}
                    </button>
                  </div>

                  {(provider.keyRequired || provider.accountEnv) && (
                    <div className="mt-3 space-y-3 border-t border-ash/20 pt-3">
                      {provider.keyEnv &&
                        provider.keyRequired &&
                        credentialEditor(provider.keyEnv, "API key", provider.keySource, true)}
                      {provider.accountEnv &&
                        credentialEditor(
                          provider.accountEnv,
                          "Account id",
                          provider.accountSource,
                          false
                        )}
                    </div>
                  )}

                  {result && (
                    <div
                      className={`mt-2 flex items-start gap-3 rounded border px-2 py-1.5 text-xs ${
                        result.ok
                          ? "border-emerald-400/30 text-emerald-200"
                          : "border-rose-400/30 text-rose-200"
                      }`}
                    >
                      {result.previewDataUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={result.previewDataUrl}
                          alt="test preview"
                          className="h-12 w-12 rounded object-cover"
                        />
                      )}
                      <div>
                        <div>
                          {result.ok ? "✓ works" : "✕ failed"}
                          {typeof result.latencyMs === "number" ? ` · ${result.latencyMs} ms` : ""}
                        </div>
                        {result.message && <div className="opacity-80">{result.message}</div>}
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">Library</h2>
          <button
            type="button"
            onClick={() => void refresh()}
            className="rounded border border-ash/40 px-3 py-1 text-xs text-ash hover:border-signal"
          >
            {loading ? "Loading…" : "Refresh"}
          </button>
        </div>
        {assets.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-ash/30 bg-black/20 p-3">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={assets.length > 0 && assets.every((asset) => selectedAssetIds.includes(asset.id))}
                onChange={toggleSelectAll}
                className="h-4 w-4 accent-violet-500"
              />
              {assets.length > 0 && assets.every((asset) => selectedAssetIds.includes(asset.id))
                ? "Deselect All"
                : "Select All"}
            </label>
            <span className="text-xs text-ash">
              {selectedAssetIds.filter((id) => assets.some((asset) => asset.id === id)).length} selected
            </span>
            <button
              type="button"
              onClick={() => void downloadSelectedZip()}
              disabled={zipDownloading || selectedAssetIds.length === 0}
              className="rounded border border-signal/50 px-3 py-2 text-xs text-signal hover:bg-signal/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {zipDownloading ? "Preparing ZIP…" : "Download Selected (.ZIP)"}
            </button>
          </div>
        )}

        {loading ? (
          <p className="text-sm text-ash">Loading media…</p>
        ) : assets.length === 0 ? (
          <p className="text-sm text-ash">Nothing here yet. Upload a file or generate something.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {assets.map((asset) => (
              <li key={asset.id} className="space-y-2 rounded border border-ash/30 p-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium uppercase tracking-wide text-ash">
                    {asset.kind}
                  </span>
                  <label className="flex cursor-pointer items-center gap-2 text-xs text-ash">
                    <input
                      type="checkbox"
                      checked={selectedAssetIds.includes(asset.id)}
                      onChange={() => toggleAssetSelection(asset.id)}
                      className="h-4 w-4 accent-violet-500"
                    />
                    Select
                  </label>
                </div>
                <div className="flex h-32 items-center justify-center overflow-hidden rounded bg-black/30">
                  {asset.kind === "image" && urls[asset.storage_path] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <button
                      type="button"
                      onClick={() => setPreviewAsset(asset)}
                      aria-label={`Preview image: ${asset.prompt ?? "generated image"}`}
                      className="h-full w-full cursor-zoom-in focus:outline-none focus:ring-2 focus:ring-signal"
                    >
                      <img
                        src={urls[asset.storage_path]}
                        alt={asset.prompt ?? "generated image"}
                        className="h-full w-full object-cover transition-opacity hover:opacity-90"
                      />
                    </button>
                  ) : asset.kind === "video" && urls[asset.storage_path] ? (
                    <video src={urls[asset.storage_path]} controls className="h-full w-full object-cover" />
                  ) : asset.kind === "audio" && urls[asset.storage_path] ? (
                    <audio src={urls[asset.storage_path]} controls className="w-full" />
                  ) : (
                    <span className="text-xs text-ash">No preview</span>
                  )}
                </div>
                <div className="text-xs text-ash">
                  <div className="uppercase tracking-wide text-signal">{asset.kind} · {asset.source}</div>
                  {asset.prompt && <p className="line-clamp-2 text-ink/80">{asset.prompt}</p>}
                  {asset.provider && <p>{asset.provider}{asset.model ? ` · ${asset.model}` : ""}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => void downloadAsset(asset)}
                  className="w-full rounded border border-signal/40 px-2 py-1 text-xs text-signal hover:border-signal hover:bg-signal/10"
                >
                  Download
                </button>
                <button
                  type="button"
                  onClick={() => void removeAsset(asset)}
                  className="w-full rounded border border-ash/40 px-2 py-1 text-xs text-ash hover:border-rose-400 hover:text-rose-200"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
{previewAsset && urls[previewAsset.storage_path] && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Image preview"
        >
          <div className="flex max-h-full w-full max-w-6xl flex-col gap-3 rounded-xl border border-signal/40 bg-[#14121f] p-4 shadow-2xl shadow-violet-950/40">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-ink">Image Preview</h2>
              <button
                type="button"
                onClick={() => setPreviewAsset(null)}
                className="rounded border border-ash/40 px-3 py-2 text-sm text-ash hover:border-signal hover:text-ink"
                autoFocus
              >
                Close
              </button>
            </div>
            <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto rounded-lg bg-black/40">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={urls[previewAsset.storage_path]}
                alt={previewAsset.prompt ?? "Full-size media preview"}
                className="max-h-[75vh] max-w-full object-contain"
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="line-clamp-2 text-xs text-ash">
                {previewAsset.prompt ?? "Image from your OmniAI library"}
              </p>
              <button
                type="button"
                onClick={() => void downloadAsset(previewAsset)}
                className="rounded border border-signal/50 px-4 py-2 text-sm text-signal hover:bg-signal/10"
              >
                Download Image
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
