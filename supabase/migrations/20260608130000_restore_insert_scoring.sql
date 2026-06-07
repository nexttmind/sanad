-- Restore synchronous scoring on INSERT (deferred edge scoring caused worker timeouts).

CREATE OR REPLACE FUNCTION public.trg_score_request()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.calculate_scores(NEW.id, 'system');
  ELSE
    PERFORM public.calculate_scores(NEW.id, 'field_change');
  END IF;
  RETURN NEW;
END;
$$;
