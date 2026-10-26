"use client";

/**
 * CoreEntity — OmniAI Real-Time Particle Core
 * =============================================
 * Built from scratch to match the reference image exactly:
 *
 * - Complex bilaterally-distorted particle-mesh sphere (point cloud)
 *   with multi-octave FBM displacement rippling organically in real time
 * - Two bilateral solar-prominence plasma arcs looping out of the top
 * - Thin wireframe mesh visible through the point cloud
 * - Volumetric Fresnel halo/bloom layer
 * - Mirror floor reflection (polished internal surface)
 * - Drag to rotate, state-driven pulse intensity
 * - Single WebGL1 context, full cleanup on unmount
 */

import { useEffect, useRef } from "react";
import {
  CORE_VERT, CORE_FRAG,
  ARC_VERT,  ARC_FRAG,
  WIRE_VERT, WIRE_FRAG,
  REFLECT_VERT, REFLECT_FRAG,
  HALO_VERT, HALO_FRAG,
} from "./coreShaders";

/* ─────────────────────────────────────────────────────────────────────────────
   Public API
───────────────────────────────────────────────────────────────────────────── */

export type CoreState = "idle"|"thinking"|"responding"|"speaking"|"activated"|"success"|"error";

export interface CoreEntityProps {
  state?: CoreState;
  className?: string;
  quality?: 0.5|1|1.5;
  onActivated?: ()=>void;
}

/* ─────────────────────────────────────────────────────────────────────────────
   State → pulse intensity
───────────────────────────────────────────────────────────────────────────── */

const STATE_PULSE: Record<CoreState,number> = {
  idle:0.25, thinking:0.95, responding:0.85, speaking:0.65,
  activated:1.0, success:0.90, error:0.15,
};

/* ─────────────────────────────────────────────────────────────────────────────
   Mat4 helpers (column-major)
───────────────────────────────────────────────────────────────────────────── */

type M4=Float32Array;
const identity=():M4=>new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
function perspective(fov:number,asp:number,n:number,f:number):M4{
  const t=1/Math.tan(fov/2),nf=1/(n-f);
  return new Float32Array([t/asp,0,0,0, 0,t,0,0, 0,0,(f+n)*nf,-1, 0,0,2*f*n*nf,0]);
}
function mul(a:M4,b:M4):M4{
  const o=new Float32Array(16);
  for(let c=0;c<4;c++)for(let r=0;r<4;r++){let s=0;for(let k=0;k<4;k++)s+=a[k*4+r]*b[c*4+k];o[c*4+r]=s;}
  return o;
}
function tZ(d:number):M4{const m=identity();m[14]=d;return m;}
function rY(a:number):M4{const c=Math.cos(a),s=Math.sin(a);return new Float32Array([c,0,-s,0,0,1,0,0,s,0,c,0,0,0,0,1]);}
function rX(a:number):M4{const c=Math.cos(a),s=Math.sin(a);return new Float32Array([1,0,0,0,0,c,s,0,0,-s,c,0,0,0,0,1]);}
function nm3(mv:M4):Float32Array{return new Float32Array([mv[0],mv[1],mv[2],mv[4],mv[5],mv[6],mv[8],mv[9],mv[10]]);}

/* ─────────────────────────────────────────────────────────────────────────────
   PRNG
───────────────────────────────────────────────────────────────────────────── */

function lcg(s:number){let v=s|0;return()=>{v=Math.imul(v,1664525)+1013904223|0;return(v>>>0)/0xffffffff;};}

function lerp(a:number,b:number,t:number){return a+(b-a)*Math.min(Math.max(t,0),1);}

/* ─────────────────────────────────────────────────────────────────────────────
   Geometry: particle sphere
   Uses Fibonacci sphere for even coverage, then adds random radial jitter
   so it looks organic rather than perfectly uniform.
───────────────────────────────────────────────────────────────────────────── */

