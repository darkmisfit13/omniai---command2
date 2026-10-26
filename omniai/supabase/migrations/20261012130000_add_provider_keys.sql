-- In-app provider credentials for OmniAI's Media Studio.
--
-- Adds public.provider_keys: owner-only rows that hold an encrypted copy of a
-- provider credential (keyed by the environment-variable name it stands in
-- for, e.g. "HUGGINGFACE_API_KEY"). The ciphertext is AES-256-GCM encrypted
-- server-side with OMNIAI_KEY_SECRET, so the browser (which can read its own
-- RLS rows) still cannot recover the plaintext.
--
-- This migration is RE-RUNNABLE and NON-DESTRUCTIVE. It drops nothing; the
-- table uses IF NOT EXISTS and the policy is created only when absent. The
-- owner id is injected with EXECUTE + format(%L), the same pattern the other
-- migrations use, so it works from the SQL editor or `supabase db push`.

DO $$
DECLARE
  verified_owner uuid := '07332edf-15ce-434b-b683-4c68a7277030';
BEGIN
  CREATE TABLE IF NOT EXISTS public.provider_keys (
    env_name text PRIMARY KEY,
    ciphertext text NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now()
  );

  ALTER TABLE public.provider_keys ENABLE ROW LEVEL SECURITY;

  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.provider_keys TO authenticated;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'provider_keys'
      AND policyname = 'verified owner access'
  ) THEN
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated '
      || 'USING ((SELECT auth.uid()) = %L::uuid) '
      || 'WITH CHECK ((SELECT auth.uid()) = %L::uuid)',
      'verified owner access', 'provider_keys', verified_owner, verified_owner
    );
  END IF;
END
$$;
