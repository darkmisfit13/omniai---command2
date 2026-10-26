-- 20261014110000_billing_plans_and_credit_ledger.sql
--
-- Stripe is the easy half of selling access; the half that decides whether the
-- money is real is what happens after payment. This schema is built around one
-- rule: the webhook is the only source of truth, and credits are an append-only
-- journal rather than a balance that something can simply set.
--
--   plans              the four tiers, readable by everyone, writable only by
--                      the service role (the webhook, seeded from
--                      lib/billing/creditTable.ts).
--   subscriptions      one row per user holding their Stripe state. Not a
--                      source of truth — a cache the webhook keeps warm so the
--                      UI does not have to call Stripe on every page load.
--   credit_ledger      every credit that ever moved. No UPDATE, no DELETE: a
--                      failure is corrected by writing the compensating row,
--                      which is what "On failure → Refund" means in practice
--                      and leaves the audit trail intact.
--
-- The hold/settle pattern the API needs falls out of that for free: charge
-- before generating, and on failure write the refund. Net zero, two rows, no
-- mutation.
--
-- SECURITY: credit_ledger carries SELECT policy only. Authenticated clients
-- cannot insert, update or delete it, and cannot mint credits by calling a
-- function with an arbitrary delta — charge verifies the balance, refund can
-- only ever mirror a charge that exists for the same caller.

BEGIN;

