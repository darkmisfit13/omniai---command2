"use client";

import { useState, useCallback } from "react";
import { mediaVault, useMediaVault, vaultColor } from "@/lib/mediaVault";

type Platform = "TikTok" | "Instagram Reels" | "YouTube Shorts" | "Spotify Canvas" | "Apple App Store";
const PLATFORMS: Platform[] = ["TikTok", "Instagram Reels", "YouTube Shorts", "Spotify Canvas", "Apple App Store"];

type PhonePane = "Swipe Left" | "Center Feed" | "Swipe Right";

export default function ViralMockupPage() {
  const assets = useMediaVault();
  const [platform, setPlatform] = useState<Platform>("TikTok");
  const [phonePane, setPhonePane] = useState<PhonePane>("Center Feed");
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

  // safe zones configuration per platform
  const safeZonesCfg: Record<Platform, { top: number; bottom: number; left: number; right: number; captionSide: string }> = {
    "TikTok": { top: 12, bottom: 22, left: 8, right: 18, captionSide: "bottom-6 left-3 right-16" },
    "Instagram Reels": { top: 10, bottom: 24, left: 6, right: 12, captionSide: "bottom-6 left-3 right-12" },
    "YouTube Shorts": { top: 12, bottom: 20, left: 8, right: 8, captionSide: "bottom-6 left-3 right-3" },
    "Spotify Canvas": { top: 4, bottom: 4, left: 4, right: 4, captionSide: "bottom-2 left-2 right-2" },
    "Apple App Store": { top: 0, bottom: 0, left: 0, right: 0, captionSide: "bottom-2 left-2 right-2" },
  };
  const cfg = safeZonesCfg[platform];

  return (
    <div className="viral-studio mx-auto w-full min-w-0 max-w-[1600px] space-y-5 px-3 py-6 sm:px-6 bg-[#000000] text-slate-200">
      <style jsx global>{`
        .viral-studio button:not(:disabled){
          position:relative;
          display:inline-flex;
          align-items:center;
          justify-content:center;
          gap:0.4rem;
          min-height:2.35rem;
          padding:0.45rem 0.85rem;
          border:1px solid #1f1638;
          border-radius:10px;
          background:#0a071b;
          color:#d8d3ef;
          font-size:0.78rem;
          font-weight:600;
          cursor:pointer;
          box-shadow:inset 0 1px 0 rgba(255,255,255,0.06),0 4px 12px rgba(0,0,0,0.6);
          transition:all 140ms ease;
        }
        .viral-studio button:not(:disabled):hover{
          border-color:#0C00CA;
          box-shadow:0 0 20px rgba(12,0,202,0.45);
          background:#130e2f;
        }
        .viral-studio .hud-panel{
          position:relative;
          border:1px solid #1f1638;
          border-radius:14px;
          background:#0a071b;
          box-shadow:0 14px 34px rgba(0,0,0,0.6);
        }
        .viral-studio .hud-panel::before{
          content:"";
          position:absolute;
          top:0;left:0;right:0;
          height:2px;
          background:linear-gradient(90deg,#0C00CA,#00ffff,#0C00CA);
          pointer-events:none;
        }
      `}</style>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-xl border border-[#0C00CA]/50 bg-[#0C00CA]/20 text-[#00ffff] text-lg shadow-[0_0_15px_rgba(12,0,202,0.35)]">
            📱
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-white">Viral Mockup &amp; Mobile Phone Studio</h1>
              <span className="font-mono text-[10px] px-2 py-0.5 rounded border border-[#00ffff]/40 bg-[#00ffff]/10 text-[#00ffff] font-bold">
                [Nexus-Inference: Max-Speed / Local-Ollama Override]
              </span>
            </div>
            <p className="text-sm text-slate-400">
              Drag vault assets into a live phone viewport across swipe panes; guard safe zones with Baby Blue hazard detection.
            </p>
          </div>
        </div>

        {/* Global Phone Pane Navigator [Swipe Left | Center Feed | Swipe Right] */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl border border-[#1f1638] bg-[#0a071b] shadow-[0_0_20px_rgba(0,0,0,0.5)]">
          {(["Swipe Left", "Center Feed", "Swipe Right"] as PhonePane[]).map((pane) => {
            const isActive = phonePane === pane;
            return (
              <button
                key={pane}
                type="button"
                onClick={() => setPhonePane(pane)}
                className={`px-3 py-1.5 text-xs font-mono font-bold rounded-lg transition ${
                  isActive
                    ? "bg-[#0C00CA] text-white border border-[#0C00CA] shadow-[0_0_18px_rgba(12,0,202,0.6)]"
                    : "text-slate-400 hover:text-white border border-transparent hover:border-[#1f1638]"
                }`}
              >
                {pane}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid min-w-0 gap-4 lg:grid-cols-[300px_minmax(0,1fr)_320px]">
        {/* LEFT: Placement Configurator */}
        <aside className="order-2 min-w-0 space-y-4 lg:order-1">
          <div className="hud-panel p-4 space-y-3">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <span className="text-[#6366f1]">📱</span> Placement Configurator
            </h2>
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#00ffcc] font-mono">Platform Preset</p>
              <div className="flex flex-wrap gap-1.5">
                {PLATFORMS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPlatform(p)}
                    className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold transition ${
                      platform === p
                        ? "border-[#6366f1] bg-[#6366f1]/20 text-white shadow-[0_0_12px_rgba(99,102,241,0.3)]"
                        : "border-[#1f1638] text-slate-400 hover:text-white hover:border-[#6366f1]/40"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono" htmlFor="handle">
                Creator Handle
              </label>
              <input
                id="handle"
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                className="w-full h-9 rounded-lg border border-[#1f1638] bg-[#000000] px-3 text-sm text-white focus:border-[#6366f1] focus:outline-none focus:ring-1 focus:ring-[#6366f1]"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono" htmlFor="caption">
                Caption / Description
              </label>
              <textarea
                id="caption"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-[#1f1638] bg-[#000000] px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-[#6366f1] focus:outline-none focus:ring-1 focus:ring-[#6366f1]"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono" htmlFor="hashtags">
                Hashtag Injection
              </label>
              <input
                id="hashtags"
                value={hashtags}
                onChange={(e) => setHashtags(e.target.value)}
                className="w-full h-9 rounded-lg border border-[#1f1638] bg-[#000000] px-3 text-sm text-white placeholder:text-slate-600 focus:border-[#6366f1] focus:outline-none focus:ring-1 focus:ring-[#6366f1]"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono" htmlFor="audio">
                Custom Audio Track Label
              </label>
              <input
                id="audio"
                value={audioLabel}
                onChange={(e) => setAudioLabel(e.target.value)}
                className="w-full h-9 rounded-lg border border-[#1f1638] bg-[#000000] px-3 text-sm text-white placeholder:text-slate-600 focus:border-[#6366f1] focus:outline-none focus:ring-1 focus:ring-[#6366f1]"
              />
            </div>
            <button
              type="button"
              onClick={pushToVault}
              className="w-full !bg-[#6366f1] !text-white font-bold !border-[#6366f1] shadow-[0_0_15px_rgba(99,102,241,0.3)] hover:!bg-[#7579f3]"
            >
              Push Mockup to Vault
            </button>
            {notice && (
              <p
                className={`rounded-lg border px-3 py-2 text-xs leading-relaxed font-mono ${
                  notice.ok
                    ? "border-[#00ffcc]/40 bg-[#00ffcc]/10 text-[#00ffcc]"
                    : "border-rose-500/40 bg-rose-500/10 text-rose-300"
                }`}
              >
                {notice.text}
              </p>
            )}
          </div>
        </aside>

        {/* CENTER: 3D Device Sandbox */}
        <section className="order-1 min-w-0 space-y-3 lg:order-2">
          <div className="hud-panel p-4 bg-[#0a071b] border-[#1f1638]">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-white">Interactive Nexus Device Canvas</h2>
                <p className="text-[10px] font-mono text-[#00ffcc]">
                  Active Pane: <span className="font-bold uppercase">{phonePane}</span> · Resolution: 1080x1920 (9:16)
                </p>
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-300 font-mono">
                <input
                  type="checkbox"
                  checked={safeZones}
                  onChange={(e) => setSafeZones(e.target.checked)}
                  className="accent-[#00ffcc]"
                />
                <span className="text-[#00ffcc]">Hazard Safe-Zone Lines</span>
              </label>
            </div>

            <div className="relative mx-auto grid place-items-center py-4" style={{ perspective: 900 }}>
              <div
                className="relative h-[530px] w-[270px]"
                style={{
                  transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
                  transformStyle: "preserve-3d",
                  transition: "transform 200ms cubic-bezier(.2,.7,.3,1)",
                }}
                onMouseMove={(e) => {
                  const r = (e.currentTarget as any).getBoundingClientRect();
                  setTilt({
                    x: ((e.clientY - r.top - r.height / 2) / r.height) * 16,
                    y: ((e.clientX - r.left - r.width / 2) / r.width) * 20,
                  });
                }}
                onMouseLeave={() => setTilt({ x: 0, y: 0 })}
              >
                {/* Device Frame */}
                <div className="absolute inset-0 rounded-[32px] border-2 border-[#1f1638] bg-[#000000] shadow-[0_20px_60px_rgba(0,0,0,0.9),0_0_35px_rgba(99,102,241,0.25)]">
                  {/* Speaker Notch */}
                  <div className="absolute left-1/2 top-2 h-4 w-20 -translate-x-1/2 rounded-b-xl bg-[#0a071b] border-b border-x border-[#1f1638]" />
                </div>

                {/* Phone Screen Canvas (Pure Velvet Black #000000) */}
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={acceptDrop}
                  className={`absolute left-2.5 right-2.5 top-9 bottom-3 overflow-hidden rounded-[22px] border border-[#1f1638] bg-[#000000] ${
                    dragging ? "ring-2 ring-[#0C00CA] shadow-[0_0_20px_rgba(12,0,202,0.65)]" : ""
                  }`}
                >
                  {/* Phone Pane Content Display */}
                  {phonePane === "Swipe Left" ? (
                    <div className="grid h-full place-items-center bg-[#000000] p-4 text-center">
                      <div className="space-y-2">
                        <div className="mx-auto size-12 rounded-full border border-[#0C00CA] bg-[#0a071b] flex items-center justify-center text-[#00ffff] font-mono text-sm shadow-[0_0_12px_rgba(12,0,202,0.4)]">
                          PRO
                        </div>
                        <h4 className="text-xs font-bold text-white">Creator Channel</h4>
                        <p className="text-[10px] text-slate-400">Swipe Left pane: Profile stats, bio, and pinned matrix reels.</p>
                        <span className="inline-block font-mono text-[9px] px-2 py-0.5 rounded bg-[#1f1638] text-[#00ffff] font-bold">
                          Nexus Synced
                        </span>
                      </div>
                    </div>
                  ) : phonePane === "Swipe Right" ? (
                    <div className="grid h-full place-items-center bg-[#000000] p-4 text-center">
                      <div className="space-y-2">
                        <div className="mx-auto size-12 rounded-full border border-[#00ffff] bg-[#0a071b] flex items-center justify-center text-[#00ffff] font-mono text-sm shadow-[0_0_12px_rgba(0,255,255,0.4)]">
                          ⚡
                        </div>
                        <h4 className="text-xs font-bold text-white">Interactive Matrix Feed</h4>
                        <p className="text-[10px] text-slate-400">Swipe Right pane: Community reactions, real-time tips &amp; stems.</p>
                        <span className="inline-block font-mono text-[9px] px-2 py-0.5 rounded bg-[#1f1638] text-[#00ffff] font-bold">
                          Telemetry Active
                        </span>
                      </div>
                    </div>
                  ) : (
                    /* Center Feed */
                    <>
                      {mediaType === "video" && mediaUrl ? (
                        <video src={mediaUrl} className="h-full w-full object-cover" autoPlay muted loop />
                      ) : mediaType === "image" && mediaUrl ? (
                        <img src={mediaUrl} alt="mockup" className="h-full w-full object-cover" />
                      ) : (
                        <div className="grid h-full place-items-center bg-[#000000] p-3 text-center text-xs text-slate-500">
                          <div className="space-y-2">
                            <div className="mx-auto size-10 rounded-full border border-dashed border-[#6366f1]/60 flex items-center justify-center text-[#6366f1]">
                              +
                            </div>
                            <p className="text-[11px] text-slate-400">Drop an asset from your Media Vault on the right</p>
                            <span className="text-[9px] font-mono text-[#00ffcc]">[Pure Velvet Canvas: #000000]</span>
                          </div>
                        </div>
                      )}

                      {/* Platform UI Overlay */}
                      <div className="pointer-events-none absolute inset-0">
                        {/* Top Handle */}
                        <div className="absolute left-2.5 top-2 flex items-center gap-1.5 text-[9px] text-white">
                          <span className="font-bold text-white">{handle}</span>
                          <span className="font-mono text-[#00ffcc]">· {platform}</span>
                        </div>

                        {/* Safe-Zone Hazard Outlines in High-Contrast Vibrant Neon Green (#00ffcc) */}
                        {safeZones && (
                          <>
                            {/* Top Hazard Overlay */}
                            <div
                              className="absolute top-0 inset-x-0 border-b-2 border-dashed border-[#00ffcc] bg-[#00ffcc]/10 flex items-center justify-center"
                              style={{ height: cfg.top + "%" }}
                            >
                              <span className="font-mono text-[8px] font-bold text-[#00ffcc] px-1 bg-[#000000]/80 rounded border border-[#00ffcc]/40">
                                HAZARD SAFE-ZONE TOP ({cfg.top}%)
                              </span>
                            </div>
                            {/* Bottom Hazard Overlay */}
                            <div
                              className="absolute bottom-0 inset-x-0 border-t-2 border-dashed border-[#00ffcc] bg-[#00ffcc]/10 flex items-center justify-center"
                              style={{ height: cfg.bottom + "%" }}
                            >
                              <span className="font-mono text-[8px] font-bold text-[#00ffcc] px-1 bg-[#000000]/80 rounded border border-[#00ffcc]/40">
                                HAZARD SAFE-ZONE BOTTOM ({cfg.bottom}%)
                              </span>
                            </div>
                            {/* Left Hazard Line */}
                            <div
                              className="absolute top-0 left-0 bottom-0 border-r-2 border-dashed border-[#00ffcc] bg-[#00ffcc]/5"
                              style={{ width: cfg.left + "%" }}
                            />
                            {/* Right Hazard Line */}
                            <div
                              className="absolute top-0 right-0 bottom-0 border-l-2 border-dashed border-[#00ffcc] bg-[#00ffcc]/5"
                              style={{ width: cfg.right + "%" }}
                            />
                          </>
                        )}

                        {/* Bottom Caption */}
                        <div className={`absolute ${cfg.captionSide} space-y-1`}>
                          <p className="text-[9px] leading-3 text-white drop-shadow-md font-medium">{caption}</p>
                          <p className="text-[8px] text-[#6366f1] drop-shadow-md font-mono">{hashtags}</p>
                          <p className="text-[8px] text-slate-300 drop-shadow-md flex items-center gap-1 font-mono">
                            <span className="text-[#00ffcc]">♩</span> {audioLabel}
                          </p>
                        </div>

                        {/* Like/Comment/Share on Right Side */}
                        <div className="absolute right-2 bottom-20 flex flex-col items-center gap-3 text-white">
                          <span className="text-base drop-shadow hover:text-[#6366f1]">❤</span>
                          <span className="text-base drop-shadow hover:text-[#6366f1]">💬</span>
                          <span className="text-base drop-shadow hover:text-[#00ffcc]">↗</span>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            <p className="text-center text-[10px] font-mono text-slate-400 mt-2">
              Tilt pointer to orbit the 3D Nexus phone. Select Swipe Panes or toggle Real-Time Hazard Safe-Zone Lines.
            </p>
          </div>
        </section>

        {/* RIGHT: Safe Guard & Vault Assets */}
        <aside className="order-3 min-w-0 space-y-4">
          <div className="hud-panel p-4 space-y-3">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <span className="text-[#00ffcc]">🛡</span> Aspect Ratio &amp; Safe-Zone Guard
            </h2>
            <div className="flex items-center justify-between rounded-xl border border-[#1f1638] bg-[#000000] p-2.5">
              <span className="text-xs text-slate-300 font-mono">Real-Time Safe Zones</span>
              <button
                type="button"
                onClick={() => setSafeZones((v) => !v)}
                className={`rounded-lg border px-3 py-1 text-[10px] font-mono font-bold transition ${
                  safeZones
                    ? "border-[#00ffcc] bg-[#00ffcc]/15 text-[#00ffcc] shadow-[0_0_12px_rgba(0,255,204,0.3)]"
                    : "border-[#1f1638] text-slate-500 hover:text-white"
                }`}
              >
                {safeZones ? "ACTIVE [ON]" : "MUTED [OFF]"}
              </button>
            </div>

            {/* Diagnostic Metrics in Vibrant Neon Green */}
            <div className="text-xs font-mono space-y-1.5 rounded-xl border border-[#1f1638] bg-[#000000] p-3 text-slate-300">
              <p className="font-bold text-[#00ffcc] uppercase tracking-wider">{platform} Telemetry Safe-Guard</p>
              <p className="flex justify-between">
                <span>Top UI Region:</span> <strong className="text-[#00ffcc]">{cfg.top}%</strong>
              </p>
              <p className="flex justify-between">
                <span>Bottom UI Region:</span> <strong className="text-[#00ffcc]">{cfg.bottom}%</strong>
              </p>
              <p className="flex justify-between">
                <span>Left Boundary:</span> <strong className="text-[#00ffcc]">{cfg.left}%</strong>
              </p>
              <p className="flex justify-between">
                <span>Right Boundary:</span> <strong className="text-[#00ffcc]">{cfg.right}%</strong>
              </p>
              <p className="pt-2 text-[10px] text-slate-500 border-t border-[#1f1638] leading-relaxed">
                Keep primary text &amp; key subjects inside the clear safe region. The Neon Green hazard box highlights blocked UI layers.
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-semibold">
                Vault Assets (Drag directly into phone)
              </p>
              <div className="max-h-[220px] space-y-1.5 overflow-y-auto pr-1">
                {assets.length === 0 && <p className="text-xs font-mono text-slate-500">Vault empty.</p>}
                {assets.map((a) => (
                  <div
                    key={a.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("application/x-media-asset", JSON.stringify(a));
                      e.dataTransfer.effectAllowed = "copyMove";
                    }}
                    className="flex cursor-grab items-center gap-2 rounded-lg border border-[#1f1638] bg-[#000000] px-2.5 py-2 text-xs text-slate-300 hover:border-[#6366f1] hover:shadow-[0_0_12px_rgba(99,102,241,0.25)] active:cursor-grabbing transition"
                  >
                    <span
                      className="size-6 rounded grid place-items-center border border-[#1f1638] font-mono text-[10px] font-bold"
                      style={{
                        background: `linear-gradient(135deg, ${vaultColor(a.type)}40, #0a071b)`,
                        color: vaultColor(a.type),
                      }}
                    >
                      {a.type[0].toUpperCase()}
                    </span>
                    <span className="truncate flex-1 font-mono text-[11px]">{a.name}</span>
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
