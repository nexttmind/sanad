-- PRD v2 C2 (continued): async export_jobs for large CSV exports (>5000 rows)

CREATE TABLE IF NOT EXISTS public.export_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  filters JSONB NOT NULL DEFAULT '{}',
  columns JSONB NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  total_count INT NOT NULL DEFAULT 0,
  processed_count INT NOT NULL DEFAULT 0,
  csv_data TEXT,
  csv_path TEXT,
  row_count INT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS export_jobs_user_created_idx
  ON public.export_jobs (user_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.export_jobs TO authenticated;
GRANT ALL ON public.export_jobs TO service_role;
ALTER TABLE public.export_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own export jobs"
  ON public.export_jobs FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "users insert own export jobs"
  ON public.export_jobs FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "users update own export jobs"
  ON public.export_jobs FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.export_assert_can_export()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
END;
$$;

CREATE OR REPLACE FUNCTION public.export_allowed_columns()
RETURNS TEXT[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT ARRAY[
    'queue_number', 'reference_code', 'full_name', 'phone', 'governorate', 'town',
    'housing_type', 'family_size', 'infants', 'status', 'trust_score', 'urgency_score',
    'effective_urgency', 'urgency_tier', 'risk_level', 'created_at', 'queued_at'
  ]::TEXT[];
$$;

CREATE OR REPLACE FUNCTION public.export_resolve_columns(_columns JSONB)
RETURNS TEXT[]
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_allowed TEXT[] := public.export_allowed_columns();
  v_cols TEXT[];
BEGIN
  SELECT COALESCE(array_agg(elem ORDER BY ord), ARRAY[]::TEXT[])
  INTO v_cols
  FROM jsonb_array_elements_text(COALESCE(_columns, '[]'::jsonb)) WITH ORDINALITY AS t(elem, ord)
  WHERE elem = ANY(v_allowed);

  IF cardinality(v_cols) = 0 THEN
    RETURN v_allowed;
  END IF;
  RETURN v_cols;
END;
$$;

CREATE OR REPLACE FUNCTION public.export_cell_value(_rec JSONB, _col TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE _col
    WHEN 'full_name' THEN replace(COALESCE(_rec->>'full_name', ''), ',', ' ')
    WHEN 'governorate' THEN replace(COALESCE(_rec->>'governorate', ''), ',', ' ')
    WHEN 'town' THEN replace(COALESCE(_rec->>'town', ''), ',', ' ')
    WHEN 'housing_type' THEN replace(COALESCE(_rec->>'housing_type', ''), ',', ' ')
    ELSE COALESCE(_rec->>_col, '')
  END;
$$;

CREATE OR REPLACE FUNCTION public.build_export_csv_chunk(
  _rows JSONB,
  _columns TEXT[],
  _include_header BOOLEAN
)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_out TEXT := '';
  v_rec JSONB;
  v_line TEXT;
  v_col TEXT;
BEGIN
  IF _include_header THEN
    v_out := array_to_string(_columns, ',') || E'\n';
  END IF;

  FOR v_rec IN SELECT value FROM jsonb_array_elements(COALESCE(_rows, '[]'::jsonb)) AS t(value) LOOP
    v_line := NULL;
    FOREACH v_col IN ARRAY _columns LOOP
      IF v_line IS NULL THEN
        v_line := public.export_cell_value(v_rec, v_col);
      ELSE
        v_line := v_line || ',' || public.export_cell_value(v_rec, v_col);
      END IF;
    END LOOP;
    v_out := v_out || v_line || E'\n';
  END LOOP;

  RETURN v_out;
END;
$$;

CREATE OR REPLACE FUNCTION public.export_job_status_json(_job public.export_jobs)
RETURNS JSONB
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT jsonb_build_object(
    'id', _job.id,
    'status', _job.status,
    'total_count', _job.total_count,
    'processed_count', _job.processed_count,
    'progress_pct', CASE
      WHEN _job.total_count <= 0 THEN 0
      ELSE LEAST(100, ROUND(_job.processed_count * 100.0 / _job.total_count)::INT)
    END,
    'error_message', _job.error_message,
    'row_count', _job.row_count,
    'csv_path', _job.csv_path,
    'created_at', _job.created_at,
    'completed_at', _job.completed_at
  );
$$;

CREATE OR REPLACE FUNCTION public.create_export_job(
  _filters JSONB DEFAULT '{}',
  _columns JSONB DEFAULT '[]'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total INT;
  v_job_id UUID;
  v_cols JSONB;
  v_sync_limit INT := 5000;
  v_async_max INT := 50000;
BEGIN
  PERFORM public.export_assert_can_export();

  SELECT COALESCE((public.list_submissions(_filters, '{"field":"queue_number","direction":"asc"}'::jsonb, NULL, 1)->>'total_count')::INT, 0)
  INTO v_total;

  IF v_total = 0 THEN
    RETURN jsonb_build_object('mode', 'sync', 'total_count', 0);
  END IF;

  IF v_total <= v_sync_limit THEN
    RETURN jsonb_build_object('mode', 'sync', 'total_count', v_total);
  END IF;

  IF v_total > v_async_max THEN
    RAISE EXCEPTION 'export too large (max % rows)', v_async_max;
  END IF;

  v_cols := to_jsonb(public.export_resolve_columns(_columns));

  INSERT INTO public.export_jobs (user_id, filters, columns, total_count, status)
  VALUES (auth.uid(), COALESCE(_filters, '{}'::jsonb), v_cols, v_total, 'pending')
  RETURNING id INTO v_job_id;

  RETURN jsonb_build_object(
    'mode', 'async',
    'job_id', v_job_id,
    'total_count', v_total
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_export_job(_job_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job public.export_jobs%ROWTYPE;
BEGIN
  PERFORM public.export_assert_can_export();

  SELECT * INTO v_job FROM public.export_jobs WHERE id = _job_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'export job not found';
  END IF;

  IF v_job.user_id <> auth.uid() AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  RETURN public.export_job_status_json(v_job);
END;
$$;

CREATE OR REPLACE FUNCTION public.advance_export_job(_job_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job public.export_jobs%ROWTYPE;
  v_columns TEXT[];
  v_result JSONB;
  v_rows JSONB;
  v_batch_count INT := 0;
  v_chunk TEXT := '';
  v_batch_limit INT := 1500;
BEGIN
  PERFORM public.export_assert_can_export();

  SELECT * INTO v_job
  FROM public.export_jobs
  WHERE id = _job_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'export job not found';
  END IF;

  IF v_job.user_id <> auth.uid() AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF v_job.status = 'completed' THEN
    RETURN public.export_job_status_json(v_job);
  END IF;

  IF v_job.status = 'failed' THEN
    RETURN public.export_job_status_json(v_job);
  END IF;

  v_columns := public.export_resolve_columns(v_job.columns);

  BEGIN
    v_result := public.list_submissions(
      v_job.filters,
      '{"field":"queue_number","direction":"asc"}'::jsonb,
      jsonb_build_object('offset', v_job.processed_count),
      v_batch_limit
    );
    v_rows := COALESCE(v_result->'rows', '[]'::jsonb);
    v_batch_count := jsonb_array_length(v_rows);

    v_chunk := public.build_export_csv_chunk(
      v_rows,
      v_columns,
      v_job.processed_count = 0
    );

    IF v_job.processed_count = 0 THEN
      v_chunk := E'\xEF\xBB\xBF' || v_chunk;
    END IF;

    UPDATE public.export_jobs
    SET
      status = 'processing',
      csv_data = COALESCE(csv_data, '') || v_chunk,
      processed_count = processed_count + v_batch_count,
      updated_at = now()
    WHERE id = _job_id
    RETURNING * INTO v_job;

    IF v_batch_count = 0 OR v_job.processed_count >= v_job.total_count THEN
      UPDATE public.export_jobs
      SET
        status = 'completed',
        row_count = processed_count,
        completed_at = now(),
        updated_at = now()
      WHERE id = _job_id
      RETURNING * INTO v_job;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    UPDATE public.export_jobs
    SET
      status = 'failed',
      error_message = SQLERRM,
      updated_at = now()
    WHERE id = _job_id
    RETURNING * INTO v_job;
  END;

  RETURN public.export_job_status_json(v_job);
END;
$$;

CREATE OR REPLACE FUNCTION public.fetch_export_job_csv(_job_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job public.export_jobs%ROWTYPE;
BEGIN
  PERFORM public.export_assert_can_export();

  SELECT * INTO v_job FROM public.export_jobs WHERE id = _job_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'export job not found';
  END IF;

  IF v_job.user_id <> auth.uid() AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF v_job.status <> 'completed' OR v_job.csv_data IS NULL THEN
    RAISE EXCEPTION 'export not ready';
  END IF;

  RETURN v_job.csv_data;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_export_job(JSONB, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_export_job(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.advance_export_job(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fetch_export_job_csv(UUID) TO authenticated;
