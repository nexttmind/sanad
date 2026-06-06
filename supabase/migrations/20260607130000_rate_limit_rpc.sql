-- Step 2.1 (SEC-R01): shared rate-limit RPCs; writes only via SECURITY DEFINER

CREATE OR REPLACE FUNCTION public.log_rate_limit_block(
  _identifier TEXT,
  _action TEXT,
  _meta JSONB DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF length(COALESCE(_identifier, '')) < 1 OR length(COALESCE(_action, '')) < 1 THEN
    RETURN;
  END IF;

  INSERT INTO public.rate_limit_log (identifier, action, is_blocked, meta)
  VALUES (_identifier, _action, TRUE, _meta);
END;
$$;

CREATE OR REPLACE FUNCTION public.check_rate_limit(
  _identifier TEXT,
  _action TEXT,
  _max_count INT,
  _window_seconds INT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max INT := GREATEST(COALESCE(_max_count, 1), 1);
  v_window INT := GREATEST(COALESCE(_window_seconds, 60), 1);
  v_window_start TIMESTAMPTZ;
  v_count INT := 0;
  v_oldest TIMESTAMPTZ;
  v_retry INT := 0;
BEGIN
  IF length(COALESCE(_identifier, '')) < 1 OR length(COALESCE(_identifier, '')) > 128 THEN
    RAISE EXCEPTION 'invalid identifier';
  END IF;
  IF length(COALESCE(_action, '')) < 1 OR length(COALESCE(_action, '')) > 64 THEN
    RAISE EXCEPTION 'invalid action';
  END IF;

  v_window_start := now() - make_interval(secs => v_window);

  SELECT COUNT(*)::INT, MIN(created_at)
  INTO v_count, v_oldest
  FROM public.rate_limit_log
  WHERE identifier = _identifier
    AND action = _action
    AND created_at > v_window_start
    AND is_blocked = FALSE;

  IF v_count >= v_max THEN
    IF v_oldest IS NOT NULL THEN
      v_retry := GREATEST(
        0,
        CEIL(EXTRACT(EPOCH FROM (v_oldest + make_interval(secs => v_window) - now())))::INT
      );
    ELSE
      v_retry := v_window;
    END IF;

    PERFORM public.log_rate_limit_block(_identifier, _action);

    RETURN jsonb_build_object(
      'allowed', FALSE,
      'remaining', 0,
      'retry_after_seconds', v_retry
    );
  END IF;

  INSERT INTO public.rate_limit_log (identifier, action, is_blocked)
  VALUES (_identifier, _action, FALSE);

  RETURN jsonb_build_object(
    'allowed', TRUE,
    'remaining', GREATEST(v_max - v_count - 1, 0),
    'retry_after_seconds', 0
  );
END;
$$;

REVOKE INSERT ON public.rate_limit_log FROM anon, authenticated;
DROP POLICY IF EXISTS "anyone log rate" ON public.rate_limit_log;

REVOKE ALL ON FUNCTION public.check_rate_limit(TEXT, TEXT, INT, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.log_rate_limit_block(TEXT, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(TEXT, TEXT, INT, INT) TO service_role;
GRANT EXECUTE ON FUNCTION public.log_rate_limit_block(TEXT, TEXT, JSONB) TO service_role;
