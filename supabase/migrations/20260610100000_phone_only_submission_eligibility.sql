-- Public form no longer collects national ID / passport — eligibility is phone-only.
-- _national_id kept for backward-compatible RPC signature; ignored for new submissions.

CREATE OR REPLACE FUNCTION public.check_submission_eligibility(_phone TEXT, _national_id TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phone_norm TEXT;
  v_existing RECORD;
  v_phone_message TEXT := 'سبق أن قدّمت طلباً من هذا الرقم. يُسمح بطلب واحد فقط لكل رقم هاتف.';
BEGIN
  v_phone_norm := public.normalize_lebanese_phone(_phone);
  IF v_phone_norm IS NULL THEN
    RETURN jsonb_build_object(
      'allowed', FALSE,
      'reason', 'invalid_phone',
      'message_ar', 'يرجى التحقق من رقم الهاتف.',
      'existing_reference_code', NULL
    );
  END IF;

  SELECT r.reference_code INTO v_existing
  FROM public.aid_requests r
  WHERE r.phone_normalized = v_phone_norm
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'allowed', FALSE,
      'reason', 'phone_already_submitted',
      'message_ar', v_phone_message,
      'existing_reference_code', public.mask_reference_code(v_existing.reference_code)
    );
  END IF;

  RETURN jsonb_build_object(
    'allowed', TRUE,
    'reason', NULL,
    'message_ar', NULL,
    'existing_reference_code', NULL
  );
END;
$$;
