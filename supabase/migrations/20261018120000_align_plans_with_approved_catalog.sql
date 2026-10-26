-- Align public.plans display metadata with the approved catalog.
--
-- Root cause: the storefront and checkout read prices from
-- lib/billing/creditTable.ts and the active Stripe Price, so the figures a
-- customer sees and is charged were already correct. But plans.name and
-- plans.price_usd still carried the pre-repricing values (Creator / Pro /
-- Business at $19 / $39 / $99) from the original seed, while plans.stripe_price_id
-- was already pointing at the repaired $9 / $24 / $49 live prices. That is a
-- latent trap: any future surface that reads plans.price_usd, or a fresh
-- analytics/export, would advertise a price the API does not charge.
--
-- This is metadata-only and non-destructive:
--   * tiers, monthly_credits and stripe_price_id are untouched;
--   * no live Stripe object is created, archived or modified;
--   * the values written are exactly the already-approved catalog
--     (Omni Free $0, Omni Plus $9, Omni Pro $24, Omni Ultra $49), matching
--     lib/billing/creditTable.ts and the active Stripe prices.
UPDATE public.plans SET name = 'Omni Free',  price_usd = 0  WHERE tier = 'free';
UPDATE public.plans SET name = 'Omni Plus',  price_usd = 9  WHERE tier = 'creator';
UPDATE public.plans SET name = 'Omni Pro',   price_usd = 24 WHERE tier = 'pro';
UPDATE public.plans SET name = 'Omni Ultra', price_usd = 49 WHERE tier = 'business';
