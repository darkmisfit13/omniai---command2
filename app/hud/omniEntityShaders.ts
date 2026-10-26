/**
 * OmniAI Orb — GLSL shader sources
 *
 * Kept separate from the scene setup so webpack does not OOM trying to
 * bundle one giant template-literal string.
 *
 * Visual target (reference image):
 *   • Transparent sphere defined by random great-circle arc lines (ice blue)
 *   • Bright white star-burst node hotspots at arc intersections
 *   • Interior atmospheric volumetric glow (blue-white, brighter at top)
 *   • Long radial energy streaks shooting outward (blue + amber accents)
 *   • Fine sparkle particle field on the surface
 *   • Deep navy background
 */

// ─────────────────────────────────────────────────────────────────────────────
// ARC LINES  (great-circle segments on the sphere cage)
// ─────────────────────────────────────────────────────────────────────────────

export const ARC_VERT = `
precision highp float;
attribute vec3  aPos;
attribute float aBright;
uniform   mat4  uMVP;
uniform   float uTime;
uniform   float uPulse; // 0..1 overall activity pulse
varying   float vBright;
void main(){
  gl_Position = uMVP * vec4(aPos, 1.0);
  // travelling shimmer along each line
  float shimmer = 0.7 + 0.3 * sin(uTime * 1.8 + aBright * 12.56);
  vBright = aBright * shimmer * (0.55 + uPulse * 0.45);
}`;

export const ARC_FRAG = `
precision highp float;
varying float vBright;
void main(){
  // ice-blue / white arc lines — matches the reference sphere cage
  vec3 iceBlue = vec3(0.62, 0.88, 1.00);
  vec3 white   = vec3(0.94, 0.97, 1.00);
  vec3 col = mix(iceBlue, white, vBright * vBright);
  float a = vBright * 0.70;
  gl_FragColor = vec4(col, clamp(a, 0.0, 1.0));
}`;

// ─────────────────────────────────────────────────────────────────────────────
// NODE SPARKLES  (bright star-burst hotspots on the sphere surface)
// ─────────────────────────────────────────────────────────────────────────────

export const NODE_VERT = `
precision highp float;
attribute vec3  aPos;
attribute float aSize;
attribute float aPhase;
uniform   mat4  uMVP;
uniform   float uTime;
uniform   float uPulse;
uniform   float uPixelRatio;
varying   float vBright;
varying   float vPhase;
void main(){
  gl_Position  = uMVP * vec4(aPos, 1.0);
  float flick  = 0.6 + 0.4 * sin(uTime * 2.2 + aPhase);
  vBright      = flick * (0.7 + uPulse * 0.3);
  vPhase       = aPhase;
  gl_PointSize = aSize * uPixelRatio * vBright;
}`;

export const NODE_FRAG = `
precision highp float;
varying float vBright;
varying float vPhase;
void main(){
  vec2  c = gl_PointCoord - 0.5;
  float d = dot(c, c);
  if(d > 0.25) discard;

  // 4-point star: brighter on the cardinal axes
  float star = max(abs(c.x), abs(c.y));
  float cross4 = 1.0 - smoothstep(0.0, 0.08, star) * smoothstep(0.0, 0.08, d);

  // soft disc falloff
  float disc = smoothstep(0.25, 0.0, d);
  float hot  = smoothstep(0.06, 0.0, d);

  // node colour: white centre, ice-blue mid, violet outer bloom
  vec3 white   = vec3(1.00, 1.00, 1.00);
  vec3 iceBlue = vec3(0.55, 0.85, 1.00);
  vec3 violet  = vec3(0.60, 0.35, 1.00);

  vec3 col = mix(violet, iceBlue, disc);
  col = mix(col, white, hot + cross4 * 0.6);

  float alpha = (disc * 0.50 + hot * 0.50 + cross4 * 0.25) * vBright;
  gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0));
}`;

// ─────────────────────────────────────────────────────────────────────────────
// INTERIOR GLOW  (BackSide sphere — volumetric atmosphere)
// ─────────────────────────────────────────────────────────────────────────────

export const GLOW_VERT = `
precision highp float;
attribute vec3 aPos;
attribute vec3 aNorm;
uniform   mat4 uMVP;
uniform   mat3 uNM;
uniform   float uTime;
varying   vec3  vN;
varying   vec3  vV;
varying   vec3  vWorld;
void main(){
  vN     = normalize(uNM * aNorm);
  vec4 p = uMVP * vec4(aPos, 1.0);
  vV     = normalize(vec3(0.0, 0.0, 1.0)); // approximate view dir
  vWorld = aPos;
  gl_Position = p;
}`;

