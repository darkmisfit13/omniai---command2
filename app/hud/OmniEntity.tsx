"use client";

/**
 * OmniAI Hub Orb — Reference-Matched WebGL Sphere
 * =================================================
 * Built from scratch to match the uploaded reference image.
 *
 * What the reference shows:
 *  1. A transparent sphere defined by RANDOM great-circle arc lines
 *     (thin, ice-blue/white, glowing, NOT a lat/lon grid)
 *  2. Bright white star-burst NODE hotspots at arc endpoints/intersections
 *  3. Interior VOLUMETRIC ATMOSPHERIC GLOW (blue-white, Fresnel rim)
 *  4. LONG RADIAL ENERGY STREAKS shooting far outside the sphere
 *     (mostly blue-violet, some warm amber accent)
 *  5. Fine SPARKLE PARTICLE FIELD on the sphere surface
 *  6. Deep NAVY BACKGROUND with soft radial glow
 *
 * Rendering: pure WebGL1 (no Three.js matrix overhead) — lightweight,
 * single context per canvas, full cleanup on unmount.
 */

import { useEffect, useRef } from "react";
import {
  ARC_VERT,   ARC_FRAG,
  NODE_VERT,  NODE_FRAG,
  GLOW_VERT,  GLOW_FRAG,
  STREAK_VERT,STREAK_FRAG,
  SPARK_VERT, SPARK_FRAG,
  BG_VERT,    BG_FRAG,
} from "./omniEntityShaders";

/* ─────────────────────────────────────────────────────────────────────────────
   Public API
───────────────────────────────────────────────────────────────────────────── */

export type EntityState =
  | "idle" | "attentive" | "activated" | "thinking"
  | "responding" | "speaking" | "success" | "error";

export interface OmniEntityProps {
  state?: EntityState;
  className?: string;
  quality?: 0.5 | 0.75 | 1 | 1.5;
  onActivated?: () => void;
}

/* ─────────────────────────────────────────────────────────────────────────────
   Tiny mat4 library  (column-major, same convention as WebGL)
───────────────────────────────────────────────────────────────────────────── */

type M4 = Float32Array;

function identity(): M4 {
  return new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);
}

function perspective(fovY: number, aspect: number, near: number, far: number): M4 {
  const f = 1 / Math.tan(fovY / 2), nf = 1 / (near - far);
  return new Float32Array([
    f/aspect, 0, 0,                   0,
    0,        f, 0,                   0,
    0,        0, (far+near)*nf,      -1,
    0,        0, 2*far*near*nf,       0,
  ]);
}

function mul(a: M4, b: M4): M4 {
  const o = new Float32Array(16);
  for (let col=0; col<4; col++)
    for (let row=0; row<4; row++) {
      let s = 0;
      for (let k=0; k<4; k++) s += a[k*4+row] * b[col*4+k];
      o[col*4+row] = s;
    }
  return o;
}

function rotY(a: number): M4 {
  const c=Math.cos(a), s=Math.sin(a);
  return new Float32Array([c,0,-s,0, 0,1,0,0, s,0,c,0, 0,0,0,1]);
}

function rotX(a: number): M4 {
  const c=Math.cos(a), s=Math.sin(a);
  return new Float32Array([1,0,0,0, 0,c,s,0, 0,-s,c,0, 0,0,0,1]);
}

function translateZ(d: number): M4 {
  const m = identity();
  m[14] = d;
  return m;
}

function normalMatrix(mv: M4): Float32Array {
  // Upper-left 3×3 of the modelView (assumes uniform scale)
  return new Float32Array([mv[0],mv[1],mv[2], mv[4],mv[5],mv[6], mv[8],mv[9],mv[10]]);
}

/* ─────────────────────────────────────────────────────────────────────────────
   Seeded PRNG
───────────────────────────────────────────────────────────────────────────── */

function lcg(seed: number) {
  let s = seed | 0;
  return () => { s = Math.imul(s, 1664525) + 1013904223 | 0; return (s>>>0) / 0xffffffff; };
}

/* ─────────────────────────────────────────────────────────────────────────────
   Geometry builders
───────────────────────────────────────────────────────────────────────────── */