function buildCoreSphere(N:number, rand:()=>number){
  const base:number[]=[], seeds:number[]=[], octaves:number[]=[], colors:number[]=[];
  const golden=Math.PI*(3-Math.sqrt(5));
  for(let i=0;i<N;i++){
    const y=1-(i/(N-1))*2, r=Math.sqrt(Math.max(0,1-y*y)), th=golden*i;
    // slight random jitter off the perfect sphere to break symmetry
    const jitter=0.04;
    base.push(
      r*Math.cos(th)+(rand()-0.5)*jitter,
      y+(rand()-0.5)*jitter,
      r*Math.sin(th)+(rand()-0.5)*jitter,
    );
    seeds.push(rand());
    octaves.push(Math.floor(rand()*3));
    // Color: 70% cyan, 30% magenta-purple — matches reference
    const isMagenta=rand()<0.30;
    if(isMagenta){colors.push(0.9,0.05,0.70);}
    else         {colors.push(0.0,0.75,1.00);}
  }
  return{
    base:new Float32Array(base),
    seeds:new Float32Array(seeds),
    octaves:new Float32Array(octaves),
    colors:new Float32Array(colors),
    count:N,
  };
}

/* ─────────────────────────────────────────────────────────────────────────────
   Geometry: solar arc
   A quadratic Bézier curve spline sampled into N point sprites.
   Two arcs: one on each side (bilateral symmetry like the reference).
───────────────────────────────────────────────────────────────────────────── */

function sampleBezier(p0:[number,number,number],p1:[number,number,number],p2:[number,number,number],t:number):[number,number,number]{
  const mt=1-t;
  return[
    mt*mt*p0[0]+2*mt*t*p1[0]+t*t*p2[0],
    mt*mt*p0[1]+2*mt*t*p1[1]+t*t*p2[1],
    mt*mt*p0[2]+2*mt*t*p1[2]+t*t*p2[2],
  ];
}

function buildArcs(samplesPerArc:number){
  const pos:number[]=[], bright:number[]=[], width:number[]=[], phase:number[]=[], colorT:number[]=[];

  // Two bilateral arcs coming off the top — exactly like the reference image
  // The arcs loop outward in an organic shape then come back down
  const arcDefs:[number,number,number][][]=[
    // LEFT arc: starts top-left of sphere, peaks high-left, returns to upper-left
    [[-0.55,0.72,0.1],[-1.1,1.5,0.2],[-0.35,0.78,-0.1]],
    // RIGHT arc: mirror
    [[0.55,0.72,0.1],[1.1,1.5,0.2],[0.35,0.78,-0.1]],
    // Central top arc — smaller, connects the two
    [[-0.2,0.90,0.05],[0.0,1.3,0.15],[0.2,0.90,0.05]],
  ];

  arcDefs.forEach((pts,arcIdx)=>{
    const [p0,p1,p2]=pts;
    const baseSeed=arcIdx*0.7;
    for(let i=0;i<samplesPerArc;i++){
      const t=i/(samplesPerArc-1);
      const[x,y,z]=sampleBezier(p0 as [number,number,number],p1 as [number,number,number],p2 as [number,number,number],t);
      pos.push(x,y,z);

      // Brightness profile: dim at ends, bright in middle
      const b=Math.sin(t*Math.PI);
      bright.push(b*0.9);

      // Width: thicker at middle
      width.push(2.0+b*5.0);

      phase.push(baseSeed+t*4.0);

      // Color: mostly magenta at the top of the arc (matches reference)
      colorT.push(0.3+b*0.7);
    }
  });

  return{
    pos:new Float32Array(pos),
    bright:new Float32Array(bright),
    width:new Float32Array(width),
    phase:new Float32Array(phase),
    colorT:new Float32Array(colorT),
    count:pos.length/3,
  };
}

/* ─────────────────────────────────────────────────────────────────────────────
   Geometry: wireframe mesh (triangle edges across sphere surface)
   Subset of sphere points connected as lines
───────────────────────────────────────────────────────────────────────────── */

