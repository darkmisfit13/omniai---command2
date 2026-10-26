/**
 * Core Entity GLSL — separated to keep webpack bundle lean.
 *
 * Visual target: complex bilaterally-distorted particle mesh sphere
 * with plasma arcs, magenta/cyan color profile, mirror floor reflection.
 */

// ─── PARTICLE MESH (main sphere body) ────────────────────────────────────────
// The sphere surface is a point-cloud mesh. Each vertex is a point sprite.
// A Simplex-noise-based displacement makes the surface ripple and wave
// organically, creating the lumpy, non-spherical form in the reference.

export const CORE_VERT = `
precision highp float;

attribute vec3  aBase;    // base sphere position
attribute float aSeed;    // per-particle random seed
attribute float aOctave;  // which noise octave this particle uses
attribute vec3  aColor;   // per-particle base color (cyan vs magenta mix)

uniform float uTime;
uniform float uPulse;     // 0..1 state pulse intensity
uniform mat4  uMVP;
uniform float uPixRatio;

varying vec3  vColor;
varying float vBright;
varying float vDist;

// --- compact 3D value noise ---
vec3 hash3(vec3 p){
  p = fract(p * vec3(443.897,441.423,437.195));
  p += dot(p, p.yzx + 19.19);
  return fract((p.xxy + p.yzz) * p.zyx);
}

float noise3(vec3 p){
  vec3 i = floor(p), f = fract(p);
  vec3 u = f*f*(3.0-2.0*f);
  float n000=dot(hash3(i+vec3(0,0,0))*2.0-1.0,f-vec3(0,0,0));
  float n100=dot(hash3(i+vec3(1,0,0))*2.0-1.0,f-vec3(1,0,0));
  float n010=dot(hash3(i+vec3(0,1,0))*2.0-1.0,f-vec3(0,1,0));
  float n110=dot(hash3(i+vec3(1,1,0))*2.0-1.0,f-vec3(1,1,0));
  float n001=dot(hash3(i+vec3(0,0,1))*2.0-1.0,f-vec3(0,0,1));
  float n101=dot(hash3(i+vec3(1,0,1))*2.0-1.0,f-vec3(1,0,1));
  float n011=dot(hash3(i+vec3(0,1,1))*2.0-1.0,f-vec3(0,1,1));
  float n111=dot(hash3(i+vec3(1,1,1))*2.0-1.0,f-vec3(1,1,1));
  return mix(
    mix(mix(n000,n100,u.x),mix(n010,n110,u.x),u.y),
    mix(mix(n001,n101,u.x),mix(n011,n111,u.x),u.y),u.z);
}

float fbm(vec3 p, float t){
  float v=0.0, a=0.5;
  for(int i=0;i<5;i++){
    v += a * noise3(p + t * 0.28 * (float(i)+1.0));
    p *= 2.1; a *= 0.52;
  }
  return v;
}

void main(){
  // Multi-octave organic displacement — this is what makes the sphere ripple
  float t1 = uTime * 0.38 + aSeed * 6.28;
  float t2 = uTime * 0.61 + aSeed * 3.14;
  float t3 = uTime * 0.19 + aOctave * 2.72;

  // Primary ripple: fbm displacement along normal
  float disp1 = fbm(aBase * 2.3, t1) * 0.32;
  // Secondary high-freq ripple for the "rolling wave" motion
  float disp2 = fbm(aBase * 5.1 + vec3(1.7,2.3,0.8), t2) * 0.12;
  // Tertiary low-freq global pulse
  float disp3 = sin(t3 * 1.4 + aBase.y * 3.8) * 0.08 * uPulse;

  float totalDisp = disp1 + disp2 + disp3;

  vec3 pos = normalize(aBase) * (1.0 + totalDisp);

  gl_Position = uMVP * vec4(pos, 1.0);

  // Depth-based perspective point sizing
  vec4 mvPos = uMVP * vec4(pos, 1.0);
  float depth = clamp(1.0 / max(-mvPos.z * 0.35, 0.1), 0.4, 2.0);
  float sz = (1.8 + aSeed * 1.4) * depth * uPixRatio;
  // Pulse makes particles swell
  sz *= (1.0 + uPulse * 0.5);
  gl_PointSize = max(0.5, sz);

  // Color varies with displacement: cyan core, magenta peaks
  float colorT = clamp(totalDisp * 2.8 + 0.5, 0.0, 1.0);
  vColor = mix(aColor, vec3(1.0, 0.05, 0.65) * 1.3, colorT * 0.6);

  // Brightness: peaks of displacement glow brighter
  vBright = 0.5 + clamp(totalDisp * 3.0, 0.0, 1.0) * 0.5;
  vBright *= (0.7 + uPulse * 0.3);

  vDist = length(pos);
}`;

