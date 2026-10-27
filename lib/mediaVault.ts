"use client";

import { useSyncExternalStore } from "react";

export type VaultType = "image" | "audio" | "video" | "musicvideo" | "beat" | "project";
export interface VaultMeta {
  prompt?: string;
  resolution?: string;
  bpm?: number;
  sampleRate?: number;
  seed?: number;
  duration?: string | number;
  motion?: string;
  model?: string;
  source?: string;
  isStemExport?: boolean;
  stemsCount?: number;
  keySignature?: string;
  [key: string]: unknown;
}

export interface VaultAsset {
  id: string;
  type: VaultType;
  name: string;
  url: string;
  meta: VaultMeta;
  createdAt: number;
}

const TYPE_COLOR: Record<VaultType, string> = {
  image: "#a69eff",
  audio: "#00ffff", // Baby Blue for audio stems & tracks
  video: "#00ffff",
  musicvideo: "#0C00CA",
  beat: "#00ffff",
  project: "#3d2cf5",
};
export const vaultColor = (t: VaultType) => TYPE_COLOR[t];

let assets: VaultAsset[] = [];
const subs = new Set<(a: VaultAsset[]) => void>();

function emit() { for (const cb of subs) cb(assets); }

export const mediaVault = {
  subscribe: (cb: (a: VaultAsset[]) => void) => { subs.add(cb); cb(assets); return () => subs.delete(cb); },
  list: () => assets,
  push: (asset: Omit<VaultAsset, "id" | "createdAt"> & { id?: string; createdAt?: number }) => {
    const a: VaultAsset = {
      id: asset.id ?? (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `vault-${Date.now()}`),
      createdAt: asset.createdAt ?? Date.now(),
      type: asset.type,
      name: asset.name,
      url: asset.url,
      meta: asset.meta ?? {},
    };
    assets = [a, ...assets];
    emit();
    return a;
  },
  remove: (id: string) => { assets = assets.filter(a => a.id !== id); emit(); },
  clear: () => { assets = []; emit(); },
};

/**
 * Unified Audio Stem Bridge Mechanism:
 * Bridges Music Studio exports directly with Video Studio Timeline as multi-track audio stems.
 */
export interface ExportedAudioStemPayload {
  id: string;
  title: string;
  bpm: number;
  keySignature?: string;
  duration: number; // in seconds
  url?: string;
  tracks?: Array<{ id: string; name: string; type: string; volume?: number }>;
  timestamp: number;
}

export const audioStemBridge = {
  /**
   * Export audio tracks or stems from Music Studio into the unified state repository
   */
  exportStemToVideoStudio: (payload: {
    title: string;
    bpm: number;
    keySignature?: string;
    duration?: number;
    url?: string;
    tracks?: Array<{ id: string; name: string; type: string; volume?: number }>;
  }): VaultAsset => {
    const assetId = `stem-${Date.now()}`;
    const cleanDuration = payload.duration && payload.duration > 0 ? payload.duration : 60;
    
    // 1. Push to mediaVault
    const asset = mediaVault.push({
      id: assetId,
      type: "audio",
      name: payload.title,
      url: payload.url || "/stems/master_stem.wav",
      meta: {
        source: "Music Studio Stem Export",
        bpm: payload.bpm,
        keySignature: payload.keySignature,
        duration: cleanDuration,
        isStemExport: true,
        stemsCount: payload.tracks?.length || 4,
      },
    });

    // 2. Broadcast via window event & persist to localStorage for cross-route sync
    if (typeof window !== "undefined") {
      const bridgeData: ExportedAudioStemPayload = {
        id: asset.id,
        title: payload.title,
        bpm: payload.bpm,
        keySignature: payload.keySignature,
        duration: cleanDuration,
        url: payload.url || "/stems/master_stem.wav",
        tracks: payload.tracks,
        timestamp: Date.now(),
      };
      
      try {
        localStorage.setItem("omniai_video_imported_stem", JSON.stringify(bridgeData));
        // Also keep a history list of exported stems
        const existingRaw = localStorage.getItem("omniai_stems_vault_history");
        const list = existingRaw ? JSON.parse(existingRaw) : [];
        localStorage.setItem("omniai_stems_vault_history", JSON.stringify([bridgeData, ...list].slice(0, 15)));
      } catch (e) {
        console.warn("Storage sync fallback:", e);
      }

      window.dispatchEvent(new CustomEvent("omniai_audio_stem_exported", { detail: bridgeData }));
    }

    return asset;
  },

  /**
   * Check for any freshly exported audio stem to import into Video Studio
   */
  getPendingImportedStem: (): ExportedAudioStemPayload | null => {
    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem("omniai_video_imported_stem");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },

  /**
   * Retrieve all exported stems
   */
  getExportedStemsHistory: (): ExportedAudioStemPayload[] => {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem("omniai_stems_vault_history");
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  /**
   * Clear the active pending import flag after mounting to Timeline
   */
  consumePendingStem: () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("omniai_video_imported_stem");
    }
  },
};

export function useMediaVault() {
  return useSyncExternalStore(mediaVault.subscribe, mediaVault.list, () => []);
}

export function useMediaVaultType(type: VaultType) {
  return useMediaVault().filter(a => a.type === type);
}

// seed defaults lazily
export function seedVault() {
  if (assets.length > 0) return;
  const seed: Omit<VaultAsset, "id" | "createdAt">[] = [
    { type: "audio", name: "Suno track · neon_dust_01", url: "", meta: { prompt: "neon city synthwave, heavy sub bass", bpm: 138, sampleRate: 44100, duration: "2:42", source: "Suno" } },
    { type: "image", name: "Krea · midnightportrait_7", url: "", meta: { prompt: "cinematic portrait under neon rain", resolution: "2048×1280", seed: 421983, model: "FLUX.1" } },
    { type: "video", name: "MV clip · skyline_drone", url: "", meta: { prompt: "cinematic drone push-in over neon city", resolution: "1080p", duration: "0:08", motion: "Orbit" } },
    { type: "musicvideo", name: "Auto-MV · chorus_bounce", url: "", meta: { prompt: "beat-synced viral onbeat effects", resolution: "1080p", bpm: 128 } },
    { type: "beat", name: "808 phonk pattern", url: "", meta: { bpm: 145, duration: "1:20", sampleRate: 48000 } },
    { type: "project", name: "Capsule · branding deck v2", url: "", meta: { prompt: "brand deck export", duration: "—" } },
  ];
  for (const a of seed) mediaVault.push(a);
}

export { TYPE_COLOR };
