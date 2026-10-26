"use client";

import {
  Component,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ErrorInfo,
  type MutableRefObject,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
} from "react";
import * as THREE from "three";
import { useDirector, type WorkspaceRequestActivity } from "@/lib/directorMode";

type Props = {
  className?: string;
  showLabel?: boolean;
  style?: CSSProperties;
};

const SIMPLEX_3D = [
  "vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }",
  "vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }",
  "vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }",
  "vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }",
  "float snoise(vec3 v) {",
  "  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);",
  "  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);",
  "  vec3 i = floor(v + dot(v, C.yyy));",
  "  vec3 x0 = v - i + dot(i, C.xxx);",
  "  vec3 g = step(x0.yzx, x0.xyz);",
  "  vec3 l = 1.0 - g;",
  "  vec3 i1 = min(g.xyz, l.zxy);",
  "  vec3 i2 = max(g.xyz, l.zxy);",
  "  vec3 x1 = x0 - i1 + C.xxx;",
  "  vec3 x2 = x0 - i2 + C.yyy;",
  "  vec3 x3 = x0 - D.yyy;",
  "  i = mod289(i);",
  "  vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));",
  "  float n_ = 0.142857142857;",
  "  vec3 ns = n_ * D.wyz - D.xzx;",
  "  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);",
  "  vec4 x_ = floor(j * ns.z);",
  "  vec4 y_ = floor(j - 7.0 * x_);",
  "  vec4 x = x_ * ns.x + ns.yyyy;",
  "  vec4 y = y_ * ns.x + ns.yyyy;",
  "  vec4 h = 1.0 - abs(x) - abs(y);",
  "  vec4 b0 = vec4(x.xy, y.xy);",
  "  vec4 b1 = vec4(x.zw, y.zw);",
  "  vec4 s0 = floor(b0) * 2.0 + 1.0;",
  "  vec4 s1 = floor(b1) * 2.0 + 1.0;",
  "  vec4 sh = -step(h, vec4(0.0));",
  "  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;",
  "  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;",
  "  vec3 p0 = vec3(a0.xy, h.x);",
  "  vec3 p1 = vec3(a0.zw, h.y);",
  "  vec3 p2 = vec3(a1.xy, h.z);",
  "  vec3 p3 = vec3(a1.zw, h.w);",
  "  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));",
  "  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;",
  "  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);",
  "  m = m * m;",
  "  return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));",
  "}",
].join("\n");

const CORE_VERTEX = SIMPLEX_3D + "\n" + [
  "uniform float uTime; uniform float uTurbulence; uniform float uRotationSpeed;",
  "varying vec3 vLocalPosition; varying vec3 vViewPosition; varying vec3 vNormalView;",
  "void main() {",
  "  vLocalPosition = position;",
  "  float drift = uTime * (0.08 + uRotationSpeed * 0.12);",
  "  float n1 = snoise(position * 3.2 + vec3(drift, -drift * 0.7, drift * 0.45));",
  "  float n2 = snoise(position * 7.4 - vec3(drift * 0.35, drift * 0.8, -drift));",
  "  vec3 displaced = position + normal * (n1 * 0.018 + n2 * 0.006) * (0.4 + uTurbulence);",
  "  vec4 mvPosition = modelViewMatrix * vec4(displaced, 1.0);",
  "  vViewPosition = -mvPosition.xyz; vNormalView = normalize(normalMatrix * normal);",
  "  gl_Position = projectionMatrix * mvPosition;",
  "}",
].join("\n");

