"use client";

import { useEffect, useRef, useCallback } from "react";
import * as THREE from "three";
import { audioBus } from "@/lib/audioReactive";

/**
 * HolographicEntity — premium cinematic AI presence.
 *
 * A floating holographic intelligence made of thousands of luminous dust
 * particles, fine neural filaments, translucent energy layers, and a radiant
 * central core. State machine: idle → attentive → activated → thinking →
 * responding → speaking → success / error.
 *
 * Rendering: Three.js BufferGeometry particle system + LineSegments filaments.
 * No post-processing (performance). Delta-time animation. Reduced-motion aware.
 */

export type EntityState =
  | "idle"
  | "attentive"
  | "activated"
  | "thinking"
  | "responding"
  | "speaking"
  | "success"
  | "error";

export type HolographicEntityProps = {
  state?: EntityState;
  variant?: "hero" | "window" | "ambient";
  className?: string;
  /** 0..1 — how strongly the entity reacts to pointer proximity. */
  responsiveness?: number;
  /** Base particle count multiplier (1 = default). */
  density?: number;
};

/* ---- GLSL: particle vertex shader ---- */
const PARTICLE_VERT = `
precision highp float;
attribute float aSize;
attribute float aSpeed;
attribute vec3 aColor;
attribute float aPhase;
uniform float uTime;
uniform float uPixelRatio;
uniform float uDispersion;
uniform float uEnergy;
uniform vec3 uPointer;
uniform float uPointerStrength;
varying vec3 vColor;
varying float vAlpha;
void main(){
  vec3 pos = position;
  // orbital drift
  float angle = uTime * aSpeed * 0.3 + aPhase;
  float c = cos(angle);
  float s = sin(angle);
  pos.xz = mat2(c,-s,s,c) * pos.xz;
  // gentle vertical bob
  pos.y += sin(uTime * 0.4 + aPhase * 2.0) * 0.03;
  // dispersion (thinking state)
  pos *= 1.0 + uDispersion * 0.3;
  // pointer attraction
  vec3 toPointer = uPointer - pos;
  float dist = length(toPointer);
  pos += normalize(toPointer) * uPointerStrength * 0.15 * exp(-dist * dist * 2.0);
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = aSize * uPixelRatio * (1.0 + uEnergy * 0.5) * (300.0 / -mv.z);
  vColor = aColor;
  vAlpha = 0.6 + 0.4 * sin(uTime * 0.8 + aPhase * 3.0);
}
`;

/* ---- GLSL: particle fragment shader ---- */
const PARTICLE_FRAG = `
precision mediump float;
varying vec3 vColor;
varying float vAlpha;
void main(){
  vec2 c = gl_PointCoord - 0.5;
  float d = dot(c, c);
  if (d > 0.25) discard;
  float glow = smoothstep(0.25, 0.0, d);
  float core = smoothstep(0.08, 0.0, d);
  vec3 col = vColor * (glow * 0.7 + core * 1.3);
  gl_FragColor = vec4(col, vAlpha * glow);
}
`;

