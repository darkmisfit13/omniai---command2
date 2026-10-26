"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import * as THREE from "three";
import { useOrbEngine, type OrbEngineState, orbEngineStore } from "@/lib/orbEngineStore";

/* =========================================================================
   DARK MISFIT STUDIOS — OMNIAI - NEXUS: HIGH-FIDELITY WEBGL SHADER ORB
   Principal WebGL Shading & State Architecture
   
   Brand Palette Integration:
     - Pure Black Background Canvas: #000000
     - Dark Bluish Purple Core: vec3(0.05, 0.04, 0.11) -> vec3(0.12, 0.08, 0.25)
     - Shimmering Particle Vectors: Very Light Neon Bluish Green (#00ffa3, #39ffb4)
     - Subtle White Highlights: vec3(0.95, 1.0, 0.98)
========================================================================= */

// -----------------------------------------------------------------------------
// 3D SIMPLEX NOISE SHADER EXTENSION
// -----------------------------------------------------------------------------
const SIMPLEX_3D = `
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}
`;

// -----------------------------------------------------------------------------
// CORE SHADER VERTEX (Displacement by State: Idle wave, Thinking lattice, Talking pulse)
// -----------------------------------------------------------------------------
const ORB_VERTEX_SHADER = `
${SIMPLEX_3D}

uniform float uTime;
uniform float uState; // 0.0: idle, 1.0: thinking, 2.0: talking
uniform float uAudioIntensity;
uniform float uTurbulence;
uniform vec2 uPointer;

varying vec3 vNormal;
varying vec3 vPosition;
varying vec3 vLocalPos;
varying float vNoise;
varying float vWaveFactor;

void main() {
  vLocalPos = position;
  vec3 norm = normalize(normal);
  vNormal = normalize(normalMatrix * normal);

  // Dynamic displacement calculation based on active state:
  float disp = 0.0;
  float t = uTime;

  if (uState < 0.5) {
    // [IDLE STATE]: Slow harmonic breathing circular wave (0.8Hz)
    float breath = sin(t * 1.5) * 0.04;
    float wave = snoise(position * 2.4 + vec3(t * 0.4, -t * 0.2, t * 0.1)) * 0.06;
    disp = breath + wave;
    vNoise = wave;
    vWaveFactor = breath;
  } else if (uState < 1.5) {
    // [THINKING STATE]: Ultra-high-speed geometric frequency loop (LPU Latency-Mock)
    float speed = t * 6.5;
    float lattice = sin(position.x * 12.0 + speed) * sin(position.y * 12.0 - speed) * sin(position.z * 12.0 + speed) * 0.07;
    float jitter = snoise(position * 7.5 + vec3(speed * 1.2, speed * 0.8, -speed)) * 0.08;
    disp = lattice + jitter;
    vNoise = jitter;
    vWaveFactor = lattice;
  } else {
    // [TALKING BACK STATE]: Kinetic audio waveform frequency matrix
    float audioRipples = sin(position.y * 18.0 - t * 8.0) * (uAudioIntensity * 0.16 + 0.04);
    float pulse = snoise(position * 3.5 + vec3(0.0, t * 2.5, t * 1.0)) * (uAudioIntensity * 0.12 + 0.05);
    disp = audioRipples + pulse;
    vNoise = pulse;
    vWaveFactor = audioRipples;
  }

  vec3 newPosition = position + norm * disp * (1.0 + uTurbulence * 0.5);
  vPosition = newPosition;

  vec4 mvPosition = modelViewMatrix * vec4(newPosition, 1.0);
  gl_Position = projectionMatrix * mvPosition;
}
`;