const CORE_FRAGMENT = SIMPLEX_3D + "\n" + [
  "uniform float uTime; uniform float uPulseRate; uniform float uEnergy; uniform float uTurbulence;",
  "uniform vec2 uPointer;",
  "varying vec3 vLocalPosition; varying vec3 vViewPosition; varying vec3 vNormalView;",
  "void main() {",
  "  vec3 viewDir = normalize(vViewPosition); vec3 normalDir = normalize(vNormalView);",
  "  float fresnel = pow(1.0 - max(dot(normalDir, viewDir), 0.0), 2.2);",
  "  float n = snoise(vLocalPosition * (3.2 + uTurbulence * 1.4) + vec3(uTime * 0.11, uPointer.x * 0.65, uPointer.y * 0.55));",
  "  float detail = snoise(vLocalPosition * 9.0 - vec3(uTime * 0.18, uTime * 0.09, 0.0));",
  "  float pulse = 0.5 + 0.5 * sin(uTime * uPulseRate + n * 2.4);",
  "  float lightField = smoothstep(-0.45, 0.8, n * 0.72 + detail * 0.26 + pulse * 0.22);",
  "  vec3 deep = vec3(0.012, 0.035, 0.105); vec3 electric = vec3(0.015, 0.78, 0.98);",
  "  vec3 violet = vec3(0.28, 0.22, 0.92); vec3 teal = vec3(0.27, 0.91, 0.70);",
  "  vec3 color = mix(deep, violet, smoothstep(0.05, 0.8, lightField) * 0.48);",
  "  color = mix(color, electric, smoothstep(0.2, 0.9, lightField) * 0.78);",
  "  color = mix(color, teal, smoothstep(0.58, 0.96, fresnel + detail * 0.14) * 0.44);",
  "  float alpha = clamp((0.42 + lightField * 0.42 + fresnel * 0.34) * uEnergy, 0.0, 0.96);",
  "  gl_FragColor = vec4(color, alpha);",
  "}",
].join("\n");

const RIBBON_VERTEX = SIMPLEX_3D + "\n" + [
  "uniform float uTime; uniform float uTurbulence; uniform float uRotationSpeed;",
  "varying vec3 vLocalPosition; varying vec3 vViewPosition; varying vec3 vNormalView;",
  "void main() {",
  "  vLocalPosition = position;",
  "  float drift = uTime * (0.1 + uRotationSpeed * 0.18);",
  "  float n = snoise(position * 2.8 + vec3(drift, -drift * 0.6, drift * 0.38));",
  "  vec3 displaced = position + normal * n * (0.012 + 0.018 * uTurbulence);",
  "  vec4 mvPosition = modelViewMatrix * vec4(displaced, 1.0);",
  "  vViewPosition = -mvPosition.xyz; vNormalView = normalize(normalMatrix * normal);",
  "  gl_Position = projectionMatrix * mvPosition;",
  "}",
].join("\n");

const RIBBON_FRAGMENT = SIMPLEX_3D + "\n" + [
  "uniform float uTime; uniform float uPulseRate; uniform float uEnergy; uniform float uTurbulence;",
  "uniform vec2 uPointer;",
  "varying vec3 vLocalPosition; varying vec3 vViewPosition; varying vec3 vNormalView;",
  "void main() {",
  "  vec3 p = normalize(vLocalPosition);",
  "  float drift = uTime * (0.12 + uPulseRate * 0.025);",
  "  vec3 warp = vec3(uPointer.x * 0.75, uPointer.y * 0.65, (uPointer.x-uPointer.y) * 0.32);",
  "  float n1 = snoise(p * (4.4 + uTurbulence * 2.0) + warp + vec3(drift, -drift * 0.7, drift * 0.4));",
  "  float n2 = snoise(p * 8.3 - warp * 0.65 - vec3(drift * 0.55, 0.0, drift));",
  "  float longitude = atan(p.z, p.x); float latitude = asin(clamp(p.y, -1.0, 1.0));",
  "  float fieldA = longitude * 3.2 + latitude * 2.0 + n1 * (1.5 + uTurbulence) + drift;",
  "  float fieldB = longitude * -4.1 + latitude * 1.4 + n2 * 1.2 - drift * 0.72;",
  "  float ribbonA = pow(max(0.0, 1.0 - abs(sin(fieldA))), 12.0);",
  "  float ribbonB = pow(max(0.0, 1.0 - abs(sin(fieldB))), 18.0);",
  "  float filament = pow(max(0.0, 1.0 - abs(sin(fieldA * 1.9 + n2))), 28.0);",
  "  vec3 viewDir = normalize(vViewPosition);",
  "  float rim = pow(1.0 - max(dot(normalize(vNormalView), viewDir), 0.0), 2.8);",
  "  float pulse = 0.68 + 0.32 * sin(uTime * uPulseRate + n1 * 2.0);",
  "  vec3 electric = vec3(0.01, 0.79, 1.0); vec3 violet = vec3(0.34, 0.26, 1.0);",
  "  vec3 teal = vec3(0.31, 0.95, 0.74);",
  "  vec3 color = electric * (ribbonA * 0.78 + filament * 0.56);",
  "  color += violet * ribbonB * 0.58 + teal * rim * 0.44;",
  "  float alpha = clamp((ribbonA*0.38 + ribbonB*0.30 + filament*0.32 + rim*0.16) * pulse * uEnergy, 0.0, 0.92);",
  "  gl_FragColor = vec4(color, alpha);",
  "}",
].join("\n");

