ALTER FUNCTION public.set_updated_at() SET search_path = public;
ALTER FUNCTION public.gen_request_code() SET search_path = public;
ALTER FUNCTION public.gen_donation_code() SET search_path = public;

REVOKE ALL ON FUNCTION public.calculate_scores(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_score_request() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.log_request_status_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_first_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_first_admin() TO authenticated;
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
REVOKE ALL ON FUNCTION public.is_staff(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO authenticated;

DROP POLICY IF EXISTS "anyone can submit" ON public.aid_requests;
CREATE POLICY "anyone can submit"
ON public.aid_requests
FOR INSERT
WITH CHECK (
  trust_score = 50
  AND urgency_score = 50
  AND risk_level = 'medium'::risk_level
  AND priority_override = false
  AND is_duplicate = false
  AND phone_verified = false
  AND flags = '{}'::text[]
  AND status = 'submitted'::request_status
  AND rejection_reason IS NULL
  AND distribution_date IS NULL
  AND distribution_location IS NULL
  AND last_scored_at IS NULL
);

DROP POLICY IF EXISTS "anyone insert file refs" ON public.aid_request_files;
CREATE POLICY "anyone insert file refs"
ON public.aid_request_files
FOR INSERT
WITH CHECK (
  bucket IN ('id-docs','payment-proofs')
  AND kind IN ('id','proof','other')
  AND EXISTS (
    SELECT 1 FROM public.aid_requests r
    WHERE r.id = aid_request_files.request_id
      AND r.created_at > now() - interval '1 hour'
      AND r.status = 'submitted'::request_status
  )
);

DROP POLICY IF EXISTS "anyone upload proof" ON public.payment_proofs;
CREATE POLICY "anyone upload proof"
ON public.payment_proofs
FOR INSERT
WITH CHECK (
  verified = false
  AND bucket = 'payment-proofs'
  AND EXISTS (
    SELECT 1 FROM public.donations d
    WHERE d.id = payment_proofs.donation_id
      AND d.created_at > now() - interval '24 hours'
      AND d.status = 'pending'::donation_status
  )
);

DROP POLICY IF EXISTS "anyone update otp" ON public.phone_verifications;

CREATE OR REPLACE FUNCTION public.verify_phone_otp(_phone text, _code text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  UPDATE public.phone_verifications
    SET attempts = attempts + 1
    WHERE regexp_replace(phone,'[^0-9]','','g') = regexp_replace(_phone,'[^0-9]','','g')
      AND verified_at IS NULL
      AND expires_at > now()
      AND attempts < 5
    RETURNING id INTO v_id;

  IF v_id IS NULL THEN RETURN FALSE; END IF;

  UPDATE public.phone_verifications
    SET verified_at = now()
    WHERE id = v_id
      AND code = _code
    RETURNING id INTO v_id;

  RETURN v_id IS NOT NULL;
END $$;

REVOKE ALL ON FUNCTION public.verify_phone_otp(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_phone_otp(text, text) TO anon, authenticated;

DROP POLICY IF EXISTS "anyone create otp" ON public.phone_verifications;
CREATE POLICY "anyone create otp"
ON public.phone_verifications
FOR INSERT
WITH CHECK (
  attempts = 0
  AND verified_at IS NULL
  AND length(code) BETWEEN 4 AND 8
  AND length(phone) BETWEEN 6 AND 32
);

DROP POLICY IF EXISTS "anyone log rate" ON public.rate_limit_log;
CREATE POLICY "anyone log rate"
ON public.rate_limit_log
FOR INSERT
WITH CHECK (
  is_blocked = false
  AND length(identifier) BETWEEN 1 AND 128
  AND length(action) BETWEEN 1 AND 64
);