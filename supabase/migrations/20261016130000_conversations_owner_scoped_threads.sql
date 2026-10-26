-- 20261016130000_conversations_owner_scoped_threads.sql
--
-- Thread management (rename / archive) must work for the account that owns the
-- thread, not only for the original pilot. Earlier migrations scoped
-- `public.conversations` to the single hardcoded owner and never widened it, so
-- a signed-in customer could read nothing and rename/delete would silently
-- touch zero rows.
--
-- This migration makes the table owner-scoped (the same rule every other
-- per-user table already follows) and restores the SELECT / INSERT / UPDATE /
-- DELETE grants the AI Director needs. Idempotent and safe on the pilot DB.

DO $$
DECLARE
  pol text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'conversations'
  ) THEN
    RETURN;
  END IF;

  -- Column: owner_id (nullable while backfilling).
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'conversations'
      AND column_name = 'owner_id'
  ) THEN
    ALTER TABLE public.conversations ADD COLUMN owner_id uuid DEFAULT auth.uid();
    UPDATE public.conversations
       SET owner_id = '07332edf-15ce-434b-b683-4c68a7277030'::uuid
     WHERE owner_id IS NULL;
    ALTER TABLE public.conversations ALTER COLUMN owner_id SET NOT NULL;
    CREATE INDEX IF NOT EXISTS conversations_owner_idx
      ON public.conversations (owner_id);
  END IF;

  -- Column: archived_at (archive, never hard-delete — messages RESTRICT).
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'conversations'
      AND column_name = 'archived_at'
  ) THEN
    ALTER TABLE public.conversations ADD COLUMN archived_at timestamptz;
  END IF;

  ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

  REVOKE ALL PRIVILEGES ON TABLE public.conversations FROM anon, PUBLIC;
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.conversations TO authenticated;

  -- Replace every existing policy — the pilot migrations named theirs from a
  -- loop, and a stale single-owner policy left behind would keep enforcing the
  -- old rule.
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'conversations'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.conversations', pol);
  END LOOP;

  CREATE POLICY "conversations owner access"
    ON public.conversations
    FOR ALL TO authenticated
    USING ((SELECT auth.uid()) = owner_id)
    WITH CHECK ((SELECT auth.uid()) = owner_id);
END
$$;
