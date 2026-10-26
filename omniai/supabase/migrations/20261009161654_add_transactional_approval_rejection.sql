-- Add an owner-only rejection operation.
-- Website approval and execution remain disabled.
-- Existing table permissions remain unchanged during frontend rollout.

CREATE FUNCTION public.reject_approval(p_approval_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_owner_id CONSTANT uuid := '07332edf-15ce-434b-b683-4c68a7277030';
  v_actor_id uuid;
  v_item public.approval_queue%ROWTYPE;
  v_resolved_at timestamptz;
  v_audit_id uuid;
BEGIN
  v_actor_id := auth.uid();

  IF v_actor_id IS NULL OR v_actor_id <> v_owner_id THEN
    RAISE EXCEPTION 'Not authorized to reject approval items'
      USING ERRCODE = '42501';
  END IF;

  IF p_approval_id IS NULL THEN
    RAISE EXCEPTION 'Approval item ID is required'
      USING ERRCODE = '22023';
  END IF;

  SELECT q.*
  INTO v_item
  FROM public.approval_queue AS q
  WHERE q.id = p_approval_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Approval item was not found'
      USING ERRCODE = 'P0002';
  END IF;

  IF v_item.status <> 'pending' THEN
    RAISE EXCEPTION 'Approval item is already resolved'
      USING ERRCODE = '55000';
  END IF;

  v_resolved_at := pg_catalog.clock_timestamp();

  UPDATE public.approval_queue
  SET
    status = 'rejected',
    resolved_at = v_resolved_at
  WHERE id = v_item.id;

  INSERT INTO public.audit_log (
    action,
    outcome,
    detail
  )
  VALUES (
    v_item.action,
    'rejected',
    pg_catalog.jsonb_build_object(
      'event', 'approval.rejected',
      'approval_id', v_item.id,
      'actor_id', v_actor_id,
      'action', v_item.action,
      'payload', v_item.payload,
      'resolved_at', v_resolved_at
    )::text
  )
  RETURNING id INTO v_audit_id;

  RETURN pg_catalog.jsonb_build_object(
    'approval_id', v_item.id,
    'status', 'rejected',
    'resolved_at', v_resolved_at,
    'audit_id', v_audit_id
  );
END;
$function$;

ALTER FUNCTION public.reject_approval(uuid) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.reject_approval(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reject_approval(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.reject_approval(uuid) FROM service_role;
REVOKE ALL ON FUNCTION public.reject_approval(uuid) FROM authenticated;

GRANT EXECUTE ON FUNCTION public.reject_approval(uuid) TO authenticated;

COMMENT ON FUNCTION public.reject_approval(uuid) IS
  'Rejects one pending approval item for the designated owner and records its audit entry in the same transaction. Does not approve or execute actions.';