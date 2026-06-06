-- PRD v2 C4: rescore after inline field edits with field_change trigger label

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

DROP TRIGGER IF EXISTS aid_requests_autoscore_upd ON public.aid_requests;
CREATE TRIGGER aid_requests_autoscore_upd
  AFTER UPDATE OF needs, housing_type, disabled, chronic_illness, elderly,
                  infants, children, family_size, displaced, displacement_date,
                  alt_phone, phone, town, origin_town, phone_verified,
                  is_duplicate, device_fingerprint, pregnant_or_nursing, governorate
  ON public.aid_requests
  FOR EACH ROW EXECUTE FUNCTION public.trg_score_request();
