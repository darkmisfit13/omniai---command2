"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

type Scene = {
  id: string;
  idx: number;
  heading: string;
  timestamp: string;
  emotion: string;
  visualPrompt: string;
  audioCue: string;
  dialogue: string;
  characters: string[];
  sentImage: boolean;
  sentVideo: boolean;
  sentVoice: boolean;
};

type CharRef = { id: string; url: string; name: string };

const EMOTIONS = ["Tense", "Joyful", "Melancholic", "Triumphant", "Suspenseful", "Romantic", "Somber", "Defiant"];

export default function StoryboardSupervisorPage() {
  const [script, setScript] = useState(
`INT. NEON CITY - NIGHT

(00:00:00 - 00:00:15)
Rain slicks the asphalt. KAI (30s, hooded, determined) sprints across a flickering rooftop.

KAI (V.O.)
They said the grid never sleeps. Neither do we.

VISUAL: Wide drone shot pushing into the skyline, neon signs bleeding cyan and magenta.

(00:00:15 - 00:00:30)
KAI drops onto a lower balcony. ALIKA, a street-aligned fixer, smokes calmly.

ALIKA
You're late, Kai.

KAI
I brought the footage.

VISUAL: Low-angle OTS, cigarette ember glowing, rain catching the rim light.

EXT. LOADING DOCK - DAWN

(00:00:30 - 00:00:45)
KAI hands off a hard drive. Drones hum overhead.

MALAK (O.S.)
Catch!

VISUAL: Fast whip-pan, hard drive lands in KAI's hand, drone lights flare violet.
`);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [charRefs, setCharRefs] = useState<CharRef[]>([]);
  const [globalAnchor, setGlobalAnchor] = useState(true);
  const [anchorLocked, setAnchorLocked] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // restore the persisted anchor-lock project flag (sessionStorage "oi:anchor")
  useEffect(() => {
    try { if (sessionStorage.getItem("oi:anchor") === "1") setAnchorLocked(true); } catch {}
  }, []);

  function toggleAnchorLock() {
    setAnchorLocked(prev => {
      const next = !prev;
      try { sessionStorage.setItem("oi:anchor", next ? "1" : "0"); } catch {}
      return next;
    });
  }

  /** Marker string prepended to prompts when the anchor is locked. */
  function anchorMarker(): string {
    return charRefs.length ? `[ANCHOR:character structure of ${charRefs.map(c => c.name).join(", ")}]` : "";
  }

  /** Returns the prompt, prepending the anchor marker when the project flag is locked. */
  function withAnchor(prompt: string): string {
    const marker = anchorLocked ? anchorMarker() : "";
    return marker && !prompt.startsWith("[ANCHOR:") ? `${marker} ${prompt}` : prompt;
  }

  function parseScript() {
    const txt = script;
    const chunks = txt.split(/\n\s*\n/).filter(c => c.trim());
    const result: Scene[] = [];
    let ts = 0;
    chunks.forEach((chunk, idx) => {
      const lines = chunk.split("\n").map(l => l.trim()).filter(Boolean);
      const headingMatch = lines.find(l => /^[A-Z][A-Z\s.\/-]+$/.test(l) && l.length > 4);
      const tsMatch = chunk.match(/\(?(\d{2}:\d{2}:\d{2})\s*-\s*(\d{2}:\d{2}:\d{2})\)?/);
      const time = tsMatch ? `${tsMatch[1]} - ${tsMatch[2]}` : `${fmt(ts)} - ${fmt(ts + 15)}`;
      const dlgLines = lines.filter(l => /^[A-Z][A-Z\s]{0,20}[\(][^\)]*[\)]?/.test(l) || /^[A-Z][A-Z\s]{0,20}:/.test(l));
      const characterMatches = (chunk.match(/\b([A-Z][A-Z]+)\b/g) || []).filter(w => ["INT", "EXT", "VISUAL", "VFX", "OS", "VO", "CONT"].indexOf(w) < 0);
      const chars = Array.from(new Set(characterMatches)).slice(0, 4);
      const visualLine = lines.find(l => /^VISUAL/i.test(l)) || lines.join(" ").slice(0, 160);
      const sceneEmotion = EMOTIONS[idx % EMOTIONS.length]; // round-robin suggestion, not an analysis
      result.push({
        id: "sc" + idx,
        idx: idx + 1,
        heading: headingMatch || `Scene ${idx + 1}`,
        timestamp: time,
        emotion: sceneEmotion,
        visualPrompt: `Cinematic shot of ${visualLine.replace(/^VISUAL:\s*/i, "").replace(/"/g, "")}. Mood: ${sceneEmotion.toLowerCase()}. ${chars.length ? "Characters: " + chars.join(", ") + "." : ""} Match character anchor facial structure.`,
        audioCue: `${sceneEmotion} underscore, ${chars[0] ? "dialogue from " + chars[0] : "no dialogue"}, ambient room tone, music swells at beat drop.`,
        dialogue: dlgLines.join(" ").slice(0, 400),
        characters: chars,
        sentImage: false, sentVideo: false, sentVoice: false,
      });
      ts += 15;
    });
    if (globalAnchor && charRefs.length && result.length) {
      const anchor = `[ANCHOR:character structure of ${charRefs.map(c => c.name).join(", ")}]`;
      result.forEach(s => { s.visualPrompt = `${anchor} ${s.visualPrompt}`; });
    }
    setScenes(result);
  }

  function fmt(s: number) {
    const m = Math.floor(s / 60); const sec = s % 60;
    return `00:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }

  function sendToImage(id: string) {
    const sc = scenes.find(s => s.id === id);
    if (!sc) return;
    const prompt = withAnchor(sc.visualPrompt);
    try { sessionStorage.setItem("oi:image-prompt", prompt); } catch {}
    try { navigator.clipboard?.writeText(prompt); } catch {}
    setScenes(prev => prev.map(s => s.id === id ? { ...s, sentImage: true } : s));
    router.push("/image-studio");
  }
  function sendToVideo(id: string) {
    const sc = scenes.find(s => s.id === id);
    if (!sc) return;
    const prompt = withAnchor(sc.visualPrompt);
    try { sessionStorage.setItem("oi:video-prompt", prompt); } catch {}
    try { navigator.clipboard?.writeText(prompt); } catch {}
    setScenes(prev => prev.map(s => s.id === id ? { ...s, sentVideo: true } : s));
    router.push("/video-studio");
  }
  function injectVoice(id: string) {
    const sc = scenes.find(s => s.id === id);
    if (!sc) return;
    const voiceScript = sc.dialogue || sc.audioCue;
    try { sessionStorage.setItem("oi:voice-script", voiceScript); } catch {}
    try { navigator.clipboard?.writeText(voiceScript); } catch {}
    setScenes(prev => prev.map(s => s.id === id ? { ...s, sentVoice: true } : s));
    router.push("/voice-studio");
  }

  function addCharRef(file: File) {
    if (charRefs.length >= 5) { alert("Maximum 5 reference portraits."); return; }
    const ref: CharRef = { id: String(Date.now()), url: URL.createObjectURL(file), name: file.name.replace(/\.[^.]+$/, "") };
    setCharRefs(prev => [...prev, ref]);
  }

  return (
    <div className="storyboard mx-auto w-full min-w-0 max-w-[1600px] space-y-5 px-3 py-6 sm:px-6">
      <style jsx global>{`
        .storyboard button:not(:disabled){position:relative;display:inline-flex;align-items:center;justify-content:center;gap:0.4rem;min-height:2.2rem;padding:0.4rem 0.8rem;border:1px solid #352e52;border-radius:9px;background:linear-gradient(180deg,#221c3a 0%,#171327 100%);color:#d8d3ef;font-size:0.78rem;font-weight:600;cursor:pointer;transform:perspective(600px)translateZ(0);transform-style:preserve-3d;box-shadow:inset 0 1px 0 rgba(255,255,255,0.09),inset 0 -2px 0 rgba(0,0,0,0.5),0 3px 0 -1px #0a0813,0 8px 16px rgba(0,0,0,0.5);transition:transform 140ms ease,box-shadow 140ms ease,border-color 140ms ease,background 140ms ease}
        .storyboard button:not(:disabled):hover{transform:perspective(600px)translateZ(4px);border-color:#5a4d97;background:linear-gradient(180deg,#2a2249,#1b1630)}
        .storyboard button:not(:disabled):active{transform:perspective(600px)translateZ(-2px);box-shadow:inset 0 2px 6px rgba(0,0,0,0.72),0 1px 0 -1px #0a0813}
        .storyboard button:disabled{cursor:not-allowed;opacity:0.5}
        .storyboard .hud-panel{position:relative;border-color:#352e52;background:linear-gradient(180deg,#14121f 0%,#0b0a14 100%);box-shadow:inset 0 1px 0 rgba(255,255,255,0.035),0 14px 34px rgba(0,0,0,0.35)}
        .storyboard .hud-panel::before{content:"";position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,#6c63ff,#00f2fe,#6ee7b7,#e879f9);pointer-events:none}
        .storyboard .d3-tile{background:linear-gradient(145deg,#19162b 0%,#100e1a 100%);border:1px solid #262038;border-radius:10px;box-shadow:inset 0 1px 0 rgba(255,255,255,0.045),0 6px 16px rgba(0,0,0,0.4)}
        .storyboard .scene-card{border-color:#30294c;transition:border-color 180ms ease,box-shadow 180ms ease}
        .storyboard .scene-card:hover{border-color:#a69eff;box-shadow:0 0 26px rgba(108,99,255,0.18)}
      `}</style>

      <div className="flex items-center gap-3">
        <div className="grid size-11 place-items-center rounded-xl border border-[#6c63ff]/45 bg-[#6c63ff]/12 text-[#c5bfff] text-lg">🎬</div>
        <div>
          <h1 className="pilot-voice text-2xl">OmniStoryboard</h1>
          <p className="text-sm text-ash">Macro-planning layer: parse scripts into scenes, route prompts to image/video/voice studios, lock character consistency.</p>
        </div>
      </div>

      {/* Character Consistency Anchor toggled across the page (top banner) */}
      <div className="flex flex-wrap items-center gap-2 rounded-md border border-[#30294c] bg-[rgba(20,18,31,0.55)] px-3 py-2 backdrop-blur-[12px]">
        <span className="text-[10px] font-bold uppercase tracking-wider text-ash">Global character anchor</span>
        <label className="flex cursor-pointer items-center gap-2 text-xs text-ash">
          <button type="button" role="switch" aria-checked={globalAnchor} onClick={() => setGlobalAnchor(v => !v)} className={`relative inline-flex h-5 w-9 rounded-full transition ${globalAnchor ? "bg-[#6c63ff]" : "bg-[#211d34]"}`}>
            <span className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition ${globalAnchor ? "translate-x-4" : ""}`} />
          </button>
          <span className="font-mono text-[10px] text-[#e8e6f2]">{globalAnchor ? "ON (anchor appends to all gens)" : "OFF"}</span>
        </label>
        <span className="text-[10px] text-ash/70 ml-2">{charRefs.length}/5 portraits uploaded · {anchorLocked ? "anchor locked — prepended to prompts sent to Image & Video Studio." : "lock the anchor (right panel) to prepend it to prompts sent to Image & Video Studio."}</span>
      </div>

      {/* Three-column layout */}
      <div className="grid min-w-0 gap-5 xl:grid-cols-[420px_minmax(0,1fr)_300px]">
        {/* 1. Script Parsing Terminal (Left) */}
        <aside className="order-2 min-w-0 space-y-4 xl:order-1">
          <div className="hud-panel p-4 space-y-3">
            <h2 className="text-sm font-semibold text-[#e8e6f2] flex items-center gap-2"><span className="text-[#a69eff]">📝</span>Script Parsing Terminal</h2>
            <label className="text-[10px] font-bold uppercase tracking-wider text-ash" htmlFor="script">Script (markdown-supported)</label>
            <textarea id="script" value={script} onChange={e => setScript(e.target.value)} rows={16} className="w-full rounded-md border border-[#211d34] bg-[#0b0a14] px-3 py-2 text-xs font-mono leading-relaxed text-[#e8e6f2] placeholder:text-ash/60 focus:border-[#8b7fff]" />
            <button type="button" onClick={() => parseScript()} disabled={!script.trim()} className="d3-btn d3-btn--primary w-full">
              Analyze &amp; Fragment Script
            </button>
            <p className="text-[10px] text-ash/70">Auto-detects timestamps, character appearances, emotional dialogue, and required visual settings.</p>
          </div>
        </aside>

        {/* 2. Visual Storyboard Timeline (Center) */}
        <main className="order-1 min-w-0 space-y-4 xl:order-2">
          <div className="hud-panel p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[#e8e6f2] flex items-center gap-2"><span className="text-[#a69eff]">🎞</span>Visual Storyboard Timeline</h2>
              <span className="text-[10px] font-mono text-ash">{scenes.length} scenes</span>
            </div>
            {scenes.length === 0 ? (
              <div className="grid min-h-[300px] place-items-center rounded-md border border-dashed border-[#393252] bg-[#0b0a14] text-xs text-ash/60">
                Paste a script on the left, then click Analyze &amp; Fragment Script.
              </div>
            ) : (
              <div className="space-y-3">
                {scenes.map(sc => (
                  <div key={sc.id} className="scene-card rounded-lg border border-[#30294c] bg-[rgba(20,18,31,0.55)] p-3 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-bold text-[#e8e6f2]">Scene {sc.idx} · {sc.heading}</span>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="rounded-full border border-[#393252] bg-[#14121f] px-2 py-0.5 text-[9px] font-mono text-ash">{sc.timestamp}</span>
                        <span title="Suggested mood from a round-robin heuristic — not analyzed" className="rounded-full border border-[#e879f9]/40 bg-[#e879f9]/10 px-2 py-0.5 text-[9px] font-semibold text-[#f0abfc]">suggested: {sc.emotion}</span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[9px] font-bold uppercase tracking-wider text-[#a69eff]">Visual prompt</p>
                      <p className="text-xs leading-relaxed text-[#e8e6f2]">{sc.visualPrompt}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[9px] font-bold uppercase tracking-wider text-[#6ee7b7]">Audio cue</p>
                      <p className="text-xs leading-relaxed text-ash">{sc.audioCue}</p>
                    </div>
                    {sc.dialogue && (
                      <div className="space-y-1">
                        <p className="text-[9px] font-bold uppercase tracking-wider text-[#00f2fe]">Dialogue</p>
                        <p className="text-xs leading-relaxed text-[#b7b0c9]">{sc.dialogue}</p>
                      </div>
                    )}
                    {sc.characters.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1 pt-1">
                        <span className="text-[9px] text-ash/70">Characters:</span>
                        {sc.characters.map(ch => (
                          <span key={ch} className="rounded-full border border-[#6c63ff]/30 bg-[#6c63ff]/10 px-2 py-0.5 text-[9px] text-[#c5bfff] font-mono">{ch}</span>
                        ))}
                      </div>
                    )}
                    {/* quick routes */}
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <button type="button" onClick={() => sendToImage(sc.id)} disabled={sc.sentImage} className="d3-btn h-6 px-2 text-[10px]">
                        {sc.sentImage ? "✓ Opening Image Studio…" : "Send to Image Studio"}
                      </button>
                      <button type="button" onClick={() => sendToVideo(sc.id)} disabled={sc.sentVideo} className="d3-btn h-6 px-2 text-[10px]">
                        {sc.sentVideo ? "✓ Opening Video Studio…" : "Send to Video Studio"}
                      </button>
                      <button type="button" onClick={() => injectVoice(sc.id)} disabled={sc.sentVoice} className="d3-btn h-6 px-2 text-[10px]">
                        {sc.sentVoice ? "✓ Opening Voice Studio…" : "Send to Voice Studio"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>

        {/* 3. Character Consistency Anchor (Right Sidebar) */}
        <aside className="order-3 min-w-0 space-y-4">
          <div className="hud-panel p-4 space-y-3">
            <h2 className="text-sm font-semibold text-[#e8e6f2] flex items-center gap-2"><span className="text-[#a69eff]">🧬</span>Character Consistency Anchor</h2>
            <p className="text-[10px] text-ash leading-relaxed">Upload up to 5 reference portraits of the main character, then lock them as a project flag — when locked, every prompt this page sends to Image Studio or Video Studio starts with the same character-anchor marker, keeping facial structure consistent across scenes.</p>
            <input ref={fileInput} type="file" accept="image/*" multiple className="hidden" onChange={e => { Array.from(e.target.files ?? []).forEach(f => { if (charRefs.length < 5) addCharRef(f); }); e.currentTarget.value = ""; }} />
            <div className="grid grid-cols-5 gap-2">
              {Array.from({ length: 5 }).map((_, i) => {
                const ref = charRefs[i];
                return (
                  <div key={i} className={`group relative grid aspect-square place-items-center rounded-md border border-dashed text-[9px] transition ${ref ? "border-[#6c63ff] bg-[#6c63ff]/10" : "border-[#393252] bg-[#0b0a14] hover:border-[#8b7fff]/60"}`}>
                    {ref ? (
                      <>
                        <img src={ref.url} alt={ref.name} className="h-full w-full rounded-md object-cover" />
                        <button type="button" onClick={() => setCharRefs(prev => prev.filter(r => r.id !== ref.id))} className="absolute -right-1 -top-1 hidden h-4 w-4 place-items-center rounded-full bg-rose-500/80 text-[8px] text-white group-hover:grid">×</button>
                      </>
                    ) : (
                      <button type="button" onClick={() => fileInput.current?.click()} className="grid h-full w-full place-items-center text-ash/60 text-[8px]">slot {i + 1}</button>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => { setCharRefs([]); setAnchorLocked(false); try { sessionStorage.setItem("oi:anchor", "0"); } catch {} }} disabled={charRefs.length === 0} className="d3-btn h-7 px-2 text-[10px] disabled:opacity-50">Clear all</button>
              <button type="button" onClick={toggleAnchorLock} disabled={charRefs.length === 0} className={`d3-btn h-7 px-2 text-[10px] disabled:opacity-50 ${anchorLocked ? "border-[#6ee7b7]/60 text-[#6ee7b7]" : "d3-btn--primary"}`}>
                {anchorLocked ? "🔒 Anchor locked — click to unlock" : "Lock anchor (project flag)"}
              </button>
            </div>
            {anchorLocked && charRefs.length > 0 ? (
              <div className="rounded-md border border-[#6ee7b7]/40 bg-[#6ee7b7]/10 px-3 py-2 text-xs text-[#6ee7b7]">
                ✓ Anchor locked (project flag, kept for this browser session) · prompts sent to Image/Video Studio start with <span className="font-mono text-[10px]">{anchorMarker()}</span>
              </div>
            ) : charRefs.length > 0 ? (
              <div className="rounded-md border border-[#393252] bg-[#14121f] px-3 py-2 text-xs text-ash">
                {charRefs.length} portrait{charRefs.length === 1 ? "" : "s"} staged · marker <span className="font-mono text-[10px]">{anchorMarker()}</span> — not locked yet, so prompts are sent without it.
              </div>
            ) : null}
            <p className="text-[10px] text-ash/70">
              When locked, the anchor marker is prepended to prompts routed from this page into Image Studio and Video Studio. Voice Studio only receives dialogue text. (A true identity face-swap needs a face-swap provider, which isn&apos;t connected yet.)
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
