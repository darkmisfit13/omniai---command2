"use client";

import { useEffect, useRef } from "react";

/**
 * MatrixField — the WebGL layer under the landing hero.
 *
 * Two particle layers share one scene:
 *
 *   1. the matrix — a dense grid whose vertices bulge toward the pointer
 *      (the cursor is ray-cast onto the ground plane, so the reaction is in
 *      world space rather than a screen-space trick) and ripple along a slow
 *      travelling wave, coloured through the product palette;
 *   2. the dust — a sparse field drifting behind it for parallax depth.
 *
 * three.js is imported dynamically so the renderer — and the WebGL context it
 * wants — only ever loads in the browser, after the hero has painted. If no
 * context can be created the hero keeps its static gradient and the rest of
 * the page is unaffected.
 */

type ThreeModule = typeof import("three");

const VIOLET = "#6c63ff";
const MAGENTA = "#e879f9";
const EMERALD = "#6ee7b7";
const CYAN = "#00f2fe";

export default function MatrixField() {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let disposed = false;
    let teardown: (() => void) | null = null;

    void import("three")
      .then((THREE) => {
        if (disposed) return;
        try {
          teardown = buildMatrix(THREE, host);
        } catch {
          /* No WebGL context available — the hero degrades to its gradient. */
        }
      })
      .catch(() => {
        /* three.js unavailable — same graceful degrade. */
      });

    return () => {
      disposed = true;
      if (teardown) teardown();
    };
  }, []);

  return <div ref={hostRef} className="matrix-field" aria-hidden="true" />;
}

