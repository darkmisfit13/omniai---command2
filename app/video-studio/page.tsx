"use client";

import { useMemo, useRef, useState } from "react";
import { mediaVault, type VaultAsset } from "@/lib/mediaVault";
import { useStudio } from "@/lib/studioContext";
import { supabase } from "@/lib/supabaseClient";

type Lane = "video" | "audio" | "text";
type Clip = { id: string; name: string; url: string; duration: number; lane: Lane; transition?: string; filter?: string; effect?: string; overlay?: string; speed?: number };
type AssetTab = "Media" | "Audio" | "Text-to-Video" | "Text" | "Text Styles" | "Stickers" | "Effects" | "Transitions" | "Captions" | "Filters" | "Adjustments" | "Templates" | "AI Avatar" | "Omni AI" | "Split" | "Speed" | "Crop";

const neon = "border border-cyan-300/20 bg-[#0c111b] shadow-[0_0_20px_rgba(0,242,254,.06)]";
const button = "rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-slate-200 transition hover:border-cyan-300/50 hover:text-cyan-100 disabled:cursor-not-allowed disabled:opacity-40";
const formatTime = (s: number) => Math.floor(s / 60) + ":" + String(Math.floor(s % 60)).padStart(2, "0");

async function authHeaders() {
  const { data } = await supabase.auth.getSession();
  if (!data.session?.access_token) throw new Error("Sign in to generate media.");
  return { "Content-Type": "application/json", Authorization: "Bearer " + data.session.access_token };
}

function seconds(asset: VaultAsset) {
  const value = asset.meta.duration;
  if (!value) return 8;
  if (value.includes(":")) {
    const [m, s] = value.split(":");
    return Math.max(1, Number(m) * 60 + Number(s) || 8);
  }
  return Math.max(1, Number(value) || 8);
}

