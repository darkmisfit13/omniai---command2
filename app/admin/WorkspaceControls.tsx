"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function WorkspaceControls() {
  const [cap, setCap] = useState(5);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void supabase
      .from("spend_tracking")
      .select("cap_usd")
      .eq("day", new Date().toISOString().slice(0, 10))
      .maybeSingle()
      .then(({ data, error: loadError }) => {
        if (!active) return;
        if (loadError) setError("Could not load the daily spend cap.");
        else if (data) setCap(Number(data.cap_usd));
        setLoading(false);
      });
    return () => { active = false; };
  }, []);

  async function save() {
    if (!Number.isFinite(cap) || cap < 0) {
      setError("The daily spend cap must be a valid, non-negative number.");
      return;
    }
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      const { error: saveError } = await supabase
        .from("spend_tracking")
        .upsert({ day: new Date().toISOString().slice(0, 10), cap_usd: cap });
      if (saveError) throw new Error("Could not save the daily spend cap.");
      setSaved(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save the daily spend cap.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-4 rounded-2xl border border-[#211d34] bg-[#14121f]/90 p-4">
      <div>
        <h2 className="text-lg font-semibold text-[#e8e6f2]">Workspace Controls</h2>
        <p className="mt-1 text-sm text-[#9490ac]">Owner-only usage limit for AI services.</p>
      </div>
      {loading ? (
        <p className="text-sm text-ash">Loading workspace controls…</p>
      ) : (
        <>
          <label className="block text-sm text-ash">
            Daily spend cap (USD)
            <input
              type="number"
              min="0"
              step="0.01"
              className="mt-2 block w-40 px-3 py-2"
              value={cap}
              onChange={(event) => {
                setCap(Number(event.target.value));
                setSaved(false);
              }}
            />
          </label>
          <div>
            <button type="button" onClick={() => void save()} disabled={saving} className="hud-btn hud-btn-primary">
              {saving ? "Saving…" : "Save workspace controls"}
            </button>
            {saved && <span role="status" className="ml-3 text-sm text-[#6ee7b7]">Saved</span>}
          </div>
        </>
      )}
      {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
    </section>
  );
}