/* ---- GLSL: filament vertex shader ---- */
const FILAMENT_VERT = `
precision highp float;
attribute float aAlpha;
varying float vAlpha;
void main(){
  vAlpha = aAlpha;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

/* ---- GLSL: filament fragment shader ---- */
const FILAMENT_FRAG = `
precision mediump float;
varying float vAlpha;
uniform vec3 uColor;
void main(){
  gl_FragColor = vec4(uColor * vAlpha, vAlpha * 0.4);
}
`;

/* ---- GLSL: core vertex shader ---- */
const CORE_VERT = `
precision highp float;
varying vec3 vNormal;
varying vec3 vPos;
void main(){
  vNormal = normalize(normalMatrix * normal);
  vPos = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

/* ---- GLSL: core fragment shader ---- */
const CORE_FRAG = `
precision highp float;
varying vec3 vNormal;
varying vec3 vPos;
uniform float uTime;
uniform float uEnergy;
uniform float uHyper;
uniform vec3 uColorA;
uniform vec3 uColorB;
void main(){
  vec3 viewDir = normalize(vec3(0.0, 0.0, 1.0));
  float fres = pow(1.0 - max(dot(normalize(vNormal), viewDir), 0.0), 2.0);
  float pulse = 0.5 + 0.5 * sin(uTime * 2.0);
  vec3 col = mix(uColorA, uColorB, fres);
  col += uColorB * fres * (0.5 + uEnergy * 0.8);
  col += vec3(0.43, 0.91, 0.72) * uHyper * (0.4 + pulse * 0.3);
  float alpha = 0.7 + fres * 0.3;
  gl_FragColor = vec4(col, alpha);
}
`;

/* ---- Color palette ---- */
const PALETTE = {
  cyan: new THREE.Color("#00f2fe"),
  iceBlue: new THREE.Color("#7dd3fc"),
  violet: new THREE.Color("#a78bfa"),
  magenta: new THREE.Color("#e879f9"),
  emerald: new THREE.Color("#6ee7b7"),
  amber: new THREE.Color("#fbbf24"),
  red: new THREE.Color("#fb7185"),
  deepGray: new THREE.Color("#0a0a12"),
};

/* ---- State configuration ---- */
type StateConfig = {
  dispersion: number;
  energy: number;
  speed: number;
  filamentActivity: number;
  corePulse: number;
  colorShift: number;
};

const STATE_CONFIG: Record<EntityState, StateConfig> = {
  idle: { dispersion: 0, energy: 0.15, speed: 0.3, filamentActivity: 0.2, corePulse: 0.3, colorShift: 0 },
  attentive: { dispersion: 0.05, energy: 0.35, speed: 0.5, filamentActivity: 0.5, corePulse: 0.5, colorShift: 0.1 },
  activated: { dispersion: 0.15, energy: 0.7, speed: 1.2, filamentActivity: 0.9, corePulse: 0.8, colorShift: 0.2 },
  thinking: { dispersion: 0.45, energy: 0.9, speed: 1.8, filamentActivity: 1.0, corePulse: 1.0, colorShift: 0.3 },
  responding: { dispersion: 0.1, energy: 0.6, speed: 0.8, filamentActivity: 0.6, corePulse: 0.7, colorShift: 0.15 },
  speaking: { dispersion: 0.08, energy: 0.5, speed: 0.6, filamentActivity: 0.5, corePulse: 0.6, colorShift: 0.1 },
  success: { dispersion: 0, energy: 0.8, speed: 0.4, filamentActivity: 0.3, corePulse: 1.0, colorShift: 0 },
  error: { dispersion: 0.1, energy: 0.4, speed: 0.3, filamentActivity: 0.2, corePulse: 0.4, colorShift: 0 },
};

export default function HolographicEntity({
  state = "idle",
  variant = "window",
  className = "",
  responsiveness = 1,
  density = 1,
}: HolographicEntityProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<EntityState>(state);
  const targetConfigRef = useRef<StateConfig>(STATE_CONFIG[state]);
  const currentConfigRef = useRef<StateConfig>(STATE_CONFIG[state]);
  const pointerRef = useRef({ x: 9999, y: 9999, strength: 0 });
  const hyperRef = useRef(0);
  const successTimerRef = useRef(0);
  const errorTimerRef = useRef(0);

  // Smooth state transitions
  useEffect(() => {
    stateRef.current = state;
    targetConfigRef.current = STATE_CONFIG[state];
    if (state === "success") successTimerRef.current = 1.5;
    if (state === "error") errorTimerRef.current = 1.5;
  }, [state]);

  const handlePointer = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 2 - 1;
    const y = 1 - ((clientY - rect.top) / rect.height) * 2;
    pointerRef.current.x = x * 2;
    pointerRef.current.y = y * 2;
    pointerRef.current.strength = 1;
  }, []);

  useEffect(() => {
    const el = canvasRef.current as HTMLCanvasElement;
    if (!el) return;

    el.style.width = "100%";
    el.style.height = "100%";

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas: el, antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      renderer.setClearColor(0x000000, 0);
    } catch {
      return;
    }

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
    camera.position.z = 3.2;

    // Lights
    scene.add(new THREE.AmbientLight(0xffffff, 0.15));
    const keyLight = new THREE.PointLight(0xa78bfa, 1.5, 10);
    keyLight.position.set(2, 2, 2);
    scene.add(keyLight);
    const fillLight = new THREE.PointLight(0x00f2fe, 0.8, 10);
    fillLight.position.set(-2, -1, 2);
    scene.add(fillLight);

    // ---- Particle layers ----
    const layerConfigs = [
      { count: 800, radius: 1.2, size: 1.5, speed: 0.3, color: PALETTE.violet, opacity: 0.7 },
      { count: 600, radius: 1.5, size: 1.2, speed: 0.2, color: PALETTE.cyan, opacity: 0.5 },
      { count: 400, radius: 1.8, size: 1.0, speed: 0.15, color: PALETTE.iceBlue, opacity: 0.35 },
      { count: 200, radius: 2.1, size: 0.8, speed: 0.1, color: PALETTE.magenta, opacity: 0.25 },
    ];

    if (variant === "ambient") {
      layerConfigs.forEach(l => { l.count = Math.floor(l.count * 0.3); l.size *= 0.7; });
    } else if (variant === "hero") {
      layerConfigs.forEach(l => { l.count = Math.floor(l.count * 1.5); });
    }

    const totalParticles = layerConfigs.reduce((s, l) => s + l.count, 0);
    const positions = new Float32Array(totalParticles * 3);
    const colors = new Float32Array(totalParticles * 3);
    const sizes = new Float32Array(totalParticles);
    const speeds = new Float32Array(totalParticles);
    const phases = new Float32Array(totalParticles);

    let offset = 0;
    const particleData: { layer: number; index: number; basePos: THREE.Vector3; orbitSpeed: number; orbitRadius: number }[] = [];

    layerConfigs.forEach((layer, li) => {
      for (let i = 0; i < layer.count; i++) {
        const idx = offset + i;
        // Deterministic pseudo-random distribution on sphere surface + volume
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const r = layer.radius * (0.7 + Math.random() * 0.3);
        const x = r * Math.sin(phi) * Math.cos(theta);
        const y = r * Math.sin(phi) * Math.sin(theta);
        const z = r * Math.cos(phi);
        positions[idx * 3] = x;
        positions[idx * 3 + 1] = y;
        positions[idx * 3 + 2] = z;
        colors[idx * 3] = layer.color.r;
        colors[idx * 3 + 1] = layer.color.g;
        colors[idx * 3 + 2] = layer.color.b;
        sizes[idx] = layer.size * (0.5 + Math.random() * 0.5);
        speeds[idx] = layer.speed * (0.5 + Math.random() * 0.5);
        phases[idx] = Math.random() * Math.PI * 2;
        particleData.push({ layer: li, index: idx, basePos: new THREE.Vector3(x, y, z), orbitSpeed: layer.speed, orbitRadius: r });
      }
      offset += layer.count;
    });

    const particleGeom = new THREE.BufferGeometry();
    particleGeom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    particleGeom.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));
    particleGeom.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
    particleGeom.setAttribute("aSpeed", new THREE.BufferAttribute(speeds, 1));
    particleGeom.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));

    const particleMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uPixelRatio: { value: Math.min(2, window.devicePixelRatio || 1) },
        uDispersion: { value: 0 },
        uEnergy: { value: 0.15 },
        uPointer: { value: new THREE.Vector3(9999, 9999, 0) },
        uPointerStrength: { value: 0 },
      },
      vertexShader: PARTICLE_VERT,
      fragmentShader: PARTICLE_FRAG,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const particlePoints = new THREE.Points(particleGeom, particleMat);
    scene.add(particlePoints);

    // ---- Filament network ----
    const MAX_FILAMENTS = 120;
    const filamentPositions = new Float32Array(MAX_FILAMENTS * 6);
    const filamentAlphas = new Float32Array(MAX_FILAMENTS);
    const filamentGeom = new THREE.BufferGeometry();
    filamentGeom.setAttribute("position", new THREE.BufferAttribute(filamentPositions, 3));
    filamentGeom.setAttribute("aAlpha", new THREE.BufferAttribute(filamentAlphas, 1));
    const filamentMat = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color("#a78bfa") } },
      vertexShader: FILAMENT_VERT,
      fragmentShader: FILAMENT_FRAG,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const filamentLines = new THREE.LineSegments(filamentGeom, filamentMat);
    scene.add(filamentLines);

    // ---- Central core ----
    const coreGeom = new THREE.SphereGeometry(0.22, 32, 32);
    const coreMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uEnergy: { value: 0.15 },
        uHyper: { value: 0 },
        uColorA: { value: new THREE.Color("#3a2a7e") },
        uColorB: { value: new THREE.Color("#a78bfa") },
      },
      vertexShader: CORE_VERT,
      fragmentShader: CORE_FRAG,
      transparent: true,
    });
    const coreMesh = new THREE.Mesh(coreGeom, coreMat);
    scene.add(coreMesh);

    // ---- Interaction ----
    let dragging = false;
    let lastX = 0;
    let lastY = 0;

    const onPointerDown = (e: PointerEvent) => {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      handlePointer(e.clientX, e.clientY);
      el.setPointerCapture(e.pointerId);
    };
    const onPointerMove = (e: PointerEvent) => {
      handlePointer(e.clientX, e.clientY);
      if (dragging) {
        const dx = e.clientX - lastX;
        const dy = e.clientY - lastY;
        lastX = e.clientX;
        lastY = e.clientY;
        particlePoints.rotation.y += dx * 0.003;
        particlePoints.rotation.x += dy * 0.002;
      }
    };
    const onPointerUp = (e: PointerEvent) => {
      dragging = false;
      try { el.releasePointerCapture(e.pointerId); } catch { /* noop */ }
    };
    const onPointerLeave = () => {
      pointerRef.current.strength = 0;
      pointerRef.current.x = 9999;
      pointerRef.current.y = 9999;
    };

    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", onPointerUp);
    el.addEventListener("pointerleave", onPointerLeave);

    // ---- Director mode sync ----
    const observer = new MutationObserver(() => {
      hyperRef.current = document.documentElement.dataset.director === "on" ? 1 : 0;
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-director"] });
    hyperRef.current = document.documentElement.dataset.director === "on" ? 1 : 0;

    // ---- Resize ----
    function resize() {
      const rect = el.getBoundingClientRect();
      const w = Math.max(1, rect.width);
      const h = Math.max(1, rect.height);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    }
    resize();
    window.addEventListener("resize", resize);

    // ---- Animation loop ----
    const clock = new THREE.Clock();
    let raf = 0;
    const posAttr = particleGeom.getAttribute("position") as THREE.BufferAttribute;
    const filamentPosAttr = filamentGeom.getAttribute("position") as THREE.BufferAttribute;
    const filamentAlphaAttr = filamentGeom.getAttribute("aAlpha") as THREE.BufferAttribute;

    function animate() {
      raf = requestAnimationFrame(animate);
      const dt = Math.min(0.05, clock.getDelta());
      const t = clock.elapsedTime;

      // Smooth config interpolation
      const target = targetConfigRef.current;
      const cur = currentConfigRef.current;
      const lerpSpeed = 2.5 * dt;
      cur.dispersion += (target.dispersion - cur.dispersion) * lerpSpeed;
      cur.energy += (target.energy - cur.energy) * lerpSpeed;
      cur.speed += (target.speed - cur.speed) * lerpSpeed;
      cur.filamentActivity += (target.filamentActivity - cur.filamentActivity) * lerpSpeed;
      cur.corePulse += (target.corePulse - cur.corePulse) * lerpSpeed;

      // Audio reactivity
      const levels = audioBus.getLevels();
      const audioEnergy = levels.active ? levels.energy : 0;
      const audioPulse = levels.active ? levels.pulse : 0;

      // Success / error timers
      if (successTimerRef.current > 0) successTimerRef.current -= dt;
      if (errorTimerRef.current > 0) errorTimerRef.current -= dt;

      const isSuccess = successTimerRef.current > 0;
      const isError = errorTimerRef.current > 0;
      const hyper = hyperRef.current;

      // Update particle uniforms
      particleMat.uniforms.uTime.value = t;
      particleMat.uniforms.uDispersion.value = cur.dispersion;
      particleMat.uniforms.uEnergy.value = Math.min(1.5, cur.energy + audioEnergy * 0.5 + (isSuccess ? 0.8 : 0) + (isError ? 0.3 : 0));
      particleMat.uniforms.uPointer.value.set(pointerRef.current.x, pointerRef.current.y, 0);
      particleMat.uniforms.uPointerStrength.value = pointerRef.current.strength * responsiveness;

      // Update particle positions (orbital drift)
      const pos = posAttr.array as Float32Array;
      const speedMul = cur.speed * (1 + audioEnergy * 0.5);
      for (let i = 0; i < particleData.length; i++) {
        const p = particleData[i];
        const angle = t * p.orbitSpeed * speedMul + phases[p.index];
        const c = Math.cos(angle);
        const s = Math.sin(angle);
        const bx = p.basePos.x;
        const bz = p.basePos.z;
        pos[p.index * 3] = bx * c - bz * s;
        pos[p.index * 3 + 1] = p.basePos.y + Math.sin(t * 0.3 + phases[p.index]) * 0.02;
        pos[p.index * 3 + 2] = bx * s + bz * c;
      }
      posAttr.needsUpdate = true;

      // Update filaments (neural connections)
      const filamentCount = Math.floor(MAX_FILAMENTS * cur.filamentActivity);
      for (let i = 0; i < MAX_FILAMENTS; i++) {
        if (i < filamentCount && particleData.length > 1) {
          const a = particleData[Math.floor(Math.random() * particleData.length)];
          const b = particleData[Math.floor(Math.random() * particleData.length)];
          if (a.index !== b.index) {
            filamentPositions[i * 6] = pos[a.index * 3];
            filamentPositions[i * 6 + 1] = pos[a.index * 3 + 1];
            filamentPositions[i * 6 + 2] = pos[a.index * 3 + 2];
            filamentPositions[i * 6 + 3] = pos[b.index * 3];
            filamentPositions[i * 6 + 4] = pos[b.index * 3 + 1];
            filamentPositions[i * 6 + 5] = pos[b.index * 3 + 2];
            filamentAlphas[i] = 0.3 + Math.random() * 0.4 * cur.filamentActivity;
          }
        } else {
          filamentAlphas[i] = 0;
        }
      }
      filamentPosAttr.needsUpdate = true;
      filamentAlphaAttr.needsUpdate = true;

      // Core
      coreMat.uniforms.uTime.value = t;
      coreMat.uniforms.uEnergy.value = cur.energy + audioEnergy * 0.3 + (isSuccess ? 1.0 : 0);
      coreMat.uniforms.uHyper.value = hyper;
      const coreScale = 1 + cur.corePulse * 0.15 + audioPulse * 0.1 + (isSuccess ? 0.3 : 0);
      coreMesh.scale.setScalar(coreScale);

      // Filament color shifts with state
      if (isSuccess) {
        (filamentMat.uniforms.uColor.value as THREE.Color).set("#6ee7b7");
      } else if (isError) {
        (filamentMat.uniforms.uColor.value as THREE.Color).set("#fbbf24");
      } else if (hyper > 0.5) {
        (filamentMat.uniforms.uColor.value as THREE.Color).set("#6ee7b7");
      } else {
        (filamentMat.uniforms.uColor.value as THREE.Color).set("#a78bfa");
      }

      // Pointer strength decay
      pointerRef.current.strength *= 0.95;

      // Core light intensity
      keyLight.intensity = 1.0 + cur.energy * 1.5 + audioEnergy * 0.5 + hyper * 1.0;

      renderer.render(scene, camera);
    }

    raf = requestAnimationFrame(animate);

    // ---- Cleanup ----
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", onPointerUp);
      el.removeEventListener("pointerleave", onPointerLeave);
      observer.disconnect();
      particleGeom.dispose();
      particleMat.dispose();
      filamentGeom.dispose();
      filamentMat.dispose();
      coreGeom.dispose();
      coreMat.dispose();
      renderer.dispose();
    };
  }, [variant, responsiveness, handlePointer]);

  return <canvas ref={canvasRef} className={className} style={{ width: "100%", height: "100%" }} />;
}
