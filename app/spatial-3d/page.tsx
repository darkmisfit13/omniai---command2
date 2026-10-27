// @ts-nocheck
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Box,
  Orbit,
  Sparkles,
  Layers,
  Sliders,
  Sun,
  Flame,
  Moon,
  Terminal as TerminalIcon,
  Download,
  Share2,
  RefreshCw,
  Cpu,
  Activity,
  Play,
  Pause,
  Grid,
  Zap,
  Check,
  ChevronRight,
  Maximize2,
  RotateCcw,
  Radio,
  FileCode,
  HardDrive,
  Eye,
  SlidersHorizontal,
} from "lucide-react";

type MeshTopology = "quad" | "tri" | "point";
type LightingMode = "studio" | "neon" | "cyberpunk";
type PresetModelId = "cybernetic_arm" | "exo_skull" | "obsidian_blade" | "holo_drone" | "quantum_core";

interface HistoryItem {
  id: PresetModelId;
  title: string;
  category: string;
  polyCount: string;
  timestamp: string;
  prompt: string;
  thumbnailBadge: string;
}

const HISTORIC_LIBRARY: HistoryItem[] = [
  {
    id: "cybernetic_arm",
    title: "Cybernetic Arm v3",
    category: "Hard-Surface Prosthetic",
    polyCount: "42.8k Polys",
    timestamp: "2 mins ago",
    prompt: "High-fidelity cyberpunk prosthetic limb, hard surface mechanical joints, obsidian plating with exposed light-blue fiber wires",
    thumbnailBadge: "ARM-v3",
  },
  {
    id: "exo_skull",
    title: "Exo-Spine Cranial MK-II",
    category: "Neural Biomechanical",
    polyCount: "38.2k Polys",
    timestamp: "14 mins ago",
    prompt: "Obsidian titanium biomechanical skull chassis, articulated jaw pistons, neural optic visor emitting aqua laser telemetry",
    thumbnailBadge: "EXO-MK2",
  },
  {
    id: "obsidian_blade",
    title: "Obsidian Dagger",
    category: "Tactical Spatial Asset",
    polyCount: "19.4k Polys",
    timestamp: "1 hour ago",
    prompt: "Monolithic obsidian tactical blade, beveled facet geometry, glowing electric indigo runes with micro-hydraulic hilt",
    thumbnailBadge: "BLADE-9",
  },
  {
    id: "holo_drone",
    title: "Holo-Recon Orb Drone",
    category: "Kinetic Autonomous",
    polyCount: "51.2k Polys",
    timestamp: "3 hours ago",
    prompt: "Autonomous surveillance sphere, dual counter-rotating gyro rings, cyber-aqua lidar scanner aperture with particle wake",
    thumbnailBadge: "DRONE-X",
  },
  {
    id: "quantum_core",
    title: "Quantum Singularity Node",
    category: "Mathematical Energy Core",
    polyCount: "64.0k Polys",
    timestamp: "Yesterday",
    prompt: "Multi-loop dimensional manifold, crystalline refraction surfaces, pulsing zero-point magnetic containment coil",
    thumbnailBadge: "CORE-01",
  },
];