function buildMatrix(THREE: ThreeModule, host: HTMLElement) {
  const {
    Scene,
    PerspectiveCamera,
    WebGLRenderer,
    BufferGeometry,
    Float32BufferAttribute,
    Points,
    PointsMaterial,
    Color,
    AdditiveBlending,
    Raycaster,
    Vector2,
    Vector3,
    Plane,
  } = THREE;

  const reducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  const renderer = new WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);

  const canvas = renderer.domElement;
  canvas.style.display = "block";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  host.appendChild(canvas);

  const scene = new Scene();
  const camera = new PerspectiveCamera(52, 1, 0.1, 160);
  camera.position.set(0, 7, 16);

  /* ---------- layer 1: the reactive matrix grid ---------- */

  const COLS = 118;
  const ROWS = 76;
  const SPAN_X = 54;
  const Z_FAR = -38;
  const Z_NEAR = 15;
  const COUNT = COLS * ROWS;

  const positions = new Float32Array(COUNT * 3);
  const colors = new Float32Array(COUNT * 3);
  const baseX = new Float32Array(COUNT);
  const baseZ = new Float32Array(COUNT);
  const radius = new Float32Array(COUNT);

  const violet = new Color(VIOLET);
  const magenta = new Color(MAGENTA);
  const emerald = new Color(EMERALD);
  const cyan = new Color(CYAN);
  const tint = new Color();

  for (let k = 0; k < COUNT; k += 1) {
    const i = k % COLS;
    const j = Math.floor(k / COLS);
    const u = i / (COLS - 1);
    const v = j / (ROWS - 1);

    const x = (u - 0.5) * SPAN_X + (Math.random() - 0.5) * 0.24;
    const z = Z_FAR + (Z_NEAR - Z_FAR) * v + (Math.random() - 0.5) * 0.24;

    baseX[k] = x;
    baseZ[k] = z;
    radius[k] = Math.sqrt(x * x + z * z);

    positions[k * 3] = x;
    positions[k * 3 + 1] = 0;
    positions[k * 3 + 2] = z;

    // Electric violet body, magenta toward the right edge, cyan toward the
    // left, with a radiant emerald bloom across the far horizon.
    tint.copy(violet);
    if (u > 0.5) tint.lerp(magenta, Math.min(1, (u - 0.5) * 1.7));
    else tint.lerp(cyan, Math.min(1, (0.5 - u) * 1.1));
    tint.lerp(emerald, Math.min(1, Math.max(0, 0.55 - v) * 1.5));

    const shade = 0.5 + Math.random() * 0.5;
    colors[k * 3] = tint.r * shade;
    colors[k * 3 + 1] = tint.g * shade;
    colors[k * 3 + 2] = tint.b * shade;
  }

  const gridGeometry = new BufferGeometry();
  gridGeometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  gridGeometry.setAttribute("color", new Float32BufferAttribute(colors, 3));

  const gridMaterial = new PointsMaterial({
    size: 0.17,
    sizeAttenuation: true,
    vertexColors: true,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
    blending: AdditiveBlending,
  });

  const grid = new Points(gridGeometry, gridMaterial);
  scene.add(grid);

  /* ---------- layer 2: drifting dust for depth ---------- */

  const DUST = 640;
  const dustPositions = new Float32Array(DUST * 3);
  const dustColors = new Float32Array(DUST * 3);
  const dustPalette = [violet, magenta, emerald, cyan];

  for (let k = 0; k < DUST; k += 1) {
    dustPositions[k * 3] = (Math.random() - 0.5) * 78;
    dustPositions[k * 3 + 1] = 0.5 + Math.random() * 24;
    dustPositions[k * 3 + 2] = -46 + Math.random() * 62;

    const pick = dustPalette[Math.floor(Math.random() * dustPalette.length)];
    const shade = 0.25 + Math.random() * 0.45;
    dustColors[k * 3] = pick.r * shade;
    dustColors[k * 3 + 1] = pick.g * shade;
    dustColors[k * 3 + 2] = pick.b * shade;
  }

  const dustGeometry = new BufferGeometry();
  dustGeometry.setAttribute("position", new Float32BufferAttribute(dustPositions, 3));
  dustGeometry.setAttribute("color", new Float32BufferAttribute(dustColors, 3));

  const dustMaterial = new PointsMaterial({
    size: 0.34,
    sizeAttenuation: true,
    vertexColors: true,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
    blending: AdditiveBlending,
  });

  const dust = new Points(dustGeometry, dustMaterial);
  scene.add(dust);

  /* ---------- pointer → world-space focus ---------- */

  const ndc = new Vector2(0, 0);
  const raycaster = new Raycaster();
  const ground = new Plane(new Vector3(0, 1, 0), 0);
  const hit = new Vector3();

  const focus = { x: 0, z: -6 };
  const focusTarget = { x: 0, z: -6 };
  let amplitude = 0;
  let amplitudeTarget = 0;

  function onPointerMove(event: PointerEvent) {
    const rect = canvas.getBoundingClientRect();
    const px = (event.clientX - rect.left) / Math.max(1, rect.width);
    const py = (event.clientY - rect.top) / Math.max(1, rect.height);
    const inside = px >= 0 && px <= 1 && py >= 0 && py <= 1;

    ndc.x = Math.max(-1, Math.min(1, px * 2 - 1));
    ndc.y = Math.max(-1, Math.min(1, 1 - py * 2));

    if (!inside) {
      amplitudeTarget = 0.7;
      return;
    }

    raycaster.setFromCamera(ndc, camera);
    if (raycaster.ray.intersectPlane(ground, hit)) {
      focusTarget.x = Math.max(-SPAN_X / 2, Math.min(SPAN_X / 2, hit.x));
      focusTarget.z = Math.max(Z_FAR, Math.min(Z_NEAR, hit.z));
    }
    amplitudeTarget = 2.7;
  }

  function onPointerOut() {
    amplitudeTarget = 0;
  }

  /* ---------- sizing ---------- */

  function resize() {
    const width = Math.max(1, host.clientWidth);
    const height = Math.max(1, host.clientHeight);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  resize();
  const observer = new ResizeObserver(resize);
  observer.observe(host);

  /* ---------- animation ---------- */

  let frameHandle = 0;
  const started = performance.now();
  const positionAttribute = gridGeometry.attributes.position;
  const gridPositions = positionAttribute.array as Float32Array;
  const INV_SIGMA = 1 / 34;

  function paint(time: number) {
    const t = (time - started) / 1000;

    focus.x += (focusTarget.x - focus.x) * 0.085;
    focus.z += (focusTarget.z - focus.z) * 0.085;
    amplitude += (amplitudeTarget - amplitude) * 0.05;

    for (let k = 0; k < COUNT; k += 1) {
      const x = baseX[k];
      const z = baseZ[k];
      const dx = x - focus.x;
      const dz = z - focus.z;
      const d2 = dx * dx + dz * dz;

      const ripple =
        Math.sin(x * 0.23 + t * 0.7) * 0.4 +
        Math.cos(z * 0.29 - t * 0.55) * 0.34 +
        Math.sin(radius[k] * 0.3 - t * 1.05) * 0.24;

      gridPositions[k * 3 + 1] =
        ripple + (d2 < 900 ? amplitude * Math.exp(-d2 * INV_SIGMA) : 0);
    }
    positionAttribute.needsUpdate = true;

    camera.position.x += (ndc.x * 2.8 - camera.position.x) * 0.045;
    camera.position.y += (7 + ndc.y * 1.6 - camera.position.y) * 0.045;
    camera.lookAt(0, 0, -8);

    dust.rotation.y = t * 0.012 + ndc.x * 0.04;

    renderer.render(scene, camera);
  }

  function loop(time: number) {
    frameHandle = requestAnimationFrame(loop);
    if (document.hidden) return;
    paint(time);
  }

  if (reducedMotion) {
    // One composed frame, no motion: the field still reads as a matrix.
    paint(started);
  } else {
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    document.addEventListener("pointerleave", onPointerOut, true);
    frameHandle = requestAnimationFrame(loop);
  }

  /* ---------- teardown ---------- */

  return () => {
    cancelAnimationFrame(frameHandle);
    window.removeEventListener("pointermove", onPointerMove);
    document.removeEventListener("pointerleave", onPointerOut, true);
    observer.disconnect();
    gridGeometry.dispose();
    gridMaterial.dispose();
    dustGeometry.dispose();
    dustMaterial.dispose();
    renderer.dispose();
    canvas.remove();
    // Release the WebGL context only on a real unmount (StrictMode-safe).
    const loseCtx = renderer.getContext().getExtension("WEBGL_lose_context");
    setTimeout(() => { if (!host.isConnected) loseCtx?.loseContext(); }, 0);
  };
}
