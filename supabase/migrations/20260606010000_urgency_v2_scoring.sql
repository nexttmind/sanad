-- PRD v2 Feature A: urgency scoring v2, breakdown, tiers, overrides, history, config

CREATE TYPE public.urgency_tier AS ENUM ('critical', 'high', 'medium', 'low');

ALTER TABLE public.aid_requests
  ADD COLUMN IF NOT EXISTS urgency_tier public.urgency_tier,
  ADD COLUMN IF NOT EXISTS urgency_breakdown JSONB,
  ADD COLUMN IF NOT EXISTS effective_urgency INT,
  ADD COLUMN IF NOT EXISTS manual_urgency INT,
  ADD COLUMN IF NOT EXISTS manual_urgency_reason TEXT,
  ADD COLUMN IF NOT EXISTS manual_urgency_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS manual_urgency_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS priority_override_floor INT NOT NULL DEFAULT 85;

CREATE TABLE IF NOT EXISTS public.scoring_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version INT NOT NULL,
  rules JSONB NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (version)
);

CREATE TABLE IF NOT EXISTS public.urgency_score_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.aid_requests(id) ON DELETE CASCADE,
  calculated_urgency INT NOT NULL,
  effective_urgency INT NOT NULL,
  urgency_tier public.urgency_tier NOT NULL,
  breakdown JSONB NOT NULL,
  config_version INT NOT NULL DEFAULT 1,
  triggered_by TEXT NOT NULL DEFAULT 'system',
  actor_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_urgency_history_request
  ON public.urgency_score_history (request_id, created_at DESC);

GRANT SELECT ON public.scoring_config TO authenticated;
GRANT INSERT, UPDATE ON public.scoring_config TO authenticated;
GRANT SELECT ON public.urgency_score_history TO authenticated;
GRANT ALL ON public.scoring_config TO service_role;
GRANT ALL ON public.urgency_score_history TO service_role;

ALTER TABLE public.scoring_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.urgency_score_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff read scoring config"
  ON public.scoring_config FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE POLICY "admin manage scoring config"
  ON public.scoring_config FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "staff read urgency history"
  ON public.urgency_score_history FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE POLICY "system insert urgency history"
  ON public.urgency_score_history FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));

INSERT INTO public.scoring_config (version, rules, is_active)
VALUES (
  1,
  '{
    "version": 2,
    "raw_max": 105,
    "priority_override_floor": 85,
    "categories": {
      "shelter": { "max": 25 },
      "medical": { "max": 25 },
      "dependents": { "max": 25 },
      "displacement": { "max": 15 },
      "household": { "max": 10 },
      "reference": { "max": 5 }
    }
  }'::jsonb,
  TRUE
)
ON CONFLICT (version) DO NOTHING;

CREATE OR REPLACE FUNCTION public.urgency_tier_from_score(_score INT)
RETURNS public.urgency_tier
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN _score >= 85 THEN 'critical'::public.urgency_tier
    WHEN _score >= 70 THEN 'high'::public.urgency_tier
    WHEN _score >= 45 THEN 'medium'::public.urgency_tier
    ELSE 'low'::public.urgency_tier
  END;
$$;

CREATE OR REPLACE FUNCTION public.compute_effective_urgency(
  _urgency INT,
  _manual INT,
  _priority_override BOOLEAN,
  _floor INT DEFAULT 85
)
RETURNS INT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(
    _manual,
    CASE WHEN _priority_override THEN GREATEST(_urgency, _floor) ELSE _urgency END
  );
$$;