/** One great-circle arc at a random orientation, sampled into N+1 points. */
function buildArcs(nArcs: number, samplesPerArc: number, rand: ()=>number) {
  const verts: number[]  = [];
  const bright: number[] = [];

  for (let a = 0; a < nArcs; a++) {
    // Random great-circle: choose a random pole axis
    const phi   = rand() * Math.PI * 2;
    const theta = Math.acos(2 * rand() - 1);
    const px = Math.sin(theta)*Math.cos(phi);
    const py = Math.sin(theta)*Math.sin(phi);
    const pz = Math.cos(theta);

    // Start angle on that great circle (random offset)
    const startAngle = rand() * Math.PI * 2;
    // Arc spans a random portion of the circle: 40°–280°
    const spanAngle  = (0.22 + rand() * 1.33) * Math.PI;
    // Brightness for this arc (varies so some lines are brighter)
    const arcBright  = 0.35 + rand() * 0.65;

    // Build a basis perpendicular to the pole
    let bx=1, by=0, bz=0;
    if (Math.abs(px) > 0.9) { bx=0; by=1; bz=0; }
    // Gram-Schmidt to get two orthogonal vectors in the great-circle plane
    const dot1 = bx*px + by*py + bz*pz;
    const ux = bx - dot1*px, uy = by - dot1*py, uz = bz - dot1*pz;
    const ul = Math.sqrt(ux*ux+uy*uy+uz*uz);
    const u0x=ux/ul, u0y=uy/ul, u0z=uz/ul;
    // v = pole × u
    const vvx=py*u0z-pz*u0y, vvy=pz*u0x-px*u0z, vvz=px*u0y-py*u0x;

    for (let i = 0; i <= samplesPerArc; i++) {
      const angle = startAngle + (i / samplesPerArc) * spanAngle;
      const c = Math.cos(angle), s = Math.sin(angle);
      verts.push( c*u0x + s*vvx,  c*u0y + s*vvy,  c*u0z + s*vvz );
      // fade at endpoints for soft termination
      const t = i / samplesPerArc;
      const endFade = Math.min(t * 6, (1-t) * 6, 1);
      bright.push(arcBright * endFade);
    }
  }
  return { verts: new Float32Array(verts), bright: new Float32Array(bright), count: verts.length/3 };
}

/** Line index buffer: pairs of adjacent vertices within each arc. */
function buildArcIndices(nArcs: number, samplesPerArc: number): Uint16Array {
  const idx: number[] = [];
  for (let a = 0; a < nArcs; a++) {
    const base = a * (samplesPerArc + 1);
    for (let i = 0; i < samplesPerArc; i++) {
      idx.push(base + i, base + i + 1);
    }
  }
  return new Uint16Array(idx);
}

/** Node hotspots — bright points scattered on sphere surface. */
function buildNodes(nNodes: number, rand: ()=>number) {
  const pos: number[]  = [];
  const sizes: number[]  = [];
  const phases: number[] = [];
  for (let i = 0; i < nNodes; i++) {
    const phi   = rand() * Math.PI * 2;
    const theta = Math.acos(2 * rand() - 1);
    pos.push(Math.sin(theta)*Math.cos(phi), Math.cos(theta), Math.sin(theta)*Math.sin(phi));
    sizes.push(6 + rand() * 10);   // varied sizes: 6–16 pixels
    phases.push(rand() * Math.PI * 2);
  }
  return { pos: new Float32Array(pos), sizes: new Float32Array(sizes), phases: new Float32Array(phases) };
}

/** Sphere mesh for interior glow rendering. */
function buildSphere(segU: number, segV: number) {
  const verts: number[] = [], norms: number[] = [], tris: number[] = [];
  for (let v=0; v<=segV; v++) {
    const theta = (v/segV)*Math.PI, st=Math.sin(theta), ct=Math.cos(theta);
    for (let u=0; u<=segU; u++) {
      const phi = (u/segU)*Math.PI*2;
      const x=st*Math.cos(phi), y=ct, z=st*Math.sin(phi);
      verts.push(x,y,z); norms.push(x,y,z);
    }
  }
  const stride=segU+1;
  for (let v=0; v<segV; v++) for (let u=0; u<segU; u++) {
    const a=v*stride+u, b=a+1, c=a+stride, d=c+1;
    tris.push(a,b,c, b,d,c);
  }
  return { verts:new Float32Array(verts), norms:new Float32Array(norms), tris:new Uint16Array(tris) };
}

