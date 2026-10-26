"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { CREDIT_ACTIONS, GROUP_LABELS, PLANS, type CreditGroup, type Plan } from "@/lib/billing/creditTable";
import { BOOSTER_PACKS } from "@/lib/billing/boosters";
import { startCheckout, accessToken } from "@/lib/billing/checkoutClient";
import { intentPath, parseIntent, type IntentCatalog, type PurchaseIntent } from "@/lib/billing/purchaseIntent";

/**
 * /pricing — what a plan costs, and what every action inside it costs.
 *
 * The credit table is published in full rather than summarised, because the
 * alternative is a customer discovering after they pay that a music track is
 * 40 credits and a chat reply is one. Prices come from creditTable, so this
 * page cannot advertise a number the API would not charge.
 *
 * Subscriptions and one-time credit packs are two different products and are
 * rendered as two separate sections. Every plan card performs its own action:
 * the free plan starts onboarding (it never opens a paid checkout), and each
 * paid tier opens that tier's subscription checkout. A signed-out visitor is
 * sent to sign in with the chosen plan preserved in the URL, and checkout
 * resumes automatically once they return.
 */

/**
 * Next 15 refuses to statically render a page whose client components read the
 * URL — `useSearchParams` must sit under Suspense or `next build` fails. The
 * wrapper below owns that boundary; this inner page is where the state lives.
 */
export default function PricingPage() {
  return (
    <Suspense fallback={<div className="pilot-voice text-3xl">Pricing &amp; Credits</div>}>
      <PricingContent />
    </Suspense>
  );
}

