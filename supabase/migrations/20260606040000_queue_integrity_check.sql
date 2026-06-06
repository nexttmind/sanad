-- PRD v2 Feature D2: queue integrity checks (admin-triggered)

CREATE OR REPLACE FUNCTION public.check_queue_integrity()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max_queue BIGINT;
  v_total_with_queue INT;
  v_seq_last BIGINT;
  v_seq_called BOOLEAN;
  v_seq_next BIGINT;
  v_dup_queue JSONB;
  v_dup_phones JSONB;
  v_pending_total INT;
  v_queue_unique BOOLEAN;
  v_sequence_ok BOOLEAN;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT COALESCE(MAX(queue_number), 0), COUNT(*)::INT
  INTO v_max_queue, v_total_with_queue
  FROM public.aid_requests;

  SELECT last_value, is_called
  INTO v_seq_last, v_seq_called
  FROM public.aid_requests_queue_number_seq;

  v_seq_next := CASE WHEN v_seq_called THEN v_seq_last + 1 ELSE v_seq_last END;
  v_sequence_ok := v_seq_next > v_max_queue;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'queue_number', d.queue_number,
        'count', d.cnt,
        'requests', d.requests
      )
      ORDER BY d.queue_number
    ),
    '[]'::jsonb
  )
  INTO v_dup_queue
  FROM (
    SELECT
      r.queue_number,
      COUNT(*)::INT AS cnt,
      jsonb_agg(
        jsonb_build_object(
          'id', r.id,
          'reference_code', r.reference_code
        )
        ORDER BY r.created_at
      ) AS requests
    FROM public.aid_requests r
    GROUP BY r.queue_number
    HAVING COUNT(*) > 1
  ) d;

  v_queue_unique := jsonb_array_length(v_dup_queue) = 0;

  SELECT COUNT(*)::INT INTO v_pending_total
  FROM public.aid_requests r
  WHERE r.status IN ('submitted', 'reviewing', 'verifying', 'on_hold');

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'phone', p.phone,
        'count', p.cnt,
        'requests', p.requests
      )
      ORDER BY p.cnt DESC, p.phone
    ),
    '[]'::jsonb
  )
  INTO v_dup_phones
  FROM (
    SELECT
      r.phone,
      COUNT(*)::INT AS cnt,
      jsonb_agg(
        jsonb_build_object(
          'id', r.id,
          'reference_code', r.reference_code,
          'queue_number', r.queue_number,
          'status', r.status::TEXT
        )
        ORDER BY r.queue_number
      ) AS requests
    FROM public.aid_requests r
    WHERE r.status IN ('submitted', 'reviewing', 'verifying', 'on_hold')
      AND r.phone IS NOT NULL
      AND trim(r.phone) <> ''
    GROUP BY r.phone
    HAVING COUNT(*) > 1
  ) p;

  RETURN jsonb_build_object(
    'checked_at', now(),
    'healthy', v_queue_unique AND v_sequence_ok,
    'queue_numbers', jsonb_build_object(
      'unique', v_queue_unique,
      'total_assigned', v_total_with_queue,
      'max', v_max_queue,
      'duplicates', v_dup_queue
    ),
    'sequence', jsonb_build_object(
      'ok', v_sequence_ok,
      'last_value', v_seq_last,
      'next_value', v_seq_next,
      'max_queue_number', v_max_queue
    ),
    'duplicate_phones_pending', v_dup_phones,
    'pending_total', v_pending_total
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_queue_integrity() TO authenticated;