/** Radial streak lines: two vertices per streak (inner, outer). */
function buildStreaks(nStreaks: number, rand: ()=>number) {
  // Each streak: vertex 0 = inner (at sphere surface), vertex 1 = outer tip
  const dirs: number[]   = [];
  const ts: number[]     = [];
  const lens: number[]   = [];
  const phases: number[] = [];
  const ambers: number[] = [];

  for (let i = 0; i < nStreaks; i++) {
    const phi   = rand() * Math.PI * 2;
    const theta = Math.acos(2 * rand() - 1);
    const dx = Math.sin(theta)*Math.cos(phi);
    const dy = Math.sin(theta)*Math.sin(phi);
    const dz = Math.cos(theta);

    // length: 0.8 – 2.2 sphere radii beyond surface
    const len   = 0.8 + rand() * 1.4;
    const phase = rand() * Math.PI * 2;
    // ~15% are warm amber accent streaks (matches reference orange streaks)
    const amber = rand() < 0.15 ? 1.0 : 0.0;

    // inner vertex (t=0 = at sphere surface)
    dirs.push(dx,dy,dz); ts.push(0); lens.push(len); phases.push(phase); ambers.push(amber);
    // outer vertex (t=1 = tip)
    dirs.push(dx,dy,dz); ts.push(1); lens.push(len); phases.push(phase); ambers.push(amber);
  }

  return {
    dirs:   new Float32Array(dirs),
    ts:     new Float32Array(ts),
    lens:   new Float32Array(lens),
    phases: new Float32Array(phases),
    ambers: new Float32Array(ambers),
    count:  nStreaks * 2,
  };
}

/** Fine sparkle points on/near sphere surface. */
function buildSparks(nSparks: number, rand: ()=>number) {
  const pos: number[]    = [];
  const phases: number[] = [];
  const sizes: number[]  = [];
  for (let i = 0; i < nSparks; i++) {
    const phi   = rand() * Math.PI * 2;
    const theta = Math.acos(2 * rand() - 1);
    // Slightly scatter around surface
    const r = 0.94 + rand() * 0.10;
    pos.push(
      r*Math.sin(theta)*Math.cos(phi),
      r*Math.cos(theta),
      r*Math.sin(theta)*Math.sin(phi),
    );
    phases.push(rand());
    sizes.push(1.5 + rand() * 2.5);
  }
  return { pos:new Float32Array(pos), phases:new Float32Array(phases), sizes:new Float32Array(sizes) };
}

/* ─────────────────────────────────────────────────────────────────────────────
   WebGL helpers
───────────────────────────────────────────────────────────────────────────── */

function compile(gl: WebGLRenderingContext, type: number, src: string): WebGLShader {
  const sh = gl.createShader(type)!;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh);
    gl.deleteShader(sh);
    throw new Error(`shader: ${log ?? "failed"}`);
  }
  return sh;
}

function link(gl: WebGLRenderingContext, vs: string, fs: string): WebGLProgram {
  const p = gl.createProgram()!;
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(p);
    gl.deleteProgram(p);
    throw new Error(`link: ${log ?? "failed"}`);
  }
  return p;
}

function makeBuf(gl: WebGLRenderingContext, data: ArrayBufferView, target?: number): WebGLBuffer {
  const tgt = target ?? gl.ARRAY_BUFFER;
  const b = gl.createBuffer()!;
  gl.bindBuffer(tgt, b);
  gl.bufferData(tgt, data, gl.STATIC_DRAW);
  return b;
}

function bindF32(gl: WebGLRenderingContext, prog: WebGLProgram, name: string, buf: WebGLBuffer, size: number) {
  const loc = gl.getAttribLocation(prog, name);
  if (loc < 0) return;
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
}

