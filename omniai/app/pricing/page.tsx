"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CREDIT_ACTIONS, GROUP_LABELS, PLANS, type CreditGroup, type Plan } from "@/lib/billing/creditTable";

/**
 * /pricing — what a plan costs, and what every action inside it costs.
 *
 * The credit table is published in full rather than summarised, because the
 * alternative is a customer discovering after they pay that a music track is
 * 40 credits and a chat reply is one. Prices come from creditTable, so this
 * page cannot advertise a number the API would not charge.
 */

/**
 * Next 15 refuses to statically render a page whose client components read the
 * URL — `useSearchParams` must sit under Suspense or `next build` fails. The
 * wrapper below owns that boundary; this inner page is where the state lives.
 */
export default function PricingPage() {
  return (
    <Suspense fallback={<div className="pilot-voice text-3xl">Pricing</div>}>
      <PricingContent />
    </Suspense>
  );
}

type Availability = { tier: string; ready: boolean };
type BillingState = {
  configured: boolean;
  missing: string[];
  current: { plan_tier: string; status: string } | null;
  available: Availability[];
};

const GROUP_ORDER: CreditGroup[] = [
  "text",
  "image",
  "video",
  "music",
  "voice",
  "web",
  "app",
  "social",
];

function PricingContent() {
  const search = useSearchParams();
  const [billing, setBilling] = useState<BillingState | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/stripe/checkout", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && data && typeof data === "object" && "configured" in data) {
          setBilling(data as BillingState);
        }
      })
      .catch(() => {
        /* signed out or unreachable — the prices below still render */
      });

    supabaseRpcBalance();

    return () => {
      cancelled = true;
    };
  }, []);

  async function supabaseRpcBalance() {
    try {
      const { supabase } = await import("@/lib/supabaseClient");
      const { data } = await supabase.rpc("omni_credit_balance");
      if (typeof data === "number") setBalance(data);
    } catch {
      /* billing migration not run yet */
    }
  }

  const checkoutStatus = search.get("checkout");

  const startCheckout = useCallback(
    async (tier: string) => {
      setBusy(tier);
      setError("");
      try {
        const { supabase } = await import("@/lib/supabaseClient");
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) {
          window.location.href = "/login?next=/pricing";
          return;
        }

        const response = await fetch("/api/stripe/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ tier }),
        });
        const payload = await response.json().catch(() => null);

        if (!response.ok || !payload?.url) {
          setError(payload?.error ?? "Checkout could not start.");
          return;
        }
        window.location.href = payload.url;
      } catch {
        setError("Checkout could not start. Check your connection and try again.");
      } finally {
        setBusy(null);
      }
    },
    []
  );

  const grouped = useMemo(() => {
    const map = new Map<CreditGroup, typeof CREDIT_ACTIONS>();
    for (const action of CREDIT_ACTIONS) {
      const list = map.get(action.group) ?? [];
      list.push(action);
      map.set(action.group, list);
    }
    return GROUP_ORDER.filter((g) => map.has(g)).map((g) => ({
      group: g,
      rows: (map.get(g) ?? []).slice().sort((a, b) => a.credits - b.credits),
    }));
  }, []);

  const ready = (tier: Plan["tier"]) =>
    billing?.available?.find((a) => a.tier === tier)?.ready ?? tier === "free";

  const currentTier = billing?.current?.plan_tier ?? "free";

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="pilot-voice text-3xl">Pricing</h1>
        <p className="text-sm text-ash max-w-2xl">
          One subscription for text, image, video, music, voice, websites and apps. Credits are
          charged per action, and every failed generation is refunded automatically.
        </p>
        {balance !== null && (
          <p className="text-xs text-ink/60">
            Your balance: <span className="text-signal">{balance.toLocaleString()} credits</span>
            {currentTier !== "free" && <> · plan {currentTier}</>}
          </p>
        )}
      </header>

      {checkoutStatus === "success" && (
        <p className="hud-panel text-sm text-signal p-3">
          Payment received. Your credits land within a few seconds — refresh if the balance above
          has not moved yet.
        </p>
      )}
      {checkoutStatus === "cancelled" && (
        <p className="hud-panel text-sm text-ash p-3">Checkout cancelled. Nothing was charged.</p>
      )}

      {billing && !billing.configured && (
        <div className="hud-panel p-3 text-xs text-ash space-y-1">
          <p className="text-signal">Billing is not switched on yet.</p>
          <p>
            Missing: <span className="font-mono">{billing.missing.join(", ")}</span>. Prices below
            are exact, but the buttons stay disabled until these are set in your environment.
          </p>
        </div>
      )}

      {error && <p className="hud-panel p-3 text-sm text-signal">{error}</p>}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {PLANS.map((plan) => {
          const isCurrent = plan.tier === currentTier;
          const disabled = plan.tier !== "free" && (!ready(plan.tier) || busy !== null);
          return (
            <article
              key={plan.tier}
              className={`hud-panel p-4 flex flex-col gap-3 ${
                plan.tier === "pro" ? "ring-1 ring-[var(--hud-accent)]" : ""
              }`}
              data-d3="5"
              data-d3-x="4"
              data-d3-y="4"
            >
              <div>
                <h2 className="text-lg text-ink">{plan.name}</h2>
                <p className="text-xs text-ash">{plan.blurb}</p>
              </div>

              <p className="font-mono text-2xl text-ink">
                {plan.priceUsd === 0 ? "Free" : `$${plan.priceUsd}`}
                {plan.priceUsd > 0 && <span className="text-xs text-ash"> /month</span>}
              </p>

              <ul className="space-y-1 text-xs text-ash flex-1">
                {plan.highlights.map((line) => (
                  <li key={line} className="flex gap-2">
                    <span className="text-[var(--hud-accent)]">›</span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>

              {plan.tier === "free" ? (
                <p className="text-[10px] uppercase tracking-wider text-ink/40 text-center py-2">
                  {isCurrent ? "Your plan" : "No card required"}
                </p>
              ) : (
                <button
                  type="button"
                  onClick={() => startCheckout(plan.tier)}
                  disabled={disabled}
                  className="w-full py-2 text-xs uppercase tracking-wider border border-[var(--hud-accent)] text-ink hover:bg-[var(--hud-accent)]/15 disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  {isCurrent ? "Switch plan" : busy === plan.tier ? "Redirecting…" : `Choose ${plan.name}`}
                </button>
              )}
            </article>
          );
        })}
      </section>

      <section className="space-y-3">
        <h2 className="pilot-voice text-xl">Credit table</h2>
        <p className="text-xs text-ash">
          Credits charged per action. Per-second rates apply after the included seconds. On failure
          → Refund.
        </p>

        <div className="space-y-5">
          {grouped.map(({ group, rows }) => (
            <div key={group} className="space-y-1">
              <h3 className="text-xs uppercase tracking-wider text-[var(--hud-accent)]">
                {GROUP_LABELS[group]}
              </h3>
              <div className="hud-panel divide-y divide-[var(--hud-border)]">
                {rows.map((action) => (
                  <div
                    key={action.key}
                    className="flex items-baseline justify-between gap-4 px-3 py-2 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="text-ink truncate">{action.label}</p>
                      {action.charLimit && (
                        <p className="text-[11px] text-ink/40">
                          up to {action.charLimit.toLocaleString()} characters
                        </p>
                      )}
                      {action.perSecond > 0 && (
                        <p className="text-[11px] text-ink/40">
                          {action.credits} incl. {action.includedSeconds}s, then +
                          {action.perSecond}/sec
                        </p>
                      )}
                    </div>
                    <p className="font-mono text-signal shrink-0">{action.credits}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <p className="text-[11px] text-ink/40">
          Failed generations refund the full charge automatically — the credit is returned the
          moment a provider cannot produce a result, so you are never billed for output you did not
          receive.
        </p>
      </section>
    </div>
  );
}
