-- Step 7.1 (PERF-Y01): async export uses keyset cursor instead of offset batches

ALTER TABLE public.export_jobs
  ADD COLUMN IF NOT EXISTS last_cursor JSONB;

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
  v_next_cursor JSONB;
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
      v_job.last_cursor,
      v_batch_limit
    );
    v_rows := COALESCE(v_result->'rows', '[]'::jsonb);
    v_batch_count := jsonb_array_length(v_rows);
    v_next_cursor := v_result->'next_cursor';

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
      last_cursor = v_next_cursor,
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