function u1f(gl: WebGLRenderingContext, prog: WebGLProgram, name: string, v: number) {
  const l = gl.getUniformLocation(prog, name);
  if (l) gl.uniform1f(l, v);
}
function u2f(gl: WebGLRenderingContext, prog: WebGLProgram, name: string, x: number, y: number) {
  const l = gl.getUniformLocation(prog, name);
  if (l) gl.uniform2f(l, x, y);
}
function um4(gl: WebGLRenderingContext, prog: WebGLProgram, name: string, m: M4) {
  const l = gl.getUniformLocation(prog, name);
  if (l) gl.uniformMatrix4fv(l, false, m);
}
function um3(gl: WebGLRenderingContext, prog: WebGLProgram, name: string, m: Float32Array) {
  const l = gl.getUniformLocation(prog, name);
  if (l) gl.uniformMatrix3fv(l, false, m);
}

function lerp(a: number, b: number, t: number): number { return a + (b-a)*Math.min(Math.max(t,0),1); }

/* ─────────────────────────────────────────────────────────────────────────────
   State parameters
───────────────────────────────────────────────────────────────────────────── */

const STATES: Record<EntityState, { pulse: number; streakAlpha: number; rot: number; glowIntensity: number }> = {
  idle:       { pulse:0.30, streakAlpha:0.35, rot:0.0018, glowIntensity:0.55 },
  attentive:  { pulse:0.45, streakAlpha:0.45, rot:0.0028, glowIntensity:0.65 },
  activated:  { pulse:0.80, streakAlpha:0.80, rot:0.0080, glowIntensity:0.90 },
  thinking:   { pulse:1.00, streakAlpha:1.00, rot:0.0160, glowIntensity:1.00 },
  responding: { pulse:0.90, streakAlpha:0.90, rot:0.0060, glowIntensity:0.95 },
  speaking:   { pulse:0.65, streakAlpha:0.60, rot:0.0040, glowIntensity:0.75 },
  success:    { pulse:1.00, streakAlpha:1.00, rot:0.0070, glowIntensity:1.00 },
  error:      { pulse:0.20, streakAlpha:0.10, rot:0.0010, glowIntensity:0.35 },
};

/* ─────────────────────────────────────────────────────────────────────────────
   Component
───────────────────────────────────────────────────────────────────────────── */

