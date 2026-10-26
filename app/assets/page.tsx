"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { zipSync } from "fflate";
import type { MediaAsset, MediaKind } from "@/lib/types";
import {
  Search,
  X,
  SlidersHorizontal,
  Sparkles,
  Download,
  Filter,
  Check,
  RefreshCw,
  Upload,
  Layers,
  FileArchive
} from "lucide-react";

/**
 * Media Library — the one surviving home for a customer's files.
 *
 * Upgraded with:
 *   - Real-time search by prompt name, source, or filename
 *   - CSS filter presets system ('Vintage', 'Noir', 'Cyberpunk', 'Cinematic', 'Gothic')
 *   - Live filtered preview thumbnails and full-size modal with 'Download with Filter'
 */

const MEDIA_BUCKET = "media";
const MAX_UPLOAD_BYTES = 200 * 1024 * 1024; // 200 MB
const MAX_ZIP_BYTES = 300 * 1024 * 1024; // keep archives out of OOM territory
const SIGNED_URL_TTL = 3600;

type Tab = "all" | "image" | "video" | "audio";

export type PresetFilterId = "none" | "vintage" | "noir" | "cyberpunk" | "cinematic" | "gothic";

export interface PresetFilter {
  id: PresetFilterId;
  label: string;
  css: string;
  description: string;
  badgeColor: string;
}

export const PRESET_FILTERS: PresetFilter[] = [
  {
    id: "none",
    label: "Normal",
    css: "none",
    description: "Original unadjusted render",
    badgeColor: "#9490ac",
  },
  {
    id: "vintage",
    label: "Vintage",
    css: "sepia(0.65) contrast(1.15) brightness(0.92) saturate(1.3) hue-rotate(-12deg)",
    description: "Warm retro 70s faded film print",
    badgeColor: "#ffb84d",
  },
  {
    id: "noir",
    label: "Noir",
    css: "grayscale(1) contrast(1.5) brightness(0.88)",
    description: "Deep, moody high-contrast monochrome",
    badgeColor: "#c5bfff",
  },
  {
    id: "cyberpunk",
    label: "Cyberpunk",
    css: "contrast(1.3) saturate(1.85) hue-rotate(185deg) brightness(1.05)",
    description: "Electric neon cyan & ultraviolet glow",
    badgeColor: "#00f2fe",
  },
  {
    id: "cinematic",
    label: "Cinematic",
    css: "contrast(1.22) saturate(1.15) brightness(0.94) sepia(0.18)",
    description: "35mm theatrical teal-and-orange grade",
    badgeColor: "#00ffa3",
  },
  {
    id: "gothic",
    label: "Gothic",
    css: "contrast(1.4) brightness(0.8) saturate(0.65) hue-rotate(240deg)",
    description: "Dark Misfit melancholic shadow atmosphere",
    badgeColor: "#e879f9",
  },
];

const KIND_LABEL: Record<MediaAsset["kind"], string> = {
  image: "artwork",
  video: "video",
  audio: "music",
};

const KIND_ICON: Record<MediaAsset["kind"], string> = {
  image: "🎨",
  video: "🎬",
  audio: "🎵",
};

function kindFromMime(mime: string): MediaKind | null {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  return null;
}

const PROVIDER_SYSTEM_WARNING = /quota|provider.{0,40}(missing|unavailable|credential|api key)|(?:missing|unavailable).{0,40}(?:provider|credential|api key)|api key.{0,40}(missing|invalid|not configured)|credential.{0,40}(missing|invalid|not configured)/i;

function isProviderSystemWarning(value: string | null | undefined): boolean {
  return Boolean(value && PROVIDER_SYSTEM_WARNING.test(value));
}

function errorText(value: unknown, fallback: string): string {
  return value instanceof Error ? value.message : fallback;
}