export default function VideoStudioPage() {
  const { vaultAssets } = useStudio();
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<AssetTab>("Media");
  const [overlayText, setOverlayText] = useState("");
  const [omniPrompt, setOmniPrompt] = useState("");
  const [clips, setClips] = useState<Clip[]>([]);
  const [selected, setSelected] = useState<Clip | null>(null);
  const [prompt, setPrompt] = useState("");
  const [aspect, setAspect] = useState("16:9");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [scale, setScale] = useState(100);
  const [x, setX] = useState(0);
  const [y, setY] = useState(0);
  const [blend, setBlend] = useState<"normal" | "screen" | "multiply" | "overlay">("normal");
  const [mask, setMask] = useState(false);
  const [stabilize, setStabilize] = useState(false);
  const [scrub, setScrub] = useState(0);
  const linkedAssets = vaultAssets.filter(a => a.type === "video" || a.type === "audio" || a.type === "image");
  const [timelineWidth, setTimelineWidth] = useState(1500);

  const total = Math.max(30, clips.reduce((n, c) => n + c.duration, 0) + 8);
  const pxPerSecond = timelineWidth / total;
  const lanes = useMemo(() => (["video", "audio", "text"] as Lane[]).map(lane => ({ lane, clips: clips.filter(c => c.lane === lane) })), [clips]);

  function addAsset(asset: VaultAsset) {
    const clip: Clip = { id: crypto.randomUUID(), name: asset.name, url: asset.url, duration: seconds(asset), lane: asset.type === "audio" ? "audio" : asset.type === "image" ? "video" : "video" };
    setClips(current => [...current, clip]);
    setSelected(clip);
    setNotice("Added from OmniConnect Media Vault.");
  }

  function upload(file: File) {
    const url = URL.createObjectURL(file);
    const type = file.type.startsWith("audio/") ? "audio" : file.type.startsWith("image/") ? "image" : "video";
    const asset = mediaVault.push({ type, name: file.name, url, meta: { duration: "0:08", source: "OmniMotion upload" } });
    addAsset(asset);
  }

  function onDrop(event: React.DragEvent) {
    event.preventDefault();
    const serialized = event.dataTransfer.getData("application/x-media-asset");
    if (serialized) {
      try {
        const item = JSON.parse(serialized) as VaultAsset;
        if (item.url) addAsset(item);
        else setNotice("This vault item has no playable URL yet.");
      } catch { setNotice("Could not read the dropped vault item."); }
      return;
    }
    const file = event.dataTransfer.files[0];
    if (file) upload(file);
  }

  async function generateClip(promptOverride?: string) {
    const promptText = (promptOverride ?? prompt).trim();
    if (!promptText) { setNotice("Describe the shot before generating."); return; }
    setBusy(true);
    setNotice("Submitting video generation…");
    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({ pipeline: "video", prompt: promptText, options: { width: aspect === "9:16" ? 720 : 1280, height: aspect === "9:16" ? 1280 : 720, durationSeconds: 8 } }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.signedUrl) throw new Error(payload.error || "Video generation failed.");
      const duration = Number(payload.asset?.duration_seconds) || 8;
      const asset = mediaVault.push({ type: "video", name: promptText.slice(0, 44), url: payload.signedUrl, meta: { prompt: promptText, resolution: aspect, duration: "0:" + String(duration).padStart(2, "0"), source: "OmniMotion" } });
      const clip: Clip = { id: asset.id, name: asset.name, url: asset.url, duration, lane: "video" };
      setClips(current => [...current, clip]);
      setSelected(clip);
      setNotice("Clip generated and registered in the Media Vault.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Could not generate the clip."); }
    finally { setBusy(false); }
  }

  function patchClip(values: Partial<Clip>) {
    if (!selected) { setNotice("Select a clip first."); return; }
    const next = { ...selected, ...values };
    setClips(current => current.map(item => item.id === selected.id ? next : item));
    setSelected(next);
    if (typeof values.speed === "number" && videoRef.current) videoRef.current.playbackRate = values.speed;
    setNotice("Applied to " + selected.name + ".");
  }
  function applyOverlay(text: string) { if (!text.trim()) { setNotice("Enter text first."); return; } patchClip({ overlay: text.trim() }); }
  function splitSelected() {
    if (!selected) { setNotice("Select a clip to split."); return; }
    const cut = Math.max(0.2, Math.min(selected.duration - 0.2, scrub));
    if (cut < 0.2 || cut > selected.duration - 0.2) { setNotice("Move the playhead inside the selected clip."); return; }
    const left={...selected,id:crypto.randomUUID(),name:selected.name+" · A",duration:cut};
    const right={...selected,id:crypto.randomUUID(),name:selected.name+" · B",duration:selected.duration-cut};
    setClips(current=>{const index=current.findIndex(c=>c.id===selected.id);return [...current.slice(0,index),left,right,...current.slice(index+1)];});
    setSelected(left);setNotice("Clip split into two timeline segments.");
  }
  function togglePlayback() {
    const media = selected?.lane === "audio" ? audioRef.current : videoRef.current;
    if (!media) { setNotice("Add a video or audio clip to the timeline to preview playback."); return; }
    if (media.paused) void media.play().catch(() => setNotice("This media cannot be played in the browser."));
    else media.pause();
  }

  function stepFrame(delta: number) {
    const media = selected?.lane === "audio" ? audioRef.current : videoRef.current;
    const next = Math.max(0, Math.min(media?.duration || selected?.duration || 0, (media?.currentTime || scrub) + delta / 30));
    if (media) media.currentTime = next;
    setScrub(next);
  }

  return (
    <main className="flex h-screen w-screen flex-col gap-3 overflow-hidden bg-black p-4 text-white">
      <header className="flex shrink-0 items-center justify-between rounded-xl border border-white/10 bg-[#090c13] px-4 py-2.5">
        <div><p className="text-[10px] uppercase tracking-[.3em] text-cyan-300">OmniMotion · Video Studio</p><h1 className="text-lg font-semibold">Edit suite <span className="text-xs font-normal text-slate-500">4K monitor / 30 FPS</span></h1></div>
        <div className="flex items-center gap-2"><span className="text-xs text-slate-500">Autosave ready</span><button className={button} onClick={() => setNotice("Export settings are ready. Choose a connected render provider to export.")}>Export</button></div>
      </header>

      <section className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-hidden xl:grid-cols-[minmax(230px,25fr)_minmax(380px,45fr)_minmax(250px,30fr)]">
        <aside className={neon + " flex min-h-0 flex-col overflow-hidden rounded-2xl"}>
          <div className="border-b border-white/10 p-4"><h2 className="font-semibold">OmniMotion tools</h2><p className="mt-1 text-xs text-slate-500">Select a tool, then apply it to the selected clip</p>
            <div className="mt-3 flex max-h-28 flex-wrap gap-1 overflow-y-auto rounded-lg bg-black/40 p-1">{(["Media","Audio","Text-to-Video","Text","Text Styles","Stickers","Effects","Transitions","Captions","Filters","Adjustments","Templates","AI Avatar","Omni AI","Split","Speed","Crop"] as AssetTab[]).map(item => <button key={item} onClick={() => setTab(item)} className={"rounded-md px-2 py-1.5 text-[9px] " + (tab === item ? "bg-cyan-300/15 text-cyan-200" : "text-slate-500 hover:text-white")}>{item}</button>)}</div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {(tab === "Media" || tab === "Audio") && <><input ref={uploadRef} hidden type="file" accept={tab === "Audio" ? "audio/*" : "video/*,audio/*,image/*"} onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); e.currentTarget.value = ""; }} /><button className={button + " mb-3 w-full border-dashed"} onClick={() => uploadRef.current?.click()}>＋ Upload {tab === "Audio" ? "audio" : "media"}</button>
              <div className="space-y-2">{linkedAssets.filter(asset => tab !== "Audio" || asset.type === "audio").map(asset => <button key={asset.id} onClick={() => addAsset(asset)} onDragStart={e => e.dataTransfer.setData("application/x-media-asset", JSON.stringify(asset))} draggable className="flex w-full items-center gap-3 rounded-xl border border-white/10 p-2 text-left hover:border-cyan-300/40"><span className="grid h-10 w-14 place-items-center rounded-lg bg-gradient-to-br from-cyan-400/20 to-violet-500/20 text-lg">{asset.type === "audio" ? "♫" : asset.type === "image" ? "▧" : "▶"}</span><span className="min-w-0 flex-1 truncate text-xs">{asset.name}<small className="block text-slate-500">{asset.meta.duration || asset.type}</small></span><span className="text-cyan-300">＋</span></button>)}</div>
            </>}
            {tab === "Text-to-Video" as AssetTab && <div className="space-y-3"><label className="text-xs text-slate-400">Describe a shot<textarea value={prompt} onChange={e => setPrompt(e.target.value)} rows={7} className="mt-2 w-full rounded-xl border border-white/10 bg-black/50 p-3 text-sm outline-none focus:border-cyan-300/60" placeholder="Slow dolly through a midnight city, cyan reflections in rain…" /></label><div className="flex gap-2"><select value={aspect} onChange={e => setAspect(e.target.value)} className="flex-1 rounded-lg border border-white/10 bg-[#101521] p-2 text-xs"><option>16:9</option><option>9:16</option><option>1:1</option></select><button disabled={busy} onClick={() => void generateClip()} className={button + " flex-1 border-cyan-300/30"}>{busy ? "Generating…" : "Generate video"}</button></div><p className="text-[10px] text-slate-500">Uses the authenticated media generation service.</p></div>}
            {tab === "Transitions" && <div className="space-y-2">{["Crossfade","Dissolve","Push left","Zoom","Flash","Ripple","Whip pan","Match cut","Glitch","Wipe"].map(name => <button key={name} onClick={() => { if (!selected) { setNotice("Select a clip before applying a transition."); return; } const next={...selected,transition:name}; setClips(current=>current.map(item=>item.id===selected.id?next:item)); setSelected(next); setNotice(name+" applied to "+selected.name+"."); }} className="flex w-full justify-between rounded-xl border border-white/10 p-3 text-xs hover:border-violet-300/50">{name}<span className="text-violet-300">↗</span></button>)}</div>}
            {tab === "Text" && <div className="space-y-2"><textarea value={overlayText} onChange={e=>setOverlayText(e.target.value)} placeholder="Type an overlay…" className="w-full rounded-xl border border-white/10 bg-black/50 p-3 text-xs" /><button className={button+" w-full"} onClick={()=>applyOverlay(overlayText)}>Add text overlay</button></div>}
            {tab === "Text Styles" && <div className="space-y-2">{["Cinematic title","Neon glow","Bold subtitle","Minimal lower third"].map(style=><button key={style} className={button+" w-full"} onClick={()=>applyOverlay((selected?.overlay||overlayText||"Your title")+" · "+style)}>{style}</button>)}</div>}
            {tab === "Stickers" && <div className="grid grid-cols-4 gap-2">{["✨","🔥","💔","⚡","🖤","🌙","💫","🎬"].map(sticker=><button key={sticker} className={button+" text-xl"} onClick={()=>applyOverlay((selected?.overlay||"")+sticker)}>{sticker}</button>)}</div>}
            {tab === "Effects" && <div className="space-y-2">{["Blur","Solar Core","Zero","Glow","VHS","Chromatic"].map(effect=><button key={effect} className={button+" w-full"} onClick={()=>patchClip({effect})}>{effect}</button>)}</div>}
            {tab === "Filters" && <div className="space-y-2">{[["None","none"],["Cinematic","contrast(1.15) saturate(.85)"],["Noir","grayscale(1) contrast(1.2)"],["Warm","sepia(.28) saturate(1.2)"],["Dream","saturate(1.4) brightness(1.08)"],["Cool","hue-rotate(18deg) saturate(.9)"]].map(([name,value])=><button key={name} className={button+" w-full"} onClick={()=>patchClip({filter:value, effect:undefined})}>{name}</button>)}</div>}
            {tab === "Adjustments" && <div className="space-y-3 text-xs"><label>Scale {scale}%<input type="range" min="25" max="200" value={scale} onChange={e=>setScale(Number(e.target.value))} className="w-full accent-cyan-300"/></label><label>Position X<input type="range" min="-50" max="50" value={x} onChange={e=>setX(Number(e.target.value))} className="w-full accent-cyan-300"/></label><label>Position Y<input type="range" min="-50" max="50" value={y} onChange={e=>setY(Number(e.target.value))} className="w-full accent-cyan-300"/></label><button className={button+" w-full"} onClick={()=>setNotice("Scale and position are live on the preview.")}>Apply adjustments</button></div>}
            {tab === "Captions" && <div className="space-y-2"><textarea value={overlayText} onChange={e=>setOverlayText(e.target.value)} placeholder="Caption text…" className="w-full rounded-xl border border-white/10 bg-black/50 p-3 text-xs"/><button className={button+" w-full"} onClick={()=>applyOverlay(overlayText)}>Add caption track</button></div>}
            {tab === "Templates" && <div className="space-y-2">{["Cinematic","Social vertical","Music visualizer","Noir short","Dream sequence"].map((name,i)=><button key={name} className={button+" w-full"} onClick={()=>{patchClip({filter:["contrast(1.12) saturate(.9)","saturate(1.25)","brightness(1.1)","grayscale(1)","blur(.2px)"][i]});setNotice(name+" template applied.");}}>{name}</button>)}</div>}
            {tab === "AI Avatar" && <div className="space-y-2"><p className="text-[10px] text-slate-500">Generate a talking avatar clip from a prompt.</p><textarea value={prompt} onChange={e=>setPrompt(e.target.value)} placeholder="Describe the avatar and scene…" className="w-full rounded-xl border border-white/10 bg-black/50 p-3 text-xs"/><button disabled={busy} className={button+" w-full"} onClick={()=>void generateClip("Talking AI avatar: "+prompt)}>{busy?"Generating…":"Generate AI Avatar"}</button></div>}
            {tab === "Omni AI" && <div className="space-y-2"><p className="text-[10px] text-slate-500">Ask Omni AI to create a clip for this edit.</p><textarea value={omniPrompt} onChange={e=>setOmniPrompt(e.target.value)} placeholder="Describe the edit or a new shot…" className="w-full rounded-xl border border-white/10 bg-black/50 p-3 text-xs"/><button disabled={busy} className={button+" w-full"} onClick={()=>void generateClip(omniPrompt)}>{busy?"Working…":"Ask Omni AI"}</button></div>}
            {tab === "Split" && <button className={button+" w-full"} onClick={splitSelected}>Split selected clip at playhead</button>}
            {tab === "Speed" && <div className="space-y-2"><button className={button+" w-full"} onClick={()=>patchClip({speed:0.5})}>Half speed</button><button className={button+" w-full"} onClick={()=>patchClip({speed:1})}>Normal speed</button><button className={button+" w-full"} onClick={()=>patchClip({speed:2})}>Double speed</button></div>}
            {tab === "Crop" && <div className="space-y-2"><button className={button+" w-full"} onClick={()=>setMask(v=>!v)}>Toggle rounded crop mask</button><button className={button+" w-full"} onClick={()=>setAspect(v=>v==="16:9"?"9:16":"16:9")}>Toggle 16:9 / 9:16</button></div>}
          </div>
          <div onDragOver={e => e.preventDefault()} onDrop={onDrop} className="m-3 rounded-xl border border-dashed border-cyan-300/30 p-3 text-center text-[10px] text-slate-500">Drop files or Media Vault assets here</div>
        </aside>

        <section className={neon + " flex min-h-0 flex-col overflow-hidden rounded-2xl"}>
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3"><div><h2 className="font-semibold">Master monitor</h2><p className="text-[10px] uppercase tracking-widest text-slate-600">Preview · {aspect} · frame accurate</p></div><button className={button} onClick={() => setNotice("Monitor set to fit.")}>Fit</button></div>
          <div className="relative grid min-h-0 flex-1 place-items-center bg-[radial-gradient(ellipse_at_center,#101c2b_0%,#03050a_70%)] p-4"><div className="relative aspect-video max-h-full w-full max-w-5xl overflow-hidden rounded-lg border border-white/10 bg-black shadow-[0_0_60px_rgba(0,242,254,.08)]">{selected?.url && selected.lane === "audio" ? <div className="grid h-full w-full place-items-center p-8"><div className="w-full max-w-xl rounded-2xl border border-violet-300/20 bg-[#090c13] p-5"><p className="mb-3 text-sm font-medium text-violet-100">♫ {selected.name}</p><audio ref={audioRef} src={selected.url} controls className="w-full" onTimeUpdate={e=>setScrub(e.currentTarget.currentTime)} onLoadedMetadata={e=>setScrub(e.currentTarget.currentTime)} /></div></div> : selected?.url && selected.lane === "video" ? <><video ref={videoRef} src={selected.url} className="h-full w-full object-contain" style={{transform:"translate("+x+"%, "+y+"%) scale("+scale/100+")",mixBlendMode:blend,clipPath:mask?"inset(4% round 14px)":undefined,filter:[selected.filter || "",selected.effect === "Blur" ? "blur(3px)" : selected.effect === "Solar Core" ? "saturate(2.4) hue-rotate(24deg) contrast(1.15)" : selected.effect === "Zero" ? "grayscale(1) contrast(1.25)" : "",stabilize?"contrast(1.03) saturate(1.04)":""].filter(Boolean).join(" ") || undefined}} onTimeUpdate={e => setScrub(e.currentTarget.currentTime)} onLoadedMetadata={e => { e.currentTarget.playbackRate = selected?.speed || 1; setScrub(e.currentTarget.currentTime); }} controls={false} />{selected.overlay && <div className="pointer-events-none absolute inset-0 grid place-items-center px-6 text-center text-3xl font-black text-white drop-shadow-[0_2px_12px_rgba(0,0,0,.95)]">{selected.overlay}</div>}</> : <div className="grid h-full place-items-center text-center"><div><div className="mx-auto grid h-16 w-16 place-items-center rounded-full border border-cyan-300/30 text-2xl text-cyan-200 shadow-[0_0_32px_rgba(0,242,254,.18)]">▶</div><p className="mt-3 text-sm text-slate-300">{selected?.name || "Select a video clip"}</p><p className="text-xs text-slate-600">Monitor preview</p></div></div>}<span className="absolute left-3 top-3 rounded bg-black/60 px-2 py-1 font-mono text-[10px] text-cyan-200">{formatTime(scrub)} · F{Math.floor(scrub * 30).toString().padStart(6,"0")}</span></div></div>
          <div className="flex shrink-0 items-center justify-center gap-3 border-t border-white/10 p-3"><button className={button} aria-label="Step one frame backward" onClick={() => stepFrame(-1)}>|◀</button><button className={button + " text-cyan-100"} onClick={togglePlayback}>▶ / ❚❚</button><button className={button} aria-label="Step one frame forward" onClick={() => stepFrame(1)}>▶|</button><input aria-label="Scrub frame" type="range" min={0} max={selected?.duration || 30} step={1/30} value={scrub} onChange={e => { const n=Number(e.target.value); if(selected?.lane === "audio" && audioRef.current) audioRef.current.currentTime=n; else if(videoRef.current) videoRef.current.currentTime=n; setScrub(n); }} className="w-1/2 accent-cyan-300" /><span className="font-mono text-[10px] text-slate-500">{formatTime(scrub)}</span></div>
        </section>

        <aside className={neon + " flex min-h-0 flex-col overflow-y-auto rounded-2xl p-4"}>
          <h2 className="font-semibold">Inspector slate</h2><p className="mt-1 truncate text-xs text-slate-500">{selected?.name || "Select a timeline clip"}</p>
          <div className="mt-4 space-y-3">
            <section className="rounded-xl border border-cyan-300/20 bg-cyan-300/[.03] p-3"><p className="mb-3 text-[10px] uppercase tracking-[.2em] text-cyan-200">Transform</p><label className="flex justify-between text-xs">Scale <span>{scale}%</span></label><input className="w-full accent-cyan-300" type="range" min="25" max="200" value={scale} onChange={e=>setScale(Number(e.target.value))} /><div className="mt-3 grid grid-cols-2 gap-2"><label className="text-[10px] text-slate-500">Position X<input type="number" value={x} onChange={e=>setX(Number(e.target.value))} className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 p-2 text-xs text-white" /></label><label className="text-[10px] text-slate-500">Position Y<input type="number" value={y} onChange={e=>setY(Number(e.target.value))} className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 p-2 text-xs text-white" /></label></div></section>
            <section className="rounded-xl border border-violet-300/20 bg-violet-300/[.03] p-3"><p className="mb-2 text-[10px] uppercase tracking-[.2em] text-violet-200">Blend layer</p><select value={blend} onChange={e=>setBlend(e.target.value.toLowerCase() as typeof blend)} className="w-full rounded-lg border border-white/10 bg-[#101521] p-2 text-xs">{["Normal","Screen","Multiply","Overlay"].map(v=><option key={v} value={v}>{v}</option>)}</select></section>
            <section className="space-y-2 rounded-xl border border-teal-300/20 bg-teal-300/[.03] p-3"><p className="text-[10px] uppercase tracking-[.2em] text-teal-200">Finishing</p><label className="flex items-center justify-between text-xs">Mask<input type="checkbox" checked={mask} onChange={e=>setMask(e.target.checked)} className="accent-teal-300" /></label><label className="flex items-center justify-between text-xs">Stabilize<input type="checkbox" checked={stabilize} onChange={e=>setStabilize(e.target.checked)} className="accent-teal-300" /></label></section>
            <button className={button+" w-full"} onClick={()=>setNotice(selected?"Inspector parameters are applied to the selected clip preview.":"Select a clip to apply these parameters.")}>Apply parameters</button><button disabled={!selected} className={button+" w-full border-rose-300/20 text-rose-200"} onClick={()=>{if(!selected)return;setClips(current=>current.filter(item=>item.id!==selected.id));setSelected(null);setScrub(0);setNotice("Clip removed from the timeline.");}}>Remove selected clip</button>
          </div>
        </aside>
      </section>

      <section className={neon + " flex h-[18vh] min-h-[132px] shrink-0 flex-col overflow-hidden rounded-2xl"}>
        <div className="flex shrink-0 items-center justify-between border-b border-white/10 bg-[#090c13] px-4 py-2"><div><h2 className="text-sm font-semibold">Timeline</h2><p className="text-[10px] text-slate-500">Tracks share one horizontal scroll and a locked time ruler</p></div><div className="flex items-center gap-2"><button className={button} onClick={()=>setTimelineWidth(v=>Math.max(900,v-180))}>−</button><span className="font-mono text-[10px] text-slate-500">ZOOM</span><button className={button} onClick={()=>setTimelineWidth(v=>Math.min(3600,v+180))}>＋</button></div></div>
        <div ref={timelineRef} className="min-h-0 flex-1 overflow-auto" onDragOver={e=>e.preventDefault()} onDrop={onDrop}>
          <div style={{width:timelineWidth,minWidth:"100%"}} className="relative">
            <div aria-hidden="true" className="pointer-events-none absolute bottom-0 top-0 z-[3] w-px bg-cyan-200 shadow-[0_0_10px_rgba(0,242,254,.9)]" style={{left:128+scrub*pxPerSecond}} />
            <div className="sticky top-0 z-10 flex h-9 border-b border-white/10 bg-[#0b1018]"><div className="sticky left-0 z-20 w-32 shrink-0 border-r border-white/10 bg-[#0b1018] px-3 py-2 text-[10px] text-cyan-200">PLAYHEAD {formatTime(scrub)}</div><div className="relative flex-1">{Array.from({length:Math.ceil(total/5)+1},(_,i)=><span key={i} className="absolute top-2 border-l border-white/10 pl-1 font-mono text-[9px] text-slate-500" style={{left:i*5*pxPerSecond}}>{formatTime(i*5)}</span>)}</div></div>
            {lanes.map(({lane,clips:items})=><div key={lane} className="flex h-[48px] border-b border-white/[.06]"><div className="sticky left-0 z-[5] grid w-32 shrink-0 place-content-center border-r border-white/10 bg-[#0b1018] px-2 text-[10px] uppercase tracking-widest text-slate-400">{lane} track</div><div className="relative flex-1 bg-[linear-gradient(90deg,rgba(255,255,255,.025)_1px,transparent_1px)] bg-[length:80px_100%]">{items.map((clip,i)=><button key={clip.id} onClick={()=>{setSelected(clip);setScrub(0);}} className={"absolute top-1 h-10 overflow-hidden rounded-lg border px-2 text-left text-[10px] " +(selected?.id===clip.id?"border-cyan-200 bg-cyan-400/20 text-cyan-100":"border-violet-300/30 bg-violet-500/15 text-violet-100")} style={{left:items.slice(0,i).reduce((n,c)=>n+c.duration+0.4,0)*pxPerSecond,width:Math.max(74,clip.duration*pxPerSecond-4)}}>{clip.name}<small className="block text-white/50">{clip.transition ? clip.transition+" · " : ""}{formatTime(clip.duration)}</small></button>)}</div></div>)}
          </div>
        </div>
      </section>
      {notice && <button onClick={()=>setNotice("")} className="fixed bottom-4 right-4 z-50 max-w-sm rounded-xl border border-cyan-300/30 bg-[#0b1420] px-4 py-3 text-left text-xs text-cyan-100 shadow-xl">{notice}<span className="ml-3 text-slate-500">×</span></button>}
    </main>
  );
}
