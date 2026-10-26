"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { VaultAsset } from "./mediaVault";

export const MEMORY_PIPE_TOPICS = {
  all: "*",
  assetRegistered: "media:vault:push",
  vaultAssets: "media:vault:assets",
  state: "memory:state",
  worker: "memory:worker",
  studioRoute: "microfrontend:route",
} as const;

export interface MemoryPipePacket<T = unknown> {
  id: string;
  topic: string;
  payload: T;
  timestamp: number;
  origin: string;
  sequence: number;
  source?: string;
}

export type MemoryPipeListener<T = unknown> = (packet: MemoryPipePacket<T>) => void;

export interface MemoryPipeOptions {
  name?: string;
  historyLimit?: number;
  enableBroadcastChannel?: boolean;
  enableWorker?: boolean;
}

const DEFAULT_HISTORY_LIMIT = 256;

function createPacketId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export class MemoryPipe {
  private readonly name: string;
  private readonly originId: string;
  private readonly historyLimit: number;
  private readonly enableBroadcastChannel: boolean;
  private readonly enableWorker: boolean;

  private sequence = 0;
  private history: MemoryPipePacket[] = [];
  private queued: MemoryPipePacket[] = [];
  private isFlushing = false;
  private listeners = new Map<string, Set<MemoryPipeListener>>();
  private globalListeners = new Set<MemoryPipeListener>();
  private state = new Map<string, unknown>();

  private broadcastChannel: BroadcastChannel | null = null;
  private worker: Worker | null = null;
  private workerResolver: ((value: unknown) => void) | null = null;

  constructor(options: MemoryPipeOptions = {}) {
    this.name = options.name ?? "omniai:memory-pipe";
    this.originId = createPacketId();
    this.historyLimit = Math.max(1, options.historyLimit ?? DEFAULT_HISTORY_LIMIT);
    this.enableBroadcastChannel = options.enableBroadcastChannel ?? true;
    this.enableWorker = options.enableWorker ?? false;

    // Deferred so the module can be imported from React without touching the
    // DOM during SSR. Heavy channels are wired explicitly by the provider.
  }

  private totalListenerCount() {
    let count = this.globalListeners.size;
    for (const set of this.listeners.values()) count += set.size;
    return count;
  }

  subscribe<T = unknown>(topic: string, listener: MemoryPipeListener<T>) {
    if (!this.listeners.has(topic)) this.listeners.set(topic, new Set());
    const set = this.listeners.get(topic)!;
    set.add(listener as MemoryPipeListener);

    return () => {
      set.delete(listener as MemoryPipeListener);
      if (set.size === 0) this.listeners.delete(topic);
    };
  }

  subscribeAll<T = unknown>(listener: MemoryPipeListener<T>) {
    this.globalListeners.add(listener as MemoryPipeListener);
    return () => {
      this.globalListeners.delete(listener as MemoryPipeListener);
    };
  }

  on = <T = unknown>(topic: string, listener: MemoryPipeListener<T>) => this.subscribe(topic, listener);

  once<T = unknown>(topic: string, listener: MemoryPipeListener<T>) {
    const unsubscribe = this.subscribe(topic, (packet) => {
      unsubscribe();
      listener(packet as MemoryPipePacket<T>);
    });
    return unsubscribe;
  }

  publish<T = unknown>(topic: string, payload: T, options: { source?: string; forceSync?: boolean } = {}) {
    const packet: MemoryPipePacket<T> = {
      id: createPacketId(),
      topic,
      payload,
      timestamp: Date.now(),
      origin: this.originId,
      sequence: ++this.sequence,
      source: options.source,
    };

    this.ingest(packet, true);

    if (options.forceSync) this.flushNow();
    return packet;
  }

  /** Low-latency alias used by background asset producers. */
  dispatch = <T = unknown>(topic: string, payload: T, source?: string) =>
    this.publish(topic, payload, { source });

  /** Read a stable last-known slice of shared state without re-rendering. */
  getState<T = unknown>(key: string): T | undefined {
    return this.state.get(key) as T | undefined;
  }

  setState<T = unknown>(key: string, value: T) {
    this.state.set(key, value);
    this.publish(MEMORY_PIPE_TOPICS.state, { key, value }, { source: "state" });
  }

  private ingest(packet: MemoryPipePacket, broadcast: boolean) {
    if (this.history.some((item) => item.id === packet.id)) return;
    this.history.push(packet);
    if (this.history.length > this.historyLimit) {
      this.history.splice(0, this.history.length - this.historyLimit);
    }
    this.queued.push(packet);

    if (broadcast && this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage(packet);
      } catch {
        // Ignore structured-clone failures for non-serializable payloads.
      }
    }

    this.scheduleFlush();
  }

  private scheduleFlush() {
    if (this.isFlushing || this.queued.length === 0) return;
    const run = () => {
      this.isFlushing = true;
      try {
        const batch = this.queued.splice(0, this.queued.length);
        for (const packet of batch) {
          this.dispatchToListeners(packet);
        }
      } finally {
        this.isFlushing = false;
        if (this.queued.length > 0) this.scheduleFlush();
      }
    };

    if (typeof queueMicrotask === "function") queueMicrotask(run);
    else setTimeout(run, 0);
  }

  private flushNow() {
    while (this.queued.length > 0 && !this.isFlushing) {
      const batch = this.queued.splice(0, this.queued.length);
      const run = () => {
        for (const packet of batch) this.dispatchToListeners(packet);
      };
      run();
    }
  }

  private dispatchToListeners(packet: MemoryPipePacket) {
    const listeners = this.listeners.get(packet.topic);
    if (listeners) {
      for (const listener of listeners) {
        try {
          listener(packet);
        } catch {
          // A single subscriber cannot stall the high-speed pipe.
        }
      }
    }

    for (const listener of this.globalListeners) {
      try {
        listener(packet);
      } catch {
        // Isolation boundary: neutralize subscriber errors.
      }
    }

    if (typeof window !== "undefined") {
      try {
        window.dispatchEvent(new CustomEvent("omniai:memory-pipe", { detail: packet }));
      } catch {
        // DOM event dispatch is optional background plumbing.
      }
    }
  }

  receive(packet: MemoryPipePacket) {
    this.ingest(packet, false);
  }

  connectBroadcastChannel() {
    if (!this.enableBroadcastChannel || typeof BroadcastChannel === "undefined" || this.broadcastChannel) {
      return this.broadcastChannel;
    }

    try {
      const channel = new BroadcastChannel(this.name);
      channel.onmessage = (event) => {
        const packet = event.data as MemoryPipePacket;
        if (!packet || packet.origin === this.originId) return;
        this.receive(packet);
      };
      this.broadcastChannel = channel;
    } catch {
      this.broadcastChannel = null;
    }
    return this.broadcastChannel;
  }

  disconnectBroadcastChannel() {
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.close();
      } catch {
        // Already closed.
      }
    }
    this.broadcastChannel = null;
  }

  connectWorker(workerCode?: string) {
    if (!this.enableWorker || typeof Worker === "undefined" || this.worker) {
      return this.worker;
    }

    try {
      const code = workerCode ?? `
        self.onmessage = function (event) {
          self.postMessage({ ok: true, received: event.data?.id ?? null, processedAt: Date.now() });
        };
      `;
      const blob = new Blob([code], { type: "text/javascript" });
      const url = URL.createObjectURL(blob);
      const worker = new Worker(url);
      worker.onmessage = (event) => {
        this.publish(MEMORY_PIPE_TOPICS.worker, event.data, { source: "worker" });
      };
      this.worker = worker;
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      this.worker = null;
    }
    return this.worker;
  }

  disconnectWorker() {
    if (this.worker) {
      try {
        this.worker.terminate();
      } catch {
        // Already terminated.
      }
    }
    this.worker = null;
  }

  offload(payload: unknown) {
    if (!this.worker) this.connectWorker();
    if (!this.worker) return false;
    try {
      this.worker.postMessage(payload);
      return true;
    } catch {
      return false;
    }
  }

  getHistory(topic?: string) {
    if (!topic || topic === MEMORY_PIPE_TOPICS.all) return [...this.history];
    return this.history.filter((packet) => packet.topic === topic);
  }

  clearHistory() {
    this.history = [];
    this.queued = [];
  }

  stats() {
    return {
      queued: this.queued.length,
      history: this.history.length,
      listeners: this.totalListenerCount(),
      stateKeys: this.state.size,
      sequence: this.sequence,
      broadcastChannel: Boolean(this.broadcastChannel),
      worker: Boolean(this.worker),
    };
  }

  async syncVault() {
    if (typeof window === "undefined") return () => {};
    let cleanup = () => {};
    try {
      const { mediaVault } = await import("./mediaVault");
      const unsubscribeVault = mediaVault.subscribe((assets: VaultAsset[]) => {
        this.publish(MEMORY_PIPE_TOPICS.vaultAssets, assets, { source: "media-vault" });
      });

      const originalPush = mediaVault.push.bind(mediaVault);
      mediaVault.push = (asset) => {
        const created = originalPush(asset);
        this.publish(MEMORY_PIPE_TOPICS.assetRegistered, created, { source: "media-vault" });
        return created;
      };

      cleanup = () => {
        unsubscribeVault();
        mediaVault.push = originalPush;
      };
    } catch {
      // Keep the memory pipe usable even when the vault module is absent.
    }
    return cleanup;
  }

  toJSON() {
    return {
      name: this.name,
      originId: this.originId,
      stats: this.stats(),
    };
  }
}

