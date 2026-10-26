"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

/**
 * Admin -> AI Providers (owner only).
 *
 * One console to connect or disconnect every AI provider the platform can
 * route to: chat models (Gemini, Groq, ChatGPT, Claude, Grok, Perplexity,
 * Kimi, Copilot, Lovable), media (image/video/music) and ElevenLabs speech.
 * Keys are stored encrypted server-side; this UI only ever sees which env
 * names exist, never a secret value.
 */

type ProviderRow = {
  id: string;
  label: string;
  transport: string;
  model: string | null;
  free: boolean;
  keyRequired: boolean;
  keyEnv: string | null;
  keyConfigured: boolean;
  keySource: "env" | "app" | null;
  endpoint: string | null;
  docs: string | null;
  ready: boolean;
  enabled: boolean;
  capabilities: string[];
};

type Catalog = {
  ownerEnvConfigured: boolean;
  storage: { keySecretConfigured: boolean };
  settingsTableAvailable: boolean;
  providers: ProviderRow[];
};

type TestState = { busy: boolean; ok?: boolean; message?: string };

const GROUPS: { key: string; title: string; accent: string; blurb: string }[] = [
  { key: "chat", title: "Chat & Reasoning", accent: "#a69eff", blurb: "Powers the AI Director, lyrics and studio text tools." },
  { key: "image", title: "Image", accent: "#00f2fe", blurb: "Omni Imagine pipeline." },
  { key: "video", title: "Video", accent: "#e879f9", blurb: "Video studio pipeline." },
  { key: "music", title: "Music", accent: "#ffb84d", blurb: "OmniWave song generation." },
  { key: "voice", title: "Voice & Speech", accent: "#6ee7b7", blurb: "ElevenLabs TTS for voiceovers and Voice Studio." },
];

const MEDIA_TEST_PIPELINE: Record<string, string> = {
  image: "image",
  video: "video",
  music: "music",
  voice: "voice",
};

