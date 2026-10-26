"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import {
  blankProject,
  cleanProjectName,
  duration,
  makeItem,
  newId,
  splitItem,
  trackAccepts,
  type EditorItem,
  type EditorProject,
  type EditorTrack,
  type Effect,
  type MediaKind,
  type TextStyle,
  type TrackKind,
  type Transition,
} from "@/lib/editor/engine";
import { supabase } from "@/lib/supabaseClient";
import { PromptEnhancer } from "@/app/hud/PromptEnhancer";

type LocalMedia = {
  id: string;
  name: string;
  kind: MediaKind;
  url: string;
  file: File;
};

type SavedProject = {
  id: string;
  title?: string;
  project_data?: EditorProject;
  project?: EditorProject;
  updated_at?: string;
};

const EFFECTS: Effect[] = [
  "none", "bw", "warm", "cool", "vivid", "vhs", "dream",
];

const TRANSITIONS: Transition[] = [
  "cut", "fade", "zoom", "slide", "flash", "blur",
];

const TRACK_COLORS: Record<TrackKind, string> = {
  video: "#7164df",
  overlay: "#3989a9",
  text: "#a65acb",
  audio: "#309c81",
};

const INITIAL_TEXT_STYLE: TextStyle = {
  fontFamily: "Arial",
  fontSize: 48,
  color: "#ffffff",
  align: "center",
  bold: true,
  italic: false,
};