export const applicationMemoryPipe = new MemoryPipe({
  name: "omniai:application-memory-pipe",
  enableBroadcastChannel: true,
  enableWorker: true,
  historyLimit: 512,
});

export const sharedMemoryPipe = applicationMemoryPipe;
export const dataMemoryPipe = applicationMemoryPipe;

const MemoryPipeContext = createContext<MemoryPipe>(applicationMemoryPipe);

export function MemoryPipeProvider({ children }: { children: ReactNode }) {
  const pipe = applicationMemoryPipe;
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    pipe.connectBroadcastChannel();
    pipe.connectWorker();
    void pipe.syncVault().then((cleanup) => {
      cleanupRef.current = cleanup;
    });

    return () => {
      cleanupRef.current?.();
      cleanupRef.current = null;
      pipe.disconnectBroadcastChannel();
      pipe.disconnectWorker();
    };
  }, [pipe]);

  return <MemoryPipeContext.Provider value={pipe}>{children}</MemoryPipeContext.Provider>;
}

export function useMemoryPipe() {
  return useContext(MemoryPipeContext);
}

export function useSharedMemoryPipe() {
  return useMemoryPipe();
}

export function useDataMemoryPipe() {
  return useMemoryPipe();
}

export function publishToMemoryPipe<T = unknown>(topic: string, payload: T, source?: string) {
  return applicationMemoryPipe.publish(topic, payload, { source });
}

export function subscribeToMemoryPipe<T = unknown>(topic: string, listener: MemoryPipeListener<T>) {
  return applicationMemoryPipe.subscribe(topic, listener);
}