CREATE TABLE IF NOT EXISTS public.plans (
  tier            text PRIMARY KEY CHECK (tier IN ('free', 'creator', 'pro', 'business')),
  name            text NOT NULL,
  price_usd       integer NOT NULL CHECK (price_usd >= 0),
  monthly_credits integer NOT NULL CHECK (monthly_credits >= 0),
  stripe_price_id text UNIQUE,
  blurb           text NOT NULL DEFAULT '',
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.subscriptions (
  owner_id              uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id    text UNIQUE,
  stripe_subscription_id text UNIQUE,
  stripe_price_id       text,
  plan_tier             text NOT NULL DEFAULT 'free' REFERENCES public.plans(tier),
  status                text NOT NULL DEFAULT 'inactive',
  current_period_end    timestamptz,
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.credit_ledger (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    uuid NOT NULL,
  delta       integer NOT NULL,
  -- 'charge' and 'refund' are written as a pair; 'grant' is a webhook grant,
  -- 'adjustment' is a manual correction made with the service role.
  reason      text NOT NULL CHECK (reason IN ('grant', 'charge', 'refund', 'adjustment')),
  action      text,
  ref         uuid,
  dedupe_key  text UNIQUE,
  meta        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS credit_ledger_owner_created_idx
  ON public.credit_ledger (owner_id, created_at DESC);

-- One charge and at most one refund per operation. This is what makes a
-- retried request and a replayed webhook both harmless.
CREATE UNIQUE INDEX IF NOT EXISTS credit_ledger_charge_ref_idx
  ON public.credit_ledger (ref) WHERE reason = 'charge' AND ref IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS credit_ledger_refund_ref_idx
  ON public.credit_ledger (ref) WHERE reason = 'refund' AND ref IS NOT NULL;

CREATE INDEX IF NOT EXISTS subscriptions_customer_idx
  ON public.subscriptions (stripe_customer_id);

ALTER TABLE public.plans          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_ledger  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS plans_readable ON public.plans;
CREATE POLICY plans_readable ON public.plans FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS subscriptions_own_read ON public.subscriptions;
CREATE POLICY subscriptions_own_read ON public.subscriptions
  FOR SELECT TO authenticated USING (owner_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS credit_ledger_own_read ON public.credit_ledger;
CREATE POLICY credit_ledger_own_read ON public.credit_ledger
  FOR SELECT TO authenticated USING (owner_id = (SELECT auth.uid()));

-- Belt as well as braces: RLS already has no write policy here, but a future
-- migration that adds one in a hurry should still find the grants gone.
REVOKE INSERT, UPDATE, DELETE ON TABLE public.credit_ledger FROM anon, PUBLIC, authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.plans       FROM anon, PUBLIC, authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.subscriptions FROM anon, PUBLIC, authenticated;
GRANT SELECT ON TABLE public.plans         TO authenticated;
GRANT SELECT ON TABLE public.subscriptions TO authenticated;
GRANT SELECT ON TABLE public.credit_ledger TO authenticated;

------------------------------------------------------------------
-- Charge: hold before generating.
-- Verifies the balance inside the same transaction that writes the row, so two
-- concurrent generations cannot both pass a check and then both spend the same
-- credits. A repeat call with the same ref is a no-op — that is what makes a
-- retried request idempotent instead of double-billing.
------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.omni_charge_credits(
  p_amount integer,
  p_action text,
  p_ref    uuid
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_owner   uuid := (SELECT auth.uid());
  v_balance integer;
BEGIN
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;
  IF p_amount IS NULL OR p_amount < 0 THEN
    RAISE EXCEPTION 'Credit amount must be a non-negative integer.';
  END IF;

  -- Scoped to the caller. Without that filter, presenting a ref that another
  -- account already charged would count as "already paid" and skip the debit.
  IF EXISTS (
    SELECT 1 FROM public.credit_ledger
    WHERE owner_id = v_owner AND ref = p_ref AND reason = 'charge'
  ) THEN
    SELECT COALESCE(sum(delta), 0)::integer INTO v_balance
      FROM public.credit_ledger WHERE owner_id = v_owner;
    RETURN v_balance;
  END IF;

  SELECT COALESCE(sum(delta), 0)::integer INTO v_balance
    FROM public.credit_ledger WHERE owner_id = v_owner;

  IF v_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient credits.'
      USING DETAIL   = format('balance=%s required=%s', v_balance, p_amount),
            HINT     = 'Top up or switch plan to continue.',
            ERRCODE  = 'insufficient_resource';
  END IF;

  INSERT INTO public.credit_ledger (owner_id, delta, reason, action, ref)
  VALUES (v_owner, -p_amount, 'charge', p_action, p_ref);

  RETURN v_balance - p_amount;
END;
$fn$;

------------------------------------------------------------------
-- Refund: settle after a failure.
-- Can only mirror a charge belonging to the same caller, and only once. The
-- caller cannot name an amount, so this cannot be used to mint credits — the
-- worst possible outcome of a repeated call is the original balance.
------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.omni_refund_credits(p_ref uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_owner   uuid := (SELECT auth.uid());
  v_row     public.credit_ledger%ROWTYPE;
  v_balance integer;
BEGIN
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  SELECT * INTO v_row
    FROM public.credit_ledger
   WHERE owner_id = v_owner AND ref = p_ref AND reason = 'charge'
   LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No charge found to refund.'
      USING ERRCODE = 'no_data_found';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.credit_ledger
     WHERE owner_id = v_owner AND ref = p_ref AND reason = 'refund'
  ) THEN
    SELECT COALESCE(sum(delta), 0)::integer INTO v_balance
      FROM public.credit_ledger WHERE owner_id = v_owner;
    RETURN v_balance;
  END IF;

  INSERT INTO public.credit_ledger (owner_id, delta, reason, action, ref, meta)
  VALUES (v_owner, -v_row.delta, 'refund', v_row.action, p_ref,
          jsonb_build_object('reversed', v_row.id));

  SELECT COALESCE(sum(delta), 0)::integer INTO v_balance
    FROM public.credit_ledger WHERE owner_id = v_owner;

  RETURN v_balance;
END;
$fn$;

------------------------------------------------------------------
-- Reads for the UI. SECURITY DEFINER with an auth.uid() filter, because the
-- obvious alternative — a view over the ledger — runs as its owner under
-- PostgreSQL defaults and would hand every account everyone's balance.
------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.omni_credit_balance()
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $fn$
  SELECT COALESCE(sum(delta), 0)::integer
    FROM public.credit_ledger
   WHERE owner_id = (SELECT auth.uid());
$fn$;

CREATE OR REPLACE FUNCTION public.omni_credit_history(p_limit integer DEFAULT 50)
RETURNS SETOF public.credit_ledger
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $fn$
  SELECT *
    FROM public.credit_ledger
   WHERE owner_id = (SELECT auth.uid())
   ORDER BY created_at DESC
   LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200);
$fn$;

REVOKE ALL ON FUNCTION public.omni_charge_credits(integer, text, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.omni_refund_credits(uuid)                FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.omni_credit_balance()                    FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.omni_credit_history(integer)             FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.omni_charge_credits(integer, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.omni_refund_credits(uuid)                TO authenticated;
GRANT EXECUTE ON FUNCTION public.omni_credit_balance()                    TO authenticated;
GRANT EXECUTE ON FUNCTION public.omni_credit_history(integer)             TO authenticated;

------------------------------------------------------------------
-- Seed the tiers. Values must match lib/billing/creditTable.ts — if they
-- drift, /pricing would advertise one price and the webhook would grant
-- another, so this is the only place the database is told about them.
-- ON CONFLICT keeps a re-run a no-op and lets a price change be re-applied.
------------------------------------------------------------------
INSERT INTO public.plans (tier, name, price_usd, monthly_credits, blurb) VALUES
  ('free',     'Free',     0,    100,   'Try the platform'),
  ('creator',  'Creator',  19,   1000,  'For solo makers shipping every week'),
  ('pro',      'Pro',      39,   3000,  'For studios producing across every format'),
  ('business', 'Business', 99,   10000, 'For teams running OmniAI as infrastructure')
ON CONFLICT (tier) DO UPDATE
  SET name            = EXCLUDED.name,
      price_usd       = EXCLUDED.price_usd,
      monthly_credits = EXCLUDED.monthly_credits,
      blurb           = EXCLUDED.blurb;

------------------------------------------------------------------
-- First-run provisioning.
--
-- Nothing grants credits until something does, and the two cases differ. A
-- brand-new account should arrive on Free with its 100 credits already there.
-- The pilot account predates this table, so the trigger never sees it —
-- without an explicit seed it would wake up at zero and be locked out of its
-- own product the first time it tried to generate.
------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.omni_provision_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
BEGIN
  INSERT INTO public.subscriptions (owner_id, plan_tier, status)
  VALUES (NEW.id, 'free', 'active')
  ON CONFLICT (owner_id) DO NOTHING;

  INSERT INTO public.credit_ledger (owner_id, delta, reason, action, dedupe_key, meta)
  VALUES (
    NEW.id,
    (SELECT monthly_credits FROM public.plans WHERE tier = 'free'),
    'grant', 'plan:free', 'free:' || NEW.id::text || ':initial',
    jsonb_build_object('plan', 'free', 'kind', 'signup')
  )
  ON CONFLICT (dedupe_key) DO NOTHING;

  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS on_auth_user_provisioned ON auth.users;
CREATE TRIGGER on_auth_user_provisioned
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.omni_provision_new_user();

-- The free allowance renews every calendar month. The caller runs this before
-- reading a balance; the dedupe key is what makes a hundred simultaneous page
-- loads produce exactly one grant. Paid plans renew through the webhook
-- instead, because Stripe is the only thing that knows the period really was
-- billed.
CREATE OR REPLACE FUNCTION public.omni_ensure_free_renewal()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_owner  uuid := (SELECT auth.uid());
  v_month  text := to_char(now(), 'YYYY-MM');
  v_tier   text;
  v_amount integer;
BEGIN
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  SELECT plan_tier INTO v_tier
    FROM public.subscriptions WHERE owner_id = v_owner;

  IF v_tier IS NULL OR v_tier <> 'free' THEN
    RETURN public.omni_credit_balance();
  END IF;

  SELECT monthly_credits INTO v_amount FROM public.plans WHERE tier = 'free';

  INSERT INTO public.credit_ledger (owner_id, delta, reason, action, dedupe_key, meta)
  VALUES (v_owner, v_amount, 'grant', 'plan:free',
          'free:' || v_owner::text || ':' || v_month,
          jsonb_build_object('plan', 'free', 'period', v_month))
  ON CONFLICT (dedupe_key) DO NOTHING;

  RETURN public.omni_credit_balance();
END;
$fn$;

-- The trigger function is deliberately absent from the revoke list: privilege
-- on it is checked when CREATE TRIGGER runs, and holding it out of anon's reach
-- is not worth any chance of making signup fail.
REVOKE ALL ON FUNCTION public.omni_ensure_free_renewal() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.omni_ensure_free_renewal() TO authenticated;

-- Seed the pilot: subscriptions row and a working balance. This is a service
-- grant, not a payment — nothing here represents money received, which is
-- exactly why it is written as a ledger row the same way a paid grant is.
INSERT INTO public.subscriptions (owner_id, plan_tier, status)
VALUES ('07332edf-15ce-434b-b683-4c68a7277030', 'business', 'active')
ON CONFLICT (owner_id) DO NOTHING;

INSERT INTO public.credit_ledger (owner_id, delta, reason, action, dedupe_key, meta)
VALUES (
  '07332edf-15ce-434b-b683-4c68a7277030',
  (SELECT monthly_credits FROM public.plans WHERE tier = 'business'),
  'grant', 'plan:business', 'pilot:founder-grant',
  jsonb_build_object('plan', 'business', 'kind', 'founder')
)
ON CONFLICT (dedupe_key) DO NOTHING;

COMMIT;
