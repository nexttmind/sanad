-- Phase B4: purge stale rate_limit_log rows (default 30 days retention).

CREATE OR REPLACE FUNCTION public.purge_rate_limit_log(_retention_days INT DEFAULT 30)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted BIGINT;
  v_days INT;
BEGIN
  v_days := GREATEST(COALESCE(_retention_days, 30), 7);

  DELETE FROM public.rate_limit_log
  WHERE created_at < now() - make_interval(days => v_days);

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.purge_rate_limit_log(INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.purge_rate_limit_log(INT) TO service_role;

-- Daily purge at 04:00 UTC when pg_cron is available (no edge secret required).
DO $$
DECLARE
  v_job_id BIGINT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE 'rate_limit_log retention: pg_cron not enabled — run purge_rate_limit_log manually or enable cron.';
    RETURN;
  END IF;

  SELECT jobid INTO v_job_id FROM cron.job WHERE jobname = 'purge-rate-limit-log' LIMIT 1;
  IF v_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(v_job_id);
  END IF;

  PERFORM cron.schedule(
    'purge-rate-limit-log',
    '0 4 * * *',
    $job$SELECT public.purge_rate_limit_log(30);$job$
  );
EXCEPTION
  WHEN undefined_table OR undefined_object THEN
    RAISE NOTICE 'rate_limit_log retention: pg_cron unavailable — configure schedule in Supabase Dashboard.';
END;
$$;
