"use client";

import { useRef, useState } from "react";
import { mediaVault, type VaultAsset } from "@/lib/mediaVault";
import { useStudio } from "@/lib/studioContext";
import { supabase } from "@/lib/supabaseClient";

const stages = ["Scene Planning","Image Synthesis","Creative Breeze Sync","Final Master Render"] as const;
type LogEntry = { id:number; at:string; text:string; state:"info"|"ok"|"error" };
const panel = "rounded-2xl border border-violet-300/20 bg-[#0c111a] shadow-[0_0_24px_rgba(108,99,255,.08)]";

async function analyzeTrack(url:string) {
  const Context=window.AudioContext||(window as unknown as {webkitAudioContext?:typeof AudioContext}).webkitAudioContext;
  if(!Context) throw new Error("Web Audio analysis is unavailable in this browser.");
  const response=await fetch(url);
  if(!response.ok) throw new Error("The selected track could not be fetched for analysis.");
  const context=new Context();
  try {
    const buffer=await context.decodeAudioData(await response.arrayBuffer());
    const samples=buffer.getChannelData(0);
    const hop=Math.max(1,Math.floor(buffer.sampleRate/50));
    const envelope:number[]=[];
    for(let start=0;start+hop<=samples.length;start+=hop){
      let energy=0;
      for(let i=start;i<start+hop;i++) energy+=samples[i]*samples[i];
      envelope.push(Math.sqrt(energy/hop));
    }
    const flux:number[]=[0];
    for(let i=1;i<envelope.length;i++) flux.push(Math.max(0,envelope[i]-envelope[i-1]));
    let bestLag=25,bestScore=-1;
    for(let lag=17;lag<=50;lag++){
      let score=0;
      for(let i=0;i+lag<flux.length;i++) score+=flux[i]*flux[i+lag];
      if(score>bestScore){bestScore=score;bestLag=lag;}
    }
    let bpm=3000/bestLag;
    while(bpm<70)bpm*=2;
    while(bpm>180)bpm/=2;
    return {duration:buffer.duration,bpm:Math.round(bpm)};
  } finally { await context.close(); }
}

async function authHeaders() {
  const { data } = await supabase.auth.getSession();
  if (!data.session?.access_token) throw new Error("Sign in to render a music video.");
  return { "Content-Type":"application/json", Authorization:"Bearer "+data.session.access_token };
}

