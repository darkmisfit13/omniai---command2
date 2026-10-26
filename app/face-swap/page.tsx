"use client";

import { useState, useRef } from "react";

type Slot = { file: File | null; url: string; type: string };

/** Longest edge sent to the image-edit endpoint (keeps base64 well under the ~5.5M-char cap). */
const MAX_DIM = 1400;

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () =>
      reject(new Error("That image could not be loaded (it may be cross-origin). Try downloading it and uploading the file instead."));
    img.src = url;
  });
}

/** Downscales any source image to <=1400px and returns a JPEG data URL for /api/ai/image-edit. */
async function imageToDataUrl(url: string): Promise<string> {
  const img = await loadImage(url);
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  if (!w || !h) throw new Error("That image has no dimensions to refine.");
  const scale = Math.min(1, MAX_DIM / Math.max(w, h));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w * scale));
  c.height = Math.max(1, Math.round(h * scale));
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable in this browser.");
  ctx.fillStyle = "#0b0a14";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.92);
}

/** Grabs a frame from a video target so videos can be refined too. */
async function videoFrameToDataUrl(url: string): Promise<string> {
  const video = document.createElement("video");
  video.muted = true;
  video.crossOrigin = "anonymous";
  video.preload = "auto";
  video.src = url;
  await new Promise<void>((resolve, reject) => {
    video.onloadeddata = () => resolve();
    video.onerror = () => reject(new Error("That video could not be loaded for frame capture."));
  });
  try { video.currentTime = Math.min(0.2, (video.duration || 1) / 2); } catch {}
  await new Promise<void>(resolve => {
    video.onseeked = () => resolve();
    setTimeout(resolve, 1200); // some browsers never fire seeked on already-current frames
  });
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (!w || !h) throw new Error("That video produced no frame to refine.");
  const scale = Math.min(1, MAX_DIM / Math.max(w, h));
  const c = document.createElement("canvas");
  c.width = Math.round(w * scale);
  c.height = Math.round(h * scale);
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable in this browser.");
  ctx.drawImage(video, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.92);
}