// -----------------------------------------------------------------------------
// CORE SHADER FRAGMENT (Pure White Anchor + Light Blue / Ruby Red Matrix)
// -----------------------------------------------------------------------------
const ORB_FRAGMENT_SHADER = `
${SIMPLEX_3D}

uniform float uTime;
uniform float uState; // 0.0: idle, 1.0: thinking/council, 2.0: talking
uniform float uAudioIntensity;
uniform vec2 uPointer;

varying vec3 vNormal;
varying vec3 vPosition;
varying vec3 vLocalPos;
varying float vNoise;
varying float vWaveFactor;

void main() {
  vec3 viewDir = normalize(-vPosition);
  float fresnel = pow(1.0 - max(dot(vNormal, viewDir), 0.0), 2.4);

  // Authentic Hexadecimal Signatures:
  // Pure White (#FFFFFF): Core Anchor Color
  vec3 pureWhite = vec3(1.0, 1.0, 1.0);
  // Light Blue (#00D2FF): Particle Aura & Kinetic Shimmer
  vec3 lightBlue = vec3(0.0, 0.824, 1.0);
  // Ice-Sparkle (#D8F4FF): Translucent Ice Highlight
  vec3 iceSparkle = vec3(0.847, 0.957, 1.0);
  // Ruby Red (#FF003C): Dynamic Intense Processing / Thinking & Council Mode
  vec3 rubyRed = vec3(1.0, 0.0, 0.235);
  // Deep Crimson & Hot Red Burst
  vec3 crimsonGlow = vec3(1.0, 0.12, 0.32);

  vec3 baseColor;
  float alpha;

  if (uState < 0.5) {
    // -----------------------------------------------------------------
    // [IDLE STATE]: Crisp Pure White (#FFFFFF) base container layer
    // with Light Blue (#00D2FF) & Ice-Sparkle ambient shimmer
    // -----------------------------------------------------------------
    float glow = smoothstep(-0.15, 0.35, vNoise);
    baseColor = pureWhite;
    // Layered outer aura shimmer with Light Blue & translucent Ice-Sparkle
    vec3 aura = mix(lightBlue, iceSparkle, 0.55);
    baseColor = mix(baseColor, aura, fresnel * 0.72 + glow * 0.15);
    baseColor = mix(baseColor, iceSparkle, pow(fresnel, 3.5) * 0.6);
    alpha = clamp(0.88 + fresnel * 0.12, 0.0, 1.0);
  } else if (uState < 1.5) {
    // -----------------------------------------------------------------
    // [DYNAMIC INTENSE PROCESSING SHIFT: THINKING & COUNCIL MODES]
    // Core Anchor Shift -> deep, energetic Ruby Red (#FF003C)
    // with high-speed flickering white-hot and crimson shimmer
    // -----------------------------------------------------------------
    float shimmer = abs(sin(vWaveFactor * 32.0 + uTime * 15.0));
    baseColor = rubyRed;
    // White-hot flash vectors and crimson aura
    baseColor = mix(baseColor, crimsonGlow, shimmer * 0.4);
    baseColor = mix(baseColor, pureWhite, pow(fresnel, 2.2) * 0.85 + shimmer * 0.35);
    alpha = clamp(0.92 + fresnel * 0.08, 0.0, 1.0);
  } else {
    // -----------------------------------------------------------------
    // [TALKING BACK STATE]: Pure White (#FFFFFF) core with dynamic
    // kinetic Light Blue (#00D2FF) audio acoustic frequency ripples
    // -----------------------------------------------------------------
    float band = smoothstep(0.0, 0.18, abs(vWaveFactor));
    baseColor = pureWhite;
    vec3 acousticWave = mix(lightBlue, iceSparkle, 0.45);
    baseColor = mix(baseColor, acousticWave, band * (0.6 + uAudioIntensity * 0.4));
    baseColor = mix(baseColor, lightBlue, fresnel * 0.75);
    baseColor = mix(baseColor, pureWhite, (fresnel * uAudioIntensity) * 0.8);
    alpha = clamp(0.86 + fresnel * 0.14, 0.0, 1.0);
  }

  gl_FragColor = vec4(baseColor, alpha);
}
`;

// -----------------------------------------------------------------------------
// PARTICLE SYSTEM VERTEX SHADER (Kinetic Swarm around Orb)
// -----------------------------------------------------------------------------
const PARTICLE_VERTEX_SHADER = `
${SIMPLEX_3D}

uniform float uTime;
uniform float uState;
uniform float uAudioIntensity;

attribute float aSize;
attribute vec3 aInitialPos;
attribute float aSeed;

varying float vSeed;
varying float vState;

void main() {
  vSeed = aSeed;
  vState = uState;

  vec3 pos = aInitialPos;
  float t = uTime;

  if (uState < 0.5) {
    // [IDLE]: Slow orbiting cloud of floating particle sparks
    float angle = t * 0.25 + aSeed * 6.28;
    float radius = length(pos.xz) + sin(t * 0.8 + aSeed * 10.0) * 0.08;
    pos.x = cos(angle) * radius;
    pos.z = sin(angle) * radius;
    pos.y += sin(t * 1.2 + aSeed * 5.0) * 0.12;
  } else if (uState < 1.5) {
    // [THINKING & COUNCIL]: Accelerated energetic orbital vortex
    float speed = t * (3.4 + aSeed * 2.5);
    float angle = speed + aSeed * 6.28;
    float r = length(pos.xz) * (0.8 + sin(speed * 3.5) * 0.18);
    pos.x = cos(angle) * r;
    pos.z = sin(angle) * r;
    pos.y += sin(speed * 2.2 + aSeed * 8.0) * 0.38;
  } else {
    // [TALKING]: Acoustic pressure waveform expansion
    float burst = 1.0 + (uAudioIntensity * 0.45) * sin(t * 10.0 + aSeed * 12.0);
    pos *= burst;
    pos.y += sin(t * 8.0 + aSeed * 4.0) * (uAudioIntensity * 0.2);
  }

  vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mvPosition;

  // Size attenuation with state dynamics
  float pointSize = aSize * (150.0 / -mvPosition.z);
  if (uState > 0.5 && uState < 1.5) {
    pointSize *= (1.3 + sin(t * 18.0 + aSeed * 10.0) * 0.45);
  } else if (uState >= 1.5) {
    pointSize *= (1.0 + uAudioIntensity * 0.8);
  }
  gl_PointSize = clamp(pointSize, 2.0, 48.0);
}
`;

