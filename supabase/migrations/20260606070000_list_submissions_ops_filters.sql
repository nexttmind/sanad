-- PRD v2 C1 (continued): assigned_to, score/queue ranges, flags, reference status

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
  v_cursor_offset INT := GREATEST(COALESCE((_cursor->>'offset')::INT, -1), -1);
  v_cursor_last_sort_value TEXT := NULLIF(_cursor->>'last_sort_value', '');
  v_cursor_last_queue_number BIGINT := NULLIF(_cursor->>'last_queue_number', '')::BIGINT;
  v_cursor_last_id UUID := NULLIF(_cursor->>'last_id', '')::UUID;
  v_search TEXT := NULLIF(trim(_filters->>'search'), '');
  v_status TEXT := NULLIF(_filters->>'status', '');
  v_risk TEXT := NULLIF(_filters->>'risk_level', '');
  v_tier TEXT := NULLIF(_filters->>'urgency_tier', '');
  v_governorate TEXT := NULLIF(trim(_filters->>'governorate'), '');
  v_created_from TIMESTAMPTZ := NULL;
  v_created_to TIMESTAMPTZ := NULL;
  v_tag_ids UUID[] := NULL;
  v_needs TEXT[] := NULL;
  v_assigned_to UUID := NULL;
  v_unassigned_only BOOLEAN := COALESCE((_filters->>'unassigned_only')::BOOLEAN, FALSE);
  v_trust_min INT := NULL;
  v_trust_max INT := NULL;
  v_urgency_min INT := NULL;
  v_urgency_max INT := NULL;
  v_queue_from BIGINT := NULL;
  v_queue_to BIGINT := NULL;
  v_has_flags BOOLEAN := COALESCE((_filters->>'has_flags')::BOOLEAN, FALSE);
  v_reference_result TEXT := NULLIF(_filters->>'reference_result', '');
  v_use_offset BOOLEAN := FALSE;
  v_offset INT := 0;
  v_use_keyset BOOLEAN := FALSE;
  v_last_row JSONB;
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

  IF _filters ? 'needs' AND jsonb_typeof(_filters->'needs') = 'array' THEN
    SELECT COALESCE(array_agg(elem), ARRAY[]::text[])
    INTO v_needs
    FROM jsonb_array_elements_text(_filters->'needs') AS elem;
    IF cardinality(v_needs) = 0 THEN
      v_needs := NULL;
    END IF;
  END IF;

  IF NOT v_unassigned_only AND NULLIF(trim(_filters->>'assigned_to'), '') IS NOT NULL THEN
    IF (_filters->>'assigned_to') ~* '^[0-9a-f-]{36}$' THEN
      v_assigned_to := (_filters->>'assigned_to')::uuid;
    END IF;
  END IF;

  IF _filters ? 'trust_min' AND (_filters->>'trust_min') ~ '^\d+$' THEN
    v_trust_min := (_filters->>'trust_min')::INT;
  END IF;
  IF _filters ? 'trust_max' AND (_filters->>'trust_max') ~ '^\d+$' THEN
    v_trust_max := (_filters->>'trust_max')::INT;
  END IF;
  IF _filters ? 'urgency_min' AND (_filters->>'urgency_min') ~ '^\d+$' THEN
    v_urgency_min := (_filters->>'urgency_min')::INT;
  END IF;
  IF _filters ? 'urgency_max' AND (_filters->>'urgency_max') ~ '^\d+$' THEN
    v_urgency_max := (_filters->>'urgency_max')::INT;
  END IF;
  IF _filters ? 'queue_from' AND (_filters->>'queue_from') ~ '^\d+$' THEN
    v_queue_from := (_filters->>'queue_from')::BIGINT;
  END IF;
  IF _filters ? 'queue_to' AND (_filters->>'queue_to') ~ '^\d+$' THEN
    v_queue_to := (_filters->>'queue_to')::BIGINT;
  END IF;

  IF v_reference_result IS NOT NULL AND v_reference_result NOT IN ('confirmed', 'denied', 'pending') THEN
    v_reference_result := NULL;
  END IF;

  v_use_offset := _cursor IS NOT NULL AND _cursor ? 'offset' AND v_cursor_offset >= 0;
  IF NOT v_use_offset AND v_cursor_last_sort_value IS NOT NULL AND v_cursor_last_id IS NOT NULL THEN
    v_use_keyset := TRUE;
  END IF;

  v_offset := CASE WHEN v_use_offset THEN v_cursor_offset ELSE 0 END;

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
        SELECT 1 FROM public.request_tags rt
        WHERE rt.request_id = r.id AND rt.tag_id = ANY(v_tag_ids)
      )
    )
    AND (v_needs IS NULL OR (r.needs IS NOT NULL AND r.needs && v_needs))
    AND (
      v_search IS NULL
      OR r.full_name ILIKE '%' || v_search || '%'
      OR r.reference_code ILIKE '%' || v_search || '%'
      OR r.phone ILIKE '%' || v_search || '%'
    )
    AND (
      CASE
        WHEN v_unassigned_only THEN r.assigned_to IS NULL
        WHEN v_assigned_to IS NOT NULL THEN r.assigned_to = v_assigned_to
        ELSE TRUE
      END
    )
    AND (v_trust_min IS NULL OR r.trust_score >= v_trust_min)
    AND (v_trust_max IS NULL OR r.trust_score <= v_trust_max)
    AND (
      v_urgency_min IS NULL
      OR COALESCE(r.effective_urgency, r.urgency_score, 0) >= v_urgency_min
    )
    AND (
      v_urgency_max IS NULL
      OR COALESCE(r.effective_urgency, r.urgency_score, 0) <= v_urgency_max
    )
    AND (v_queue_from IS NULL OR r.queue_number >= v_queue_from)
    AND (v_queue_to IS NULL OR r.queue_number <= v_queue_to)
    AND (NOT v_has_flags OR cardinality(COALESCE(r.flags, '{}')) > 0)
    AND (
      v_reference_result IS NULL
      OR EXISTS (
        SELECT 1 FROM public.submission_references sr
        WHERE sr.request_id = r.id
          AND (
            (v_reference_result = 'confirmed' AND sr.contact_result = 'confirmed')
            OR (v_reference_result = 'denied' AND sr.contact_result = 'denied')
            OR (
              v_reference_result = 'pending'
              AND (sr.contact_result IS NULL OR sr.contact_result = 'pending')
            )
          )
      )
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
          SELECT 1 FROM public.request_tags rt
          WHERE rt.request_id = r.id AND rt.tag_id = ANY(v_tag_ids)
        )
      )
      AND (v_needs IS NULL OR (r.needs IS NOT NULL AND r.needs && v_needs))
      AND (
        v_search IS NULL
        OR r.full_name ILIKE '%' || v_search || '%'
        OR r.reference_code ILIKE '%' || v_search || '%'
        OR r.phone ILIKE '%' || v_search || '%'
      )
      AND (
        CASE
          WHEN v_unassigned_only THEN r.assigned_to IS NULL
          WHEN v_assigned_to IS NOT NULL THEN r.assigned_to = v_assigned_to
          ELSE TRUE
        END
      )
      AND (v_trust_min IS NULL OR r.trust_score >= v_trust_min)
      AND (v_trust_max IS NULL OR r.trust_score <= v_trust_max)
      AND (
        v_urgency_min IS NULL
        OR COALESCE(r.effective_urgency, r.urgency_score, 0) >= v_urgency_min
      )
      AND (
        v_urgency_max IS NULL
        OR COALESCE(r.effective_urgency, r.urgency_score, 0) <= v_urgency_max
      )
      AND (v_queue_from IS NULL OR r.queue_number >= v_queue_from)
      AND (v_queue_to IS NULL OR r.queue_number <= v_queue_to)
      AND (NOT v_has_flags OR cardinality(COALESCE(r.flags, '{}')) > 0)
      AND (
        v_reference_result IS NULL
        OR EXISTS (
          SELECT 1 FROM public.submission_references sr
          WHERE sr.request_id = r.id
            AND (
              (v_reference_result = 'confirmed' AND sr.contact_result = 'confirmed')
              OR (v_reference_result = 'denied' AND sr.contact_result = 'denied')
              OR (
                v_reference_result = 'pending'
                AND (sr.contact_result IS NULL OR sr.contact_result = 'pending')
              )
            )
        )
      )
      AND (
        NOT v_use_keyset
        OR (
          CASE
            WHEN v_sort_field = 'effective_urgency' AND v_sort_dir = 'desc' THEN
              (COALESCE(r.effective_urgency, r.urgency_score, 0) < v_cursor_last_sort_value::INT)
              OR (
                COALESCE(r.effective_urgency, r.urgency_score, 0) = v_cursor_last_sort_value::INT
                AND r.queue_number > v_cursor_last_queue_number
              )
            WHEN v_sort_field = 'effective_urgency' AND v_sort_dir = 'asc' THEN
              (COALESCE(r.effective_urgency, r.urgency_score, 0) > v_cursor_last_sort_value::INT)
              OR (
                COALESCE(r.effective_urgency, r.urgency_score, 0) = v_cursor_last_sort_value::INT
                AND r.queue_number > v_cursor_last_queue_number
              )
            WHEN v_sort_field = 'queue_number' AND v_sort_dir = 'asc' THEN
              (r.queue_number > v_cursor_last_sort_value::BIGINT)
              OR (r.queue_number = v_cursor_last_sort_value::BIGINT AND r.id > v_cursor_last_id)
            WHEN v_sort_field = 'queue_number' AND v_sort_dir = 'desc' THEN
              (r.queue_number < v_cursor_last_sort_value::BIGINT)
              OR (r.queue_number = v_cursor_last_sort_value::BIGINT AND r.id > v_cursor_last_id)
            WHEN v_sort_field = 'created_at' AND v_sort_dir = 'asc' THEN
              (r.created_at > v_cursor_last_sort_value::timestamptz)
              OR (r.created_at = v_cursor_last_sort_value::timestamptz AND r.id > v_cursor_last_id)
            WHEN v_sort_field = 'created_at' AND v_sort_dir = 'desc' THEN
              (r.created_at < v_cursor_last_sort_value::timestamptz)
              OR (r.created_at = v_cursor_last_sort_value::timestamptz AND r.id > v_cursor_last_id)
            WHEN v_sort_field = 'trust_score' AND v_sort_dir = 'asc' THEN
              (r.trust_score > v_cursor_last_sort_value::INT)
              OR (r.trust_score = v_cursor_last_sort_value::INT AND r.id > v_cursor_last_id)
            WHEN v_sort_field = 'trust_score' AND v_sort_dir = 'desc' THEN
              (r.trust_score < v_cursor_last_sort_value::INT)
              OR (r.trust_score = v_cursor_last_sort_value::INT AND r.id > v_cursor_last_id)
            WHEN v_sort_field = 'urgency_score' AND v_sort_dir = 'asc' THEN
              (r.urgency_score > v_cursor_last_sort_value::INT)
              OR (r.urgency_score = v_cursor_last_sort_value::INT AND r.id > v_cursor_last_id)
            WHEN v_sort_field = 'urgency_score' AND v_sort_dir = 'desc' THEN
              (r.urgency_score < v_cursor_last_sort_value::INT)
              OR (r.urgency_score = v_cursor_last_sort_value::INT AND r.id > v_cursor_last_id)
            ELSE TRUE
          END
        )
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

    IF v_use_offset THEN
      v_next_cursor := jsonb_build_object('offset', v_offset + v_limit);
    ELSE
      SELECT elem INTO v_last_row
      FROM jsonb_array_elements(v_rows) WITH ORDINALITY AS t(elem, ord)
      WHERE ord = jsonb_array_length(v_rows);

      v_next_cursor := jsonb_build_object(
        'last_sort_value', CASE
          WHEN v_sort_field = 'effective_urgency' THEN COALESCE(v_last_row->>'effective_urgency', v_last_row->>'urgency_score', '0')
          WHEN v_sort_field = 'queue_number' THEN v_last_row->>'queue_number'
          WHEN v_sort_field = 'created_at' THEN v_last_row->>'created_at'
          WHEN v_sort_field = 'trust_score' THEN v_last_row->>'trust_score'
          WHEN v_sort_field = 'urgency_score' THEN v_last_row->>'urgency_score'
          ELSE v_last_row->>'effective_urgency'
        END,
        'last_id', v_last_row->>'id',
        'last_queue_number', v_last_row->>'queue_number'
      );
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'rows', v_rows,
    'total_count', v_total,
    'next_cursor', v_next_cursor
  );
END;
$$;