export const CORE_FRAG = `
precision highp float;
varying vec3  vColor;
varying float vBright;
varying float vDist;
void main(){
  vec2  c  = gl_PointCoord - 0.5;
  float d  = dot(c, c);
  if(d > 0.25) discard;

  float disc  = smoothstep(0.25, 0.08, d);
  float hot   = smoothstep(0.08, 0.00, d);

  vec3 col = mix(vColor * vBright, vec3(1.0), hot * 0.85);
  float alpha = (disc * 0.6 + hot * 0.4) * vBright;
  gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0));
}`;

// ─── SOLAR PROMINENCE ARCS ───────────────────────────────────────────────────
// Tube-like plasma arcs looping out of the top of the sphere.
// Each arc is a Bézier spline sampled into many point sprites.

export const ARC_VERT = `
precision highp float;
attribute vec3  aPos;       // position along arc spline
attribute float aBright;    // brightness along arc (fade at ends)
attribute float aWidth;     // point size along arc (thick in middle)
attribute float aPhase;     // for animation
attribute float aColorT;    // 0=cyan, 1=magenta

uniform float uTime;
uniform float uPulse;
uniform mat4  uMVP;
uniform float uPixRatio;

varying vec3  vCol;
varying float vB;

void main(){
  // Arcs writhe slightly over time
  float wiggle = sin(uTime * 0.9 + aPhase * 4.3) * 0.04;
  float wiggle2= cos(uTime * 1.3 + aPhase * 2.1) * 0.025;
  vec3 pos = aPos + vec3(wiggle, wiggle2 * 0.5, wiggle * 0.7);

  gl_Position = uMVP * vec4(pos, 1.0);

  vec4 mv = uMVP * vec4(pos, 1.0);
  float depth = clamp(1.0 / max(-mv.z * 0.3, 0.1), 0.3, 2.5);
  gl_PointSize = max(1.0, aWidth * depth * uPixRatio * (1.0 + uPulse * 0.6));

  vec3 cyan    = vec3(0.0, 0.85, 1.0);
  vec3 magenta = vec3(1.0, 0.06, 0.72);
  vCol = mix(cyan, magenta, aColorT) * (1.0 + uPulse * 0.4);
  vB   = aBright * (0.7 + uPulse * 0.3);
}`;

export const ARC_FRAG = `
precision highp float;
varying vec3  vCol;
varying float vB;
void main(){
  vec2  c = gl_PointCoord - 0.5;
  float d = dot(c, c);
  if(d > 0.25) discard;
  float a = smoothstep(0.25, 0.0, d) * vB;
  float hot = smoothstep(0.06, 0.0, d);
  vec3 col = mix(vCol, vec3(1.0), hot * 0.7);
  gl_FragColor = vec4(col, clamp(a, 0.0, 1.0));
}`;

// ─── MESH WIREFRAME OVERLAY ──────────────────────────────────────────────────
// Thin lines connecting surface points — visible through the particle cloud

