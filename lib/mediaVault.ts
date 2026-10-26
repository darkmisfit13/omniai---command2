"use client";

export type VaultType = "image" | "audio" | "video" | "musicvideo" | "beat" | "project";
export interface VaultMeta {
  prompt?: string;
  resolution?: string;
  bpm?: number;
  sampleRate?: number;
  seed?: number;
  duration?: string;
  motion?: string;
  model?: string;
  source?: string;
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
  audio: "#e879f9",
  video: "#00f2fe",
  musicvideo: "#6c63ff",
  beat: "#6ee7b7",
  project: "#fcd34d",
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
      id: asset.id ?? crypto.randomUUID(),
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

import { useSyncExternalStore } from "react";
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
