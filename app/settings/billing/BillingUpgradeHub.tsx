"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { PLANS, type PlanTier } from "@/lib/billing/creditTable";
import { BOOSTER_PACKS, type BoosterPack } from "@/lib/billing/boosters";
import { intentPath, type PurchaseIntent } from "@/lib/billing/purchaseIntent";

/** Itemized credit costs shown in the Usage Estimator section. */
const USAGE_ESTIMATES = [
  { label: "Image Gen (4K)", cost: "5 credits" },
  { label: "Text-to-Video Clip", cost: "25 credits" },
  { label: "Full AI Track Generation", cost: "10 credits" },
  { label: "Stem Split", cost: "5 credits" },
  { label: "Lip-Sync", cost: "15 credits" },
  { label: "Standard Image", cost: "10 credits" },
  { label: "Voiceover (500 chars)", cost: "10 credits" },
  { label: "Website — New", cost: "15 credits" },
];

/**
 * Billing Management & Account Plan Upgrade.
 *
 * Three surfaces, one page:
 *   1. a status monitor for the live subscription and remaining credits,
 *   2. the upgrade matrix for the tiers above the caller,
 *   3. the credit booster drawer for one-time top-ups.
 *
 * Everything that moves money goes through /api/billing/upgrade, and the
 * Stripe webhook is what actually records a plan or grants credits. This
 * component only ever asks and then re-reads.
 */

type PlanOption = {
  tier: PlanTier;
  name: string;
  priceUsd: number;
  monthlyCredits: number;
  blurb: string;
  highlights: string[];
  ready: boolean;
};

type SubscriptionSnapshot = {
  plan_tier: string;
  status: string;
  current_period_end: string | null;
} | null;

type Snapshot = {
  configured: boolean;
  missing: string[];
  current: SubscriptionSnapshot;
  balance: number | null;
  hasLiveSubscription: boolean;
  plans: PlanOption[];
  boosters: BoosterPack[];
  /** A plan change already scheduled to take effect at the next renewal. */
  pendingChange?: { tier: string; from: string; effectiveAt: string | null } | null;
};

type View = { snapshot: Snapshot; live: boolean };

const TIER_ORDER: PlanTier[] = ["free", "creator", "pro", "business"];

const TIER_DISPLAY: Record<string, string> = {
  free: "Omni Free",
  creator: "Omni Plus",
  pro: "Omni Pro",
  business: "Omni Ultra",
};

function fallbackSnapshot(): Snapshot {
  return {
    configured: false,
    missing: [],
    current: null,
    balance: null,
    hasLiveSubscription: false,
    plans: PLANS.map((plan) => ({
      tier: plan.tier,
      name: plan.name,
      priceUsd: plan.priceUsd,
      monthlyCredits: plan.monthlyCredits,
      blurb: plan.blurb,
      highlights: plan.highlights,
      // Signed out: we cannot know which Stripe prices exist, and the action
      // is "sign in first", so no tier is disabled here.
      ready: true,
    })),
    boosters: BOOSTER_PACKS,
  };
}

async function authToken(): Promise<string | null> {
  try {
    const { supabase } = await import("@/lib/supabaseClient");
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}

function formatDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function daysUntil(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) return null;
  return Math.max(0, Math.ceil((time - Date.now()) / 86_400_000));
}

