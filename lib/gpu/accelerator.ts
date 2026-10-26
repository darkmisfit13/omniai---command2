/**
 * OmniAI — GPU Hardware Acceleration Helper
 * =========================================
 * Centralized WebGL context configuration that explicitly requests the
 * dedicated local GPU (high-performance power preference) and strict
 * hardware-acceleration flags, so particle sims, fluid physics and
 * glassmorphic blur computations all live on the GPU shader cores —
 * leaving the CPU free for compilation + AI swarm orchestration.
 */

export const GPU_CONTEXT_ATTRS = {
  powerPreference: "high-performance" as const,
  alpha: true,
  antialias: true,
  depth: true,
  stencil: false,
  premultipliedAlpha: false,
  preserveDrawingBuffer: false,
  failIfMajorPerformanceCaveat: false,
  desynchronized: true,
} as const;

export type GpuRenderer = WebGL2RenderingContext | WebGLRenderingContext | null;

/** Try WebGL2 first (strict hardware-accelerated), then WebGL1 fallback. */
export function getGpuContext(canvas: HTMLCanvasElement): GpuRenderer {
  try {
    const gl2 = canvas.getContext("webgl2", GPU_CONTEXT_ATTRS) as WebGL2RenderingContext | null;
    if (gl2) return gl2;
  } catch {
    // continue
  }
  try {
    return canvas.getContext("webgl", GPU_CONTEXT_ATTRS) as WebGLRenderingContext | null;
  } catch {
    return null;
  }
}

export function enableHardwareAcceleration(gl: GpuRenderer): void {
  if (!gl) return;
  try {
    gl.getExtension("WEBGL_lose_context");
  } catch {
    // ignore extension availability
  }
  // Inform the driver that the shader program is performance-critical.
  try {
    gl.hint(0x9126, 0x1101);
  } catch {
    // optional hint — no-op when unavailable
  }
}
