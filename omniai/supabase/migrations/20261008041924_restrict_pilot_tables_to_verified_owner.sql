DO $$
DECLARE
  t text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = '07332edf-15ce-434b-b683-4c68a7277030'::uuid AND email = 'darkmisfitlabs@hotmail.com') THEN
    RAISE EXCEPTION 'Verified owner identity does not match; migration aborted';
  END IF;
  FOREACH t IN ARRAY ARRAY['messages','persona','brand_memory','providers','allowed_actions','approval_queue','audit_log','spend_tracking'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'owner full access', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING ((SELECT auth.uid()) = %L::uuid) WITH CHECK ((SELECT auth.uid()) = %L::uuid)', 'verified owner access', t, '07332edf-15ce-434b-b683-4c68a7277030', '07332edf-15ce-434b-b683-4c68a7277030');
    EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM anon, PUBLIC', t);
    EXECUTE format('REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLE public.%I FROM authenticated', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO authenticated', t);
  END LOOP;
END
$$;