const HOST_CSS = [
  ".holo-orb-host > .holo-orb-webgl, .holo-orb-host > .holo-orb-error-boundary { position:absolute; inset:0; width:100%; height:100%; min-width:0; min-height:0; overflow:hidden; }",
  ".holo-orb-webgl canvas { display:block; width:100%; height:100%; }",
].join("\n");

const PHASE_INTENSITY: Record<WorkspaceRequestActivity["phase"], number> = {
  idle: 0.12,
  preflight: 0.3,
  security: 0.34,
  routing: 0.48,
  local_execution: 0.68,
  cloud_execution: 0.92,
  director_execution: 0.8,
  saving: 0.54,
  succeeded: 0.38,
  failed: 0.26,
  blocked: 0.16,
};

function phaseLabel(activity: WorkspaceRequestActivity): string {
  switch (activity.phase) {
    case "preflight": return "Request classified";
    case "security": return "Security check";
    case "routing": return "Request routed";
    case "local_execution": return "Streaming locally";
    case "cloud_execution": return "Streaming in cloud";
    case "director_execution": return "Streaming Director workflow";
    case "saving": return "Saving result";
    case "succeeded": return "Complete";
    case "failed": return "Request failed";
    case "blocked": return "Request blocked";
    default: return "Standing by";
  }
}

type BoundaryProps = { children: ReactNode };
type BoundaryState = { failed: boolean };

class OrbErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { failed: false };

  static getDerivedStateFromError(): BoundaryState {
    return { failed: true };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo): void {
    // Keep WebGL faults contained to this visual instrument.
  }

  render() {
    return this.state.failed ? <div className="holo-orb-error-boundary" role="status">WebGL renderer unavailable</div> : this.props.children;
  }
}

type OrbCanvasProps = {
  activity: WorkspaceRequestActivity;
  pointerRef: MutableRefObject<THREE.Vector2>;
};

