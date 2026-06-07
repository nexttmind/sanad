-- Phase 1: phone + national_id uniqueness, daily cap (50/Asia/Beirut), status/eligibility RPCs.
-- Phase 0 audit (2026-06-07): 1 row, 0 duplicate phone groups, 0 duplicate ID groups.

-- ============ Normalization helpers ============

CREATE OR REPLACE FUNCTION public.normalize_lebanese_phone(raw TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  digits TEXT;
BEGIN
  IF raw IS NULL OR trim(raw) = '' THEN
    RETURN NULL;
  END IF;
  digits := regexp_replace(raw, '[^0-9]', '', 'g');
  IF digits = '' THEN
    RETURN NULL;
  END IF;
  IF digits ~ '^961' THEN
    RETURN digits;
  END IF;
  IF digits ~ '^0' THEN
    RETURN '961' || substring(digits FROM 2);
  END IF;
  RETURN '961' || digits;
END;
$$;

CREATE OR REPLACE FUNCTION public.normalize_national_id(raw TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN raw IS NULL OR trim(raw) = '' THEN NULL
    ELSE upper(regexp_replace(trim(raw), '[\s\-]', '', 'g'))
  END;
$$;

CREATE OR REPLACE FUNCTION public.validate_document_number(
  document_type TEXT,
  raw TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  normalized TEXT;
  digits TEXT;
BEGIN
  IF document_type IS NULL OR trim(document_type) = '' THEN
    RETURN FALSE;
  END IF;
  IF raw IS NULL OR trim(raw) = '' THEN
    RETURN FALSE;
  END IF;

  IF document_type = 'lebanese_id' THEN
    digits := regexp_replace(trim(raw), '[^0-9]', '', 'g');
    RETURN digits ~ '^\d{7,8}$';
  END IF;

  IF document_type = 'passport' THEN
    normalized := public.normalize_national_id(raw);
    RETURN normalized ~ '^[A-Z]{2}[0-9]{7}$';
  END IF;

  RETURN FALSE;
END;
$$;

CREATE OR REPLACE FUNCTION public.beirut_day_start(at_time TIMESTAMPTZ DEFAULT now())
RETURNS TIMESTAMPTZ
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT date_trunc('day', at_time AT TIME ZONE 'Asia/Beirut') AT TIME ZONE 'Asia/Beirut';
$$;

CREATE OR REPLACE FUNCTION public.submissions_today_count()
RETURNS INT
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COUNT(*)::INT
  FROM public.aid_requests
  WHERE created_at >= public.beirut_day_start();
$$;

CREATE OR REPLACE FUNCTION public.mask_reference_code(code TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN code IS NULL OR length(trim(code)) <= 4 THEN upper(trim(code))
    ELSE repeat('*', length(upper(trim(code))) - 4) || right(upper(trim(code)), 4)
  END;
$$;

-- ============ Columns + backfill ============

ALTER TABLE public.aid_requests
  ADD COLUMN IF NOT EXISTS phone_normalized TEXT,
  ADD COLUMN IF NOT EXISTS national_id_normalized TEXT,
  ADD COLUMN IF NOT EXISTS document_type TEXT;

UPDATE public.aid_requests
SET phone_normalized = public.normalize_lebanese_phone(phone)
WHERE phone_normalized IS NULL AND phone IS NOT NULL;

UPDATE public.aid_requests
SET national_id_normalized = public.normalize_national_id(national_id)
WHERE national_id_normalized IS NULL
  AND national_id IS NOT NULL
  AND trim(national_id) <> '';

ALTER TABLE public.aid_requests
  DROP CONSTRAINT IF EXISTS aid_requests_document_type_check;

ALTER TABLE public.aid_requests
  ADD CONSTRAINT aid_requests_document_type_check
  CHECK (
    document_type IS NULL
    OR document_type IN ('lebanese_id', 'passport')
  );

-- ============ Triggers ============

CREATE OR REPLACE FUNCTION public.set_aid_request_phone_normalized()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.phone_normalized := public.normalize_lebanese_phone(NEW.phone);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_aid_request_national_id_normalized()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.national_id IS NOT NULL AND trim(NEW.national_id) <> '' THEN
    NEW.national_id_normalized := public.normalize_national_id(NEW.national_id);
  ELSE
    NEW.national_id_normalized := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_phone_normalized ON public.aid_requests;
CREATE TRIGGER trg_set_phone_normalized
  BEFORE INSERT OR UPDATE OF phone ON public.aid_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.set_aid_request_phone_normalized();

DROP TRIGGER IF EXISTS trg_set_national_id_normalized ON public.aid_requests;
CREATE TRIGGER trg_set_national_id_normalized
  BEFORE INSERT OR UPDATE OF national_id ON public.aid_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.set_aid_request_national_id_normalized();

CREATE OR REPLACE FUNCTION public.enforce_daily_submission_cap()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_limit INT := 50;
  v_count INT;
  v_day DATE;
BEGIN
  v_day := (now() AT TIME ZONE 'Asia/Beirut')::DATE;
  PERFORM pg_advisory_xact_lock(hashtext('daily_cap_' || v_day::TEXT));

  SELECT COUNT(*)::INT INTO v_count
  FROM public.aid_requests
  WHERE created_at >= public.beirut_day_start()
    AND created_at < public.beirut_day_start() + INTERVAL '1 day';

  IF v_count >= v_limit THEN
    RAISE EXCEPTION 'daily_cap_reached'
      USING ERRCODE = 'check_violation',
            HINT = 'Daily submission cap reached for Asia/Beirut calendar day';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_daily_cap ON public.aid_requests;
CREATE TRIGGER trg_enforce_daily_cap
  BEFORE INSERT ON public.aid_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_daily_submission_cap();

-- ============ Indexes ============

CREATE UNIQUE INDEX IF NOT EXISTS aid_requests_phone_normalized_unique
  ON public.aid_requests (phone_normalized)
  WHERE phone_normalized IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS aid_requests_national_id_normalized_unique
  ON public.aid_requests (national_id_normalized)
  WHERE national_id_normalized IS NOT NULL AND trim(national_id_normalized) <> '';

CREATE INDEX IF NOT EXISTS aid_requests_ip_hash_idx
  ON public.aid_requests (ip_hash)
  WHERE ip_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS aid_requests_device_fingerprint_idx
  ON public.aid_requests (device_fingerprint)
  WHERE device_fingerprint IS NOT NULL;

-- ============ RPCs ============

CREATE OR REPLACE FUNCTION public.get_submission_status()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit INT := 50;
  v_count INT;
  v_cap_message TEXT := 'نعتذر — وصلنا إلى الحد اليومي لاستقبال الطلبات (٥٠ طلباً). سنعود لاستقبال طلبات جديدة غداً. إذا قدّمت طلباً سابقاً، يمكنك متابعته من صفحة التتبّع.';
BEGIN
  v_count := public.submissions_today_count();

  IF v_count >= v_limit THEN
    RETURN jsonb_build_object(
      'accepting', FALSE,
      'daily_count', v_count,
      'daily_limit', v_limit,
      'message_ar', v_cap_message
    );
  END IF;

  RETURN jsonb_build_object(
    'accepting', TRUE,
    'daily_count', v_count,
    'daily_limit', v_limit,
    'message_ar', NULL
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.check_submission_eligibility(_phone TEXT, _national_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit INT := 50;
  v_count INT;
  v_phone_norm TEXT;
  v_id_norm TEXT;
  v_existing RECORD;
  v_cap_message TEXT := 'نعتذر — وصلنا إلى الحد اليومي لاستقبال الطلبات (٥٠ طلباً). سنعود لاستقبال طلبات جديدة غداً. إذا قدّمت طلباً سابقاً، يمكنك متابعته من صفحة التتبّع.';
  v_phone_message TEXT := 'سبق أن قدّمت طلباً من هذا الرقم. يُسمح بطلب واحد فقط لكل رقم هاتف.';
  v_id_message TEXT := 'سبق أن قُدّم طلب بهذه الوثيقة. يُسمح بطلب واحد فقط لكل رقم وثيقة.';
BEGIN
  -- 1) Daily cap
  v_count := public.submissions_today_count();
  IF v_count >= v_limit THEN
    RETURN jsonb_build_object(
      'allowed', FALSE,
      'reason', 'daily_cap_reached',
      'message_ar', v_cap_message,
      'existing_reference_code', NULL
    );
  END IF;

  v_phone_norm := public.normalize_lebanese_phone(_phone);
  IF v_phone_norm IS NULL THEN
    RETURN jsonb_build_object(
      'allowed', FALSE,
      'reason', 'invalid_phone',
      'message_ar', 'يرجى التحقق من رقم الهاتف.',
      'existing_reference_code', NULL
    );
  END IF;

  IF _national_id IS NULL OR trim(_national_id) = '' THEN
    RETURN jsonb_build_object(
      'allowed', FALSE,
      'reason', 'invalid_national_id',
      'message_ar', 'يرجى إدخال رقم الوثيقة.',
      'existing_reference_code', NULL
    );
  END IF;

  v_id_norm := public.normalize_national_id(_national_id);
  IF v_id_norm IS NULL OR trim(v_id_norm) = '' THEN
    RETURN jsonb_build_object(
      'allowed', FALSE,
      'reason', 'invalid_national_id',
      'message_ar', 'يرجى إدخال رقم الوثيقة.',
      'existing_reference_code', NULL
    );
  END IF;

  -- 2) Phone duplicate
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

  -- 3) National ID duplicate
  SELECT r.reference_code INTO v_existing
  FROM public.aid_requests r
  WHERE r.national_id_normalized = v_id_norm
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'allowed', FALSE,
      'reason', 'id_already_submitted',
      'message_ar', v_id_message,
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

REVOKE ALL ON FUNCTION public.get_submission_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_submission_status() TO anon, authenticated;

REVOKE ALL ON FUNCTION public.check_submission_eligibility(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_submission_eligibility(TEXT, TEXT) TO service_role;

-- ============ Track RPCs — use canonical phone normalization ============

CREATE OR REPLACE FUNCTION public.track_request(_code TEXT, _phone TEXT)
RETURNS TABLE (
  reference_code TEXT,
  full_name TEXT,
  phone_masked TEXT,
  governorate TEXT,
  district TEXT,
  town TEXT,
  family_size INT,
  status public.request_status,
  distribution_date DATE,
  distribution_location TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    r.reference_code,
    r.full_name,
    regexp_replace(r.phone, '^(.{0,4}).+(.{3})$', '\1••• ••• \2'),
    r.governorate,
    r.district,
    r.town,
    r.family_size,
    r.status,
    CASE WHEN r.status = 'distributed' THEN r.distribution_date ELSE NULL END,
    CASE WHEN r.status = 'distributed' THEN r.distribution_location ELSE NULL END,
    r.created_at,
    r.updated_at
  FROM public.aid_requests r
  WHERE upper(r.reference_code) = upper(_code)
    AND r.phone_normalized = public.normalize_lebanese_phone(_phone)
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.track_request_history(_code TEXT, _phone TEXT)
RETURNS TABLE (
  to_status public.request_status,
  changed_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT h.to_status, h.created_at AS changed_at
  FROM public.aid_request_history h
  INNER JOIN public.aid_requests r ON r.id = h.request_id
  WHERE upper(r.reference_code) = upper(_code)
    AND r.phone_normalized = public.normalize_lebanese_phone(_phone)
  ORDER BY h.created_at ASC;
$$;

CREATE OR REPLACE FUNCTION public.track_queue_position(_code TEXT, _phone TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.aid_requests%ROWTYPE;
  v_pending_total INT;
  v_position INT;
BEGIN
  SELECT * INTO v_row
  FROM public.aid_requests r
  WHERE upper(r.reference_code) = upper(_code)
    AND r.phone_normalized = public.normalize_lebanese_phone(_phone)
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF v_row.status NOT IN ('submitted', 'reviewing', 'verifying', 'on_hold') THEN
    RETURN NULL;
  END IF;

  SELECT COUNT(*)::INT INTO v_pending_total
  FROM public.aid_requests r
  WHERE r.status IN ('submitted', 'reviewing', 'verifying', 'on_hold');

  SELECT COUNT(*)::INT + 1 INTO v_position
  FROM public.aid_requests r
  WHERE r.status IN ('submitted', 'reviewing', 'verifying', 'on_hold')
    AND r.id <> v_row.id
    AND (
      COALESCE(r.effective_urgency, r.urgency_score, 0) > COALESCE(v_row.effective_urgency, v_row.urgency_score, 0)
      OR (
        COALESCE(r.effective_urgency, r.urgency_score, 0) = COALESCE(v_row.effective_urgency, v_row.urgency_score, 0)
        AND r.queue_number < v_row.queue_number
      )
    );

  RETURN jsonb_build_object(
    'queue_number', v_row.queue_number,
    'position_among_pending', v_position,
    'pending_total', v_pending_total
  );
END;
$$;