export const GLOW_FRAG = `
precision highp float;
varying vec3 vN;
varying vec3 vV;
varying vec3 vWorld;
uniform float uTime;
uniform float uPulse;
uniform float uIntensity;
void main(){
  float ndv  = max(dot(normalize(vN), normalize(vV)), 0.0);
  // Fresnel: bright rim, dim centre — creates the "glowing from inside" look
  float rim  = pow(1.0 - ndv, 2.0);
  float fill = pow(ndv, 0.5) * 0.22;

  // reference: blue-white brighter near top of sphere
  vec3 coreBlue = vec3(0.55, 0.82, 1.00);
  vec3 midViolet= vec3(0.38, 0.22, 0.88);
  vec3 deepBlue = vec3(0.08, 0.10, 0.45);

  float yBias = (vWorld.y + 1.0) * 0.5; // 0=bottom, 1=top
  vec3  col   = mix(deepBlue, mix(midViolet, coreBlue, 0.6), yBias * 0.8 + rim * 0.4);

  // slow internal swirl
  float swirl = 0.5 + 0.5 * sin(vWorld.x * 3.1 + uTime * 0.4)
                         * cos(vWorld.y * 2.7 + uTime * 0.3);
  col = mix(col, coreBlue, swirl * 0.18 * uPulse);

  float alpha = (rim * 0.75 + fill) * uIntensity;
  gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0));
}`;

// ─────────────────────────────────────────────────────────────────────────────
// RADIAL STREAKS  (long lines radiating outward from the sphere)
// ─────────────────────────────────────────────────────────────────────────────

export const STREAK_VERT = `
precision highp float;
attribute vec3  aDir;      // unit direction
attribute float aT;        // 0=inner tip (at sphere), 1=outer tip
attribute float aLen;      // streak length multiplier
attribute float aPhase;
attribute float aAmber;    // 0=blue-violet, 1=amber accent
uniform   mat4  uMVP;
uniform   float uTime;
uniform   float uAlpha;
varying   float vFade;
varying   float vAmber;
void main(){
  float pulse = 0.5 + 0.5 * sin(uTime * 1.6 + aPhase);
  float len   = aLen * (0.55 + pulse * 0.45);
  // aT=0 starts at sphere surface (r=1), aT=1 is the outer tip
  vec3  pos   = aDir * (1.02 + aT * len);
  gl_Position = uMVP * vec4(pos, 1.0);
  // bright near sphere, fade to nothing at tip
  vFade  = pow(1.0 - aT, 1.4) * uAlpha * (0.4 + pulse * 0.6);
  vAmber = aAmber;
}`;

export const STREAK_FRAG = `
precision highp float;
varying float vFade;
varying float vAmber;
void main(){
  vec3 blue   = vec3(0.30, 0.65, 1.00);
  vec3 violet = vec3(0.55, 0.28, 1.00);
  vec3 amber  = vec3(1.00, 0.55, 0.18);
  vec3 col    = mix(mix(blue, violet, 0.4), amber, vAmber);
  gl_FragColor = vec4(col, clamp(vFade, 0.0, 1.0));
}`;

// ─────────────────────────────────────────────────────────────────────────────
// SPARKLE PARTICLES  (fine point field on/around sphere surface)
// ─────────────────────────────────────────────────────────────────────────────

export const SPARK_VERT = `
precision highp float;
attribute vec3  aPos;
attribute float aPhase;
attribute float aSize;
uniform   mat4  uMVP;
uniform   float uTime;
uniform   float uPulse;
uniform   float uPixelRatio;
varying   float vBright;
void main(){
  gl_Position  = uMVP * vec4(aPos, 1.0);
  float f      = 0.4 + 0.6 * abs(sin(uTime * 1.4 + aPhase * 6.28));
  vBright      = f * (0.5 + uPulse * 0.5);
  gl_PointSize = aSize * uPixelRatio * f;
}`;

export const SPARK_FRAG = `
precision highp float;
varying float vBright;
void main(){
  vec2  c = gl_PointCoord - 0.5;
  float d = dot(c, c);
  if(d > 0.25) discard;
  float a   = smoothstep(0.25, 0.0, d) * vBright;
  float hot = smoothstep(0.05, 0.0, d);
  vec3 col  = mix(vec3(0.55, 0.82, 1.0), vec3(1.0, 1.0, 1.0), hot);
  gl_FragColor = vec4(col, clamp(a * 0.8, 0.0, 1.0));
}`;

// ─────────────────────────────────────────────────────────────────────────────
// BACKGROUND FIELD  (ambient blue glow + orange particle dots in background)
// ─────────────────────────────────────────────────────────────────────────────

export const BG_VERT = `
precision highp float;
attribute vec2 aPos;
void main(){
  gl_Position = vec4(aPos, 0.999, 1.0);
}`;

export const BG_FRAG = `
precision highp float;
uniform vec2  uRes;
uniform float uTime;
void main(){
  vec2  uv  = gl_FragCoord.xy / uRes;
  // deep navy centre-glow matching reference background
  float d   = length(uv - vec2(0.5, 0.52));
  vec3  navy   = vec3(0.03, 0.04, 0.18);
  vec3  midBlue= vec3(0.08, 0.10, 0.38);
  vec3  col    = mix(midBlue, navy, smoothstep(0.0, 0.7, d));
  // subtle radial pulse
  float pulse  = 0.5 + 0.5 * sin(uTime * 0.3 + d * 8.0);
  col += vec3(0.02, 0.03, 0.10) * pulse * (1.0 - d * 1.4);
  gl_FragColor = vec4(col, 1.0);
}`;