export default function FaceSwapPage() {
  const [target, setTarget] = useState<Slot>({ file: null, url: "", type: "" });
  const [face, setFace] = useState<Slot>({ file: null, url: "", type: "" });
  const [exprWeight, setExprWeight] = useState(0.7);
  const [skinBlend, setSkinBlend] = useState(0.6);
  const [lightMatch, setLightMatch] = useState(0.75);
  const [wardrobe, setWardrobe] = useState("Change clothes to a silver cyberpunk spacesuit");
  const [running, setRunning] = useState(false);
  const [resultUrl, setResultUrl] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [split, setSplit] = useState(50); // percent of the canvas showing the refined result
  const [draggingHandle, setDraggingHandle] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);

  const isVideoSlot = (s: Slot) => s.type.startsWith("video") || !!s.file?.type.startsWith("video/");

  function handleTargetDrop(e: React.DragEvent, setter: (s: Slot) => void, accept: string) {
    e.preventDefault();
    const raw = e.dataTransfer.getData("application/x-media-asset");
    if (raw) {
      try {
        const a = JSON.parse(raw);
        if (a.url) {
          const kind = a.type === "video" ? "video" : a.type === "image" ? "image" : accept;
          setter({ file: null, url: a.url, type: kind });
          return;
        }
      } catch {}
    }
    const f = e.dataTransfer.files?.[0];
    if (f) setter({ file: f, url: URL.createObjectURL(f), type: f.type || accept });
  }

  function handleTargetSelect(e: React.ChangeEvent<HTMLInputElement>, setter: (s: Slot) => void, accept: string) {
    const f = e.target.files?.[0];
    if (f) setter({ file: f, url: URL.createObjectURL(f), type: f.type || accept });
    e.currentTarget.value = "";
  }

  /** Composes a descriptive prompt from the wardrobe input and the three sliders. */
  function buildPrompt(): string {
    const w = wardrobe.trim().replace(/\.$/, "");
    const parts: string[] = [];
    parts.push(w ? `Restyle the person's outfit: ${w}.` : "Keep the outfit exactly as-is.");
    parts.push(`Blend the person's skin tone naturally into the scene (skin tone blend strength ${skinBlend.toFixed(2)} out of 1.0).`);
    parts.push(`Match the original scene lighting and shadows (intensity ${lightMatch.toFixed(2)} out of 1.0).`);
    parts.push(`Preserve the original facial expression (expression fidelity ${exprWeight.toFixed(2)} out of 1.0).`);
    parts.push("Keep the person's identity, pose, framing and background unchanged. Photorealistic result.");
    return parts.join(" ").slice(0, 2000);
  }

  /** Real call to /api/ai/image-edit — downscaled source image + prompt built from the controls. */
  async function runRefine() {
    setError(null);
    if (!target.url) { setError("Add a target image (or video) to refine."); return; }
    setRunning(true);
    setResultUrl("");
    try {
      const dataUrl = isVideoSlot(target)
        ? await videoFrameToDataUrl(target.url)
        : await imageToDataUrl(target.url);

      const { supabase } = await import("@/lib/supabaseClient");
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Sign in required — sign in to run the AI refine.");

      const response = await fetch("/api/ai/image-edit", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ image: dataUrl, prompt: buildPrompt() }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        imageDataUrl?: string;
        signedUrl?: string;
        error?: string;
        guidance?: string;
      };
      const src = payload.imageDataUrl ?? payload.signedUrl;
      if (!response.ok || !src) {
        throw new Error(
          payload.guidance ? `${payload.error} ${payload.guidance}` : payload.error ?? `The refine failed (HTTP ${response.status}).`
        );
      }
      setResultUrl(src);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The refine failed.");
    } finally {
      setRunning(false);
    }
  }

  function downloadResult() {
    if (!resultUrl) return;
    const a = document.createElement("a");
    a.href = resultUrl;
    a.download = "outfit-appearance-refine.jpg";
    // Signed (cross-origin) URLs ignore the download attribute — open them in a tab instead.
    if (!resultUrl.startsWith("data:")) { a.target = "_blank"; a.rel = "noopener"; }
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  const slotStyle = (filled: boolean) => ({
    borderColor: filled ? "#6c63ff" : "#393252",
    background: filled ? "linear-gradient(135deg, rgba(108,99,255,0.12), #0b0a14)" : "#0b0a14",
  });

  return (
    <div className="face-swap mx-auto w-full min-w-0 max-w-[1500px] space-y-5 px-3 py-6 sm:px-6">
      <style jsx global>{`
        .face-swap button:not(:disabled){position:relative;display:inline-flex;align-items:center;justify-content:center;gap:0.4rem;min-height:2.35rem;padding:0.45rem 0.85rem;border:1px solid #352e52;border-radius:10px;background:linear-gradient(180deg,#221c3a 0%,#171327 100%);color:#d8d3ef;font-size:0.78rem;font-weight:600;cursor:pointer;transform:perspective(700px) translateZ(0px);transform-style:preserve-3d;box-shadow:inset 0 1px 0 rgba(255,255,255,0.09),inset 0 -2px 0 rgba(0,0,0,0.5),0 4px 0 -1px #0a0813,0 10px 20px rgba(0,0,0,0.55);transition:transform 140ms ease,box-shadow 140ms ease,border-color 140ms ease,background 140ms ease}
        .face-swap button:not(:disabled):hover{transform:perspective(700px) translateZ(5px);border-color:#5a4d97;background:linear-gradient(180deg,#2a2249,#1b1630)}
        .face-swap button:not(:disabled):active{transform:perspective(700px) translateZ(-3px);box-shadow:inset 0 2px 7px rgba(0,0,0,0.72),0 1px 0 -1px #0a0813}
        .face-swap button:disabled{cursor:not-allowed;opacity:0.5}
        .face-swap .hud-panel{position:relative;border-color:#352e52;background:linear-gradient(180deg,#14121f 0%,#0b0a14 100%);box-shadow:inset 0 1px 0 rgba(255,255,255,0.035),0 14px 34px rgba(0,0,0,0.35)}
        .face-swap .hud-panel::before{content:"";position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,#6c63ff,#00f2fe,#6ee7b7,#e879f9);pointer-events:none}
      `}</style>

      <div className="flex items-center gap-3">
        <div className="grid size-11 place-items-center rounded-xl border border-[#6c63ff]/45 bg-[#6c63ff]/12 text-[#c5bfff] text-lg">🎭</div>
        <div>
          <h1 className="pilot-voice text-2xl">OmniStyle</h1>
          <p className="text-sm text-ash">Drop in a photo (or a video frame) and describe the outfit change — a real AI image edit with before/after compare and download.</p>
          <p className="text-[10px] text-ash/70">Identity face-swap requires a face-swap provider — not connected yet, so this tool refines outfit, skin tone and lighting on a single image instead.</p>
        </div>
      </div>

      <div className="grid min-w-0 gap-4 lg:grid-cols-[340px_minmax(0,1fr)_340px]">
        {/* LEFT: core media dropzones */}
        <aside className="order-2 min-w-0 space-y-4 lg:order-1">
          <div className="hud-panel p-4 space-y-3">
            <h2 className="text-sm font-semibold text-[#e8e6f2] flex items-center gap-2"><span className="text-[#a69eff]">🎬</span>Target Area A — Background Canvas</h2>
            <p className="text-[10px] text-ash">Accepts a video/image (vault drag or local upload). For videos, the refine runs on a captured frame.</p>
            <div onDragOver={e => e.preventDefault()} onDrop={(e) => handleTargetDrop(e, setTarget, "video")} style={slotStyle(target.url !== "")} className="relative grid min-h-[200px] place-items-center rounded-md border-2 border-dashed text-center transition hover:border-[#8b7fff]/60">
              <input id="tg-video" type="file" accept="video/*,image/*" className="hidden" onChange={e => handleTargetSelect(e, setTarget, "video")} />
              <button type="button" onClick={() => document.getElementById("tg-video")?.click()} className="absolute inset-0" aria-label="Upload target" />
              <div className="pointer-events-none space-y-2">
                {target.url ? (
                  isVideoSlot(target) ? (
                    <video src={target.url} className="max-h-[180px] rounded-md" muted />
                  ) : (
                    <img src={target.url} alt="target" className="max-h-[180px] rounded-md object-cover" />
                  )
                ) : (
                  <>
                    <div className="text-3xl text-ash/40">🎬</div>
                    <p className="text-sm text-ash">Drop target media here</p>
                    <p className="text-[10px] text-ash/60">from vault or local upload</p>
                  </>
                )}
              </div>
            </div>
            {target.url && (
              <button type="button" onClick={() => { setTarget({ file: null, url: "", type: "" }); setResultUrl(""); setError(null); }} className="d3-btn h-8 px-3 text-xs">Clear target</button>
            )}
          </div>

          <div className="hud-panel p-4 space-y-3">
            <h2 className="text-sm font-semibold text-[#e8e6f2] flex items-center gap-2"><span className="text-[#a69eff]">👤</span>Face Identity Anchor (saved locally)</h2>
            <p className="text-[10px] text-ash">Optional. A true identity face-swap needs a face-swap provider — not connected yet, so this portrait stays on your device and is <em>not</em> part of the refine request. The refine works from the target image alone.</p>
            <div onDragOver={e => e.preventDefault()} onDrop={(e) => handleTargetDrop(e, setFace, "face")} style={slotStyle(face.url !== "")} className="relative grid min-h-[200px] place-items-center rounded-md border-2 border-dashed text-center transition hover:border-[#e879f9]/60">
              <input id="face-id" type="file" accept="image/*" className="hidden" onChange={e => handleTargetSelect(e, setFace, "face")} />
              <button type="button" onClick={() => document.getElementById("face-id")?.click()} className="absolute inset-0" aria-label="Upload face anchor" />
              <div className="pointer-events-none space-y-2">
                {face.url ? <img src={face.url} alt="face anchor" className="h-40 w-40 rounded-full object-cover border-2 border-[#6c63ff]/60 shadow-[0_0_24px_rgba(108,99,255,0.4)]" /> : (
                  <>
                    <div className="text-3xl text-ash/40">🧠</div>
                    <p className="text-sm text-ash">Drop portrait here</p>
                  </>
                )}
              </div>
            </div>
            {face.url && (
              <button type="button" onClick={() => setFace({ file: null, url: "", type: "" })} className="d3-btn h-8 px-3 text-xs">Clear anchor</button>
            )}
          </div>
        </aside>

        {/* CENTER: Refine controls */}
        <section className="order-1 min-w-0 space-y-4 lg:order-2">
          <div className="hud-panel p-4 space-y-4">
            <h2 className="text-sm font-semibold text-[#e8e6f2] flex items-center gap-2"><span className="text-[#a69eff]">&#9881;</span> Refine Controls <span className="text-[10px] font-normal text-ash">(these feed the AI prompt)</span></h2>
            <div className="grid grid-cols-1 gap-3">
              {[
                { label: "Facial Expression Matching Weight", value: exprWeight, set: setExprWeight, color: "#a69eff" },
                { label: "Skin Tone Blend Multiplier", value: skinBlend, set: setSkinBlend, color: "#00f2fe" },
                { label: "Lighting/Shadow Matching Intensity", value: lightMatch, set: setLightMatch, color: "#6ee7b7" },
              ].map(s => (
                <div key={s.label} className="rounded-md border border-[#211d34] bg-[#0b0a14] p-3">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-ash">{s.label}</span>
                    <span className="font-mono text-[#e8e6f2]">{s.value.toFixed(2)}</span>
                  </div>
                  <input type="range" min={0} max={1} step={0.01} value={s.value} onChange={e => s.set(Number(e.target.value))} className="w-full" style={{ accentColor: s.color }} />
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-ash" htmlFor="wardrobe">Digital Wardrobe Swap</label>
              <input id="wardrobe" value={wardrobe} onChange={e => setWardrobe(e.target.value)} placeholder="e.g. Change clothes to a silver cyberpunk spacesuit" className="w-full h-9 rounded-md border border-[#211d34] bg-[#0b0a14] px-3 text-sm text-[#e8e6f2] placeholder:text-ash/60 focus:border-[#8b7fff]" />
              <div className="flex flex-wrap gap-1.5">
                {["silver cyberpunk spacesuit", "armor jacket", "formal suit", "leather biker", "kimono", "holographic vest"].map(w => (
                  <button key={w} type="button" onClick={() => setWardrobe(`Change clothes to a ${w}`)} className="rounded-full border border-[#211d34] px-2 py-0.5 text-[10px] text-ash hover:text-[#e8e6f2] hover:border-[#8b7fff]/60">{w}</button>
                ))}
              </div>
            </div>
            {running && (
              <div className="rounded-md border border-[#a69eff]/40 bg-[#6c63ff]/10 px-3 py-2 text-xs text-[#c5bfff] animate-pulse">
                Sending your image + refine prompt to the image-edit model — real request, usually 10–45s…
              </div>
            )}
            {error && (
              <div className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs leading-relaxed text-rose-300 whitespace-pre-wrap">
                {error}
              </div>
            )}
            {resultUrl && !running && (
              <div className="rounded-md border border-[#6ee7b7]/40 bg-[#6ee7b7]/10 px-3 py-2 text-xs text-[#6ee7b7]">
                ✓ Refine complete — compare with the split screen on the right, then download.
              </div>
            )}
            <button type="button" onClick={runRefine} disabled={!target.url || running} className="d3-btn d3-btn--primary w-full h-10">
              {running ? "Refining…" : "Run outfit & appearance refine"}
            </button>
          </div>
        </section>

        {/* RIGHT: Before/After Split Screen */}
        <aside className="order-3 min-w-0 space-y-4">
          <div className="hud-panel p-4 space-y-3">
            <h2 className="text-sm font-semibold text-[#e8e6f2] flex items-center gap-2"><span className="text-[#a69eff]">⚖️</span> Before / After Interactive Split Screen</h2>
            <div className="relative grid place-items-center overflow-hidden rounded-md border border-[#211d34] bg-[#0b0a14]" style={{ height: 320 }} ref={canvasRef}>
              {target.url ? (
                <>
                  <img src={target.url} alt="original" className="absolute inset-0 h-full w-full object-cover" />
                  {resultUrl ? (
                    <>
                      <div className="absolute inset-y-0 left-0 overflow-hidden border-r-2 border-white/50 shadow-[2px_0_14px_rgba(255,255,255,0.18)]" style={{ width: split + "%" }}>
                        <img src={resultUrl} alt="refined result" className="h-full object-cover" style={{ width: (100 / split) * 100 + "%", maxWidth: "none" }} />
                        <span className="absolute bottom-2 left-2 rounded-full bg-black/60 px-2 py-0.5 text-[9px] font-semibold text-[#6ee7b7]">Refined (drag handle)</span>
                      </div>
                      <div className="absolute inset-y-0 cursor-ew-resize" style={{ left: `calc(${split}% - 1px)`, width: 2 }} onMouseDown={() => setDraggingHandle(true)}>
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 grid size-8 place-items-center rounded-full border-2 border-[#6c63ff] bg-[#14121f] text-xs text-white shadow-[0_0_22px_rgba(108,99,255,0.6)]">
                          •
                        </div>
                      </div>
                      <div className="absolute top-2 right-2 rounded-full bg-black/60 px-2 py-0.5 text-[9px] font-semibold text-ash">Original</div>
                      <div className="absolute top-2 left-2 rounded-full bg-black/60 px-2 py-0.5 text-[9px] font-semibold text-[#c5bfff]">Refined (AI)</div>
                    </>
                  ) : (
                    <div className="absolute inset-x-0 bottom-2 mx-3 rounded-full bg-black/70 px-3 py-1 text-center text-[10px] text-ash">
                      {running ? "Original — refining…" : "Original — run the outfit & appearance refine to generate the result."}
                    </div>
                  )}
                </>
              ) : (
                <div className="text-xs text-ash/60">Upload a target media to compare before/after.</div>
              )}
            </div>
            {draggingHandle && (
              <div className="fixed inset-0 z-50 cursor-ew-resize" onMouseMove={(e) => { if (!canvasRef.current) return; const r = canvasRef.current.getBoundingClientRect(); const pct = ((e.clientX - r.left) / r.width) * 100; setSplit(Math.max(5, Math.min(95, pct))); }} onMouseUp={() => setDraggingHandle(false)} onMouseLeave={() => setDraggingHandle(false)} />
            )}
            <p className="text-[10px] text-ash/70">Drag the center handle left/right to reveal the original (right) vs. the AI-refined (left) output.</p>
            {resultUrl && (
              <button type="button" onClick={downloadResult} className="d3-btn d3-btn--primary w-full h-9">Download refined image</button>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