function OrbCanvas({ activity, pointerRef }: OrbCanvasProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const activityRef = useRef(activity);
  const [failed, setFailed] = useState(false);
  activityRef.current = activity;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || failed) return;

    let renderer: THREE.WebGLRenderer | null = null;
    let frameId = 0;
    let disposed = false;
    let observer: ResizeObserver | null = null;
    let coreGeometry: THREE.BufferGeometry | null = null;
    let ribbonGeometry: THREE.BufferGeometry | null = null;
    let coreMaterial: THREE.ShaderMaterial | null = null;
    let ribbonMaterial: THREE.ShaderMaterial | null = null;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reducedMotion = media.matches;

    const markFailed = () => {
      if (!disposed) setFailed(true);
    };
    const onMotionChange = (event: MediaQueryListEvent) => { reducedMotion = event.matches; };

    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: "high-performance",
        failIfMajorPerformanceCaveat: true,
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      renderer.setClearColor(0x070b18, 0);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.15;
      renderer.debug.checkShaderErrors = true;
      renderer.debug.onShaderError = () => markFailed();
      renderer.domElement.setAttribute("aria-hidden", "true");
      renderer.domElement.style.cssText = "display:block;width:100%;height:100%;outline:0;pointer-events:none;";
      mount.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 20);
      camera.position.set(0, 0, 3.35);
      const rig = new THREE.Group();
      scene.add(rig);

      const makeUniforms = () => ({
        uTime: { value: 0 },
        uPulseRate: { value: 0.5 },
        uEnergy: { value: 0.5 },
        uTurbulence: { value: 0.25 },
        uRotationSpeed: { value: 0.1 },
        uPointer: { value: new THREE.Vector2(0, 0) },
      });
      const coreUniforms = makeUniforms();
      const ribbonUniforms = makeUniforms();

      coreGeometry = new THREE.IcosahedronGeometry(0.68, 5);
      coreMaterial = new THREE.ShaderMaterial({
        uniforms: coreUniforms,
        vertexShader: CORE_VERTEX,
        fragmentShader: CORE_FRAGMENT,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.FrontSide,
      });
      rig.add(new THREE.Mesh(coreGeometry, coreMaterial));

      ribbonGeometry = new THREE.SphereGeometry(0.86, 128, 96);
      ribbonMaterial = new THREE.ShaderMaterial({
        uniforms: ribbonUniforms,
        vertexShader: RIBBON_VERTEX,
        fragmentShader: RIBBON_FRAGMENT,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      });
      rig.add(new THREE.Mesh(ribbonGeometry, ribbonMaterial));

      const resize = () => {
        if (!renderer || disposed) return;
        const width = Math.max(1, mount.clientWidth);
        const height = Math.max(1, mount.clientHeight);
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      };
      resize();

      if (typeof ResizeObserver !== "undefined") {
        observer = new ResizeObserver(resize);
        observer.observe(mount);
      } else {
        window.addEventListener("resize", resize);
      }

      const onContextLost = (event: Event) => {
        event.preventDefault();
        markFailed();
      };
      renderer.domElement.addEventListener("webglcontextlost", onContextLost, false);
      media.addEventListener("change", onMotionChange);

      let previousTime = 0;
      let elapsed = 0;
      const animate = (now: number) => {
        if (disposed) return;
        frameId = window.requestAnimationFrame(animate);
        if (document.visibilityState === "hidden") return;

        try {
          const delta = previousTime === 0 ? 0 : Math.min((now - previousTime) / 1000, 0.05);
          previousTime = now;
          if (!reducedMotion) elapsed += delta;

          const current = activityRef.current;
          const intensity = PHASE_INTENSITY[current.phase];
          const isActive =
            current.phase === "preflight" ||
            current.phase === "security" ||
            current.phase === "routing" ||
            current.phase === "local_execution" ||
            current.phase === "cloud_execution" ||
            current.phase === "director_execution" ||
            current.phase === "saving";
          const requestEnd = isActive ? Date.now() : current.updatedAt;
          const requestAge = current.startedAt
            ? Math.min(Math.max(0, (requestEnd - current.startedAt) / 1000), 120)
            : 0;
          const pointer = reducedMotion ? new THREE.Vector2(0, 0) : pointerRef.current;
          const pointerStrength = Math.min(1, pointer.length());
          const pulseRate = 0.42 + intensity * 0.82 + Math.min(requestAge / 120, 1) * 0.2;
          const turbulence = 0.22 + intensity * 0.78 + pointerStrength * 0.36;
          const rotationSpeed = reducedMotion ? 0 : 0.055 + intensity * 0.31;
          const outputEnergy = Math.min(Math.log1p(current.outputCharacters) / 9, 0.22);
          const energy = Math.min(0.48 + intensity * 0.38 + outputEnergy, 1);

          for (const uniforms of [coreUniforms, ribbonUniforms]) {
            uniforms.uTime.value = elapsed;
            uniforms.uPulseRate.value = reducedMotion ? 0 : pulseRate;
            uniforms.uEnergy.value = energy;
            uniforms.uTurbulence.value = turbulence;
            uniforms.uRotationSpeed.value = rotationSpeed;
            uniforms.uPointer.value.lerp(pointer, 0.08);
          }

          rig.rotation.y += delta * rotationSpeed;
          rig.rotation.x = pointer.y * 0.16;
          rig.rotation.z = -pointer.x * 0.12;
          renderer!.render(scene, camera);
        } catch {
          markFailed();
        }
      };
      frameId = window.requestAnimationFrame(animate);

      return () => {
        disposed = true;
        window.cancelAnimationFrame(frameId);
        observer?.disconnect();
        if (!observer) window.removeEventListener("resize", resize);
        media.removeEventListener("change", onMotionChange);
        renderer?.domElement.removeEventListener("webglcontextlost", onContextLost);
        coreGeometry?.dispose();
        ribbonGeometry?.dispose();
        coreMaterial?.dispose();
        ribbonMaterial?.dispose();
        renderer?.dispose();
        if (renderer?.domElement.parentElement === mount) mount.removeChild(renderer.domElement);
      };
    } catch {
      markFailed();
      renderer?.dispose();
      return () => {
        disposed = true;
        if (renderer?.domElement.parentElement === mount) mount.removeChild(renderer.domElement);
      };
    }
  }, [failed, pointerRef]);

  if (failed) return <div className="holo-orb-error-boundary" role="status">WebGL renderer unavailable</div>;
  return <div ref={mountRef} className="holo-orb-webgl" aria-hidden="true" />;
}

