import { offload } from "@/lib/workers/pool";
import { buildCameraPath, type CameraMode } from "./cameraGeometry";

interface PathNode { i: number; x: number; y: number; z: number; energy: number; transient: number }

/**
 * Offloads camera-path synthesis to a Web Worker (CPU isolated), falling
 * back to the synchronous main-thread implementation transparently.
 */
export async function buildCameraPathAsync(features: number[], mode: CameraMode, n = 120): Promise<PathNode[]> {
  if (typeof window === "undefined") return buildCameraPath(features, mode, n);
  try {
    const r = (await offload({ task: "buildCameraPath", payload: { features, mode, n } })) as PathNode[] | null;
    if (Array.isArray(r)) return r;
  } catch {
    // fall through
  }
  return buildCameraPath(features, mode, n);
}

export async function detectTransientsAsync(samples: number[]): Promise<{ t: number; strength: number }[]> {
  if (typeof window === "undefined") return [];
  try {
    const r = await offload({ task: "detectTransients", payload: { samples } });
    if (Array.isArray(r)) return r as { t: number; strength: number }[];
  } catch {}
  return [];
}
