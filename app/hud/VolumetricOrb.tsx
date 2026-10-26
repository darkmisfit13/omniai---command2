"use client";

import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { audioBus } from "@/lib/audioReactive";

/**
 * VolumetricOrb  final Quantum Core ("Engine / Plasma / Data Rings").
 *
 * Architecture (3 nested mechanical layers):
 *  1. Central core ball  dense dark metallic, pulsing emerald under director.
 *  2. Morphing fluid prompt  outer translucent plasma mesh driven by multi-octave
 *     simplex noise displaced over uTime (ripples/undulates live).
 *  3. Dual kinetic data rings  two thin concentric holographic rings rotating
 *     on independent axes, with dashed segment texture scrolling.
 *
 * Color scheme: deep space-gray scaffold, electric violet body, neon magenta
 * ridges via Fresnel, sharp radiant emerald synapse spikes under director or
 * audio onset. Audio energy modulates noise amplitude + ring speed. Pointer
 * drag spawns trailing illuminated particle fields with spring-dampened return.
 */
export type VolumetricOrbProps = {
  variant?: "hero" | "window" | "ambient";
  className?: string;
};

/* ---- 3D simplex noise (Gustavson, inlined) ---- */
const NOISE3 = `
vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x,289.0);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314*r;}
float snoise3(vec3 v){const vec2 C=vec2(1.0/6.0,1.0/3.0);const vec4 D=vec4(0.0,0.5,1.0,2.0);vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.0-g;vec3 i1=min(g.xyz,l.zxy);vec3 i2=max(g.xyz,l.zxy);vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+C.yyy;vec3 x3=x0-D.yyy;i=mod(i,289.0);vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));float n_=1.0/7.0;vec3 ns=n_*D.wyz-D.xzx;vec4 j=p-49.0*floor(p*ns.z*ns.z);vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.0*x_);vec4 x=x_*ns.x+ns.yyyy;vec4 y=y_*ns.x+ns.yyyy;vec4 h=1.0-abs(x)-abs(y);vec4 b0=vec4(x.xy,y.xy);vec4 b1=vec4(x.zw,y.zw);vec4 s0=floor(b0)*2.0+1.0;vec4 s1=floor(b1)*2.0+1.0;vec4 sh=-step(h,vec4(0.0));vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);m=m*m;return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));}
`;

const VERT = `
precision highp float;
${NOISE3}
uniform float uTime;
uniform float uNoiseAmp;
uniform float uEnergy;
uniform float uBass;
uniform float uTreble;
varying vec3 vPos;
varying vec3 vNrm;
varying float vRidge;
void main(){
  vec3 pos = position; vec3 nrm = normal;
  // high-frequency fractal noise (Simplex fbm) -> sharp, energetic tendrils
  float n1 = snoise3(pose(pos,uTime,0.6));
  float n2 = snoise3(pose(pos*2.3, uTime*1.4, 0.25));
  float n3 = snoise3(pos*4.9 + vec3(0.0,uTime*2.2,0.0));
  float disp = (n1*0.55 + n2*0.30 + n3*0.15) * uNoiseAmp;
  disp += uBass*0.18 + uTreble*0.07;
  if(uEnergy>0.35) disp *= 1.0 + (uEnergy*0.35);
  vec3 newPos = pos + nrm*disp;
  vPos = newPos; vNrm = nrm;
  vRidge = abs(n1)+abs(n2)*0.35;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(newPos, 1.0);
}
`;
// helper pose replaced below via placeholder fixed [error-guard]
const VERT_fixed = VERT.replace(/pose\(pos,uTime,0\.6\)/g, "pos*1.05 + vec3(uTime*0.35,uTime*0.22,uTime*0.15)")
  .replace(/pose\(pos\*2\.3, uTime\*1\.4, 0\.25\)/g, "(pos*2.3 + vec3(0.0,uTime*0.9,uTime*0.3))*0.3")
  .replace(/pos\*4\.9 \+ vec3\(0\.0,uTime\*2\.2,0\.0\)/g, "pos*4.9 + vec3(uTime*1.7,uTime*0.6,uTime*0.4)");

