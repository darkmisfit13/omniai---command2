import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

/**
 * POST /api/checkout
 *
 * Creates a Stripe Checkout session for a subscription tier or one-time
 * credit booster pack.  The client sends only the plan/pack key and its own
 * identity — never a price, an amount, or a Stripe id.  The server resolves
 * those from env vars so they can never be spoofed.
 *
 * Plan keys:    creator_sub  · studio_pro_sub  · enterprise_sub
 * Booster keys: micro_booster · creator_booster · studio_booster · mastermind_booster
 */

const PRICE_MAPPING: Record<
  string,
  { priceId: string; mode: "subscription" | "payment" }
> = {
  // ── Monthly subscriptions ──────────────────────────────────────────────
  creator_sub: {
    priceId: process.env.STRIPE_CREATOR_PRICE_ID ?? "",
    mode: "subscription",
  },
  studio_pro_sub: {
    priceId: process.env.STRIPE_STUDIO_PRO_PRICE_ID ?? "",
    mode: "subscription",
  },
  enterprise_sub: {
    priceId: process.env.STRIPE_ENTERPRISE_PRICE_ID ?? "",
    mode: "subscription",
  },

  // ── Non-expiring credit booster packs ─────────────────────────────────
  micro_booster: {
    priceId: process.env.STRIPE_MICRO_BOOSTER_PRICE_ID ?? "",
    mode: "payment",
  },
  creator_booster: {
    priceId: process.env.STRIPE_CREATOR_BOOSTER_PRICE_ID ?? "",
    mode: "payment",
  },
  studio_booster: {
    priceId: process.env.STRIPE_STUDIO_BOOSTER_PRICE_ID ?? "",
    mode: "payment",
  },
  mastermind_booster: {
    priceId: process.env.STRIPE_MASTERMIND_BOOSTER_PRICE_ID ?? "",
    mode: "payment",
  },
};

export async function POST(req: NextRequest) {
  try {
    const { planKey, userId, email } = (await req.json()) as {
      planKey?: string;
      userId?: string;
      email?: string;
    };

    // ── Validate the requested key ───────────────────────────────────────
    if (!planKey || !PRICE_MAPPING[planKey]) {
      return NextResponse.json(
        { error: "Invalid plan or booster key." },
        { status: 400 }
      );
    }

    const item = PRICE_MAPPING[planKey];

    if (!item.priceId) {
      return NextResponse.json(
        {
          error: `Stripe Price ID for "${planKey}" is not configured. Add the matching STRIPE_*_PRICE_ID env var.`,
        },
        { status: 500 }
      );
    }

    const stripeSecretKey = process.env.STRIPE_SECRET_KEY?.trim();
    if (!stripeSecretKey) {
      return NextResponse.json(
        { error: "Stripe checkout is not configured on this server." },
        { status: 503 }
      );
    }

    // Instantiate Stripe only during a configured request. Next.js imports API
    // route modules during build-time page-data collection, when secrets may
    // intentionally be absent.
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2025-08-27.acacia" as unknown as Stripe.LatestApiVersion,
    });

    // ── Build the Checkout session ───────────────────────────────────────
    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

    const session = await stripe.checkout.sessions.create({
      customer_email: email ?? undefined,
      line_items: [{ price: item.priceId, quantity: 1 }],
      mode: item.mode,
      success_url: `${siteUrl}/settings/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/settings/billing?canceled=true`,
      metadata: {
        userId: userId ?? "anonymous",
        planKey,
      },
    });

    return NextResponse.json({ url: session.url }, { status: 200 });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Internal server error.";
    console.error("[/api/checkout]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
