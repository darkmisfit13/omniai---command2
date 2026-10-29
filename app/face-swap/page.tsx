"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import * as THREE from "three";
import {
  Sparkles,
  Upload,
  Scissors,
  Layers,
  Palette,
  Sun,
  Moon,
  Zap,
  RotateCcw,
  Maximize2,
  Sliders,
  Check,
  ShieldCheck,
  CloudRain,
  Thermometer,
  Wind,
  Droplets,
  Camera,
  Shirt,
  Eye,
  RefreshCw,
  FolderDown,
  ChevronRight,
  Plus,
  Compass,
  Move
} from "lucide-react";
import { mediaVault } from "@/lib/mediaVault";
import StudioToggleMatrix from "@/components/StudioToggleMatrix";

/* =========================================================================
   DARK MISFIT STUDIOS — OMNIAI - NEXUS: OMNISTYLE STUDIO
   Principal Creative Media Architecture & Frontend Engineering
   Palette Parameters:
     - Canvas Background: #000000 (Pure Black)
     - Layer Container blocks: Dark Bluish Purple (#0e0a1c, #120d24, #16112c, #1a1336, #211742)
     - Active Outfitting Selections: Very Light Neon Bluish Green (#00ffa3, #39ffb4)
   Naming: "OmniAI - Nexus"
   ========================================================================= */

type GarmentCategory = "all" | "tops" | "bottoms" | "outerwear" | "footwear" | "accessories";

interface GarmentItem {
  id: string;
  name: string;
  category: "tops" | "bottoms" | "outerwear" | "footwear" | "accessories";
  colorName: string;
  hexColor: string;
  material: string;
  weatherTag: "rainproof" | "thermal" | "lightweight" | "all-season";
  isEquipped: boolean;
  drapeWeight: number; // 0 to 1
  contrastTag: string;
}

const DEFAULT_INVENTORY: GarmentItem[] = [
  {
    id: "g-1",
    name: "Obsidian Longline Tech Trench",
    category: "outerwear",
    colorName: "Pitch Obsidian",
    hexColor: "#050508",
    material: "3-Layer GORE-TEX Ripstop",
    weatherTag: "rainproof",
    isEquipped: true,
    drapeWeight: 0.85,
    contrastTag: "Monolithic Void",
  },
  {
    id: "g-2",
    name: "Cybernetic Ribbed Compression Top",
    category: "tops",
    colorName: "Deep Misfit Purple",
    hexColor: "#1d143a",
    material: "Seamless Elastane Micro-Mesh",
    weatherTag: "lightweight",
    isEquipped: true,
    drapeWeight: 0.35,
    contrastTag: "Complementary Accent",
  },
  {
    id: "g-3",
    name: "Tactical Pleated Cargo Trousers",
    category: "bottoms",
    colorName: "Charcoal Slate",
    hexColor: "#181822",
    material: "Heavy Cordura Twill",
    weatherTag: "all-season",
    isEquipped: true,
    drapeWeight: 0.72,
    contrastTag: "Neutral Base",
  },
  {
    id: "g-4",
    name: "Vibram Lugged Combat Boots",
    category: "footwear",
    colorName: "Matte Black",
    hexColor: "#0d0d12",
    material: "Full-Grain Treated Calfskin",
    weatherTag: "rainproof",
    isEquipped: true,
    drapeWeight: 0.95,
    contrastTag: "Heavy Grounding",
  },
  {
    id: "g-5",
    name: "Neon Bluish-Green Balaclava Scarf",
    category: "accessories",
    colorName: "Light Neon Cyan",
    hexColor: "#00ffa3",
    material: "Merino Cashmere Blend",
    weatherTag: "thermal",
    isEquipped: false,
    drapeWeight: 0.25,
    contrastTag: "High Energy Flare",
  },
  {
    id: "g-6",
    name: "Liquid Vinyl Cropped Flight Bomber",
    category: "outerwear",
    colorName: "Glossy Violet",
    hexColor: "#2e1548",
    material: "Reflective Thermal Polyurethane",
    weatherTag: "rainproof",
    isEquipped: false,
    drapeWeight: 0.65,
    contrastTag: "Avant-Garde Sheen",
  },
  {
    id: "g-7",
    name: "Architectural Drape Cowl Hood",
    category: "accessories",
    colorName: "Midnight Navy",
    hexColor: "#0d1124",
    material: "Raw Japanese Denim Jersey",
    weatherTag: "all-season",
    isEquipped: false,
    drapeWeight: 0.5,
    contrastTag: "Shadow Framing",
  },
  {
    id: "g-8",
    name: "Cybernetic Magnetic Modular Rig",
    category: "accessories",
    colorName: "Anodized Titanium",
    hexColor: "#222533",
    material: "Aviation 7075-T6 Aluminum",
    weatherTag: "all-season",
    isEquipped: false,
    drapeWeight: 0.4,
    contrastTag: "Hardware Texture",
  },
];

type LightingEnvironment = "cyberpunk" | "studio" | "cinematic";

const BRAND_PALETTE = [
  { name: "Pure Obsidian", hex: "#000000" },
  { name: "Dark Misfit Purple", hex: "#140e28" },
  { name: "Neon Bluish-Green", hex: "#00ffa3" },
  { name: "Electric Cyan", hex: "#00f2fe" },
  { name: "Ultraviolet", hex: "#e879f9" },
];