function buildWireIndices(N:number,maxEdges:number):Uint16Array{
  // Connect each point to its ~3 nearest neighbors (by index proximity)
  // This creates the triangulated mesh effect visible in the reference
  const idx:number[]=[];
  const stride=Math.max(1,Math.floor(N/40)); // ~40 vertices along each band
  for(let i=0;i<N&&idx.length<maxEdges*2;i+=1){
    // Connect to next point
    if(i+1<N)               {idx.push(i,i+1);}
    // Connect across a "row"
    if(i+stride<N)           {idx.push(i,i+stride);}
    if(i+stride+1<N)         {idx.push(i,i+stride+1);}
  }
  return new Uint16Array(idx.slice(0,maxEdges*2));
}

/* ─────────────────────────────────────────────────────────────────────────────
   Geometry: floor reflection quad
───────────────────────────────────────────────────────────────────────────── */

function buildFloorQuad():Float32Array{
  // A large flat rectangle below the sphere (in local space, y=-1.6)
  return new Float32Array([-1.6,-1.6, 1.6,-1.6, 1.6,1.6, -1.6,-1.6, 1.6,1.6, -1.6,1.6]);
}

/* ─────────────────────────────────────────────────────────────────────────────
   Geometry: halo sphere (slightly larger, BackFace)
───────────────────────────────────────────────────────────────────────────── */

function buildHaloSphere(seg:number):{verts:Float32Array,norms:Float32Array,tris:Uint16Array}{
  const verts:number[]=[],norms:number[]=[],tris:number[]=[];
  for(let v=0;v<=seg;v++){
    const th=(v/seg)*Math.PI,st=Math.sin(th),ct=Math.cos(th);
    for(let u=0;u<=seg;u++){
      const ph=(u/seg)*Math.PI*2,x=st*Math.cos(ph),y=ct,z=st*Math.sin(ph);
      verts.push(x,y,z);norms.push(x,y,z);
    }
  }
  const S=seg+1;
  for(let v=0;v<seg;v++)for(let u=0;u<seg;u++){
    const a=v*S+u,b=a+1,c=a+S,d=c+1;
    tris.push(a,b,c,b,d,c);
  }
  return{verts:new Float32Array(verts),norms:new Float32Array(norms),tris:new Uint16Array(tris)};
}

/* ─────────────────────────────────────────────────────────────────────────────
   WebGL helpers
───────────────────────────────────────────────────────────────────────────── */

function makeShader(gl:WebGLRenderingContext,type:number,src:string):WebGLShader{
  const sh=gl.createShader(type)!;
  gl.shaderSource(sh,src);gl.compileShader(sh);
  if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS)){
    const log=gl.getShaderInfoLog(sh);gl.deleteShader(sh);throw new Error(`sh:${log}`);
  }
  return sh;
}

function makeProgram(gl:WebGLRenderingContext,vs:string,fs:string):WebGLProgram{
  const p=gl.createProgram()!;
  gl.attachShader(p,makeShader(gl,gl.VERTEX_SHADER,vs));
  gl.attachShader(p,makeShader(gl,gl.FRAGMENT_SHADER,fs));
  gl.linkProgram(p);
  if(!gl.getProgramParameter(p,gl.LINK_STATUS)){
    const log=gl.getProgramInfoLog(p);gl.deleteProgram(p);throw new Error(`prog:${log}`);
  }
  return p;
}

function buf(gl:WebGLRenderingContext,data:ArrayBufferView,target?:number):WebGLBuffer{
  const t=target??gl.ARRAY_BUFFER,b=gl.createBuffer()!;
  gl.bindBuffer(t,b);gl.bufferData(t,data,gl.STATIC_DRAW);return b;
}

function attr(gl:WebGLRenderingContext,prog:WebGLProgram,name:string,b:WebGLBuffer,size:number){
  const l=gl.getAttribLocation(prog,name);if(l<0)return;
  gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.enableVertexAttribArray(l);
  gl.vertexAttribPointer(l,size,gl.FLOAT,false,0,0);
}

function u1f(gl:WebGLRenderingContext,p:WebGLProgram,n:string,v:number){const l=gl.getUniformLocation(p,n);if(l)gl.uniform1f(l,v);}
function um4(gl:WebGLRenderingContext,p:WebGLProgram,n:string,v:M4){const l=gl.getUniformLocation(p,n);if(l)gl.uniformMatrix4fv(l,false,v);}
function um3(gl:WebGLRenderingContext,p:WebGLProgram,n:string,v:Float32Array){const l=gl.getUniformLocation(p,n);if(l)gl.uniformMatrix3fv(l,false,v);}