function errorText(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export default function ProviderConsole() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [restricted, setRestricted] = useState(false);
  const [setupNote, setSetupNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);
  const [tests, setTests] = useState<Record<string, TestState>>({});

  const requireSession = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token ?? null;
    if (!token) throw new Error("Sign in to manage providers.");
    return token;
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSetupNote(null);
    try {
      const token = await requireSession();
      const response = await fetch("/api/admin/providers", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
      } & Partial<Catalog>;
      if (response.status === 403) {
        setRestricted(true);
        setLoading(false);
        return;
      }
      if (!response.ok || !payload.providers) {
        throw new Error(payload.error ?? `Could not load providers (HTTP ${response.status}).`);
      }
      setRestricted(false);
      if (!payload.storage?.keySecretConfigured) {
        setSetupNote(
          "In-app key storage is off: set OMNIAI_KEY_SECRET in your environment (Vercel → Settings → Environment Variables) so saved keys are encrypted at rest, then redeploy."
        );
      } else if (!payload.ownerEnvConfigured) {
        setSetupNote(
          "OMNIAI_OWNER_ID is not set, so the owner gates are closed for everyone. Set it to your Supabase user id to unlock key saving and provider tests."
        );
      } else if (!payload.settingsTableAvailable) {
        setSetupNote(
          "Provider switches are unavailable until the 20261017130000_add_provider_settings migration is run in the Supabase SQL editor. Keys still save and connect normally."
        );
      }
      setCatalog(payload as Catalog);
    } catch (loadError) {
      setError(errorText(loadError, "Could not load the provider catalog."));
    } finally {
      setLoading(false);
    }
  }, [requireSession]);

  useEffect(() => {
    void load();
  }, [load]);

  const grouped = useMemo(() => {
    const map = new Map<string, ProviderRow[]>();
    for (const group of GROUPS) map.set(group.key, []);
    for (const provider of catalog?.providers ?? []) {
      const primary =
        GROUPS.find((group) => provider.capabilities.includes(group.key))?.key ?? "chat";
      map.get(primary)?.push(provider);
    }
    return map;
  }, [catalog]);

  const connectedCount = useMemo(
    () => (catalog?.providers ?? []).filter((provider) => provider.keyConfigured && provider.enabled).length,
    [catalog]
  );

  async function saveKey(envName: string) {
    const value = (drafts[envName] ?? "").trim();
    if (!value) return;
    setSavingKey(envName);
    setError(null);
    setNotice(null);
    try {
      const token = await requireSession();
      const response = await fetch("/api/generate/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ envName, value }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Could not save the key.");
      setDrafts((previous) => ({ ...previous, [envName]: "" }));
      setNotice(`Saved ${envName}. The provider is connected.`);
      await load();
    } catch (saveError) {
      setError(errorText(saveError, "Could not save the key."));
    } finally {
      setSavingKey(null);
    }
  }

  async function removeKey(envName: string) {
    setSavingKey(envName);
    setError(null);
    setNotice(null);
    try {
      const token = await requireSession();
      const response = await fetch("/api/generate/keys", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ envName }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Could not remove the key.");
      setNotice(`Removed ${envName}. The provider is disconnected.`);
      await load();
    } catch (removeError) {
      setError(errorText(removeError, "Could not remove the key."));
    } finally {
      setSavingKey(null);
    }
  }

  async function toggleProvider(provider: ProviderRow) {
    setToggling(provider.id);
    setError(null);
    setNotice(null);
    try {
      const token = await requireSession();
      const response = await fetch("/api/admin/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ providerId: provider.id, enabled: !provider.enabled }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Could not flip the switch.");
      setNotice(`${provider.label} is now ${!provider.enabled ? "enabled" : "paused"}.`);
      await load();
    } catch (toggleError) {
      setError(errorText(toggleError, "Could not flip the switch."));
    } finally {
      setToggling(null);
    }
  }

  async function testProvider(provider: ProviderRow) {
    setTests((previous) => ({ ...previous, [provider.id]: { busy: true } }));
    setError(null);
    setNotice(null);
    try {
      const token = await requireSession();
      const chatCapable = provider.capabilities.includes("chat");
      const mediaCapable = provider.capabilities.find((capability) => capability in MEDIA_TEST_PIPELINE);

      const response = chatCapable
        ? await fetch("/api/ai/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ provider: provider.id, prompt: "Reply with exactly the word: OK" }),
          })
        : await fetch("/api/generate/providers", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ pipeline: MEDIA_TEST_PIPELINE[mediaCapable ?? "image"], provider: provider.id }),
          });

      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        text?: string;
        message?: string;
        latencyMs?: number;
      };

      if (!response.ok || payload.ok === false) {
        setTests((previous) => ({
          ...previous,
          [provider.id]: {
            busy: false,
            ok: false,
            message: payload.message ?? payload.error ?? `HTTP ${response.status}`,
          },
        }));
        return;
      }

      const summary = chatCapable
        ? `${provider.label} answered${payload.latencyMs ? ` in ${payload.latencyMs}ms` : ""}: ${String(payload.text ?? "").slice(0, 80)}`
        : `${provider.label} generated a test ${MEDIA_TEST_PIPELINE[mediaCapable ?? "image"]}${payload.latencyMs ? ` in ${payload.latencyMs}ms` : ""}.`;
      setTests((previous) => ({
        ...previous,
        [provider.id]: { busy: false, ok: true, message: summary },
      }));
    } catch (testError) {
      setTests((previous) => ({
        ...previous,
        [provider.id]: { busy: false, ok: false, message: errorText(testError, "Test failed.") },
      }));
    }
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-[#211d34] bg-[#14121f] p-6 text-sm text-[#8b86a8]">
        Loading provider console…
      </div>
    );
  }

  if (restricted) {
    return (
      <div className="rounded-xl border border-[#211d34] bg-[#14121f] p-6">
        <p className="text-sm font-semibold text-[#e8e6f2]">Owner access only</p>
        <p className="mt-1 text-xs text-[#8b86a8]">
          Provider keys are the platform&apos;s crown jewels — this console is limited to the
          verified owner (OMNIAI_OWNER_ID).
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-[#211d34] bg-[#14121f] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="pilot-voice text-sm font-semibold text-[#e8e6f2]">AI Provider Console</h2>
            <p className="mt-1 text-xs text-[#8b86a8]">
              Connect or disconnect every provider your customers generate with. Keys are stored
              encrypted server-side and are never shown again after saving.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-[#23331f] bg-[#16221a] px-3 py-1 text-[10px] font-semibold tracking-wide text-[#6ee7b7]">
              {connectedCount} CONNECTED
            </span>
            <button
              onClick={() => void load()}
              className="d3-btn h-7 px-3 text-[10px]"
              disabled={loading}
            >
              Refresh
            </button>
          </div>
        </div>
        {setupNote ? (
          <p className="mt-3 rounded-lg border border-[#3a3020] bg-[#1d1810] px-3 py-2 text-[11px] text-[#ffb84d]">
            {setupNote}
          </p>
        ) : null}
        {error ? (
          <p className="mt-3 rounded-lg border border-[#3d2230] bg-[#1d1018] px-3 py-2 text-[11px] text-[#fda4af]">
            {error}
          </p>
        ) : null}
        {notice ? (
          <p className="mt-3 rounded-lg border border-[#23331f] bg-[#16221a] px-3 py-2 text-[11px] text-[#6ee7b7]">
            {notice}
          </p>
        ) : null}
      </div>

      {GROUPS.map((group) => {
        const providers = grouped.get(group.key) ?? [];
        if (providers.length === 0) return null;
        return (
          <section key={group.key}>
            <div className="mb-3 flex items-baseline gap-3">
              <h3
                className="text-xs font-semibold tracking-[0.2em] uppercase"
                style={{ color: group.accent }}
              >
                {group.title}
              </h3>
              <span className="text-[11px] text-[#8b86a8]">{group.blurb}</span>
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              {providers.map((provider) => {
                const test = tests[provider.id];
                const envName = provider.keyEnv;
                return (
                  <div
                    key={provider.id}
                    className="rounded-xl border bg-[#14121f] p-4"
                    style={{ borderColor: provider.enabled ? "#211d34" : "#1b1926" , opacity: provider.enabled ? 1 : 0.65 }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[#e8e6f2]">{provider.label}</p>
                        <p className="mt-0.5 truncate font-mono text-[10px] text-[#8b86a8]">
                          {envName ?? "no key required"}
                          {provider.model ? ` · ${provider.model}` : ""}
                        </p>
                      </div>
                      <button
                        onClick={() => void toggleProvider(provider)}
                        disabled={toggling === provider.id}
                        className="d3-btn h-6 shrink-0 px-2 text-[10px]"
                        title={provider.enabled ? "Pause this provider" : "Resume this provider"}
                      >
                        {toggling === provider.id
                          ? "…"
                          : provider.enabled
                            ? "Disable"
                            : "Enable"}
                      </button>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {provider.capabilities.map((capability) => (
                        <span
                          key={capability}
                          className="rounded px-1.5 py-0.5 text-[9px] font-semibold tracking-wide uppercase"
                          style={{
                            background: "#1b1a2b",
                            color: GROUPS.find((entry) => entry.key === capability)?.accent ?? "#8b86a8",
                          }}
                        >
                          {capability}
                        </span>
                      ))}
                      <span
                        className="rounded px-1.5 py-0.5 text-[9px] font-semibold tracking-wide"
                        style={
                          !provider.enabled
                            ? { background: "#1b1926", color: "#8b86a8" }
                            : provider.keySource === "env"
                              ? { background: "#16221a", color: "#6ee7b7" }
                              : provider.keyConfigured
                                ? { background: "#1c1836", color: "#a69eff" }
                                : { background: "#1d1018", color: "#fda4af" }
                        }
                      >
                        {!provider.enabled
                          ? "PAUSED"
                          : provider.keySource === "env"
                            ? "SERVER ENV"
                            : provider.keyConfigured
                              ? "SAVED IN APP"
                              : "NOT CONNECTED"}
                      </span>
                      {provider.free ? (
                        <span className="rounded bg-[#16221a] px-1.5 py-0.5 text-[9px] font-semibold text-[#6ee7b7]">
                          FREE TIER
                        </span>
                      ) : null}
                    </div>

                    {envName ? (
                      <div className="mt-3">
                        <div className="flex gap-2">
                          <input
                            type="password"
                            value={drafts[envName] ?? ""}
                            onChange={(event) =>
                              setDrafts((previous) => ({ ...previous, [envName]: event.target.value }))
                            }
                            placeholder={
                              provider.keyConfigured
                                ? "Paste a new key to replace it…"
                                : `Paste your ${envName}…`
                            }
                            className="h-8 min-w-0 flex-1 rounded-lg border border-[#211d34] bg-[#0b0a14] px-3 font-mono text-[11px] text-[#e8e6f2] outline-none focus:border-[#6c63ff]"
                          />
                          <button
                            onClick={() => void saveKey(envName)}
                            disabled={savingKey === envName || !(drafts[envName] ?? "").trim()}
                            className="d3-btn d3-btn--primary h-8 px-3 text-[10px]"
                          >
                            {savingKey === envName ? "…" : provider.keyConfigured ? "Replace" : "Connect"}
                          </button>
                          {provider.keyConfigured && provider.keySource === "app" ? (
                            <button
                              onClick={() => void removeKey(envName)}
                              disabled={savingKey === envName}
                              className="d3-btn h-8 px-3 text-[10px]"
                            >
                              Disconnect
                            </button>
                          ) : null}
                        </div>
                        {provider.keySource === "env" ? (
                          <p className="mt-1 text-[10px] text-[#8b86a8]">
                            Key comes from the server environment ({envName}); a stored value never
                            shadows it.
                          </p>
                        ) : null}
                      </div>
                    ) : (
                      <p className="mt-3 text-[10px] text-[#8b86a8]">
                        Keyless — works without credentials.
                      </p>
                    )}

                    <div className="mt-3 flex items-center justify-between gap-2">
                      {provider.docs ? (
                        <a
                          href={provider.docs}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[10px] text-[#6c63ff] hover:underline"
                        >
                          Get a key ↗
                        </a>
                      ) : (
                        <span />
                      )}
                      <button
                        onClick={() => void testProvider(provider)}
                        disabled={test?.busy || !provider.keyConfigured}
                        className="d3-btn h-7 px-3 text-[10px]"
                        title={provider.keyConfigured ? "Send one minimal real request" : "Connect a key first"}
                      >
                        {test?.busy
                          ? "Testing…"
                          : `Test ${provider.capabilities.includes("chat") ? "chat" : provider.capabilities.find((capability) => capability in MEDIA_TEST_PIPELINE) ?? ""}`}
                      </button>
                    </div>

                    {test?.message ? (
                      <p
                        className="mt-2 rounded-lg border px-2 py-1.5 text-[10px]"
                        style={
                          test.ok
                            ? { borderColor: "#23331f", background: "#16221a", color: "#6ee7b7" }
                            : { borderColor: "#3d2230", background: "#1d1018", color: "#fda4af" }
                        }
                      >
                        {test.message}
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