function statusMeta(status: string | undefined): { label: string; pill: string } {
  switch ((status ?? "").toLowerCase()) {
    case "active":
      return { label: "Active", pill: "" };
    case "trialing":
      return { label: "Trial", pill: "" };
    case "past_due":
      return { label: "Payment due", pill: "status-pill--warn" };
    default:
      return { label: "Inactive", pill: "status-pill--muted" };
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function BillingUpgradeHub() {
  const search = useSearchParams();
  const router = useRouter();
  const [view, setView] = useState<View | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(true);

  const load = useCallback(async () => {
    const token = await authToken();
    if (!token) {
      setView({ snapshot: fallbackSnapshot(), live: false });
      return;
    }
    try {
      const response = await fetch("/api/billing/upgrade", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (!response.ok) throw new Error();
      const payload = (await response.json()) as Snapshot;
      setView({ snapshot: payload, live: true });
    } catch {
      setView({ snapshot: fallbackSnapshot(), live: false });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const runAction = useCallback(
    async (body: Record<string, unknown>, key: string) => {
      setBusy(key);
      setError("");
      setNotice("");

      const token = await authToken();
      if (!token) {
        // Preserve which plan/pack was chosen so checkout resumes after sign-in
        // instead of dropping the user on a generic billing page.
        const intent: PurchaseIntent | null =
          typeof body.tier === "string"
            ? { kind: "plan", tier: body.tier }
            : typeof body.pack === "string"
              ? { kind: "pack", id: body.pack }
              : null;
        const next = intent ? intentPath(intent) : "/settings/billing";
        router.push(`/login?next=${encodeURIComponent(next)}`);
        setBusy(null);
        return;
      }

      try {
        const response = await fetch("/api/billing/upgrade", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify(body),
        });
        const payload = await response.json().catch(() => null);

        if (!response.ok) {
          const detail = payload?.error ?? payload?.message ?? null;
          setError(
            detail
              ? `${detail} (HTTP ${response.status})`
              : `That did not go through (HTTP ${response.status}). Try again.`
          );
          return;
        }
        if (payload?.url) {
          window.location.href = payload.url;
          return;
        }

        setNotice(payload?.message ?? "Done — your account is updating now.");
        // The webhook does the writing; give it a moment before re-reading.
        window.setTimeout(() => {
          void load();
        }, 2500);
      } catch {
        setError("That did not go through. Check your connection and try again.");
      } finally {
        setBusy(null);
      }
    },
    [load, router]
  );

  const checkoutStatus = search.get("checkout");
  const boosterStatus = search.get("booster");

  const snapshot = view?.snapshot ?? null;
  const live = view?.live ?? false;

  const plansByTier = useMemo(() => {
    const map = new Map<string, PlanOption>();
    for (const plan of snapshot?.plans ?? []) map.set(plan.tier, plan);
    return map;
  }, [snapshot]);

  const currentTier = snapshot?.current?.plan_tier ?? "free";
  const currentIndex = TIER_ORDER.indexOf(currentTier as PlanTier);
  const currentName = TIER_DISPLAY[currentTier] ?? currentTier;
  const currentPlan = plansByTier.get(currentTier);
  const status = statusMeta(snapshot?.current?.status);

  const allowance = currentPlan?.monthlyCredits ?? plansByTier.get("free")?.monthlyCredits ?? 100;
  const balance = snapshot?.balance ?? null;
  const bonus = balance !== null && balance > allowance ? balance - allowance : 0;
  const percent =
    balance === null
      ? 0
      : allowance > 0
        ? clamp((balance / allowance) * 100, 0, 100)
        : balance > 0
          ? 100
          : 0;
  const low = balance !== null && allowance > 0 && balance <= allowance * 0.1;

  const periodEnd = snapshot?.current?.current_period_end ?? null;
  const renewalDate = formatDate(periodEnd);
  const renewalDays = daysUntil(periodEnd);

  // Every tier is shown, not just the ones above the caller: a billing page
  // that hides the plan you are on — or the free plan — reads as if those
  // options do not exist. Each card decides its own action from its rank.
  const planCards = (snapshot?.plans ?? [])
    .slice()
    .sort((a, b) => TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier));

  const boosters = snapshot?.boosters ?? BOOSTER_PACKS;
  // Only a *known* configuration gap disables purchasing. When the snapshot is
  // unavailable the click is allowed through and the server answers — a stale
  // or failed page load must not leave a button permanently dead.
  const configGap = live && snapshot !== null && !snapshot.configured;
  const actionsReady = busy === null && !configGap;

  return (
    <div className="billing-hub max-w-5xl">
      <header className="space-y-3">
        <Link
          href="/settings"
          className="inline-flex items-center gap-1 text-xs text-ash transition hover:text-ink"
        >
          <span aria-hidden>←</span> Settings
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-1">
            <h1 className="pilot-voice text-3xl">Billing &amp; Plans</h1>
            <p className="max-w-2xl text-sm text-ash">
              Your plan, your credits, and next-cycle plan changes. Changing a tier keeps
              everything you have made — credits are added, never reset.
            </p>
          </div>
          <Link href="/pricing" className="hud-btn text-xs">
            Full credit table
          </Link>
        </div>
      </header>

      {checkoutStatus === "success" && (
        <p className="hud-panel p-3 text-sm text-signal" role="status">
          Payment received. Your plan and credits update within a few seconds.
        </p>
      )}
      {checkoutStatus === "cancelled" && (
        <p className="hud-panel p-3 text-sm text-ash">Checkout cancelled. Nothing was charged.</p>
      )}
      {boosterStatus === "success" && (
        <p className="hud-panel p-3 text-sm text-signal" role="status">
          Booster pack purchased. Your credits land within a few seconds.
        </p>
      )}
      {boosterStatus === "cancelled" && (
        <p className="hud-panel p-3 text-sm text-ash">Booster checkout cancelled. Nothing was charged.</p>
      )}

      {view && !live && (
        <div className="hud-panel p-3 text-xs text-ash space-y-1">
          <p className="text-signal">Showing the public catalogue.</p>
          <p>
            Sign in to read your live balance and upgrade your account — or, if billing has not
            been switched on yet, add the Stripe keys to your environment.
          </p>
        </div>
      )}

      {live && snapshot && !snapshot.configured && (
        <div className="hud-panel p-3 text-xs text-ash space-y-1">
          <p className="text-signal">Billing is not switched on yet.</p>
          <p>
            Missing: <span className="font-mono">{snapshot.missing.join(", ")}</span>. Prices below
            are exact, but the buttons stay disabled until these are set in your environment.
          </p>
        </div>
      )}

      {error && (
        <p className="hud-panel p-3 text-sm text-signal" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="hud-panel p-3 text-sm text-signal" role="status">
          {notice}
        </p>
      )}

      {!view && (
        <div className="hud-panel p-6 text-sm text-ash" role="status">
          Reading your billing status…
        </div>
      )}

      {view && (
        <>
      {/* 1. Current subscription status monitor */}
      <section
        className="hud-panel relative p-5"
        data-d3="5"
        data-d3-x="4"
        data-d3-y="4"
        aria-label="Current subscription"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="hud-kicker">Current subscription</p>
            <h2 className="pilot-voice text-2xl text-ink">
              {currentName} <span className="text-[var(--hud-accent)]">{status.label}</span>
            </h2>
            <div className="flex flex-wrap items-center gap-3 text-xs text-ash">
              <span className={`status-pill ${status.pill}`}>
                <span className="status-pill__dot" aria-hidden />
                {status.label}
              </span>
              <span>
                {renewalDate ? (
                  <>
                    Renews <span className="text-ink">{renewalDate}</span>
                    {renewalDays !== null && (
                      <> · in {renewalDays} day{renewalDays === 1 ? "" : "s"}</>
                    )}
                  </>
                ) : (
                  "No renewal scheduled"
                )}
              </span>
              {snapshot?.hasLiveSubscription && (
                <span className="text-[10px] uppercase tracking-[0.14em] text-[var(--hud-accent)]">
                  Live Stripe subscription
                </span>
              )}
            </div>
          </div>

          <div className="text-right">
            <p className="hud-kicker">Remaining credits</p>
            <p className="font-mono text-4xl text-ink">
              {balance === null ? "—" : balance.toLocaleString()}
            </p>
            <p className="text-[11px] text-ash">
              of {allowance.toLocaleString()} / month
              {bonus > 0 && <> · +{bonus.toLocaleString()} booster credits</>}
            </p>
          </div>
        </div>

        {/* Emerald progress track */}
        <div className="mt-5 space-y-2">
          <div
            className="credit-track"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(percent)}
            aria-label="Credits remaining this cycle"
          >
            <div className="credit-track__fill" style={{ width: `${percent}%` }} />
          </div>
          <div className="flex items-center justify-between text-[11px] text-ash">
            <span>{Math.round(percent)}% of this cycle&apos;s allowance left</span>
            <span className={low ? "text-[#ffb84d]" : "text-[var(--hud-accent)]"}>
              {balance === null
                ? "Reading balance…"
                : low
                  ? "Running low — top up or upgrade"
                  : "Healthy balance"}
            </span>
          </div>
        </div>

        {/* Renewal milestones */}
        <div className="mt-5 flex items-center gap-2 text-[10px] uppercase tracking-[0.14em] text-ash">
          <Milestone label="Active now" tone="done" />
          <MilestoneConnector />
          <Milestone label={renewalDate ? `Renews ${renewalDate}` : "Renews monthly"} tone="next" />
          <MilestoneConnector />
          <Milestone label="Credits refill" tone="future" />
        </div>
      </section>

      {/* 2. Plan matrix — every tier, each with its own action */}
      <section className="space-y-3" aria-label="Subscription plans">
        <div>
          <h2 className="pilot-voice text-xl text-ink">Plans</h2>
          <p className="text-xs text-ash">
            {snapshot?.hasLiveSubscription
              ? "Plan changes take effect at your next billing cycle. Your current access and credits stay in place until then."
              : "Choose a tier to complete a secure Stripe checkout. Your data and credits stay exactly as they are."}
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {planCards.map((plan) => {
            const featured = plan.tier === "pro";
            const rank = TIER_ORDER.indexOf(plan.tier);
            const isCurrent = plan.tier === currentTier;
            const isUpgrade = rank > currentIndex;
            const disabled = !actionsReady || !plan.ready;
            return (
              <article
                key={plan.tier}
                className={`hud-panel tier-card relative flex flex-col gap-3 p-4 ${
                  featured ? "tier-card--featured" : ""
                }`}
                data-d3="5"
                data-d3-x="4"
                data-d3-y="4"
              >
                {featured && <span className="tier-card__badge">Recommended</span>}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-lg text-ink">{plan.name}</h3>
                    <p className="text-xs text-ash">{plan.blurb}</p>
                  </div>
                  <span className="shrink-0 text-[10px] uppercase tracking-[0.14em] text-[var(--hud-accent)]">
                    {isCurrent ? "Current" : isUpgrade ? "Available" : "Lower"}
                  </span>
                </div>
                <p className="font-mono text-2xl text-ink">
                  {plan.priceUsd === 0 ? "Free" : `$${plan.priceUsd}`}
                  {plan.priceUsd > 0 && <span className="text-xs text-ash"> /month</span>}
                </p>
                <p className="text-xs text-[var(--hud-accent)]">
                  {plan.monthlyCredits.toLocaleString()} credits / month
                </p>
                <ul className="flex-1 space-y-1 text-xs text-ash">
                  {plan.highlights.map((line) => (
                    <li key={line} className="flex gap-2">
                      <span className="text-[var(--hud-accent)]">›</span>
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>

                {isCurrent ? (
                  <div className="space-y-1">
                    <p className="text-[10px] uppercase tracking-wider text-ink/40 text-center py-1">
                      Your current plan
                    </p>
                    {snapshot?.pendingChange && (
                      <>
                        <p className="text-[10px] text-[#ffb84d] text-center leading-snug">
                          Change to {TIER_DISPLAY[snapshot.pendingChange.tier] ?? snapshot.pendingChange.tier} scheduled.
                          Takes effect {formatDate(snapshot.pendingChange.effectiveAt) ?? renewalDate ?? "at next billing cycle"}.
                        </p>
                        <button
                          type="button"
                          className="w-full py-1 text-[10px] uppercase tracking-wider text-ash hover:text-ink"
                          onClick={() => runAction({ tier: currentTier }, `cancel-change:${currentTier}`)}
                          disabled={disabled}
                        >
                          {busy === `cancel-change:${currentTier}` ? "Cancelling…" : "Cancel scheduled change"}
                        </button>
                      </>
                    )}
                  </div>
                ) : isUpgrade ? (
                  <button
                    type="button"
                    className="d3-btn d3-btn--primary w-full"
                    onClick={() => runAction({ tier: plan.tier }, `plan:${plan.tier}`)}
                    disabled={disabled}
                    title={
                      !plan.ready
                        ? "This tier has no Stripe price configured yet."
                        : !live
                          ? "Sign in to upgrade."
                          : undefined
                    }
                  >
                    {busy === `plan:${plan.tier}` ? "Scheduling…" : `Change to ${plan.name} at Renewal`}
                  </button>
                ) : plan.tier === "free" ? (
                  <p className="text-[10px] uppercase tracking-wider text-ink/40 text-center py-2">
                    Included on every paid plan
                  </p>
                ) : (
                  // Lower paid tier — offer a scheduled downgrade
                  <button
                    type="button"
                    className="d3-btn w-full border-[rgba(255,180,100,0.4)] text-[#ffb84d] hover:border-[rgba(255,180,100,0.7)]"
                    style={{ background: "rgba(80,40,0,0.25)" }}
                    onClick={() => runAction({ tier: plan.tier, downgrade: true }, `downgrade:${plan.tier}`)}
                    disabled={disabled || !snapshot?.hasLiveSubscription}
                    title={
                      !snapshot?.hasLiveSubscription
                        ? "No active subscription to downgrade."
                        : !live
                          ? "Sign in to change your plan."
                          : `Switch to ${plan.name} at next billing cycle`
                    }
                  >
                    {busy === `downgrade:${plan.tier}`
                      ? "Scheduling…"
                      : `Change to ${plan.name} at Renewal`}
                  </button>
                )}
              </article>
            );
          })}
        </div>
      </section>

      {/* 3. Credit booster pack purchase drawer */}
      <section className="space-y-3" aria-label="Credit booster packs">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="pilot-voice text-xl text-ink">Credit Booster Packs</h2>
            <p className="text-xs text-ash">
              One-time top-ups of premium model tokens. They stack on top of your plan and never
              expire.
            </p>
          </div>
          <button
            type="button"
            className="glass-btn glass-btn--inline shrink-0 px-4"
            aria-expanded={drawerOpen}
            aria-controls="booster-drawer"
            onClick={() => setDrawerOpen((open) => !open)}
          >
            <span>{drawerOpen ? "Close drawer" : "Open drawer"}</span>
          </button>
        </div>

        {drawerOpen && (
          <div
            id="booster-drawer"
            role="region"
            aria-label="Credit booster packs"
            className="booster-drawer__panel hud-panel p-4"
          >
            <div className="mb-4 flex flex-col items-center gap-2">
              <span className="booster-drawer__handle" aria-hidden />
              <span className="hud-kicker">Credit add-on drawer</span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {boosters.map((pack) => (
                <article
                  key={pack.id}
                  className="d3-tile relative flex flex-col gap-2 p-4"
                  data-d3="4"
                  data-d3-x="3"
                  data-d3-y="3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm text-ink">{pack.name}</h3>
                    {pack.badge && (
                      <span className="shrink-0 rounded-full border border-[rgba(139,127,255,0.5)] px-2 py-0.5 text-[9px] uppercase tracking-[0.12em] text-[var(--hud-accent)]">
                        {pack.badge}
                      </span>
                    )}
                  </div>
                  <p className="font-mono text-2xl text-[#6ee7b7]">
                    +{pack.credits.toLocaleString()}
                    <span className="text-[10px] text-ash"> credits</span>
                  </p>
                  <p className="text-xs text-ash flex-1">{pack.blurb}</p>
                  <p className="font-mono text-sm text-ink">${pack.priceUsd}</p>
                  <button
                    type="button"
                    className="glass-btn"
                    onClick={() => runAction({ pack: pack.id }, `booster:${pack.id}`)}
                    disabled={!actionsReady}
                    title={
                      !live
                        ? "Sign in to purchase."
                        : !snapshot?.configured
                          ? "Billing is not configured yet — set the Stripe keys in your environment."
                          : busy
                            ? "Please wait…"
                            : "Start Stripe Checkout for this pack"
                    }
                  >
                    <span>
                      {busy === `booster:${pack.id}`
                        ? "Starting…"
                        : `Add +${pack.credits.toLocaleString()}`}
                    </span>
                  </button>
                </article>
              ))}
            </div>

            <p className="mt-4 text-[11px] text-ink/40">
              Booster credits are granted the moment Stripe confirms payment and are added to your
              balance — they are never a replacement for plan credits.
            </p>
          </div>
        )}
      </section>
        {/* 4. Usage estimator */}
        <section className="hud-panel p-5" aria-label="Credit usage estimator">
          <div className="mb-4 space-y-1">
            <h2 className="pilot-voice text-xl text-ink">Credit Cost Reference</h2>
            <p className="text-xs text-ash">
              How much each action costs so you can plan your workload before you start.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {USAGE_ESTIMATES.map((item) => (
              <div
                key={item.label}
                className="d3-tile flex items-center justify-between gap-4 px-4 py-3"
                data-d3="3"
              >
                <span className="text-xs text-ash">{item.label}</span>
                <span className="font-mono text-sm text-[var(--hud-accent)] whitespace-nowrap">
                  {item.cost}
                </span>
              </div>
            ))}
          </div>
        </section>
        </>
      )}
    </div>
  );
}

function Milestone({ label, tone }: { label: string; tone: "done" | "next" | "future" }) {
  const toneClass =
    tone === "done"
      ? "border-[rgba(110,231,183,0.6)] text-[#a7f3d0]"
      : tone === "next"
        ? "border-[rgba(139,127,255,0.6)] text-ink"
        : "border-[#393252] text-ash";
  return (
    <span className={`rounded-full border px-3 py-1 ${toneClass}`}>{label}</span>
  );
}

function MilestoneConnector() {
  return (
    <span
      className="h-px min-w-4 flex-1 bg-gradient-to-r from-[rgba(110,231,183,0.4)] via-[rgba(108,99,255,0.3)] to-transparent"
      aria-hidden
    />
  );
}
