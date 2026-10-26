"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { mediaVault, type VaultAsset } from "@/lib/mediaVault";
import { useStudio } from "@/lib/studioContext";
import { supabase } from "@/lib/supabaseClient";

const panel = "rounded-2xl border border-violet-300/20 bg-[#0d111a] shadow-[0_0_24px_rgba(108,99,255,.07)]";
const action = "rounded-xl border border-cyan-300/25 bg-cyan-300/[.08] px-4 py-2.5 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-300/[.15] disabled:opacity-40";
const timeLabel = (value: number) => Math.floor(value / 60) + ":" + String(Math.floor(value % 60)).padStart(2, "0");
const styles = ["Dark wave", "Dark pop", "Synthwave", "Heavy metal", "Trap", "R&B", "Lofi", "Cinematic", "Ambient", "Industrial"];

async function authHeaders() {
  const { data } = await supabase.auth.getSession();
  if (!data.session?.access_token) throw new Error("Sign in to create a track.");
  return { "Content-Type": "application/json", Authorization: "Bearer " + data.session.access_token };
}

function structuredLyrics(raw: string) {
  const lines = raw.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  if (!lines.length) return raw;
  if (lines.some(line => /^\[(verse|chorus|bridge|intro|outro)/i.test(line))) return raw;
  const quarter = Math.ceil(lines.length / 3);
  return ["[Verse 1]", ...lines.slice(0, quarter), "", "[Chorus]", ...lines.slice(quarter, quarter * 2), "", "[Bridge / Outro]", ...lines.slice(quarter * 2)].join("\n");
}

export default function MusicStudioPage() {
  const { vaultAssets } = useStudio();
  const player = useRef<HTMLAudioElement>(null);
  const [lyrics, setLyrics] = useState("");
  const [style, setStyle] = useState("Dark wave");
  const [model, setModel] = useState("OmniWave Studio");
  const [advanced, setAdvanced] = useState(true);
  const [enhance, setEnhance] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [active, setActive] = useState<VaultAsset | null>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [stems, setStems] = useState([{name:"Vocals",level:78,muted:false,color:"#8b7fff"},{name:"Drums",level:68,muted:false,color:"#00f2fe"},{name:"Bass",level:76,muted:false,color:"#6ee7b7"},{name:"Lead Synths",level:62,muted:false,color:"#67c9ff"}]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [query,setQuery] = useState("");

  const archive = useMemo(() => vaultAssets.filter(asset => asset.type === "audio" || asset.type === "beat"), [vaultAssets]);

  useEffect(() => { if (active?.url && player.current) player.current.load(); }, [active?.id]);

  function enhanceLyrics() {
    const next = !enhance;
    setEnhance(next);
    if (next && lyrics.trim()) setLyrics(structuredLyrics(lyrics));
    setNotice(next ? "Lyrics structure assist applied. Edit the sections freely." : "Lyrics structure assist is off.");
  }

  async function createSong() {
    const prompt = advanced ? "Style: "+style+"\n\nLyrics:\n"+lyrics.trim() : style+": "+lyrics.trim();
    if (!lyrics.trim()) { setNotice("Add lyrics or a song concept before creating."); return; }
    setBusy(true); setNotice("Sending song request…");
    try {
      const response = await fetch("/api/generate", { method:"POST", headers: await authHeaders(), body: JSON.stringify({ pipeline:"music", prompt, options:{model,style,customMode:advanced} }) });
      const payload = await response.json();
      if (!response.ok || !payload.signedUrl) throw new Error(payload.error || "Song generation failed.");
      const asset = mediaVault.push({type:"audio",name:lyrics.trim().split("\n")[0].slice(0,48) || style,url:payload.signedUrl,meta:{prompt:prompt.slice(0,500),duration:payload.asset?.duration_seconds ? timeLabel(Number(payload.asset.duration_seconds)) : undefined,model,source:"OmniWave"}});
      setActive(asset);
      setNotice("Song created and added to the Track Vault.");
    } catch(error) { setNotice(error instanceof Error ? error.message : "Could not create song."); }
    finally { setBusy(false); }
  }

  function togglePlayback() {
    if (!player.current || !active?.url) { setNotice("Choose a playable track from the vault first."); return; }
    if (player.current.paused) void player.current.play().then(()=>setPlaying(true)).catch(()=>setNotice("This track could not be played."));
    else { player.current.pause(); setPlaying(false); }
  }

  return (
    <main className="flex h-screen min-h-[680px] flex-col gap-3 overflow-hidden bg-[#06070b] p-4 text-slate-100">
      <header className="flex shrink-0 items-center justify-between rounded-xl border border-white/10 bg-[#0a0c12] px-4 py-3"><div><p className="text-[10px] uppercase tracking-[.32em] text-violet-300">OmniWave · Suno music studio</p><h1 className="text-lg font-semibold">Music workstation</h1></div><span className="rounded-full border border-teal-300/20 px-3 py-1 text-[10px] text-teal-200">Vault linked · {archive.length} tracks</span></header>
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-hidden xl:grid-cols-[35fr_35fr_30fr]">
        <section className={panel+" flex min-h-0 flex-col overflow-y-auto p-4"}>
          <div><p className="text-[10px] uppercase tracking-[.22em] text-cyan-200">01 · Generation deck</p><h2 className="mt-1 text-base font-semibold">Create a song</h2></div>
          <div className="mt-4 grid grid-cols-2 gap-2"><label className="text-[10px] uppercase tracking-widest text-slate-500">Model<select value={model} onChange={e=>setModel(e.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-[#101521] p-2 text-xs normal-case text-white"><option>OmniWave Studio</option><option>Music generation</option></select></label><label className="text-[10px] uppercase tracking-widest text-slate-500">Mode<select value={advanced?"Advanced":"Simple"} onChange={e=>setAdvanced(e.target.value==="Advanced")} className="mt-1 w-full rounded-lg border border-white/10 bg-[#101521] p-2 text-xs normal-case text-white"><option>Simple</option><option>Advanced</option></select></label></div>
          <label className="mt-4 text-[10px] uppercase tracking-widest text-slate-500">Lyrics / concept<textarea value={lyrics} onChange={e=>setLyrics(e.target.value)} rows={advanced?13:8} placeholder={"Paste lyrics or describe the song…\n\n[Verse 1]\n…\n[Chorus]\n…"} className="mt-2 w-full resize-y rounded-xl border border-white/10 bg-black/30 p-3 text-sm leading-6 text-slate-200 outline-none focus:border-violet-300/50" /></label>
          <button aria-pressed={enhance} onClick={enhanceLyrics} className={"mt-2 rounded-lg border px-3 py-2 text-left text-xs transition "+(enhance?"border-violet-300/40 bg-violet-300/10 text-violet-100":"border-white/10 text-slate-400 hover:border-violet-300/30")}><span className="mr-2">{enhance?"☑":"□"}</span>Enhance Lyrics <span className="ml-1 text-[10px] text-slate-600">· section structure assist</span></button>
          <label className="mt-4 block text-[10px] uppercase tracking-widest text-slate-500">Music style<input value={style} onChange={e=>setStyle(e.target.value)} className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs normal-case text-white outline-none focus:border-cyan-300/40" /></label><div className="mt-2 flex flex-wrap gap-2">{styles.map(tag=><button key={tag} onClick={()=>setStyle(tag)} className={"rounded-full border px-3 py-1.5 text-[10px] "+(style===tag?"border-cyan-300/40 bg-cyan-300/10 text-cyan-100":"border-white/10 text-slate-500 hover:border-white/20")}>{tag}</button>)}</div>
          <button disabled={busy} onClick={()=>void createSong()} className={action+" mt-5 w-full"}>{busy?"Creating…":"＋ Create Song"}</button><p className="mt-2 text-center text-[10px] text-slate-600">Generation requires an authenticated session and configured provider.</p>
        </section>

        <section className={panel+" flex min-h-0 flex-col overflow-y-auto p-4"}>
          <div className="flex items-center justify-between"><div><p className="text-[10px] uppercase tracking-[.22em] text-violet-200">02 · Workstation canvas</p><h2 className="mt-1 text-base font-semibold">Active track</h2></div><button onClick={togglePlayback} className={action}>{playing?"❚❚ Pause":"▶ Play"}</button></div>
          {active ? <div className="mt-4 rounded-xl border border-violet-300/20 bg-gradient-to-br from-violet-500/10 via-[#111523] to-cyan-500/10 p-4"><div className="flex items-center gap-3"><div className="grid h-14 w-14 place-items-center rounded-xl border border-cyan-300/30 bg-gradient-to-br from-cyan-300/20 to-violet-400/20 text-2xl">♫</div><div className="min-w-0"><p className="truncate text-sm font-semibold">{active.name}</p><p className="mt-1 text-[10px] text-slate-500">{active.meta.source || "Media Vault"} · {active.meta.duration || "duration pending"} · {active.meta.model || style}</p></div></div><div className="mt-5 flex h-20 items-center gap-1 overflow-hidden">{Array.from({length:64},(_,i)=><span key={i} className={"min-w-[3px] flex-1 rounded-full bg-gradient-to-t from-cyan-400/50 to-violet-300/80 "+(playing?"animate-pulse":"")} style={{height:(18+((i*37+Math.sin(i*1.8)*17)%78))+"%",animationDelay:(i%10)*35+"ms"}} />)}</div><div className="mt-2 flex items-center gap-2"><span className="font-mono text-[10px] text-cyan-200">{timeLabel(time)}</span><input type="range" min={0} max={duration||1} value={Math.min(time,duration||1)} onChange={e=>{const t=Number(e.target.value);if(player.current)player.current.currentTime=t;setTime(t);}} className="flex-1 accent-cyan-300"/><span className="font-mono text-[10px] text-slate-500">{timeLabel(duration)}</span></div><audio ref={player} src={active.url || undefined} onTimeUpdate={e=>setTime(e.currentTarget.currentTime)} onLoadedMetadata={e=>setDuration(e.currentTarget.duration||0)} onEnded={()=>setPlaying(false)} /></div> : <div className="mt-4 grid min-h-[190px] flex-1 place-items-center rounded-xl border border-dashed border-white/10 text-center text-xs text-slate-600">Create or select a track to load the workstation.</div>}
          <div className="mt-4 space-y-2"><div className="flex items-center justify-between"><h3 className="text-xs font-semibold">Stem controllers</h3><span className="text-[9px] uppercase tracking-widest text-slate-600">Mixer</span></div>{stems.map((stem,index)=><div key={stem.name} className="rounded-xl border border-white/[.07] bg-black/20 p-3"><div className="flex items-center justify-between text-xs"><span>{stem.name}</span><button onClick={()=>setStems(v=>v.map((s,i)=>i===index?{...s,muted:!s.muted}:s))} className={"text-[10px] "+(stem.muted?"text-rose-300":"text-slate-500")}>{stem.muted?"Muted":"Mute"}</button></div><input aria-label={stem.name+" level"} type="range" min={0} max={100} value={stem.level} onChange={e=>setStems(v=>v.map((s,i)=>i===index?{...s,level:Number(e.target.value)}:s))} className="mt-2 w-full accent-cyan-300" style={{accentColor:stem.color}} /></div>)}</div>
          {active && <div className="mt-3 flex gap-2"><button className={action+" flex-1"} onClick={()=>setNotice("Stem separation requires a configured audio processing provider.")}>Separate stems</button><button className={action+" flex-1"} onClick={()=>setNotice("Mastering controls are ready for the selected track.")}>Master</button></div>}
        </section>

        <aside className={panel+" flex min-h-0 flex-col overflow-hidden"}>
          <div className="shrink-0 border-b border-white/10 p-4"><p className="text-[10px] uppercase tracking-[.22em] text-teal-200">03 · Track vault</p><h2 className="mt-1 text-base font-semibold">Library <span className="text-xs font-normal text-slate-600">{archive.length}</span></h2><input placeholder="Search tracks" value={query} onChange={e=>setQuery(e.target.value)} className="mt-3 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs outline-none focus:border-teal-300/40" /></div>
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">{archive.filter(track=>track.name.toLowerCase().includes(query.toLowerCase())).map(track=><div key={track.id} className="flex gap-3 rounded-xl border border-white/[.08] bg-black/20 p-2"><button onClick={()=>{setActive(track);setTime(0);setPlaying(false);}} className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-cyan-400/20 via-violet-400/20 to-teal-300/20 text-xl">♫</button><div className="min-w-0 flex-1"><button onClick={()=>{setActive(track);setTime(0);setPlaying(false);}} className="block w-full truncate text-left text-xs font-semibold hover:text-cyan-100">{track.name}</button><p className="mt-1 truncate text-[10px] text-slate-600">{track.meta.duration||"—"} · {track.meta.source||"Library"} · {track.meta.prompt?.slice(0,32)||"Track"}</p></div><button aria-label={"Remix "+track.name} onClick={()=>{setActive(track);setLyrics(track.meta.prompt||"");setFavorites(current=>current.includes(track.id)?current.filter(id=>id!==track.id):[...current,track.id]);setNotice("Track loaded into the Generation Deck for a remix.");}} className={"self-start rounded-md border px-2 py-1 text-[10px] "+(favorites.includes(track.id)?"border-violet-300/30 text-violet-200":"border-white/10 text-slate-500 hover:text-violet-200")}>{favorites.includes(track.id)?"Remix ✓":"Remix"}</button></div>)}{archive.length===0&&<div className="rounded-xl border border-dashed border-white/10 p-5 text-center text-xs text-slate-600">Your generated and imported tracks appear here automatically.</div>}</div>
        </aside>
      </div>
      {notice&&<button onClick={()=>setNotice("")} className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-violet-300/30 bg-[#101521] px-4 py-3 text-xs text-violet-100 shadow-xl">{notice} <span className="ml-2 text-slate-500">×</span></button>}
    </main>
  );
}