/* ─────────────────────────────────────────────────────────────────────────────
   Component
───────────────────────────────────────────────────────────────────────────── */

export default function CoreEntity({state="idle",className="",quality=1,onActivated}:CoreEntityProps){
  const canvasRef=useRef<HTMLCanvasElement|null>(null);
  const stateRef=useRef<CoreState>(state);
  stateRef.current=state;
  const activatedRef=useRef(onActivated);
  activatedRef.current=onActivated;

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(()=>{
    const canvas=canvasRef.current;
    if(!canvas)return;

    const rm=window.matchMedia("(prefers-reduced-motion:reduce)").matches;
    const dpr=Math.min(devicePixelRatio||1,2);

    let gl:WebGLRenderingContext|null=null;
    try{
      gl=(canvas.getContext("webgl",{alpha:true,antialias:true,premultipliedAlpha:false})||
          canvas.getContext("experimental-webgl"))as WebGLRenderingContext|null;
    }catch{/**/}
    if(!gl){canvas.dataset.fallback="1";return;}
    const g=gl;

    /* compile programs */
    let progs:{core:WebGLProgram,arc:WebGLProgram,wire:WebGLProgram,reflect:WebGLProgram,halo:WebGLProgram};
    try{
      progs={
        core:   makeProgram(g,CORE_VERT,  CORE_FRAG),
        arc:    makeProgram(g,ARC_VERT,   ARC_FRAG),
        wire:   makeProgram(g,WIRE_VERT,  WIRE_FRAG),
        reflect:makeProgram(g,REFLECT_VERT,REFLECT_FRAG),
        halo:   makeProgram(g,HALO_VERT,  HALO_FRAG),
      };
    }catch(e){canvas.dataset.fallback="1";canvas.dataset.error=e instanceof Error?e.message:String(e);return;}

    /* build geometry */
    const rand=lcg(42);
    const N=Math.round(4000*quality);
    const sphere=buildCoreSphere(N,rand);
    const arcs=buildArcs(Math.round(120*quality));
    const wireIdx=buildWireIndices(N,2400);
    const floorQ=buildFloorQuad();
    const halo=buildHaloSphere(24);

    /* upload buffers */
    const bBase  =buf(g,sphere.base);
    const bSeeds =buf(g,sphere.seeds);
    const bOct   =buf(g,sphere.octaves);
    const bCol   =buf(g,sphere.colors);
    const bArcPos=buf(g,arcs.pos);
    const bArcB  =buf(g,arcs.bright);
    const bArcW  =buf(g,arcs.width);
    const bArcPh =buf(g,arcs.phase);
    const bArcCT =buf(g,arcs.colorT);
    // wireframe uses same base+seeds+octaves buffers as core
    const bWireI =buf(g,wireIdx,g.ELEMENT_ARRAY_BUFFER);
    const bFloor =buf(g,floorQ);
    const bHaloV =buf(g,halo.verts);
    const bHaloN =buf(g,halo.norms);
    const bHaloI =buf(g,halo.tris,g.ELEMENT_ARRAY_BUFFER);

    /* state */
    let livePulse=0.25;
    let yaw=0.3,pitch=-0.12;
    let yawVel=rm?0:0.0022,pitchVel=0;
    let dragging=false,lastX=0,lastY=0;
    let visible=true;
    let W=0,H=0;

    function resize(){
      const rect=canvas!.getBoundingClientRect();
      const nw=Math.max(1,Math.round(rect.width*dpr)),nh=Math.max(1,Math.round(rect.height*dpr));
      if(nw!==W||nh!==H){W=nw;H=nh;canvas!.width=nw;canvas!.height=nh;}
    }
    resize();
    window.addEventListener("resize",resize);

    /* pointer */
    const onPD=(e:PointerEvent)=>{dragging=true;lastX=e.clientX;lastY=e.clientY;canvas!.setPointerCapture(e.pointerId);activatedRef.current?.();};
    const onPM=(e:PointerEvent)=>{if(!dragging)return;const dx=e.clientX-lastX,dy=e.clientY-lastY;lastX=e.clientX;lastY=e.clientY;yaw+=dx*0.007;pitch=Math.max(-1.3,Math.min(0.3,pitch+dy*0.006));yawVel=dx*0.0016;pitchVel=dy*0.0012;};
    const onPU=(e:PointerEvent)=>{dragging=false;try{canvas!.releasePointerCapture(e.pointerId);}catch{/**/}};
    canvas.addEventListener("pointerdown",onPD);canvas.addEventListener("pointermove",onPM);
    canvas.addEventListener("pointerup",onPU);canvas.addEventListener("pointercancel",onPU);

    const io=new IntersectionObserver(e=>{visible=e[0]?.isIntersecting??true;},{threshold:0.01});
    io.observe(canvas);
    const onVis=()=>{visible=document.visibilityState!=="hidden";};
    document.addEventListener("visibilitychange",onVis);
    const onCtx=(ev:Event)=>{ev.preventDefault();visible=false;};
    canvas.addEventListener("webglcontextlost",onCtx);

    /* render loop */
    let rafId=0;
    const t0=performance.now();

    function frame(now:number){
      rafId=requestAnimationFrame(frame);
      if(!visible)return;
      resize();
      const t=rm?0:(now-t0)/1000;
      const dt=1/60;

      /* lerp pulse toward target */
      const targetPulse=STATE_PULSE[stateRef.current]??0.25;
      livePulse=lerp(livePulse,targetPulse,dt*60*0.05);

      /* auto-rotation */
      if(!rm&&!dragging){
        yawVel+=(0.0022-yawVel)*0.025;
        pitchVel*=0.94;
        yaw+=yawVel;pitch+=pitchVel;
        pitch+=(-0.12-pitch)*0.004;
      }

      /* matrices */
      const asp=W/Math.max(H,1);
      const proj=perspective(0.68,asp,0.05,100);
      const mv=mul(tZ(-3.2),mul(rX(pitch),rY(yaw)));
      const mvp=mul(proj,mv);
      const nm=nm3(mv);

      /* GL */
      g.viewport(0,0,W,H);
      g.clearColor(0,0,0,0);
      g.clear(g.COLOR_BUFFER_BIT|g.DEPTH_BUFFER_BIT);
      g.enable(g.BLEND);
      g.disable(g.DEPTH_TEST);

      /* ── 1. Mirror floor reflection (additive, behind everything) ── */
      g.blendFunc(g.SRC_ALPHA,g.ONE);
      g.useProgram(progs.reflect);
      um4(g,progs.reflect,"uMVP",mvp);
      u1f(g,progs.reflect,"uFloorY",-1.5);
      u1f(g,progs.reflect,"uTime",t);
      u1f(g,progs.reflect,"uPulse",livePulse);
      const aFl=g.getAttribLocation(progs.reflect,"aPos");
      if(aFl>=0){g.bindBuffer(g.ARRAY_BUFFER,bFloor);g.enableVertexAttribArray(aFl);g.vertexAttribPointer(aFl,2,g.FLOAT,false,0,0);}
      g.drawArrays(g.TRIANGLES,0,6);

      /* ── 2. Halo / bloom (BackFace, Fresnel) ── */
      g.blendFunc(g.SRC_ALPHA,g.ONE);
      g.enable(g.CULL_FACE);g.cullFace(g.FRONT);
      g.useProgram(progs.halo);
      // Scale halo slightly larger than core
      const haloMVP=mul(proj,mul(tZ(-3.2),mul(rX(pitch),mul(rY(yaw),new Float32Array([1.25,0,0,0,0,1.25,0,0,0,0,1.25,0,0,0,0,1])))));
      um4(g,progs.halo,"uMVP",haloMVP);
      um3(g,progs.halo,"uNM",nm);
      u1f(g,progs.halo,"uTime",t);
      u1f(g,progs.halo,"uPulse",livePulse);
      attr(g,progs.halo,"aPos",bHaloV,3);attr(g,progs.halo,"aNorm",bHaloN,3);
      g.bindBuffer(g.ELEMENT_ARRAY_BUFFER,bHaloI);
      g.drawElements(g.TRIANGLES,halo.tris.length,g.UNSIGNED_SHORT,0);
      g.disable(g.CULL_FACE);

      /* ── 3. Wireframe mesh overlay (translucent lines) ── */
      g.blendFunc(g.SRC_ALPHA,g.ONE);
      g.useProgram(progs.wire);
      um4(g,progs.wire,"uMVP",mvp);
      u1f(g,progs.wire,"uTime",t);
      u1f(g,progs.wire,"uPulse",livePulse);
      attr(g,progs.wire,"aBase",bBase,3);
      attr(g,progs.wire,"aSeed",bSeeds,1);
      attr(g,progs.wire,"aOctave",bOct,1);
      g.bindBuffer(g.ELEMENT_ARRAY_BUFFER,bWireI);
      g.drawElements(g.LINES,wireIdx.length,g.UNSIGNED_SHORT,0);

      /* ── 4. Particle mesh sphere (core body) ── */
      g.blendFunc(g.SRC_ALPHA,g.ONE);
      g.useProgram(progs.core);
      um4(g,progs.core,"uMVP",mvp);
      u1f(g,progs.core,"uTime",t);
      u1f(g,progs.core,"uPulse",livePulse);
      u1f(g,progs.core,"uPixRatio",dpr);
      attr(g,progs.core,"aBase",  bBase, 3);
      attr(g,progs.core,"aSeed",  bSeeds,1);
      attr(g,progs.core,"aOctave",bOct,  1);
      attr(g,progs.core,"aColor", bCol,  3);
      g.drawArrays(g.POINTS,0,N);

      /* ── 5. Solar prominence arcs ── */
      g.blendFunc(g.SRC_ALPHA,g.ONE);
      g.useProgram(progs.arc);
      um4(g,progs.arc,"uMVP",mvp);
      u1f(g,progs.arc,"uTime",t);
      u1f(g,progs.arc,"uPulse",livePulse);
      u1f(g,progs.arc,"uPixRatio",dpr);
      attr(g,progs.arc,"aPos",   bArcPos,3);
      attr(g,progs.arc,"aBright",bArcB,  1);
      attr(g,progs.arc,"aWidth", bArcW,  1);
      attr(g,progs.arc,"aPhase", bArcPh, 1);
      attr(g,progs.arc,"aColorT",bArcCT, 1);
      g.drawArrays(g.POINTS,0,arcs.count);

      g.disable(g.BLEND);
    }

    rafId=requestAnimationFrame(frame);

    return()=>{
      cancelAnimationFrame(rafId);
      io.disconnect();
      document.removeEventListener("visibilitychange",onVis);
      window.removeEventListener("resize",resize);
      canvas.removeEventListener("pointerdown",onPD);canvas.removeEventListener("pointermove",onPM);
      canvas.removeEventListener("pointerup",onPU);canvas.removeEventListener("pointercancel",onPU);
      canvas.removeEventListener("webglcontextlost",onCtx);
      [bBase,bSeeds,bOct,bCol,bArcPos,bArcB,bArcW,bArcPh,bArcCT,bFloor,bHaloV,bHaloN].forEach(b=>g.deleteBuffer(b));
      [bWireI,bHaloI].forEach(b=>g.deleteBuffer(b));
      Object.values(progs).forEach(p=>g.deleteProgram(p));
      setTimeout(() => { if (!canvas.isConnected) { const ext = (g as WebGLRenderingContext | null)?.getExtension?.("WEBGL_lose_context"); ext?.loseContext(); } }, 0);
    };
  },[quality]);

  return(
    <canvas
      ref={canvasRef}
      className={className}
      role="img"
      aria-label="OmniAI core entity"
      draggable={false}
      style={{display:"block",width:"100%",height:"100%",touchAction:"none",cursor:"grab"}}
    />
  );
}