// -----------------------------------------------------------------------------
// PARTICLE SYSTEM FRAGMENT SHADER (Light Blue/Ice-Sparkle vs Flickering Ruby Red/White)
// -----------------------------------------------------------------------------
const PARTICLE_FRAGMENT_SHADER = `
uniform float uTime;
uniform float uState;
varying float vSeed;
varying float vState;

void main() {
  // Circular soft particle disk
  vec2 coord = gl_PointCoord - vec2(0.5);
  float dist = length(coord);
  if (dist > 0.5) discard;

  float glow = smoothstep(0.5, 0.0, dist);
  float core = smoothstep(0.18, 0.0, dist);

  // Exact Hexadecimal Signatures:
  vec3 pureWhite = vec3(1.0, 1.0, 1.0);
  vec3 lightBlue = vec3(0.0, 0.824, 1.0);       // #00D2FF
  vec3 iceSparkle = vec3(0.847, 0.957, 1.0);    // #D8F4FF
  vec3 rubyRed = vec3(1.0, 0.0, 0.235);         // #FF003C
  vec3 crimsonSpark = vec3(1.0, 0.22, 0.4);

  vec3 color;
  float alpha;

  if (vState < 0.5 || vState >= 1.5) {
    // [IDLE & TALKING]: High-fidelity blend of Light Blue (#00D2FF) and translucent Ice-Sparkle
    float shimmerMix = fract(vSeed * 4.31 + uTime * 0.15);
    vec3 auraColor = mix(lightBlue, iceSparkle, shimmerMix);
    color = mix(auraColor, pureWhite, core * 0.75);
    alpha = glow * 0.92;
  } else {
    // [THINKING & COUNCIL MODES]: Active flickering Red (#FF003C) and White (#FFFFFF) sparkle vectors
    float flicker = fract(sin(vSeed * 78.233 + uTime * 28.0) * 43758.5453);
    vec3 redActive = mix(rubyRed, crimsonSpark, flicker * 0.5);
    color = mix(redActive, pureWhite, step(0.6, flicker) * 0.9 + core * 0.7);
    alpha = glow * (0.92 + flicker * 0.08);
  }

  gl_FragColor = vec4(color, alpha);
}
`;

// -----------------------------------------------------------------------------
// MAIN COMPONENT PROPS
// -----------------------------------------------------------------------------
export interface OmniChatOrbWebGLProps {
  size?: "compact" | "hero" | "custom";
  customWidth?: number;
  customHeight?: number;
  className?: string;
  forceState?: OrbEngineState;
  interactive?: boolean;
  onOrbClick?: () => void;
  showBadge?: boolean;
}

