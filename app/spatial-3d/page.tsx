// @ts-nocheck

"use client";

import { useEffect, useRef, useState } from "react";

type MeshStyle = "quad" | "tri" | "point";
type LightPreset = "studio" | "neon" | "cyberpunk";
type ExportFmt = "obj" | "gltf" | "usdz";

export default function Spatial3DStudioPage() {
  const mountRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<any>(null);
  const sceneRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);
  const controlsRef = useRef<any>(null);
  const meshMatRef = useRef<any>(null);
  const pointRef = useRef<any>(null);
  const frameRef = useRef<number>(0);

  const [prompt, setPrompt] = useState("A highly detailed cyberpunk hoverbike, photorealistic, 8k resolution");
  const [meshStyle, setMeshStyle] = useState<MeshStyle>("tri");
  const [wireframe, setWireframe] = useState(false);
  const [light, setLight] = useState<LightPreset>("studio");
  const [metallic, setMetallic] = useState(0.7);
  const [roughness, setRoughness] = useState(0.35);
  const [opacity, setOpacity] = useState(1.0);
  const [emission, setEmission] = useState(0.3);
  const [aiPrompt, setAiPrompt] = useState("Add holographic decals and a neon cyan trim along the chassis.");
  const [building, setBuilding] = useState(false);

  useEffect(() => {
    let THREE: any, OrbitControls: any;
    let cancelled = false;
    async function init() {
      THREE = await import("three");
      const ocMod = await import("three/examples/jsm/controls/OrbitControls.js");
      OrbitControls = ocMod.OrbitControls;
      if (cancelled || !mountRef.current) return;
      const mount = mountRef.current;

      const scene = new THREE.Scene();
      sceneRef.current = scene;
      scene.background = new THREE.Color(0x050410);
      scene.fog = new THREE.Fog(0x050410, 6, 18);

      const camera = new THREE.PerspectiveCamera(42, mount.clientWidth / Math.max(mount.clientHeight, 1), 0.1, 100);
      camera.position.set(3.2, 1.8, 4.6);
      cameraRef.current = camera;

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setSize(mount.clientWidth, mount.clientHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.15;
      mount.appendChild(renderer.domElement);
      rendererRef.current = renderer;

      // lights
      const ambient = new THREE.AmbientLight(0xffffff, 0.35);
      scene.add(ambient);
      const key = new THREE.DirectionalLight(0xa69eff, 1.2);
      key.position.set(5, 6, 4);
      scene.add(key);
      const rim = new THREE.DirectionalLight(0x00f2fe, 0.7);
      rim.position.set(-4, 1, -5);
      scene.add(rim);
      const fill = new THREE.DirectionalLight(0x6ee7b7, 0.35);
      fill.position.set(0, -3, 2);
      scene.add(fill);
      (scene as any).__lights = { ambient, key, rim, fill };

      // grid floor
      const grid = new THREE.GridHelper(12, 32, 0x6c63ff, 0x1a1533);
      (grid.material as any).opacity = 0.25;
      (grid.material as any).transparent = true;
      scene.add(grid);

      // sparkles backdrop
      const sparkGeo = new THREE.BufferGeometry();
      const sparkCount = 900;
      const sparkPos = new Float32Array(sparkCount * 3);
      const sparkCol = new Float32Array(sparkCount * 3);
      const sparkColors = [0xa69eff, 0x00f2fe, 0x6ee7b7, 0xe879f9];
      for (let i = 0; i < sparkCount; i++) {
        sparkPos[i * 3] = (Math.random() - 0.5) * 12;
        sparkPos[i * 3 + 1] = (Math.random() - 0.5) * 12;
        sparkPos[i * 3 + 2] = (Math.random() - 0.5) * 12;
        const c = new THREE.Color(sparkColors[i % sparkColors.length]);
        sparkCol[i * 3] = c.r; sparkCol[i * 3 + 1] = c.g; sparkCol[i * 3 + 2] = c.b;
      }
      sparkGeo.setAttribute("position", new THREE.BufferAttribute(sparkPos, 3));
      sparkGeo.setAttribute("color", new THREE.BufferAttribute(sparkCol, 3));
      const sparkMat = new THREE.PointsMaterial({ size: 0.035, vertexColors: true, transparent: true, opacity: 0.55, sizeAttenuation: true });
      const sparkles = new THREE.Points(sparkGeo, sparkMat);
      scene.add(sparkles);

      // Main model
      const material = new THREE.MeshStandardMaterial({
        color: 0x1a1533, metalness: 0.75, roughness: 0.32, emissive: 0x6c63ff, emissiveIntensity: 0.25, opacity: 1, transparent: false, wireframe: false, envMapIntensity: 1,
      });
      meshMatRef.current = material;
      const mesh = new THREE.Mesh(new THREE.TorusKnotGeometry(0.95, 0.32, 220, 64, 2, 3), material);
      scene.add(mesh);
      (scene as any).__mesh = mesh;

      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.autoRotate = true;
      controls.autoRotateSpeed = 0.6;
      controls.minDistance = 2.2;
      controls.maxDistance = 12;
      controlsRef.current = controls;

      const handleResize = () => {
        if (!mount) return;
        const w = mount.clientWidth, h = mount.clientHeight;
        if (w <= 0 || h <= 0) return;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      };
      window.addEventListener("resize", handleResize);

      const clock = new THREE.Clock();
      const meshRef = (scene as any).__mesh;
      const loop = () => {
        if (cancelled) return;
        const dt = clock.getDelta();
        meshRef.rotation.x += dt * 0.06;
        meshRef.rotation.y += dt * 0.12;
        sparkles.rotation.y -= dt * 0.05;
        key.intensity = 1.05 + Math.sin(clock.elapsedTime * 0.6) * 0.15;
        controls.update();
        renderer.render(scene, camera);
        frameRef.current = requestAnimationFrame(loop);
      };
      frameRef.current = requestAnimationFrame(loop);

      // store cleanup
      (mount as any).__cleanup = () => {
        window.removeEventListener("resize", handleResize);
        cancelAnimationFrame(frameRef.current);
        controls.dispose();
        renderer.dispose();
        if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
        scene.traverse((o: any) => { if (o.geometry) o.geometry.dispose(); if (o.material) { const m = o.material; if (Array.isArray(m)) m.forEach((x: any) => x.dispose()); else m.dispose(); } });
      };
    }
    init().catch(err => console.error("3D init failed:", err));
    return () => {
      cancelled = true;
      const mount = mountRef.current;
      if (mount && (mount as any).__cleanup) (mount as any).__cleanup();
    };
  }, []);

  // === react to mesh style ===
  useEffect(() => {
    const scene = sceneRef.current as any;
    const mat = meshMatRef.current;
    if (!scene || !mat) return;
    const prev = scene.__mesh;
    if (prev) { scene.remove(prev); if (prev.geometry) prev.geometry.dispose(); }
    let geo: any;
    import("three").then((THREE: any) => {
      if (meshStyle === "point") {
        const g = new THREE.SphereGeometry(1.35, 64, 64);
        const pts = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.035, color: 0x6c63ff, transparent: true, opacity: 0.85, sizeAttenuation: true, emissive: 0x6c63ff }));
        // PointsMaterial in r186 has no emissive; tint via color
        scene.__mesh = pts;
        scene.add(pts);
        mat.wireframe = false;
        return;
      }
      if (meshStyle === "quad") geo = new THREE.TorusKnotGeometry(0.95, 0.32, 120, 32, 2, 3);
      else geo = new THREE.TorusKnotGeometry(0.95, 0.32, 240, 64, 2, 3);
      const m = new THREE.MeshStandardMaterial({
        color: 0x1a1533, metalness, roughness, emissive: 0x6c63ff, emissiveIntensity: emission, opacity, transparent: opacity < 1, wireframe,
      });
      meshMatRef.current = m;
      const mesh = new THREE.Mesh(geo, m);
      scene.__mesh = mesh;
      scene.add(mesh);
    });
  }, [meshStyle, wireframe, metallic, roughness, opacity, emission]);

  // lighting presets
  useEffect(() => {
    const scene = sceneRef.current as any;
    const L = scene?.__lights;
    if (!L) return;
    if (light === "studio") { L.ambient.intensity = 0.4; L.key.color.set(0xffffff); L.key.intensity = 1.2; L.rim.color.set(0x00f2fe); L.rim.intensity = 0.6; L.fill.intensity = 0.4; }
    if (light === "neon") { L.ambient.intensity = 0.2; L.key.color.set(0xa69eff); L.key.intensity = 1.6; L.rim.color.set(0xe879f9); L.rim.intensity = 1.0; L.fill.color.set(0x00f2fe); L.fill.intensity = 0.6; }
    if (light === "cyberpunk") { L.ambient.intensity = 0.15; L.key.color.set(0xff2a6d); L.key.intensity = 1.0; L.rim.color.set(0x00f2fe); L.rim.intensity = 1.2; L.fill.color.set(0x6ee7b7); L.fill.intensity = 0.5; }
  }, [light]);

  // material live update (when not rebuilding)
  useEffect(() => {
    const m = meshMatRef.current;
    if (m) {
      m.metalness = metallic; m.roughness = roughness; m.emissiveIntensity = emission; m.opacity = opacity; m.transparent = opacity < 1; m.wireframe = wireframe;
    }
  }, [metallic, roughness, opacity, emission, wireframe]);

  function download(fmt: ExportFmt) {
    const scene = sceneRef.current as any;
    const mesh = scene?.__mesh;
    if (!mesh) { alert("Nothing to export yet."); return; }
    import("three/examples/jsm/exporters/GLTFExporter.js")
      .then((mod: any) => {
        const GLTFExporter = mod.GLTFExporter ?? mod.default;
        const exporter = new GLTFExporter();
        exporter.parse(mesh, (result: any) => {
          const blob = result instanceof ArrayBuffer ? new Blob([result], { type: "model/gltf-binary" }) : new Blob([JSON.stringify(result)], { type: "model/gltf+json" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `spatial-model.${fmt === "obj" ? "glb" : fmt}`;
          a.click();
          setTimeout(() => URL.revokeObjectURL(url), 60000);
        }, (err: any) => { alert(`Export failed: ${err?.message ?? err}`); }, { binary: true });
      })
      .catch((e: any) => { alert(`Exporter unavailable: ${e?.message ?? e}`); });
  }

  function rebuildFromAi() {
    // Honest: no 3D generation backend connected.
  }

  const accent = (light: LightPreset) => (light === "studio" ? "#6ee7b7" : light === "neon" ? "#e879f9" : "#ff2a6d");

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1500px] space-y-5 px-3 py-6 sm:px-6">
      <div className="flex items-center gap-3">
        <div className="grid size-11 place-items-center rounded-xl border border-[#6c63ff]/45 bg-[#6c63ff]/12 text-[#c5bfff] text-lg">🧊</div>
        <div>
          <h1 className="pilot-voice text-2xl">Spatial 3D Studio</h1>
          <p className="text-sm text-ash">Model via Three.js/WebGL — control panel, live viewport, texture/inpainting deck. Tokens &amp; multi-color palette.</p>
        </div>
      </div>

      <div className="grid min-w-0 gap-4 lg:grid-cols-[340px_minmax(0,1fr)_320px]">
        {/* LEFT: 3D Model Constructor */}
        <aside className="order-2 min-w-0 space-y-4 lg:order-1">
          <div className="hud-panel p-4 space-y-3">
            <h2 className="text-sm font-semibold text-[#e8e6f2] flex items-center gap-2"><span className="text-[#a69eff]">🛠</span>3D Model Constructor</h2>
            <label className="text-[10px] font-bold uppercase tracking-wider text-ash">Text-to-3D prompt</label>
            <textarea value={prompt} onChange={e => setPrompt(e.target.value)} rows={4} placeholder="A highly detailed cyberpunk hoverbike, photorealistic, 8k resolution" className="w-full rounded-md border border-[#211d34] bg-[#0b0a14] px-3 py-2 text-sm text-[#e8e6f2] placeholder:text-ash/60 focus:border-[#8b7fff]" />
            <button type="button" disabled title="3D generation needs a model backend — not connected." className="d3-btn d3-btn--primary w-full opacity-50 cursor-not-allowed">Generate model — not connected</button>
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-ash">Mesh style</p>
              <div className="flex gap-1.5">
                {(["quad", "tri", "point"] as MeshStyle[]).map(m => (
                  <button key={m} type="button" onClick={() => setMeshStyle(m)} className={`flex-1 rounded-md border px-2 py-1.5 text-xs font-mono capitalize transition ${meshStyle === m ? "border-[#a69eff] bg-[#6c63ff]/20 text-[#c5bfff]" : "border-[#211d34] text-ash hover:text-[#e8e6f2]"}`}>
                    {m === "quad" ? "Quad Mesh" : m === "tri" ? "Triangle Mesh" : "Point Cloud"}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-ash">Export matrix</p>
              <div className="grid grid-cols-3 gap-2">
                {(["obj", "gltf", "usdz"] as ExportFmt[]).map(f => (
                  <button key={f} type="button" onClick={() => download(f)} className="d3-tile p-2 text-xs font-mono text-[#e8e6f2] hover:border-[#8b7fff]/60">{("." + f).toUpperCase()}</button>
                ))}
              </div>
              <p className="text-[10px] text-ash/70">.USDZ for Apple Vision Pro AR previews.</p>
            </div>
          </div>
        </aside>

        {/* CENTER: Live Spatial Viewport */}
        <section className="order-1 min-w-0 lg:order-2">
          <div className="hud-panel overflow-hidden">
            <div className="flex items-center justify-between border-b border-[#211d34] px-3 py-2">
              <span className="text-xs font-semibold text-[#e8e6f2]">Live Spatial Viewport</span>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setWireframe(v => !v)} className={`rounded-md border px-2.5 py-1 text-[10px] font-semibold transition ${wireframe ? "border-[#6c63ff] bg-[#6c63ff]/20 text-[#c5bfff]" : "border-[#211d34] text-ash hover:text-[#e8e6f2]"}`}>
                  Wireframe {wireframe ? "ON" : "OFF"}
                </button>
                <select value={light} onChange={e => setLight(e.target.value as LightPreset)} className="h-7 rounded-md border border-[#211d34] bg-[#0b0a14] px-2 text-[10px] text-[#e8e6f2]">
                  <option value="studio">Studio White</option>
                  <option value="neon">Cinematic Neon</option>
                  <option value="cyberpunk">Moody Cyberpunk</option>
                </select>
                <span className="text-[10px] font-mono" style={{ color: accent(light) }}>{light.toUpperCase()}</span>
              </div>
            </div>
            <div ref={mountRef} className="h-[420px] w-full bg-[#050410]" />
            <div className="border-t border-[#211d34] px-3 py-2 text-[10px] text-ash flex items-center justify-between">
              <span>Orbit controllers enabled · drag to rotate · shift+drag to pan · wheel to zoom</span>
              <span className="font-mono">Three.js r186 · WebGL</span>
            </div>
          </div>
        </section>

        {/* RIGHT: Texture & Inpainting Deck */}
        <aside className="order-3 min-w-0 space-y-4">
          <div className="hud-panel p-4 space-y-4">
            <h2 className="text-sm font-semibold text-[#e8e6f2] flex items-center gap-2"><span className="text-[#a69eff]">🎨</span>Texture &amp; Inpainting Deck</h2>
            <div className="text-[10px] text-ash leading-relaxed">
              Map colors directly onto generated surfaces via AI text commands.
            </div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-ash">AI material prompt</label>
            <textarea value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} rows={2} className="w-full rounded-md border border-[#211d34] bg-[#0b0a14] px-3 py-2 text-sm text-[#e8e6f2] placeholder:text-ash/60 focus:border-[#8b7fff]" />
            <button type="button" disabled title="Material updates live as you adjust the sliders above." className="d3-btn d3-btn--primary w-full opacity-50 cursor-not-allowed">Apply material (live preview)</button>
            {[
              { label: "Metallic", value: metallic, set: setMetallic },
              { label: "Roughness", value: roughness, set: setRoughness },
              { label: "Opacity", value: opacity, set: setOpacity },
              { label: "Emission glow", value: emission, set: setEmission },
            ].map(s => (
              <div key={s.label} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-ash">{s.label}</span>
                  <span className="font-mono text-[#e8e6f2]">{s.value.toFixed(2)}</span>
                </div>
                <input type="range" min={0} max={1} step={0.01} value={s.value} onChange={e => s.set(Number(e.target.value))} className="w-full accent-[#6c63ff]" />
              </div>
            ))}
            <div className="flex flex-wrap gap-2 pt-2">
              {["Holographic decals", "Carbon fiber", "Brushed aluminum", "Neon trim", "Matte obsidian"].map(p => (
                <button key={p} type="button" onClick={() => setAiPrompt(p)} className="rounded-full border border-[#211d34] px-2.5 py-1 text-[10px] text-ash hover:text-[#e8e6f2] hover:border-[#8b7fff]/60">{p}</button>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
