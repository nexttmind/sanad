-- Step 11.1 (OPS-R04): service-role integrity check + optional pg_cron nightly invoke

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
  IF COALESCE(auth.jwt()->>'role', '') <> 'service_role' THEN
    IF NOT public.is_staff(auth.uid()) THEN
      RAISE EXCEPTION 'not authorized';
    END IF;
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

GRANT EXECUTE ON FUNCTION public.check_queue_integrity() TO service_role;

-- Nightly POST to queue-integrity-check (03:00 UTC). Requires vault secrets:
--   project_url              → https://lpdjtzwfxsjjudhxinmk.supabase.co
--   scheduled_function_secret → same value as edge SCHEDULED_FUNCTION_SECRET
DO $$
DECLARE
  v_url TEXT;
  v_secret TEXT;
  v_job_id BIGINT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE 'Step 11.1: pg_cron not enabled — use Dashboard → Integrations → Cron or Edge Function schedule.';
    RETURN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    RAISE NOTICE 'Step 11.1: pg_net not enabled — use Dashboard schedule instead.';
    RETURN;
  END IF;

  SELECT decrypted_secret INTO v_url
  FROM vault.decrypted_secrets
  WHERE name = 'project_url'
  LIMIT 1;

  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets
  WHERE name = 'scheduled_function_secret'
  LIMIT 1;

  IF v_url IS NULL OR v_secret IS NULL THEN
    RAISE NOTICE 'Step 11.1: vault secrets project_url / scheduled_function_secret missing — cron not scheduled. See playbook Step 11.1.';
    RETURN;
  END IF;

  SELECT jobid INTO v_job_id FROM cron.job WHERE jobname = 'nightly-queue-integrity-check' LIMIT 1;
  IF v_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(v_job_id);
  END IF;

  PERFORM cron.schedule(
    'nightly-queue-integrity-check',
    '0 3 * * *',
    format(
      $job$
      SELECT net.http_post(
        url := %L || '/functions/v1/queue-integrity-check',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-scheduled-secret', %L
        ),
        body := '{}'::jsonb
      );
      $job$,
      v_url,
      v_secret
    )
  );
EXCEPTION
  WHEN undefined_table OR undefined_object THEN
    RAISE NOTICE 'Step 11.1: pg_cron/vault unavailable — configure schedule in Supabase Dashboard.';
END;
$$;