export default function OmniChatOrbWebGL({
  size = "hero",
  customWidth,
  customHeight,
  className = "",
  forceState,
  interactive = true,
  onOrbClick,
  showBadge = true,
}: OmniChatOrbWebGLProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const orbStore = useOrbEngine();
  const activeState: OrbEngineState = forceState ?? orbStore.state;

  // Refs for WebGL rendering objects
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const coreMeshRef = useRef<THREE.Mesh | null>(null);
  const coreUniformsRef = useRef<Record<string, { value: unknown }> | null>(null);
  const particleUniformsRef = useRef<Record<string, { value: unknown }> | null>(null);
  const groupRef = useRef<THREE.Group | null>(null);

  // Target pointer interaction
  const targetRotation = useRef({ x: 0, y: 0 });

  // Numerical mapping of active state: 0 = idle, 1 = thinking, 2 = talking
  const stateVal = useMemo(() => {
    switch (activeState) {
      case "idle":
        return 0.0;
      case "thinking":
        return 1.0;
      case "talking":
        return 2.0;
      default:
        return 0.0;
    }
  }, [activeState]);

  const orbStoreRef = useRef(orbStore);
  useEffect(() => {
    orbStoreRef.current = orbStore;
  }, [orbStore]);

  const stateValRef = useRef(stateVal);
  useEffect(() => {
    stateValRef.current = stateVal;
    if (coreUniformsRef.current) {
      coreUniformsRef.current.uState.value = stateVal;
    }
    if (particleUniformsRef.current) {
      particleUniformsRef.current.uState.value = stateVal;
    }
  }, [stateVal]);

  // Dimensions based on preset
  const isCompact = size === "compact";
  const widthPx = customWidth ?? (isCompact ? 48 : 360);
  const heightPx = customHeight ?? (isCompact ? 48 : 360);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // 1. Scene & Camera Setup
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(40, widthPx / heightPx, 0.1, 100);
    camera.position.z = isCompact ? 3.4 : 3.1;
    cameraRef.current = camera;

    // 2. High-performance WebGL Renderer with Alpha
    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });
    rendererRef.current = renderer;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(widthPx, heightPx);
    renderer.setClearColor(0x000000, isCompact ? 0 : 0.85);
    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    // 3. Central Orb Group
    const group = new THREE.Group();
    groupRef.current = group;
    scene.add(group);

    // Core Sphere Uniforms
    const coreUniforms = {
      uTime: { value: 0 },
      uState: { value: stateVal },
      uAudioIntensity: { value: 0.2 },
      uTurbulence: { value: isCompact ? 0.1 : 0.35 },
      uPointer: { value: new THREE.Vector2(0, 0) },
    };
    coreUniformsRef.current = coreUniforms;

    // Core Geometry & Shader Material
    const coreGeometry = isCompact
      ? new THREE.IcosahedronGeometry(0.85, 3)
      : new THREE.IcosahedronGeometry(0.9, 6);

    const coreMaterial = new THREE.ShaderMaterial({
      vertexShader: ORB_VERTEX_SHADER,
      fragmentShader: ORB_FRAGMENT_SHADER,
      uniforms: coreUniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });

    const coreMesh = new THREE.Mesh(coreGeometry, coreMaterial);
    coreMeshRef.current = coreMesh;
    group.add(coreMesh);

    // 4. Shimmering Particle Vectors (Cloud / Vortex / Acoustic Waves)
    const particleCount = isCompact ? 160 : 750;
    const particleGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const initialPositions = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);
    const seeds = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i++) {
      const idx = i * 3;
      // Spherical distribution around core
      const phi = Math.acos(2 * Math.random() - 1);
      const theta = Math.random() * Math.PI * 2;
      const r = 1.05 + Math.random() * (isCompact ? 0.35 : 0.65);

      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = r * Math.sin(phi) * Math.sin(theta);
      const z = r * Math.cos(phi);

      positions[idx] = x;
      positions[idx + 1] = y;
      positions[idx + 2] = z;

      initialPositions[idx] = x;
      initialPositions[idx + 1] = y;
      initialPositions[idx + 2] = z;

      sizes[i] = (0.02 + Math.random() * 0.045) * (isCompact ? 1.4 : 1.0);
      seeds[i] = Math.random();
    }

    particleGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    particleGeo.setAttribute("aInitialPos", new THREE.BufferAttribute(initialPositions, 3));
    particleGeo.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
    particleGeo.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));

    const particleUniforms = {
      uTime: { value: 0 },
      uState: { value: stateVal },
      uAudioIntensity: { value: 0.2 },
    };
    particleUniformsRef.current = particleUniforms;

    const particleMat = new THREE.ShaderMaterial({
      vertexShader: PARTICLE_VERTEX_SHADER,
      fragmentShader: PARTICLE_FRAGMENT_SHADER,
      uniforms: particleUniforms,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const particles = new THREE.Points(particleGeo, particleMat);
    group.add(particles);

    // 5. High-precision Animation Render Loop
    let animationId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animationId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      // Audio waveform modulation
      let audioAvg = 0.2;
      const currentStore = orbStoreRef.current;
      if (currentStore.state === "talking" && currentStore.audioFrequencies.length > 0) {
        audioAvg =
          currentStore.audioFrequencies.reduce((acc, v) => acc + v, 0) /
          currentStore.audioFrequencies.length;
      }

      // Update uniforms
      if (coreUniformsRef.current) {
        coreUniformsRef.current.uTime.value = elapsedTime;
        coreUniformsRef.current.uAudioIntensity.value = audioAvg;
      }
      if (particleUniformsRef.current) {
        particleUniformsRef.current.uTime.value = elapsedTime;
        particleUniformsRef.current.uAudioIntensity.value = audioAvg;
      }

      // Smooth pointer parallax tilt
      group.rotation.y += (targetRotation.current.y - group.rotation.y) * 0.06;
      group.rotation.x += (targetRotation.current.x - group.rotation.x) * 0.06;

      // Base auto rotation based on state
      const currentVal = stateValRef.current;
      const rotationSpeed =
        currentVal === 1.0 ? 0.035 : currentVal === 2.0 ? 0.018 : 0.007;
      group.rotation.y += rotationSpeed;

      renderer.render(scene, camera);
    };

    animate();

    // 6. Resize Observer
    const handleResize = () => {
      if (!container || !camera || !renderer) return;
      const w = container.clientWidth || widthPx;
      const h = container.clientHeight || heightPx;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", handleResize);
      renderer.dispose();
      coreGeometry.dispose();
      coreMaterial.dispose();
      particleGeo.dispose();
      particleMat.dispose();
      while (container.firstChild) {
        container.removeChild(container.firstChild);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [widthPx, heightPx, isCompact]);

  // Pointer Interaction Handler for Hero / Interactive Mode
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!interactive || isCompact) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
    const y = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
    targetRotation.current = {
      y: x * 0.65,
      x: -y * 0.5,
    };
  };

  const handlePointerLeave = () => {
    targetRotation.current = { x: 0, y: 0 };
  };

  return (
    <div
      className={`relative select-none flex flex-col items-center justify-center ${className}`}
      onClick={onOrbClick}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
    >
      {/* WebGL Canvas Container */}
      <div
        ref={mountRef}
        className={`relative cursor-pointer transition-transform duration-300 hover:scale-[1.02] ${
          isCompact
            ? activeState === "thinking"
              ? "h-12 w-12 rounded-xl overflow-hidden shadow-[0_0_22px_rgba(255,0,60,0.55)] border border-[#FF003C]"
              : "h-12 w-12 rounded-xl overflow-hidden shadow-[0_0_20px_rgba(0,210,255,0.4)] border border-[#00D2FF]/60"
            : activeState === "thinking"
            ? "h-[320px] sm:h-[360px] w-full max-w-[420px] rounded-3xl overflow-hidden border border-[#FF003C]/80 bg-gradient-to-b from-[#19050d] via-[#0c0919] to-[#000000] shadow-[0_0_60px_rgba(255,0,60,0.35)]"
            : "h-[320px] sm:h-[360px] w-full max-w-[420px] rounded-3xl overflow-hidden border border-[#00D2FF]/40 bg-gradient-to-b from-[#0e0a1c] to-[#000000] shadow-[0_0_50px_rgba(0,210,255,0.2)]"
        }`}
      />

      {/* Hero Mode HUD Overlay & Live Telemetry Details */}
      {!isCompact && showBadge && (
        <div className="mt-3.5 flex flex-wrap items-center justify-center gap-2 text-center">
          {/* Active State Pill */}
          <div
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-wider border transition-all ${
              activeState === "thinking"
                ? "border-[#FF003C] bg-[#FF003C]/20 text-[#FF003C] shadow-[0_0_15px_rgba(255,0,60,0.5)] animate-pulse"
                : activeState === "talking"
                ? "border-[#00D2FF] bg-[#00D2FF]/20 text-[#00D2FF] shadow-[0_0_15px_rgba(0,210,255,0.4)]"
                : "border-[#00D2FF]/30 bg-[#0e0a1c] text-slate-200"
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                activeState === "thinking"
                  ? "bg-[#FF003C] animate-ping"
                  : activeState === "talking"
                  ? "bg-[#00D2FF] animate-pulse"
                  : "bg-[#00D2FF]"
              }`}
            />
            {activeState === "idle" && "IDLE // READY"}
            {activeState === "thinking" && `THINKING // LPU ${orbStore.latencyMs.toFixed(1)}ms`}
            {activeState === "talking" && "TALKING BACK // SYNTHESIS"}
          </div>

          {/* LPU Mock & Ollama Node Status */}
          <span className="font-mono text-[10px] text-slate-400">
            [Ollama Node:{" "}
            <span className={activeState === "thinking" ? "text-[#FF003C]" : "text-[#00D2FF]"}>
              Active
            </span>{" "}
            · Latency: <span className="text-white">{orbStore.latencyMs.toFixed(1)}ms</span>]
          </span>
        </div>
      )}
    </div>
  );
}