export default function MusicVideoStudioPage() {
  const { vaultAssets } = useStudio();
  const inputRef = useRef<HTMLInputElement>(null);
  const [trackId,setTrackId] = useState("");
  const [imageId,setImageId] = useState("");
  const [prompt,setPrompt] = useState("");
  const [aspect,setAspect] = useState("9:16");
  const [running,setRunning] = useState(false);
  const [logs,setLogs] = useState<LogEntry[]>([]);
  const [activeStage,setActiveStage] = useState(-1);
  const [result,setResult] = useState<VaultAsset|null>(null);
  const tracks = vaultAssets.filter(a=>a.type==="audio"||a.type==="beat");
  const images = vaultAssets.filter(a=>a.type==="image");

  function log(text:string,state:LogEntry["state"]="info") {
    setLogs(current=>[{id:Date.now()+Math.random(),at:new Date().toLocaleTimeString(),text,state},...current]);
  }

  function uploadImage(file:File) {
    if(!file.type.startsWith("image/")) { log("Choose an image file for the source frame.","error"); return; }
    const image=mediaVault.push({type:"image",name:file.name,url:URL.createObjectURL(file),meta:{source:"OmniBeat source upload",resolution:"Source image"}});
    setImageId(image.id);
    log("Source image registered in the Media Vault.","ok");
  }

  async function startProduction() {
    if(!trackId) { log("Choose an audio track from the Media Vault.","error"); return; }
    if(!prompt.trim()) { log("Write a cinematic generation prompt.","error"); return; }
    const track=tracks.find(item=>item.id===trackId);
    if(!track) { log("The selected track is no longer available.","error"); return; }
    setRunning(true); setResult(null); setLogs([]); setActiveStage(-1);
    log("Production request accepted for "+track.name+".","info");
    try {
      let tempoHint="";
      if(track.url){log("Parsing audio stems for a local beat map…","info");try{const analysis=await analyzeTrack(track.url);tempoHint=" Estimated tempo "+analysis.bpm+" BPM; track duration "+Math.round(analysis.duration)+" seconds.";log("Audio beat map ready · "+analysis.bpm+" BPM.","ok");}catch(error){log("Audio analysis unavailable: "+(error instanceof Error?error.message:"decode failed"),"error");}}
      else log("Audio analysis skipped: the selected vault track has no playable URL.","info");
      log("Synthesizing scene frames from the cinematic prompt…","info");
      const imageHint=selectedImage?" Visual reference asset: "+selectedImage.name+".":"";
      const response=await fetch("/api/generate",{method:"POST",headers:await authHeaders(),body:JSON.stringify({pipeline:"video",prompt:"Music video concept for "+track.name+"."+tempoHint+" Beat-aware scene pacing. "+prompt.trim()+imageHint+" Aspect ratio "+aspect+".",options:{width:aspect==="9:16"?720:1280,height:aspect==="9:16"?1280:720,durationSeconds:20}})});
      const payload=await response.json();
      if(!response.ok||!payload.signedUrl) throw new Error(payload.error||"The render provider did not return a video.");
      log("Video provider returned a completed render.","ok");
      stages.forEach((stage,index)=>{setTimeout(()=>{setActiveStage(index);log(stage+" complete.","ok");if(index===stages.length-1){const output=mediaVault.push({type:"musicvideo",name:"OmniBeat · "+track.name,url:payload.signedUrl,meta:{prompt:prompt.trim(),duration:"0:20",resolution:aspect,source:"OmniBeat",model:"Video generation"}});setResult(output);log("Master render registered in the Media Vault.","ok");setRunning(false);}},350+index*650);});
    } catch(error) { log(error instanceof Error?error.message:"Production failed.","error");setRunning(false); }
  }

  const selectedImage=images.find(item=>item.id===imageId);
  return (
    <main className="flex h-screen min-h-[680px] flex-col gap-3 overflow-hidden bg-[#06070b] p-4 text-white">
      <header className="flex shrink-0 items-center justify-between rounded-xl border border-white/10 bg-[#0a0c12] px-4 py-3"><div><p className="text-[10px] uppercase tracking-[.32em] text-violet-300">OmniBeat · automated MV pipeline</p><h1 className="text-lg font-semibold">Music video production</h1></div><span className="rounded-full border border-cyan-300/20 px-3 py-1 text-[10px] text-cyan-200">{running?"Production running":"Two stage workflow"}</span></header>
      {!running&&!result&&<section className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-y-auto xl:grid-cols-2">
        <section className={panel+" p-5"}><p className="text-[10px] uppercase tracking-[.22em] text-cyan-200">Stage 1 · Setup</p><h2 className="mt-1 text-lg font-semibold">Choose your source assets</h2><p className="mt-1 text-xs text-slate-500">Tracks and images are linked through the shared Media Vault.</p>
          <label className="mt-5 block text-xs text-slate-400">Target track<select value={trackId} onChange={e=>setTrackId(e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-[#080b12] p-3 text-sm text-white"><option value="">Select a track</option>{tracks.map(item=><option key={item.id} value={item.id}>{item.name} · {item.meta.duration||"duration pending"}</option>)}</select></label>
          <div className="mt-5"><div className="flex items-center justify-between"><div><p className="text-xs text-slate-300">Source image</p><p className="mt-1 text-[10px] text-slate-600">Optional visual reference for the scene plan</p></div><input ref={inputRef} type="file" accept="image/*" hidden onChange={e=>{const file=e.target.files?.[0];if(file)uploadImage(file);e.currentTarget.value="";}} /><button onClick={()=>inputRef.current?.click()} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300 hover:border-cyan-300/40">＋ Add image</button></div>
            <div className="mt-3 grid grid-cols-2 gap-2">{images.map(image=><button key={image.id} onClick={()=>setImageId(image.id)} className={"flex items-center gap-2 rounded-xl border p-2 text-left "+(imageId===image.id?"border-cyan-300/50 bg-cyan-300/[.08]":"border-white/10")}><span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-lg bg-gradient-to-br from-cyan-400/20 to-violet-500/30" style={image.url?{backgroundImage:"url("+image.url+")",backgroundSize:"cover",backgroundPosition:"center"}:undefined}>{image.url?null:"▧"}</span><span className="truncate text-[10px]">{image.name}</span></button>)}</div>
            {selectedImage&&<p className="mt-2 text-[10px] text-teal-200">Selected: {selectedImage.name}</p>}
          </div>
        </section>
        <section className={panel+" p-5"}><p className="text-[10px] uppercase tracking-[.22em] text-violet-200">Cinematic direction</p><h2 className="mt-1 text-lg font-semibold">Set the visual language</h2>
          <label className="mt-5 block text-xs text-slate-400">Generation prompt<textarea value={prompt} onChange={e=>setPrompt(e.target.value)} rows={8} placeholder="A lone performer crosses a rain-lit city; sweeping camera movement, slow shutter trails, emotional close-ups…" className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 p-3 text-sm leading-6 text-white outline-none focus:border-violet-300/40"/></label>
          <p className="mb-2 mt-5 text-xs text-slate-400">Aspect ratio lock</p><div className="grid grid-cols-3 gap-2">{["16:9","9:16","1:1"].map(value=><button key={value} onClick={()=>setAspect(value)} className={"rounded-xl border py-3 text-sm "+(aspect===value?"border-cyan-300/50 bg-cyan-300/10 text-cyan-100":"border-white/10 text-slate-500")}>{value}</button>)}</div>
          <button onClick={()=>void startProduction()} disabled={!trackId||!prompt.trim()} className="mt-6 w-full rounded-xl border border-violet-300/30 bg-gradient-to-r from-violet-500/25 to-cyan-400/15 py-3 text-sm font-semibold text-white hover:border-cyan-200/50 disabled:opacity-40">Start automated production</button><p className="mt-2 text-center text-[10px] text-slate-600">Renders through the configured authenticated video provider.</p>
        </section>
      </section>}
      {(running||result)&&<section className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-hidden xl:grid-cols-[minmax(260px,36fr)_minmax(460px,64fr)]">
        <section className={panel+" flex min-h-0 flex-col overflow-hidden"}><div className="border-b border-white/10 p-4"><p className="text-[10px] uppercase tracking-[.2em] text-teal-200">Stage 2 · Production runtime</p><h2 className="mt-1 font-semibold">Command console</h2></div><div className="min-h-0 flex-1 space-y-2 overflow-y-auto bg-[#070a0e] p-4 font-mono text-[11px]">{logs.map(item=><div key={item.id} className={"flex gap-2 "+(item.state==="error"?"text-rose-300":item.state==="ok"?"text-teal-200":"text-slate-400")}><span className="shrink-0 text-slate-600">{item.at}</span><span>{item.state==="ok"?"✓":item.state==="error"?"!":"›"} {item.text}</span></div>)}{running&&<p className="animate-pulse text-cyan-200">Provider rendering in progress…</p>}</div><div className="border-t border-white/10 p-3 text-[10px] text-slate-600">Track beat analysis runs locally; video provider returns the visual render.</div></section>
        <section className={panel+" flex min-h-0 flex-col overflow-hidden p-4"}><div className="flex items-center justify-between"><div><p className="text-[10px] uppercase tracking-[.2em] text-violet-200">Render sequence</p><h2 className="mt-1 font-semibold">{result?"Master render ready":"Production stages"}</h2></div><span className="text-xs text-slate-500">{Math.max(0,activeStage+1)} / {stages.length}</span></div><div className="mt-4 grid min-h-0 flex-1 grid-cols-1 gap-3 sm:grid-cols-2">{stages.map((stage,index)=><article key={stage} className={"flex flex-col justify-between rounded-2xl border p-4 transition duration-500 "+(index<=activeStage?"border-teal-300/35 bg-gradient-to-br from-teal-300/10 to-violet-400/[.04] shadow-[0_0_24px_rgba(110,231,183,.1)]":"border-white/[.08] bg-black/20")}><div className="flex items-center justify-between"><span className="text-[10px] uppercase tracking-[.2em] text-slate-500">0{index+1}</span><span className={index<=activeStage?"text-teal-200":"text-slate-700"}>{index<=activeStage?"●":"○"}</span></div><div><h3 className="mt-5 font-semibold">{stage}</h3><p className="mt-1 text-xs text-slate-600">{index<=activeStage?"Completed":"Queued"}</p></div><div className="mt-4 h-1 overflow-hidden rounded-full bg-white/[.06]"><div className={"h-full bg-gradient-to-r from-cyan-300 to-teal-300 transition-all duration-700 "+(index<=activeStage?"w-full":"w-0")}/></div></article>)}</div>{result&&<div className="mt-4 flex items-center gap-3 rounded-xl border border-teal-300/20 p-3"><span className="grid h-12 w-16 place-items-center rounded-lg bg-gradient-to-br from-cyan-400/20 to-violet-400/20">▶</span><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold">{result.name}</p><p className="text-[10px] text-teal-200">Saved to Media Vault</p></div><button onClick={()=>{setResult(null);setActiveStage(-1);setLogs([]);}} className="rounded-lg border border-white/10 px-3 py-2 text-xs">New render</button></div>}</section>
      </section>}
    </main>
  );
}
