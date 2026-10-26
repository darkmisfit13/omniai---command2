export type TrackKind = "video" | "overlay" | "text" | "audio";
export type MediaKind = "video" | "image" | "audio" | "text";
export type Transition = "cut" | "fade" | "zoom" | "slide" | "flash" | "blur";
export type Effect = "none" | "bw" | "warm" | "cool" | "vivid" | "vhs" | "dream";

export type TextStyle = {
  fontFamily: string;
  fontSize: number;
  color: string;
  align: "left" | "center" | "right";
  bold: boolean;
  italic: boolean;
};

export type EditorItem = {
  id: string;
  kind: MediaKind;
  assetId?: string;
  name: string;
  start: number;
  length: number;
  sourceIn: number;
  speed: number;
  volume: number;
  opacity: number;
  effect: Effect;
  transition: Transition;
  text?: string;
  textStyle?: TextStyle;
};

export type EditorTrack = {
  id: string;
  kind: TrackKind;
  name: string;
  muted: boolean;
  locked: boolean;
  hidden: boolean;
  items: EditorItem[];
};

export type EditorProject = {
  version: 1;
  name: string;
  aspect: "16:9" | "9:16" | "1:1";
  tracks: EditorTrack[];
  markers: number[];
  updatedAt: string;
};

export const MAX_PROJECT_NAME = 120;
export const MAX_PROJECT_JSON_BYTES = 1_000_000;
export const MAX_TRACKS = 32;
export const MAX_ITEMS_PER_TRACK = 500;
export const MAX_TIMELINE_SECONDS = 60 * 60 * 4;

