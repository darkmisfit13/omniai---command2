"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

/**
 * SpatialGrid - volumetric 3D coordinate grid behind studio content.
 * If WebGL is unavailable, the rest of OmniAI remains usable without this
 * decorative background effect.
 */
export default function SpatialGrid({
  intensity = 0.35,
}: {
  intensity?: number;
}) {
  const mountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const host = mountRef.current;
    if (!host) return;

    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    let renderer: THREE.WebGLRenderer;

    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: "high-performance",
        failIfMajorPerformanceCaveat: false,
        preserveDrawingBuffer: false,
      });
    } catch (error) {
      // WebGL may be disabled by a browser, sandbox, or graphics driver.
      // This grid is decorative, so leave it blank instead of crashing the app.
      if (process.env.NODE_ENV !== "production") {
        console.warn(
          "OmniAI SpatialGrid unavailable; continuing without the 3D background.",
          error
        );
      }
      return;
    }

    let raf = 0;
    let resizeObserver: ResizeObserver | null = null;
    let disposed = false;

    try {
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setClearColor(0x000000, 0);
      host.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
      camera.position.set(0, 0, 8);

      // Grid points
      const count = 1200;
      const positions = new Float32Array(count * 3);

      for (let i = 0; i < count; i++) {
        positions[i * 3] = (Math.random() - 0.5) * 16;
        positions[i * 3 + 1] = (Math.random() - 0.5) * 9;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 12;
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        "position",
        new THREE.BufferAttribute(positions, 3)
      );

      const material = new THREE.PointsMaterial({
        size: 0.05,
        color: new THREE.Color("#6c63ff"),
        transparent: true,
        opacity: 0.55,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });

      const points = new THREE.Points(geometry, material);
      scene.add(points);

      // Layered line grids
      const gridLayers: THREE.LineSegments[] = [];

      const makeGrid = (
        z: number,
        w = 16,
        h = 9,
        color = "#262038"
      ) => {
        const vertices: number[] = [];

        for (let i = -8; i <= 8; i += 2) {
          vertices.push(-w / 2, -h / 2 + i, z, w / 2, -h / 2 + i, z);
        }

        for (let j = -8; j <= 8; j += 2) {
          vertices.push(-w / 2 + j, -h / 2, z, -w / 2 + j, h / 2, z);
        }

        const gridGeometry = new THREE.BufferGeometry();
        gridGeometry.setAttribute(
          "position",
          new THREE.BufferAttribute(new Float32Array(vertices), 3)
        );

        const gridMaterial = new THREE.LineBasicMaterial({
          color,
          transparent: true,
          opacity: 0.15,
        });

        const layer = new THREE.LineSegments(
          gridGeometry,
          gridMaterial
        );

        gridLayers.push(layer);
        scene.add(layer);
      };

      for (let z = -10; z <= 10; z += 3) {
        makeGrid(z);
      }

      let mouseX = 0;
      let mouseY = 0;

      const onMove = (event: PointerEvent) => {
        const rect = host.getBoundingClientRect();

        mouseX =
          ((event.clientX - rect.left) / Math.max(rect.width, 1)) * 2 - 1;
        mouseY =
          ((event.clientY - rect.top) / Math.max(rect.height, 1)) * 2 - 1;
      };

      window.addEventListener("pointermove", onMove, { passive: true });

      const resize = () => {
        if (disposed) return;

        const width = host.clientWidth || 1;
        const height = host.clientHeight || 1;

        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height, false);
      };

      resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(host);
      resize();

      const tick = (now: number) => {
        if (disposed) return;

        const time = now * 0.001;

        points.rotation.y = time * 0.06 + mouseX * 0.18;
        points.rotation.x = mouseY * 0.08;

        gridLayers.forEach((layer) => {
          layer.position.z =
            (layer.position.z + time * 0.02 * intensity) % 12;
          layer.rotation.y = mouseX * 0.04;
        });

        camera.position.x += (mouseX * 0.6 - camera.position.x) * 0.04;
        camera.position.y += (-mouseY * 0.4 - camera.position.y) * 0.04;
        camera.lookAt(0, 0, 0);

        try {
          renderer.render(scene, camera);
        } catch (error) {
          // A lost WebGL context should not take down the workspace.
          if (process.env.NODE_ENV !== "production") {
            console.warn("OmniAI SpatialGrid stopped rendering.", error);
          }
          return;
        }

        raf = requestAnimationFrame(tick);
      };

      raf = requestAnimationFrame(tick);

      return () => {
        disposed = true;
        cancelAnimationFrame(raf);
        resizeObserver?.disconnect();
        window.removeEventListener("pointermove", onMove);

        geometry.dispose();
        material.dispose();

        gridLayers.forEach((layer) => {
          layer.geometry.dispose();

          const layerMaterial = layer.material;
          if (Array.isArray(layerMaterial)) {
            layerMaterial.forEach((item) => item.dispose());
          } else {
            layerMaterial.dispose();
          }
        });

        renderer.dispose();

        if (renderer.domElement.parentNode === host) {
          host.removeChild(renderer.domElement);
        }
      };
    } catch (error) {
      // Also clean up if initialization fails after renderer creation.
      disposed = true;
      cancelAnimationFrame(raf);
      resizeObserver?.disconnect();
      renderer.dispose();

      if (renderer.domElement.parentNode === host) {
        host.removeChild(renderer.domElement);
      }

      if (process.env.NODE_ENV !== "production") {
        console.warn(
          "OmniAI SpatialGrid could not initialize; continuing without it.",
          error
        );
      }

      return;
    }
  }, [intensity]);

  return (
    <div
      ref={mountRef}
      aria-hidden="true"
      className="spatial-grid-canvas pointer-events-none"
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        zIndex: 0,
        opacity: 0.75,
        pointerEvents: "none",
      }}
    />
  );
}