export default function HoloOrb({ className = "", showLabel = true, style }: Props) {
  const { requestActivity } = useDirector();
  const pointerRef = useRef(new THREE.Vector2(0, 0));
  const [pointerActive, setPointerActive] = useState(false);
  const pointerActiveRef = useRef(false);
  const label = phaseLabel(requestActivity);
  const lifecyclePhase = requestActivity.phase === "preflight" ? "classified" : requestActivity.phase === "routing" ? "routed" : requestActivity.phase === "local_execution" || requestActivity.phase === "cloud_execution" || requestActivity.phase === "director_execution" ? "streaming" : requestActivity.phase;

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) return;
    const x = Math.max(-1, Math.min(1, ((event.clientX - bounds.left) / bounds.width) * 2 - 1));
    const y = Math.max(-1, Math.min(1, ((event.clientY - bounds.top) / bounds.height) * 2 - 1));
    pointerRef.current.set(x, y);
    if (!pointerActiveRef.current) {
      pointerActiveRef.current = true;
      setPointerActive(true);
    }
  };

  const onPointerLeave = () => {
    pointerRef.current.set(0, 0);
    pointerActiveRef.current = false;
    setPointerActive(false);
  };

  return (
    <div
      className={["holo-orb-host", className].filter(Boolean).join(" ")}
      data-phase={requestActivity.phase}
      data-lifecycle-phase={lifecyclePhase}
      data-pointer={pointerActive ? "active" : "idle"}
      role="img"
      aria-label={"OmniAI activity core: " + label}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      style={{
        ...style,
        position: "relative",
        isolation: "isolate",
        display: "block",
        minWidth: 0,
        minHeight: 0,
        width: "100%",
        height: "100%",
        maxWidth: "100%",
        maxHeight: "100%",
        overflow: "hidden",
        contain: "layout paint",
        boxSizing: "border-box",
        background: "radial-gradient(circle at 50% 48%, rgba(0,242,254,0.08), rgba(7,11,24,0.96) 68%)",
      }}
    >
      <style>{HOST_CSS}</style>
      <OrbErrorBoundary>
        <OrbCanvas activity={requestActivity} pointerRef={pointerRef} />
      </OrbErrorBoundary>
      {showLabel && (
        <span
          className="holo-orb-label dms-mono"
          role="status"
          aria-live="polite"
          style={{
            position: "absolute",
            zIndex: 2,
            left: 8,
            right: 8,
            bottom: 6,
            overflow: "hidden",
            color: "#b9efff",
            fontSize: 10,
            letterSpacing: "0.12em",
            textAlign: "center",
            textOverflow: "ellipsis",
            textTransform: "uppercase",
            whiteSpace: "nowrap",
            textShadow: "0 0 12px rgba(0,242,254,0.52)",
            pointerEvents: "none",
          }}
        >
          {label}
        </span>
      )}
    </div>
  );
}