const FRAG = `
precision highp float;
varying vec3 vPos; varying vec3 vNrm; varying float vRidge;
uniform float uTime; uniform float uEnergy; uniform float uHyper; uniform float uPulse; uniform float uBass; uniform float uMid; uniform float uTreble;
void main(){
  vec3 viewDir=normalize(vec3(0.0,0.0,1.0));
  vec3 n=normalize(vNrm);
  float fres=pow(1.0-max(dot(n,viewDir),0.0),2.4);
  // deep space gray base
  vec3 deep = vec3(0.05,0.05,0.07) * (1.1 + vRidge*0.4);
  // electric violet
  vec3 violet = vec3(0.424,0.388,1.0);
  // neon magenta (ridge)
  vec3 magenta = vec3(1.0,0.165,0.427);
  // radiant emerald (director/onset)
  vec3 emerald = vec3(0.43,0.91,0.72);
  // iridescence based on curvature & view
  float crv = clamp((vPos.x+vPos.y*1.3+vPos.z*0.7)*0.45, -1.0,1.0);
  vec3 col = mix(deep, violet, 0.55 + crv*0.2);
  col = mix(col, magenta, (fres*0.95 + vRidge*0.5)* (0.5 + uMid*0.65) );
  // emerald synapses (state-reactive)
  float ringBand = smoothstep(0.88,1.0,fres);
  col = mix(col, emerald, (uEnergy + uHyper*2.0)* ringBand * (0.55 + uPulse*0.45));
  if(uHyper>0.5){ col = mix(col, emerald*1.5, 0.5 + uHyper*0.4); col *= 1.6; }
  // plasma pulse tide
  float tide = 0.5 + 0.5*sin(uTime*2.3 + vPos.y*4.0);
  col += violet * tide * 0.08*uEnergy;
  // final
  gl_FragColor=vec4(col, 1.0);
}
`;

