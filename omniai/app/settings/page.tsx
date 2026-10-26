"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { PromptEnhancer } from "@/app/hud/PromptEnhancer";

export default function SettingsPage() {
  const [prompt, setPrompt] = useState("");
  const [providers, setProviders] = useState<
    { name: string; enabled: boolean }[]
  >([]);
  const [cap, setCap] = useState(5);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    supabase
      .from("persona")
      .select("system_prompt")
      .single()
      .then(({ data, error }) => {
        if (error) {
          setErrorMessage("Could not load the persona settings.");
          return;
        }
        if (data) setPrompt(data.system_prompt);
      });

    supabase
      .from("providers")
      .select("*")
      .then(({ data, error }) => {
        if (error) {
          setErrorMessage("Could not load provider settings.");
          return;
        }
        if (data) setProviders(data);
      });

    supabase
      .from("spend_tracking")
      .select("cap_usd")
      .eq("day", new Date().toISOString().slice(0, 10))
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) {
          setErrorMessage("Could not load the daily spend cap.");
          return;
        }
        if (data) setCap(Number(data.cap_usd));
      });
  }, []);

  async function save() {
    if (!Number.isFinite(cap) || cap < 0) {
      setErrorMessage(
        "The daily spend cap must be a valid, non-negative number."
      );
      setSaved(false);
      return;
    }

    setSaving(true);
    setSaved(false);
    setErrorMessage("");

    try {
      const { error: personaError } = await supabase
        .from("persona")
        .update({ system_prompt: prompt })
        .eq("id", 1);

      if (personaError) {
        throw new Error("Could not save persona settings.");
      }

      for (const provider of providers) {
        const { error: providerError } = await supabase
          .from("providers")
          .update({ enabled: provider.enabled })
          .eq("name", provider.name);

        if (providerError) {
          throw new Error(`Could not save provider: ${provider.name}.`);
        }
      }

      const { error: spendError } = await supabase
        .from("spend_tracking")
        .upsert({
          day: new Date().toISOString().slice(0, 10),
          cap_usd: cap,
        });

      if (spendError) {
        throw new Error("Could not save the daily spend cap.");
      }

      setSaved(true);
    } catch (error) {
      const detail =
        error instanceof Error
          ? error.message
          : "An unexpected error occurred.";

      setErrorMessage(
        `${detail} Some changes may already have been saved. Please review your settings.`
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-xl space-y-8">
      <h2 className="pilot-voice text-2xl">Settings</h2>

      <section>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm text-ash">Persona</h3>
          <PromptEnhancer
            value={prompt}
            onApply={(next) => {
              setPrompt(next);
              setSaved(false);
            }}
            goal="the persistent system persona for a chat AI — it is the model's standing instruction, rewritten so it is clearer, more specific and more consistent"
          />
        </div>
        <textarea
          className="w-full h-32 bg-transparent border border-ash/40 rounded p-3 outline-none focus:border-signal"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />
      </section>

      <section>
        <h3 className="text-sm text-ash mb-2">Council providers</h3>
        <div className="space-y-2">
          {providers.map((provider) => (
            <label key={provider.name} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={provider.enabled}
                onChange={(e) =>
                  setProviders((previous) =>
                    previous.map((item) =>
                      item.name === provider.name
                        ? { ...item, enabled: e.target.checked }
                        : item
                    )
                  )
                }
              />
              {provider.name}
            </label>
          ))}
        </div>
        <p className="text-xs text-ash mt-2">
          API keys are configured as Supabase Edge Function secrets, not here — see README.
        </p>
      </section>

      <section>
        <h3 className="text-sm text-ash mb-2">Daily spend cap (USD)</h3>
        <input
          type="number"
          min="0"
          step="0.01"
          className="bg-transparent border border-ash/40 rounded px-3 py-2 outline-none focus:border-signal w-32"
          value={cap}
          onChange={(e) => setCap(Number(e.target.value))}
        />
      </section>

      <button
        onClick={save}
        disabled={saving}
        className="bg-wine text-ink px-4 py-2 rounded hover:bg-wine/80 disabled:opacity-50"
      >
        {saving ? "Saving..." : "Save"}
      </button>

      {saved && (
        <span role="status" className="text-signal text-sm ml-3">
          Saved
        </span>
      )}

      {errorMessage && (
        <p role="alert" className="text-sm text-red-400">
          {errorMessage}
        </p>
      )}
    </div>
  );
}