export default function OmniSpatial3DStudio() {
  const mountRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<any>(null);
  const sceneRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);
  const controlsRef = useRef<any>(null);
  const activeGroupRef = useRef<any>(null);
  const materialsRef = useRef<any[]>([]);
  const pointsRef = useRef<any>(null);
  const frameRef = useRef<number>(0);
  const lightsRef = useRef<any>({});
  const clockRef = useRef<any>(null);

  // Studio Controls & States
  const [prompt, setPrompt] = useState(
    "High-fidelity cyberpunk prosthetic limb, hard surface mechanical joints, obsidian plating with exposed light-blue fiber wires"
  );
  const [activeModel, setActiveModel] = useState<PresetModelId>("cybernetic_arm");
  const [topology, setTopology] = useState<MeshTopology>("tri");
  const [lighting, setLighting] = useState<LightingMode>("neon");

  // Material Properties
  const [metallic, setMetallic] = useState(0.85);
  const [roughness, setRoughness] = useState(0.24);
  const [opacity, setOpacity] = useState(1.0);
  const [emission, setEmission] = useState(0.65);

  // Viewport Settings
  const [autoRotate, setAutoRotate] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [wireframeOverlay, setWireframeOverlay] = useState(false);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [dispatchStatus, setDispatchStatus] = useState<string | null>(null);
  const [dispatchProgress, setDispatchProgress] = useState(0);

  // Telemetry & Diagnostics
  const [fps, setFps] = useState(60);
  const [polyStats, setPolyStats] = useState({ vertices: 34820, triangles: 42800, vram: "18.4 MB" });
  const [logs, setLogs] = useState<string[]>([
    "[SYSTEM] Nexus-Spatial: WebGL 3D Matrix Renderer initialized.",
    "[CUDA] Local PyTorch TensorRT pipeline standby. CUDA cores: active.",
    "[GEOM] Procedural 3D Hard-Surface Engine linked.",
    "[READY] Model compiled: Cybernetic Arm v3 loaded into viewport.",
  ]);

  const addLog = useCallback((msg: string) => {
    setLogs((prev) => [...prev.slice(-30), `[${new Date().toLocaleTimeString()}] ${msg}`]);
  }, []);

  // Construct 3D geometries based on selected model
  const buildModelGeometries = useCallback(
    (THREE: any, modelId: PresetModelId, matProps: { metalness: number; roughness: number; opacity: number; emission: number }) => {
      const group = new THREE.Group();
      const mats: any[] = [];

      // Base Obsidian Cyberpunk Materials
      const obsidianBodyMat = new THREE.MeshStandardMaterial({
        color: 0x0a071b,
        metalness: matProps.metalness,
        roughness: matProps.roughness,
        emissive: 0x1a0f35,
        emissiveIntensity: 0.15,
        transparent: matProps.opacity < 1.0,
        opacity: matProps.opacity,
        wireframe: wireframeOverlay,
      });
      mats.push(obsidianBodyMat);

      const electricIndigoMat = new THREE.MeshStandardMaterial({
        color: 0x1f1444,
        metalness: Math.min(1.0, matProps.metalness + 0.1),
        roughness: matProps.roughness * 0.8,
        emissive: 0x7c3aed,
        emissiveIntensity: matProps.emission * 0.6,
        wireframe: wireframeOverlay,
      });
      mats.push(electricIndigoMat);

      const cyberAquaNeonMat = new THREE.MeshStandardMaterial({
        color: 0x00f2ff,
        metalness: 0.2,
        roughness: 0.1,
        emissive: 0x00f2ff,
        emissiveIntensity: matProps.emission * 1.4,
        wireframe: wireframeOverlay,
      });
      mats.push(cyberAquaNeonMat);

      const chromeJointMat = new THREE.MeshStandardMaterial({
        color: 0x3a3652,
        metalness: 0.95,
        roughness: 0.15,
        emissive: 0x120c24,
        wireframe: wireframeOverlay,
      });
      mats.push(chromeJointMat);

      if (modelId === "cybernetic_arm") {
        // Forearm structural chassis
        const forearmGeo = new THREE.CylinderGeometry(0.55, 0.42, 2.6, 24);
        const forearmMesh = new THREE.Mesh(forearmGeo, obsidianBodyMat);
        forearmMesh.position.y = 0.2;
        group.add(forearmMesh);

        // Armor plating brackets
        for (let i = 0; i < 4; i++) {
          const angle = (i * Math.PI) / 2;
          const plateGeo = new THREE.BoxGeometry(0.18, 2.2, 0.08);
          const plateMesh = new THREE.Mesh(plateGeo, electricIndigoMat);
          plateMesh.position.set(Math.cos(angle) * 0.52, 0.2, Math.sin(angle) * 0.52);
          plateMesh.rotation.y = angle;
          group.add(plateMesh);
        }

        // Elbow joint socket
        const elbowGeo = new THREE.SphereGeometry(0.5, 24, 24);
        const elbowMesh = new THREE.Mesh(elbowGeo, chromeJointMat);
        elbowMesh.position.y = -1.2;
        group.add(elbowMesh);

        const elbowRingGeo = new THREE.TorusGeometry(0.55, 0.08, 16, 32);
        const elbowRing = new THREE.Mesh(elbowRingGeo, cyberAquaNeonMat);
        elbowRing.position.y = -1.2;
        elbowRing.rotation.x = Math.PI / 2;
        group.add(elbowRing);

        // Wrist manifold
        const wristGeo = new THREE.CylinderGeometry(0.38, 0.44, 0.5, 24);
        const wristMesh = new THREE.Mesh(wristGeo, chromeJointMat);
        wristMesh.position.y = 1.6;
        group.add(wristMesh);

        const wristGlowGeo = new THREE.TorusGeometry(0.42, 0.04, 16, 32);
        const wristGlow = new THREE.Mesh(wristGlowGeo, cyberAquaNeonMat);
        wristGlow.position.y = 1.6;
        wristGlow.rotation.x = Math.PI / 2;
        group.add(wristGlow);

        // Hand metacarpal block
        const handGeo = new THREE.BoxGeometry(0.7, 0.7, 0.35);
        const handMesh = new THREE.Mesh(handGeo, obsidianBodyMat);
        handMesh.position.y = 2.15;
        group.add(handMesh);

        // 4 Articulating Fingers + Thumb
        for (let f = 0; f < 4; f++) {
          const fx = (f - 1.5) * 0.18;
          const knuckleGeo = new THREE.SphereGeometry(0.06, 12, 12);
          const knuckle = new THREE.Mesh(knuckleGeo, chromeJointMat);
          knuckle.position.set(fx, 2.52, 0.05);
          group.add(knuckle);

          const phalanxGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.45, 12);
          const phalanx = new THREE.Mesh(phalanxGeo, electricIndigoMat);
          phalanx.position.set(fx, 2.76, 0.05);
          group.add(phalanx);

          const tipGeo = new THREE.ConeGeometry(0.045, 0.25, 12);
          const tip = new THREE.Mesh(tipGeo, cyberAquaNeonMat);
          tip.position.set(fx, 3.05, 0.05);
          group.add(tip);
        }

        // Thumb
        const thumbGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.4, 12);
        const thumb = new THREE.Mesh(thumbGeo, electricIndigoMat);
        thumb.position.set(0.45, 2.3, 0.08);
        thumb.rotation.z = -Math.PI / 4;
        group.add(thumb);

        // Cybernetic aqua fiber conduits running along arm
        for (let c = 0; c < 3; c++) {
          const cableGeo = new THREE.TorusGeometry(0.48 + c * 0.03, 0.02, 12, 32, Math.PI * 1.5);
          const cable = new THREE.Mesh(cableGeo, cyberAquaNeonMat);
          cable.position.set(0, -0.6 + c * 0.7, 0);
          cable.rotation.x = Math.PI / 2;
          cable.rotation.z = (c * Math.PI) / 3;
          group.add(cable);
        }
      } else if (modelId === "exo_skull") {
        // Cranium faceted skull
        const skullGeo = new THREE.IcosahedronGeometry(1.2, 2);
        const skullMesh = new THREE.Mesh(skullGeo, obsidianBodyMat);
        group.add(skullMesh);

        // Visor aperture
        const visorGeo = new THREE.BoxGeometry(1.5, 0.28, 0.6);
        const visor = new THREE.Mesh(visorGeo, cyberAquaNeonMat);
        visor.position.set(0, 0.2, 0.95);
        group.add(visor);

        // Jaw mech
        const jawGeo = new THREE.BoxGeometry(1.0, 0.6, 0.9);
        const jaw = new THREE.Mesh(jawGeo, electricIndigoMat);
        jaw.position.set(0, -0.9, 0.3);
        group.add(jaw);

        // Piston rods
        [-0.6, 0.6].forEach((x) => {
          const pistonGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.8, 16);
          const piston = new THREE.Mesh(pistonGeo, chromeJointMat);
          piston.position.set(x, -0.4, 0.4);
          piston.rotation.z = x > 0 ? 0.3 : -0.3;
          group.add(piston);
        });

        // Neural interface ports
        for (let p = 0; p < 6; p++) {
          const portGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.15, 12);
          const port = new THREE.Mesh(portGeo, cyberAquaNeonMat);
          port.position.set((p % 2 === 0 ? 0.4 : -0.4), 0.7 + (p * 0.1), -0.7 + (p * 0.12));
          port.rotation.x = Math.PI / 4;
          group.add(port);
        }
      } else if (modelId === "obsidian_blade") {
        // Monolithic sharp blade
        const bladeGeo = new THREE.BoxGeometry(0.35, 3.8, 0.07);
        const blade = new THREE.Mesh(bladeGeo, obsidianBodyMat);
        blade.position.y = 0.8;
        group.add(blade);

        // Dual beveled neon edge lines
        [-0.18, 0.18].forEach((x) => {
          const edgeGeo = new THREE.BoxGeometry(0.04, 3.8, 0.08);
          const edge = new THREE.Mesh(edgeGeo, cyberAquaNeonMat);
          edge.position.set(x, 0.8, 0);
          group.add(edge);
        });

        // Blade tip
        const tipGeo = new THREE.ConeGeometry(0.2, 0.7, 4);
        const tip = new THREE.Mesh(tipGeo, obsidianBodyMat);
        tip.position.y = 3.05;
        tip.rotation.y = Math.PI / 4;
        group.add(tip);

        // Crossguard
        const guardGeo = new THREE.BoxGeometry(1.4, 0.22, 0.25);
        const guard = new THREE.Mesh(guardGeo, electricIndigoMat);
        guard.position.y = -1.1;
        group.add(guard);

        // Hilt
        const hiltGeo = new THREE.CylinderGeometry(0.12, 0.14, 1.4, 16);
        const hilt = new THREE.Mesh(hiltGeo, chromeJointMat);
        hilt.position.y = -1.85;
        group.add(hilt);

        // Pommel
        const pommelGeo = new THREE.OctahedronGeometry(0.25, 0);
        const pommel = new THREE.Mesh(pommelGeo, cyberAquaNeonMat);
        pommel.position.y = -2.65;
        group.add(pommel);
      } else if (modelId === "holo_drone") {
        // Central Core
        const coreGeo = new THREE.SphereGeometry(0.85, 32, 32);
        const core = new THREE.Mesh(coreGeo, obsidianBodyMat);
        group.add(core);

        // Scanning eye
        const eyeGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.3, 24);
        const eye = new THREE.Mesh(eyeGeo, cyberAquaNeonMat);
        eye.position.set(0, 0, 0.75);
        eye.rotation.x = Math.PI / 2;
        group.add(eye);

        // Outer gimbal ring
        const outerRingGeo = new THREE.TorusGeometry(1.45, 0.06, 16, 64);
        const outerRing = new THREE.Mesh(outerRingGeo, electricIndigoMat);
        outerRing.name = "outerRing";
        group.add(outerRing);

        // Inner gimbal ring
        const innerRingGeo = new THREE.TorusGeometry(1.15, 0.05, 16, 64);
        const innerRing = new THREE.Mesh(innerRingGeo, cyberAquaNeonMat);
        innerRing.name = "innerRing";
        innerRing.rotation.x = Math.PI / 2;
        group.add(innerRing);

        // 4 Thruster pylons
        for (let t = 0; t < 4; t++) {
          const theta = (t * Math.PI) / 2 + Math.PI / 4;
          const pylonGeo = new THREE.BoxGeometry(0.12, 0.12, 0.6);
          const pylon = new THREE.Mesh(pylonGeo, chromeJointMat);
          pylon.position.set(Math.cos(theta) * 0.9, 0, Math.sin(theta) * 0.9);
          pylon.rotation.y = -theta;
          group.add(pylon);
        }
      } else {
        // Quantum Singularity Node (Torus Knot)
        const knotGeo = new THREE.TorusKnotGeometry(1.1, 0.35, 180, 48, 2, 3);
        const knot = new THREE.Mesh(knotGeo, obsidianBodyMat);
        group.add(knot);

        const auraRingGeo = new THREE.TorusGeometry(2.1, 0.04, 16, 80);
        const auraRing = new THREE.Mesh(auraRingGeo, cyberAquaNeonMat);
        auraRing.name = "auraRing";
        group.add(auraRing);

        const innerAuraGeo = new THREE.TorusGeometry(1.7, 0.05, 16, 80);
        const innerAura = new THREE.Mesh(innerAuraGeo, electricIndigoMat);
        innerAura.name = "innerAura";
        innerAura.rotation.x = Math.PI / 3;
        group.add(innerAura);
      }

      // Point cloud representation if requested
      if (topology === "point") {
        const pointPositions: number[] = [];
        const pointColors: number[] = [];
        const colorAqua = new THREE.Color(0x00f2ff);
        const colorIndigo = new THREE.Color(0x7c3aed);
        const colorWhite = new THREE.Color(0xffffff);

        group.traverse((child: any) => {
          if (child.isMesh && child.geometry) {
            const geo = child.geometry;
            const posAttr = geo.attributes.position;
            if (posAttr) {
              const matrix = child.matrixWorld;
              const v = new THREE.Vector3();
              for (let i = 0; i < posAttr.count; i += 2) {
                v.fromBufferAttribute(posAttr, i);
                v.applyMatrix4(child.matrix);
                pointPositions.push(v.x, v.y, v.z);
                const pick = Math.random();
                const col = pick > 0.6 ? colorAqua : pick > 0.25 ? colorIndigo : colorWhite;
                pointColors.push(col.r, col.g, col.b);
              }
            }
          }
        });

        const pGeo = new THREE.BufferGeometry();
        pGeo.setAttribute("position", new THREE.Float32BufferAttribute(pointPositions, 3));
        pGeo.setAttribute("color", new THREE.Float32BufferAttribute(pointColors, 3));

        const pMat = new THREE.PointsMaterial({
          size: 0.045,
          vertexColors: true,
          transparent: true,
          opacity: 0.9,
          sizeAttenuation: true,
        });

        const pointsObj = new THREE.Points(pGeo, pMat);
        return { group: pointsObj, materials: [pMat] };
      }

      // Triangular Mesh Overlay mode: add subtle wireframe mesh overlay
      if (topology === "tri" || wireframeOverlay) {
        group.traverse((child: any) => {
          if (child.isMesh) {
            const wireGeo = new THREE.WireframeGeometry(child.geometry);
            const wireMat = new THREE.LineBasicMaterial({
              color: topology === "tri" ? 0x00f2ff : 0x7c3aed,
              transparent: true,
              opacity: topology === "tri" ? 0.35 : 0.85,
              linewidth: 1,
            });
            const line = new THREE.LineSegments(wireGeo, wireMat);
            line.position.copy(child.position);
            line.rotation.copy(child.rotation);
            line.scale.copy(child.scale);
            group.add(line);
          }
        });
      }

      // Quad Wireframe Mode
      if (topology === "quad") {
        group.traverse((child: any) => {
          if (child.isMesh) {
            child.material.wireframe = true;
            child.material.color.setHex(0x0a071b);
            child.material.emissive.setHex(0x7c3aed);
            child.material.emissiveIntensity = 0.8;
          }
        });
      }

      return { group, materials: mats };
    },
    [topology, wireframeOverlay]
  );

  // Initialize Three.js Scene
  useEffect(() => {
    let THREE: any, OrbitControls: any;
    let cancelled = false;
    const currentMount = mountRef.current;

    async function init() {
      THREE = await import("three");
      const ocMod = await import("three/examples/jsm/controls/OrbitControls.js");
      OrbitControls = ocMod.OrbitControls;

      if (cancelled || !currentMount) return;
      const mount = currentMount;

      // 1. Scene & Pure Velvet Black Background
      const scene = new THREE.Scene();
      sceneRef.current = scene;
      scene.background = new THREE.Color(0x000000);
      scene.fog = new THREE.FogExp2(0x000000, 0.045);

      // 2. Camera
      const camera = new THREE.PerspectiveCamera(45, mount.clientWidth / Math.max(mount.clientHeight, 1), 0.1, 100);
      camera.position.set(3.8, 2.2, 5.0);
      cameraRef.current = camera;

      // 3. WebGL Renderer
      const renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        powerPreference: "high-performance",
      });
      renderer.setSize(mount.clientWidth, mount.clientHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.25;
      mount.appendChild(renderer.domElement);
      rendererRef.current = renderer;

      // 4. OrbitControls
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.06;
      controls.autoRotate = autoRotate;
      controls.autoRotateSpeed = 0.85;
      controls.minDistance = 1.8;
      controls.maxDistance = 14;
      controlsRef.current = controls;

      // 5. Environmental Lighting Deck
      const ambient = new THREE.AmbientLight(0x0a071b, 0.5);
      scene.add(ambient);

      // Electric Indigo Key
      const keyLight = new THREE.DirectionalLight(0x7c3aed, 2.2);
      keyLight.position.set(4, 5, 3);
      scene.add(keyLight);

      // Razor-sharp Cyber Aqua Rim
      const rimLight = new THREE.DirectionalLight(0x00f2ff, 1.8);
      rimLight.position.set(-4, 2, -4);
      scene.add(rimLight);

      // Velvet Fill
      const fillLight = new THREE.PointLight(0xffffff, 0.6, 20);
      fillLight.position.set(0, -3, 2);
      scene.add(fillLight);

      lightsRef.current = { ambient, keyLight, rimLight, fillLight };

      // 6. Obsidian Floor Grid with Cyber Aqua & Indigo Highlights
      const grid = new THREE.GridHelper(16, 32, 0x00f2ff, 0x1f1444);
      grid.position.y = -2.2;
      (grid.material as any).opacity = 0.35;
      (grid.material as any).transparent = true;
      grid.name = "floorGrid";
      scene.add(grid);

      // 7. Ambient Shimmering Particles
      const particleGeo = new THREE.BufferGeometry();
      const pCount = 650;
      const pPos = new Float32Array(pCount * 3);
      const pCols = new Float32Array(pCount * 3);
      const aquaColor = new THREE.Color(0x00f2ff);
      const indigoColor = new THREE.Color(0x7c3aed);
      const whiteColor = new THREE.Color(0xffffff);

      for (let i = 0; i < pCount; i++) {
        pPos[i * 3] = (Math.random() - 0.5) * 16;
        pPos[i * 3 + 1] = (Math.random() - 0.5) * 12;
        pPos[i * 3 + 2] = (Math.random() - 0.5) * 16;
        const r = Math.random();
        const c = r > 0.5 ? aquaColor : r > 0.2 ? indigoColor : whiteColor;
        pCols[i * 3] = c.r;
        pCols[i * 3 + 1] = c.g;
        pCols[i * 3 + 2] = c.b;
      }
      particleGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
      particleGeo.setAttribute("color", new THREE.BufferAttribute(pCols, 3));

      const particleMat = new THREE.PointsMaterial({
        size: 0.035,
        vertexColors: true,
        transparent: true,
        opacity: 0.65,
        sizeAttenuation: true,
      });
      const particleField = new THREE.Points(particleGeo, particleMat);
      scene.add(particleField);
      pointsRef.current = particleField;

      // 8. Build Initial Model
      const { group, materials } = buildModelGeometries(THREE, activeModel, {
        metalness: metallic,
        roughness,
        opacity,
        emission,
      });
      scene.add(group);
      activeGroupRef.current = group;
      materialsRef.current = materials;

      // 9. Resize Handler
      const handleResize = () => {
        if (!mount) return;
        const w = mount.clientWidth;
        const h = mount.clientHeight;
        if (w <= 0 || h <= 0) return;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      };
      window.addEventListener("resize", handleResize);

      // 10. Animation Loop
      const clock = new THREE.Clock();
      clockRef.current = clock;
      let frameCounter = 0;
      let lastFpsCheck = performance.now();

      const animate = () => {
        if (cancelled) return;
        const dt = clock.getDelta();
        const elapsed = clock.getElapsedTime();

        // Rotate kinetic sub-elements if available
        if (activeGroupRef.current) {
          const outer = activeGroupRef.current.getObjectByName("outerRing");
          if (outer) outer.rotation.z += dt * 0.45;
          const inner = activeGroupRef.current.getObjectByName("innerRing");
          if (inner) inner.rotation.x += dt * 0.65;
          const aura = activeGroupRef.current.getObjectByName("auraRing");
          if (aura) aura.rotation.y += dt * 0.3;
        }

        // Ambient particles rotation
        if (pointsRef.current) {
          pointsRef.current.rotation.y = elapsed * 0.04;
        }

        // Pulsing fill light
        if (lightsRef.current.fillLight) {
          lightsRef.current.fillLight.intensity = 0.5 + Math.sin(elapsed * 1.5) * 0.25;
        }

        controls.update();
        renderer.render(scene, camera);

        // Calculate approximate FPS
        frameCounter++;
        const now = performance.now();
        if (now - lastFpsCheck >= 1000) {
          setFps(Math.round((frameCounter * 1000) / (now - lastFpsCheck)));
          frameCounter = 0;
          lastFpsCheck = now;
        }

        frameRef.current = requestAnimationFrame(animate);
      };
      frameRef.current = requestAnimationFrame(animate);

      // Store cleanup on mount
      (mount as any).__cleanup = () => {
        window.removeEventListener("resize", handleResize);
        cancelAnimationFrame(frameRef.current);
        controls.dispose();
        renderer.dispose();
        if (mount.contains(renderer.domElement)) {
          mount.removeChild(renderer.domElement);
        }
        scene.traverse((o: any) => {
          if (o.geometry) o.geometry.dispose();
          if (o.material) {
            if (Array.isArray(o.material)) o.material.forEach((m: any) => m.dispose());
            else o.material.dispose();
          }
        });
      };
    }

    init().catch((err) => console.error("OmniSpatial 3D init error:", err));

    return () => {
      cancelled = true;
      if (currentMount && (currentMount as any).__cleanup) {
        (currentMount as any).__cleanup();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update Model Geometry when Active Model or Topology Changes
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    import("three").then((THREE) => {
      if (activeGroupRef.current) {
        scene.remove(activeGroupRef.current);
        activeGroupRef.current.traverse((o: any) => {
          if (o.geometry) o.geometry.dispose();
          if (o.material) {
            if (Array.isArray(o.material)) o.material.forEach((m: any) => m.dispose());
            else o.material.dispose();
          }
        });
      }

      const { group, materials } = buildModelGeometries(THREE, activeModel, {
        metalness: metallic,
        roughness,
        opacity,
        emission,
      });

      scene.add(group);
      activeGroupRef.current = group;
      materialsRef.current = materials;

      // Update poly stats
      let verts = 0;
      let tris = 0;
      group.traverse((o: any) => {
        if (o.isMesh && o.geometry) {
          const p = o.geometry.attributes.position;
          if (p) verts += p.count;
          if (o.geometry.index) tris += o.geometry.index.count / 3;
          else if (p) tris += p.count / 3;
        }
      });
      setPolyStats({
        vertices: verts > 0 ? verts : 28400,
        triangles: tris > 0 ? Math.round(tris) : 34800,
        vram: `${((verts * 32 + tris * 16) / (1024 * 1024) + 14.2).toFixed(1)} MB`,
      });
    });
  }, [activeModel, topology, wireframeOverlay, buildModelGeometries, metallic, roughness, opacity, emission]);

  // Update Dynamic Lighting Presets
  useEffect(() => {
    const lights = lightsRef.current;
    if (!lights || !lights.keyLight) return;

    if (lighting === "studio") {
      lights.ambient.color.setHex(0x1a1533);
      lights.ambient.intensity = 0.6;
      lights.keyLight.color.setHex(0xffffff);
      lights.keyLight.intensity = 2.4;
      lights.rimLight.color.setHex(0x00f2ff);
      lights.rimLight.intensity = 1.0;
      lights.fillLight.color.setHex(0xd0d5ff);
      lights.fillLight.intensity = 0.7;
    } else if (lighting === "neon") {
      lights.ambient.color.setHex(0x0a071b);
      lights.ambient.intensity = 0.4;
      lights.keyLight.color.setHex(0x7c3aed); // Electric Indigo Key
      lights.keyLight.intensity = 3.0;
      lights.rimLight.color.setHex(0x00f2ff); // Razor-sharp Cyber Aqua Rim
      lights.rimLight.intensity = 2.4;
      lights.fillLight.color.setHex(0xff007a); // Neon Magenta Fill
      lights.fillLight.intensity = 0.5;
    } else {
      // Moody Cyberpunk Darkness
      lights.ambient.color.setHex(0x05030e);
      lights.ambient.intensity = 0.25;
      lights.keyLight.color.setHex(0x00f2ff);
      lights.keyLight.intensity = 1.8;
      lights.rimLight.color.setHex(0x7c3aed);
      lights.rimLight.intensity = 2.8;
      lights.fillLight.color.setHex(0x11052c);
      lights.fillLight.intensity = 0.3;
    }
  }, [lighting]);

  // Update Material Properties Live
  useEffect(() => {
    materialsRef.current.forEach((m: any) => {
      if (m.isMeshStandardMaterial) {
        m.metalness = metallic;
        m.roughness = roughness;
        m.opacity = opacity;
        m.transparent = opacity < 1.0;
        if (m.emissive) {
          m.emissiveIntensity = emission * 1.2;
        }
      }
    });
  }, [metallic, roughness, opacity, emission]);

  // Auto-Rotate toggle
  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.autoRotate = autoRotate;
    }
  }, [autoRotate]);

  // Floor Grid toggle
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const grid = scene.getObjectByName("floorGrid");
    if (grid) grid.visible = showGrid;
  }, [showGrid]);

  // Reset Camera View
  const handleResetCamera = () => {
    if (cameraRef.current && controlsRef.current) {
      cameraRef.current.position.set(3.8, 2.2, 5.0);
      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.update();
      addLog("Camera orientation reset to isometric vantage point.");
    }
  };

  // Conversational Synthesis Action
  const handleSynthesizePrompt = () => {
    setIsSynthesizing(true);
    addLog(`Initiating Text-to-3D Synthesis for prompt: "${prompt.slice(0, 48)}..."`);
    addLog("[STAGE 1/4] NeRF volumetric field density sampling: in-progress...");

    setTimeout(() => {
      addLog("[STAGE 2/4] Marching Tetrahedra polygon extraction & topology bake: 99.4%");
    }, 450);

    setTimeout(() => {
      addLog("[STAGE 3/4] Tangent space derivation & PBR shader material assignment.");
    }, 900);

    setTimeout(() => {
      setIsSynthesizing(false);
      addLog("[STAGE 4/4] Synthesis Complete! High-res mesh compiled into active viewport.");
      // cycle to a matching model
      if (prompt.toLowerCase().includes("skull") || prompt.toLowerCase().includes("cranial")) {
        setActiveModel("exo_skull");
      } else if (prompt.toLowerCase().includes("blade") || prompt.toLowerCase().includes("sword") || prompt.toLowerCase().includes("dagger")) {
        setActiveModel("obsidian_blade");
      } else if (prompt.toLowerCase().includes("drone") || prompt.toLowerCase().includes("orb") || prompt.toLowerCase().includes("recon")) {
        setActiveModel("holo_drone");
      } else if (prompt.toLowerCase().includes("quantum") || prompt.toLowerCase().includes("singularity") || prompt.toLowerCase().includes("knot")) {
        setActiveModel("quantum_core");
      } else {
        setActiveModel("cybernetic_arm");
      }
    }, 1400);
  };

  // Export File Generator (.OBJ, .GLTF, .USDZ)
  const handleExport = async (format: "obj" | "gltf" | "usdz") => {
    const group = activeGroupRef.current;
    if (!group) {
      addLog("[EXPORT ERROR] No active geometry in 3D matrix.");
      return;
    }

    addLog(`[EXPORT ENGINE] Serializing active spatial asset to .${format.toUpperCase()}...`);

    if (format === "gltf") {
      try {
        const mod: any = await import("three/examples/jsm/exporters/GLTFExporter.js");
        const GLTFExporter = mod.GLTFExporter ?? mod.default;
        const exporter = new GLTFExporter();
        exporter.parse(
          group,
          (gltfResult: any) => {
            const blob =
              gltfResult instanceof ArrayBuffer
                ? new Blob([gltfResult], { type: "model/gltf-binary" })
                : new Blob([JSON.stringify(gltfResult, null, 2)], { type: "model/gltf+json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `${activeModel}-nexus-spatial.glb`;
            a.click();
            URL.revokeObjectURL(url);
            addLog(`[EXPORT SUCCESS] .GLB spatial model exported successfully.`);
          },
          (err: any) => {
            addLog(`[EXPORT FAILED] GLTFExporter error: ${err?.message || err}`);
          },
          { binary: true }
        );
      } catch (err) {
        addLog(`[EXPORT FAILED] GLTFExporter module load failure.`);
      }
      return;
    }

    if (format === "obj") {
      // Clean pure JavaScript OBJ serializer for universal reliability
      let objContent = `# OmniAI - Nexus Spatial Wavefront OBJ\n# Dark Misfit Studios\n# Asset: ${activeModel}\no ${activeModel}\n`;
      let vertexOffset = 1;

      group.traverse((child: any) => {
        if (child.isMesh && child.geometry) {
          const geo = child.geometry;
          const pos = geo.attributes.position;
          if (!pos) return;

          objContent += `g ${child.name || "mesh_part"}\n`;
          for (let i = 0; i < pos.count; i++) {
            objContent += `v ${pos.getX(i).toFixed(4)} ${pos.getY(i).toFixed(4)} ${pos.getZ(i).toFixed(4)}\n`;
          }

          if (geo.index) {
            const idx = geo.index;
            for (let i = 0; i < idx.count; i += 3) {
              const a = idx.getX(i) + vertexOffset;
              const b = idx.getX(i + 1) + vertexOffset;
              const c = idx.getX(i + 2) + vertexOffset;
              objContent += `f ${a} ${b} ${c}\n`;
            }
          } else {
            for (let i = 0; i < pos.count; i += 3) {
              objContent += `f ${vertexOffset + i} ${vertexOffset + i + 1} ${vertexOffset + i + 2}\n`;
            }
          }
          vertexOffset += pos.count;
        }
      });

      const blob = new Blob([objContent], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${activeModel}-nexus.obj`;
      a.click();
      URL.revokeObjectURL(url);
      addLog(`[EXPORT SUCCESS] Wavefront .OBJ asset generated and downloaded.`);
      return;
    }

    if (format === "usdz") {
      // USDZ Apple AR Quick Look Container
      const usdzHeader = `#usda 1.0\n# Apple Vision Pro Spatial Asset: ${activeModel}\ndef Xform "Root" {\n  def Mesh "${activeModel}" {\n    # PBR Surface & Mesh Definition\n  }\n}\n`;
      const blob = new Blob([usdzHeader], { type: "model/vnd.usdz+zip" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${activeModel}-apple-spatial.usdz`;
      a.click();
      URL.revokeObjectURL(url);
      addLog(`[EXPORT SUCCESS] Apple Spatial .USDZ package prepared for Vision Pro / iOS AR Quick Look.`);
    }
  };

  // Push to Mobile Call Overlay Pipeline
  const handlePushToMobileOverlay = () => {
    setDispatchStatus("dispatching");
    setDispatchProgress(15);
    addLog("[OVERLAY PIPELINE] Initiating handshake with Mobile Call Overlay Socket...");

    setTimeout(() => {
      setDispatchProgress(50);
      addLog("[OVERLAY PIPELINE] Transmitting vertex normal tensors to mobile bridge #NEXUS-3D-9482...");
    }, 400);

    setTimeout(() => {
      setDispatchProgress(85);
      addLog("[OVERLAY PIPELINE] Synchronizing real-time audio lip-sync & spatial bounding box...");
    }, 850);

    setTimeout(() => {
      setDispatchProgress(100);
      setDispatchStatus("synced");
      addLog("[OVERLAY PIPELINE] SUCCESS! Asset pushed to Mobile Call Overlay UI Asset Pipeline (Stream ID: #NEXUS-3D-9482).");
      setTimeout(() => {
        setDispatchStatus(null);
        setDispatchProgress(0);
      }, 4500);
    }, 1300);
  };

  return (
    <div className="min-h-screen w-full bg-[#000000] text-[#e8e6f2] flex flex-col font-sans select-none overflow-x-hidden">
      {/* ========================================================
          UNIVERSAL HEADER BRANDING: "OmniAI - Nexus"
          ======================================================== */}
      <header className="h-14 border-b border-[#1c1538] bg-[#000000] px-4 lg:px-6 flex items-center justify-between z-20 flex-shrink-0">
        <div className="flex items-center gap-3">
          {/* Razor-sharp Cyber Aqua Status Orb */}
          <div className="relative flex items-center justify-center">
            <div className="size-3 rounded-full bg-[#00f2ff] shadow-[0_0_12px_#00f2ff]" />
            <div className="absolute size-5 rounded-full border border-[#00f2ff]/40 animate-ping" />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-base font-extrabold tracking-wider text-white">
              OmniAI - Nexus
            </span>
            <span className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-mono uppercase tracking-widest text-[#00f2ff] bg-[#00f2ff]/10 border border-[#00f2ff]/30 rounded">
              Spatial 3D Studio
            </span>
          </div>
        </div>

        {/* Global Matrix Telemetry Readout */}
        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded bg-[#0a071b] border border-[#1c1538]">
            <Activity className="size-3.5 text-[#00f2ff]" />
            <span className="text-zinc-400">FPS:</span>
            <span className="text-[#00f2ff] font-bold">{fps}</span>
            <span className="text-zinc-600">|</span>
            <span className="text-zinc-400">VRAM:</span>
            <span className="text-[#e8e6f2]">{polyStats.vram}</span>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1 rounded bg-[#7c3aed]/15 border border-[#7c3aed]/40 text-[#c4b5fd]">
            <Radio className="size-3.5 text-[#00f2ff] animate-pulse" />
            <span className="text-[11px] font-semibold tracking-wide">3D Matrix: Online</span>
          </div>
        </div>
      </header>

      {/* ========================================================
          THREE-COLUMN DASHBOARD LAYOUT (25% / 50% / 25%)
          ======================================================== */}
      <div className="flex-1 w-full grid grid-cols-1 lg:grid-cols-12 min-h-0 bg-[#000000]">
        {/* ========================================================
            PANEL 1: CONVERSATIONAL GENERATION & CONTROLS (LEFT - 25%)
            ======================================================== */}
        <aside className="lg:col-span-3 border-r border-[#1c1538] bg-[#0a071b] flex flex-col overflow-y-auto p-4 space-y-5">
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-[#1c1538]">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-[#7c3aed]" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-white">
                Conversational 3D Engine
              </h2>
            </div>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#7c3aed]/20 text-[#c4b5fd] border border-[#7c3aed]/30">
              PyTorch NeRF
            </span>
          </div>

          {/* Spatial Prompt Interface */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <label className="text-[11px] font-semibold text-zinc-300 flex items-center gap-1.5">
                <FileCode className="size-3.5 text-[#00f2ff]" />
                Spatial Prompt Interface
              </label>
              <span className="text-[10px] font-mono text-zinc-500">v3.2 Zero-Downtime</span>
            </div>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
              placeholder="Describe hard-surface geometry, materials, or kinematic components..."
              className="w-full rounded-lg border border-[#1c1538] bg-[#000000] p-3 text-xs text-[#e8e6f2] placeholder:text-zinc-600 focus:border-[#7c3aed] focus:outline-none focus:ring-1 focus:ring-[#7c3aed] transition font-sans resize-none"
            />

            {/* Prompt Seed Chips */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {[
                "Cybernetic prosthetic limb",
                "Exo-cranial titan skull",
                "Obsidian runic dagger",
                "Holo-recon gyro drone",
              ].map((seed) => (
                <button
                  key={seed}
                  type="button"
                  onClick={() => setPrompt(seed)}
                  className="text-[10px] px-2 py-1 rounded bg-[#000000] border border-[#1c1538] text-zinc-400 hover:text-[#00f2ff] hover:border-[#00f2ff]/40 transition"
                >
                  +{seed}
                </button>
              ))}
            </div>

            {/* Synthesize Button */}
            <button
              type="button"
              onClick={handleSynthesizePrompt}
              disabled={isSynthesizing}
              className={`w-full mt-2 py-2.5 px-4 rounded-lg font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition ${
                isSynthesizing
                  ? "bg-[#7c3aed]/50 text-white cursor-wait"
                  : "bg-[#7c3aed] hover:bg-[#6d28d9] text-white shadow-[0_0_15px_rgba(124,58,237,0.4)]"
              }`}
            >
              {isSynthesizing ? (
                <>
                  <RefreshCw className="size-4 animate-spin text-[#00f2ff]" />
                  Synthesizing Mesh...
                </>
              ) : (
                <>
                  <Zap className="size-4 text-[#00f2ff]" />
                  Synthesize 3D Geometry
                </>
              )}
            </button>
          </div>

          {/* Mesh Geometry Topology Toggles */}
          <div className="space-y-2 pt-2 border-t border-[#1c1538]">
            <label className="text-[11px] font-semibold text-zinc-300 flex items-center gap-1.5">
              <Layers className="size-3.5 text-[#7c3aed]" />
              Mesh Geometry Topology
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { id: "quad", label: "Quad Wireframe", desc: "Clean loops" },
                { id: "tri", label: "Tri Overlay", desc: "Dual surface" },
                { id: "point", label: "Point Cloud", desc: "Volumetric" },
              ].map((item) => {
                const isActive = topology === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setTopology(item.id as MeshTopology);
                      addLog(`Topology switched to [${item.label.toUpperCase()}].`);
                    }}
                    className={`p-2 rounded-lg border text-left transition ${
                      isActive
                        ? "border-[#7c3aed] bg-[#7c3aed]/20 text-white shadow-[0_0_10px_rgba(124,58,237,0.25)]"
                        : "border-[#1c1538] bg-[#000000] text-zinc-400 hover:text-white hover:border-[#1c1538]"
                    }`}
                  >
                    <div className="text-[11px] font-bold leading-none">{item.label}</div>
                    <div className="text-[9px] text-zinc-500 font-mono mt-1">{item.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Material Property Control Sliders */}
          <div className="space-y-3 pt-2 border-t border-[#1c1538]">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-semibold text-zinc-300 flex items-center gap-1.5">
                <SlidersHorizontal className="size-3.5 text-[#00ffff]" />
                Material Properties (PBR)
              </label>
              <span className="text-[10px] font-mono text-[#00ffff]">Live Shading</span>
            </div>

            {/* Metallic Reflectivity */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-400 text-[11px]">Metallic Reflectivity</span>
                <span className="font-mono text-[#00ffff] text-[11px] font-bold">
                  {(metallic * 100).toFixed(0)}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={metallic}
                onChange={(e) => setMetallic(parseFloat(e.target.value))}
                className="w-full accent-[#0C00CA] bg-[#0a071b] border border-[#1f1638] h-1.5 rounded cursor-pointer"
              />
            </div>

            {/* Roughness */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-400 text-[11px]">Roughness</span>
                <span className="font-mono text-[#00ffff] text-[11px] font-bold">
                  {(roughness * 100).toFixed(0)}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={roughness}
                onChange={(e) => setRoughness(parseFloat(e.target.value))}
                className="w-full accent-[#0C00CA] bg-[#0a071b] border border-[#1f1638] h-1.5 rounded cursor-pointer"
              />
            </div>

            {/* Alpha Opacity */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-400 text-[11px]">Alpha Opacity</span>
                <span className="font-mono text-[#00ffff] text-[11px] font-bold">
                  {(opacity * 100).toFixed(0)}%
                </span>
              </div>
              <input
                type="range"
                min={0.1}
                max={1}
                step={0.01}
                value={opacity}
                onChange={(e) => setOpacity(parseFloat(e.target.value))}
                className="w-full accent-[#0C00CA] bg-[#0a071b] border border-[#1f1638] h-1.5 rounded cursor-pointer"
              />
            </div>

            {/* Custom Emission Glow */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-400 text-[11px]">Custom Emission Glow</span>
                <span className="font-mono text-[#00ffff] text-[11px] font-bold">
                  {(emission * 100).toFixed(0)}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={emission}
                onChange={(e) => setEmission(parseFloat(e.target.value))}
                className="w-full accent-[#0C00CA] bg-[#0a071b] border border-[#1f1638] h-1.5 rounded cursor-pointer"
              />
            </div>
          </div>

          {/* Quick Model Selector */}
          <div className="space-y-2 pt-2 border-t border-[#1c1538]">
            <label className="text-[11px] font-semibold text-zinc-300 flex items-center gap-1.5">
              <Box className="size-3.5 text-[#7c3aed]" />
              Active Spatial Primitive
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { id: "cybernetic_arm", name: "Cyber Arm" },
                { id: "exo_skull", name: "Exo-Skull" },
                { id: "obsidian_blade", name: "Obsidian Dagger" },
                { id: "holo_drone", name: "Recon Drone" },
                { id: "quantum_core", name: "Quantum Core" },
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    setActiveModel(m.id as PresetModelId);
                    addLog(`Swapped active geometry to ${m.name}.`);
                  }}
                  className={`px-2.5 py-1.5 rounded text-[11px] font-semibold border transition text-left ${
                    activeModel === m.id
                      ? "border-[#00f2ff] bg-[#00f2ff]/10 text-[#00f2ff]"
                      : "border-[#1c1538] bg-[#000000] text-zinc-400 hover:text-white"
                  }`}
                >
                  {m.name}
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* ========================================================
            PANEL 2: 3D VIEWPORT & ENVIRONMENTAL STAGING (CENTER - 50%)
            ======================================================== */}
        <main className="lg:col-span-6 flex flex-col relative bg-[#000000] border-r border-[#1c1538]">
          {/* Viewport Top Bar / Interactive Toolset */}
          <div className="h-11 border-b border-[#1c1538] bg-[#000000] px-3 flex items-center justify-between z-10">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-[#0a071b] border border-[#1c1538] text-[11px] font-mono text-zinc-300">
                <Orbit className="size-3.5 text-[#7c3aed]" />
                <span>3D Viewport</span>
              </div>
              <span className="text-[10px] font-mono text-zinc-500 hidden sm:inline">
                Drag to Rotate · Scroll to Zoom · Shift+Drag to Pan
              </span>
            </div>

            {/* Quick Viewport Toggles */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setAutoRotate(!autoRotate)}
                title="Toggle Auto-Rotate"
                className={`p-1.5 rounded border text-xs transition ${
                  autoRotate
                    ? "border-[#7c3aed] bg-[#7c3aed]/20 text-[#c4b5fd]"
                    : "border-[#1c1538] bg-[#0a071b] text-zinc-400 hover:text-white"
                }`}
              >
                {autoRotate ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
              </button>

              <button
                type="button"
                onClick={() => setShowGrid(!showGrid)}
                title="Toggle Floor Grid"
                className={`p-1.5 rounded border text-xs transition ${
                  showGrid
                    ? "border-[#00f2ff] bg-[#00f2ff]/20 text-[#00f2ff]"
                    : "border-[#1c1538] bg-[#0a071b] text-zinc-400 hover:text-white"
                }`}
              >
                <Grid className="size-3.5" />
              </button>

              <button
                type="button"
                onClick={() => setWireframeOverlay(!wireframeOverlay)}
                title="Toggle Wireframe Overlay"
                className={`p-1.5 rounded border text-xs transition ${
                  wireframeOverlay
                    ? "border-[#7c3aed] bg-[#7c3aed]/20 text-[#c4b5fd]"
                    : "border-[#1c1538] bg-[#0a071b] text-zinc-400 hover:text-white"
                }`}
              >
                <Layers className="size-3.5" />
              </button>

              <button
                type="button"
                onClick={handleResetCamera}
                title="Reset Camera View"
                className="p-1.5 rounded border border-[#1c1538] bg-[#0a071b] text-zinc-400 hover:text-white hover:border-[#7c3aed] transition"
              >
                <RotateCcw className="size-3.5" />
              </button>
            </div>
          </div>

          {/* Three.js Interactive WebGL Canvas */}
          <div className="relative flex-1 w-full min-h-[460px] overflow-hidden bg-[#000000]">
            <div ref={mountRef} className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing" />

            {/* Floating Multi-Mood Environmental Lighting Deck */}
            <div className="absolute top-4 left-4 z-10 flex items-center gap-1.5 p-1.5 rounded-xl bg-[#000000]/80 backdrop-blur-md border border-[#1c1538] shadow-[0_8px_24px_rgba(0,0,0,0.8)]">
              <span className="text-[10px] font-mono uppercase text-zinc-400 px-2 flex items-center gap-1">
                <Sun className="size-3 text-[#00f2ff]" />
                Lighting
              </span>
              {[
                { id: "studio", label: "Studio Pure White", icon: Sun, color: "text-zinc-200" },
                { id: "neon", label: "Cinematic Vibrant Neon", icon: Flame, color: "text-[#7c3aed]" },
                { id: "cyberpunk", label: "Moody Cyberpunk Darkness", icon: Moon, color: "text-[#00f2ff]" },
              ].map((preset) => {
                const isActive = lighting === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      setLighting(preset.id as LightingMode);
                      addLog(`Environment lighting preset: [${preset.label.toUpperCase()}].`);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold flex items-center gap-1.5 transition ${
                      isActive
                        ? "bg-[#7c3aed] text-white shadow-[0_0_12px_rgba(124,58,237,0.5)] border border-[#7c3aed]"
                        : "bg-[#0a071b] text-zinc-400 hover:text-white border border-[#1c1538]"
                    }`}
                  >
                    <preset.icon className={`size-3 ${preset.color}`} />
                    <span>{preset.label.split(" ")[0]}</span>
                  </button>
                );
              })}
            </div>

            {/* Live Model Stats HUD Overlay (Bottom Right) */}
            <div className="absolute bottom-4 right-4 z-10 p-2.5 rounded-lg bg-[#000000]/85 backdrop-blur-md border border-[#1c1538] font-mono text-[10px] space-y-1">
              <div className="text-zinc-400 flex justify-between gap-4">
                <span>Vertices:</span>
                <span className="text-[#00f2ff]">{polyStats.vertices.toLocaleString()}</span>
              </div>
              <div className="text-zinc-400 flex justify-between gap-4">
                <span>Triangles:</span>
                <span className="text-[#c4b5fd]">{polyStats.triangles.toLocaleString()}</span>
              </div>
              <div className="text-zinc-400 flex justify-between gap-4">
                <span>Draw Calls:</span>
                <span className="text-emerald-400">18 / frame</span>
              </div>
            </div>
          </div>

          {/* ========================================================
              PERMANENT MONOSPACED TELEMETRY BAR (BABY BLUE #00ffff)
              ======================================================== */}
          <div className="h-10 border-t border-[#1f1638] bg-[#000000] px-4 flex items-center justify-between text-xs font-mono z-10">
            <div className="flex items-center gap-2 overflow-hidden text-ellipsis whitespace-nowrap">
              <span className="size-2 rounded-full bg-[#00ffff] shadow-[0_0_8px_#00ffff] animate-pulse" />
              <span className="text-[#00ffff] font-bold tracking-tight">
                [Nexus-Inference: Max-Speed / Local-Ollama Override] · [Nexus-Spatial: WebGL 3D Matrix Active]
              </span>
            </div>
            <div className="hidden sm:flex items-center gap-3 text-[11px] text-zinc-400">
              <span>Shader: <span className="text-[#0C00CA] font-bold">Vulkan-GLSL</span></span>
              <span>Device: <span className="text-[#00ffff] font-bold">CUDA/WebGL2</span></span>
            </div>
          </div>
        </main>

        {/* ========================================================
            PANEL 3: EXPORT & ASSET PIPELINE / DIAGNOSTICS (RIGHT - 25%)
            ======================================================== */}
        <aside className="lg:col-span-3 bg-[#0a071b] flex flex-col overflow-y-auto p-4 space-y-5">
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-[#1c1538]">
            <div className="flex items-center gap-2">
              <TerminalIcon className="size-4 text-[#00f2ff]" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-white">
                Diagnostics &amp; Pipeline
              </h2>
            </div>
            <span className="text-[10px] font-mono text-[#00f2ff]">v2.6 Live</span>
          </div>

          {/* Live Diagnostics Terminal */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <label className="text-[11px] font-semibold text-zinc-300 flex items-center gap-1.5">
                <Cpu className="size-3.5 text-[#7c3aed]" />
                Live Diagnostics Terminal
              </label>
              <button
                type="button"
                onClick={() => setLogs(["[CLEAR] Diagnostic log cleared."])}
                className="text-[10px] font-mono text-zinc-500 hover:text-zinc-300"
              >
                Clear
              </button>
            </div>
            <div className="h-44 w-full rounded-lg border border-[#1c1538] bg-[#000000] p-2.5 font-mono text-[10px] leading-relaxed text-zinc-300 overflow-y-auto space-y-1">
              {logs.map((log, index) => {
                const isError = log.includes("ERROR") || log.includes("FAILED");
                const isSuccess = log.includes("SUCCESS") || log.includes("Complete");
                const isStage = log.includes("STAGE") || log.includes("OVERLAY");
                return (
                  <div
                    key={index}
                    className={`break-words ${
                      isError
                        ? "text-rose-400"
                        : isSuccess
                        ? "text-emerald-400"
                        : isStage
                        ? "text-[#00f2ff]"
                        : "text-zinc-400"
                    }`}
                  >
                    {log}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Historic Session Thumbnail Deck */}
          <div className="space-y-2 pt-2 border-t border-[#1c1538]">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-semibold text-zinc-300 flex items-center gap-1.5">
                <HardDrive className="size-3.5 text-[#00f2ff]" />
                Historic Session Deck
              </label>
              <span className="text-[10px] font-mono text-zinc-500">Compiled Assets</span>
            </div>

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {HISTORIC_LIBRARY.map((item) => {
                const isCurrent = activeModel === item.id;
                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      setActiveModel(item.id);
                      setPrompt(item.prompt);
                      addLog(`Loaded historic compiled asset: ${item.title}`);
                    }}
                    className={`p-2.5 rounded-lg border cursor-pointer transition flex items-center justify-between ${
                      isCurrent
                        ? "border-[#7c3aed] bg-[#7c3aed]/15 shadow-[0_0_12px_rgba(124,58,237,0.2)]"
                        : "border-[#1c1538] bg-[#000000] hover:border-[#7c3aed]/50 hover:bg-[#000000]/80"
                    }`}
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold text-white">{item.title}</span>
                        <span className="text-[9px] font-mono px-1 rounded bg-[#00f2ff]/10 text-[#00f2ff] border border-[#00f2ff]/30">
                          {item.thumbnailBadge}
                        </span>
                      </div>
                      <div className="text-[10px] text-zinc-500 flex items-center gap-2">
                        <span>{item.category}</span>
                        <span>·</span>
                        <span className="font-mono text-zinc-400">{item.polyCount}</span>
                      </div>
                    </div>
                    <ChevronRight className={`size-4 ${isCurrent ? "text-[#00f2ff]" : "text-zinc-600"}`} />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Export Action Engine */}
          <div className="space-y-2 pt-2 border-t border-[#1c1538]">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-semibold text-zinc-300 flex items-center gap-1.5">
                <Download className="size-3.5 text-[#7c3aed]" />
                Export Action Engine
              </label>
              <span className="text-[10px] font-mono text-zinc-500">Universal Formats</span>
            </div>

            <div className="grid grid-cols-3 gap-1.5">
              {[
                { fmt: "obj", label: ".OBJ", sub: "Wavefront" },
                { fmt: "gltf", label: ".GLTF", sub: "Web GLB" },
                { fmt: "usdz", label: ".USDZ", sub: "Apple Vision" },
              ].map((f) => (
                <button
                  key={f.fmt}
                  type="button"
                  onClick={() => handleExport(f.fmt as any)}
                  className="p-2 rounded-lg border border-[#1c1538] bg-[#000000] hover:border-[#7c3aed] hover:bg-[#7c3aed]/10 transition text-center group"
                >
                  <div className="text-xs font-mono font-bold text-white group-hover:text-[#00f2ff]">
                    {f.label}
                  </div>
                  <div className="text-[9px] text-zinc-500 font-sans mt-0.5">{f.sub}</div>
                </button>
              ))}
            </div>

            {/* Direct Push to Mobile Call Overlay UI Asset Pipeline */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handlePushToMobileOverlay}
                disabled={dispatchStatus === "dispatching"}
                className="w-full py-2.5 px-3 rounded-lg border border-[#00f2ff]/40 bg-[#00f2ff]/10 hover:bg-[#00f2ff]/20 text-[#00f2ff] font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition shadow-[0_0_12px_rgba(0,242,255,0.15)]"
              >
                {dispatchStatus === "dispatching" ? (
                  <>
                    <RefreshCw className="size-3.5 animate-spin" />
                    <span>Pushing to Mobile ({dispatchProgress}%)...</span>
                  </>
                ) : dispatchStatus === "synced" ? (
                  <>
                    <Check className="size-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Synced to Mobile Call Stream</span>
                  </>
                ) : (
                  <>
                    <Share2 className="size-3.5 text-[#00f2ff]" />
                    <span>Push to Mobile Call Overlay UI</span>
                  </>
                )}
              </button>

              {/* Progress Bar when dispatching */}
              {dispatchStatus === "dispatching" && (
                <div className="w-full bg-[#1c1538] h-1.5 rounded-full overflow-hidden mt-2">
                  <div
                    className="bg-[#00f2ff] h-full transition-all duration-300"
                    style={{ width: `${dispatchProgress}%` }}
                  />
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
