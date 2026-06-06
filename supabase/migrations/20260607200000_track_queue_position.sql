-- Step 9.1 (FEAT-Y02): applicant queue position scoped to reference code + phone

CREATE OR REPLACE FUNCTION public.track_queue_position(_code TEXT, _phone TEXT)
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
  SELECT * INTO v_row
  FROM public.aid_requests r
  WHERE upper(r.reference_code) = upper(_code)
    AND regexp_replace(r.phone, '[^0-9]', '', 'g') = regexp_replace(_phone, '[^0-9]', '', 'g')
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF v_row.status NOT IN ('submitted', 'reviewing', 'verifying', 'on_hold') THEN
    RETURN NULL;
  END IF;

  SELECT COUNT(*)::INT INTO v_pending_total
  FROM public.aid_requests r
  WHERE r.status IN ('submitted', 'reviewing', 'verifying', 'on_hold');

  SELECT COUNT(*)::INT + 1 INTO v_position
  FROM public.aid_requests r
  WHERE r.status IN ('submitted', 'reviewing', 'verifying', 'on_hold')
    AND r.id <> v_row.id
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

REVOKE ALL ON FUNCTION public.track_queue_position(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.track_queue_position(TEXT, TEXT) TO anon, authenticated;
