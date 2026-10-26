-- Browser clients may read these tables, but writes must use
-- explicitly authorized server-side operations.

DO $$
DECLARE
  t text;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM auth.users
    WHERE id = '07332edf-15ce-434b-b683-4c68a7277030'::uuid
      AND email = 'darkmisfitlabs@hotmail.com'
  ) THEN
    RAISE EXCEPTION
      'Verified owner identity does not match; migration aborted';
  END IF;

  FOREACH t IN ARRAY ARRAY['approval_queue', 'audit_log'] LOOP
    EXECUTE format(
      'ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',
      t
    );

    EXECUTE format(
      'REVOKE ALL PRIVILEGES ON TABLE public.%I FROM anon, PUBLIC, authenticated',
      t
    );

    EXECUTE format(
      'GRANT SELECT ON TABLE public.%I TO authenticated',
      t
    );

    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.%I',
      'owner full access',
      t
    );

    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.%I',
      'verified owner access',
      t
    );

    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.%I',
      'verified owner read',
      t
    );

    EXECUTE format(
      'CREATE POLICY %I ON public.%I
       FOR SELECT TO authenticated
       USING ((SELECT auth.uid()) = %L::uuid)',
      'verified owner read',
      t,
      '07332edf-15ce-434b-b683-4c68a7277030'
    );
  END LOOP;
END
$$;