export default function AssetsPage() {
  const [tab, setTab] = useState<Tab>("all");
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [canManageProviders, setCanManageProviders] = useState(false);
  const [needsProviderReview, setNeedsProviderReview] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [zipBusy, setZipBusy] = useState(false);
  const [previewAsset, setPreviewAsset] = useState<MediaAsset | null>(null);

  // Search & CSS Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [globalFilter, setGlobalFilter] = useState<PresetFilterId>("none");
  const [itemFilters, setItemFilters] = useState<Record<string, PresetFilterId>>({});
  const [modalFilter, setModalFilter] = useState<PresetFilterId>("none");
  const [filteredDownloading, setFilteredDownloading] = useState(false);

  const fileInput = useRef<HTMLInputElement | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      setSignedIn(Boolean(sessionData.session));
      if (!sessionData.session) {
        setAssets([]);
        setUrls({});
        setCanManageProviders(false);
        setNeedsProviderReview(false);
        return;
      }

      const adminResponse = await fetch("/api/admin/providers", {
        headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
        cache: "no-store",
      }).catch(() => null);
      const ownerCanManageProviders = adminResponse?.ok === true;
      setCanManageProviders(ownerCanManageProviders);

      const { data: rows, error: listError } = await supabase
        .from("media_assets")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (listError) throw new Error(listError.message);

      const list = (rows ?? []) as MediaAsset[];
      setAssets(list);
      if (list.length === 0) {
        setUrls({});
      } else {
        const { data: signed } = await supabase.storage
          .from(MEDIA_BUCKET)
          .createSignedUrls(list.map((a) => a.storage_path), SIGNED_URL_TTL);
        const map: Record<string, string> = {};
        for (const entry of signed ?? []) {
          if (entry.signedUrl && entry.path) map[entry.path] = entry.signedUrl;
        }
        setUrls(map);
      }

      if (ownerCanManageProviders) {
        const { data: alertRows } = await supabase
          .from("provider_alerts")
          .select("id, reason, message")
          .eq("acknowledged", false)
          .order("created_at", { ascending: false })
          .limit(20);
        setNeedsProviderReview((alertRows ?? []).some((alert) =>
          isProviderSystemWarning(`${alert.reason ?? ""} ${alert.message ?? ""}`)
        ));
      } else {
        setNeedsProviderReview(false);
      }
    } catch (e) {
      setError(errorText(e, "Could not load your library."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

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
    setError("");
    setNotice("");
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

  async function removeAsset(asset: MediaAsset) {
    setError("");
    setNotice("");
    try {
      await supabase.storage.from(MEDIA_BUCKET).remove([asset.storage_path]);
      const { error: deleteError } = await supabase
        .from("media_assets")
        .delete()
        .eq("id", asset.id);
      if (deleteError) throw new Error(deleteError.message);
      setAssets((previous) => previous.filter((item) => item.id !== asset.id));
      setSelectedIds((previous) => previous.filter((id) => id !== asset.id));
      if (previewAsset?.id === asset.id) setPreviewAsset(null);
      setNotice("Deleted.");
    } catch (deleteError) {
      setError(errorText(deleteError, "Could not delete that item."));
    }
  }

  /** Helper to get the CSS filter value from an ID */
  const getFilterCss = useCallback((filterId: PresetFilterId) => {
    return PRESET_FILTERS.find((f) => f.id === filterId)?.css ?? "none";
  }, []);

  async function downloadAsset(asset: MediaAsset, withFilter?: PresetFilterId) {
    setError("");
    setNotice("");
    try {
      const url = urls[asset.storage_path];
      if (!url) {
        throw new Error("Download link expired. Refresh the library and try again.");
      }

      // If a CSS filter is requested on an image, bake the filter onto an HTML5 canvas!
      if (withFilter && withFilter !== "none" && asset.kind === "image") {
        setFilteredDownloading(true);
        const filterCss = getFilterCss(withFilter);
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = url;

        await new Promise((resolve, reject) => {
          img.onload = () => resolve(null);
          img.onerror = () => reject(new Error("Image download with filter failed."));
        });

        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Canvas context unavailable.");

        ctx.filter = filterCss;
        ctx.drawImage(img, 0, 0);

        const dataUrl = canvas.toDataURL("image/jpeg", 0.95);
        const anchor = document.createElement("a");
        const originalName = asset.storage_path.split("/").pop() || "omniai-artwork.jpg";
        const baseName = originalName.replace(/\.[^/.]+$/, "");
        anchor.href = dataUrl;
        anchor.download = `${baseName}-${withFilter}.jpg`;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        setNotice(`Filtered download started: ${anchor.download}`);
        setFilteredDownloading(false);
        return;
      }

      // Standard direct download
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Download failed (${response.status}). Refresh and try again.`);
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
      setFilteredDownloading(false);
    }
  }

  function toggleSelection(assetId: string) {
    setSelectedIds((previous) =>
      previous.includes(assetId)
        ? previous.filter((id) => id !== assetId)
        : [...previous, assetId]
    );
  }

  function toggleSelectAll() {
    const allSelected =
      assets.length > 0 && assets.every((asset) => selectedIds.includes(asset.id));
    setSelectedIds(allSelected ? [] : assets.map((asset) => asset.id));
  }

  async function downloadSelectedZip() {
    const chosen = assets.filter((asset) => selectedIds.includes(asset.id));
    if (chosen.length === 0) {
      setError("Select at least one library item first.");
      return;
    }
    const estimatedBytes = chosen.reduce(
      (total, asset) => total + (Number(asset.size_bytes) || 0),
      0
    );
    if (estimatedBytes > MAX_ZIP_BYTES) {
      setError("Your selection exceeds the 300 MB ZIP limit. Select fewer or smaller files.");
      return;
    }

    setZipBusy(true);
    setError("");
    setNotice("");
    try {
      const files: Record<string, Uint8Array> = {};
      const usedNames = new Set<string>();

      for (const asset of chosen) {
        const url = urls[asset.storage_path];
        if (!url) {
          throw new Error("A download link expired. Refresh the library and try again.");
        }
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Could not download a selected file (${response.status}). Refresh and retry.`);
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
      setNotice(`ZIP download started with ${chosen.length} file(s).`);
    } catch (zipError) {
      setError(errorText(zipError, "Could not create the ZIP download."));
    } finally {
      setZipBusy(false);
    }
  }

  useEffect(() => {
    if (canManageProviders && isProviderSystemWarning(error)) {
      setNeedsProviderReview(true);
    }
  }, [canManageProviders, error]);

  // Combined Search & Kind Filtering
  const filtered = useMemo(() => {
    let list = tab === "all" ? assets : assets.filter((a) => a.kind === tab);
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((a) => {
        const promptMatch = a.prompt?.toLowerCase().includes(q);
        const sourceMatch = a.source?.toLowerCase().includes(q);
        const filenameMatch = a.storage_path?.split("/").pop()?.toLowerCase().includes(q);
        const providerMatch = a.provider?.toLowerCase().includes(q);
        const modelMatch = a.model?.toLowerCase().includes(q);
        return Boolean(promptMatch || sourceMatch || filenameMatch || providerMatch || modelMatch);
      });
    }
    return list;
  }, [assets, tab, searchQuery]);

  const allSelected =
    assets.length > 0 && assets.every((asset) => selectedIds.includes(asset.id));
  const selectionCount = selectedIds.filter((id) =>
    assets.some((asset) => asset.id === id)
  ).length;

  const openPreview = (asset: MediaAsset) => {
    setPreviewAsset(asset);
    setModalFilter(itemFilters[asset.id] ?? globalFilter);
  };

  return (
    <div className="max-w-6xl space-y-6 p-4 sm:p-6 text-[#e8e6f2]">
      {/* Header Banner */}
      <header className="relative flex flex-wrap items-end justify-between gap-4 overflow-hidden rounded-2xl border border-[#35255e] bg-gradient-to-br from-[#1c122e] via-[#120d24] to-[#090714] p-5 sm:p-6 shadow-[0_12px_40px_rgba(0,0,0,0.6)]">
        <div className="pointer-events-none absolute -right-8 -top-16 h-48 w-48 rounded-full bg-[#00ffa3]/10 blur-3xl" aria-hidden />
        <div className="relative max-w-2xl">
          <div className="flex items-center gap-2 mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.25em] text-[#00ffa3]">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Creative Vault · Studio Archive</span>
          </div>
          <h1 className="pilot-voice text-3xl font-extrabold tracking-tight text-[#e8e6f2]">Media Library</h1>
          <p className="mt-2 text-sm leading-6 text-[#9490ac]">
            Central visual and sonic repository for Dark Misfit Studios. Filter with custom CSS presets (Vintage, Noir, Cyberpunk), search prompt archives, and export single or bulk ZIP files.
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-mono font-medium uppercase tracking-[0.14em]">
            <span className="rounded-full border border-[#00ffa3]/30 bg-[#00ffa3]/10 px-2.5 py-1 text-[#00ffa3]">Artwork</span>
            <span className="rounded-full border border-[#00f2fe]/30 bg-[#00f2fe]/10 px-2.5 py-1 text-[#00f2fe]">Video</span>
            <span className="rounded-full border border-[#e879f9]/30 bg-[#e879f9]/10 px-2.5 py-1 text-[#e879f9]">Music</span>
            <span className="rounded-full border border-[#ffb84d]/30 bg-[#ffb84d]/10 px-2.5 py-1 text-[#ffb84d]">Presets Active</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            ref={fileInput}
            type="file"
            multiple
            accept="image/*,video/*,audio/*"
            disabled={uploading || signedIn === false}
            onChange={(event) => void handleFiles(event.target.files)}
            className="hidden"
            aria-label="Add media files to your library"
          />
          <button
            type="button"
            disabled={uploading || signedIn === false}
            onClick={() => fileInput.current?.click()}
            className="flex items-center gap-1.5 rounded-xl border border-[#00ffa3]/40 bg-[#00ffa3]/15 px-3.5 py-2 font-mono text-xs font-bold text-[#00ffa3] shadow-[0_0_15px_rgba(0,255,163,0.2)] transition hover:bg-[#00ffa3]/25 disabled:opacity-40"
          >
            <Upload className="h-3.5 w-3.5" />
            <span>{uploading ? "Uploading…" : "Upload Media"}</span>
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => void refresh()}
            className="flex items-center gap-1 rounded-xl border border-[#35255e] bg-[#16112c] px-3 py-2 font-mono text-xs text-[#9490ac] transition hover:border-[#00ffa3] hover:text-[#00ffa3] disabled:opacity-40"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin text-[#00ffa3]" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>
      </header>

      {/* Notifications & Warnings */}
      {signedIn === false && (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2 text-xs font-medium text-amber-300">
          Sign in to access your media library and encrypted creative archive.
        </p>
      )}
      {error && !isProviderSystemWarning(error) && (
        <p role="alert" className="rounded-xl border border-[#fda4af]/30 bg-[#fda4af]/10 px-3.5 py-2 text-xs text-[#fda4af]">{error}</p>
      )}
      {notice && (
        <p className="rounded-xl border border-[#00ffa3]/30 bg-[#00ffa3]/10 px-3.5 py-2 font-mono text-xs text-[#00ffa3]">{notice}</p>
      )}

      {canManageProviders && needsProviderReview && (
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-[#14121f] px-4 py-3" role="status">
          <p className="text-xs text-ash">Provider configuration needs review. Detailed quota and credential status is restricted to the Admin control center.</p>
          <a href="/admin" className="rounded-md border border-amber-400/40 px-3 py-2 text-xs font-semibold text-amber-100 transition hover:bg-amber-400/10">
            Open Admin control center
          </a>
        </section>
      )}

      {/* =====================================================================
          SEARCH BAR & MEDIA CONTROLS DECK
      ===================================================================== */}
      <section className="space-y-3.5 rounded-2xl border border-[#35255e] bg-[#140e28] p-4 shadow-[0_12px_36px_rgba(0,0,0,0.5)]">
        {/* Row 1: Search Bar with Clear Button */}
        <div className="relative flex items-center">
          <div className="pointer-events-none absolute left-3.5 flex items-center text-[#00ffa3]">
            <Search className="h-4 w-4" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search assets by prompt, filename, or source (e.g., 'noir', 'upload', 'cinematic', 'portrait')..."
            className="w-full rounded-xl border border-[#35255e] bg-[#0c0817] py-2.5 pl-10 pr-10 font-mono text-xs text-[#e8e6f2] outline-none transition placeholder:text-[#5e5879] focus:border-[#00ffa3] focus:shadow-[0_0_15px_rgba(0,255,163,0.2)]"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-3 rounded-md p-1 text-[#9490ac] transition hover:bg-[#261947] hover:text-[#e8e6f2]"
              title="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Row 2: CSS Preset Filter Selector Bar */}
        <div className="flex flex-col gap-2 rounded-xl border border-[#261a45] bg-[#0f0b1f] p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-3.5 w-3.5 text-[#00ffa3]" />
              <span className="font-mono text-xs font-bold uppercase tracking-wider text-[#e8e6f2]">
                CSS Filter Presets
              </span>
              <span className="rounded bg-[#21163d] px-2 py-0.5 font-mono text-[10px] text-[#00ffa3]">
                {PRESET_FILTERS.find((f) => f.id === globalFilter)?.label} ACTIVE
              </span>
            </div>
            <p className="font-mono text-[10px] text-[#9490ac]">
              Live visual grading applied across all preview surfaces
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            {PRESET_FILTERS.map((preset) => {
              const isActive = globalFilter === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setGlobalFilter(preset.id)}
                  className={`group flex items-center gap-1.5 rounded-lg border px-3 py-1.5 font-mono text-xs font-semibold transition-all ${
                    isActive
                      ? "border-[#00ffa3] bg-[#00ffa3]/15 text-[#00ffa3] shadow-[0_0_12px_rgba(0,255,163,0.25)]"
                      : "border-[#35255e] bg-[#16112c] text-[#9490ac] hover:border-[#00ffa3]/50 hover:text-[#e8e6f2]"
                  }`}
                  title={preset.description}
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: preset.badgeColor }}
                  />
                  <span>{preset.label}</span>
                  {isActive && <Check className="h-3 w-3 text-[#00ffa3]" />}
                </button>
              );
            })}

            {globalFilter !== "none" && (
              <button
                type="button"
                onClick={() => setGlobalFilter("none")}
                className="ml-auto font-mono text-[10px] text-[#9490ac] hover:text-[#00ffa3] hover:underline"
              >
                Reset to Normal
              </button>
            )}
          </div>
        </div>

        {/* Row 3: Tabs & Batch Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          {/* Kind Tabs */}
          <div className="flex flex-wrap gap-1.5 font-mono text-xs">
            {(["all", "image", "video", "audio"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`rounded-lg px-3 py-1.5 font-bold uppercase transition ${
                  tab === t
                    ? "border border-[#00ffa3] bg-[#00ffa3]/20 text-[#00ffa3] shadow-[0_0_10px_rgba(0,255,163,0.2)]"
                    : "border border-[#35255e] bg-[#100b21] text-[#9490ac] hover:text-[#e8e6f2]"
                }`}
              >
                {t === "image" ? "Artwork" : t}
              </button>
            ))}
          </div>

          {/* Selection & ZIP Export */}
          <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
            <span className="text-[11px] text-[#9490ac]">
              {filtered.length} showing · {selectionCount} selected
            </span>
            <button
              type="button"
              onClick={toggleSelectAll}
              disabled={filtered.length === 0}
              className="rounded-lg border border-[#35255e] bg-[#16112c] px-3 py-1.5 text-xs text-[#9490ac] transition hover:border-[#00ffa3] hover:text-[#e8e6f2] disabled:opacity-40"
            >
              {allSelected ? "Deselect All" : "Select All"}
            </button>
            <button
              type="button"
              onClick={() => void downloadSelectedZip()}
              disabled={zipBusy || selectionCount === 0}
              className="flex items-center gap-1.5 rounded-lg border border-[#00ffa3]/40 bg-[#00ffa3]/10 px-3 py-1.5 text-xs font-bold text-[#00ffa3] transition hover:bg-[#00ffa3]/20 disabled:opacity-40"
            >
              <FileArchive className="h-3.5 w-3.5" />
              <span>{zipBusy ? "Zipping…" : "Export .ZIP"}</span>
            </button>
          </div>
        </div>
      </section>

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center gap-2 py-10 font-mono text-xs text-[#00ffa3]">
          <RefreshCw className="h-4 w-4 animate-spin" />
          <span>Scanning vault for creative media...</span>
        </div>
      )}

      {/* Empty States */}
      {!loading && !error && filtered.length === 0 && (
        <div className="rounded-2xl border border-dashed border-[#35255e] bg-[#120d24] p-8 text-center">
          <p className="font-mono text-sm text-[#e8e6f2]">
            {searchQuery
              ? `No media found matching "${searchQuery}".`
              : "No media assets in the library yet."}
          </p>
          <p className="mt-1 font-mono text-xs text-[#9490ac]">
            {searchQuery
              ? "Try adjusting your query by prompt, file type, or creator source."
              : "Synthesize artwork, music, or video in the studios to populate your vault."}
          </p>
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="mt-3 rounded-lg border border-[#00ffa3]/40 bg-[#00ffa3]/10 px-3 py-1.5 font-mono text-xs font-bold text-[#00ffa3] hover:bg-[#00ffa3]/20"
            >
              Clear Search Query
            </button>
          )}
        </div>
      )}

      {/* =====================================================================
          MEDIA ASSET GRID (WITH LIVE CSS FILTERS)
      ===================================================================== */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((asset) => {
          const url = urls[asset.storage_path];
          const itemFilter = itemFilters[asset.id] ?? globalFilter;
          const filterCss = getFilterCss(itemFilter);

          return (
            <div
              key={asset.id}
              className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-[#35255e] bg-[#140e28] p-3.5 shadow-[0_8px_24px_rgba(0,0,0,0.5)] transition hover:border-[#00ffa3]/60 hover:shadow-[0_12px_32px_rgba(0,255,163,0.12)]"
            >
              {/* Card Header: Type Badge & Selection Checkbox */}
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="rounded bg-[#21163d] px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-[#00ffa3]">
                    {KIND_LABEL[asset.kind]}
                  </span>
                  {itemFilter !== "none" && (
                    <span className="rounded bg-[#00ffa3]/15 border border-[#00ffa3]/30 px-1.5 py-0.5 font-mono text-[9px] font-bold text-[#00ffa3]">
                      {itemFilter.toUpperCase()}
                    </span>
                  )}
                </div>

                <label className="flex cursor-pointer items-center gap-1.5 font-mono text-[11px] text-[#9490ac] hover:text-[#e8e6f2]">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(asset.id)}
                    onChange={() => toggleSelection(asset.id)}
                    className="h-3.5 w-3.5 cursor-pointer accent-[#00ffa3]"
                  />
                  <span>Select</span>
                </label>
              </div>

              {/* Media Thumbnail Container with CSS Filter Applied */}
              <button
                type="button"
                onClick={() => openPreview(asset)}
                className="relative mb-2.5 h-44 w-full overflow-hidden rounded-xl border border-[#261a45] bg-[#000000] focus:outline-none focus:ring-2 focus:ring-[#00ffa3]"
                aria-label={`Preview ${asset.prompt ?? asset.storage_path}`}
              >
                {asset.kind === "image" && url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={url}
                    alt={asset.prompt ?? asset.id}
                    className="h-full w-full object-cover transition-all duration-300 group-hover:scale-105"
                    style={{ filter: filterCss }}
                  />
                ) : asset.kind === "video" && url ? (
                  <video
                    src={url}
                    muted
                    loop
                    playsInline
                    className="h-full w-full object-cover transition-all duration-300"
                    style={{ filter: filterCss }}
                    onMouseEnter={(e) => void e.currentTarget.play().catch(() => undefined)}
                    onMouseLeave={(e) => {
                      e.currentTarget.pause();
                      e.currentTarget.currentTime = 0;
                    }}
                  />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 bg-gradient-to-br from-[#1b1435] to-[#0c0917] text-3xl">
                    <span>{KIND_ICON[asset.kind]}</span>
                    <span className="font-mono text-[10px] text-[#9490ac]">Click to listen</span>
                  </div>
                )}

                {/* Hover overlay hint */}
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                  <span className="rounded-lg border border-[#00ffa3] bg-[#000000]/85 px-2.5 py-1 font-mono text-[10px] font-bold text-[#00ffa3]">
                    Click to Open Viewport ↗
                  </span>
                </div>
              </button>

              {/* Title & Prompt Details */}
              <div className="space-y-1">
                <p className="truncate font-mono text-xs font-bold text-[#e8e6f2]">
                  {asset.prompt || asset.storage_path.split("/").pop() || asset.id.slice(0, 8)}
                </p>
                <div className="flex items-center justify-between font-mono text-[10px] text-[#9490ac]">
                  <span className="capitalize text-[#00ffa3]">
                    {asset.source ? `Source: ${asset.source}` : "Direct Upload"}
                  </span>
                  <span>{new Date(asset.created_at).toLocaleDateString()}</span>
                </div>
              </div>

              {/* Per-Card Quick Preset Filter Selector */}
              <div className="mt-2.5 flex items-center justify-between gap-1 border-t border-[#261a45] pt-2">
                <span className="font-mono text-[9px] uppercase tracking-wider text-[#9490ac]">Style:</span>
                <div className="flex gap-1 overflow-x-auto">
                  {(["none", "vintage", "noir", "cyberpunk"] as const).map((fid) => (
                    <button
                      key={fid}
                      type="button"
                      onClick={() =>
                        setItemFilters((prev) => ({
                          ...prev,
                          [asset.id]: fid,
                        }))
                      }
                      className={`rounded px-1.5 py-0.5 font-mono text-[9px] uppercase transition ${
                        itemFilter === fid
                          ? "border border-[#00ffa3] bg-[#00ffa3]/20 font-bold text-[#00ffa3]"
                          : "border border-[#261a45] bg-[#120d24] text-[#9490ac] hover:text-[#e8e6f2]"
                      }`}
                    >
                      {fid === "none" ? "Norm" : fid.slice(0, 4)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Actions Footer */}
              <div className="mt-2.5 flex gap-2 font-mono text-xs">
                <button
                  type="button"
                  onClick={() => void downloadAsset(asset, itemFilter)}
                  className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-[#35255e] bg-[#16112c] py-1.5 text-[11px] font-semibold text-[#e8e6f2] transition hover:border-[#00ffa3] hover:text-[#00ffa3]"
                >
                  <Download className="h-3 w-3" />
                  <span>Download</span>
                </button>
                <button
                  type="button"
                  onClick={() => void removeAsset(asset)}
                  className="rounded-lg border border-[#fda4af]/30 px-2.5 py-1.5 text-[11px] text-[#fda4af] transition hover:bg-[#fda4af]/10"
                  title="Delete from vault"
                >
                  Delete
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* =====================================================================
          FULL-SCREEN PREVIEW MODAL (WITH INTERACTIVE CSS FILTER TOGGLES)
      ===================================================================== */}
      {previewAsset && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-4 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
          aria-label="Media preview"
          onClick={() => setPreviewAsset(null)}
        >
          <div
            className="flex max-h-[92vh] w-full max-w-4xl flex-col gap-3.5 overflow-hidden rounded-2xl border border-[#35255e] bg-[#140e28] p-4 sm:p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between gap-3 border-b border-[#261a45] pb-3">
              <div>
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#00ffa3]">
                  {previewAsset.kind.toUpperCase()} VIEWPORT · {modalFilter.toUpperCase()}
                </span>
                <h2 className="truncate font-mono text-sm font-bold text-[#e8e6f2]">
                  {previewAsset.prompt || previewAsset.storage_path.split("/").pop()}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setPreviewAsset(null)}
                className="rounded-lg border border-[#35255e] bg-[#1a1336] px-3 py-1 font-mono text-xs font-bold text-[#9490ac] transition hover:border-[#00ffa3] hover:text-[#00ffa3]"
              >
                Close ✕
              </button>
            </div>

            {/* Modal CSS Filter Adjustment Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#261a45] bg-[#0c0817] p-2.5">
              <div className="flex items-center gap-1.5 font-mono text-xs text-[#00ffa3]">
                <Filter className="h-3.5 w-3.5" />
                <span className="font-bold">Adjust Filter Grade:</span>
              </div>
              <div className="flex flex-wrap gap-1 font-mono text-[10px]">
                {PRESET_FILTERS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setModalFilter(f.id)}
                    className={`rounded-md border px-2.5 py-1 font-bold uppercase transition ${
                      modalFilter === f.id
                        ? "border-[#00ffa3] bg-[#00ffa3]/20 text-[#00ffa3] shadow-[0_0_8px_#00ffa3]"
                        : "border-[#35255e] bg-[#16112c] text-[#9490ac] hover:text-[#e8e6f2]"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Media Rendering Canvas / Tag */}
            <div className="relative flex max-h-[58vh] min-h-[240px] items-center justify-center overflow-hidden rounded-xl border border-[#261a45] bg-[#000000] p-2">
              {urls[previewAsset.storage_path] ? (
                previewAsset.kind === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={urls[previewAsset.storage_path]}
                    alt={previewAsset.prompt ?? "media preview"}
                    className="max-h-[54vh] w-auto max-w-full rounded-lg object-contain transition-all duration-300"
                    style={{ filter: getFilterCss(modalFilter) }}
                  />
                ) : previewAsset.kind === "video" ? (
                  <video
                    src={urls[previewAsset.storage_path]}
                    controls
                    autoPlay
                    loop
                    className="max-h-[54vh] w-auto max-w-full rounded-lg transition-all duration-300"
                    style={{ filter: getFilterCss(modalFilter) }}
                  />
                ) : (
                  <div className="w-full space-y-4 p-8 text-center">
                    <span className="text-5xl">{KIND_ICON[previewAsset.kind]}</span>
                    <audio
                      src={urls[previewAsset.storage_path]}
                      controls
                      autoPlay
                      className="w-full max-w-md mx-auto"
                    />
                  </div>
                )
              ) : (
                <p className="font-mono text-xs text-[#9490ac]">Preview link unavailable. Refresh and try again.</p>
              )}
            </div>

            {/* Modal Footer Controls */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#261a45] pt-3 font-mono text-xs">
              <span className="text-[11px] text-[#9490ac]">
                Active CSS: <code className="text-[#00ffa3]">{getFilterCss(modalFilter)}</code>
              </span>

              <div className="flex gap-2">
                {previewAsset.kind === "image" && modalFilter !== "none" && (
                  <button
                    type="button"
                    disabled={filteredDownloading}
                    onClick={() => void downloadAsset(previewAsset, modalFilter)}
                    className="flex items-center gap-1.5 rounded-xl border border-[#00ffa3] bg-[#00ffa3]/20 px-3 py-1.5 font-bold text-[#00ffa3] shadow-[0_0_12px_rgba(0,255,163,0.3)] hover:bg-[#00ffa3]/30"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>{filteredDownloading ? "Baking Filter..." : `Download with ${modalFilter.toUpperCase()}`}</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => void downloadAsset(previewAsset)}
                  className="flex items-center gap-1.5 rounded-xl border border-[#35255e] bg-[#16112c] px-3 py-1.5 font-bold text-[#e8e6f2] hover:border-[#00ffa3] hover:text-[#00ffa3]"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Download Original</span>
                </button>

                <button
                  type="button"
                  onClick={() => void removeAsset(previewAsset)}
                  className="rounded-xl border border-[#fda4af]/30 bg-[#fda4af]/10 px-3 py-1.5 text-[#fda4af] hover:bg-[#fda4af]/20"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
