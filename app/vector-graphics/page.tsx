"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Style = "Vector Art" | "Flat Line Art" | "3D App Icon" | "Mascot Logo" | "Seamless Text-to-Pattern";
const STYLES: Style[] = ["Vector Art", "Flat Line Art", "3D App Icon", "Mascot Logo", "Seamless Text-to-Pattern"];
const FORMATS = ["SVG", "PNG (300 DPI print)"] as const;

type GenAsset = { id: string; style: Style; colors: string[]; prompt: string; svg: string; layers: string[] };

type ViewBox = { x: number; y: number; w: number; h: number };

/** Reads the viewBox off an SVG string (falls back to a 512 square). */
function viewBoxOf(svg: string): ViewBox {
  const m = svg.match(/viewBox\s*=\s*"([^"]+)"/i);
  if (m) {
    const parts = m[1].trim().split(/[\s,]+/).map(Number);
    if (parts.length === 4 && parts.every(Number.isFinite) && parts[2] > 0 && parts[3] > 0) {
      return { x: parts[0], y: parts[1], w: parts[2], h: parts[3] };
    }
  }
  return { x: 0, y: 0, w: 512, h: 512 };
}

/**
 * Pulls the first <svg>…</svg> block out of a model reply (markdown fences and
 * surrounding chatter stripped). Returns null when no usable SVG is present.
 */
function extractSvg(raw: string): string | null {
  const text = raw.replace(/```(?:svg|xml)?/gi, "").trim();
  const start = text.indexOf("<svg");
  const end = text.lastIndexOf("</svg>");
  if (start === -1 || end === -1 || end < start) return null;
  const svg = text.slice(start, end + "</svg>".length).trim();
  if (!svg.startsWith("<svg") || !svg.includes("</svg>")) return null;
  // Defensive: scripts never execute via innerHTML, but strip them anyway.
  return svg.replace(/<script\b[\s\S]*?<\/script\s*>/gi, "");
}

/** Ids of the top-level <g id="…"> groups, used as the layer list. */
function collectGroupIds(svg: string): string[] {
  const ids: string[] = [];
  const re = /<g\b[^>]*\bid\s*=\s*"([^"]+)"/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(svg)) && ids.length < 24) {
    if (!ids.includes(m[1])) ids.push(m[1]);
  }
  return ids;
}

/** Samples coordinate pairs out of path `d=` data for the wireframe overlay. */
function pathAnchors(svg: string): { x: number; y: number }[] {
  const pairs: { x: number; y: number }[] = [];
  const re = /\bd\s*=\s*"([^"]+)"/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(svg))) {
    const nums = m[1].match(/-?\d*\.?\d+(?:[eE][-+]?\d+)?/g);
    if (!nums) continue;
    const values = nums.map(Number).filter((n) => Number.isFinite(n));
    for (let i = 0; i + 1 < values.length; i += 2) pairs.push({ x: values[i], y: values[i + 1] });
  }
  if (pairs.length > 160) {
    const stride = pairs.length / 160;
    return Array.from({ length: 160 }, (_, i) => pairs[Math.floor(i * stride)]);
  }
  return pairs;
}

/**
 * Removes the full-viewBox background <rect> (the one painted edge-to-edge
 * over the artboard). Returns the new SVG, or null when no such rect exists.
 */
function stripBackgroundRect(svg: string): string | null {
  const vb = viewBoxOf(svg);
  const tol = Math.max(vb.w, vb.h) * 0.005 + 0.5;
  const rectRe = /<rect\b[^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = rectRe.exec(svg))) {
    const tag = m[0];
    const attr = (name: string): string | null => {
      const am = tag.match(new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`, "i"));
      return am ? am[1].trim() : null;
    };
    const measure = (name: string, base: number): number => {
      const raw = attr(name);
      if (raw === null) return 0;
      if (raw.endsWith("%")) {
        const pct = parseFloat(raw);
        return Number.isFinite(pct) ? (pct / 100) * base : NaN;
      }
      const value = parseFloat(raw);
      return Number.isFinite(value) ? value : NaN;
    };
    const x = measure("x", vb.w);
    const y = measure("y", vb.h);
    const w = measure("width", vb.w);
    const h = measure("height", vb.h);
    const covers =
      Math.abs(x - vb.x) <= tol && Math.abs(y - vb.y) <= tol &&
      Math.abs(w - vb.w) <= tol && Math.abs(h - vb.h) <= tol;
    if (covers) return svg.slice(0, m.index) + svg.slice(m.index + tag.length);
  }
  return null;
}

