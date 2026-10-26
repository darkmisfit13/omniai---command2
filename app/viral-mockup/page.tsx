"use client";

import { useState, useCallback } from "react";
import { mediaVault, useMediaVault, vaultColor } from "@/lib/mediaVault";

type Platform = "TikTok" | "Instagram Reels" | "YouTube Shorts" | "Spotify Canvas" | "Apple App Store";
const PLATFORMS: Platform[] = ["TikTok", "Instagram Reels", "YouTube Shorts", "Spotify Canvas", "Apple App Store"];

export default function ViralMockupPage() {
  const assets = useMediaVault();
  const [platform, setPlatform] = useState<Platform>("TikTok");
  const [handle, setHandle] = useState("@darkmisfitstudios");
  const [caption, setCaption] = useState("New drop — watch till the end 🔥");
  const [hashtags, setHashtags] = useState("#fyp #viral #aiart #musicvideo");
  const [audioLabel, setAudioLabel] = useState("Original audio · DarkMisfitStudios");
  const [safeZones, setSafeZones] = useState(true);
  const [mediaUrl, setMediaUrl] = useState<string>("");
  const [mediaType, setMediaType] = useState<"none"|"image"|"video">("none");
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  const acceptDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const raw = e.dataTransfer.getData("application/x-media-asset");
    if (raw) {
      try {
        const a = JSON.parse(raw) as { url?: string; type?: string };
        if (!a.url) { setNotice({ ok: false, text: "That vault asset has no playable URL — drop a local file instead." }); return; }
        // use the asset's real type so a VIDEO vault asset renders as <video>, not <img>
        if (a.type === "video" || a.type === "image") {
          setMediaUrl(a.url);
          setMediaType(a.type);
          setNotice(null);
        } else {
          setNotice({ ok: false, text: `Vault asset is "${a.type}", not an image or video — drop an image/video file instead.` });
        }
        return;
      } catch { /* fall through to file drop */ }
    }
    const f = e.dataTransfer.files?.[0];
    if (f) {
      if (f.type.startsWith("image/")) { setMediaUrl(URL.createObjectURL(f)); setMediaType("image"); setNotice(null); }
      else if (f.type.startsWith("video/")) { setMediaUrl(URL.createObjectURL(f)); setMediaType("video"); setNotice(null); }
      else setNotice({ ok: false, text: "Drop an image or video file." });
    }
  }, []);

  /** Real mediaVault.push — the saved asset appears in the vault list on the right instantly. */
  function pushToVault() {
    if (!mediaUrl || mediaType === "none") { setNotice({ ok: false, text: "Drop an image or video into the phone first." }); return; }
    const asset = mediaVault.push({
      type: mediaType === "video" ? "video" : "image",
      name: `${platform} mockup · ${handle || "creator"}`,
      url: mediaUrl,
      meta: { source: `Viral Mockup Simulator · ${platform}`, prompt: caption },
    });
    setNotice({ ok: true, text: `Saved "${asset.name}" (${asset.type}) to the Media Vault — it's listed on the right and draggable into the phone.` });
  }

  // safe zones that vary by platform (ratios of width/height for "danger" regions)
  const safeZonesCfg: Record<Platform, { top: number; bottom: number; left: number; right: number; captionSide: string }> = {
    "TikTok": { top: 12, bottom: 22, left: 8, right: 18, captionSide: "bottom-6 left-3 right-16" },
    "Instagram Reels": { top: 10, bottom: 24, left: 6, right: 12, captionSide: "bottom-6 left-3 right-12" },
    "YouTube Shorts": { top: 12, bottom: 20, left: 8, right: 8, captionSide: "bottom-6 left-3 right-3" },
    "Spotify Canvas": { top: 4, bottom: 4, left: 4, right: 4, captionSide: "bottom-2 left-2 right-2" },
    "Apple App Store": { top: 0, bottom: 0, left: 0, right: 0, captionSide: "bottom-2 left-2 right-2" },
  };
  const cfg = safeZonesCfg[platform];

  return (
    <div className="viral-studio mx-auto w-full min-w-0 max-w-[1600px] space-y-5 px-3 py-6 sm:px-6">
      <style jsx global>{`
        .viral-studio button:not(:disabled){position:relative;display:inline-flex;align-items:center;justify-content:center;gap:0.4rem;min-height:2.35rem;padding:0.45rem 0.85rem;border:1px solid #352e52;border-radius:10px;background:linear-gradient(180deg,#221c3a 0%,#171327 100%);color:#d8d3ef;font-size:0.78rem;font-weight:600;cursor:pointer;transform:perspective(700px) translateZ(0px);transform-style:preserve-3d;box-shadow:inset 0 1px 0 rgba(255,255,255,0.09),inset 0 -2px 0 rgba(0,0,0,0.5),0 4px 0 -1px #0a0813,0 10px 20px rgba(0,0,0,0.55);transition:transform 140ms ease,box-shadow 140ms ease,border-color 140ms ease,background 140ms ease}
        .viral-studio button:not(:disabled):hover{transform:perspective(700px) translateZ(5px);border-color:#5a4d97;background:linear-gradient(180deg,#2a2249,#1b1630)}
        .viral-studio button:not(:disabled):active{transform:perspective(700px) translateZ(-3px);box-shadow:inset 0 2px 7px rgba(0,0,0,0.72),0 1px 0 -1px #0a0813}
        .viral-studio button:disabled{cursor:not-allowed;opacity:0.5}
        .viral-studio .hud-panel{position:relative;border-color:#352e52;background:linear-gradient(180deg,#14121f 0%,#0b0a14 100%);box-shadow:inset 0 1px 0 rgba(255,255,255,0.035),0 14px 34px rgba(0,0,0,0.35)}
        .viral-studio .hud-panel::before{content:"";position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,#6c63ff,#00f2fe,#6ee7b7,#e879f9);pointer-events:none}
      `}</style>

      <div className="flex items-center gap-3">
        <div className="grid size-11 place-items-center rounded-xl border border-[#6c63ff]/45 bg-[#6c63ff]/12 text-[#c5bfff] text-lg">📱</div>
        <div>
          <h1 className="pilot-voice text-2xl">Viral Mockup</h1>
          <p className="text-sm text-ash">Drag vault assets into a live phone viewport across platforms; guard safe zones.</p>
        </div>
      </div>

      <div className="grid min-w-0 gap-4 lg:grid-cols-[300px_minmax(0,1fr)_320px]">
        {/* LEFT: Placement Configurator */}
        <aside className="order-2 min-w-0 space-y-4 lg:order-1">
          <div className="hud-panel p-4 space-y-3">
            <h2 className="text-sm font-semibold text-[#e8e6f2] flex items-center gap-2"><span className="text-[#a69eff]">📱</span>Placement Configurator</h2>
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-ash">Platform</p>
              <div className="flex flex-wrap gap-1.5">
                {PLATFORMS.map(p => (
                  <button key={p} type="button" onClick={() => setPlatform(p)} className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold transition ${platform === p ? "border-[#a69eff] bg-[#6c63ff]/20 text-[#c5bfff]" : "border-[#211d34] text-ash hover:text-[#e8e6f2]"}`}>
                    {p}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-ash" htmlFor="handle">Creator handle</label>
              <input id="handle" value={handle} onChange={e => setHandle(e.target.value)} className="w-full h-9 rounded-md border border-[#211d34] bg-[#0b0a14] px-3 text-sm text-[#e8e6f2] focus:border-[#8b7fff]" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-ash" htmlFor="caption">Caption / description</label>
              <textarea id="caption" value={caption} onChange={e => setCaption(e.target.value)} rows={2} className="w-full rounded-md border border-[#211d34] bg-[#0b0a14] px-3 py-2 text-sm text-[#e8e6f2] placeholder:text-ash/60 focus:border-[#8b7fff]" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-ash" htmlFor="hashtags">Hashtag injection</label>
              <input id="hashtags" value={hashtags} onChange={e => setHashtags(e.target.value)} className="w-full h-9 rounded-md border border-[#211d34] bg-[#0b0a14] px-3 text-sm text-[#e8e6f2] placeholder:text-ash/60 focus:border-[#8b7fff]" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-ash" htmlFor="audio">Custom audio track label</label>
              <input id="audio" value={audioLabel} onChange={e => setAudioLabel(e.target.value)} className="w-full h-9 rounded-md border border-[#211d34] bg-[#0b0a14] px-3 text-sm text-[#e8e6f2] placeholder:text-ash/60 focus:border-[#8b7fff]" />
            </div>
            <button type="button" onClick={pushToVault} className="d3-btn d3-btn--primary w-full">
              Push mockup to vault
            </button>
            {notice && (
              <p className={`rounded-md border px-3 py-2 text-xs leading-relaxed ${notice.ok ? "border-[#6ee7b7]/40 bg-[#6ee7b7]/10 text-[#6ee7b7]" : "border-rose-500/40 bg-rose-500/10 text-rose-300"}`}>
                {notice.text}
              </p>
            )}
          </div>
        </aside>

        {/* CENTER: 3D device sandbox */}
        <section className="order-1 min-w-0 space-y-3 lg:order-2">
          <div className="hud-panel p-3">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[#e8e6f2]">Real-Time Interactive Device Sandbox</h2>
              <label className="flex cursor-pointer items-center gap-2 text-xs text-ash">
                <input type="checkbox" checked={safeZones} onChange={e => setSafeZones(e.target.checked)} className="accent-[#6c63ff]" />
                Show Platform Safe Zones
              </label>
            </div>
            <div className="relative mx-auto grid place-items-center" style={{ perspective: 900 }}>
              <div className="relative h-[520px] w-[260px]" style={{ transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`, transformStyle: "preserve-3d", transition: "transform 200ms cubic-bezier(.2,.7,.3,1)" }} onMouseMove={e => { const r = (e.currentTarget as any).getBoundingClientRect(); setTilt({ x: (e.clientY - r.top - r.height / 2) / r.height * 18, y: (e.clientX - r.left - r.width / 2) / r.width * 24 }); }} onMouseLeave={() => setTilt({ x: 0, y: 0 })}>
                {/* device frame */}
                <div className="absolute inset-0 rounded-[30px] border-2 border-[#393252] bg-gradient-to-b from-[#19162b] to-[#0b0a14] shadow-[0_20px_60px_rgba(0,0,0,0.6),0_0_40px_rgba(108,99,255,0.18)]">
                  {/* notch */}
                  <div className="absolute left-1/2 top-2 h-4 w-20 -translate-x-1/2 rounded-b-2xl bg-black" />
                </div>
                {/* screen */}
                <div onDragOver={e => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={acceptDrop}
                  className={`absolute left-3 right-3 top-10 bottom-3 overflow-hidden rounded-[20px] border border-[#211d34] bg-black ${dragging ? "ring-2 ring-[#6c63ff]" : ""}`}>
                  {mediaType === "video" && mediaUrl ? <video src={mediaUrl} className="h-full w-full object-cover" autoPlay muted loop /> : mediaType === "image" && mediaUrl ? <img src={mediaUrl} alt="mockup" className="h-full w-full object-cover" /> : (
                    <div className="grid h-full place-items-center bg-gradient-to-br from-[#19162b] via-[#0b0a14] to-[#0d1020] text-xs text-ash/60">
                      Drop an asset from your Media Vault on the left
                    </div>
                  )}
                  {/* platform UI overlay */}
                  <div className="pointer-events-none absolute inset-0">
                    {/* top handle */}
                    <div className="absolute left-2 top-2 flex items-center gap-1 text-[9px] text-white/80">
                      <span className="font-semibold">{handle}</span>
                      <span className="opacity-60">· {platform}</span>
                    </div>
                    {/* safe zones */}
                    {safeZones && (
                      <>
                        <div className="absolute top-0 inset-x-0 bg-red-500/25" style={{ height: cfg.top + "%" }} />
                        <div className="absolute bottom-0 inset-x-0 bg-red-500/25" style={{ height: cfg.bottom + "%" }} />
                        <div className="absolute top-0 left-0 bottom-0 bg-red-500/15" style={{ width: cfg.left + "%" }} />
                        <div className="absolute top-0 right-0 bottom-0 bg-red-500/15" style={{ width: cfg.right + "%" }} />
                      </>
                    )}
                    {/* bottom caption */}
                    <div className={`absolute ${cfg.captionSide} space-y-1`}>
                      <p className="text-[9px] leading-3 text-white drop-shadow">{caption}</p>
                      <p className="text-[8px] text-white/80 drop-shadow">{hashtags}</p>
                      <p className="text-[8px] text-white/70 drop-shadow">♩ {audioLabel}</p>
                    </div>
                    {/* like/comment/share right side */}
                    <div className="absolute right-2 bottom-20 flex flex-col items-center gap-3 text-white/90">
                      <span className="text-lg drop-shadow">❤</span>
                      <span className="text-lg drop-shadow">💬</span>
                      <span className="text-lg drop-shadow">↗</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <p className="text-center text-[10px] text-ash mt-2">Tilt your pointer to orbit the 3D phone. Drop a vault asset or file to preview.</p>
            {notice && (
              <p className={`mx-auto max-w-md rounded-md border px-3 py-1.5 text-center text-[10px] leading-relaxed ${notice.ok ? "border-[#6ee7b7]/40 bg-[#6ee7b7]/10 text-[#6ee7b7]" : "border-rose-500/40 bg-rose-500/10 text-rose-300"}`}>
                {notice.text}
              </p>
            )}
          </div>
        </section>

        {/* RIGHT: Safe guard */}
        <aside className="order-3 min-w-0 space-y-4">
          <div className="hud-panel p-4 space-y-3">
            <h2 className="text-sm font-semibold text-[#e8e6f2] flex items-center gap-2"><span className="text-[#a69eff]">🛡</span>Aspect Ratio &amp; Safe-Zone Guard</h2>
            <div className="flex items-center justify-between rounded-md border border-[#211d34] p-2">
              <span className="text-xs text-ash">Show Platform Safe Zones</span>
              <button type="button" onClick={() => setSafeZones(v => !v)} className={`rounded-full border px-3 py-1 text-[10px] font-semibold transition ${safeZones ? "border-[#ef4444] bg-[#ef4444]/15 text-rose-300" : "border-[#211d34] text-ash hover:text-[#e8e6f2]"}`}>
                {safeZones ? "ON" : "OFF"}
              </button>
            </div>
            <div className="text-xs text-ash space-y-1 rounded-md border border-[#211d34] bg-[#0b0a14] p-3">
              <p className="font-bold text-[#e8e6f2]">{platform} safe-guard report</p>
              <p>• Top UI region (profile + title): <span style={{ color: "#f87171" }}>{cfg.top}%</span></p>
              <p>• Bottom UI region (buttons + caption): <span style={{ color: "#f87171" }}>{cfg.bottom}%</span></p>
              <p>• Left column: <span style={{ color: "#f87171" }}>{cfg.left}%</span></p>
              <p>• Right column (like/comment/share): <span style={{ color: "#f87171" }}>{cfg.right}%</span></p>
              <p className="pt-1 text-[10px] text-ash/70">Keep vital text inside the clear region. The red grid shows where social-app UI blocks your media.</p>
            </div>
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-ash">Vault assets (drag into phone)</p>
              <div className="max-h-[240px] space-y-1 overflow-y-auto pr-1">
                {assets.length === 0 && <p className="text-xs text-ash/70">vault empty.</p>}
                {assets.map(a => (
                  <div key={a.id} draggable onDragStart={e => { e.dataTransfer.setData("application/x-media-asset", JSON.stringify(a)); e.dataTransfer.effectAllowed = "copyMove"; }} className="flex cursor-grab items-center gap-2 rounded-md border border-[#211d34] bg-[#0b0a14] px-2 py-1.5 text-xs text-ash hover:border-[#8b7fff]/60 active:cursor-grabbing">
                    <span className="size-6 rounded grid place-items-center border border-[#211d34]" style={{ background: `linear-gradient(135deg, ${vaultColor(a.type)}55, #0b0a14)`, color: vaultColor(a.type) }}>{a.type[0].toUpperCase()}</span>
                    <span className="truncate flex-1">{a.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
