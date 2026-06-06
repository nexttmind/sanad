-- Feature 3: admin detail actions — schema + staff RPC + reference scoring

ALTER TABLE public.aid_requests
  ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.aid_request_files
  ADD COLUMN IF NOT EXISTS doc_admin_verified BOOLEAN,
  ADD COLUMN IF NOT EXISTS doc_verified_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS doc_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS doc_rejection_reason TEXT;

ALTER TABLE public.fraud_events
  ADD COLUMN IF NOT EXISTS resolution_note TEXT;

DO $$ BEGIN
  ALTER TYPE public.reference_contact_result ADD VALUE 'no_answer';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TYPE public.reference_contact_result ADD VALUE 'wrong_number';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE OR REPLACE FUNCTION public.list_staff_members()
RETURNS TABLE (
  user_id UUID,
  role public.app_role,
  email TEXT,
  display_name TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    ur.user_id,
    ur.role,
    u.email::text,
    COALESCE(
      u.raw_user_meta_data->>'full_name',
      u.raw_user_meta_data->>'name',
      split_part(u.email::text, '@', 1)
    )::text AS display_name
  FROM public.user_roles ur
  INNER JOIN auth.users u ON u.id = ur.user_id
  WHERE ur.role IN ('admin', 'reviewer', 'distributor', 'viewer')
  ORDER BY ur.role, display_name;
END $$;

REVOKE ALL ON FUNCTION public.list_staff_members() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_staff_members() TO authenticated;

GRANT EXECUTE ON FUNCTION public.calculate_scores(uuid) TO authenticated;

-- Recalculate scores including reference contact outcome from submission_references
CREATE OR REPLACE FUNCTION public.calculate_scores(_request_id UUID)
RETURNS TABLE(trust SMALLINT, urgency SMALLINT, risk public.risk_level)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.aid_requests%ROWTYPE;
  v_trust INT := 50;
  v_urgency INT := 0;
  v_risk public.risk_level;
  v_shelter TEXT;
  v_needs TEXT[];
  v_now TIMESTAMPTZ := now();
  v_flags TEXT[] := '{}';
  v_prev_code TEXT;
  v_repeat_flag TEXT;
  v_ref_result public.reference_contact_result;
BEGIN
  SELECT * INTO r FROM public.aid_requests WHERE id = _request_id;
  IF NOT FOUND THEN RETURN; END IF;

  v_flags := COALESCE(r.flags, '{}');
  v_shelter := COALESCE(LOWER(r.housing_type), '');
  v_needs := COALESCE(r.needs, ARRAY[]::TEXT[]);

  IF v_shelter LIKE '%school%' OR v_shelter LIKE '%مدرسة%' THEN v_urgency := v_urgency + 30;
  ELSIF v_shelter LIKE '%maawe%' OR v_shelter LIKE '%مأوى%' OR v_shelter LIKE '%shelter%' THEN v_urgency := v_urgency + 30;
  ELSIF v_shelter LIKE '%rent%' OR v_shelter LIKE '%إيجار%' THEN v_urgency := v_urgency + 10;
  ELSIF v_shelter LIKE '%host%' OR v_shelter LIKE '%أقارب%' OR v_shelter LIKE '%relative%' THEN v_urgency := v_urgency + 5;
  ELSIF v_shelter <> '' AND v_shelter NOT LIKE '%own%' AND v_shelter NOT LIKE '%منزل%' THEN v_urgency := v_urgency + 15;
  END IF;

  IF 'medicine' = ANY(v_needs) OR 'medication' = ANY(v_needs) OR 'دواء' = ANY(v_needs) THEN v_urgency := v_urgency + 10; END IF;
  IF r.disabled THEN v_urgency := v_urgency + 20; END IF;
  IF r.chronic_illness THEN v_urgency := v_urgency + 15; END IF;
  IF r.elderly > 0 THEN v_urgency := v_urgency + 15; END IF;
  IF r.infants >= 1 THEN v_urgency := v_urgency + 25; END IF;
  IF 'diapers' = ANY(v_needs) OR 'milk' = ANY(v_needs) OR 'حفاضات' = ANY(v_needs) OR 'حليب' = ANY(v_needs) THEN v_urgency := v_urgency + 8; END IF;
  IF r.children >= 3 THEN v_urgency := v_urgency + 10; END IF;
  IF r.displaced AND r.displacement_date IS NOT NULL AND r.displacement_date >= (CURRENT_DATE - INTERVAL '7 days') THEN v_urgency := v_urgency + 10; END IF;
  IF r.family_size >= 6 THEN v_urgency := v_urgency + 10; END IF;
  IF 'money' = ANY(v_needs) OR 'مال' = ANY(v_needs) THEN v_urgency := v_urgency + 7; END IF;
  IF r.alt_phone IS NULL OR r.alt_phone = '' THEN v_urgency := v_urgency + 5; END IF;

  v_urgency := LEAST(v_urgency, 100);

  IF r.phone_verified THEN v_trust := v_trust + 20; END IF;
  IF r.origin_town IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.conflict_zones z WHERE z.is_active AND r.origin_town ILIKE '%'||z.region_name||'%'
  ) THEN v_trust := v_trust + 15; END IF;
  IF r.town IS NOT NULL AND r.origin_town IS NOT NULL AND LOWER(r.town) NOT LIKE '%'||LOWER(r.origin_town)||'%' THEN v_trust := v_trust + 10; END IF;

  SELECT sr.contact_result INTO v_ref_result
  FROM public.submission_references sr
  WHERE sr.request_id = r.id
  LIMIT 1;

  IF v_ref_result = 'confirmed' THEN v_trust := v_trust + 30; END IF;
  IF v_ref_result IN ('denied', 'wrong_number') THEN v_trust := v_trust - 25; END IF;

  IF r.is_duplicate THEN v_trust := v_trust - 40; END IF;

  IF EXISTS (
    SELECT 1 FROM public.aid_requests x
    WHERE x.id <> r.id AND regexp_replace(x.phone,'[^0-9]','','g') = regexp_replace(r.phone,'[^0-9]','','g')
      AND x.status NOT IN ('rejected')
  ) THEN v_trust := v_trust - 40; END IF;

  IF r.device_fingerprint IS NOT NULL THEN
    SELECT x.reference_code INTO v_prev_code
    FROM public.aid_requests x
    WHERE x.id <> r.id
      AND x.device_fingerprint = r.device_fingerprint
      AND regexp_replace(x.phone, '[^0-9]', '', 'g') = regexp_replace(r.phone, '[^0-9]', '', 'g')
      AND x.status NOT IN ('rejected')
    ORDER BY x.created_at DESC
    LIMIT 1;

    IF v_prev_code IS NOT NULL THEN
      v_trust := v_trust - 25;
      v_repeat_flag := 'repeat_same_phone_device:' || v_prev_code;
      IF NOT (v_repeat_flag = ANY(v_flags)) THEN
        v_flags := array_append(v_flags, v_repeat_flag);
      END IF;
      IF NOT EXISTS (
        SELECT 1 FROM public.fraud_events fe
        WHERE fe.request_id = r.id AND fe.code = 'DEVICE_PHONE_REPEAT'
      ) THEN
        INSERT INTO public.fraud_events (request_id, code, severity, points_delta, details)
        VALUES (
          r.id, 'DEVICE_PHONE_REPEAT', 'medium', -25,
          jsonb_build_object(
            'message_ar', 'إعادة تقديم بنفس الرقم والجهاز — طلب سابق: ' || v_prev_code,
            'prior_reference_code', v_prev_code,
            'phone', r.phone
          )
        );
      END IF;
    END IF;
  END IF;

  IF r.submission_seconds IS NOT NULL AND r.submission_seconds < 60 THEN v_trust := v_trust - 20; END IF;

  IF r.ip_hash IS NOT NULL AND (
    SELECT COUNT(*) FROM public.aid_requests x
    WHERE x.id <> r.id AND x.ip_hash = r.ip_hash AND x.created_at > v_now - INTERVAL '1 hour'
  ) >= 4 THEN v_trust := v_trust - 30; END IF;

  IF r.displaced AND r.town IS NOT NULL AND r.origin_town IS NOT NULL
     AND LOWER(r.town) = LOWER(r.origin_town) THEN v_trust := v_trust - 20; END IF;

  v_trust := GREATEST(0, LEAST(v_trust, 100));

  v_risk := CASE
    WHEN v_trust >= 80 THEN 'low'::public.risk_level
    WHEN v_trust >= 60 THEN 'medium'::public.risk_level
    WHEN v_trust >= 40 THEN 'high'::public.risk_level
    WHEN v_trust >= 20 THEN 'critical'::public.risk_level
    ELSE 'fraud'::public.risk_level
  END;

  UPDATE public.aid_requests
    SET trust_score = v_trust,
        urgency_score = v_urgency,
        risk_level = v_risk,
        flags = v_flags,
        last_scored_at = v_now
    WHERE id = _request_id;

  trust := v_trust::SMALLINT;
  urgency := v_urgency::SMALLINT;
  risk := v_risk;
  RETURN NEXT;
END $$;
