"use client";

import { useSyncExternalStore } from "react";

/* =========================================================================
   DARK MISFIT STUDIOS — OMNIAI - NEXUS: ORB STATE & STUDIO ENGINE
   Principal WebGL Shading & State Architecture
   
   Orb States:
     - "idle": Slow breathing circular wave with floating particle sparks
     - "thinking": Ultra-high-speed shimmering geometric frequency loop (LPU Latency-Mock)
     - "talking": Kinetic responsive audio waveform frequency visualizer matrix
========================================================================= */

export type OrbEngineState = "idle" | "thinking" | "talking";

export interface StudioVoiceMessage {
  id: string;
  sender: "user" | "omni";
  text: string;
  timestamp: number;
  actionExecuted?: string;
}

export interface OrbEngineStoreData {
  state: OrbEngineState;
  latencyMs: number;
  activeStudioContext: string;
  isOverlayOpen: boolean;
  audioFrequencies: number[];
  messages: StudioVoiceMessage[];
  isListening: boolean;
}

let storeData: OrbEngineStoreData = {
  state: "idle",
  latencyMs: 18.4,
  activeStudioContext: "Universal Matrix",
  isOverlayOpen: false,
  audioFrequencies: new Array(16).fill(0.2),
  messages: [
    {
      id: "msg-init",
      sender: "omni",
      text: "OmniAI - Nexus neural core initialized. All studio automation pipelines ready.",
      timestamp: Date.now(),
    },
  ],
  isListening: false,
};

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

// Audio frequency pulse simulation for Talking State
let audioPulseInterval: ReturnType<typeof setInterval> | null = null;

function startAudioPulse() {
  if (audioPulseInterval) clearInterval(audioPulseInterval);
  audioPulseInterval = setInterval(() => {
    if (storeData.state !== "talking") {
      if (audioPulseInterval) {
        clearInterval(audioPulseInterval);
        audioPulseInterval = null;
      }
      return;
    }
    const freqs = Array.from({ length: 16 }, () => 0.2 + Math.random() * 0.8);
    storeData = { ...storeData, audioFrequencies: freqs };
    notify();
  }, 80);
}

export const orbEngineStore = {
  getSnapshot: (): OrbEngineStoreData => storeData,

  subscribe: (listener: () => void): (() => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  setOrbState: (state: OrbEngineState, latencyMs?: number) => {
    storeData = {
      ...storeData,
      state,
      latencyMs: latencyMs ?? (state === "thinking" ? 14 + Math.random() * 12 : 18.4),
    };
    if (state === "talking") {
      startAudioPulse();
    } else if (audioPulseInterval) {
      clearInterval(audioPulseInterval);
      audioPulseInterval = null;
    }
    notify();
  },

  setActiveStudioContext: (contextName: string) => {
    storeData = {
      ...storeData,
      activeStudioContext: contextName,
    };
    notify();
  },

  setOverlayOpen: (open: boolean, studioContext?: string) => {
    storeData = {
      ...storeData,
      isOverlayOpen: open,
      activeStudioContext: studioContext || storeData.activeStudioContext,
      // When opened, immediately jump to thinking state
      state: open ? "thinking" : "idle",
      latencyMs: open ? 16.2 : 18.4,
    };
    notify();

    if (open) {
      // Auto-transition to talking greeting after 900ms thinking loop
      setTimeout(() => {
        orbEngineStore.setOrbState("talking");
        setTimeout(() => {
          if (storeData.isOverlayOpen && storeData.state === "talking") {
            orbEngineStore.setOrbState("idle");
          }
        }, 2200);
      }, 800);
    }
  },

  toggleOverlay: (studioContext?: string) => {
    orbEngineStore.setOverlayOpen(!storeData.isOverlayOpen, studioContext);
  },

  setListening: (listening: boolean) => {
    storeData = {
      ...storeData,
      isListening: listening,
      state: listening ? "thinking" : storeData.state,
    };
    notify();
  },

  executeStudioCommand: (commandText: string, customContext?: string) => {
    const context = customContext || storeData.activeStudioContext;
    const userMsg: StudioVoiceMessage = {
      id: `usr-${Date.now()}`,
      sender: "user",
      text: commandText,
      timestamp: Date.now(),
    };

    // 1. Immediately switch to high-speed Thinking shimmer loop
    storeData = {
      ...storeData,
      messages: [...storeData.messages, userMsg],
      state: "thinking",
      latencyMs: 12 + Math.random() * 10,
    };
    notify();

    // 2. Synthesize contextual action response based on active studio context
    setTimeout(() => {
      let responseText = `Executed automation command for ${context}.`;
      let actionTag = "Local Pipeline Executed";

      const lower = commandText.toLowerCase();

      if (lower.includes("erase") || lower.includes("background") || lower.includes("segment")) {
        responseText = `PyTorch BiRefNet segmentation executed. Garment silhouette isolated to alpha transparency and added to active layer stack.`;
        actionTag = "BiRefNet Alpha Masking";
      } else if (lower.includes("snap") || lower.includes("grid") || lower.includes("0.5")) {
        responseText = `Video timeline clips locked and snapped to 0.5s beat quantization grid. Keyframe drift eliminated.`;
        actionTag = "Quantization Snapping: 0.5s";
      } else if (lower.includes("camera") || lower.includes("dolly") || lower.includes("orbit")) {
        responseText = `Cinematic camera trajectory matrix injected: Orbital 360 Pan with 45° tilt and dynamic neon rim lighting.`;
        actionTag = "Camera Vector Injected";
      } else if (lower.includes("wav") || lower.includes("export") || lower.includes("audio")) {
        responseText = `Master WAV export dispatched at 48kHz / 24-bit PCM. RIFF header stream validated with 0ms phase offset.`;
        actionTag = "WAV Master Serialized";
      } else if (lower.includes("symmetry") || lower.includes("character") || lower.includes("lock")) {
        responseText = `Character Symmetry Lock engaged across all 5 reference portrait bays. Facial geometry locked against mutation drift.`;
        actionTag = "Symmetry Lock: ON";
      } else if (lower.includes("lighting") || lower.includes("cyberpunk")) {
        responseText = `Atmospheric lighting rig adjusted to Cyberpunk Neon with violet bounce and #00ffa3 key illumination.`;
        actionTag = "Shader Rig Updated";
      } else {
        responseText = `OmniAI automated workflow finished. Pipeline results synchronized to current studio sheet.`;
      }

      const omniMsg: StudioVoiceMessage = {
        id: `omni-${Date.now()}`,
        sender: "omni",
        text: responseText,
        timestamp: Date.now(),
        actionExecuted: actionTag,
      };

      storeData = {
        ...storeData,
        messages: [...storeData.messages, omniMsg],
        state: "talking",
        latencyMs: 19.8,
      };
      startAudioPulse();
      notify();

      // Return to idle after speech finishes
      setTimeout(() => {
        if (storeData.state === "talking") {
          orbEngineStore.setOrbState("idle");
        }
      }, 3500);
    }, 1100);
  },
};

export function useOrbEngine(): OrbEngineStoreData {
  return useSyncExternalStore(orbEngineStore.subscribe, orbEngineStore.getSnapshot);
}
