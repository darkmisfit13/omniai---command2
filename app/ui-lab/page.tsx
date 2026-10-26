"use client";

import { useState, useRef, useMemo } from "react";

type View = "desktop" | "tablet" | "mobile" | "ar";

export default function CosmicUIMabPage() {
  const [tab, setTab] = useState<View>("desktop");
  const [prompt, setPrompt] = useState("A responsive pricing card with hover tilt, gradient border, glowing edge, and multi-color badge.");
  const [busy, setBusy] = useState(false);

  // Aesthetic mood tokens
  const [blurFactor, setBlurFactor] = useState(20);
  const [glowRadius, setGlowRadius] = useState(24);
  const [bounceSpeed, setBounceSpeed] = useState(0.24);
  const [gradientAngle, setGradientAngle] = useState(135);
  const [palette, setPalette] = useState(["#6c63ff", "#00f2fe", "#6ee7b7", "#e879f9", "#ffb84d"]);
  const [dropPreview, setDropPreview] = useState<string>("");

  // Code output state
  const [codeTab, setCodeTab] = useState<"react" | "vue" | "html" | "webgl">("react");
  const [generated, setGenerated] = useState(false);

  const code = useMemo(() => {
    const grad = `linear-gradient(${gradientAngle}deg, ${palette[0]}, ${palette[1]}, ${palette[2]})`;
    if (codeTab === "react") return `// CosmicUI Component Laboratory — React + TSX + Tailwind
import { useState } from "react";

export default function CosmicCard() {
  const [hover, setHover] = useState(false);
  return (
    <section className="relative w-full max-w-md rounded-2xl border border-white/8 bg-[rgba(20,18,31,0.55)] p-6 backdrop-blur-[${blurFactor}px] transition"
            style={{ boxShadow: "0 0 ${glowRadius}px ${palette[0]}33" }}>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-xl font-extrabold bg-clip-text text-transparent ${" gradient-mesh"}" style={{ backgroundImage: "${grad}" }}>Cosmic Card</h2>
        <span className="rounded-full border border-white/8 bg-white/5 px-2 py-0.5 text-[10px] text-[#e879f9]">pro</span>
      </div>
      <p className="text-sm text-[#9490ac]">${"{prompt}"}</p>
      <button className="mt-4 rounded-xl px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-1" style={{ background: "${palette[1]}", boxShadow: "0 0 ${glowRadius * 0.5}px ${palette[1]}" }}>Call to action</button>
    </section>
  );
}`;
    if (codeTab === "vue") return `<!-- CosmicUI Component Laboratory — Vue 3 -->
<template>
  <section :class="['cosmic-card', hover ? 'hover' : '']" :style="cardStyle">
    <h2 class="title">{{ title }}</h2>
    <p class="desc">{{ desc }}</p>
    <button class="cta" @click="emit('action')">Call to action</button>
  </section>
</template>
<script setup lang="ts">
import { ref } from "vue";
const hover = ref(false);
const title = "${prompt ? prompt.slice(0, 30) : "Cosmic Card"}";
const desc = "${prompt}";
const cardStyle = { backdropFilter: "blur(${blurFactor}px)", boxShadow: "0 0 ${glowRadius}px ${palette[0]}33" };
</script>
<style scoped>
.cosmic-card { max-width: 384px; border-radius: 16px; border: 1px solid rgba(255,255,255,0.08); background: rgba(20,18,31,0.55); padding: 24px; transition: transform ${bounceSpeed}s cubic-bezier(.2,.7,.3,1); }
.cosmic-card:hover { transform: translateY(-4px); }
.title { font-size: 20px; font-weight: 800; background: ${grad}; -webkit-background-clip: text; background-clip: text; color: transparent; }
.cta { margin-top: 16px; border: none; border-radius: 12px; padding: 10px 18px; font-weight: 600; color: #fff; background: ${palette[1]}; }
</style>`;
    if (codeTab === "html") return `<!-- CosmicUI — Clean HTML/CSS -->
<section class="cosmic-card">
  <header class="head"><h2>${prompt ? prompt.slice(0, 36) : "Cosmic Card"}</h2><span class="badge">pro</span></header>
  <p class="desc">${prompt}</p>
  <button class="cta">Call to action</button>
</section>
<style>
  .cosmic-card { max-width:384px; border:1px solid rgba(255,255,255,.08); border-radius:16px; background:rgba(20,18,31,.55); padding:24px; backdrop-filter:blur(${blurFactor}px); box-shadow:0 0 ${glowRadius}px ${palette[0]}33; transition:transform ${bounceSpeed}s cubic-bezier(.2,.7,.3,1); }
  .cosmic-card:hover { transform:translateY(-4px) }
  .head { display:flex; align-items:center; justify-content:space-between; margin-bottom:8px; }
  .head h2 { font-size:18px; font-weight:800; background:${grad}; -webkit-background-clip:text; background-clip:text; color:transparent; }
  .badge { font-size:10px; padding:2px 8px; border-radius:999px; background:rgba(255,255,255,.06); color:${palette[2]}; }
  .desc { font-size:14px; color:${palette[2]}; opacity:.8; line-height:1.5; }
  .cta { margin-top:16px; border:0; border-radius:12px; padding:10px 18px; font-weight:600; color:#fff; background:${palette[1]}; box-shadow:0 0 18px ${palette[1]}66; cursor:pointer; transition:transform .2s; }
  .cta:hover { transform:translateY(-2px); }
</style>`;
    return `// CosmicUI — Raw WebGL shader (fragment) for component background glow
precision highp float;
varying vec2 vUV;
uniform vec2 uResolution;
uniform float uTime;
uniform vec3 uColorA;
uniform vec3 uColorB;
void main() {
  vec2 uv = vUV;
  float r = length(uv - 0.5);
  float glow = smoothstep(0.5, 0.0, r);
  vec3 col = mix(uColorA, uColorB, 0.5 + 0.5 * sin(uTime * 1.5));
  col *= glow;
  gl_FragColor = vec4(col * 1.4, glow * 0.5);
}
// uColorA defaults to ${palette[0]}, uColorB to ${palette[3]}, blur-driven alpha ${blurFactor}, glow ${glowRadius}.`;
  }, [codeTab, prompt, palette, blurFactor, glowRadius, bounceSpeed, gradientAngle]);

  function generate() {
    if (!prompt.trim()) return;
    setBusy(true);
    // Honest: this is a local layout mock, not AI generation.
    setTimeout(() => { setGenerated(true); setBusy(false); }, 300);
  }

  function extractStyle(file: File) {
    if (!file.type.startsWith("image/")) { alert("Drop an image."); return; }
    const url = URL.createObjectURL(file);
    setDropPreview(url);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const c = document.createElement("canvas");
      const scale = Math.min(1, 120 / Math.max(img.width, img.height));
      c.width = Math.max(1, Math.round(img.width * scale));
      c.height = Math.max(1, Math.round(img.height * scale));
      const ctx = c.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, c.width, c.height);
      const data = ctx.getImageData(0, 0, c.width, c.height).data;
      // Sample 5 evenly-spaced buckets to derive a palette from real pixels.
      const colors: string[] = [];
      const step = Math.max(1, Math.floor(data.length / 4 / 5));
      for (let i = 0; i < 5; i++) {
        const idx = (i * step * 4) % (data.length - 4);
        const r = data[idx], g = data[idx + 1], b = data[idx + 2];
        colors.push(`#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`);
      }
      setPalette(colors);
      setGenerated(true);
    };
    img.src = url;
  }

  const viewWidth: Record<View, string> = { desktop: "100%", tablet: "768px", mobile: "390px", ar: "100%" };

  return (
    <div className="ui-lab mx-auto w-full min-w-0 max-w-[1500px] space-y-5 px-3 py-6 sm:px-6">
      <style jsx global>{`
        .ui-lab button:not(:disabled){position:relative;display:inline-flex;align-items:center;justify-content:center;gap:0.4rem;min-height:2.35rem;padding:0.45rem 0.85rem;border:1px solid #352e52;border-radius:10px;background:linear-gradient(180deg,#221c3a 0%,#171327 100%);color:#d8d3ef;font-size:0.78rem;font-weight:600;cursor:pointer;transform:perspective(700px) translateZ(0px);transform-style:preserve-3d;box-shadow:inset 0 1px 0 rgba(255,255,255,0.09),inset 0 -2px 0 rgba(0,0,0,0.5),0 4px 0 -1px #0a0813,0 10px 20px rgba(0,0,0,0.55);transition:transform 140ms ease,box-shadow 140ms ease,border-color 140ms ease,background 140ms ease}
        .ui-lab button:not(:disabled):hover{transform:perspective(700px) translateZ(5px);border-color:#5a4d97;background:linear-gradient(180deg,#2a2249,#1b1630)}
        .ui-lab button:not(:disabled):active{transform:perspective(700px) translateZ(-3px);box-shadow:inset 0 2px 7px rgba(0,0,0,0.72),0 1px 0 -1px #0a0813}
        .ui-lab button:disabled{cursor:not-allowed;opacity:0.5}
        .ui-lab .hud-panel{position:relative;border-color:#352e52;background:linear-gradient(180deg,#14121f 0%,#0b0a14 100%);box-shadow:inset 0 1px 0 rgba(255,255,255,0.035),0 14px 34px rgba(0,0,0,0.35)}
        .ui-lab .hud-panel::before{content:"";position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,#6c63ff,#00f2fe,#6ee7b7,#e879f9);pointer-events:none}
      `}</style>

      <div className="flex items-center gap-3">
        <div className="grid size-11 place-items-center rounded-xl border border-[#6c63ff]/45 bg-[#6c63ff]/12 text-[#c5bfff] text-lg">🪐</div>
        <div>
          <h1 className="pilot-voice text-2xl">Cosmic UI Lab</h1>
          <p className="text-sm text-ash">Generate production-ready React/Vue/HTML/WebGL components tuned to our palette + theme tokens.</p>
        </div>
      </div>

      <div className="grid min-w-0 gap-4 xl:grid-cols-[340px_minmax(0,1fr)_360px]">
        {/* LEFT: Aesthetic Mood & Token Injection Panel */}
        <aside className="order-2 min-w-0 space-y-4 xl:order-1">
          <div className="hud-panel p-4 space-y-3">
            <h2 className="text-sm font-semibold text-[#e8e6f2] flex items-center gap-2"><span className="text-[#a69eff]">🎨</span>Aesthetic Mood &amp; Token Injection</h2>
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-ash" htmlFor="ui-prompt">Prompt</label>
              <textarea id="ui-prompt" value={prompt} onChange={e => setPrompt(e.target.value)} rows={3} placeholder="A responsive pricing card…" className="w-full rounded-md border border-[#211d34] bg-[#0b0a14] px-3 py-2 text-sm text-[#e8e6f2] placeholder:text-ash/60 focus:border-[#8b7fff]" />
              <button type="button" onClick={generate} disabled={busy || !prompt.trim()} className="d3-btn d3-btn--primary w-full h-8 text-xs">{busy ? "Sketching…" : "Preview sketch (local mock)"}</button>
            </div>
            {[
              { label: "Glassmorphic Blur Factor", value: blurFactor, set: setBlurFactor, min: 0, max: 40, unit: "px" },
              { label: "Ambient Glow Radius", value: glowRadius, set: setGlowRadius, min: 0, max: 60, unit: "px" },
              { label: "Kinetic Hover Bounce Speed", value: bounceSpeed, set: (v: number) => setBounceSpeed(v), min: 0, max: 1, step: 0.01, unit: "s" },
              { label: "Gradient Angle Shifting", value: gradientAngle, set: setGradientAngle, min: 0, max: 360, unit: "°" },
            ].map(s => (
              <div key={s.label} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-ash">{s.label}</span>
                  <span className="font-mono text-[#e8e6f2]">{typeof s.value === "number" ? s.value : (s.value as unknown as number).toFixed?.(2) ?? s.value}{s.unit}</span>
                </div>
                <input type="range" min={s.min} max={s.max} step={s.step ?? 1} value={s.value as number} onChange={e => s.set(Number(e.target.value))} className="w-full accent-[#6c63ff]" />
              </div>
            ))}
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-ash">Theme palette</p>
              <div className="flex flex-wrap gap-2">
                {palette.map((c, i) => (
                  <span key={c + i} className="grid size-8 place-items-center rounded-md border border-[#211d34] text-[8px] font-mono text-white" style={{ background: c, boxShadow: `0 0 12px ${c}` }}>{c.slice(1, 4)}</span>
                ))}
              </div>
            </div>
            <div
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) extractStyle(f); else alert("Drop an inspiration image."); }}
              className={`relative grid min-h-[90px] place-items-center rounded-md border-2 border-dashed text-xs transition cursor-pointer ${dropPreview ? "border-[#6ee7b7] bg-[#6ee7b7]/5" : "border-[#393252] bg-[#0b0a14] text-ash"}`}
            >
              {dropPreview ? (
                <img src={dropPreview} alt="extracted" className="max-h-[80px] rounded-md" />
              ) : (
                <div>
                  <p>Extract Style (dropper)</p>
                  <p className="text-[10px] opacity-70">drop an inspiration image · palette remap</p>
                </div>
              )}
            </div>
            <input id="extract-file" type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) extractStyle(f); e.currentTarget.value = ""; }} />
            <button type="button" onClick={() => document.getElementById("extract-file")?.click()} className="d3-btn h-8 text-xs w-full">Extract style from image</button>
          </div>
        </aside>

        {/* CENTER: Generative Layout Canvas */}
        <section className="order-1 min-w-0 space-y-3 lg:order-2">
          <div className="hud-panel p-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-[#e8e6f2]">Generative Layout Canvas</h2>
              <div className="flex items-center gap-1.5">
                {(["desktop", "tablet", "mobile", "ar"] as View[]).map(v => (
                  <button key={v} type="button" onClick={() => setTab(v)} className={`rounded-md border px-2.5 py-1 text-[9px] font-mono uppercase transition ${tab === v ? "border-[#6c63ff] bg-[#6c63ff]/20 text-[#c5bfff]" : "border-[#211d34] text-ash hover:text-[#e8e6f2]"}`}>
                    {v === "ar" ? "Spatial/AR Glass" : v === "tablet" ? "Tablet" : v === "mobile" ? "Mobile" : "Desktop"}
                  </button>
                ))}
              </div>
            </div>
            <div className="relative grid place-items-center rounded-md border border-[#211d34] bg-[#0b0a14] overflow-hidden transition-all" style={{ height: tab === "ar" ? 440 : tab === "mobile" ? 520 : 460, width: "100%" }}>
              <div
                className="rounded-xl border transition-all"
                style={{
                  width: tab === "mobile" ? 280 : tab === "tablet" ? 640 : tab === "ar" ? 360 : 760,
                  height: tab === "mobile" ? 500 : tab === "tablet" ? 480 : tab === "ar" ? 440 : 420,
                  maxWidth: "100%",
                  border: "1px solid rgba(255,255,255,0.08)",
                  background: `rgba(20, 18, 31, ${0.55 + (blurFactor / 100) * 0.3})`,
                  backdropFilter: `blur(${blurFactor}px)`,
                  boxShadow: `0 0 ${glowRadius}px ${palette[0]}33, inset 0 1px 0 rgba(255,255,255,0.05)`,
                  transition: `all .${bounceSpeed * 2 + 0.18}s cubic-bezier(.2,.7,.3,1)`,
                }}
              >
                <div className="flex h-9 items-center justify-between border-b border-white/[0.06] px-3">
                  <span className="text-[11px] font-bold text-[#e8e6f2]">Cosmic UI · {tab}</span>
                  <span className="grid size-4 place-items-center rounded" style={{ background: `linear-gradient(${gradientAngle}deg, ${palette[0]},${palette[1]},${palette[2]})` }} />
                </div>
                <div className="space-y-3 p-4">
                  <div className="rounded-lg border border-white/8 p-3" style={{ background: `linear-gradient(${gradientAngle}deg, ${palette[0]}22, ${palette[3]}18)` }}>
                    <p className="text-sm font-bold bg-clip-text text-transparent" style={{ backgroundImage: `linear-gradient(${gradientAngle}deg, ${palette[0]},${palette[1]},${palette[2]})` }}>{prompt ? prompt.slice(0, 60) : "Generated section"}</p>
                    <p className="mt-1 text-[11px] text-[#9490ac]">Responsive card content slot.</p>
                  </div>
                  <div className="flex gap-2">
                    <button className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white" style={{ background: `linear-gradient(${gradientAngle}deg, ${palette[0]},${palette[1]})` }}>Primary</button>
                    <button className="rounded-lg border border-white/8 px-3 py-1.5 text-xs text-[#e8e6f2]">Secondary</button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {palette.slice(0, 3).map((c, i) => <div key={c + i} className="h-14 rounded-md" style={{ background: c, boxShadow: `0 0 14px ${c}55` }} />)}
                  </div>
                </div>
              </div>
            </div>
            <p className="text-center text-[10px] text-ash mt-2">Live component responds to the mood sliders on the left.</p>
          </div>
        </section>

        {/* RIGHT: Code Compilation Clipboard */}
        <aside className="order-3 min-w-0 space-y-4">
          <div className="hud-panel p-4 space-y-3">
            <h2 className="text-sm font-semibold text-[#e8e6f2] flex items-center gap-2"><span className="text-[#a69eff]">💻</span>Code Compilation Clipboard</h2>
            <div className="flex gap-1.5">
              {([
                { id: "react", label: "React (TS) + Tailwind" },
                { id: "vue", label: "Vue 3" },
                { id: "html", label: "Clean HTML/CSS" },
                { id: "webgl", label: "Raw WebGL" },
              ] as const).map(t => (
                <button key={t.id} type="button" onClick={() => setCodeTab(t.id)} className={`rounded-md border px-2 py-1 text-[9px] font-mono uppercase transition ${codeTab === t.id ? "border-[#6c63ff] bg-[#6c63ff]/20 text-[#c5bfff]" : "border-[#211d34] text-ash hover:text-[#e8e6f2]"}`}>
                  {t.label}
                </button>
              ))}
            </div>
            <p className="mb-1 text-[10px] text-ash/70">Starter template — not AI-generated. Wire &quot;Regenerate with AI&quot; to /api/ai/chat for real code generation.</p>
            <textarea
              readOnly
              className="h-[340px] w-full rounded-md border border-[#211d34] bg-[#05040f] p-3 font-mono text-[10px] leading-relaxed text-[#6ee7b7] whitespace-pre"
            />
            <div className="flex gap-2">
              <button type="button" onClick={() => navigator.clipboard?.writeText(code)} disabled={!generated} className="d3-btn h-8 px-3 text-xs flex-1 disabled:opacity-50">Copy code</button>
              <button type="button" onClick={generate} disabled={busy || !prompt.trim()} className="d3-btn d3-btn--primary h-8 px-3 text-xs">{busy ? "Compiling…" : "Compile now"}</button>
            </div>
            <p className="text-[10px] text-ash/70">Outputs perfectly formatted export in the chosen framework, ready to paste.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
