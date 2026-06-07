-- Performance: server-side admin overview aggregates + defer scoring on INSERT (edge recalculates async)

-- ============ Defer heavy scoring on INSERT (submit returns faster) ============

CREATE OR REPLACE FUNCTION public.trg_score_request()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Defaults (50/50) already on row; submit-aid-request edge calls calculate_scores after response.
    RETURN NEW;
  END IF;

  PERFORM public.calculate_scores(NEW.id, 'field_change');
  RETURN NEW;
END;
$$;

-- ============ Admin overview — one RPC instead of select * limit 500 ============

CREATE OR REPLACE FUNCTION public.get_admin_overview_stats()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_day_start TIMESTAMPTZ := public.beirut_day_start();
  v_status JSONB := '{}'::jsonb;
  v_needs JSONB := '[]'::jsonb;
  v_daily JSONB := '[]'::jsonb;
  v_top_pending JSONB;
  v_recent JSONB;
  v_total INT;
  v_today INT;
  v_pending INT;
  v_oldest_queue INT;
  rec RECORD;
  i INT;
  v_day TIMESTAMPTZ;
  v_next TIMESTAMPTZ;
  v_count INT;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT COUNT(*)::INT INTO v_total FROM public.aid_requests;

  SELECT COUNT(*)::INT INTO v_today
  FROM public.aid_requests
  WHERE created_at >= v_day_start
    AND created_at < v_day_start + INTERVAL '1 day';

  FOR rec IN
    SELECT r.status::TEXT AS status, COUNT(*)::INT AS cnt
    FROM public.aid_requests r
    GROUP BY r.status
  LOOP
    v_status := v_status || jsonb_build_object(rec.status, rec.cnt);
  END LOOP;

  SELECT COUNT(*)::INT INTO v_pending
  FROM public.aid_requests r
  WHERE r.status IN ('submitted', 'reviewing', 'verifying', 'on_hold');

  SELECT MIN(r.queue_number)::INT INTO v_oldest_queue
  FROM public.aid_requests r
  WHERE r.status IN ('submitted', 'reviewing', 'verifying', 'on_hold')
    AND r.queue_number IS NOT NULL;

  SELECT COALESCE(jsonb_agg(row_data ORDER BY sort_urg DESC, sort_q ASC), '[]'::jsonb)
  INTO v_top_pending
  FROM (
    SELECT jsonb_build_object(
      'id', r.id,
      'full_name', r.full_name,
      'governorate', r.governorate,
      'queue_number', r.queue_number,
      'effective_urgency', COALESCE(r.effective_urgency, r.urgency_score),
      'urgency_tier', r.urgency_tier,
      'urgency_score', r.urgency_score,
      'status', r.status
    ) AS row_data,
    COALESCE(r.effective_urgency, r.urgency_score) AS sort_urg,
    r.queue_number AS sort_q
    FROM public.aid_requests r
    WHERE r.status IN ('submitted', 'reviewing', 'verifying', 'on_hold')
    ORDER BY sort_urg DESC NULLS LAST, sort_q ASC NULLS LAST
    LIMIT 5
  ) sub;

  SELECT COALESCE(jsonb_agg(row_data ORDER BY sort_created DESC), '[]'::jsonb)
  INTO v_recent
  FROM (
    SELECT jsonb_build_object(
      'id', r.id,
      'full_name', r.full_name,
      'reference_code', r.reference_code,
      'governorate', r.governorate,
      'trust_score', r.trust_score,
      'effective_urgency', COALESCE(r.effective_urgency, r.urgency_score),
      'urgency_score', r.urgency_score,
      'queue_number', r.queue_number,
      'queued_at', r.queued_at,
      'created_at', r.created_at,
      'status', r.status
    ) AS row_data,
    r.created_at AS sort_created
    FROM public.aid_requests r
    ORDER BY r.created_at DESC
    LIMIT 10
  ) sub;

  SELECT COALESCE(
    jsonb_agg(jsonb_build_array(n.need, n.cnt) ORDER BY n.cnt DESC),
    '[]'::jsonb
  )
  INTO v_needs
  FROM (
    SELECT need, COUNT(*)::INT AS cnt
    FROM public.aid_requests r,
    LATERAL unnest(r.needs) AS need
    GROUP BY need
    ORDER BY cnt DESC
    LIMIT 8
  ) n;

  FOR i IN 0..6 LOOP
    v_day := v_day_start - ((6 - i) || ' days')::INTERVAL;
    v_next := v_day + INTERVAL '1 day';
    SELECT COUNT(*)::INT INTO v_count
    FROM public.aid_requests r
    WHERE r.created_at >= v_day AND r.created_at < v_next;
    v_daily := v_daily || to_jsonb(v_count);
  END LOOP;

  RETURN jsonb_build_object(
    'total', v_total,
    'today_count', v_today,
    'status_counts', v_status,
    'alerts', jsonb_build_object(
      'critical', (
        SELECT COUNT(*)::INT FROM public.aid_requests r
        WHERE r.status = 'submitted'
          AND COALESCE(r.effective_urgency, r.urgency_score) >= 85
      ),
      'pending_queue', v_pending,
      'oldest_queue', v_oldest_queue,
      'infants_pending', (
        SELECT COUNT(*)::INT FROM public.aid_requests r
        WHERE r.status = 'submitted' AND r.infants > 0
      ),
      'disabled_pending', (
        SELECT COUNT(*)::INT FROM public.aid_requests r
        WHERE r.status = 'submitted' AND r.disabled = TRUE
      ),
      'shelter_pending', (
        SELECT COUNT(*)::INT FROM public.aid_requests r
        WHERE r.status = 'submitted'
          AND r.housing_type IS NOT NULL
          AND (
            r.housing_type ILIKE '%school%'
            OR r.housing_type ILIKE '%مدرسة%'
            OR r.housing_type ILIKE '%مأوى%'
          )
      ),
      'high_risk', (
        SELECT COUNT(*)::INT FROM public.aid_requests r
        WHERE r.risk_level IN ('fraud', 'critical')
      ),
      'flagged', (
        SELECT COUNT(*)::INT FROM public.aid_requests r
        WHERE COALESCE(array_length(r.flags, 1), 0) > 0
      )
    ),
    'top_pending', v_top_pending,
    'recent', v_recent,
    'needs_breakdown', v_needs,
    'daily_last_7', v_daily,
    'vulnerable', jsonb_build_object(
      'infants', (SELECT COALESCE(SUM(r.infants), 0)::INT FROM public.aid_requests r),
      'disabled', (SELECT COUNT(*)::INT FROM public.aid_requests r WHERE r.disabled),
      'chronic', (SELECT COUNT(*)::INT FROM public.aid_requests r WHERE r.chronic_illness),
      'elderly', (SELECT COALESCE(SUM(r.elderly), 0)::INT FROM public.aid_requests r)
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_admin_overview_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_admin_overview_stats() TO authenticated;