function formatTime(value: number): string {
  const safe = Math.max(0, value);
  const minutes = Math.floor(safe / 60);
  const seconds = Math.floor(safe % 60);
  const frames = Math.floor((safe % 1) * 30);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}:${String(frames).padStart(2, "0")}`;
}

function formatDuration(value: number): string {
  return `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, "0")}`;
}

function effectCss(effect: Effect): string {
  switch (effect) {
    case "bw": return "grayscale(1)";
    case "warm": return "sepia(.35) saturate(1.25)";
    case "cool": return "hue-rotate(18deg) saturate(.85)";
    case "vivid": return "saturate(1.7) contrast(1.08)";
    case "vhs": return "saturate(.8) contrast(1.2)";
    case "dream": return "brightness(1.12) saturate(1.2) blur(.4px)";
    default: return "none";
  }
}

function kindFromFile(file: File): MediaKind | null {
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("audio/")) return "audio";
  return null;
}

function defaultTrackKind(kind: MediaKind): TrackKind {
  if (kind === "audio") return "audio";
  if (kind === "text") return "text";
  return "video";
}

function responseMessage(payload: unknown, fallback: string): string {
  if (payload && typeof payload === "object") {
    const data = payload as Record<string, unknown>;
    if (typeof data.error === "string") return data.error;
    if (typeof data.message === "string") return data.message;
  }
  return fallback;
}

export default function EditorPage() {
  const [project, setProject] = useState<EditorProject>(() => blankProject());
  const [projectId, setProjectId] = useState<string | null>(null);
  const [localMedia, setLocalMedia] = useState<LocalMedia[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  const [playhead, setPlayhead] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [zoom, setZoom] = useState(48);
  const [status, setStatus] = useState("Ready to edit");
  const [busy, setBusy] = useState(false);
  const [savedProjects, setSavedProjects] = useState<SavedProject[]>([]);
  const [chosenSavedProject, setChosenSavedProject] = useState("");
  const [textDraft, setTextDraft] = useState("Your title");
  const [showTextDialog, setShowTextDialog] = useState(false);
  const [showProjects, setShowProjects] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const timelineScrollRef = useRef<HTMLDivElement>(null);
  const historyRef = useRef<EditorProject[]>([]);
  const futureRef = useRef<EditorProject[]>([]);
  const previousProjectRef = useRef<EditorProject | null>(null);
  const suppressHistoryRef = useRef(false);
  const [historyVersion, setHistoryVersion] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const previous = previousProjectRef.current;
    if (suppressHistoryRef.current) {
      suppressHistoryRef.current = false;
    } else if (previous && JSON.stringify(previous) !== JSON.stringify(project)) {
      historyRef.current = [...historyRef.current, previous].slice(-100);
      futureRef.current = [];
    }
    previousProjectRef.current = project;
    setHistoryVersion((value) => value + 1);
  }, [project]);

  useEffect(() => {
    const scrollArea = timelineScrollRef.current;
    const ruler = timelineRef.current;
    if (!scrollArea || !ruler) return;
    const playheadX = 130 + playhead * zoom;
    const visibleLeft = scrollArea.scrollLeft;
    const visibleRight = visibleLeft + scrollArea.clientWidth;
    if (playheadX > visibleRight - 48) {
      scrollArea.scrollLeft = Math.max(0, playheadX - scrollArea.clientWidth + 80);
    } else if (playheadX < visibleLeft + 130) {
      scrollArea.scrollLeft = Math.max(0, playheadX - 150);
    }
  }, [playhead, zoom]);

  const canUndo = historyRef.current.length > 0;
  const canRedo = futureRef.current.length > 0;

  const undo = useCallback(() => {
    const previous = historyRef.current.pop();
    if (!previous) return;
    if (previousProjectRef.current) {
      futureRef.current.push(previousProjectRef.current);
    }
    suppressHistoryRef.current = true;
    previousProjectRef.current = previous;
    setProject(previous);
    setHistoryVersion((value) => value + 1);
    setStatus("Undo complete");
  }, []);

  const redo = useCallback(() => {
    const next = futureRef.current.pop();
    if (!next) return;
    if (previousProjectRef.current) {
      historyRef.current.push(previousProjectRef.current);
    }
    suppressHistoryRef.current = true;
    previousProjectRef.current = next;
    setProject(next);
    setHistoryVersion((value) => value + 1);
    setStatus("Redo complete");
  }, []);

  const totalDuration = useMemo(() => Math.max(10, duration(project)), [project]);

  const selected = useMemo(() => {
    for (const track of project.tracks) {
      const item = track.items.find((candidate) => candidate.id === selectedItemId);
      if (item) return { track, item };
    }
    return null;
  }, [project, selectedItemId]);

  const mediaById = useMemo(
    () => new Map(localMedia.map((asset) => [asset.id, asset])),
    [localMedia],
  );

  const activeVisual = useMemo(() => {
    for (const track of project.tracks) {
      if (track.hidden || track.kind === "audio") continue;
      const item = track.items.find(
        (candidate) =>
          playhead >= candidate.start &&
          playhead < candidate.start + candidate.length &&
          (candidate.kind === "video" || candidate.kind === "image" || candidate.kind === "text"),
      );
      if (item) return item;
    }
    return null;
  }, [project, playhead]);

  const patchItem = useCallback((itemId: string, patch: Partial<EditorItem>) => {
    setProject((current) => ({
      ...current,
      updatedAt: new Date().toISOString(),
      tracks: current.tracks.map((track) => ({
        ...track,
        items: track.items.map((item) =>
          item.id === itemId ? { ...item, ...patch } : item,
        ),
      })),
    }));
  }, []);

  const patchTrack = useCallback((trackId: string, patch: Partial<EditorTrack>) => {
    setProject((current) => ({
      ...current,
      updatedAt: new Date().toISOString(),
      tracks: current.tracks.map((track) =>
        track.id === trackId ? { ...track, ...patch } : track,
      ),
    }));
  }, []);

  useEffect(() => {
    return () => {
      for (const asset of localMedia) URL.revokeObjectURL(asset.url);
    };
    // Cleanup the object URLs when the page is unmounted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      setPlayhead((current) => {
        const next = current + 0.1;
        if (next >= totalDuration) {
          setPlaying(false);
          return 0;
        }
        return next;
      });
    }, 100);
    return () => window.clearInterval(timer);
  }, [playing, totalDuration]);

  useEffect(() => {
    if (videoRef.current && activeVisual?.kind === "video") {
      const asset = activeVisual.assetId ? mediaById.get(activeVisual.assetId) : undefined;
      if (asset && videoRef.current.src !== asset.url) {
        videoRef.current.src = asset.url;
      }
      if (asset) {
        const desiredTime = activeVisual.sourceIn +
          Math.max(0, playhead - activeVisual.start) * activeVisual.speed;
        if (Number.isFinite(desiredTime) &&
            Math.abs(videoRef.current.currentTime - desiredTime) > 0.75) {
          try {
            videoRef.current.currentTime = desiredTime;
          } catch {
            // The browser may not have loaded enough media to seek yet.
          }
        }
        if (playing) {
          void videoRef.current.play().catch(() => undefined);
        } else {
          videoRef.current.pause();
        }
      }
    } else if (videoRef.current) {
      videoRef.current.pause();
    }

    if (audioRef.current) {
      const audioTrack = project.tracks.find((track) => track.kind === "audio" && !track.muted);
      const audioItem = audioTrack?.items.find(
        (item) => playhead >= item.start && playhead < item.start + item.length,
      );
      const audioAsset = audioItem?.assetId ? mediaById.get(audioItem.assetId) : undefined;
      if (audioItem && audioAsset) {
        if (audioRef.current.src !== audioAsset.url) audioRef.current.src = audioAsset.url;
        audioRef.current.volume = Math.max(0, Math.min(1, audioItem.volume));
        const desiredTime = audioItem.sourceIn +
          Math.max(0, playhead - audioItem.start) * audioItem.speed;
        if (Math.abs(audioRef.current.currentTime - desiredTime) > 0.8) {
          try {
            audioRef.current.currentTime = desiredTime;
          } catch {
            // Wait for media metadata.
          }
        }
        if (playing) void audioRef.current.play().catch(() => undefined);
        else audioRef.current.pause();
      } else {
        audioRef.current.pause();
      }
    }
  }, [activeVisual, localMedia, mediaById, playhead, playing, project.tracks]);

  function updateProjectName(name: string) {
    setProject((current) => ({
      ...current,
      name: cleanProjectName(name),
      updatedAt: new Date().toISOString(),
    }));
  }

  function updateAspect(aspect: EditorProject["aspect"]) {
    setProject((current) => ({ ...current, aspect, updatedAt: new Date().toISOString() }));
  }

  function addTrack(kind: TrackKind) {
    if (project.tracks.length >= 32) {
      setStatus("Maximum of 32 tracks reached.");
      return;
    }
    const count = project.tracks.filter((track) => track.kind === kind).length + 1;
    const track: EditorTrack = {
      id: newId(),
      kind,
      name: `${kind[0].toUpperCase()}${kind.slice(1)} ${count}`,
      muted: false,
      locked: false,
      hidden: false,
      items: [],
    };
    setProject((current) => ({
      ...current,
      tracks: [...current.tracks, track],
      updatedAt: new Date().toISOString(),
    }));
    setSelectedTrackId(track.id);
    setStatus(`${track.name} added`);
  }

  function removeTrack(trackId: string) {
    const target = project.tracks.find((track) => track.id === trackId);
    if (!target) return;

    if (project.tracks.length <= 1) {
      setStatus("Keep at least one track in the project.");
      return;
    }

    if (target.items.length > 0 &&
        !window.confirm(`Remove "${target.name}" and its ${target.items.length} clip(s)?`)) {
      return;
    }

    setProject((current) => ({
      ...current,
      tracks: current.tracks.filter((track) => track.id !== trackId),
      updatedAt: new Date().toISOString(),
    }));

    if (selected?.track.id === trackId) setSelectedItemId(null);
    if (selectedTrackId === trackId) setSelectedTrackId(null);
    setStatus(`${target.name} removed`);
  }

  function cycleSelectedEffect() {
    if (!selected) {
      setStatus("Select a clip before applying an effect.");
      return;
    }
    if (selected.track.locked) {
      setStatus("Unlock the selected track before editing its clip.");
      return;
    }

    const effects = ["none", "bw", "warm", "cool", "vivid", "vhs", "dream"] as const;
    const currentEffect = selected.item.effect ?? "none";
    const index = effects.indexOf(currentEffect as (typeof effects)[number]);
    const nextEffect = effects[(index + 1) % effects.length];

    patchItem(selected.item.id, { effect: nextEffect });
    setStatus(`Effect: ${nextEffect}`);
  }

  function handleImport(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;

    const newAssets: LocalMedia[] = [];
    const newItems: { trackId: string; item: EditorItem }[] = [];
    const workingTracks: EditorTrack[] = project.tracks.map((track) => ({
      ...track,
      items: [...track.items],
    }));

    for (const file of files) {
      const kind = kindFromFile(file);
      if (!kind) continue;
      const assetId = newId();
      const url = URL.createObjectURL(file);
      newAssets.push({ id: assetId, name: file.name, kind, url, file });

      let track = workingTracks.find((candidate) =>
        !candidate.locked && trackAccepts(candidate, {
          ...makeItem(kind, file.name),
          assetId,
        }),
      );

      if (!track) {
        const trackKind = defaultTrackKind(kind);
        const count = project.tracks.filter((candidate) => candidate.kind === trackKind).length + 1;
        track = {
          id: newId(),
          kind: trackKind,
          name: `${trackKind[0].toUpperCase()}${trackKind.slice(1)} ${count}`,
          muted: false,
          locked: false,
          hidden: false,
          items: [],
        };
        workingTracks.push(track);
      }

      const mediaElement = document.createElement(kind === "video" || kind === "audio" ? kind : "video");
      mediaElement.preload = "metadata";
      mediaElement.src = url;
      const defaultLength = kind === "audio" || kind === "video" ? 10 : 5;
      const item = {
        ...makeItem(kind, file.name, playhead, defaultLength),
        assetId,
      };
      newItems.push({ trackId: track.id, item });
      mediaElement.onloadedmetadata = () => {
        if (Number.isFinite(mediaElement.duration) && mediaElement.duration > 0) {
          setProject((current) => ({
            ...current,
            tracks: current.tracks.map((candidate) => ({
              ...candidate,
              items: candidate.items.map((entry) =>
                entry.id === item.id
                  ? { ...entry, length: Math.min(4 * 60 * 60, mediaElement.duration) }
                  : entry,
              ),
            })),
          }));
        }
      };
    }

    if (newAssets.length === 0) {
      setStatus("Choose video, image, or audio files.");
      event.target.value = "";
      return;
    }

    setLocalMedia((current) => [...current, ...newAssets]);
    setProject((current) => {
      let tracks = current.tracks.map((track) => ({ ...track, items: [...track.items] }));
      for (const addition of newItems) {
        if (!tracks.some((track) => track.id === addition.trackId)) {
          const sourceTrack = workingTracks.find((track) => track.id === addition.trackId);
          if (sourceTrack) tracks.push({ ...sourceTrack, items: [] });
        }
        tracks = tracks.map((track) =>
          track.id === addition.trackId
            ? { ...track, items: [...track.items, addition.item] }
            : track,
        );
      }
      return { ...current, tracks, updatedAt: new Date().toISOString() };
    });

    if (newItems[0]) {
      setSelectedItemId(newItems[0].item.id);
      setSelectedTrackId(newItems[0].trackId);
    }
    setStatus(`${newAssets.length} media file${newAssets.length === 1 ? "" : "s"} imported locally`);
    event.target.value = "";
  }

  function addTextClip() {
    const track = project.tracks.find((candidate) => candidate.kind === "text" && !candidate.locked);
    if (!track) {
      setStatus("Add an unlocked text track first.");
      return;
    }
    const item: EditorItem = {
      ...makeItem("text", textDraft.trim() || "Your title", playhead, 4),
      text: textDraft.trim() || "Your title",
      textStyle: { ...INITIAL_TEXT_STYLE },
    };
    setProject((current) => ({
      ...current,
      tracks: current.tracks.map((candidate) =>
        candidate.id === track.id ? { ...candidate, items: [...candidate.items, item] } : candidate,
      ),
      updatedAt: new Date().toISOString(),
    }));
    setSelectedItemId(item.id);
    setSelectedTrackId(track.id);
    setShowTextDialog(false);
    setStatus("Text clip added");
  }

  function splitSelected() {
    if (!selected) {
      setStatus("Select a timeline clip first.");
      return;
    }
    const split = splitItem(selected.item, playhead);
    if (!split) {
      setStatus("Move the playhead inside the clip, at least 0.05 seconds from either edge.");
      return;
    }
    setProject((current) => ({
      ...current,
      tracks: current.tracks.map((track) =>
        track.id !== selected.track.id
          ? track
          : {
              ...track,
              items: track.items.flatMap((item) =>
                item.id === selected.item.id ? split : [item],
              ),
            },
      ),
      updatedAt: new Date().toISOString(),
    }));
    setSelectedItemId(split[1].id);
    setStatus("Clip split at the playhead");
  }

  function deleteSelected() {
    if (!selected) return;
    setProject((current) => ({
      ...current,
      tracks: current.tracks.map((track) => ({
        ...track,
        items: track.items.filter((item) => item.id !== selected.item.id),
      })),
      updatedAt: new Date().toISOString(),
    }));
    setSelectedItemId(null);
    setStatus("Clip removed from timeline");
  }

  function moveSelected(delta: number) {
    if (!selected || selected.track.locked) return;
    patchItem(selected.item.id, {
      start: Math.max(0, Math.min(4 * 60 * 60 - selected.item.length, selected.item.start + delta)),
    });
  }

  function seekFromTimeline(event: React.PointerEvent<HTMLDivElement>) {
    if (!timelineRef.current) return;
    if (event.type === "pointermove" && event.buttons !== 1) return;

    if (event.type === "pointerdown") {
      event.currentTarget.setPointerCapture(event.pointerId);
    }

    const bounds = timelineRef.current.getBoundingClientRect();
    const x = Math.max(0, event.clientX - bounds.left);
    setPlayhead(Math.max(0, Math.min(totalDuration, x / zoom)));
  }

  function handleClipDrop(event: React.DragEvent<HTMLDivElement>, targetTrackId: string) {
    event.preventDefault();

    const raw = event.dataTransfer.getData("application/x-omniai-clip");
    if (!raw) return;

    let payload: { itemId: string; offsetSeconds: number };
    try {
      payload = JSON.parse(raw) as { itemId: string; offsetSeconds: number };
    } catch {
      setStatus("Could not read the dragged clip.");
      return;
    }

    const sourceTrack = project.tracks.find((track) =>
      track.items.some((item) => item.id === payload.itemId),
    );
    const item = sourceTrack?.items.find((candidate) => candidate.id === payload.itemId);
    const targetTrack = project.tracks.find((track) => track.id === targetTrackId);

    if (!sourceTrack || !item || !targetTrack) return;
    if (sourceTrack.locked || targetTrack.locked) {
      setStatus("Unlock the source and destination tracks before moving a clip.");
      return;
    }
    if (!trackAccepts(targetTrack, item)) {
      setStatus(`That clip cannot be placed on the ${targetTrack.name} track.`);
      return;
    }

    const bounds = event.currentTarget.getBoundingClientRect();
    const x = Math.max(0, event.clientX - bounds.left);
    const rawStart = Math.max(
      0,
      Math.min(4 * 60 * 60 - item.length, x / zoom - payload.offsetSeconds),
    );
    const snapThreshold = 8 / zoom;
    const snapTargets = [
      playhead,
      ...project.markers,
      ...project.tracks
        .flatMap((track) => track.items)
        .filter((candidate) => candidate.id !== item.id)
        .flatMap((candidate) => [candidate.start, candidate.start + candidate.length]),
    ];

    let newStart = rawStart;
    let closestDistance = snapThreshold;

    for (const target of snapTargets) {
      const startDistance = Math.abs(rawStart - target);
      const endDistance = Math.abs(rawStart + item.length - target);

      if (startDistance < closestDistance) {
        closestDistance = startDistance;
        newStart = target;
      }

      if (endDistance < closestDistance) {
        closestDistance = endDistance;
        newStart = target - item.length;
      }
    }

    newStart = Math.max(0, Math.min(4 * 60 * 60 - item.length, newStart));

    setProject((current) => {
      const currentItem = current.tracks
        .flatMap((track) => track.items)
        .find((candidate) => candidate.id === payload.itemId);
      const currentTarget = current.tracks.find((track) => track.id === targetTrackId);

      if (!currentItem || !currentTarget || currentTarget.locked || !trackAccepts(currentTarget, currentItem)) {
        return current;
      }

      return {
        ...current,
        updatedAt: new Date().toISOString(),
        tracks: current.tracks.map((track) => {
          const remaining = track.items.filter((candidate) => candidate.id !== payload.itemId);
          return track.id === targetTrackId
            ? { ...track, items: [...remaining, { ...currentItem, start: newStart }] }
            : { ...track, items: remaining };
        }),
      };
    });

    setSelectedItemId(item.id);
    setSelectedTrackId(targetTrackId);
    setPlayhead(newStart);
    setStatus("Clip moved on the timeline.");
  }
  async function getToken(): Promise<string | null> {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data.session?.access_token ?? null;
  }

  async function loadSavedProjects() {
    setBusy(true);
    try {
      const token = await getToken();
      if (!token) {
        setStatus("Sign in to load cloud-saved projects.");
        return;
      }
      const response = await fetch("/api/editor/projects", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const payload: unknown = await response.json().catch(() => ({}));
      if (!response.ok) {
        setStatus(responseMessage(payload, "Could not load saved projects. Check database setup."));
        return;
      }
      const data = payload as { projects?: SavedProject[]; data?: SavedProject[] };
      const projects = Array.isArray(data.projects)
        ? data.projects
        : Array.isArray(data.data)
          ? data.data
          : [];
      setSavedProjects(projects);
      setShowProjects(true);
      setStatus(projects.length ? `${projects.length} saved project(s) found` : "No cloud-saved projects yet");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to load saved projects.");
    } finally {
      setBusy(false);
    }
  }

  async function saveProject() {
    setBusy(true);
    try {
      const token = await getToken();
      if (!token) {
        setStatus("Sign in to save to your private cloud projects.");
        return;
      }
      const endpoint = projectId
        ? `/api/editor/projects/${encodeURIComponent(projectId)}`
        : "/api/editor/projects";
      const response = await fetch(endpoint, {
        method: projectId ? "PATCH" : "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ project: { ...project, updatedAt: new Date().toISOString() }, title: project.name }),
      });
      const payload: unknown = await response.json().catch(() => ({}));
      if (!response.ok) {
        setStatus(responseMessage(payload, "Save failed. The editor database migration may not be applied."));
        return;
      }
      const data = payload as { project?: SavedProject; data?: SavedProject; id?: string };
      const saved = data.project ?? data.data;
      const id = saved?.id ?? data.id;
      if (id) setProjectId(id);
      setStatus("Project saved to your private cloud project list.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to save project.");
    } finally {
      setBusy(false);
    }
  }

  async function openSavedProject() {
    const record = savedProjects.find((candidate) => candidate.id === chosenSavedProject);
    if (!record) return;
    const candidate = record.project_data ?? record.project;
    if (!candidate || !Array.isArray(candidate.tracks)) {
      setStatus("That saved record does not contain a compatible editor project.");
      return;
    }
    setProject(candidate);
    setProjectId(record.id);
    setSelectedItemId(null);
    setPlayhead(0);
    setPlaying(false);
    setShowProjects(false);
    setStatus("Cloud project loaded. Previously imported local files must be re-imported.");
  }

  function newProject() {
    setProject(blankProject());
    setProjectId(null);
    setSelectedItemId(null);
    setSelectedTrackId(null);
    setPlayhead(0);
    setPlaying(false);
    setStatus("New project created");
  }

  function exportProjectJson() {
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${project.name.replace(/[^a-z0-9-_]+/gi, "-") || "omniai-project"}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setStatus("Project structure exported as JSON (media files are not embedded)");
  }

  return (
    <div className="mx-auto w-full max-w-[1800px] space-y-3 text-[#e8e6f2]">
      <header className="flex flex-col justify-between gap-4 rounded-2xl border border-[#292341] bg-[#14121f] p-5 shadow-[0_20px_70px_rgba(0,0,0,.2)] lg:flex-row lg:items-center">
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[.24em] text-[#8b7fff]">
            <span className="h-2 w-2 rounded-full bg-[#8b7fff] shadow-[0_0_12px_#6c63ff]" />
            OmniAI Creative Suite
          </div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Video Editor</h1>
          <p className="mt-1 max-w-2xl text-sm text-[#9490ac]">
            A multitrack editing workspace for cuts, titles, overlays, and audio.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={newProject} className="rounded-xl border border-[#393252] px-4 py-2.5 text-sm hover:border-[#8b7fff]">New project</button>
          <button onClick={() => fileInputRef.current?.click()} className="rounded-xl border border-[#51467e] bg-[#211b38] px-4 py-2.5 text-sm text-[#d9d2ff] hover:bg-[#2b2349]">Import media</button>
          <button onClick={() => void loadSavedProjects()} disabled={busy} className="rounded-xl border border-[#393252] px-4 py-2.5 text-sm hover:border-[#8b7fff] disabled:opacity-50">Open project</button>
          <button onClick={() => void saveProject()} disabled={busy} className="rounded-xl bg-[#6c63ff] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_0_24px_rgba(108,99,255,.25)] hover:bg-[#7a71ff] disabled:opacity-50">{busy ? "Working…" : "Save project"}</button>
          <input ref={fileInputRef} type="file" accept="video/*,image/*,audio/*" multiple className="hidden" onChange={handleImport} />
        </div>
      </header>

      <div className="grid min-w-0 grid-cols-1 gap-3 2xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-3">
          <section className="overflow-hidden rounded-2xl border border-[#292341] bg-[#100e19]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#292341] px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold uppercase tracking-[.16em] text-[#b8b1d1]">Preview monitor</span>
                <span className="rounded-md border border-[#30294c] px-2 py-1 text-[10px] text-[#9490ac]">{project.aspect}</span>
              </div>
              <label className="flex items-center gap-2 text-xs text-[#9490ac]">
                Canvas
                <select value={project.aspect} onChange={(event) => updateAspect(event.target.value as EditorProject["aspect"])} className="rounded-lg border border-[#393252] bg-[#171422] px-2 py-1.5 text-[#e8e6f2]">
                  <option value="16:9">16:9 Landscape</option>
                  <option value="9:16">9:16 Portrait</option>
                  <option value="1:1">1:1 Square</option>
                </select>
              </label>
            </div>

            <div className="flex min-h-[140px] items-center justify-center bg-[radial-gradient(ellipse_at_center,rgba(65,49,111,.22),transparent_65%)] p-2 sm:min-h-[180px]">
              <div
                className="relative flex max-h-[42vh] w-full items-center justify-center overflow-hidden rounded-xl border border-[#393252] bg-[#050509] shadow-[0_16px_70px_rgba(0,0,0,.45)]"
                style={{
                  aspectRatio: project.aspect.replace(":", " / "),
                  maxWidth: project.aspect === "9:16" ? "min(100%, 360px)" : "100%",
                  width: project.aspect === "9:16" ? "auto" : "100%",
                  minHeight: project.aspect === "9:16" ? "260px" : undefined,
                }}
              >
                {activeVisual?.kind === "image" && activeVisual.assetId && mediaById.get(activeVisual.assetId) ? (
                  <img src={mediaById.get(activeVisual.assetId)!.url} alt={activeVisual.name} className="h-full w-full object-contain" style={{ filter: effectCss(activeVisual.effect), opacity: activeVisual.opacity }} />
                ) : activeVisual?.kind === "video" && activeVisual.assetId && mediaById.get(activeVisual.assetId) ? (
                  <video ref={videoRef} src={mediaById.get(activeVisual.assetId)!.url} muted playsInline className="h-full w-full object-contain" style={{ filter: effectCss(activeVisual.effect), opacity: activeVisual.opacity }} />
                ) : activeVisual?.kind === "text" ? (
                  <div className="max-w-full whitespace-pre-wrap px-6" style={{
                    fontFamily: activeVisual.textStyle?.fontFamily ?? "Arial",
                    fontSize: `min(${activeVisual.textStyle?.fontSize ?? 48}px, 8vw)`,
                    color: activeVisual.textStyle?.color ?? "#ffffff",
                    textAlign: activeVisual.textStyle?.align ?? "center",
                    fontWeight: activeVisual.textStyle?.bold ? 700 : 400,
                    fontStyle: activeVisual.textStyle?.italic ? "italic" : "normal",
                    opacity: activeVisual.opacity,
                  }}>{activeVisual.text ?? activeVisual.name}</div>
                ) : (
                  <div className="px-6 text-center">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-[#413567] bg-[#1b1730] text-2xl text-[#a99fff]">▶</div>
                    <p className="text-sm font-medium text-[#c7c0dc]">Your preview appears here</p>
                    <p className="mt-1 text-xs text-[#77718d]">Import a clip or add a title to begin.</p>
                  </div>
                )}
                <div className="pointer-events-none absolute bottom-3 left-3 rounded-md border border-white/10 bg-black/55 px-2 py-1 font-mono text-[10px] text-white/75">{formatTime(playhead)}</div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#292341] bg-[#14121f] px-4 py-3">
              <div className="flex items-center gap-2">
                <button onClick={() => setPlayhead(0)} aria-label="Go to start" className="rounded-lg border border-[#393252] px-3 py-2 text-sm hover:bg-[#211b38]">|◀</button>
                <button onClick={() => setPlaying((value) => !value)} className="min-w-24 rounded-lg bg-[#6c63ff] px-4 py-2 text-sm font-semibold hover:bg-[#7a71ff]">{playing ? "Ⅱ Pause" : "▶ Play"}</button>
                <button onClick={() => setPlayhead(totalDuration)} aria-label="Go to end" className="rounded-lg border border-[#393252] px-3 py-2 text-sm hover:bg-[#211b38]">▶|</button>
              </div>
              <div className="font-mono text-xs tabular-nums text-[#c4bdd9]">{formatTime(playhead)} <span className="text-[#625b7c]">/</span> {formatTime(totalDuration)}</div>
              <div className="flex flex-wrap gap-2">
                <button onClick={splitSelected} className="rounded-lg border border-[#393252] px-3 py-2 text-xs hover:border-[#8b7fff]">✂ Split clip</button>
                <button onClick={deleteSelected} disabled={!selected} className="rounded-lg border border-[#563044] px-3 py-2 text-xs text-[#f0a8bd] hover:bg-[#321c2a] disabled:opacity-40">Delete</button>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-[#292341] bg-[#14121f] p-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2 text-[10px] font-semibold uppercase tracking-wider text-[#77718d]">Tools</span>
              <button onClick={() => { setSelectedItemId(null); setStatus("Select a clip in the timeline to edit it."); }} className="rounded-lg border border-[#51467e] bg-[#211b38] px-3 py-2 text-xs text-[#d9d2ff] hover:border-[#8b7fff]">↖ Select</button>
              <button onClick={splitSelected} className="rounded-lg border border-[#393252] px-3 py-2 text-xs hover:border-[#8b7fff]">✂ Split</button>
              <button onClick={() => setShowTextDialog(true)} className="rounded-lg border border-[#393252] px-3 py-2 text-xs hover:border-[#8b7fff]">T Text</button>
              <button onClick={() => fileInputRef.current?.click()} className="rounded-lg border border-[#393252] px-3 py-2 text-xs hover:border-[#8b7fff]">♫ Import media / audio</button>
              <button onClick={cycleSelectedEffect} className="rounded-lg border border-[#393252] px-3 py-2 text-xs hover:border-[#8b7fff]">✦ Next effect</button>
              <button onClick={deleteSelected} disabled={!selected} className="rounded-lg border border-[#563044] px-3 py-2 text-xs text-[#f0a8bd] hover:bg-[#321c2a] disabled:opacity-40">⌫ Delete clip</button>
            </div>
          </section>

          <section className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-[#292341] bg-[#14121f]">
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[#292341] px-4 py-3">
              <div>
                <h2 className="text-sm font-semibold">Timeline</h2>
                <p className="mt-1 text-xs text-[#85809d]">Drag clips to reposition them or move them between compatible tracks. Click or drag the ruler or a track lane to seek.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)" className="rounded-lg border border-[#393252] px-3 py-2 text-xs hover:border-[#8b7fff] disabled:cursor-not-allowed disabled:opacity-40">↶ Undo</button>
                <button onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Y)" className="rounded-lg border border-[#393252] px-3 py-2 text-xs hover:border-[#8b7fff] disabled:cursor-not-allowed disabled:opacity-40">↷ Redo</button>
                <button onClick={() => setShowTextDialog(true)} className="rounded-lg border border-[#393252] px-3 py-2 text-xs hover:border-[#8b7fff]">＋ Text</button>
                <button onClick={() => addTrack("video")} className="rounded-lg border border-[#393252] px-3 py-2 text-xs hover:border-[#8b7fff]">＋ Video track</button>
                <button onClick={() => addTrack("audio")} className="rounded-lg border border-[#393252] px-3 py-2 text-xs hover:border-[#8b7fff]">＋ Audio track</button>
                <label className="flex items-center gap-2 text-xs text-[#9490ac]">
                  Zoom
                  <input type="range" min="20" max="120" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} className="w-20 accent-[#8b7fff]" />
                </label>
              </div>
            </div>

            <div ref={timelineScrollRef} className="overflow-x-auto overflow-y-hidden">
              <div className="relative min-w-[720px]" style={{ width: `${130 + Math.max(totalDuration, 10) * zoom}px` }}>
                <div className="grid grid-cols-[130px_minmax(0,1fr)] border-b border-[#292341]">
                  <div className="flex items-center border-r border-[#292341] px-3 py-2 text-[10px] uppercase tracking-wider text-[#77718d]">Track / controls</div>
                  <div
                    ref={timelineRef}
                    onPointerDown={seekFromTimeline}
                    onPointerMove={seekFromTimeline}
                    style={{ width: `${Math.max(totalDuration, 10) * zoom}px` }}
                    className="relative h-7 cursor-crosshair touch-none select-none bg-[#100e19]"
                  >
                    {Array.from({ length: Math.ceil(totalDuration / 5) + 1 }, (_, index) => index * 5).map((time) => (
                      <div key={time} className="absolute top-0 h-full border-l border-[#393252]/70 pl-1.5 pt-2 font-mono text-[9px] text-[#77718d]" style={{ left: `${time * zoom}px` }}>{formatDuration(time)}</div>
                    ))}
                  </div>
                </div>

                {project.tracks.map((track) => (
                  <div key={track.id} className={`grid grid-cols-[130px_minmax(0,1fr)] border-b border-[#292341] ${selectedTrackId === track.id ? "bg-[#1a1728]" : ""}`}>
                    <div className="border-r border-[#292341] p-1">
                      <button onClick={() => setSelectedTrackId(track.id)} className="block w-full truncate text-left text-[11px] font-semibold" style={{ color: TRACK_COLORS[track.kind] }}>{track.name}</button>
                      <div className="mt-1 flex flex-wrap gap-1">
                        <button onClick={() => patchTrack(track.id, { muted: !track.muted })} title="Toggle mute" className={`rounded border px-1.5 py-1 text-[9px] ${track.muted ? "border-[#a65acb] text-[#d5a7ec]" : "border-[#393252] text-[#9490ac]"}`}>M</button>
                        <button onClick={() => patchTrack(track.id, { hidden: !track.hidden })} title="Toggle visibility" className={`rounded border px-1.5 py-1 text-[9px] ${track.hidden ? "border-[#a65acb] text-[#d5a7ec]" : "border-[#393252] text-[#9490ac]"}`}>◉</button>
                        <button onClick={() => patchTrack(track.id, { locked: !track.locked })} title="Toggle lock" className={`rounded border px-1.5 py-1 text-[9px] ${track.locked ? "border-[#d49b52] text-[#f0c98e]" : "border-[#393252] text-[#9490ac]"}`}>{track.locked ? "🔒" : "🔓"}</button>
                        <button onClick={() => removeTrack(track.id)} title={`Remove ${track.name} and its clips`} aria-label={`Remove ${track.name}`} className="rounded border border-[#563044] px-1.5 py-1 text-[9px] text-[#f0a8bd] hover:bg-[#321c2a]">×</button>
                      </div>
                    </div>
                    <div data-track-id={track.id} onPointerDown={seekFromTimeline} onPointerMove={seekFromTimeline} onDragOver={(event) => event.preventDefault()} onDrop={(event) => handleClipDrop(event, track.id)} className="relative h-[40px] bg-[#100e19]" style={{ width: `${Math.max(totalDuration, 10) * zoom}px` }}>
                      {track.items.map((item) => (
                        <button
                          key={item.id}
                          draggable={!track.locked}
                          onPointerDown={(event) => event.stopPropagation()}
                          onDragStart={(event) => {
                            if (track.locked) {
                              event.preventDefault();
                              return;
                            }
                            const bounds = event.currentTarget.getBoundingClientRect();
                            const offsetSeconds = Math.max(0, (event.clientX - bounds.left) / zoom);
                            event.dataTransfer.setData(
                              "application/x-omniai-clip",
                              JSON.stringify({ itemId: item.id, offsetSeconds }),
                            );
                            event.dataTransfer.effectAllowed = "move";
                            setSelectedItemId(item.id);
                            setSelectedTrackId(track.id);
                          }}
                          onClick={() => { setSelectedItemId(item.id); setSelectedTrackId(track.id); setPlayhead(item.start); }}
                          title={`${item.name} · ${formatDuration(item.length)}`}
                          className={`absolute top-1 h-[32px] overflow-hidden rounded-md border px-1.5 py-0.5 text-left text-[10px] transition ${selectedItemId === item.id ? "z-10 border-white ring-2 ring-[#8b7fff]/70" : "border-white/10 hover:border-white/50"} ${track.locked ? "cursor-not-allowed opacity-50" : ""}`}
                          style={{
                            left: `${item.start * zoom}px`,
                            width: `${Math.max(28, item.length * zoom)}px`,
                            background: `${TRACK_COLORS[track.kind]}33`,
                            borderColor: selectedItemId === item.id ? "#ffffff" : `${TRACK_COLORS[track.kind]}99`,
                            color: "#e8e6f2",
                          }}
                        >
                          <span className="block truncate font-semibold">{item.kind === "text" ? "T · " : ""}{item.name}</span>
                          <span className="block truncate font-mono text-[9px] opacity-70">{formatDuration(item.length)}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                <div aria-hidden="true" className="pointer-events-none absolute bottom-0 top-0 z-20 w-px bg-[#b3a9ff] shadow-[0_0_8px_#8b7fff]" style={{ left: `${130 + playhead * zoom}px` }}><div className="-ml-[5px] h-2.5 w-2.5 rounded-b-sm bg-[#b3a9ff]" /></div>
              </div>
            </div>
            <div className="border-t border-[#292341] px-4 py-3 text-[11px] text-[#77718d]">
              Timeline length: {formatDuration(duration(project))} · {project.tracks.reduce((count, track) => count + track.items.length, 0)} clips · {project.tracks.length} tracks
            </div>
          </section>
        </div>

        <aside className="min-w-0 space-y-5">
          <section className="rounded-2xl border border-[#292341] bg-[#14121f] p-4">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Project settings</h2>
              <span className="rounded-md bg-[#211b38] px-2 py-1 text-[9px] uppercase tracking-wider text-[#a99fff]">Draft</span>
            </div>
            <label className="mb-4 block text-xs text-[#9490ac]">Project name
              <input value={project.name} maxLength={120} onChange={(event) => updateProjectName(event.target.value)} className="mt-2 w-full rounded-xl border border-[#393252] bg-[#0e0c17] px-3 py-2.5 text-sm text-[#e8e6f2] outline-none focus:border-[#8b7fff]" />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-[#292341] bg-[#100e19] p-3">
                <div className="text-[10px] uppercase tracking-wider text-[#77718d]">Duration</div>
                <div className="mt-1 text-lg font-semibold">{formatDuration(duration(project))}</div>
              </div>
              <div className="rounded-xl border border-[#292341] bg-[#100e19] p-3">
                <div className="text-[10px] uppercase tracking-wider text-[#77718d]">Aspect</div>
                <div className="mt-1 text-lg font-semibold">{project.aspect}</div>
              </div>
            </div>
            <button onClick={exportProjectJson} className="mt-4 w-full rounded-xl border border-[#393252] px-3 py-2.5 text-xs hover:border-[#8b7fff]">Export project structure (.json)</button>
          </section>

          <section className="rounded-2xl border border-[#292341] bg-[#14121f] p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">Media bin</h2>
              <span className="text-[10px] text-[#77718d]">Use the Import media button above to add files</span>
            </div>
            {localMedia.length === 0 ? (
              <div className="flex min-h-20 flex-col items-center justify-center rounded-xl border border-dashed border-[#393252] bg-[#100e19] px-4 text-center">
                <span className="text-2xl text-[#8b7fff]">▧</span>
                <span className="mt-2 text-xs font-medium">Your media will appear here</span>
                <span className="mt-1 text-[10px] text-[#77718d]">Use the single Import media button above. Files remain in this browser session.</span>
              </div>
            ) : (
              <div className="max-h-64 space-y-2 overflow-y-auto">
                {localMedia.map((asset) => (
                  <div key={asset.id} className="flex min-w-0 items-center gap-3 rounded-xl border border-[#292341] bg-[#100e19] p-2">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#211b38] text-[10px] uppercase text-[#b9b0ff]">{asset.kind}</div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-medium">{asset.name}</div>
                      <div className="mt-1 text-[10px] text-[#77718d]">{(asset.file.size / (1024 * 1024)).toFixed(1)} MB</div>
                    </div>
                    <button onClick={() => {
                      const targetTrack = project.tracks.find((track) => trackAccepts(track, makeItem(asset.kind, asset.name)) && !track.locked);
                      if (!targetTrack) {
                        setStatus("No compatible unlocked track. Add a track first.");
                        return;
                      }
                      const item = { ...makeItem(asset.kind, asset.name, playhead, asset.kind === "image" ? 5 : 10), assetId: asset.id };
                      setProject((current) => ({
                        ...current,
                        tracks: current.tracks.map((track) => track.id === targetTrack.id ? { ...track, items: [...track.items, item] } : track),
                        updatedAt: new Date().toISOString(),
                      }));
                      setSelectedItemId(item.id);
                      setSelectedTrackId(targetTrack.id);
                      setStatus("Clip added to timeline");
                    }} className="shrink-0 rounded-lg border border-[#393252] px-2 py-1.5 text-[10px] hover:border-[#8b7fff]">Add</button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-[#292341] bg-[#14121f] p-4">
            <h2 className="mb-4 text-sm font-semibold">Clip inspector</h2>
            {!selected ? (
              <div className="rounded-xl border border-dashed border-[#393252] bg-[#100e19] p-5 text-center text-xs text-[#77718d]">Select a clip in the timeline to adjust its properties.</div>
            ) : (
              <div className="space-y-4">
                <div className="truncate text-xs font-semibold text-[#c9c1e4]">{selected.item.name}</div>
                <label className="block text-xs text-[#9490ac]">Start (seconds)
                  <input type="number" min="0" max="14399" step="0.1" value={selected.item.start} onChange={(event) => patchItem(selected.item.id, { start: Math.max(0, Math.min(14399, Number(event.target.value) || 0)) })} className="mt-1.5 w-full rounded-lg border border-[#393252] bg-[#0e0c17] px-3 py-2 text-sm text-white" />
                </label>
                <label className="block text-xs text-[#9490ac]">Duration (seconds)
                  <input type="number" min="0.05" max="14400" step="0.1" value={selected.item.length} onChange={(event) => patchItem(selected.item.id, { length: Math.max(0.05, Math.min(14400, Number(event.target.value) || 0.05)) })} className="mt-1.5 w-full rounded-lg border border-[#393252] bg-[#0e0c17] px-3 py-2 text-sm text-white" />
                </label>
                <label className="block text-xs text-[#9490ac]">Playback speed
                  <select value={selected.item.speed} onChange={(event) => patchItem(selected.item.id, { speed: Number(event.target.value) })} className="mt-1.5 w-full rounded-lg border border-[#393252] bg-[#0e0c17] px-3 py-2 text-sm text-white">
                    <option value="0.25">0.25×</option><option value="0.5">0.5×</option><option value="0.75">0.75×</option><option value="1">1×</option><option value="1.25">1.25×</option><option value="1.5">1.5×</option><option value="2">2×</option><option value="4">4×</option>
                  </select>
                </label>
                <label className="block text-xs text-[#9490ac]">Effect
                  <select value={selected.item.effect} onChange={(event) => patchItem(selected.item.id, { effect: event.target.value as Effect })} className="mt-1.5 w-full rounded-lg border border-[#393252] bg-[#0e0c17] px-3 py-2 text-sm text-white">
                    {EFFECTS.map((effect) => <option key={effect} value={effect}>{effect.toUpperCase()}</option>)}
                  </select>
                </label>
                <label className="block text-xs text-[#9490ac]">Transition
                  <select value={selected.item.transition} onChange={(event) => patchItem(selected.item.id, { transition: event.target.value as Transition })} className="mt-1.5 w-full rounded-lg border border-[#393252] bg-[#0e0c17] px-3 py-2 text-sm text-white">
                    {TRANSITIONS.map((transition) => <option key={transition} value={transition}>{transition.toUpperCase()}</option>)}
                  </select>
                </label>
                <label className="block text-xs text-[#9490ac]">Opacity · {Math.round(selected.item.opacity * 100)}%
                  <input type="range" min="0" max="1" step="0.05" value={selected.item.opacity} onChange={(event) => patchItem(selected.item.id, { opacity: Number(event.target.value) })} className="mt-2 w-full accent-[#8b7fff]" />
                </label>
                {selected.item.kind === "video" || selected.item.kind === "audio" ? (
                  <label className="block text-xs text-[#9490ac]">Volume · {Math.round(selected.item.volume * 100)}%
                    <input type="range" min="0" max="2" step="0.05" value={selected.item.volume} onChange={(event) => patchItem(selected.item.id, { volume: Number(event.target.value) })} className="mt-2 w-full accent-[#8b7fff]" />
                  </label>
                ) : null}
                {selected.item.kind === "text" ? (
                  <>
                    <div className="block text-xs text-[#9490ac]">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <label htmlFor="editor-item-text">Text</label>
                        <PromptEnhancer
                          value={selected.item.text ?? selected.item.name}
                          onApply={(next) =>
                            patchItem(selected.item.id, {
                              text: next,
                              name: next.slice(0, 200) || "Text clip",
                            })
                          }
                          goal="the final on-screen text for a video title, caption or overlay, readable in a single glance"
                          kind="text"
                          variant="dark"
                        />
                      </div>
                      <textarea id="editor-item-text" value={selected.item.text ?? selected.item.name} onChange={(event) => patchItem(selected.item.id, { text: event.target.value, name: event.target.value.slice(0, 200) || "Text clip" })} rows={3} className="mt-1.5 w-full rounded-lg border border-[#393252] bg-[#0e0c17] px-3 py-2 text-sm text-white" />
                    </div>
                    <label className="block text-xs text-[#9490ac]">Font size
                      <input type="number" min="6" max="300" value={selected.item.textStyle?.fontSize ?? 48} onChange={(event) => patchItem(selected.item.id, { textStyle: { ...(selected.item.textStyle ?? INITIAL_TEXT_STYLE), fontSize: Math.max(6, Math.min(300, Number(event.target.value) || 48)) } })} className="mt-1.5 w-full rounded-lg border border-[#393252] bg-[#0e0c17] px-3 py-2 text-sm text-white" />
                    </label>
                    <label className="block text-xs text-[#9490ac]">Text color
                      <input type="color" value={selected.item.textStyle?.color ?? "#ffffff"} onChange={(event) => patchItem(selected.item.id, { textStyle: { ...(selected.item.textStyle ?? INITIAL_TEXT_STYLE), color: event.target.value } })} className="mt-1.5 h-10 w-full rounded-lg border border-[#393252] bg-[#0e0c17] p-1" />
                    </label>
                  </>
                ) : null}
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => moveSelected(-0.5)} className="rounded-lg border border-[#393252] px-3 py-2 text-xs hover:border-[#8b7fff]">← Move 0.5s</button>
                  <button onClick={() => moveSelected(0.5)} className="rounded-lg border border-[#393252] px-3 py-2 text-xs hover:border-[#8b7fff]">Move 0.5s →</button>
                </div>
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-[#292341] bg-[#14121f] p-4">
            <h2 className="text-sm font-semibold">Export</h2>
            <p className="mt-2 text-xs leading-5 text-[#9490ac]">
              Final video rendering and MP4 conversion are not enabled in this first editor page. Exporting project JSON preserves the edit structure, not the imported media. We&apos;ll connect a real render/conversion path after the editor is verified.
            </p>
            <button disabled className="mt-3 w-full cursor-not-allowed rounded-xl border border-[#393252] bg-[#100e19] px-3 py-2.5 text-xs text-[#77718d]">Render video · coming next</button>
          </section>
        </aside>
      </div>

      {showTextDialog ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-labelledby="add-text-title">
          <div className="w-full max-w-md rounded-2xl border border-[#393252] bg-[#14121f] p-5 shadow-2xl">
            <h2 id="add-text-title" className="text-lg font-semibold">Add text clip</h2>
            <p className="mt-1 text-xs text-[#9490ac]">Create a title or overlay on the text track.</p>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#9490ac]">Text</span>
              <PromptEnhancer
                value={textDraft}
                onApply={setTextDraft}
                goal="the final on-screen text for a video title or overlay, short enough to read in one glance and strong enough to work as a single card"
                kind="text"
                variant="dark"
              />
            </div>
            <textarea autoFocus value={textDraft} onChange={(event) => setTextDraft(event.target.value)} rows={3} className="mt-2 w-full rounded-xl border border-[#393252] bg-[#0e0c17] px-3 py-3 text-sm text-white outline-none focus:border-[#8b7fff]" />
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setShowTextDialog(false)} className="rounded-xl border border-[#393252] px-4 py-2 text-sm">Cancel</button>
              <button onClick={addTextClip} className="rounded-xl bg-[#6c63ff] px-4 py-2 text-sm font-semibold">Add title</button>
            </div>
          </div>
        </div>
      ) : null}

      {showProjects ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-labelledby="open-project-title">
          <div className="w-full max-w-lg rounded-2xl border border-[#393252] bg-[#14121f] p-5 shadow-2xl">
            <div className="flex items-center justify-between gap-3">
              <h2 id="open-project-title" className="text-lg font-semibold">Open cloud project</h2>
              <button onClick={() => setShowProjects(false)} aria-label="Close" className="rounded-lg border border-[#393252] px-3 py-1.5 text-sm">✕</button>
            </div>
            {savedProjects.length === 0 ? (
              <p className="mt-4 rounded-xl bg-[#100e19] p-4 text-sm text-[#9490ac]">No saved projects found. Save a project first, and confirm the editor database migration has been applied.</p>
            ) : (
              <>
                <select value={chosenSavedProject} onChange={(event) => setChosenSavedProject(event.target.value)} className="mt-4 w-full rounded-xl border border-[#393252] bg-[#0e0c17] px-3 py-3 text-sm text-white">
                  <option value="">Choose a project…</option>
                  {savedProjects.map((record) => (
                    <option key={record.id} value={record.id}>{record.title ?? record.project_data?.name ?? record.id}</option>
                  ))}
                </select>
                <button onClick={openSavedProject} disabled={!chosenSavedProject} className="mt-3 w-full rounded-xl bg-[#6c63ff] px-4 py-3 text-sm font-semibold disabled:opacity-40">Open selected project</button>
              </>
            )}
          </div>
        </div>
      ) : null}

      <audio ref={audioRef} className="hidden" preload="metadata" />
      <div className="fixed bottom-4 right-4 z-40 max-w-[min(92vw,480px)] rounded-xl border border-[#393252] bg-[#171422]/95 px-4 py-3 text-xs text-[#c9c1e4] shadow-xl" role="status" aria-live="polite">
        <span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-[#8b7fff]" />
        {status}
      </div>
    </div>
  );
}