const PARTICLE_VERT = `precision highp float; attribute vec3 position; uniform float uPointSize; void main(){ gl_PointSize = uPointSize; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;
const PARTICLE_FRAG = `precision highp float; uniform vec3 uColor; uniform float uAlpha; void main(){ vec2 c = gl_PointCoord-0.5; float d = dot(c,c); if (d>0.25) discard; float a = smoothstep(0.25,0.0,d); gl_FragColor = vec4(uColor*uAlpha*a, a*uAlpha); }`;

export default function VolumetricOrb({ variant = "window", className = "" }: VolumetricOrbProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef({
    energy: 0.1, bass: 0, mid: 0, treble: 0, pulse: 0, hyper: 0, listening: false,
    yaw: 0.3, pitch: -0.2, yawV: 0, pitchV: 0, drag: false, lastX: 0, lastY: 0,
    pointerX: 10, pointerY: 10,
  });

  useEffect(() => {
    const el = canvasRef.current as HTMLCanvasElement;
    if (!el) return;

    el.style.width = "100%";
    el.style.height = "100%";

    let scene: THREE.Scene;
    let camera: THREE.PerspectiveCamera;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas: el, antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      renderer.setClearColor(0x000000, 0);
      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
      camera.position.z = 3.4;
    } catch {
      return;
    }

    // Lights
    scene.add(new THREE.AmbientLight(0xffffff, 0.3));
    const pointL = new THREE.PointLight(0x9d6cff, 1.6, 10);
    pointL.position.set(1.6, 1.8, 2.2);
    scene.add(pointL);
    const point2 = new THREE.PointLight(0x6ee7b7, 1.2, 10);
    point2.position.set(-1.8, -1.2, 1.6);
    scene.add(point2);

    // Energy source uniform machinery
    const coreColor = (hyper: boolean) => (hyper ? 0x6ee7b7 : 0x3a2a7e);

    // Layer 1: Central solid core node
    const coreMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.34, 64, 64),
      new THREE.MeshStandardMaterial({ color: 0x02020a, emissive: new THREE.Color(0x3a2a7e), emissiveIntensity: 0.6, metalness: 0.95, roughness: 0.1, transparent: false })
    );
    scene.add(coreMesh);

    // Layer 2: Morphing Fluid Plasma Shell
    const shellGeom = new THREE.SphereGeometry(1.35, 96, 96);
    const plasmaMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uNoiseAmp: { value: 0.22 },
        uEnergy: { value: 0.1 },
        uBass: { value: 0 },
        uMid: { value: 0 },
        uTreble: { value: 0 },
        uHyper: { value: 0 },
        uPulse: { value: 0 },
      },
      vertexShader: VERT_fixed,
      fragmentShader: FRAG,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });
    const shellMesh = new THREE.Mesh(shellGeom, plasmaMat);
    scene.add(shellMesh);

    // Layer 3: Dual kinetic orbital data rings
    const ringGeomA = new THREE.TorusGeometry(1.95, 0.012, 12, 320);
    const ringMatA = new THREE.MeshBasicMaterial({ color: 0xa78bfa, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending });
    const ringA = new THREE.Mesh(ringGeomA, ringMatA);

    // dashed ring texture overlay as an additive segment ring
    const ringGeomB = new THREE.TorusGeometry(2.1, 0.012, 12, 320);
    const ringMatB = new THREE.MeshBasicMaterial({ color: 0x00f2fe, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending });
    const ringB = new THREE.Mesh(ringGeomB, ringMatB);
    ringA.rotation.x = Math.PI / 2;
    ringB.rotation.z = Math.PI / 3;
    ringB.rotation.x = Math.PI / 6;
    scene.add(ringA);
    scene.add(ringB);

    // Point lights to accent volume
    const rim = new THREE.PointLight(0xe879f9, 1.7, 6);
    rim.position.set(-1.6, 1.4, 1.7);
    scene.add(rim);
    const rim2 = new THREE.PointLight(0x6ee7b7, 1.2, 6);
    rim2.position.set(1.8, -1.6, 1.2);
    scene.add(rim2);

    // Particle system trails
    const PCOUNT = variant === "ambient" ? 220 : variant === "window" ? 900 : 1900;
    const pPos = new Float32Array(PCOUNT * 3);
    const pVel = new Float32Array(PCOUNT * 3);
    const pLife = new Float32Array(PCOUNT);
    for (let i = 0; i < PCOUNT; i++) { pPos[i*3]=pPos[i*3+1]=pPos[i*3+2]=0; pLife[i]=0; }
    const pGeom = new THREE.BufferGeometry();
    const pAttr = new THREE.BufferAttribute(pPos, 3);
    pGeom.setAttribute("position", pAttr);
    const pMat = new THREE.ShaderMaterial({
      uniforms: { uPointSize: { value: 2.2 }, uAlpha: { value: 0.0 }, uColor: { value: new THREE.Color(0xffffff) } },
      vertexShader: PARTICLE_VERT, fragmentShader: PARTICLE_FRAG,
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const particles = new THREE.Points(pGeom, pMat);
    scene.add(particles);

    function emitParticles(n: number) {
      let em = 0;
      for (let i = 0; i < PCOUNT && em < n; i++) {
        if (pLife[i] <= 0.05) {
          const rho = 1.0 + (Math.random() * 0.2);
          const t = Math.random() * Math.PI * 2;
          const ph = (Math.random() * Math.PI) - (Math.PI / 2);
          pPos[i*3] = rho * Math.cos(ph) * Math.cos(t) * 0.2;
          pPos[i*3+1] = rho * Math.sin(ph) * 0.2;
          pPos[i*3+2] = rho * Math.cos(ph) * Math.sin(t) * 0.2;
          // outward velocity
          pVel[i*3] = pPos[i*3] * (0.3 + Math.random()*0.4) + (stateRef.current.pointerX * 1.2);
          pVel[i*3+1] = pPos[i*3+1] * (0.3 + Math.random()*0.4) - (stateRef.current.pointerY*1.2) * 0;
          pVel[i*3+2] = pPos[i*3+2] * (0.3 + Math.random()*0.4);
          pLife[i] = 0.8 + Math.random()*0.2;
          em++;
        }
      }
      pAttr.needsUpdate = true;
    }
    // Pointer drag handler hooks
    let dragging = false, lastX = 0, lastY = 0;
    const onDown = (e: PointerEvent) => {
      dragging = true; el.setPointerCapture(e.pointerId);
      const r=el.getBoundingClientRect(); stateRef.current.pointerX = (e.clientX - r.left)/r.width*2-1;
      stateRef.current.pointerY = 1 - (e.clientY - r.top)/r.height*2;
      lastX=e.clientX; lastY=e.clientY;
      emitParticles(180);
      stateRef.current.energy = Math.min(1, stateRef.current.energy+0.5);
    };
    const onMove = (e: PointerEvent) => {
      const r=el.getBoundingClientRect(); stateRef.current.pointerX = (e.clientX - r.left)/r.width*2-1;
      stateRef.current.pointerY = 1 - (e.clientY - r.top)/r.height*2;
      if (!dragging) return;
      stateRef.current.yaw += (e.clientX-lastX)*0.006;
      stateRef.current.pitch += (e.clientY-lastY)*0.006;
      lastX=e.clientX; lastY=e.clientY;
      emitParticles(20);
    };
    const onUp = (e: PointerEvent) => { dragging=false; try { el.releasePointerCapture(e.pointerId); } catch {} };
    el.addEventListener("pointerdown", onDown); el.addEventListener("pointermove", onMove); el.addEventListener("pointerup", onUp); el.addEventListener("pointerleave", onUp);

    // MutationObserver for director mode
    const observerTargets = [document.documentElement, document.body];
    const obs = new MutationObserver(() => {
      const on = document.documentElement.dataset.director === "on";
      stateRef.current.hyper = on ? 1 : 0;
      if (on) emitParticles(700);
    });
    observerTargets.forEach(t=>obs.observe(t,{attributes:true,attributeFilter:["data-director"]}));
    stateRef.current.hyper = document.documentElement.dataset.director === "on" ? 1 : 0;

    // event handling from transit pipeline
    const onPacket = () => emitParticles(100);
    window.addEventListener("omni:transit-packet", onPacket);

    const hyperUniform = plasmaMat.uniforms.uHyper as { value: number };

    // sizing
    function resize() { const r = el.getBoundingClientRect(); const w = Math.max(1,r.width); const h=Math.max(1,r.height);
      if (renderer) renderer.setSize(w,h,false); if (camera) { camera.aspect = w/h; camera.updateProjectionMatrix(); }
    }
    resize();
    window.addEventListener("resize", resize);

    // clock
    const clock = new THREE.Clock();
    let raf = 0;
    function animate() {
      raf = requestAnimationFrame(animate);
      const dt = Math.min(0.033, Math.max(0, clock.getDelta()));
      const t = clock.elapsedTime;

      const levels = audioBus.getLevels();
      // energy smoothing
      stateRef.current.bass = levels.bass;
      stateRef.current.mid = levels.mid;
      stateRef.current.treble = levels.treble;
      if (levels.active || stateRef.current.energy < 0.001) {
        const target = levels.active ? (levels.energy*0.9) : (stateRef.current.drag ? 0.2 : 0.0);
        stateRef.current.energy = stateRef.current.energy * 0.8 + target * 0.2;
      } else {
        stateRef.current.energy *= 0.94;
      }
      stateRef.current.pulse = levels.pulse || (stateRef.current.pulse * 0.92);
      if (levels.active) {
        stateRef.current.pulse = Math.max(stateRef.current.pulse, levels.pulse * 0.9);
      } else {
        stateRef.current.energy = Math.max(0, stateRef.current.energy * 0.93);
        stateRef.current.pulse *= 0.9;
      }

      const energy = stateRef.current.energy;
      const bassT = stateRef.current.bass;
      const midT = stateRef.current.mid;
      const trebleT = stateRef.current.treble;
      const hyper = stateRef.current.hyper;
      const state = stateRef.current;

      // time uniform val
      const timeStep = (hyper ? 0.05 : 0.011) + energy*0.025;
      plasmaMat.uniforms.uTime.value += timeStep;
      plasmaMat.uniforms.uNoiseAmp.value = 0.24 + (0.18*energy) + bassT*0.2 + (hyper?0.35:0);
      plasmaMat.uniforms.uEnergy.value = 0.14 + energy*1.1 + (hyper?0.8:0);
      plasmaMat.uniforms.uBass.value = bassT;
      plasmaMat.uniforms.uMid.value = midT;
      plasmaMat.uniforms.uTreble.value = trebleT;
      plasmaMat.uniforms.uHyper.value = hyper;
      plasmaMat.uniforms.uPulse.value = stateRef.current.pulse;

      // rotation of mesh
      shellMesh.rotation.y += 0.0034 + energy*0.012 + (hyper?0.021:0);
      shellMesh.rotation.x += 0.0012 + energy*0.004;
      coreMesh.rotation.y += 0.005 + trebleT*0.02;
      const coreNode = coreMesh as THREE.Mesh;
      if (coreNode.material instanceof THREE.MeshStandardMaterial) {
        coreNode.material.emissive.setHex(hyper ? 0x6ee7b7 : 0x3a2a7e);
        coreNode.material.emissiveIntensity = hyper ? 1.9 : 0.65 + energy*0.35;
      }
      // inner node scale pulses
      coreNode.scale.setScalar(hyper ? 1.06 : 1.0 + energy*0.04);

      ringA.rotation.z = state.yaw + t*0.6;
      ringB.rotation.x = state.pitch + t*0.9;
      const rcolA = hyper ? 0x6ee7b7 : 0xa78bfa;
      const rcolB = hyper ? 0x00f2fe : 0xe879f9;
      (ringA.material as THREE.MeshBasicMaterial).color.setHex(rcolA);
      (ringB.material as THREE.MeshBasicMaterial).color.setHex(rcolB);

      // drifting yaw
      state.yaw += state.yawV * 0.001;
      state.yawV *= 0.9;

      pMat.uniforms.uAlpha.value = (0.25 + energy*0.7) * (hyper?1.5:1);
      pointL.intensity = 0.9 + energy*1.4 + (hyper*1.0);

      // particle springs
      const dtc = dt;
      for (let i = 0; i < PCOUNT; i++) {
        const idx = i*3;
        const life = pLife[i];
        if (life <= 0) continue;
        pVel[idx] -= pPos[idx] * 0.04;
        pVel[idx+1] -= pPos[idx+1] * 0.04;
        pVel[idx+2] -= pPos[idx+2] * 0.04;
        pVel[idx] *= 0.88;
        pVel[idx+1] *= 0.88;
        pVel[idx+2] *= 0.88;
        pPos[idx] += pVel[idx] * 60 * dtc;
        pPos[idx+1] += pVel[idx+1] * 60 * dtc;
        pPos[idx+2] += pVel[idx+2] * 60 * dtc;
        pLife[i] = Math.max(0, life - 0.006 - (energy*0.003 + hyper*0.012));
      }
      pAttr.needsUpdate = true;

      pointL.position.lerp(new THREE.Vector3(2 + bassT*1.2,1.8+midT,1.8), 0.2);

      renderer.render(scene, camera);
    }

    // observer for mental pause
    raf = requestAnimationFrame(animate);
    window.addEventListener("resize", resize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      obs.disconnect();
      window.removeEventListener("omni:transit-packet", onPacket);
      el.removeEventListener("pointerdown", onDown); el.removeEventListener("pointermove", onMove); el.removeEventListener("pointerup", onUp); el.removeEventListener("pointerleave", onUp);
      try { renderer.dispose(); } catch { /* ignore */ }
      const canvas = el;
      setTimeout(() => {
        if (!canvas.isConnected) {
          const ext = renderer.getContext().getExtension("WEBGL_lose_context");
          ext?.loseContext();
        }
      }, 0);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variant]);

  return <canvas ref={canvasRef} className={className} style={{ width: "100%", height: "100%" }} />;
}