export default function OmniStyleStudioNexus() {
  // ---------------------------------------------------------------------------
  // PANEL 1 STATE: WARDROBE DIGITIZATION & INVENTORY CRAWL
  // ---------------------------------------------------------------------------
  const [inventory, setInventory] = useState<GarmentItem[]>(DEFAULT_INVENTORY);
  const [activeCategory, setActiveCategory] = useState<GarmentCategory>("all");
  const [crawledUrl, setCrawledUrl] = useState<string>("");
  const [isSegmenting, setIsSegmenting] = useState<boolean>(false);
  const [segmentationProgress, setSegmentationProgress] = useState<number>(0);
  const [isCrawlingUrl, setIsCrawlingUrl] = useState<boolean>(false);
  const [uploadedFileName, setUploadedFileName] = useState<string>("");

  // ---------------------------------------------------------------------------
  // PANEL 2 STATE: THE WEBGL APPAREL SIMULATION CANVAS
  // ---------------------------------------------------------------------------
  const mountRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const avatarGroupRef = useRef<THREE.Group | null>(null);
  const lightsGroupRef = useRef<THREE.Group | null>(null);

  const [lightingMode, setLightingMode] = useState<LightingEnvironment>("cyberpunk");
  const [isTurntableActive, setIsTurntableActive] = useState<boolean>(true);
  const isTurntableActiveRef = useRef<boolean>(true);
  useEffect(() => {
    isTurntableActiveRef.current = isTurntableActive;
  }, [isTurntableActive]);

  const [isWireframeMode, setIsWireframeMode] = useState<boolean>(false);
  const [activeSwatchIndex, setActiveSwatchIndex] = useState<number>(2); // Neon Green

  // Orbit drag interaction variables
  const isDraggingRef = useRef<boolean>(false);
  const previousMousePosition = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [cameraZoom, setCameraZoom] = useState<number>(1.0);

  // ---------------------------------------------------------------------------
  // PANEL 3 STATE: STYLE PROFILE & REAL-TIME ANALYTICS
  // ---------------------------------------------------------------------------
  const [skinUndertone, setSkinUndertone] = useState<"cool_olive" | "obsidian_fair" | "warm_bronze">("cool_olive");
  const [contrastRatio, setContrastRatio] = useState<number>(88); // 88% high-contrast noir
  const [recommendationSchedule, setRecommendationSchedule] = useState<string>(
    "Midnight Neo-Tokyo Underground Warehouse Set // High Rain Infiltration"
  );
  const [isConsultingCouncil, setIsConsultingCouncil] = useState<boolean>(false);
  const [triAgentLog, setTriAgentLog] = useState<{
    strategist: string;
    empath: string;
    ghost: string;
  }>({
    strategist: "GORE-TEX outer shell layer locks weather resistance against 85% rain forecast. Compression base maintains core warmth.",
    empath: "Heavy dark draping radiates protective armor for emotional isolation, contrasted by sharp neon highlights of resilience.",
    ghost: "Low-frequency sub-bass vibrations will ripple the trench fabric. High contrast silhouette stands out in strobe-lit smoke.",
  });

  // Weather Sync Line State
  const [weatherData] = useState({
    city: "NEO-TOKYO SECTOR 7",
    temperature: "11°C (52°F)",
    humidity: "82% RH",
    precipitation: "88% Heavy Rain",
    windSpeed: "19 km/h NW",
    condition: "Acid Rain & Cold Fog",
  });

  const [toastMessage, setToastMessage] = useState<string>("");

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((c) => (c === msg ? "" : c));
    }, 4000);
  };

  // Filtered Inventory List
  const filteredInventory = useMemo(() => {
    if (activeCategory === "all") return inventory;
    return inventory.filter((item) => item.category === activeCategory);
  }, [inventory, activeCategory]);

  // Equipped Garments
  const equippedGarments = useMemo(() => {
    return inventory.filter((item) => item.isEquipped);
  }, [inventory]);

  // ---------------------------------------------------------------------------
  // 3D DIGITAL AVATAR & APPAREL WEBGL INITIALIZATION (THREE.JS)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // 1. Scene, Camera, Renderer
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 500;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000); // Pure Black Canvas Background
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 1000);
    camera.position.set(0, 1.2, 3.8);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    rendererRef.current = renderer;

    // Clean container before appending
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }
    container.appendChild(renderer.domElement);

    // 2. Avatar Group
    const avatarGroup = new THREE.Group();
    avatarGroupRef.current = avatarGroup;
    scene.add(avatarGroup);

    // Procedural 3D Mannequin Body Geometries
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: 0x16112c,
      roughness: 0.35,
      metalness: 0.7,
      wireframe: false,
    });

    const jointMaterial = new THREE.MeshStandardMaterial({
      color: 0x00ffa3,
      emissive: 0x00ffa3,
      emissiveIntensity: 0.4,
      roughness: 0.2,
      metalness: 0.9,
    });

    // Head
    const headGeo = new THREE.SphereGeometry(0.2, 32, 32);
    headGeo.scale(0.85, 1.1, 0.9);
    const head = new THREE.Mesh(headGeo, bodyMaterial);
    head.position.y = 1.68;
    avatarGroup.add(head);

    // Visor Headpiece
    const visorGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.08, 32, 1, true, -Math.PI / 2, Math.PI);
    const visor = new THREE.Mesh(visorGeo, jointMaterial);
    visor.position.set(0, 1.68, 0.08);
    visor.rotation.y = Math.PI / 2;
    avatarGroup.add(visor);

    // Neck
    const neckGeo = new THREE.CylinderGeometry(0.08, 0.09, 0.14, 16);
    const neck = new THREE.Mesh(neckGeo, bodyMaterial);
    neck.position.y = 1.48;
    avatarGroup.add(neck);

    // Chest / Torso
    const torsoGeo = new THREE.CylinderGeometry(0.28, 0.2, 0.55, 32);
    torsoGeo.scale(1.1, 1, 0.65);
    const torso = new THREE.Mesh(torsoGeo, bodyMaterial);
    torso.position.y = 1.15;
    avatarGroup.add(torso);

    // Pelvis
    const pelvisGeo = new THREE.CylinderGeometry(0.2, 0.23, 0.22, 32);
    pelvisGeo.scale(1, 1, 0.65);
    const pelvis = new THREE.Mesh(pelvisGeo, bodyMaterial);
    pelvis.position.y = 0.78;
    avatarGroup.add(pelvis);

    // Shoulders
    const shoulderL = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 16), jointMaterial);
    shoulderL.position.set(-0.35, 1.35, 0);
    const shoulderR = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 16), jointMaterial);
    shoulderR.position.set(0.35, 1.35, 0);
    avatarGroup.add(shoulderL, shoulderR);

    // Arms
    const armL = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.055, 0.65, 16), bodyMaterial);
    armL.position.set(-0.4, 0.95, 0);
    armL.rotation.z = 0.15;
    const armR = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.055, 0.65, 16), bodyMaterial);
    armR.position.set(0.4, 0.95, 0);
    armR.rotation.z = -0.15;
    avatarGroup.add(armL, armR);

    // Legs
    const legL = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.075, 0.8, 16), bodyMaterial);
    legL.position.set(-0.14, 0.38, 0);
    const legR = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.075, 0.8, 16), bodyMaterial);
    legR.position.set(0.14, 0.38, 0);
    avatarGroup.add(legL, legR);

    // 3. Circular Pedestal Base
    const pedestalGeo = new THREE.CylinderGeometry(0.85, 0.9, 0.06, 48);
    const pedestalMat = new THREE.MeshStandardMaterial({
      color: 0x0a0614,
      roughness: 0.2,
      metalness: 0.85,
    });
    const pedestal = new THREE.Mesh(pedestalGeo, pedestalMat);
    pedestal.position.y = -0.05;
    scene.add(pedestal);

    // Neon Floor Ring
    const ringGeo = new THREE.RingGeometry(0.86, 0.89, 64);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x00ffa3,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -0.01;
    scene.add(ring);

    // 4. Lighting Rig
    const lightsGroup = new THREE.Group();
    lightsGroupRef.current = lightsGroup;
    scene.add(lightsGroup);

    const ambientLight = new THREE.AmbientLight(0x0e0a1c, 1.2);
    lightsGroup.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0x00ffa3, 2.5);
    keyLight.position.set(2, 3, 3);
    lightsGroup.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x6c63ff, 3.2);
    rimLight.position.set(-3, 2, -2);
    lightsGroup.add(rimLight);

    const cyanFill = new THREE.PointLight(0x00f2fe, 1.5, 6);
    cyanFill.position.set(0, 0.5, 2);
    lightsGroup.add(cyanFill);

    // 5. Render Animation Loop
    let animationId: number;
    const animate = () => {
      animationId = requestAnimationFrame(animate);

      if (avatarGroupRef.current && isTurntableActiveRef.current && !isDraggingRef.current) {
        avatarGroupRef.current.rotation.y += 0.005;
      }

      renderer.render(scene, camera);
    };

    animate();

    // Resize Handler
    const handleResize = () => {
      if (!container || !camera || !renderer) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", handleResize);
      renderer.dispose();
      while (container.firstChild) {
        container.removeChild(container.firstChild);
      }
    };
  }, []);

  // ---------------------------------------------------------------------------
  // UPDATE LIGHTING ENVIRONMENT
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const scene = sceneRef.current;
    const lights = lightsGroupRef.current;
    if (!scene || !lights) return;

    // Remove old lights
    while (lights.children.length > 0) {
      lights.remove(lights.children[0]);
    }

    if (lightingMode === "cyberpunk") {
      const amb = new THREE.AmbientLight(0x0a0614, 1.0);
      const key = new THREE.DirectionalLight(0x00ffa3, 3.0);
      key.position.set(2.5, 3.5, 2.5);
      const rim = new THREE.DirectionalLight(0x9d4edd, 3.5);
      rim.position.set(-2.5, 2.5, -2.5);
      const cyan = new THREE.PointLight(0x00f2fe, 2.0, 7);
      cyan.position.set(0, 0.6, 2.2);
      lights.add(amb, key, rim, cyan);
    } else if (lightingMode === "studio") {
      const amb = new THREE.AmbientLight(0xffffff, 1.5);
      const key = new THREE.DirectionalLight(0xfff7ed, 3.2);
      key.position.set(3, 4, 3);
      const fill = new THREE.DirectionalLight(0xf1f5f9, 1.8);
      fill.position.set(-3, 2, 2);
      lights.add(amb, key, fill);
    } else if (lightingMode === "cinematic") {
      const amb = new THREE.AmbientLight(0x050508, 0.6);
      const spot = new THREE.SpotLight(0xffb703, 4.5, 10, Math.PI / 4, 0.4);
      spot.position.set(1.5, 4.0, 2.5);
      const blueRim = new THREE.DirectionalLight(0x3a86ff, 2.5);
      blueRim.position.set(-2, 1.5, -3);
      lights.add(amb, spot, blueRim);
    }
  }, [lightingMode]);

  // ---------------------------------------------------------------------------
  // INTERACTIVE GESTURE CONTROLS (ORBITAL DRAGGING & ZOOMING)
  // ---------------------------------------------------------------------------
  const handleMouseDown = (e: React.MouseEvent) => {
    isDraggingRef.current = true;
    previousMousePosition.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current || !avatarGroupRef.current) return;

    const deltaX = e.clientX - previousMousePosition.current.x;
    const deltaY = e.clientY - previousMousePosition.current.y;

    avatarGroupRef.current.rotation.y += deltaX * 0.01;
    avatarGroupRef.current.rotation.x = Math.max(
      -0.3,
      Math.min(0.4, avatarGroupRef.current.rotation.x + deltaY * 0.006)
    );

    previousMousePosition.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (!cameraRef.current) return;
    const delta = e.deltaY * 0.002;
    const nextZ = Math.max(2.0, Math.min(5.5, cameraRef.current.position.z + delta));
    cameraRef.current.position.z = nextZ;
    setCameraZoom(nextZ);
  };

  // Reset 3D Camera Angles
  const handleResetCamera = () => {
    if (!avatarGroupRef.current || !cameraRef.current) return;
    avatarGroupRef.current.rotation.set(0, 0, 0);
    cameraRef.current.position.set(0, 1.2, 3.8);
    setCameraZoom(3.8);
    triggerToast("3D Avatar viewpoint centered (Reset to Default)");
  };

  // ---------------------------------------------------------------------------
  // PANEL 1 ACTIONS: INGESTION, BACKGROUND REMOVAL, EQUIP
  // ---------------------------------------------------------------------------
  const handleExecuteBackgroundRemoval = () => {
    setIsSegmenting(true);
    setSegmentationProgress(15);
    triggerToast("Executing PyTorch BiRefNet / SAM-2 Edge Segmentation…");

    const timer = setInterval(() => {
      setSegmentationProgress((p) => {
        if (p >= 85) {
          clearInterval(timer);
          setTimeout(() => {
            setIsSegmenting(false);
            setSegmentationProgress(100);
            triggerToast("Background Stripped: Isolated garment silhouette to alpha transparency!");
          }, 400);
          return 95;
        }
        return p + 25;
      });
    }, 280);
  };

  const handleCrawlUrl = () => {
    if (!crawledUrl.trim()) {
      triggerToast("Enter an apparel product URL from ASOS, SSENSE, or Zara.");
      return;
    }
    setIsCrawlingUrl(true);
    triggerToast(`Crawling garment metadata node: ${crawledUrl.trim()}…`);

    setTimeout(() => {
      const newItem: GarmentItem = {
        id: `crawled-${Date.now()}`,
        name: "Imported Asymmetrical Drape Top",
        category: "tops",
        colorName: "Pitch Obsidian",
        hexColor: "#080612",
        material: "Bonded Neoprene Poly",
        weatherTag: "rainproof",
        isEquipped: true,
        drapeWeight: 0.6,
        contrastTag: "Avant-Garde Drape",
      };
      setInventory((prev) => [newItem, ...prev]);
      setIsCrawlingUrl(false);
      setCrawledUrl("");
      triggerToast("URL Crawl Complete: Garment digitized and equipped on avatar!");
    }, 1100);
  };

  const handleToggleEquip = (itemId: string) => {
    setInventory((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, isEquipped: !item.isEquipped } : item))
    );
  };

  // ---------------------------------------------------------------------------
  // PANEL 2 ACTIONS: COLOR PALETTE MATCHING & SNAPSHOT
  // ---------------------------------------------------------------------------
  const handleMatchColorPalette = () => {
    const nextIdx = (activeSwatchIndex + 1) % BRAND_PALETTE.length;
    setActiveSwatchIndex(nextIdx);
    const chosenColor = BRAND_PALETTE[nextIdx];

    setInventory((prev) =>
      prev.map((item) =>
        item.isEquipped ? { ...item, hexColor: chosenColor.hex, colorName: chosenColor.name } : item
      )
    );

    triggerToast(`Remapped Garment Palette ➔ ${chosenColor.name} (${chosenColor.hex})`);
  };

  const handlePushLayerToActiveCanvas = () => {
    const asset = mediaVault.push({
      type: "image",
      name: `OmniStyle_3D_Look_${new Date().toLocaleTimeString().replace(/:/g, "_")}.png`,
      url: "/neon_rain_thumb.jpg",
      meta: {
        source: "OmniStyle 3D Avatar Viewport",
        lighting: lightingMode,
        garmentsEquipped: equippedGarments.map((g) => g.name).join(", "),
        colorTone: BRAND_PALETTE[activeSwatchIndex].name,
      },
    });

    triggerToast(`Snapshot saved! Pushed layer to Active Canvas Board & Media Vault.`);
  };

  // ---------------------------------------------------------------------------
  // PANEL 3 ACTIONS: TRI-AGENT COUNCIL ADVISORY
  // ---------------------------------------------------------------------------
  const handleConsultTriAgentCouncil = () => {
    setIsConsultingCouncil(true);
    triggerToast("Consulting Tri-Agent Council (Strategist, Empath, Ghost)…");

    setTimeout(() => {
      setTriAgentLog({
        strategist: `Heavy precipitation detected (${weatherData.precipitation}). GORE-TEX outer shell provides 100% moisture deflection. Silhouette proportions balanced 60/40.`,
        empath: `Obsidian veil reflects heartbreak and loss armor. The ${BRAND_PALETTE[activeSwatchIndex].name} accent signals defiance in the dark matrix.`,
        ghost: `Thermal dissipation mapping confirms zero heat signature leakage. Ready for high-speed megacity transit and warehouse acoustics.`,
      });
      setIsConsultingCouncil(false);
      triggerToast("Tri-Agent Council recommendations generated!");
    }, 900);
  };

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-[#000000] text-slate-100 font-sans selection:bg-[#00ffa3]/30 selection:text-[#00ffa3]">
      {/* ========================================================
          GLOBAL WORKSTATION TOP NAVIGATION BAR
      ======================================================== */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-[#2e2055] bg-[#0c0919] px-4 z-30">
        {/* Brand & Studio Identification */}
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#00ffa3]/40 bg-[#120d24] shadow-[0_0_15px_rgba(0,255,163,0.25)]">
            <Shirt className="h-5 w-5 text-[#00ffa3]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-black tracking-wider text-[#00ffa3] uppercase">
                OmniAI - Nexus
              </span>
              <span className="rounded-full border border-[#00ffa3]/30 bg-[#00ffa3]/10 px-2 py-0.5 text-[9px] font-mono text-[#00ffa3] font-bold">
                OMNISTYLE PRO 3D
              </span>
            </div>
            <p className="text-[10px] text-slate-400 tracking-wide">
              Dark Misfit Studios · Widescreen 3D WebGL Apparel Simulation Environment
            </p>
          </div>
        </div>

        {/* Center Actions */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={handlePushLayerToActiveCanvas}
            className="flex items-center gap-2 rounded-xl border border-[#00ffa3] bg-[#00ffa3] px-3.5 py-1.5 font-mono text-xs font-black text-black hover:bg-[#39ffb4] transition shadow-[0_0_18px_rgba(0,255,163,0.35)]"
          >
            <Zap className="h-4 w-4 fill-black" />
            <span>Push 3D Look to Active Canvas</span>
          </button>

          <Link
            href="/studio/assets"
            className="flex items-center gap-1.5 rounded-lg border border-[#2e2055] bg-[#120d24] px-3 py-1.5 text-xs font-semibold text-slate-300 hover:border-[#00ffa3]/50 hover:text-[#00ffa3] transition"
          >
            <FolderDown className="h-3.5 w-3.5 text-[#00ffa3]" />
            <span className="hidden sm:inline">Media Vault</span>
          </Link>
        </div>

        {/* Right Status Indicator & Assistant Toggle */}
        <div className="flex items-center gap-3">
          <StudioToggleMatrix studioName="OmniStyle Studio" />
          <div className="hidden md:flex items-center gap-2 font-mono text-[10px] text-slate-400">
            <span className="h-2 w-2 rounded-full bg-[#00ffa3] animate-pulse" />
            <span className="text-[#00ffa3] font-bold">PYTORCH EDGE ACTIVE</span>
            <span>{"//"}</span>
            <span>3D WEBGL ENGINE</span>
          </div>
        </div>
      </header>

      {/* ========================================================
          THREE-PANEL DASHBOARD SPLIT WORKSPACE LAYOUT
      ======================================================== */}
      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-[#2e2055]">
        {/* ========================================================
            PANEL 1: WARDROBE DIGITIZATION & INVENTORY CRAWL (LEFT - 25% WIDTH)
        ======================================================== */}
        <aside className="col-span-12 lg:col-span-3 flex min-h-0 flex-col overflow-y-auto bg-[#0a0714] p-3.5 space-y-3.5 custom-scrollbar">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[#2e2055] pb-2.5">
            <div>
              <p className="font-mono text-[9px] uppercase tracking-[0.25em] text-[#00ffa3] font-bold">
                PANEL 01 // WARDROBE INTAKE
              </p>
              <h2 className="text-sm font-bold text-white tracking-wide">
                Digitization &amp; Catalog Crawl
              </h2>
            </div>
            <span className="rounded bg-[#1a1236] px-2 py-0.5 font-mono text-[9px] text-[#00ffa3] border border-[#2e2055]">
              {equippedGarments.length} EQUIPPED
            </span>
          </div>

          {/* 1. Multi-Source Image Intake Dropzone */}
          <div className="rounded-xl border border-[#2e2055] bg-[#120d24] p-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="font-mono text-[10px] uppercase tracking-wider text-slate-300 font-semibold flex items-center gap-1.5">
                <Upload className="h-3 w-3 text-[#00ffa3]" />
                Multi-Source Intake Uploader
              </label>
              <span className="text-[9px] font-mono text-slate-400">Garments / Receipts</span>
            </div>

            {/* Drop Zone Box */}
            <div className="rounded-xl border border-dashed border-[#2e2055] bg-[#0c0919] p-3 text-center transition hover:border-[#00ffa3]/50">
              <Upload className="mx-auto h-5 w-5 text-[#00ffa3]" />
              <p className="mt-1 text-xs font-bold text-white">
                {uploadedFileName || "Drop Garment Photo or Receipts"}
              </p>
              <p className="text-[9px] font-mono text-slate-400">
                Supports PNG, JPG, WEBP · Auto-scales to 3D avatar bounds
              </p>
            </div>

            {/* Web URL Crawler Input */}
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={crawledUrl}
                onChange={(e) => setCrawledUrl(e.target.value)}
                placeholder="Paste URL (ASOS, SSENSE, Zara)..."
                className="w-full rounded-lg border border-[#2e2055] bg-[#16112c] p-1.5 font-mono text-[11px] text-slate-200 outline-none focus:border-[#00ffa3]/60"
              />
              <button
                onClick={handleCrawlUrl}
                disabled={isCrawlingUrl}
                className="rounded-lg border border-[#2e2055] bg-[#1d1538] px-2.5 py-1.5 font-mono text-[10px] font-bold text-[#00ffa3] hover:bg-[#00ffa3]/20 transition disabled:opacity-50"
              >
                {isCrawlingUrl ? "…" : "CRAWL"}
              </button>
            </div>
          </div>

          {/* 2. Edge-ML Automated Processing Node */}
          <div className="rounded-xl border border-[#2e2055] bg-[#120d24] p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[9px] uppercase tracking-wider text-[#00ffa3] font-bold flex items-center gap-1.5">
                <Scissors className="h-3 w-3 text-[#00ffa3]" />
                Edge-ML Automated Node
              </span>
              <span className="text-[8px] font-mono text-slate-400">PYTORCH BiRefNet</span>
            </div>

            {/* [Execute Instant Background Removal] Button */}
            <button
              onClick={handleExecuteBackgroundRemoval}
              disabled={isSegmenting}
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-[#00ffa3]/50 bg-[#00ffa3]/15 py-2.5 font-mono text-xs font-bold text-[#00ffa3] hover:bg-[#00ffa3]/25 transition shadow-[0_0_15px_rgba(0,255,163,0.18)] disabled:opacity-50"
            >
              <Scissors className={`h-3.5 w-3.5 ${isSegmenting ? "animate-spin" : ""}`} />
              <span>{isSegmenting ? `Segmenting Silhouette (${segmentationProgress}%)…` : "Execute Instant Background Removal"}</span>
            </button>

            {isSegmenting && (
              <div className="space-y-1">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-900 border border-[#2e2055]">
                  <div
                    className="h-full bg-[#00ffa3] transition-all duration-200 shadow-[0_0_8px_#00ffa3]"
                    style={{ width: `${segmentationProgress}%` }}
                  />
                </div>
                <div className="flex justify-between text-[8px] font-mono text-slate-400">
                  <span>Isolating alpha silhouette</span>
                  <span className="text-[#00ffa3]">{segmentationProgress}%</span>
                </div>
              </div>
            )}
          </div>

          {/* 3. Active Catalog Grid & Tab Filters */}
          <div className="flex-1 flex flex-col min-h-0 space-y-2">
            <span className="font-mono text-[9px] uppercase tracking-wider text-slate-300 font-semibold block">
              Active Wardrobe Catalog Inventory
            </span>

            {/* Horizontal Tab Filters */}
            <div className="flex flex-wrap gap-1 border-b border-[#2e2055] pb-2 font-mono text-[9px]">
              {(["all", "tops", "bottoms", "outerwear", "footwear", "accessories"] as const).map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`rounded-md px-2 py-1 uppercase font-semibold transition ${
                    activeCategory === cat
                      ? "bg-[#00ffa3] text-black font-bold"
                      : "bg-[#16112c] text-slate-400 hover:text-white"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Scrollable Layout-Guarded Thumbnail Inventory Deck */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
              {filteredInventory.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleToggleEquip(item.id)}
                  className={`cursor-pointer rounded-xl border p-2.5 transition flex items-center justify-between ${
                    item.isEquipped
                      ? "border-[#00ffa3] bg-[#181130] shadow-[0_0_15px_rgba(0,255,163,0.15)]"
                      : "border-[#2e2055] bg-[#120d24] hover:border-[#00ffa3]/40"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {/* Swatch Pill */}
                    <div
                      className="h-8 w-8 rounded-lg border border-[#2e2055] shrink-0 shadow-inner flex items-center justify-center"
                      style={{ backgroundColor: item.hexColor }}
                    >
                      <Shirt className="h-4 w-4 text-white/50" />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-white truncate max-w-[150px]">
                          {item.name}
                        </span>
                      </div>
                      <p className="text-[9px] font-mono text-slate-400 truncate">
                        {item.material} · {item.colorName}
                      </p>
                    </div>
                  </div>

                  {/* Outfitting Checkbox */}
                  <div
                    className={`h-5 w-5 rounded-md border flex items-center justify-center shrink-0 transition ${
                      item.isEquipped
                        ? "border-[#00ffa3] bg-[#00ffa3] text-black"
                        : "border-[#2e2055] bg-black/40 text-transparent"
                    }`}
                  >
                    <Check className="h-3.5 w-3.5 stroke-[3]" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* ========================================================
            PANEL 2: THE WEBGL APPAREL SIMULATION CANVAS (CENTER - 50% WIDTH)
        ======================================================== */}
        <main className="col-span-12 lg:col-span-6 flex min-h-0 flex-col overflow-hidden bg-[#000000] p-3.5 relative">
          {/* Floating Micro-Edit Toolbed (Horizontal toolbar directly at the top of viewport) */}
          <div className="absolute top-6 left-6 right-6 z-20 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#2e2055] bg-[#0e0a1c]/90 px-3 py-2 backdrop-blur-md shadow-2xl">
            {/* Action 1: [Cycle Environmental Lighting] */}
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-[9px] uppercase tracking-wider text-slate-400 mr-1">
                LIGHTING:
              </span>
              {(["cyberpunk", "studio", "cinematic"] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => {
                    setLightingMode(mode);
                    triggerToast(`Lighting Rig: ${mode.toUpperCase()} Environment`);
                  }}
                  className={`rounded-lg border px-2.5 py-1 font-mono text-[9px] font-bold uppercase transition ${
                    lightingMode === mode
                      ? "border-[#00ffa3] bg-[#00ffa3] text-black shadow-[0_0_10px_#00ffa3]"
                      : "border-[#2e2055] bg-[#16112c] text-slate-300 hover:text-white"
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>

            {/* Action 2: [Match Color Palette Swatch] */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleMatchColorPalette}
                className="flex items-center gap-1.5 rounded-lg border border-[#2e2055] bg-[#16112c] px-2.5 py-1 font-mono text-[9px] font-bold text-slate-200 hover:border-[#00ffa3]/50 hover:text-[#00ffa3] transition"
                title="Remaps equipped garment colors to match locked brand swatch tokens"
              >
                <Palette className="h-3 w-3 text-[#00ffa3]" />
                <span>Match Color Palette Swatch</span>
              </button>

              {/* Swatch dots */}
              <div className="flex items-center gap-1">
                {BRAND_PALETTE.map((swatch, idx) => (
                  <span
                    key={swatch.hex}
                    className={`h-3 w-3 rounded-full border transition ${
                      activeSwatchIndex === idx ? "border-[#00ffa3] scale-125" : "border-transparent"
                    }`}
                    style={{ backgroundColor: swatch.hex }}
                    title={swatch.name}
                  />
                ))}
              </div>
            </div>

            {/* Action 3: Viewport Tools */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setIsTurntableActive(!isTurntableActive)}
                className={`rounded-lg border px-2 py-1 font-mono text-[9px] font-semibold transition ${
                  isTurntableActive
                    ? "border-[#00ffa3]/40 bg-[#00ffa3]/15 text-[#00ffa3]"
                    : "border-[#2e2055] bg-[#16112c] text-slate-400"
                }`}
                title="Toggle 360 Turntable Auto-Rotation"
              >
                TURNTABLE: {isTurntableActive ? "ON" : "OFF"}
              </button>

              <button
                onClick={handleResetCamera}
                className="rounded-lg border border-[#2e2055] bg-[#16112c] p-1 text-slate-300 hover:text-white"
                title="Reset Camera Coordinates"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* 3D Digital Avatar Try-On Viewport (WebGL Canvas Frame) */}
          <div
            ref={mountRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onWheel={handleWheel}
            className="flex-1 w-full rounded-2xl border border-[#2e2055] bg-[#000000] overflow-hidden relative cursor-grab active:cursor-grabbing select-none"
          >
            {/* Gesture Helper HUD Overlay */}
            <div className="pointer-events-none absolute bottom-4 left-4 z-20 flex items-center gap-2 rounded-lg bg-black/75 px-3 py-1.5 font-mono text-[9px] text-slate-400 border border-[#2e2055]">
              <Compass className="h-3.5 w-3.5 text-[#00ffa3]" />
              <span>ORBITAL DRAG: Rotate Yaw/Pitch // SCROLL: Zoom Fabric Draping</span>
            </div>

            {/* Equipped Items Counter Watermark */}
            <div className="pointer-events-none absolute bottom-4 right-4 z-20 rounded-lg bg-black/75 px-3 py-1.5 font-mono text-[9px] text-[#00ffa3] border border-[#2e2055]">
              DRAPED: {equippedGarments.length} ACTIVE LAYERS
            </div>
          </div>
        </main>

        {/* ========================================================
            PANEL 3: STYLE PROFILE & REAL-TIME ANALYTICS (RIGHT - 25% WIDTH)
        ======================================================== */}
        <aside className="col-span-12 lg:col-span-3 flex min-h-0 flex-col overflow-y-auto bg-[#0a0714] p-3.5 space-y-3.5 custom-scrollbar">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[#2e2055] pb-2.5">
            <div>
              <p className="font-mono text-[9px] uppercase tracking-[0.25em] text-[#00ffa3] font-bold">
                PANEL 03 // STYLE ANALYTICS
              </p>
              <h2 className="text-sm font-bold text-white tracking-wide">
                Seasonal Matrix &amp; Environment
              </h2>
            </div>
            <span className="rounded bg-[#1a1236] px-2 py-0.5 font-mono text-[9px] text-[#00ffa3] border border-[#2e2055]">
              AI COUNCIL
            </span>
          </div>

          {/* 1. Seasonal Color Matrix */}
          <div className="rounded-xl border border-[#2e2055] bg-[#120d24] p-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-wider text-slate-300 font-bold flex items-center gap-1.5">
                <Palette className="h-3 w-3 text-[#00ffa3]" />
                Seasonal Color Matrix
              </span>
              <span className="font-mono text-[9px] text-[#00ffa3]">
                CONTRAST: {contrastRatio}%
              </span>
            </div>

            {/* Skin Undertone Selector */}
            <div>
              <label className="text-[9px] font-mono uppercase tracking-wider text-slate-400 block mb-1">
                Biometric Skin Undertone
              </label>
              <div className="grid grid-cols-3 gap-1.5 font-mono text-[9px]">
                {(["cool_olive", "obsidian_fair", "warm_bronze"] as const).map((tone) => (
                  <button
                    key={tone}
                    onClick={() => setSkinUndertone(tone)}
                    className={`rounded-lg border p-1 text-center truncate ${
                      skinUndertone === tone
                        ? "border-[#00ffa3] bg-[#00ffa3]/20 text-[#00ffa3] font-bold"
                        : "border-[#2e2055] bg-[#16112c] text-slate-400"
                    }`}
                  >
                    {tone.replace("_", " ")}
                  </button>
                ))}
              </div>
            </div>

            {/* Floating Attribute Tags Mapping Clashing vs. Complementary Shades */}
            <div className="space-y-1.5 pt-1">
              <span className="text-[8px] font-mono uppercase text-slate-400 block">
                Harmonic Color Analysis:
              </span>
              <div className="flex flex-wrap gap-1">
                <span className="rounded bg-[#00ffa3]/15 px-2 py-0.5 font-mono text-[8px] font-bold text-[#00ffa3] border border-[#00ffa3]/30">
                  COMPLEMENTARY: Obsidian Void + Light Neon
                </span>
                <span className="rounded bg-purple-500/15 px-2 py-0.5 font-mono text-[8px] font-bold text-purple-300 border border-purple-500/30">
                  CONTRAST: Deep Misfit Purple + Platinum Silver
                </span>
                <span className="rounded bg-rose-500/15 px-2 py-0.5 font-mono text-[8px] font-bold text-rose-300 border border-rose-500/30">
                  CLASH HAZARD: Muddy Khaki / Desaturated Lime
                </span>
              </div>
            </div>
          </div>

          {/* 2. Real-Time Contextual Recommendations (Tri-Agent Council) */}
          <div className="rounded-xl border border-[#2e2055] bg-[#120d24] p-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-wider text-slate-300 font-bold flex items-center gap-1.5">
                <Sparkles className="h-3 w-3 text-[#00ffa3]" />
                Tri-Agent Contextual Council
              </span>
              <button
                onClick={handleConsultTriAgentCouncil}
                disabled={isConsultingCouncil}
                className="font-mono text-[9px] text-[#00ffa3] hover:underline"
              >
                {isConsultingCouncil ? "Evaluating…" : "Refresh"}
              </button>
            </div>

            {/* Schedule Item Input */}
            <div className="rounded-lg border border-[#1f1638] bg-[#0a071b] p-2 text-[10px] font-mono text-slate-300">
              <span className="text-slate-500 block text-[8px] uppercase font-mono">Upcoming Schedule Node:</span>
              <span className="text-[#00ffcc] font-bold">{recommendationSchedule}</span>
            </div>

            {/* Tri-Agent Council 3 Voice Blocks (All Strings in Vibrant Neon Green #00ffcc) */}
            <div className="space-y-2 font-mono text-[9px] leading-relaxed">
              {/* Strategist */}
              <div className="rounded-lg border border-[#1f1638] bg-[#0a071b] p-2.5 space-y-1">
                <span className="font-extrabold text-[#00ffcc] uppercase block tracking-wider drop-shadow-[0_0_8px_rgba(0,255,204,0.4)]">
                  [1. THE STRATEGIST] // STRUCTURAL &amp; FABRIC PERFORMANCE
                </span>
                <p className="text-slate-200">{triAgentLog.strategist}</p>
              </div>

              {/* Empath */}
              <div className="rounded-lg border border-[#1f1638] bg-[#0a071b] p-2.5 space-y-1">
                <span className="font-extrabold text-[#00ffcc] uppercase block tracking-wider drop-shadow-[0_0_8px_rgba(0,255,204,0.4)]">
                  [2. THE EMPATH] // HEARTBREAK &amp; EMOTIONAL RESONANCE
                </span>
                <p className="text-slate-200">{triAgentLog.empath}</p>
              </div>

              {/* Ghost */}
              <div className="rounded-lg border border-[#1f1638] bg-[#0a071b] p-2.5 space-y-1">
                <span className="font-extrabold text-[#00ffcc] uppercase block tracking-wider drop-shadow-[0_0_8px_rgba(0,255,204,0.4)]">
                  [3. THE GHOST] // CYBERPUNK AVANT-GARDE EDGE
                </span>
                <p className="text-slate-200">{triAgentLog.ghost}</p>
              </div>
            </div>
          </div>

          {/* 3. Live Environment Sync Line */}
          <div className="rounded-xl border border-[#1f1638] bg-[#0a071b] p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-wider text-white font-bold flex items-center gap-1.5">
                <CloudRain className="h-3 w-3 text-[#00ffcc]" />
                Live Environment Weather Sync
              </span>
              <span className="font-mono text-[8px] text-[#00ffcc] bg-[#00ffcc]/10 px-1.5 py-0.5 rounded border border-[#00ffcc]/30 font-bold">
                ACTIVE SYNC
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 font-mono text-[9px]">
              <div className="rounded-lg bg-[#000000] p-2 border border-[#1f1638]">
                <span className="text-slate-500 block text-[8px]">FELT TEMPERATURE</span>
                <span className="text-white font-bold">{weatherData.temperature}</span>
              </div>
              <div className="rounded-lg bg-[#000000] p-2 border border-[#1f1638]">
                <span className="text-slate-500 block text-[8px]">HUMIDITY</span>
                <span className="text-white font-bold">{weatherData.humidity}</span>
              </div>
              <div className="rounded-lg bg-[#000000] p-2 border border-[#1f1638]">
                <span className="text-slate-500 block text-[8px]">PRECIPITATION</span>
                <span className="text-[#00ffcc] font-bold">{weatherData.precipitation}</span>
              </div>
              <div className="rounded-lg bg-[#000000] p-2 border border-[#1f1638]">
                <span className="text-slate-500 block text-[8px]">ATMOSPHERE</span>
                <span className="text-slate-300 font-bold truncate">{weatherData.condition}</span>
              </div>
            </div>

            <p className="font-mono text-[8px] text-slate-400">
              Outfit Filter Auto-Applied: Outerwear forced to GORE-TEX water resistance &gt; 20,000mm.
            </p>
          </div>
        </aside>
      </div>

      {/* ========================================================
          TELEMETRY LINE TRACKER (ABSOLUTE BOTTOM MARGIN)
      ======================================================== */}
      <footer className="h-7 shrink-0 flex items-center justify-between border-t border-[#1f1638] bg-[#000000] px-4 font-mono text-[9px] text-slate-400 select-none z-30">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-[#00ffcc] shadow-[0_0_6px_#00ffcc]" />
          <span className="font-black text-[#00ffcc]">
            [Nexus-Inference: Max-Speed / Local-Ollama Override]
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="hidden sm:inline">AVATAR: MANNEQUIN-V4</span>
          <span className="hidden md:inline">FABRIC PHYSICS: RUNNING</span>
          <span className="text-[#00ffcc]">LAYERS: {equippedGarments.length}</span>
          <span className="text-white font-bold">FPS: 60</span>
        </div>
      </footer>

      {/* Floating Toast Notice */}
      {toastMessage && (
        <div className="fixed bottom-10 left-1/2 z-50 -translate-x-1/2 flex items-center gap-2 rounded-xl border border-[#00ffa3]/60 bg-[#120d24] px-4 py-2 text-xs font-mono text-[#00ffa3] shadow-[0_0_30px_rgba(0,255,163,0.3)] animate-in fade-in slide-in-from-bottom-2">
          <Sparkles className="h-3.5 w-3.5 animate-pulse" />
          <span>{toastMessage}</span>
          <button
            onClick={() => setToastMessage("")}
            className="ml-2 text-slate-400 hover:text-white"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
