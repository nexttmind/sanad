-- PRD v2 Features B2, C1, C2, C3: queue position, list, export, saved views

CREATE TABLE IF NOT EXISTS public.admin_saved_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  filters JSONB NOT NULL DEFAULT '{}',
  sort JSONB NOT NULL DEFAULT '{"field":"effective_urgency","direction":"desc"}',
  columns JSONB,
  is_shared BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_saved_views TO authenticated;
GRANT ALL ON public.admin_saved_views TO service_role;
ALTER TABLE public.admin_saved_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users manage own saved views"
  ON public.admin_saved_views FOR ALL TO authenticated
  USING (user_id = auth.uid() OR (is_shared AND public.is_staff(auth.uid())))
  WITH CHECK (user_id = auth.uid());

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

  SELECT COUNT(*)::INT INTO v_total
  FROM public.aid_requests r
  WHERE (v_status IS NULL OR r.status::TEXT = v_status)
    AND (v_risk IS NULL OR r.risk_level::TEXT = v_risk)
    AND (v_tier IS NULL OR r.urgency_tier::TEXT = v_tier)
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

GRANT EXECUTE ON FUNCTION public.list_submissions(JSONB, JSONB, JSONB, INT) TO authenticated;

CREATE OR REPLACE FUNCTION public.export_submissions_csv(
  _filters JSONB DEFAULT '{}'
)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
  v_rows JSONB;
  v_line TEXT;
  v_out TEXT := E'\xEF\xBB\xBF';
  v_rec JSONB;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  IF NOT (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'reviewer')
    OR public.has_role(auth.uid(), 'distributor')
  ) THEN
    RAISE EXCEPTION 'not authorized to export';
  END IF;

  v_result := public.list_submissions(_filters, '{"field":"queue_number","direction":"asc"}'::jsonb, NULL, 5000);
  v_rows := COALESCE(v_result->'rows', '[]'::jsonb);

  v_out := v_out || 'queue_number,reference_code,full_name,phone,governorate,town,housing_type,family_size,infants,status,trust_score,urgency_score,effective_urgency,urgency_tier,risk_level,created_at,queued_at' || E'\n';

  FOR v_rec IN SELECT * FROM jsonb_array_elements(v_rows) LOOP
    v_line := concat_ws(',',
      COALESCE(v_rec->>'queue_number', ''),
      COALESCE(v_rec->>'reference_code', ''),
      replace(COALESCE(v_rec->>'full_name', ''), ',', ' '),
      COALESCE(v_rec->>'phone', ''),
      replace(COALESCE(v_rec->>'governorate', ''), ',', ' '),
      replace(COALESCE(v_rec->>'town', ''), ',', ' '),
      replace(COALESCE(v_rec->>'housing_type', ''), ',', ' '),
      COALESCE(v_rec->>'family_size', ''),
      COALESCE(v_rec->>'infants', ''),
      COALESCE(v_rec->>'status', ''),
      COALESCE(v_rec->>'trust_score', ''),
      COALESCE(v_rec->>'urgency_score', ''),
      COALESCE(v_rec->>'effective_urgency', ''),
      COALESCE(v_rec->>'urgency_tier', ''),
      COALESCE(v_rec->>'risk_level', ''),
      COALESCE(v_rec->>'created_at', ''),
      COALESCE(v_rec->>'queued_at', '')
    );
    v_out := v_out || v_line || E'\n';
  END LOOP;

  RETURN v_out;
END;
$$;

GRANT EXECUTE ON FUNCTION public.export_submissions_csv(JSONB) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_active_scoring_config()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT to_jsonb(c)
  FROM public.scoring_config c
  WHERE c.is_active = TRUE
  ORDER BY c.version DESC
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_active_scoring_config() TO authenticated;

CREATE OR REPLACE FUNCTION public.save_scoring_config(_rules JSONB)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_version INT;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'admin only';
  END IF;
  UPDATE public.scoring_config SET is_active = FALSE WHERE is_active = TRUE;
  SELECT COALESCE(MAX(version), 0) + 1 INTO v_version FROM public.scoring_config;
  INSERT INTO public.scoring_config (version, rules, is_active, updated_by)
  VALUES (v_version, _rules, TRUE, auth.uid());
  RETURN v_version;
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_scoring_config(JSONB) TO authenticated;