export default function VectorGraphicsPage() {
  const [style, setStyle] = useState<Style>("Vector Art");
  const [colors, setColors] = useState<string[]>(["#6c63ff", "#00f2fe", "#6ee7b7", "#e879f9"]);
  const [colorInput, setColorInput] = useState("");
  const [prompt, setPrompt] = useState("A highly detailed cyberpunk hoverbike, photorealistic, 8k resolution");
  const [cleanGeo, setCleanGeo] = useState(true);
  const [busy, setBusy] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [assets, setAssets] = useState<GenAsset[]>([]);
  const [selected, setSelected] = useState<GenAsset | null>(null);
  const [wireframe, setWireframe] = useState(false);
  const [pan, setPan] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [layers, setLayers] = useState<string[]>([]);
  const [layerVisibility, setLayerVisibility] = useState<Record<string, boolean>>({});
  const [bgRemoved, setBgRemoved] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  const selectedVb = useMemo(() => (selected ? viewBoxOf(selected.svg) : null), [selected]);
  const anchors = useMemo(() => (selected && wireframe ? pathAnchors(selected.svg) : []), [selected, wireframe]);

  // Toggle the rendered <g id="…"> groups when the eye switches flip.
  useEffect(() => {
    const root = previewRef.current;
    if (!root) return;
    root.querySelectorAll<SVGGElement>("g[id]").forEach((group) => {
      const id = group.getAttribute("id") ?? "";
      group.style.display = (layerVisibility[id] ?? true) ? "" : "none";
    });
  }, [selected, layerVisibility]);

  function addColor(c: string) {
    const v = c.trim().toUpperCase();
    if (!/^#[0-9A-F]{3}([0-9A-F]{3})?$/.test(v)) { alert("Enter a valid HEX color, e.g. #6c63ff"); return; }
    if (colors.length >= 5) { alert("Maximum 5 brand colors locked."); return; }
    if (colors.includes(v)) { alert("Color already added."); return; }
    setColors(prev => [...prev, v]);
    setColorInput("");
  }
  function removeColor(c: string) { setColors(prev => prev.filter(x => x !== c)); }

  function selectAsset(asset: GenAsset) {
    setSelected(asset);
    setLayers(asset.layers);
    const v: Record<string, boolean> = {};
    asset.layers.forEach(l => { v[l] = true; });
    setLayerVisibility(v);
    setBgRemoved(false);
    setPanOffset({ x: 0, y: 0 });
    setGenError(null);
    setNotice(null);
  }

  async function generate() {
    if (!prompt.trim()) return;
    if (colors.length < 3) { setGenError("Lock at least 3 brand colors first."); return; }
    setBusy(true);
    setGenError(null);
    setNotice(null);
    try {
      const { supabase } = await import("@/lib/supabaseClient");
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Sign in required — vector generation runs through your account.");

      const effectivePrompt = cleanGeo
        ? `${prompt.trim()} (clean geometry, smooth Bézier anchors)`
        : prompt.trim();
      const system = [
        "You are a senior vector illustrator working in a brand-locked design system.",
        "Reply with the SVG source ONLY — no markdown fences, no commentary before or after.",
        "The reply must begin with <svg and end with </svg>.",
        "Use a viewBox of at most 1600x900 and keep the artwork inside it.",
        "Self-contained only: no <script>, no external references, no remote <image href>, no @import, no CSS url().",
        `Fills and strokes must come only from this locked brand palette: ${colors.join(", ")} (neutral black/white/transparent allowed).`,
        cleanGeo ? "Use clean geometry: smooth cubic Bézier curves with few anchor points." : "Keep the vector detail appropriate to the subject.",
        style === "Seamless Text-to-Pattern"
          ? "Make the artwork tile seamlessly edge-to-edge across the whole viewBox."
          : "Compose the artwork to fill the viewBox.",
        "Group related shapes inside <g id=\"descriptive-name\"> elements with short lowercase ids so each group can be toggled as a layer.",
      ].join(" ");

      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          system,
          messages: [{ role: "user", content: `Style: ${style}. Subject: ${effectivePrompt}` }],
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        text?: string;
        error?: string;
        guidance?: string;
      };
      if (!response.ok || typeof payload.text !== "string") {
        throw new Error(
          payload.guidance
            ? `${payload.error ?? "Generation failed."} ${payload.guidance}`
            : payload.error ?? `Generation failed (HTTP ${response.status}).`
        );
      }
      const svg = extractSvg(payload.text);
      if (!svg) throw new Error("Model did not return valid SVG — try again.");
      const newAsset: GenAsset = {
        id: "a" + Math.random().toString(36).slice(2),
        style,
        colors: [...colors],
        prompt: effectivePrompt,
        svg,
        layers: collectGroupIds(svg),
      };
      setAssets(prev => [newAsset, ...prev]);
      selectAsset(newAsset);
    } catch (error) {
      setGenError(error instanceof Error ? error.message : "Generation failed — try again.");
    } finally {
      setBusy(false);
    }
  }

  function removeBackground() {
    if (!selected) return;
    const next = stripBackgroundRect(selected.svg);
    if (!next) {
      setNotice({ ok: false, text: "No background rect found — nothing to remove." });
      return;
    }
    setAssets(prev => prev.map(a => (a.id === selected.id ? { ...a, svg: next } : a)));
    setSelected({ ...selected, svg: next });
    setBgRemoved(true);
    setNotice({ ok: true, text: "Background rect removed — SVG and PNG exports now carry transparency." });
  }

  function downloadAsset(fmt: (typeof FORMATS)[number]) {
    if (!selected) { alert("Select or generate an asset first."); return; }
    if (fmt === "SVG") {
      const blob = new Blob([selected.svg], { type: "image/svg+xml" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `${selected.style.replace(/\s+/g, "_")}.svg`; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 6000);
    } else {
      const vb = viewBoxOf(selected.svg);
      const longest = Math.max(vb.w, vb.h) || 1;
      const scale = 2048 / longest;
      const width = Math.max(1, Math.round(vb.w * scale));
      const height = Math.max(1, Math.round(vb.h * scale));
      const img = new Image();
      const url = URL.createObjectURL(new Blob([selected.svg], { type: "image/svg+xml" }));
      img.onload = () => {
        const c = document.createElement("canvas");
        c.width = width; c.height = height;
        const ctx = c.getContext("2d")!;
        if (!bgRemoved) {
          // Keep the studio backdrop unless the background was explicitly removed.
          ctx.fillStyle = "#0b0a14";
          ctx.fillRect(0, 0, c.width, c.height);
        }
        ctx.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob(blob => {
          if (!blob) { alert("PNG export failed."); return; }
          const u = URL.createObjectURL(blob);
          const a = document.createElement("a"); a.href = u; a.download = `${selected.style.replace(/\s+/g, "_")}_300dpi.png`; a.click();
          setTimeout(() => URL.revokeObjectURL(u), 6000);
        }, "image/png");
      };
      img.onerror = () => { URL.revokeObjectURL(url); alert("PNG export failed — the SVG could not be rasterized."); };
      img.src = url;
    }
  }

  const colorSwatchBase = (colors.length < 3 || colors.length > 5 ? "too few/many locked colors" : `${colors.length} / 5 locked brand colors`);

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1500px] space-y-5 px-3 py-6 sm:px-6">
      <div className="flex items-center gap-3">
        <div className="grid size-11 place-items-center rounded-xl border border-[#6c63ff]/45 bg-[#6c63ff]/12 text-[#c5bfff] text-lg">✏️</div>
        <div>
          <h1 className="pilot-voice text-2xl">Vector &amp; Brand Lab</h1>
          <p className="text-sm text-ash">Recraft-style asset controller, infinite vector workspace, SVG/PNG exporters — in our palette.</p>
        </div>
      </div>

      <div className="grid min-w-0 gap-4 lg:grid-cols-[340px_minmax(0,1fr)_300px]">
        {/* 1. Precision Asset Controller */}
        <aside className="order-2 min-w-0 space-y-4 lg:order-1">
          <div className="hud-panel p-4 space-y-3">
            <h2 className="text-sm font-semibold text-[#e8e6f2] flex items-center gap-2"><span className="text-[#a69eff]"> szegh Kon:</span>Precision Asset Controller</h2>

            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-ash">Illustration style matrix</p>
              <div className="grid grid-cols-2 gap-2">
                {STYLES.map(s => (
                  <button key={s} type="button" onClick={() => setStyle(s)} className={`rounded-md border px-2 py-2 text-xs transition ${style === s ? "border-[#6c63ff] bg-[#6c63ff]/20 text-[#c5bfff]" : "border-[#211d34] text-ash hover:text-[#e8e6f2]"}`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-ash">Color palette constraints — lock 3–5 brand colors</p>
              <div className="flex gap-2">
                <input value={colorInput} onChange={e => setColorInput(e.target.value)} placeholder="#6c63ff" className="flex-1 h-8 rounded-md border border-[#211d34] bg-[#0b0a14] px-3 text-xs text-[#e8e6f2] placeholder:text-ash/60 focus:border-[#8b7fff]" />
                <button type="button" onClick={() => addColor(colorInput)} disabled={colors.length >= 5} className="d3-btn h-8 px-3 text-xs disabled:opacity-50">+ Lock</button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {colors.map(c => (
                  <div key={c} className="flex items-center gap-1.5 rounded-md border border-[#211d34] bg-[#0b0a14] px-2 py-1 text-[10px] font-mono text-[#e8e6f2]">
                    <span className="size-3 rounded-sm" style={{ background: c, boxShadow: `0 0 8px ${c}` }} />
                    {c}
                    <button type="button" onClick={() => removeColor(c)} className="text-ash hover:text-rose-300">×</button>
                  </div>
                ))}
              </div>
              <p className={`text-[10px] ${colors.length >= 3 && colors.length <= 5 ? "text-[#6ee7b7]" : "text-ash/70"}`}>{colorSwatchBase}</p>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-ash" htmlFor="vg-prompt">Text prompt</label>
              <textarea id="vg-prompt" value={prompt} onChange={e => setPrompt(e.target.value)} rows={3} placeholder="A highly detailed cyberpunk hoverbike, photorealistic, 8k resolution" className="w-full rounded-md border border-[#211d34] bg-[#0b0a14] px-3 py-2 text-sm text-[#e8e6f2] placeholder:text-ash/60 focus:border-[#8b7fff]" />
            </div>
            <label className="flex cursor-pointer items-center gap-3 text-xs text-ash rounded-md border border-[#211d34] p-2">
              <input type="checkbox" checked={cleanGeo} onChange={e => setCleanGeo(e.target.checked)} className="accent-[#6c63ff]" />
              &quot;Clean Geometry&quot; optimizer switch (forces smooth Bezier anchors)
            </label>
            <button type="button" onClick={() => void generate()} disabled={busy || !prompt.trim()} className="d3-btn d3-btn--primary w-full">
              {busy ? "Generating SVG…" : "Generate (brand-locked)"}
            </button>
            {busy && <p className="text-[10px] text-ash/70">Asking the connected chat provider for a brand-locked SVG — this can take up to a minute.</p>}
            {genError && <p role="alert" className="text-[10px] leading-relaxed text-rose-300">{genError}</p>}
          </div>
        </aside>

        {/* CENTER: Infinite Vector Workspace */}
        <section className="order-1 min-w-0 lg:order-2">
          <div className="hud-panel overflow-hidden">
            <div className="flex items-center justify-between border-b border-[#211d34] px-3 py-2">
              <span className="text-xs font-semibold text-[#e8e6f2]">Infinite Vector Workspace</span>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setPan(v => !v)} title="Drag the canvas to pan" className={`rounded-md border px-2.5 py-1 text-[10px] font-semibold transition ${pan ? "border-[#6c63ff] bg-[#6c63ff]/20 text-[#c5bfff]" : "border-[#211d34] text-ash hover:text-[#e8e6f2]"}`}>
                  ✋ Pan Hand
                </button>
                <button type="button" onClick={() => setZoom(v => (v >= 2 ? 0.5 : v + 0.25))} className="d3-btn h-7 px-2 text-[10px]">
                  🔍 Zoom {zoom.toFixed(2)}×
                </button>
                <button type="button" onClick={() => setWireframe(v => !v)} className={`rounded-md border px-2.5 py-1 text-[10px] font-semibold transition ${wireframe ? "border-[#a69eff] bg-[#6c63ff]/20 text-[#c5bfff]" : "border-[#211d34] text-ash hover:text-[#e8e6f2]"}`}>
                  △ Path Wireframe {wireframe ? "ON" : "OFF"}
                </button>
              </div>
            </div>
            <div
              className={`relative h-[460px] overflow-auto rounded-md bg-[#0b0a14] ${pan && selected ? "cursor-grab active:cursor-grabbing" : ""}`}
              onPointerDown={(e) => {
                if (!pan || !selected) return;
                dragRef.current = { startX: e.clientX, startY: e.clientY, origX: panOffset.x, origY: panOffset.y };
                e.currentTarget.setPointerCapture(e.pointerId);
              }}
              onPointerMove={(e) => {
                const d = dragRef.current;
                if (!d) return;
                setPanOffset({ x: d.origX + (e.clientX - d.startX), y: d.origY + (e.clientY - d.startY) });
              }}
              onPointerUp={(e) => {
                dragRef.current = null;
                if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
              }}
              onPointerCancel={() => { dragRef.current = null; }}
            >
              {selected ? (
                <div className="grid h-full place-items-center p-4" style={{ transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`, transformOrigin: "center" }}>
                  <div className="relative inline-block" ref={previewRef}>
                    <div dangerouslySetInnerHTML={{ __html: selected.svg }} />
                    {wireframe && selectedVb && anchors.length > 0 && (
                      <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`${selectedVb.x} ${selectedVb.y} ${selectedVb.w} ${selectedVb.h}`} xmlns="http://www.w3.org/2000/svg">
                        {/* Anchors sampled from the actual path `d=` data */}
                        {anchors.map((p, i) => (
                          <circle key={i} cx={p.x} cy={p.y} r={Math.max(selectedVb.w, selectedVb.h) / 150} fill="#00f2fe" stroke="#ffffff" strokeOpacity="0.5" />
                        ))}
                      </svg>
                    )}
                    {wireframe && anchors.length === 0 && (
                      <p className="pointer-events-none absolute left-1/2 top-2 -translate-x-1/2 whitespace-nowrap rounded-md border border-[#211d34] bg-black/70 px-2 py-1 text-[10px] text-ash">
                        No path data (d=…) found in this SVG — nothing to trace.
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="grid h-full place-items-center text-xs text-ash/60">Generate an asset to populate the workspace.</div>
              )}
            </div>
          </div>
        </section>

        {/* RIGHT: SVG Export & Micro-Edit Deck */}
        <aside className="order-3 min-w-0 space-y-4">
          <div className="hud-panel p-4 space-y-3">
            <h2 className="text-sm font-semibold text-[#e8e6f2] flex items-center gap-2"><span className="text-[#a69eff]">Layers</span></h2>
            {selected ? (
              layers.length > 0 ? (
                <div className="space-y-1">
                  {layers.map(layer => (
                    <div key={layer} className="flex items-center justify-between rounded-md border border-[#211d34] bg-[#0b0a14] px-2.5 py-1.5 text-xs text-[#e8e6f2]">
                      <span className="truncate">{layer}</span>
                      <button
                        type="button"
                        onClick={() => setLayerVisibility(v => ({ ...v, [layer]: !(v[layer] ?? true) }))}
                        className="text-[10px] text-ash hover:text-[#e8e6f2]"
                      >
                        {(layerVisibility[layer] ?? true) ? "👁" : "xx"}
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-ash/70">Layers appear when the model returns &lt;g&gt; groups — this SVG has none.</p>
              )
            ) : (
              <p className="text-xs text-ash/70">No layers yet — generate an asset.</p>
            )}
          </div>

          <div className="hud-panel p-4 space-y-3">
            <h2 className="text-sm font-semibold text-[#e8e6f2] flex items-center gap-2"><span className="text-[#a69eff]">&#128736;</span> SVG Export &amp; Micro-Edit Deck</h2>
            <p className="text-[10px] text-ash leading-relaxed">Direct vector manipulation &amp; one-click export.</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button type="button" onClick={removeBackground} disabled={!selected || bgRemoved} className="d3-btn h-8 text-[10px] disabled:opacity-50">
                {bgRemoved ? "Background removed ✓" : "Remove Background (Alpha Masking)"}
              </button>
              <button type="button" disabled title="Vector tracing needs a provider — not connected." className="d3-btn h-8 cursor-not-allowed text-[10px] opacity-50">
                Convert Raster → Clean Vector
              </button>
            </div>
            <p className="text-[10px] text-ash/70">Raster → vector tracing needs a vector-tracing provider — not connected.</p>
            {notice && <p role="alert" className={`text-[10px] leading-relaxed ${notice.ok ? "text-[#6ee7b7]" : "text-rose-300"}`}>{notice.text}</p>}
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-ash">Export format</label>
              <div className="grid grid-cols-2 gap-2">
                {FORMATS.map(f => (
                  <button key={f} type="button" onClick={() => downloadAsset(f)} disabled={!selected} className="d3-btn h-8 text-[10px] disabled:opacity-50">
                    {f.split(" ")[0]}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-[10px] text-ash/70">
              .SVG (infinite scale), .PNG (print-resolution raster from the live SVG).
              {bgRemoved && " · Alpha-mask background applied."}
            </p>
          </div>

          <div className="hud-panel p-4 space-y-3">
            <h2 className="text-sm font-semibold text-[#e8e6f2] flex items-center gap-2"><span className="text-[#a69eff]">📚</span>Asset History</h2>
            <div className="space-y-1">
              {assets.length === 0 && <p className="text-xs text-ash/70">No assets yet.</p>}
              {assets.map(a => (
                <button key={a.id} type="button" onClick={() => selectAsset(a)} className={`flex w-full items-center justify-between rounded-md border px-2.5 py-1.5 text-xs ${selected?.id === a.id ? "border-[#6c63ff] bg-[#6c63ff]/10 text-[#c5bfff]" : "border-[#211d34] text-ash hover:text-[#e8e6f2]"}`}>
                  <span className="truncate">{a.style}</span>
                  <span className="font-mono text-[9px] text-ash">{a.colors.length} palette</span>
                </button>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