type Snapshot = {
  configured: boolean;
  missing: string[];
  current: { plan_tier: string; status: string } | null;
  balance: number | null;
  hasLiveSubscription: boolean;
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

/** A busy key that distinguishes a plan purchase from a pack purchase. */
function intentKey(intent: PurchaseIntent): string {
  return intent.kind === "plan" ? `plan:${intent.tier}` : `pack:${intent.id}`;
}

function PricingContent() {
  const search = useSearchParams();
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [balance, setBalance] = useState<number | null>(null);
  const resumed = useRef(false);
  const inFlight = useRef(false);

  const catalog: IntentCatalog = useMemo(
    () => ({
      tiers: PLANS.filter((plan) => plan.priceUsd > 0).map((plan) => plan.tier),
      packs: BOOSTER_PACKS.map((pack) => pack.id),
    }),
    []
  );

  const refresh = useCallback(async () => {
    const token = await accessToken();
    setSignedIn(Boolean(token));
    if (!token) {
      setSnapshot(null);
      setBalance(null);
      return;
    }
    try {
      const res = await fetch("/api/billing/upgrade", {
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = (await res.json().catch(() => null)) as Snapshot | null;
      if (data && typeof data === "object" && "configured" in data) {
        setSnapshot(data);
        if (typeof data.balance === "number") setBalance(data.balance);
      }
    } catch {
      /* unreachable — the catalogue below still renders */
    }
  }, []);

  const buy = useCallback(
    async (intent: PurchaseIntent) => {
      if (inFlight.current) return;
      inFlight.current = true;
      const key = intentKey(intent);
      setBusy(key);
      setError("");
      setNotice("");

      const result = await startCheckout(intent);

      if (result.status === "auth") {
        // Preserve the chosen plan/pack through the sign-in round trip; the
        // effect below resumes checkout when they come back signed in.
        router.push(`/login?next=${encodeURIComponent(intentPath(intent))}`);
        return;
      }
      if (result.status === "redirect") {
        // Keep the busy state — the browser is about to leave for Stripe.
        window.location.href = result.url;
        return;
      }
      inFlight.current = false;
      if (result.status === "updated") {
        setNotice(result.message);
        setBusy(null);
        void refresh();
        return;
      }
      setError(result.message);
      setBusy(null);
    },
    [refresh, router]
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Resume a purchase that was interrupted by the sign-in flow.
  useEffect(() => {
    if (resumed.current || !signedIn) return;
    const intent = parseIntent((key) => search.get(key), catalog);
    if (!intent) return;
    resumed.current = true;
    void buy(intent);
  }, [signedIn, search, catalog, buy]);

  const checkoutStatus = search.get("checkout");
  const boosterStatus = search.get("booster");

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

  const currentTier = snapshot?.current?.plan_tier ?? "free";
  // Unknown until the snapshot lands; only a *known* gap disables the buttons.
  const configuredKnownFalse = snapshot !== null && snapshot.configured === false;

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="pilot-voice text-3xl">Pricing &amp; Credits</h1>
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

      <Link
        href="/settings/billing"
        className="hud-panel group flex flex-wrap items-center justify-between gap-3 p-4 transition hover:border-[var(--hud-accent)]"
      >
        <span className="space-y-1">
          <span className="block text-sm text-ink">
            Billing &amp; Plan Upgrade
          </span>
          <span className="block text-xs text-ash">
            See your live subscription, schedule a plan change for your next billing cycle, or buy a credit booster pack.
          </span>
        </span>
        <span className="text-xs uppercase tracking-wider text-[var(--hud-accent)] transition group-hover:translate-x-0.5">
          Open Billing Hub →
        </span>
      </Link>

      {checkoutStatus === "success" && (
        <p className="hud-panel text-sm text-signal p-3">
          Payment received. Your credits land within a few seconds — refresh if the balance above
          has not moved yet.
        </p>
      )}
      {checkoutStatus === "cancelled" && (
        <p className="hud-panel text-sm text-ash p-3">Checkout cancelled. Nothing was charged.</p>
      )}
      {boosterStatus === "success" && (
        <p className="hud-panel text-sm text-signal p-3" role="status">
          Booster pack purchased. Your credits land within a few seconds.
        </p>
      )}
      {boosterStatus === "cancelled" && (
        <p className="hud-panel text-sm text-ash p-3">Booster checkout cancelled. Nothing was charged.</p>
      )}

      {configuredKnownFalse && (
        <div className="hud-panel p-3 text-xs text-ash space-y-1">
          <p className="text-signal">Billing is not switched on yet.</p>
          <p>
            Missing: <span className="font-mono">{snapshot?.missing.join(", ")}</span>. Prices below
            are exact, but the buttons stay disabled until these are set in your environment.
          </p>
        </div>
      )}

      {error && <p className="hud-panel p-3 text-sm text-signal" role="alert">{error}</p>}
      {notice && <p className="hud-panel p-3 text-sm text-signal" role="status">{notice}</p>}

      {/* ── Subscriptions ─────────────────────────────────────────────── */}
      <section className="space-y-3" aria-label="Subscription plans">
        <div>
          <h2 className="pilot-voice text-xl">Subscriptions</h2>
          <p className="text-xs text-ash">Billed monthly. Cancel any time — credits are added, never reset.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {PLANS.map((plan) => (
            <PlanCard
              key={plan.tier}
              plan={plan}
              signedIn={signedIn}
              isCurrent={plan.tier === currentTier}
              busy={busy}
              disabled={configuredKnownFalse}
              onBuy={() => void buy({ kind: "plan", tier: plan.tier })}
            />
          ))}
        </div>
      </section>

      {/* ── One-time credit booster packs ─────────────────────────────── */}
      <section id="boosters" className="space-y-3 scroll-mt-24" aria-label="Credit booster packs">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="pilot-voice text-xl">Credit Booster Packs</h2>
            <p className="text-xs text-ash">
              One-time purchase — not a subscription. Credits stack on top of your plan and never
              expire.
            </p>
          </div>
          <span className="text-[10px] uppercase tracking-[0.14em] text-[var(--hud-accent)]">
            One-time payment
          </span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {BOOSTER_PACKS.map((pack) => (
            <article
              key={pack.id}
              className="hud-panel flex flex-col gap-3 p-4"
              data-d3="4"
              data-d3-x="3"
              data-d3-y="3"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-lg text-ink">{pack.name}</h3>
                  <p className="text-xs text-ash">{pack.blurb}</p>
                </div>
                {pack.badge && (
                  <span className="shrink-0 rounded-full border border-[rgba(139,127,255,0.5)] px-2 py-0.5 text-[9px] uppercase tracking-[0.12em] text-[var(--hud-accent)]">
                    {pack.badge}
                  </span>
                )}
              </div>

              <p className="font-mono text-2xl text-signal">
                +{pack.credits.toLocaleString()}
                <span className="text-xs text-ash"> credits</span>
              </p>

              <p className="font-mono text-xl text-ink">
                ${pack.priceUsd}
                <span className="text-xs text-ash"> one-time</span>
              </p>

              <button
                type="button"
                onClick={() => void buy({ kind: "pack", id: pack.id })}
                disabled={busy !== null || configuredKnownFalse}
                className="mt-auto w-full py-2 text-xs uppercase tracking-wider border border-[var(--hud-accent)] text-ink hover:bg-[var(--hud-accent)]/15 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                {busy === `pack:${pack.id}`
                  ? "Redirecting…"
                  : `Buy ${pack.credits.toLocaleString()} credits`}
              </button>
            </article>
          ))}
        </div>
      </section>

      {/* ── Credit table ──────────────────────────────────────────────── */}
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

function PlanCard({
  plan,
  signedIn,
  isCurrent,
  busy,
  disabled,
  onBuy,
}: {
  plan: Plan;
  signedIn: boolean;
  isCurrent: boolean;
  busy: string | null;
  disabled: boolean;
  onBuy: () => void;
}) {
  const featured = plan.tier === "pro";
  const isFree = plan.priceUsd === 0;
  const buttonBusy = isFree ? false : busy === `plan:${plan.tier}`;

  return (
    <article
      className={`hud-panel p-4 flex flex-col gap-3 ${featured ? "ring-1 ring-[var(--hud-accent)]" : ""}`}
      data-d3="5"
      data-d3-x="4"
      data-d3-y="4"
    >
      <div>
        {featured && (
          <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--hud-accent)] mb-1">
            Recommended
          </p>
        )}
        <h2 className="text-lg text-ink">{plan.name}</h2>
        <p className="text-xs text-ash">{plan.blurb}</p>
      </div>

      <p className="font-mono text-2xl text-ink">
        {isFree ? "Free" : `$${plan.priceUsd}`}
        {!isFree && <span className="text-xs text-ash"> /month</span>}
      </p>

      <ul className="space-y-1 text-xs text-ash flex-1">
        {plan.highlights.map((line) => (
          <li key={line} className="flex gap-2">
            <span className="text-[var(--hud-accent)]">›</span>
            <span>{line}</span>
          </li>
        ))}
      </ul>

      {isFree ? (
        signedIn ? (
          <p className="text-[10px] uppercase tracking-wider text-ink/40 text-center py-2">
            {isCurrent ? "Your plan" : "Included on every paid plan"}
          </p>
        ) : (
          <Link
            href="/login?signup=1&next=%2Fpricing"
            className="w-full py-2 text-center text-xs uppercase tracking-wider border border-[var(--hud-accent)] text-ink hover:bg-[var(--hud-accent)]/15 transition"
          >
            Start on Omni Free
          </Link>
        )
      ) : isCurrent ? (
        <p className="text-[10px] uppercase tracking-wider text-ink/40 text-center py-2">
          Your current plan
        </p>
      ) : (
        <button
          type="button"
          onClick={onBuy}
          disabled={disabled || busy !== null}
          className="w-full py-2 text-xs uppercase tracking-wider border border-[var(--hud-accent)] text-ink hover:bg-[var(--hud-accent)]/15 disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          {buttonBusy ? "Redirecting…" : `Choose ${plan.name}`}
        </button>
      )}
    </article>
  );
}
