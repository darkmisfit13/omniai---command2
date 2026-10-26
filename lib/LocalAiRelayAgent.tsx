"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";

type RelayRequest = {
  requestId?: string;
  action?: string;
  prompt?: string;
};

function isLaptopApp() {
  return ["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname);
}

export default function LocalAiRelayAgent() {
  const [status, setStatus] = useState("starting");

  useEffect(() => {
    if (!isLaptopApp()) return;

    let channel: ReturnType<typeof supabase.channel> | null = null;
    let generation = 0;
    const attach = async (session: Session | null) => {
      const thisGeneration = ++generation;
      if (channel) {
        const previous = channel;
        channel = null;
        void supabase.removeChannel(previous);
      }
      if (!session?.user) {
        setStatus("sign in");
        return;
      }

      setStatus("connecting");
      const agentChannel = supabase.channel(`local-ai:${session.user.id}`, {
        config: { private: true, broadcast: { self: false }, presence: { key: session.user.id } },
      });
      channel = agentChannel;

      agentChannel.on("broadcast", { event: "request" }, async (message) => {
        const request = message?.payload as RelayRequest | undefined;
        if (
          !request ||
          typeof request.requestId !== "string" ||
          !/^[0-9a-f-]{36}$/i.test(request.requestId) ||
          !["route", "chat"].includes(String(request.action)) ||
          typeof request.prompt !== "string" ||
          request.prompt.length === 0 ||
          request.prompt.length > 80000
        ) return;

        try {
          const response = await fetch("/api/local-ai", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ action: request.action, prompt: request.prompt }),
            cache: "no-store",
          });
          const result = await response.json();
          const payload = response.ok
            ? { requestId: request.requestId, ...result }
            : { requestId: request.requestId, error: result?.error || "The laptop model request failed." };
          await agentChannel.send({
            type: "broadcast",
            event: "response",
            payload,
          }, { timeout: 10000 });
        } catch {
          await agentChannel.send({
            type: "broadcast",
            event: "response",
            payload: { requestId: request.requestId, error: "Ollama is unavailable on this laptop." },
          }, { timeout: 10000 });
        }
      });

      agentChannel.subscribe((nextStatus) => {
        if (thisGeneration !== generation) return;
        if (nextStatus === "SUBSCRIBED") {
          void agentChannel.track({ status: "ready" }).then((trackStatus) => {
            if (thisGeneration === generation) setStatus(trackStatus === "ok" ? "connected" : "offline");
          });
        }
        else if (["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(nextStatus)) setStatus("offline");
      });
    };

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      void attach(session);
    });
    void supabase.auth.getSession().then(({ data }) => attach(data.session));

    return () => {
      generation++;
      authListener.subscription.unsubscribe();
      if (channel) void supabase.removeChannel(channel);
    };
  }, []);

  if (typeof window === "undefined" || !isLaptopApp()) return null;
  const label = status === "connected" ? "Laptop link ready" : status === "sign in" ? "Sign in to connect laptop" : status === "connecting" || status === "starting" ? "Connecting laptop…" : "Laptop link offline";
  const color = status === "connected" ? "text-emerald-300" : status === "offline" ? "text-rose-300" : "text-ash";

  return (
    <div className="fixed bottom-3 right-3 z-50 rounded-full border border-ash/40 bg-void/95 px-3 py-1 text-xs shadow-lg" aria-live="polite">
      <span className={color}>● {label}</span>
    </div>
  );
}
