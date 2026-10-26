-- Provider enable/disable state for OmniAI's Admin -> AI Providers console.
--
-- Adds public.provider_settings: owner-controlled on/off switches per provider
-- id (e.g. "openai", "elevenlabs"). Deleting an API key disconnects a provider;
-- this table lets the owner pause a provider without losing its stored key.
-- The enabled flag is not a secret, so any signed-in user may READ it (the
-- generation routers need it to skip paused providers for customers too), but
-- only the verified owner may write.
--
-- This migration is RE-RUNNABLE and NON-DESTRUCTIVE. It drops nothing; the
-- table uses IF NOT EXISTS and policies are created only when absent. The
-- owner id is injected with EXECUTE + format(%L), the same pattern the other
-- migrations use, so it works from the SQL editor or `supabase db push`.

DO $$
DECLARE
  verified_owner uuid := '07332edf-15ce-434b-b683-4c68a7277030';
BEGIN
  CREATE TABLE IF NOT EXISTS public.provider_settings (
    provider_id text PRIMARY KEY,
    enabled boolean NOT NULL DEFAULT true,
    updated_at timestamptz NOT NULL DEFAULT now()
  );

  ALTER TABLE public.provider_settings ENABLE ROW LEVEL SECURITY;

  GRANT SELECT ON TABLE public.provider_settings TO authenticated;
  GRANT INSERT, UPDATE, DELETE ON TABLE public.provider_settings TO authenticated;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'provider_settings'
      AND policyname = 'provider status readable'
  ) THEN
    CREATE POLICY "provider status readable" ON public.provider_settings
      FOR SELECT TO authenticated USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'provider_settings'
      AND policyname = 'verified owner access'
  ) THEN
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING ((SELECT auth.uid()) = %L::uuid) WITH CHECK ((SELECT auth.uid()) = %L::uuid)',
      'verified owner access', 'provider_settings', verified_owner, verified_owner
    );
  END IF;
END $$;