export default function OmniEntity({ state="idle", className="", quality=1, onActivated }: OmniEntityProps) {
  const canvasRef    = useRef<HTMLCanvasElement|null>(null);
  const stateRef     = useRef<EntityState>(state);
  stateRef.current   = state;
  const activatedRef = useRef(onActivated);
  activatedRef.current = onActivated;

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    /* ── WebGL context ── */
    let gl: WebGLRenderingContext | null = null;
    try {
      gl = (canvas.getContext("webgl", { alpha:true, antialias:true, premultipliedAlpha:false })
         || canvas.getContext("experimental-webgl")) as WebGLRenderingContext | null;
    } catch { /**/ }
    if (!gl) { canvas.dataset.fallback="1"; return; }
    const g = gl;

    const dpr = Math.min(devicePixelRatio||1, 2);

    /* ── Compile programs ── */
    let prog: {
      arc: WebGLProgram; node: WebGLProgram; glow: WebGLProgram;
      streak: WebGLProgram; spark: WebGLProgram; bg: WebGLProgram;
    };
    try {
      prog = {
        arc:    link(g, ARC_VERT,    ARC_FRAG),
        node:   link(g, NODE_VERT,   NODE_FRAG),
        glow:   link(g, GLOW_VERT,   GLOW_FRAG),
        streak: link(g, STREAK_VERT, STREAK_FRAG),
        spark:  link(g, SPARK_VERT,  SPARK_FRAG),
        bg:     link(g, BG_VERT,     BG_FRAG),
      };
    } catch(e) {
      canvas.dataset.fallback="1";
      canvas.dataset.error = e instanceof Error ? e.message : String(e);
      return;
    }

    /* ── Build geometry ── */
    const rand = lcg(42);

    // Arc cage: 90 arcs × 48 samples each (matches reference complexity)
    const nArcs     = Math.round(90  * quality);
    const arcSamples = 48;
    const arcs      = buildArcs(nArcs, arcSamples, rand);
    const arcIdx    = buildArcIndices(nArcs, arcSamples);

    // Nodes: 120 hotspot points
    const nNodes  = Math.round(120 * quality);
    const nodes   = buildNodes(nNodes, rand);

    // Interior glow sphere
    const sphere  = buildSphere(32, 24);

    // Radial streaks: 60 long lines
    const nStreaks = Math.round(60 * quality);
    const streaks  = buildStreaks(nStreaks, rand);

    // Fine sparkle field: 800 points
    const nSparks = Math.round(800 * quality);
    const sparks  = buildSparks(nSparks, rand);

    // Background full-screen quad
    const bgQuad = new Float32Array([-1,-1, 1,-1, 1,1, -1,-1, 1,1, -1,1]);

    /* ── Upload buffers ── */
    const bArcVerts  = makeBuf(g, arcs.verts);
    const bArcBright = makeBuf(g, arcs.bright);
    const bArcIdx    = makeBuf(g, arcIdx, g.ELEMENT_ARRAY_BUFFER);

    const bNodePos   = makeBuf(g, nodes.pos);
    const bNodeSize  = makeBuf(g, nodes.sizes);
    const bNodePhase = makeBuf(g, nodes.phases);

    const bGlowV     = makeBuf(g, sphere.verts);
    const bGlowN     = makeBuf(g, sphere.norms);
    const bGlowI     = makeBuf(g, sphere.tris, g.ELEMENT_ARRAY_BUFFER);

    const bStrkDir   = makeBuf(g, streaks.dirs);
    const bStrkT     = makeBuf(g, streaks.ts);
    const bStrkLen   = makeBuf(g, streaks.lens);
    const bStrkPhase = makeBuf(g, streaks.phases);
    const bStrkAmber = makeBuf(g, streaks.ambers);

    const bSparkPos  = makeBuf(g, sparks.pos);
    const bSparkPh   = makeBuf(g, sparks.phases);
    const bSparkSz   = makeBuf(g, sparks.sizes);

    const bBg        = makeBuf(g, bgQuad);

    /* ── Interaction state ── */
    let yaw=0.4, pitch=-0.15;
    let yawVel=rm?0:0.0018, pitchVel=0;
    let dragging=false, lastX=0, lastY=0;
    let visible=true;

    /* ── Live params ── */
    let livePulse       = STATES.idle.pulse;
    let liveStreakAlpha = STATES.idle.streakAlpha;
    let liveRot         = STATES.idle.rot;
    let liveGlow        = STATES.idle.glowIntensity;

    /* ── Canvas sizing ── */
    let W=0, H=0;
    function resize() {
      const rect=canvas!.getBoundingClientRect();
      const nw=Math.max(1,Math.round(rect.width*dpr)), nh=Math.max(1,Math.round(rect.height*dpr));
      if(nw!==W||nh!==H){ W=nw; H=nh; canvas!.width=nw; canvas!.height=nh; }
    }
    resize();
    window.addEventListener("resize", resize);

    /* ── Pointer events ── */
    const onPD=(e:PointerEvent)=>{ dragging=true; lastX=e.clientX; lastY=e.clientY; canvas!.setPointerCapture(e.pointerId); activatedRef.current?.(); };
    const onPM=(e:PointerEvent)=>{ if(!dragging)return; const dx=e.clientX-lastX,dy=e.clientY-lastY; lastX=e.clientX; lastY=e.clientY; yaw+=dx*0.007; pitch=Math.max(-1.2,Math.min(1.2,pitch+dy*0.006)); yawVel=dx*0.0016; pitchVel=dy*0.0012; };
    const onPU=(e:PointerEvent)=>{ dragging=false; try{canvas!.releasePointerCapture(e.pointerId);}catch{} };
    canvas.addEventListener("pointerdown",   onPD);
    canvas.addEventListener("pointermove",   onPM);
    canvas.addEventListener("pointerup",     onPU);
    canvas.addEventListener("pointercancel", onPU);

    /* ── Visibility ── */
    const io=new IntersectionObserver(e=>{visible=e[0]?.isIntersecting??true;},{threshold:0.01});
    io.observe(canvas);
    const onVis=()=>{visible=document.visibilityState!=="hidden";};
    document.addEventListener("visibilitychange",onVis);
    const onCtx=(ev:Event)=>{ev.preventDefault();visible=false;};
    canvas.addEventListener("webglcontextlost",onCtx);

    /* ── Render loop ── */
    let rafId=0;
    const t0=performance.now();

    function frame(now: number) {
      rafId=requestAnimationFrame(frame);
      if(!visible)return;

      resize();
      const t = rm ? 0 : (now-t0)/1000;
      const dt = 1/60;

      /* lerp state params */
      const cur = stateRef.current;
      const tgt = STATES[cur];
      livePulse       = lerp(livePulse,       tgt.pulse,        dt*60*0.04);
      liveStreakAlpha = lerp(liveStreakAlpha,  tgt.streakAlpha,  dt*60*0.04);
      liveRot         = lerp(liveRot,          tgt.rot,          dt*60*0.06);
      liveGlow        = lerp(liveGlow,         tgt.glowIntensity,dt*60*0.04);

      /* rotation */
      if(!rm&&!dragging){ yawVel+=(liveRot-yawVel)*0.025; pitchVel*=0.94; yaw+=yawVel; pitch+=pitchVel; pitch+=(-0.15-pitch)*0.005; }

      /* matrices */
      const aspect = W/Math.max(H,1);
      const proj = perspective(0.72, aspect, 0.05, 100);
      const mv   = mul(translateZ(-2.8), mul(rotX(pitch), rotY(yaw)));
      const mvp  = mul(proj, mv);
      const nm   = normalMatrix(mv);

      /* GL state */
      g.viewport(0,0,W,H);
      g.clearColor(0,0,0,0);
      g.clear(g.COLOR_BUFFER_BIT|g.DEPTH_BUFFER_BIT);
      g.disable(g.DEPTH_TEST);
      g.enable(g.BLEND);

      /* ── 1. Background ── */
      g.blendFunc(g.ONE, g.ZERO); // opaque bg
      g.useProgram(prog.bg);
      u2f(g,prog.bg,"uRes",W,H);
      u1f(g,prog.bg,"uTime",t);
      const bgA=g.getAttribLocation(prog.bg,"aPos");
      g.bindBuffer(g.ARRAY_BUFFER,bBg); g.enableVertexAttribArray(bgA);
      g.vertexAttribPointer(bgA,2,g.FLOAT,false,0,0);
      g.drawArrays(g.TRIANGLES,0,6);

      /* ── 2. Interior glow (BackFace) ── */
      g.blendFunc(g.SRC_ALPHA, g.ONE);
      g.enable(g.CULL_FACE); g.cullFace(g.FRONT); // render back faces
      g.useProgram(prog.glow);
      um4(g,prog.glow,"uMVP",mvp);
      um3(g,prog.glow,"uNM",nm);
      u1f(g,prog.glow,"uTime",t);
      u1f(g,prog.glow,"uPulse",livePulse);
      u1f(g,prog.glow,"uIntensity",liveGlow);
      bindF32(g,prog.glow,"aPos",bGlowV,3);
      bindF32(g,prog.glow,"aNorm",bGlowN,3);
      g.bindBuffer(g.ELEMENT_ARRAY_BUFFER,bGlowI);
      g.drawElements(g.TRIANGLES,sphere.tris.length,g.UNSIGNED_SHORT,0);
      g.disable(g.CULL_FACE);

      /* ── 3. Radial energy streaks ── */
      // Use a non-rotating MVP so streaks radiate outward from the orb centre
      // but don't spin with the sphere — matches the reference image
      const streakMVP = mul(proj, translateZ(-2.8));
      g.blendFunc(g.SRC_ALPHA, g.ONE);
      g.useProgram(prog.streak);
      um4(g,prog.streak,"uMVP",streakMVP);
      u1f(g,prog.streak,"uTime",t);
      u1f(g,prog.streak,"uAlpha",liveStreakAlpha);
      bindF32(g,prog.streak,"aDir",   bStrkDir,  3);
      bindF32(g,prog.streak,"aT",     bStrkT,    1);
      bindF32(g,prog.streak,"aLen",   bStrkLen,  1);
      bindF32(g,prog.streak,"aPhase", bStrkPhase,1);
      bindF32(g,prog.streak,"aAmber", bStrkAmber,1);
      g.drawArrays(g.LINES,0,streaks.count);

      /* ── 4. Arc cage lines ── */
      g.blendFunc(g.SRC_ALPHA, g.ONE);
      g.useProgram(prog.arc);
      um4(g,prog.arc,"uMVP",mvp);
      u1f(g,prog.arc,"uTime",t);
      u1f(g,prog.arc,"uPulse",livePulse);
      bindF32(g,prog.arc,"aPos",   bArcVerts, 3);
      bindF32(g,prog.arc,"aBright",bArcBright,1);
      g.bindBuffer(g.ELEMENT_ARRAY_BUFFER,bArcIdx);
      g.drawElements(g.LINES,arcIdx.length,g.UNSIGNED_SHORT,0);

      /* ── 5. Sparkle particles ── */
      g.blendFunc(g.SRC_ALPHA, g.ONE);
      g.useProgram(prog.spark);
      um4(g,prog.spark,"uMVP",mvp);
      u1f(g,prog.spark,"uTime",t);
      u1f(g,prog.spark,"uPulse",livePulse);
      u1f(g,prog.spark,"uPixelRatio",dpr);
      bindF32(g,prog.spark,"aPos",  bSparkPos,3);
      bindF32(g,prog.spark,"aPhase",bSparkPh, 1);
      bindF32(g,prog.spark,"aSize", bSparkSz, 1);
      g.drawArrays(g.POINTS,0,nSparks);

      /* ── 6. Node hotspots ── */
      g.blendFunc(g.SRC_ALPHA, g.ONE);
      g.useProgram(prog.node);
      um4(g,prog.node,"uMVP",mvp);
      u1f(g,prog.node,"uTime",t);
      u1f(g,prog.node,"uPulse",livePulse);
      u1f(g,prog.node,"uPixelRatio",dpr);
      bindF32(g,prog.node,"aPos",  bNodePos,  3);
      bindF32(g,prog.node,"aSize", bNodeSize, 1);
      bindF32(g,prog.node,"aPhase",bNodePhase,1);
      g.drawArrays(g.POINTS,0,nNodes);
    }

    rafId=requestAnimationFrame(frame);

    /* ── Cleanup ── */
    return ()=>{
      cancelAnimationFrame(rafId);
      io.disconnect();
      document.removeEventListener("visibilitychange",onVis);
      window.removeEventListener("resize",resize);
      canvas.removeEventListener("pointerdown",onPD);
      canvas.removeEventListener("pointermove",onPM);
      canvas.removeEventListener("pointerup",onPU);
      canvas.removeEventListener("pointercancel",onPU);
      canvas.removeEventListener("webglcontextlost",onCtx);
      // Dispose all buffers and programs
      [bArcVerts,bArcBright,bNodePos,bNodeSize,bNodePhase,bGlowV,bGlowN,
       bStrkDir,bStrkT,bStrkLen,bStrkPhase,bStrkAmber,
       bSparkPos,bSparkPh,bSparkSz,bBg].forEach(b=>g.deleteBuffer(b));
      [bArcIdx,bGlowI].forEach(b=>g.deleteBuffer(b));
      Object.values(prog).forEach(p=>g.deleteProgram(p));
      setTimeout(() => { if (!canvas.isConnected) { const ext = (g as WebGLRenderingContext | null)?.getExtension?.("WEBGL_lose_context"); ext?.loseContext(); } }, 0);
    };
  }, [quality]);

  return (
    <canvas
      ref={canvasRef}
      className={`omni-entity-canvas ${className}`}
      role="img"
      aria-label="OmniAI — particle sphere"
      draggable={false}
      style={{ display:"block", width:"100%", height:"100%", touchAction:"none", cursor:"grab" }}
    />
  );
}
