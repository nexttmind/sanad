-- PRD v2 C1: advanced list filters — governorate, tags, date range

CREATE OR REPLACE FUNCTION public.list_submissions(
  _filters JSONB DEFAULT '{}',
  _sort JSONB DEFAULT '{"field":"effective_urgency","direction":"desc"}',
  _cursor JSONB DEFAULT NULL,
  _limit INT DEFAULT 50
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sort_field TEXT := COALESCE(_sort->>'field', 'effective_urgency');
  v_sort_dir TEXT := lower(COALESCE(_sort->>'direction', 'desc'));
  v_limit INT := LEAST(GREATEST(COALESCE(_limit, 50), 1), 100);
  v_offset INT := GREATEST(COALESCE((_cursor->>'offset')::INT, 0), 0);
  v_search TEXT := NULLIF(trim(_filters->>'search'), '');
  v_status TEXT := NULLIF(_filters->>'status', '');
  v_risk TEXT := NULLIF(_filters->>'risk_level', '');
  v_tier TEXT := NULLIF(_filters->>'urgency_tier', '');
  v_governorate TEXT := NULLIF(trim(_filters->>'governorate'), '');
  v_created_from TIMESTAMPTZ := NULL;
  v_created_to TIMESTAMPTZ := NULL;
  v_tag_ids UUID[] := NULL;
  v_rows JSONB;
  v_total INT := 0;
  v_fetched INT := 0;
  v_next_cursor JSONB := NULL;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF v_sort_field NOT IN ('queue_number', 'effective_urgency', 'created_at', 'trust_score', 'urgency_score') THEN
    v_sort_field := 'effective_urgency';
  END IF;
  IF v_sort_dir NOT IN ('asc', 'desc') THEN
    v_sort_dir := 'desc';
  END IF;

  IF NULLIF(trim(_filters->>'created_from'), '') IS NOT NULL THEN
    v_created_from := (_filters->>'created_from')::date;
  END IF;
  IF NULLIF(trim(_filters->>'created_to'), '') IS NOT NULL THEN
    v_created_to := ((_filters->>'created_to')::date + INTERVAL '1 day');
  END IF;

  IF _filters ? 'tag_ids' AND jsonb_typeof(_filters->'tag_ids') = 'array' THEN
    SELECT COALESCE(array_agg(elem::uuid), ARRAY[]::uuid[])
    INTO v_tag_ids
    FROM jsonb_array_elements_text(_filters->'tag_ids') AS elem
    WHERE elem ~* '^[0-9a-f-]{36}$';

    IF cardinality(v_tag_ids) = 0 THEN
      v_tag_ids := NULL;
    END IF;
  END IF;

  SELECT COUNT(*)::INT INTO v_total
  FROM public.aid_requests r
  WHERE (v_status IS NULL OR r.status::TEXT = v_status)
    AND (v_risk IS NULL OR r.risk_level::TEXT = v_risk)
    AND (v_tier IS NULL OR r.urgency_tier::TEXT = v_tier)
    AND (v_governorate IS NULL OR r.governorate = v_governorate)
    AND (v_created_from IS NULL OR r.created_at >= v_created_from)
    AND (v_created_to IS NULL OR r.created_at < v_created_to)
    AND (
      v_tag_ids IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.request_tags rt
        WHERE rt.request_id = r.id
          AND rt.tag_id = ANY(v_tag_ids)
      )
    )
    AND (
      v_search IS NULL
      OR r.full_name ILIKE '%' || v_search || '%'
      OR r.reference_code ILIKE '%' || v_search || '%'
      OR r.phone ILIKE '%' || v_search || '%'
    );

  SELECT COALESCE(jsonb_agg(row_data), '[]'::jsonb), COUNT(*)::INT
  INTO v_rows, v_fetched
  FROM (
    SELECT (to_jsonb(r) - 'ip_hash' - 'user_agent') AS row_data
    FROM public.aid_requests r
    WHERE (v_status IS NULL OR r.status::TEXT = v_status)
      AND (v_risk IS NULL OR r.risk_level::TEXT = v_risk)
      AND (v_tier IS NULL OR r.urgency_tier::TEXT = v_tier)
      AND (v_governorate IS NULL OR r.governorate = v_governorate)
      AND (v_created_from IS NULL OR r.created_at >= v_created_from)
      AND (v_created_to IS NULL OR r.created_at < v_created_to)
      AND (
        v_tag_ids IS NULL
        OR EXISTS (
          SELECT 1
          FROM public.request_tags rt
          WHERE rt.request_id = r.id
            AND rt.tag_id = ANY(v_tag_ids)
        )
      )
      AND (
        v_search IS NULL
        OR r.full_name ILIKE '%' || v_search || '%'
        OR r.reference_code ILIKE '%' || v_search || '%'
        OR r.phone ILIKE '%' || v_search || '%'
      )
    ORDER BY
      CASE WHEN v_sort_field = 'effective_urgency' AND v_sort_dir = 'desc' THEN COALESCE(r.effective_urgency, r.urgency_score, 0) END DESC NULLS LAST,
      CASE WHEN v_sort_field = 'effective_urgency' AND v_sort_dir = 'desc' THEN r.queue_number END ASC NULLS LAST,
      CASE WHEN v_sort_field = 'effective_urgency' AND v_sort_dir = 'asc' THEN COALESCE(r.effective_urgency, r.urgency_score, 0) END ASC NULLS LAST,
      CASE WHEN v_sort_field = 'effective_urgency' AND v_sort_dir = 'asc' THEN r.queue_number END ASC NULLS LAST,
      CASE WHEN v_sort_field = 'queue_number' AND v_sort_dir = 'asc' THEN r.queue_number END ASC NULLS LAST,
      CASE WHEN v_sort_field = 'queue_number' AND v_sort_dir = 'desc' THEN r.queue_number END DESC NULLS LAST,
      CASE WHEN v_sort_field = 'created_at' AND v_sort_dir = 'desc' THEN r.created_at END DESC NULLS LAST,
      CASE WHEN v_sort_field = 'created_at' AND v_sort_dir = 'asc' THEN r.created_at END ASC NULLS LAST,
      CASE WHEN v_sort_field = 'trust_score' AND v_sort_dir = 'desc' THEN r.trust_score END DESC NULLS LAST,
      CASE WHEN v_sort_field = 'trust_score' AND v_sort_dir = 'asc' THEN r.trust_score END ASC NULLS LAST,
      CASE WHEN v_sort_field = 'urgency_score' AND v_sort_dir = 'desc' THEN r.urgency_score END DESC NULLS LAST,
      CASE WHEN v_sort_field = 'urgency_score' AND v_sort_dir = 'asc' THEN r.urgency_score END ASC NULLS LAST,
      r.id ASC
    OFFSET v_offset
    LIMIT v_limit + 1
  ) paged;

  IF v_fetched > v_limit THEN
    v_rows := (
      SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
      FROM (
        SELECT elem
        FROM jsonb_array_elements(v_rows) WITH ORDINALITY AS t(elem, ord)
        WHERE ord <= v_limit
      ) trimmed
    );
    v_next_cursor := jsonb_build_object('offset', v_offset + v_limit);
  END IF;

  RETURN jsonb_build_object(
    'rows', v_rows,
    'total_count', v_total,
    'next_cursor', v_next_cursor
  );
END;
$$;
