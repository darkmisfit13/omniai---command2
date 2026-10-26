-- Media library + provider quota notifications for OmniAI.
--
-- Adds:
--   * storage bucket "media" (private) for uploads and generated media
--   * public.media_assets : index of every stored image/video/audio
--   * public.provider_alerts : "switch provider" notifications raised by the
--     generation router when a free provider runs out of quota / is missing
--     a key. Per policy, media generation never falls back to local, so this
--     table is how the owner is told to rotate keys instead.
--
-- This migration is RE-RUNNABLE and NON-DESTRUCTIVE. It drops nothing. Tables
-- and the bucket use IF NOT EXISTS / ON CONFLICT, and each policy is created
-- only when one with that name is not already present. The owner id is injected
-- with EXECUTE + format(%L), the same pattern the earlier migrations use, so it
-- behaves identically whether you run it from the Supabase SQL editor or with
-- `supabase db push`.

DO $$
DECLARE
  verified_owner uuid := '07332edf-15ce-434b-b683-4c68a7277030';
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = verified_owner AND email = 'darkmisfitlabs@hotmail.com'
  ) THEN
    RAISE EXCEPTION 'Verified owner identity does not match; migration aborted';
  END IF;

  ---------------------------------------------------------------------------
  -- Index of stored media
  ---------------------------------------------------------------------------
  CREATE TABLE IF NOT EXISTS public.media_assets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    kind text NOT NULL CHECK (kind IN ('image', 'video', 'audio')),
    source text NOT NULL CHECK (source IN ('upload', 'generated')),
    prompt text,
    provider text,
    model text,
    storage_path text NOT NULL,
    mime_type text,
    size_bytes bigint,
    width int,
    height int,
    duration_seconds numeric,
    created_at timestamptz NOT NULL DEFAULT now()
  );

  ---------------------------------------------------------------------------
  -- Provider quota / missing-key notifications
  ---------------------------------------------------------------------------
  CREATE TABLE IF NOT EXISTS public.provider_alerts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    pipeline text NOT NULL,
    provider text NOT NULL,
    reason text NOT NULL CHECK (reason IN ('quota', 'missing_key', 'error')),
    message text NOT NULL,
    acknowledged boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
  );

  ALTER TABLE public.media_assets ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.provider_alerts ENABLE ROW LEVEL SECURITY;

  -- Row-level security is what actually protects these tables: with RLS on and
  -- only an owner "authenticated" policy, the anon role can read nothing.
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.media_assets TO authenticated;
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.provider_alerts TO authenticated;

  -- Owner-only policy for media_assets (created only if absent).
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'media_assets'
      AND policyname = 'verified owner access'
  ) THEN
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated '
      || 'USING ((SELECT auth.uid()) = %L::uuid) '
      || 'WITH CHECK ((SELECT auth.uid()) = %L::uuid)',
      'verified owner access', 'media_assets', verified_owner, verified_owner
    );
  END IF;

  -- Owner-only policy for provider_alerts (created only if absent).
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'provider_alerts'
      AND policyname = 'verified owner access'
  ) THEN
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated '
      || 'USING ((SELECT auth.uid()) = %L::uuid) '
      || 'WITH CHECK ((SELECT auth.uid()) = %L::uuid)',
      'verified owner access', 'provider_alerts', verified_owner, verified_owner
    );
  END IF;

  ---------------------------------------------------------------------------
  -- Private storage bucket
  ---------------------------------------------------------------------------
  INSERT INTO storage.buckets (id, name, public)
  VALUES ('media', 'media', false)
  ON CONFLICT (id) DO NOTHING;
END
$$;

-- Storage access policies, kept in their own block so that a project which
-- restricts creating policies on storage.objects via SQL still gets the tables
-- above. If this block reports insufficient privilege, create the four policies
-- from the Dashboard instead: Storage > media > Policies.
DO $$
DECLARE
  verified_owner uuid := '07332edf-15ce-434b-b683-4c68a7277030';
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'media owner read'
  ) THEN
    EXECUTE format(
      'CREATE POLICY %I ON storage.objects FOR SELECT TO authenticated '
      || 'USING (bucket_id = %L AND (SELECT auth.uid()) = %L::uuid)',
      'media owner read', 'media', verified_owner
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'media owner insert'
  ) THEN
    EXECUTE format(
      'CREATE POLICY %I ON storage.objects FOR INSERT TO authenticated '
      || 'WITH CHECK (bucket_id = %L AND (SELECT auth.uid()) = %L::uuid)',
      'media owner insert', 'media', verified_owner
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'media owner update'
  ) THEN
    EXECUTE format(
      'CREATE POLICY %I ON storage.objects FOR UPDATE TO authenticated '
      || 'USING (bucket_id = %L AND (SELECT auth.uid()) = %L::uuid) '
      || 'WITH CHECK (bucket_id = %L AND (SELECT auth.uid()) = %L::uuid)',
      'media owner update', 'media', verified_owner, 'media', verified_owner
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'media owner delete'
  ) THEN
    EXECUTE format(
      'CREATE POLICY %I ON storage.objects FOR DELETE TO authenticated '
      || 'USING (bucket_id = %L AND (SELECT auth.uid()) = %L::uuid)',
      'media owner delete', 'media', verified_owner
    );
  END IF;
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'Skipped storage.objects policies (insufficient privilege). Create them from Storage > media > Policies.';
END
$$;