export function newId(): string {
  return globalThis.crypto?.randomUUID?.() ??
    `item-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function blankProject(name = "Untitled project"): EditorProject {
  return {
    version: 1,
    name: cleanProjectName(name),
    aspect: "16:9",
    tracks: [
      { id: newId(), kind: "video", name: "Video 1", muted: false, locked: false, hidden: false, items: [] },
      { id: newId(), kind: "overlay", name: "Overlay 1", muted: false, locked: false, hidden: false, items: [] },
      { id: newId(), kind: "text", name: "Text 1", muted: false, locked: false, hidden: false, items: [] },
      { id: newId(), kind: "audio", name: "Audio 1", muted: false, locked: false, hidden: false, items: [] },
    ],
    markers: [],
    updatedAt: new Date().toISOString(),
  };
}

export function cleanProjectName(value: unknown): string {
  if (typeof value !== "string") return "Untitled project";
  const cleaned = value.trim().replace(/[\u0000-\u001f]/g, "").slice(0, MAX_PROJECT_NAME);
  return cleaned || "Untitled project";
}

export function trackAccepts(track: EditorTrack, item: EditorItem): boolean {
  if (track.locked) return false;
  if (track.kind === "audio") return item.kind === "audio";
  if (track.kind === "text") return item.kind === "text";
  if (track.kind === "overlay") return item.kind === "image" || item.kind === "video";
  return item.kind === "image" || item.kind === "video";
}

export function duration(project: EditorProject): number {
  return Math.max(0, ...project.tracks.flatMap((track) =>
    track.items.map((item) => item.start + item.length)
  ));
}

export function trackEnd(track: EditorTrack): number {
  return Math.max(0, ...track.items.map((item) => item.start + item.length));
}

export function makeItem(kind: MediaKind, name: string, start = 0, length = 5): EditorItem {
  return {
    id: newId(),
    kind,
    name: name.slice(0, 200),
    start: Math.max(0, start),
    length: Math.max(0.05, length),
    sourceIn: 0,
    speed: 1,
    volume: 1,
    opacity: 1,
    effect: "none",
    transition: "cut",
  };
}

export function splitItem(item: EditorItem, at: number): [EditorItem, EditorItem] | null {
  const relative = at - item.start;
  if (relative < 0.05 || relative > item.length - 0.05) return null;

  return [
    { ...item, length: relative },
    {
      ...item,
      id: newId(),
      start: at,
      length: item.length - relative,
      sourceIn: item.sourceIn + relative * item.speed,
    },
  ];
}

export function parseProject(input: unknown): EditorProject | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const raw = input as Record<string, unknown>;
  if (raw.version !== 1 || !Array.isArray(raw.tracks) || raw.tracks.length > MAX_TRACKS) return null;
  if (typeof raw.name !== "string" || raw.name.length > MAX_PROJECT_NAME) return null;
  if (raw.aspect !== "16:9" && raw.aspect !== "9:16" && raw.aspect !== "1:1") return null;
  if (raw.tracks.length === 0) return null;

  const trackKinds: TrackKind[] = ["video", "overlay", "text", "audio"];
  const mediaKinds: MediaKind[] = ["video", "image", "audio", "text"];
  const effects: Effect[] = ["none", "bw", "warm", "cool", "vivid", "vhs", "dream"];
  const transitions: Transition[] = ["cut", "fade", "zoom", "slide", "flash", "blur"];
  const ids = new Set<string>();
  let totalItems = 0;

  for (const candidate of raw.tracks) {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return null;
    const track = candidate as Record<string, unknown>;
    if (typeof track.id !== "string" || !track.id || ids.has(track.id)) return null;
    ids.add(track.id);
    if (!trackKinds.includes(track.kind as TrackKind)) return null;
    if (typeof track.name !== "string" || track.name.length > 120) return null;
    if (typeof track.muted !== "boolean" || typeof track.locked !== "boolean" || typeof track.hidden !== "boolean") return null;
    if (!Array.isArray(track.items) || track.items.length > MAX_ITEMS_PER_TRACK) return null;

    for (const candidateItem of track.items) {
      totalItems++;
      if (totalItems > MAX_TRACKS * MAX_ITEMS_PER_TRACK) return null;
      if (!candidateItem || typeof candidateItem !== "object" || Array.isArray(candidateItem)) return null;
      const item = candidateItem as Record<string, unknown>;
      if (typeof item.id !== "string" || !item.id || ids.has(item.id)) return null;
      ids.add(item.id);
      if (!mediaKinds.includes(item.kind as MediaKind)) return null;
      if (typeof item.name !== "string" || item.name.length > 200) return null;
      for (const key of ["start", "length", "sourceIn", "speed", "volume", "opacity"] as const) {
        if (typeof item[key] !== "number" || !Number.isFinite(item[key] as number)) return null;
      }
      if ((item.start as number) < 0 || (item.length as number) <= 0 ||
          (item.start as number) + (item.length as number) > MAX_TIMELINE_SECONDS ||
          (item.sourceIn as number) < 0 || (item.speed as number) <= 0 ||
          (item.speed as number) > 16 || (item.volume as number) < 0 ||
          (item.volume as number) > 4 || (item.opacity as number) < 0 ||
          (item.opacity as number) > 1) return null;
      if (!effects.includes(item.effect as Effect) || !transitions.includes(item.transition as Transition)) return null;
      if (item.assetId !== undefined && (typeof item.assetId !== "string" || item.assetId.length > 200)) return null;
      if (item.text !== undefined && (typeof item.text !== "string" || item.text.length > 20_000)) return null;
      if (item.textStyle !== undefined) {
        if (!item.textStyle || typeof item.textStyle !== "object" || Array.isArray(item.textStyle)) return null;
        const style = item.textStyle as Record<string, unknown>;
        if (typeof style.fontFamily !== "string" || style.fontFamily.length > 100 ||
            typeof style.fontSize !== "number" || !Number.isFinite(style.fontSize) ||
            style.fontSize < 6 || style.fontSize > 300 ||
            typeof style.color !== "string" || style.color.length > 40 ||
            !["left", "center", "right"].includes(String(style.align)) ||
            typeof style.bold !== "boolean" || typeof style.italic !== "boolean") return null;
      }
    }
  }

  if (!Array.isArray(raw.markers) || raw.markers.length > 2000 ||
      raw.markers.some((m) => typeof m !== "number" || !Number.isFinite(m) || m < 0 || m > MAX_TIMELINE_SECONDS)) return null;
  if (typeof raw.updatedAt !== "string" || raw.updatedAt.length > 50) return null;

  return {
    version: 1,
    name: cleanProjectName(raw.name),
    aspect: raw.aspect,
    tracks: raw.tracks as EditorTrack[],
    markers: raw.markers as number[],
    updatedAt: raw.updatedAt,
  };
}

export function projectJsonBytes(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}
