-- Step 10.1: optional extended export columns (reference, tags, flags, needs, dependents, assignee)

CREATE OR REPLACE FUNCTION public.export_allowed_columns()
RETURNS TEXT[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT ARRAY[
    'queue_number', 'reference_code', 'full_name', 'phone', 'governorate', 'town',
    'housing_type', 'family_size', 'infants', 'children', 'elderly', 'needs', 'flags',
    'status', 'trust_score', 'urgency_score', 'effective_urgency', 'urgency_tier',
    'risk_level', 'assigned_to', 'tags',
    'reference_type', 'reference_name', 'reference_phone', 'reference_region', 'reference_contact_result',
    'created_at', 'queued_at'
  ]::TEXT[];
$$;

CREATE OR REPLACE FUNCTION public.export_cell_value(_rec JSONB, _col TEXT)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_request_id UUID;
BEGIN
  v_request_id := NULLIF(_rec->>'id', '')::UUID;

  CASE _col
    WHEN 'full_name', 'governorate', 'town', 'housing_type' THEN
      RETURN replace(COALESCE(_rec->>_col, ''), ',', ' ');
    WHEN 'needs' THEN
      RETURN replace(
        COALESCE(
          (
            SELECT string_agg(elem, '; ' ORDER BY elem)
            FROM jsonb_array_elements_text(COALESCE(_rec->'needs', '[]'::jsonb)) AS elem
          ),
          ''
        ),
        ',',
        ' '
      );
    WHEN 'flags' THEN
      RETURN replace(
        COALESCE(
          (
            SELECT string_agg(elem, '; ' ORDER BY elem)
            FROM jsonb_array_elements_text(COALESCE(_rec->'flags', '[]'::jsonb)) AS elem
          ),
          ''
        ),
        ',',
        ' '
      );
    WHEN 'tags' THEN
      IF v_request_id IS NULL THEN
        RETURN '';
      END IF;
      RETURN replace(
        COALESCE(
          (
            SELECT string_agg(t.name_ar, '; ' ORDER BY t.name_ar)
            FROM public.request_tags rt
            JOIN public.tags t ON t.id = rt.tag_id
            WHERE rt.request_id = v_request_id
          ),
          ''
        ),
        ',',
        ' '
      );
    WHEN 'reference_type' THEN
      IF v_request_id IS NULL THEN RETURN ''; END IF;
      RETURN replace(
        COALESCE(
          (SELECT sr.reference_type FROM public.submission_references sr WHERE sr.request_id = v_request_id),
          ''
        ),
        ',',
        ' '
      );
    WHEN 'reference_name' THEN
      IF v_request_id IS NULL THEN RETURN ''; END IF;
      RETURN replace(
        COALESCE(
          (SELECT sr.full_name FROM public.submission_references sr WHERE sr.request_id = v_request_id),
          ''
        ),
        ',',
        ' '
      );
    WHEN 'reference_phone' THEN
      IF v_request_id IS NULL THEN RETURN ''; END IF;
      RETURN COALESCE(
        (SELECT sr.phone FROM public.submission_references sr WHERE sr.request_id = v_request_id),
        ''
      );
    WHEN 'reference_region' THEN
      IF v_request_id IS NULL THEN RETURN ''; END IF;
      RETURN replace(
        COALESCE(
          (SELECT sr.region FROM public.submission_references sr WHERE sr.request_id = v_request_id),
          ''
        ),
        ',',
        ' '
      );
    WHEN 'reference_contact_result' THEN
      IF v_request_id IS NULL THEN RETURN ''; END IF;
      RETURN COALESCE(
        (SELECT sr.contact_result::TEXT FROM public.submission_references sr WHERE sr.request_id = v_request_id),
        ''
      );
    ELSE
      RETURN COALESCE(_rec->>_col, '');
  END CASE;
END;
$$;

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
  v_columns TEXT[] := public.export_allowed_columns();
  v_out TEXT := E'\xEF\xBB\xBF';
  v_rec JSONB;
BEGIN
  PERFORM public.export_assert_can_export();

  v_result := public.list_submissions(_filters, '{"field":"queue_number","direction":"asc"}'::jsonb, NULL, 5000);
  v_rows := COALESCE(v_result->'rows', '[]'::jsonb);

  v_out := v_out || public.build_export_csv_chunk(v_rows, v_columns, TRUE);

  RETURN v_out;
END;
$$;