export const WIRE_VERT = `
precision highp float;
attribute vec3  aBase;
attribute float aSeed;
attribute float aOctave;
uniform float uTime;
uniform float uPulse;
uniform mat4  uMVP;
varying float vAlpha;
varying vec3  vColor;

vec3 hash3w(vec3 p){
  p = fract(p * vec3(443.897,441.423,437.195));
  p += dot(p, p.yzx + 19.19);
  return fract((p.xxy + p.yzz) * p.zyx);
}
float noise3w(vec3 p){
  vec3 i=floor(p),f=fract(p),u=f*f*(3.0-2.0*f);
  float a=dot(hash3w(i)*2.0-1.0,f);
  float b=dot(hash3w(i+vec3(1,0,0))*2.0-1.0,f-vec3(1,0,0));
  float c_=dot(hash3w(i+vec3(0,1,0))*2.0-1.0,f-vec3(0,1,0));
  float d=dot(hash3w(i+vec3(1,1,0))*2.0-1.0,f-vec3(1,1,0));
  float e=dot(hash3w(i+vec3(0,0,1))*2.0-1.0,f-vec3(0,0,1));
  float g=dot(hash3w(i+vec3(1,0,1))*2.0-1.0,f-vec3(1,0,1));
  float h=dot(hash3w(i+vec3(0,1,1))*2.0-1.0,f-vec3(0,1,1));
  float k=dot(hash3w(i+vec3(1,1,1))*2.0-1.0,f-vec3(1,1,1));
  return mix(mix(mix(a,b,u.x),mix(c_,d,u.x),u.y),mix(mix(e,g,u.x),mix(h,k,u.x),u.y),u.z);
}

void main(){
  float t = uTime * 0.38 + aSeed * 6.28;
  float d1 = 0.0, a2 = 0.5; vec3 pp = aBase * 2.3;
  for(int i=0;i<3;i++){ d1 += a2*noise3w(pp+t*0.28*float(i+1)); pp*=2.1; a2*=0.52; }
  float d2 = noise3w(aBase * 5.1 + vec3(1.7,2.3,0.8) + uTime*0.61*aSeed*3.14) * 0.12;
  vec3 pos = normalize(aBase) * (1.0 + d1 + d2);
  gl_Position = uMVP * vec4(pos, 1.0);
  float ct = clamp((d1+d2)*2.8+0.5, 0.0, 1.0);
  vColor = mix(vec3(0.0,0.8,1.0), vec3(1.0,0.05,0.65), ct * 0.7);
  vAlpha = 0.08 + ct * 0.12;
}`;

export const WIRE_FRAG = `
precision highp float;
varying float vAlpha;
varying vec3  vColor;
void main(){
  gl_FragColor = vec4(vColor, vAlpha);
}`;

// ─── MIRROR FLOOR REFLECTION ─────────────────────────────────────────────────
// A flat quad on the floor of the chamber that renders a blurred,
// dimmed version of the entity using a colour-band approximation.

export const REFLECT_VERT = `
precision highp float;
attribute vec2 aPos;  // x,z of floor quad
uniform mat4  uMVP;
uniform float uFloorY;
varying vec2  vUV;
void main(){
  gl_Position = uMVP * vec4(aPos.x, uFloorY, aPos.y, 1.0);
  vUV = aPos * 0.5 + 0.5;
}`;

export const REFLECT_FRAG = `
precision highp float;
varying vec2  vUV;
uniform float uTime;
uniform float uPulse;
void main(){
  // Approximate the reflection as a glowing, shifting colour band
  vec2  center = vUV - vec2(0.5, 0.5);
  float dist   = length(center);

  // Radial glow — the reflection of the core
  float glow   = exp(-dist * dist * 6.0);

  // Colour shift: cyan+magenta, shifting with time
  float t      = uTime * 0.5;
  float cyanT  = 0.5 + 0.5 * sin(t + dist * 8.0);
  vec3  cyan   = vec3(0.0, 0.85, 1.0);
  vec3  magenta= vec3(1.0, 0.05, 0.72);
  vec3  col    = mix(cyan, magenta, cyanT);

  // Blur by stretching in y (foreshortening)
  float blur = 1.0 - smoothstep(0.0, 0.55, abs(center.y));
  float alpha = glow * blur * (0.25 + uPulse * 0.25);
  gl_FragColor = vec4(col * 0.7, clamp(alpha, 0.0, 1.0));
}`;

// ─── GLOW / BLOOM HALO ───────────────────────────────────────────────────────

export const HALO_VERT = `
precision highp float;
attribute vec3 aPos;
attribute vec3 aNorm;
uniform mat4   uMVP;
uniform mat3   uNM;
varying vec3   vN;
varying vec3   vV;
void main(){
  vN = normalize(uNM * aNorm);
  gl_Position = uMVP * vec4(aPos, 1.0);
  vec4 mv = uMVP * vec4(aPos, 1.0);
  vV = normalize(-mv.xyz);
}`;

export const HALO_FRAG = `
precision highp float;
varying vec3 vN;
varying vec3 vV;
uniform float uTime;
uniform float uPulse;
void main(){
  float ndv  = max(dot(normalize(vN), normalize(vV)), 0.0);
  float fres = pow(1.0 - ndv, 2.5);
  float t    = uTime * 0.4;
  float ct   = 0.5 + 0.5 * sin(t + vN.y * 4.0);
  vec3  cyan = vec3(0.0, 0.7, 1.0);
  vec3  mag  = vec3(0.9, 0.0, 0.6);
  vec3  col  = mix(cyan, mag, ct);
  float alpha= fres * (0.35 + uPulse * 0.30);
  gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0));
}`;
