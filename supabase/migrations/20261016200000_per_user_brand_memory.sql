-- 20261016200000_per_user_brand_memory.sql
--
-- The long-term memory engine used to be a single workspace profile owned by
-- the platform creator. brand_memory kept the owner-only policy from the
-- pilot, so a paying customer could neither read nor write their own memory —
-- every thread started from a blank slate. That is the wrong shape for a
-- product: memory is per-person context.
--
-- This adds an owner_id to brand_memory, backfills the existing rows to the
-- pilot (they are the creator's, by construction), and scopes the policy to
-- the caller. The creator keeps their rows; every other account gets its own.
--
-- Idempotent and guarded: safe to re-run, and a no-op if the table is absent.

BEGIN;

DO $$
DECLARE
  pilot uuid := '07332edf-15ce-434b-b683-4c68a7277030';
  pol record;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'brand_memory'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'brand_memory'
        AND column_name = 'owner_id'
    ) THEN
      ALTER TABLE public.brand_memory ADD COLUMN owner_id uuid;
    END IF;

    -- Rows that predate multi-tenancy belong to the creator by construction.
    UPDATE public.brand_memory SET owner_id = pilot WHERE owner_id IS NULL;

    ALTER TABLE public.brand_memory ALTER COLUMN owner_id SET DEFAULT auth.uid();
    ALTER TABLE public.brand_memory ALTER COLUMN owner_id SET NOT NULL;

    CREATE INDEX IF NOT EXISTS brand_memory_owner_idx
      ON public.brand_memory (owner_id);

    -- Replace whatever policy the pilot migrations left behind.
    FOR pol IN
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'brand_memory'
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.brand_memory', pol.policyname);
    END LOOP;

    EXECUTE
      'CREATE POLICY brand_memory_owner_access ON public.brand_memory '
      'FOR ALL TO authenticated '
      'USING ((SELECT auth.uid()) = owner_id) '
      'WITH CHECK ((SELECT auth.uid()) = owner_id)';
  END IF;
END
$$;

COMMIT;
