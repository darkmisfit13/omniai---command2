-- 20261014100000_multi_tenant_row_ownership.sql
--
-- Until now every policy in this database asked the same question: "are you
-- the one hardcoded owner?" That was the correct question for a pilot and it
-- is the wrong one for a product you sell — a second account is turned away at
-- the door, so it can never reach a row of its own. Nothing below changes what
-- the pilot owner sees; it only stops the door from being a single key.
--
-- Three groups, because they are genuinely different things:
--
--   PER USER    what a person generates — conversations, their messages, their
--               media, their editor projects, their alerts, approvals and audit
--               trail. These gain an owner_id and the policy becomes
--               "owner_id = the caller". Approval and audit rows are read-only
--               from the browser: their writes belong to server-side RPCs.
--
--   SHARED      the program itself — persona, provider list, spend caps.
--               Everyone reads them; only the owner writes them. Making these
--               per-user would give every account an empty AI on first sign-in.
--
--   UNTOUCHED   provider keys (the platform's secrets), plus brand memory and
--               allowed actions, which the app never reads. All three keep the
--               owner-only policy they already have.
--
-- Every statement is guarded by a catalog check and the whole script is
-- idempotent: re-running it is a no-op. Ownership is derived where it can be —
-- a message inherits its conversation's owner, an asset inherits the user
-- folder its storage path already sits under — so nothing is guessed.

BEGIN;

DO $$
DECLARE
  pilot uuid := '07332edf-15ce-434b-b683-4c68a7277030';
  tbl text;
  pol record;
  derive text;
BEGIN
  -- Same guard the original pilot migration used: refuse to run against a
  -- database whose owner does not match, rather than silently re-homing rows.
  IF NOT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = pilot AND email = 'darkmisfitlabs@hotmail.com'
  ) THEN
    RAISE EXCEPTION 'Verified owner identity does not match; migration aborted';
  END IF;

  ------------------------------------------------------------------
  -- PER USER tables: add owner_id, backfill it, index it, scope it.
  ------------------------------------------------------------------
  FOREACH tbl IN ARRAY ARRAY[
    'messages', 'media_assets', 'provider_alerts',
    'approval_queue', 'audit_log'
  ] LOOP
    CONTINUE WHEN NOT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = tbl
    );

    -- Cleared first: only two of the five tables have an owner worth deriving,
    -- and carrying the previous iteration's statement forward would re-home the
    -- wrong table.
    derive := NULL;

    -- Add the column only if it is missing; nullable for the length of this
    -- block so a failed backfill cannot leave the table un-writable.
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = tbl
        AND column_name = 'owner_id'
    ) THEN
      EXECUTE format('ALTER TABLE public.%I ADD COLUMN owner_id uuid', tbl);
    END IF;

    -- Derive ownership from whatever the table already knows about it.
    IF tbl = 'messages' THEN
      derive := $d$
        UPDATE public.messages m
           SET owner_id = c.owner_id
          FROM public.conversations c
         WHERE m.conversation_id = c.id
           AND m.owner_id IS NULL
      $d$;
    ELSIF tbl = 'media_assets' THEN
      -- Storage paths are written as "<user uuid>/<asset uuid>.<ext>", so the
      -- folder already names the owner. Fall back to the pilot for anything
      -- stored outside that layout (hand-uploaded rows).
      derive := $d$
        UPDATE public.media_assets
           SET owner_id = split_part(storage_path, '/', 1)::uuid
         WHERE owner_id IS NULL
           AND storage_path LIKE '%/%'
           AND split_part(storage_path, '/', 1) ~*
              '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      $d$;
    END IF;

    IF derive IS NOT NULL THEN
      EXECUTE derive;
    END IF;

    -- Anything still unowned predates conversations and storage layout; it is
    -- the pilot's by construction.
    EXECUTE format(
      'UPDATE public.%I SET owner_id = $1 WHERE owner_id IS NULL', tbl
    ) USING pilot;

    EXECUTE format(
      'ALTER TABLE public.%I ALTER COLUMN owner_id SET DEFAULT auth.uid()', tbl
    );
    EXECUTE format(
      'ALTER TABLE public.%I ALTER COLUMN owner_id SET NOT NULL', tbl
    );
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON public.%I (owner_id)', tbl || '_owner_idx', tbl
    );

    -- Replace every existing policy rather than guessing its name — the pilot
    -- migrations generated theirs from a loop, and a stale policy left behind
    -- would keep enforcing the old single-owner rule.
    FOR pol IN
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = tbl
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, tbl);
    END LOOP;

    IF tbl IN ('approval_queue', 'audit_log') THEN
      -- These two stay read-only in the browser. Approvals and audit entries
      -- are written by SECURITY DEFINER RPCs, which skip RLS and stamp the
      -- calling user themselves; handing clients a write policy here would
      -- quietly reopen a door an earlier migration deliberately closed.
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated '
        'USING ((SELECT auth.uid()) = owner_id)',
        tbl || ' owner read', tbl
      );
    ELSE
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR ALL TO authenticated '
        'USING ((SELECT auth.uid()) = owner_id) '
        'WITH CHECK ((SELECT auth.uid()) = owner_id)',
        tbl || ' owner access', tbl
      );
    END IF;
  END LOOP;

  ------------------------------------------------------------------
  -- SHARED: read for every signed-in account, write for the owner.
  -- brand_memory and allowed_actions are deliberately absent — the app
  -- never reads them, so they keep the owner-only policy they already
  -- have and this migration does not widen them.
  ------------------------------------------------------------------
  FOREACH tbl IN ARRAY ARRAY['persona', 'providers', 'spend_tracking'] LOOP
    CONTINUE WHEN NOT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = tbl
    );

    FOR pol IN
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = tbl
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, tbl);
    END LOOP;

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (true)',
      tbl || ' readable', tbl
    );
    -- Inlined rather than bound: CREATE POLICY parses its expression at
    -- definition time, where a $1 parameter has nothing to refer to.
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated '
      'USING ((SELECT auth.uid()) = %L) WITH CHECK ((SELECT auth.uid()) = %L)',
      tbl || ' owner write', tbl, pilot, pilot
    );
  END LOOP;

END
$$;

------------------------------------------------------------------
-- Conversations: the table already carried owner_id, but its policy
-- AND-ed the caller against the pilot uuid. Drop that clause.
------------------------------------------------------------------
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'conversations'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.conversations', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY conversations_owner_access ON public.conversations
  FOR ALL TO authenticated
  USING (owner_id = (SELECT auth.uid()))
  WITH CHECK (owner_id = (SELECT auth.uid()));

------------------------------------------------------------------
-- Storage: the media bucket is already written to "<user uuid>/…",
-- so ownership is the folder — no uuid literal required.
------------------------------------------------------------------
DO $$
DECLARE pol record;
BEGIN
  -- Matched on the policy body, not just its name: policies are permissive and
  -- OR together, so one surviving rule mentioning the media bucket would keep
  -- opening it no matter how many correct ones are written alongside it.
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND (
        policyname LIKE 'media%'
        OR coalesce(qual, '') LIKE '%' || quote_literal('media') || '%'
        OR coalesce(with_check, '') LIKE '%' || quote_literal('media') || '%'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "media folder read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'media' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);
CREATE POLICY "media folder insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'media' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);
CREATE POLICY "media folder update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'media' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text)
  WITH CHECK (bucket_id = 'media' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);
CREATE POLICY "media folder delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'media' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);

COMMIT;