CREATE OR REPLACE FUNCTION public.sync_effective_urgency()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.effective_urgency := public.compute_effective_urgency(
    NEW.urgency_score,
    NEW.manual_urgency,
    NEW.priority_override,
    NEW.priority_override_floor
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_effective_urgency ON public.aid_requests;
CREATE TRIGGER trg_sync_effective_urgency
  BEFORE INSERT OR UPDATE OF urgency_score, manual_urgency, priority_override, priority_override_floor
  ON public.aid_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_effective_urgency();

CREATE OR REPLACE FUNCTION public.least_cat(_val INT, _max INT)
RETURNS INT
LANGUAGE sql
IMMUTABLE
AS $$ SELECT LEAST(GREATEST(_val, 0), _max); $$;

CREATE OR REPLACE FUNCTION public.calculate_scores(_request_id UUID)
RETURNS TABLE(trust SMALLINT, urgency SMALLINT, risk public.risk_level)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.aid_requests%ROWTYPE;
  v_trust INT := 50;
  v_shelter_pts INT := 0;
  v_medical_pts INT := 0;
  v_dependents_pts INT := 0;
  v_displacement_pts INT := 0;
  v_household_pts INT := 0;
  v_reference_pts INT := 0;
  v_raw INT := 0;
  v_urgency INT := 0;
  v_effective INT := 0;
  v_tier public.urgency_tier;
  v_risk public.risk_level;
  v_shelter TEXT;
  v_needs TEXT[];
  v_now TIMESTAMPTZ := now();
  v_flags TEXT[] := '{}';
  v_prev_code TEXT;
  v_repeat_flag TEXT;
  v_ref_result TEXT;
  v_breakdown JSONB;
  v_config_version INT := 1;
  v_shelter_reasons TEXT[] := '{}';
  v_medical_reasons TEXT[] := '{}';
  v_dependents_reasons TEXT[] := '{}';
  v_displacement_reasons TEXT[] := '{}';
  v_household_reasons TEXT[] := '{}';
  v_reference_reasons TEXT[] := '{}';
BEGIN
  SELECT * INTO r FROM public.aid_requests WHERE id = _request_id;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT COALESCE(MAX(version), 1) INTO v_config_version
  FROM public.scoring_config WHERE is_active = TRUE;

  v_flags := COALESCE(r.flags, '{}');
  v_shelter := COALESCE(LOWER(r.housing_type), '');
  v_needs := COALESCE(r.needs, ARRAY[]::TEXT[]);

  -- Shelter (max 25)
  IF v_shelter LIKE '%school%' OR v_shelter LIKE '%مدرسة%' THEN
    v_shelter_pts := 25; v_shelter_reasons := array_append(v_shelter_reasons, 'school_shelter');
  ELSIF v_shelter LIKE '%maawe%' OR v_shelter LIKE '%مأوى%' OR v_shelter LIKE '%shelter%' THEN
    v_shelter_pts := 20; v_shelter_reasons := array_append(v_shelter_reasons, 'informal_shelter');
  ELSIF v_shelter LIKE '%destroy%' OR v_shelter LIKE '%دمار%' THEN
    v_shelter_pts := 15; v_shelter_reasons := array_append(v_shelter_reasons, 'destroyed_home');
  ELSIF v_shelter LIKE '%rent%' OR v_shelter LIKE '%إيجار%' THEN
    v_shelter_pts := 12; v_shelter_reasons := array_append(v_shelter_reasons, 'rented');
  ELSIF v_shelter LIKE '%host%' OR v_shelter LIKE '%أقارب%' OR v_shelter LIKE '%relative%' THEN
    v_shelter_pts := 5; v_shelter_reasons := array_append(v_shelter_reasons, 'with_relatives');
  ELSIF v_shelter <> '' AND v_shelter NOT LIKE '%own%' AND v_shelter NOT LIKE '%منزل%' THEN
    v_shelter_pts := 15; v_shelter_reasons := array_append(v_shelter_reasons, 'other_housing');
  END IF;
  v_shelter_pts := public.least_cat(v_shelter_pts, 25);

  -- Medical (max 25)
  IF 'medicine' = ANY(v_needs) OR 'medication' = ANY(v_needs) OR 'دواء' = ANY(v_needs) THEN
    v_medical_pts := v_medical_pts + 15;
    v_medical_reasons := array_append(v_medical_reasons, 'medicine_need');
  END IF;
  IF r.chronic_illness THEN
    v_medical_pts := v_medical_pts + 10;
    v_medical_reasons := array_append(v_medical_reasons, 'chronic_illness');
  END IF;
  IF r.disabled THEN
    v_medical_pts := v_medical_pts + 10;
    v_medical_reasons := array_append(v_medical_reasons, 'disabled');
  END IF;
  v_medical_pts := public.least_cat(v_medical_pts, 25);

  -- Dependents (max 25)
  IF r.infants >= 1 THEN
    v_dependents_pts := v_dependents_pts + LEAST(r.infants * 8, 16);
    v_dependents_reasons := array_append(v_dependents_reasons, 'infants');
  END IF;
  IF r.elderly > 0 THEN
    v_dependents_pts := v_dependents_pts + LEAST(r.elderly * 4, 8);
    v_dependents_reasons := array_append(v_dependents_reasons, 'elderly');
  END IF;
  IF r.pregnant_or_nursing THEN
    v_dependents_pts := v_dependents_pts + 10;
    v_dependents_reasons := array_append(v_dependents_reasons, 'pregnant_or_nursing');
  END IF;
  IF r.children >= 3 THEN
    v_dependents_pts := v_dependents_pts + 5;
    v_dependents_reasons := array_append(v_dependents_reasons, 'many_children');
  END IF;
  IF 'diapers' = ANY(v_needs) OR 'milk' = ANY(v_needs) OR 'حفاضات' = ANY(v_needs) OR 'حليب' = ANY(v_needs) THEN
    v_dependents_pts := v_dependents_pts + 5;
    v_dependents_reasons := array_append(v_dependents_reasons, 'infant_supplies');
  END IF;
  v_dependents_pts := public.least_cat(v_dependents_pts, 25);

  -- Displacement (max 15)
  IF r.displaced AND r.displacement_date IS NOT NULL THEN
    IF r.displacement_date >= (CURRENT_DATE - INTERVAL '7 days') THEN
      v_displacement_pts := 15;
      v_displacement_reasons := array_append(v_displacement_reasons, 'displaced_7d');
    ELSIF r.displacement_date >= (CURRENT_DATE - INTERVAL '30 days') THEN
      v_displacement_pts := 10;
      v_displacement_reasons := array_append(v_displacement_reasons, 'displaced_30d');
    ELSIF r.displacement_date >= (CURRENT_DATE - INTERVAL '90 days') THEN
      v_displacement_pts := 5;
      v_displacement_reasons := array_append(v_displacement_reasons, 'displaced_90d');
    END IF;
  END IF;
  v_displacement_pts := public.least_cat(v_displacement_pts, 15);

  -- Household (max 10)
  IF r.family_size >= 8 THEN
    v_household_pts := 10;
    v_household_reasons := array_append(v_household_reasons, 'family_8plus');
  ELSIF r.family_size >= 6 THEN
    v_household_pts := 7;
    v_household_reasons := array_append(v_household_reasons, 'family_6plus');
  ELSIF r.family_size >= 4 THEN
    v_household_pts := 4;
    v_household_reasons := array_append(v_household_reasons, 'family_4plus');
  END IF;
  v_household_pts := public.least_cat(v_household_pts, 10);

  -- Reference (max 5, penalty allowed)
  SELECT sr.contact_result::TEXT INTO v_ref_result
  FROM public.submission_references sr
  WHERE sr.request_id = r.id
  LIMIT 1;

  IF v_ref_result = 'confirmed' THEN
    v_reference_pts := 5;
    v_reference_reasons := array_append(v_reference_reasons, 'reference_confirmed');
  ELSIF v_ref_result = 'denied' THEN
    v_reference_reasons := array_append(v_reference_reasons, 'reference_denied');
  END IF;
  v_reference_pts := public.least_cat(v_reference_pts, 5);

  v_raw := v_shelter_pts + v_medical_pts + v_dependents_pts + v_displacement_pts + v_household_pts + v_reference_pts;
  IF v_ref_result = 'denied' THEN
    v_raw := GREATEST(v_raw - 10, 0);
  END IF;
  v_urgency := ROUND(LEAST(v_raw, 105) * 100.0 / 105.0)::INT;
  v_tier := public.urgency_tier_from_score(v_urgency);

  v_breakdown := jsonb_build_object(
    'version', 2,
    'config_version', v_config_version,
    'categories', jsonb_build_object(
      'shelter', jsonb_build_object('points', v_shelter_pts, 'max', 25, 'reasons', to_jsonb(v_shelter_reasons)),
      'medical', jsonb_build_object('points', v_medical_pts, 'max', 25, 'reasons', to_jsonb(v_medical_reasons)),
      'dependents', jsonb_build_object('points', v_dependents_pts, 'max', 25, 'reasons', to_jsonb(v_dependents_reasons)),
      'displacement', jsonb_build_object('points', v_displacement_pts, 'max', 15, 'reasons', to_jsonb(v_displacement_reasons)),
      'household', jsonb_build_object('points', v_household_pts, 'max', 10, 'reasons', to_jsonb(v_household_reasons)),
      'reference', jsonb_build_object('points', v_reference_pts, 'max', 5, 'reasons', to_jsonb(v_reference_reasons))
    ),
    'raw_total', v_raw,
    'normalized', v_urgency,
    'tier', v_tier::TEXT
  );

  -- TRUST (unchanged logic from admin detail actions migration)
  IF r.phone_verified THEN v_trust := v_trust + 20; END IF;
  IF r.origin_town IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.conflict_zones z WHERE z.is_active AND r.origin_town ILIKE '%'||z.region_name||'%'
  ) THEN v_trust := v_trust + 15; END IF;
  IF r.town IS NOT NULL AND r.origin_town IS NOT NULL AND LOWER(r.town) NOT LIKE '%'||LOWER(r.origin_town)||'%' THEN v_trust := v_trust + 10; END IF;
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

  v_effective := public.compute_effective_urgency(
    v_urgency, r.manual_urgency, r.priority_override, r.priority_override_floor
  );

  UPDATE public.aid_requests
    SET trust_score = v_trust,
        urgency_score = v_urgency,
        urgency_tier = v_tier,
        urgency_breakdown = v_breakdown,
        effective_urgency = v_effective,
        risk_level = v_risk,
        flags = v_flags,
        last_scored_at = v_now
    WHERE id = _request_id;

  INSERT INTO public.urgency_score_history (
    request_id, calculated_urgency, effective_urgency, urgency_tier,
    breakdown, config_version, triggered_by, actor_id
  ) VALUES (
    _request_id, v_urgency, v_effective, v_tier,
    v_breakdown, v_config_version, 'system', auth.uid()
  );

  trust := v_trust::SMALLINT;
  urgency := v_urgency::SMALLINT;
  risk := v_risk;
  RETURN NEXT;
END $$;

GRANT EXECUTE ON FUNCTION public.calculate_scores(UUID) TO authenticated;

CREATE INDEX IF NOT EXISTS idx_aid_requests_pending_queue
  ON public.aid_requests (effective_urgency DESC NULLS LAST, queue_number ASC)
  WHERE status IN ('submitted', 'reviewing', 'verifying', 'on_hold');

-- Backfill effective urgency + recalculate all scores
UPDATE public.aid_requests
SET effective_urgency = public.compute_effective_urgency(
  urgency_score, manual_urgency, priority_override, priority_override_floor
)
WHERE effective_urgency IS NULL;

DO $$ DECLARE rec RECORD; BEGIN
  FOR rec IN SELECT id FROM public.aid_requests LOOP
    PERFORM public.calculate_scores(rec.id);
  END LOOP;
END $$;
