"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { mediaVault, useMediaVault, vaultColor } from "@/lib/mediaVault";

const TYPE_LABEL: Record<string, string> = { image: "Image", audio: "Audio", video: "Video", musicvideo: "MV", beat: "Beat", project: "Project" };

function typeLabel(t: string) { return TYPE_LABEL[t] ?? t; }

export default function MediaLinkVault() {
  const assets = useMediaVault();
  const [expanded, setExpanded] = useState(false);
  const [filter, setFilter] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const dragGhost = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    let list = assets;
    if (filter !== "all") list = list.filter(a => a.type === filter);
    if (query.trim()) list = list.filter(a => a.name.toLowerCase().includes(query.toLowerCase()) || a.meta.prompt?.toLowerCase().includes(query.toLowerCase()));
    return list;
  }, [assets, filter, query]);

  const selectedAsset = assets.find(a => a.id === selected) ?? null;

  const onDragStart = (a: (typeof assets)[number], e: React.DragEvent) => {
    e.dataTransfer.setData("application/x-media-asset", JSON.stringify(a));
    e.dataTransfer.setData("text/plain", a.url || a.id);
    e.dataTransfer.effectAllowed = "copyMove";
    // ghost
    if (dragGhost.current) { dragGhost.current.textContent = a.name; e.dataTransfer.setDragImage(dragGhost.current, 8, 8); }
  };

  const activateDrag = useCallback((e: React.DragEvent) => { e.preventDefault(); }, []);

  // seed variety once
  useEffect(() => {
    if (assets.length === 0) {
      const seed = [
        { type: "audio" as const, name: "Suno · neon_dust_01", url: "", meta: { prompt: "neon city synthwave, heavy sub bass", bpm: 138, sampleRate: 44100, duration: "2:42", source: "Suno" } },
        { type: "image" as const, name: "Krea · midnightportrait_7", url: "", meta: { prompt: "cinematic portrait under neon rain", resolution: "2048×1280", seed: 421983, model: "FLUX.1" } },
        { type: "video" as const, name: "MV clip · skyline_drone", url: "", meta: { prompt: "cinematic drone push-in over neon city", resolution: "1080p", duration: "0:08", motion: "Orbit" } },
        { type: "musicvideo" as const, name: "Auto-MV · chorus_bounce", url: "", meta: { prompt: "beat-synced viral onbeat effects", resolution: "1080p", bpm: 128 } },
        { type: "beat" as const, name: "808 phonk pattern", url: "", meta: { bpm: 145, duration: "1:20", sampleRate: 48000 } },
      ];
      for (const s of seed) mediaVault.push(s);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // keyboard: esc to collapse + close inspector
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { if (selected) setSelected(null); else setExpanded(false); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected]);


  return (
    <>
      {/* collapsed dock */}
      <div
        className="fixed bottom-0 left-0 right-0 z-[40] pointer-events-auto"
        style={{ WebkitBackdropFilter: "blur(20px)" }}
      >
        <div className="mx-auto max-w-[1600px] px-3 pb-2">
          <div className="relative flex items-center gap-3 rounded-t-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(11,10,20,0.72)] px-3 py-2 backdrop-blur-[24px] shadow-[0_-10px_40px_rgba(0,0,0,0.4)]">
            <button type="button" onClick={() => setExpanded(v => !v)} className="inline-flex items-center gap-2 text-xs font-semibold text-[#c5bfff]" title={expanded ? "Collapse vault" : "Open Media Link Vault"}>
              <span className="grid size-6 place-items-center rounded-md bg-gradient-to-br from-[#6c63ff] to-[#e879f9] text-white text-[10px] shadow-[0_0_14px_rgba(108,99,255,0.4)]"> ( ) </span>
              Media Link Vault
              <span className="dms-mono text-[10px] text-[#a69eff] tracking-wider">{assets.length}</span>
              <span className="text-ash">{expanded ? "▾" : "▴"}</span>
            </button>
            <div className="ml-1 flex flex-1 items-center gap-2 overflow-hidden">
              {assets.slice(0, 12).map(a => (
                <button
                  key={a.id}
                  type="button"
                  draggable
                  onDragStart={e => onDragStart(a, e)}
                  onDoubleClick={() => setSelected(a.id)}
                  className="group relative grid size-10 shrink-0 place-items-center rounded-md border text-[9px] font-bold transition hover:-translate-y-1"
                  style={{ borderColor: `${vaultColor(a.type)}55`, background: `linear-gradient(135deg, ${vaultColor(a.type)}22, #0b0a14)`, boxShadow: `0 0 14px ${vaultColor(a.type)}44` }}
                  title={`${a.name} · double-click to inspect · drag to cross-pollinate`}
                >
                  <span style={{ color: vaultColor(a.type) }}>{typeLabel(a.type)[0]}</span>
                  <span className="absolute bottom-0 right-0 size-2 rounded-full" style={{ background: vaultColor(a.type), boxShadow: `0 0 6px ${vaultColor(a.type)}` }} />
                </button>
              ))}
              {assets.length === 0 && <span className="text-xs text-ash/70">Nothing generated yet. Assets pushed across studios land here automatically.</span>}
            </div>
            <div className="hidden sm:flex items-center gap-2 text-[10px] text-ash">
              <span className="live-dot" style={{ background: "#6c63ff", boxShadow: "0 0 10px #6c63ff" }} />
              live dock
            </div>
          </div>

          {/* Expanded drawer */}
          {expanded && (
            <div className="relative mt-2 rounded-t-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(8,7,14,0.88)] p-4 backdrop-blur-[24px]" style={{ WebkitBackdropFilter: "blur(24px)" }}>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search vault…" className="h-8 min-w-[180px] flex-1 rounded-md border border-[#211d34] bg-[#0b0a14] px-3 text-xs text-[#e8e6f2] placeholder:text-ash/60" />
                <div className="flex gap-1.5">
                  {(["all", "image", "audio", "video", "musicvideo", "beat", "project"] as const).map(t => (
                    <button key={t} type="button" onClick={() => setFilter(t)} className={`rounded-full px-2.5 py-1 text-[10px] font-semibold transition ${filter === t ? "bg-[#6c63ff] text-white shadow-[0_0_12px_rgba(108,99,255,0.4)]" : "border border-[#211d34] text-ash hover:text-[#e8e6f2]"}`}>
                      {t === "all" ? "All" : typeLabel(t)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                {filtered.map(a => {
                  const col = vaultColor(a.type);
                  return (
                    <div
                      key={a.id}
                      draggable
                      onDragStart={e => onDragStart(a, e)}
                      onDoubleClick={() => setSelected(a.id)}
                      title="Double-click to inspect · drag to cross-pollinate"
                      className="group relative cursor-grab overflow-hidden rounded-lg border bg-[#0b0a14] p-2 transition-all hover:-translate-y-1 active:cursor-grabbing"
                      style={{ borderColor: `${col}44`, boxShadow: `0 0 20px ${col}22` }}
                    >
                      <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: col }} />
                      <div className="grid aspect-square place-items-center rounded-md" style={{ background: `linear-gradient(135deg, ${col}22, #0b0a14)` }}>
                        <span className="text-3xl" style={{ color: col, textShadow: `0 0 14px ${col}` }}>{typeLabel(a.type)[0]}</span>
                      </div>
                      <div className="mt-2 min-w-0">
                        <p className="truncate text-[11px] font-semibold text-[#e8e6f2]">{a.name}</p>
                        <p className="text-[9px] font-mono" style={{ color: col }}>{typeLabel(a.type)} · {new Date(a.createdAt).toLocaleDateString()}</p>
                      </div>
                      <div className="absolute bottom-1 right-1 opacity-0 transition group-hover:opacity-100">
                        <button type="button" onClick={(e) => { e.stopPropagation(); mediaVault.remove(a.id); }} className="grid size-5 place-items-center rounded-full bg-rose-500/20 text-[10px] text-rose-300 hover:bg-rose-500/40">×</button>
                      </div>
                    </div>
                  );
                })}
                {filtered.length === 0 && <div className="col-span-full grid place-items-center py-8 text-xs text-ash/70">No assets match the filter.</div>}
              </div>
              <div className="mt-3 flex items-center justify-between text-[10px] text-ash">
                <span>Double-click any card to open the Inspector. Drag a card onto any workspace panel (e.g., CapCut timeline, Image-to-Video prompt) to cross-pollinate.</span>
                <button type="button" onClick={() => mediaVault.clear()} className="rounded-md border border-[#211d34] px-2 py-1 text-[9px] hover:text-rose-300">Clear vault</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* drag ghost (invisible, sets drag image) */}
      <div ref={dragGhost} className="pointer-events-none fixed -top-10 left-0 z-[9999] px-2 py-1 rounded-md bg-[#14121f] text-[10px] text-[#c5bfff] border border-[#6c63ff]/40" style={{ opacity: 0 }} />

      {/* Media Inspector Modal */}
      {selectedAsset && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/70 backdrop-blur-md" onDragOver={activateDrag}>
          <div className="w-[min(640px,92vw)] rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(8,7,14,0.92)] p-5 shadow-[0_0_60px_rgba(108,99,255,0.25)]" style={{ WebkitBackdropFilter: "blur(24px)" }}>
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="grid size-9 place-items-center rounded-md border text-xl" style={{ borderColor: `${vaultColor(selectedAsset.type)}55`, background: `${vaultColor(selectedAsset.type)}22`, color: vaultColor(selectedAsset.type) }}>
                  {typeLabel(selectedAsset.type)[0]}
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-[#e8e6f2]">{selectedAsset.name}</h3>
                  <p className="text-[10px] font-mono" style={{ color: vaultColor(selectedAsset.type) }}>
                    {typeLabel(selectedAsset.type)} · created {new Date(selectedAsset.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
              <button type="button" onClick={() => setSelected(null)} className="grid size-7 place-items-center rounded-md border border-[#393252] text-ash hover:text-white">✕</button>
            </div>

            <div className="space-y-2 rounded-md border border-[#211d34] bg-[#0b0a14] p-3 font-mono text-xs">
              {Object.entries(selectedAsset.meta).map(([k, v]) => (
                <div key={k} className="flex items-center justify-between gap-4 border-b border-[#211d34]/50 pb-1 last:border-b-0">
                  <span className="text-ash uppercase tracking-wider text-[10px]">{k}</span>
                  <span className="text-[#e8e6f2] break-words text-right">{String(v)}</span>
                </div>
              ))}
              {Object.keys(selectedAsset.meta).length === 0 && <p className="text-ash/70 text-xs">No technical metadata recorded.</p>}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={() => { if (selectedAsset.url) navigator.clipboard?.writeText(selectedAsset.url); }} className="d3-btn d3-btn--primary text-xs">Copy link</button>
              <button type="button" onClick={() => selectedAsset.url && (window.open(selectedAsset.url, "_blank"))} className="d3-btn text-xs" disabled={!selectedAsset.url}>Open</button>
              <button type="button" onClick={() => { mediaVault.remove(selectedAsset.id); setSelected(null); }} className="d3-btn text-xs text-rose-300">Delete</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
