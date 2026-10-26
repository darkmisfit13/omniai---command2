-- 20261016120000_security_shield_audit.sql
--
-- Repository Protection Protocol — secure audit sink.
--
-- Shield decisions (and every blocked system-modification attempt) are written
-- to public.audit_log, which the browser may only SELECT. Writes come from this
-- SECURITY DEFINER RPC. The actor is stamped by the function from auth.uid();
-- the row is owned by the sovereign administrator so the owner's Audit Log page
-- shows events raised by ANY account, while other accounts cannot read them.
--
-- Idempotent: safe to apply whether or not the multi-tenant ownership
-- migration has already added audit_log.owner_id.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'audit_log'
      AND column_name = 'owner_id'
  ) THEN
    ALTER TABLE public.audit_log ADD COLUMN owner_id uuid;
    UPDATE public.audit_log
       SET owner_id = '07332edf-15ce-434b-b683-4c68a7277030'::uuid
     WHERE owner_id IS NULL;
    ALTER TABLE public.audit_log ALTER COLUMN owner_id SET DEFAULT auth.uid();
    ALTER TABLE public.audit_log ALTER COLUMN owner_id SET NOT NULL;
    CREATE INDEX IF NOT EXISTS audit_log_owner_idx
      ON public.audit_log (owner_id);
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.log_security_event(
  p_action text,
  p_outcome text,
  p_detail jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_owner CONSTANT uuid := '07332edf-15ce-434b-b683-4c68a7277030';
  v_actor uuid := auth.uid();
  v_id uuid;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING ERRCODE = '42501';
  END IF;

  IF p_outcome IS NULL OR p_outcome NOT IN (
    'allowed', 'blocked', 'approved', 'rejected'
  ) THEN
    RAISE EXCEPTION 'Invalid audit outcome'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.audit_log (action, outcome, detail, owner_id)
  VALUES (
    COALESCE(NULLIF(btrim(p_action), ''), 'security.event'),
    p_outcome,
    COALESCE(p_detail, '{}'::jsonb)::text,
    v_owner
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$;

ALTER FUNCTION public.log_security_event(text, text, jsonb) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.log_security_event(text, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.log_security_event(text, text, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.log_security_event(text, text, jsonb) FROM service_role;
REVOKE ALL ON FUNCTION public.log_security_event(text, text, jsonb) FROM authenticated;

GRANT EXECUTE ON FUNCTION public.log_security_event(text, text, jsonb) TO authenticated;

COMMENT ON FUNCTION public.log_security_event(text, text, jsonb) IS
  'Records a security/shield event in the owner-visible audit log. Stamps the caller identity; refuses unauthenticated callers. Read-only for everyone else.';
