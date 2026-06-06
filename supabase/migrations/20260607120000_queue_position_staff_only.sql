-- Step 1.2 (SEC-R04): restrict queue_position to staff callers only

REVOKE EXECUTE ON FUNCTION public.queue_position(UUID) FROM authenticated;

CREATE OR REPLACE FUNCTION public.queue_position(_request_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.aid_requests%ROWTYPE;
  v_pending_total INT;
  v_position INT;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT * INTO v_row FROM public.aid_requests WHERE id = _request_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT COUNT(*)::INT INTO v_pending_total
  FROM public.aid_requests r
  WHERE r.status IN ('submitted', 'reviewing', 'verifying', 'on_hold');

  SELECT COUNT(*)::INT + 1 INTO v_position
  FROM public.aid_requests r
  WHERE r.status IN ('submitted', 'reviewing', 'verifying', 'on_hold')
    AND r.id <> _request_id
    AND (
      COALESCE(r.effective_urgency, r.urgency_score, 0) > COALESCE(v_row.effective_urgency, v_row.urgency_score, 0)
      OR (
        COALESCE(r.effective_urgency, r.urgency_score, 0) = COALESCE(v_row.effective_urgency, v_row.urgency_score, 0)
        AND r.queue_number < v_row.queue_number
      )
    );

  RETURN jsonb_build_object(
    'queue_number', v_row.queue_number,
    'position_among_pending', v_position,
    'pending_total', v_pending_total
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.queue_position(UUID) TO authenticated;
