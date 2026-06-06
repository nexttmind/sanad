-- Step 6.1 (SEC-R07): PIN attempt tracking and lockout for distribution QR

CREATE TABLE IF NOT EXISTS public.pin_attempt_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.aid_requests(id) ON DELETE CASCADE,
  staff_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  success BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pin_attempt_request_created
  ON public.pin_attempt_log (request_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pin_attempt_staff_created
  ON public.pin_attempt_log (staff_id, created_at DESC)
  WHERE staff_id IS NOT NULL;

GRANT SELECT ON public.pin_attempt_log TO authenticated;
GRANT ALL ON public.pin_attempt_log TO service_role;
ALTER TABLE public.pin_attempt_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff read pin attempts"
  ON public.pin_attempt_log
  FOR SELECT
  TO authenticated
  USING (public.is_staff(auth.uid()));

REVOKE INSERT ON TABLE public.pin_attempt_log FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.verify_distribution_pin(
  _request_id UUID,
  _pin TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_staff UUID := auth.uid();
  v_request public.aid_requests%ROWTYPE;
  v_failures_request INT;
  v_failures_staff INT;
  v_pin TEXT := trim(coalesce(_pin, ''));
BEGIN
  IF v_staff IS NULL OR NOT public.is_staff(v_staff) THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'not_authorized',
      'message', 'غير مصرّح.'
    );
  END IF;

  IF NOT (
    public.has_role(v_staff, 'admin')
    OR public.has_role(v_staff, 'distributor')
  ) THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'not_authorized',
      'message', 'غير مصرّح.'
    );
  END IF;

  SELECT COUNT(*)::INT INTO v_failures_request
  FROM public.pin_attempt_log
  WHERE request_id = _request_id
    AND success = FALSE
    AND created_at > now() - interval '15 minutes';

  IF v_failures_request >= 5 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'locked',
      'message', 'تم تعليق المحاولات — حاول بعد ١٥ دقيقة.'
    );
  END IF;

  SELECT COUNT(*)::INT INTO v_failures_staff
  FROM public.pin_attempt_log
  WHERE staff_id = v_staff
    AND success = FALSE
    AND created_at > now() - interval '1 hour';

  IF v_failures_staff >= 20 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'locked',
      'message', 'تجاوزت الحد المسموح — حاول لاحقاً.'
    );
  END IF;

  SELECT * INTO v_request FROM public.aid_requests WHERE id = _request_id;

  IF NOT FOUND THEN
    INSERT INTO public.pin_attempt_log (request_id, staff_id, success)
      VALUES (_request_id, v_staff, FALSE);
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'not_found',
      'message', 'لم يتم العثور على الطلب.'
    );
  END IF;

  IF v_request.status <> 'approved'::public.request_status THEN
    INSERT INTO public.pin_attempt_log (request_id, staff_id, success)
      VALUES (_request_id, v_staff, FALSE);
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'not_approved',
      'message', 'الطلب غير معتمد للتوزيع.'
    );
  END IF;

  IF v_request.qr_pin IS NULL OR v_pin <> v_request.qr_pin THEN
    INSERT INTO public.pin_attempt_log (request_id, staff_id, success)
      VALUES (_request_id, v_staff, FALSE);
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'bad_pin',
      'message', 'رمز PIN غير صحيح.'
    );
  END IF;

  INSERT INTO public.pin_attempt_log (request_id, staff_id, success)
    VALUES (_request_id, v_staff, TRUE);

  RETURN jsonb_build_object('ok', true, 'code', 'valid');
END;
$$;

REVOKE ALL ON FUNCTION public.verify_distribution_pin(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_distribution_pin(UUID, TEXT) TO authenticated;
