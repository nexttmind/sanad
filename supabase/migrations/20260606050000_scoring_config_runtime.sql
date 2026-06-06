-- PRD v2 A2: apply scoring_config category caps at runtime + preview + bulk recalc

CREATE OR REPLACE FUNCTION public.calculate_scores(
  _request_id UUID,
  _triggered_by TEXT DEFAULT 'system'
)
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
  v_cfg JSONB;
  v_raw_max INT := 105;
  v_max_shelter INT := 25;
  v_max_medical INT := 25;
  v_max_dependents INT := 25;
  v_max_displacement INT := 15;
  v_max_household INT := 10;
  v_max_reference INT := 5;
  v_shelter_school_pts INT := 25;
  v_shelter_informal_pts INT := 20;
  v_shelter_destroyed_pts INT := 15;
  v_shelter_rented_pts INT := 12;
  v_shelter_relatives_pts INT := 5;
  v_shelter_other_pts INT := 15;
  v_medical_medicine_pts INT := 15;
  v_medical_chronic_pts INT := 10;
  v_medical_disabled_pts INT := 10;
  v_dependents_infants_pts INT := 8;
  v_dependents_elderly_pts INT := 4;
  v_dependents_pregnant_pts INT := 10;
  v_dependents_many_children_pts INT := 5;
  v_dependents_infant_supplies_pts INT := 5;
  v_displaced_7d_pts INT := 15;
  v_displaced_30d_pts INT := 10;
  v_displaced_90d_pts INT := 5;
  v_household_8plus_pts INT := 10;
  v_household_6plus_pts INT := 7;
  v_household_4plus_pts INT := 4;
  v_reference_confirmed_pts INT := 5;
  v_reference_denied_penalty INT := -10;
  v_shelter_reasons TEXT[] := '{}';
  v_medical_reasons TEXT[] := '{}';
  v_dependents_reasons TEXT[] := '{}';
  v_displacement_reasons TEXT[] := '{}';
  v_household_reasons TEXT[] := '{}';
  v_reference_reasons TEXT[] := '{}';
  v_trigger TEXT := COALESCE(NULLIF(trim(_triggered_by), ''), 'system');
BEGIN
  SELECT * INTO r FROM public.aid_requests WHERE id = _request_id;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT rules, version INTO v_cfg, v_config_version
  FROM public.scoring_config
  WHERE is_active = TRUE
  ORDER BY version DESC
  LIMIT 1;

  v_config_version := COALESCE(v_config_version, 1);

  IF v_cfg IS NOT NULL THEN
    v_raw_max := GREATEST(COALESCE((v_cfg->>'raw_max')::INT, 105), 1);
    v_max_shelter := GREATEST(COALESCE((v_cfg->'categories'->'shelter'->>'max')::INT, 25), 0);
    v_max_medical := GREATEST(COALESCE((v_cfg->'categories'->'medical'->>'max')::INT, 25), 0);
    v_max_dependents := GREATEST(COALESCE((v_cfg->'categories'->'dependents'->>'max')::INT, 25), 0);
    v_max_displacement := GREATEST(COALESCE((v_cfg->'categories'->'displacement'->>'max')::INT, 15), 0);
    v_max_household := GREATEST(COALESCE((v_cfg->'categories'->'household'->>'max')::INT, 10), 0);
    v_max_reference := GREATEST(COALESCE((v_cfg->'categories'->'reference'->>'max')::INT, 5), 0);
    v_shelter_school_pts := GREATEST(COALESCE((v_cfg->'categories'->'shelter'->'weights'->>'school_shelter')::INT, 25), 0);
    v_shelter_informal_pts := GREATEST(COALESCE((v_cfg->'categories'->'shelter'->'weights'->>'informal_shelter')::INT, 20), 0);
    v_shelter_destroyed_pts := GREATEST(COALESCE((v_cfg->'categories'->'shelter'->'weights'->>'destroyed_home')::INT, 15), 0);
    v_shelter_rented_pts := GREATEST(COALESCE((v_cfg->'categories'->'shelter'->'weights'->>'rented')::INT, 12), 0);
    v_shelter_relatives_pts := GREATEST(COALESCE((v_cfg->'categories'->'shelter'->'weights'->>'with_relatives')::INT, 5), 0);
    v_shelter_other_pts := GREATEST(COALESCE((v_cfg->'categories'->'shelter'->'weights'->>'other_housing')::INT, 15), 0);
    v_medical_medicine_pts := GREATEST(COALESCE((v_cfg->'categories'->'medical'->'weights'->>'medicine_need')::INT, 15), 0);
    v_medical_chronic_pts := GREATEST(COALESCE((v_cfg->'categories'->'medical'->'weights'->>'chronic_illness')::INT, 10), 0);
    v_medical_disabled_pts := GREATEST(COALESCE((v_cfg->'categories'->'medical'->'weights'->>'disabled')::INT, 10), 0);
    v_dependents_infants_pts := GREATEST(COALESCE((v_cfg->'categories'->'dependents'->'weights'->>'infants')::INT, 8), 0);
    v_dependents_elderly_pts := GREATEST(COALESCE((v_cfg->'categories'->'dependents'->'weights'->>'elderly')::INT, 4), 0);
    v_dependents_pregnant_pts := GREATEST(COALESCE((v_cfg->'categories'->'dependents'->'weights'->>'pregnant_or_nursing')::INT, 10), 0);
    v_dependents_many_children_pts := GREATEST(COALESCE((v_cfg->'categories'->'dependents'->'weights'->>'many_children')::INT, 5), 0);
    v_dependents_infant_supplies_pts := GREATEST(COALESCE((v_cfg->'categories'->'dependents'->'weights'->>'infant_supplies')::INT, 5), 0);
    v_displaced_7d_pts := GREATEST(COALESCE((v_cfg->'categories'->'displacement'->'weights'->>'displaced_7d')::INT, 15), 0);
    v_displaced_30d_pts := GREATEST(COALESCE((v_cfg->'categories'->'displacement'->'weights'->>'displaced_30d')::INT, 10), 0);
    v_displaced_90d_pts := GREATEST(COALESCE((v_cfg->'categories'->'displacement'->'weights'->>'displaced_90d')::INT, 5), 0);
    v_household_8plus_pts := GREATEST(COALESCE((v_cfg->'categories'->'household'->'weights'->>'family_8plus')::INT, 10), 0);
    v_household_6plus_pts := GREATEST(COALESCE((v_cfg->'categories'->'household'->'weights'->>'family_6plus')::INT, 7), 0);
    v_household_4plus_pts := GREATEST(COALESCE((v_cfg->'categories'->'household'->'weights'->>'family_4plus')::INT, 4), 0);
    v_reference_confirmed_pts := GREATEST(COALESCE((v_cfg->'categories'->'reference'->'weights'->>'reference_confirmed')::INT, 5), 0);
    v_reference_denied_penalty := COALESCE((v_cfg->'categories'->'reference'->'weights'->>'reference_denied')::INT, -10);
  END IF;

  v_flags := COALESCE(r.flags, '{}');
  v_shelter := COALESCE(LOWER(r.housing_type), '');
  v_needs := COALESCE(r.needs, ARRAY[]::TEXT[]);

  IF v_shelter LIKE '%school%' OR v_shelter LIKE '%مدرسة%' THEN
    v_shelter_pts := v_shelter_school_pts; v_shelter_reasons := array_append(v_shelter_reasons, 'school_shelter');
  ELSIF v_shelter LIKE '%maawe%' OR v_shelter LIKE '%مأوى%' OR v_shelter LIKE '%shelter%' THEN
    v_shelter_pts := v_shelter_informal_pts; v_shelter_reasons := array_append(v_shelter_reasons, 'informal_shelter');
  ELSIF v_shelter LIKE '%destroy%' OR v_shelter LIKE '%دمار%' THEN
    v_shelter_pts := v_shelter_destroyed_pts; v_shelter_reasons := array_append(v_shelter_reasons, 'destroyed_home');
  ELSIF v_shelter LIKE '%rent%' OR v_shelter LIKE '%إيجار%' THEN
    v_shelter_pts := v_shelter_rented_pts; v_shelter_reasons := array_append(v_shelter_reasons, 'rented');
  ELSIF v_shelter LIKE '%host%' OR v_shelter LIKE '%أقارب%' OR v_shelter LIKE '%relative%' THEN
    v_shelter_pts := v_shelter_relatives_pts; v_shelter_reasons := array_append(v_shelter_reasons, 'with_relatives');
  ELSIF v_shelter <> '' AND v_shelter NOT LIKE '%own%' AND v_shelter NOT LIKE '%منزل%' THEN
    v_shelter_pts := v_shelter_other_pts; v_shelter_reasons := array_append(v_shelter_reasons, 'other_housing');
  END IF;
  v_shelter_pts := public.least_cat(v_shelter_pts, v_max_shelter);

  IF 'medicine' = ANY(v_needs) OR 'medication' = ANY(v_needs) OR 'دواء' = ANY(v_needs) THEN
    v_medical_pts := v_medical_pts + v_medical_medicine_pts;
    v_medical_reasons := array_append(v_medical_reasons, 'medicine_need');
  END IF;
  IF r.chronic_illness THEN
    v_medical_pts := v_medical_pts + v_medical_chronic_pts;
    v_medical_reasons := array_append(v_medical_reasons, 'chronic_illness');
  END IF;
  IF r.disabled THEN
    v_medical_pts := v_medical_pts + v_medical_disabled_pts;
    v_medical_reasons := array_append(v_medical_reasons, 'disabled');
  END IF;
  v_medical_pts := public.least_cat(v_medical_pts, v_max_medical);

  IF r.infants >= 1 THEN
    v_dependents_pts := v_dependents_pts + LEAST(r.infants * v_dependents_infants_pts, 16);
    v_dependents_reasons := array_append(v_dependents_reasons, 'infants');
  END IF;
  IF r.elderly > 0 THEN
    v_dependents_pts := v_dependents_pts + LEAST(r.elderly * v_dependents_elderly_pts, 8);
    v_dependents_reasons := array_append(v_dependents_reasons, 'elderly');
  END IF;
  IF r.pregnant_or_nursing THEN
    v_dependents_pts := v_dependents_pts + v_dependents_pregnant_pts;
    v_dependents_reasons := array_append(v_dependents_reasons, 'pregnant_or_nursing');
  END IF;
  IF r.children >= 3 THEN
    v_dependents_pts := v_dependents_pts + v_dependents_many_children_pts;
    v_dependents_reasons := array_append(v_dependents_reasons, 'many_children');
  END IF;
  IF 'diapers' = ANY(v_needs) OR 'milk' = ANY(v_needs) OR 'حفاضات' = ANY(v_needs) OR 'حليب' = ANY(v_needs) THEN
    v_dependents_pts := v_dependents_pts + v_dependents_infant_supplies_pts;
    v_dependents_reasons := array_append(v_dependents_reasons, 'infant_supplies');
  END IF;
  v_dependents_pts := public.least_cat(v_dependents_pts, v_max_dependents);

  IF r.displaced AND r.displacement_date IS NOT NULL THEN
    IF r.displacement_date >= (CURRENT_DATE - INTERVAL '7 days') THEN
      v_displacement_pts := v_displaced_7d_pts;
      v_displacement_reasons := array_append(v_displacement_reasons, 'displaced_7d');
    ELSIF r.displacement_date >= (CURRENT_DATE - INTERVAL '30 days') THEN
      v_displacement_pts := v_displaced_30d_pts;
      v_displacement_reasons := array_append(v_displacement_reasons, 'displaced_30d');
    ELSIF r.displacement_date >= (CURRENT_DATE - INTERVAL '90 days') THEN
      v_displacement_pts := v_displaced_90d_pts;
      v_displacement_reasons := array_append(v_displacement_reasons, 'displaced_90d');
    END IF;
  END IF;
  v_displacement_pts := public.least_cat(v_displacement_pts, v_max_displacement);

  IF r.family_size >= 8 THEN
    v_household_pts := v_household_8plus_pts;
    v_household_reasons := array_append(v_household_reasons, 'family_8plus');
  ELSIF r.family_size >= 6 THEN
    v_household_pts := v_household_6plus_pts;
    v_household_reasons := array_append(v_household_reasons, 'family_6plus');
  ELSIF r.family_size >= 4 THEN
    v_household_pts := v_household_4plus_pts;
    v_household_reasons := array_append(v_household_reasons, 'family_4plus');
  END IF;
  v_household_pts := public.least_cat(v_household_pts, v_max_household);

  SELECT sr.contact_result::TEXT INTO v_ref_result
  FROM public.submission_references sr
  WHERE sr.request_id = r.id
  LIMIT 1;

  IF v_ref_result = 'confirmed' THEN
    v_reference_pts := v_reference_confirmed_pts;
    v_reference_reasons := array_append(v_reference_reasons, 'reference_confirmed');
  ELSIF v_ref_result = 'denied' THEN
    v_reference_reasons := array_append(v_reference_reasons, 'reference_denied');
  END IF;
  v_reference_pts := public.least_cat(v_reference_pts, v_max_reference);

  v_raw := v_shelter_pts + v_medical_pts + v_dependents_pts + v_displacement_pts + v_household_pts + v_reference_pts;
  IF v_ref_result = 'denied' THEN
    v_raw := GREATEST(v_raw + v_reference_denied_penalty, 0);
  END IF;
  v_urgency := ROUND(LEAST(v_raw, v_raw_max) * 100.0 / v_raw_max)::INT;
  v_tier := public.urgency_tier_from_score(v_urgency);

  v_breakdown := jsonb_build_object(
    'version', 2,
    'config_version', v_config_version,
    'categories', jsonb_build_object(
      'shelter', jsonb_build_object('points', v_shelter_pts, 'max', v_max_shelter, 'reasons', to_jsonb(v_shelter_reasons)),
      'medical', jsonb_build_object('points', v_medical_pts, 'max', v_max_medical, 'reasons', to_jsonb(v_medical_reasons)),
      'dependents', jsonb_build_object('points', v_dependents_pts, 'max', v_max_dependents, 'reasons', to_jsonb(v_dependents_reasons)),
      'displacement', jsonb_build_object('points', v_displacement_pts, 'max', v_max_displacement, 'reasons', to_jsonb(v_displacement_reasons)),
      'household', jsonb_build_object('points', v_household_pts, 'max', v_max_household, 'reasons', to_jsonb(v_household_reasons)),
      'reference', jsonb_build_object('points', v_reference_pts, 'max', v_max_reference, 'reasons', to_jsonb(v_reference_reasons))
    ),
    'raw_total', v_raw,
    'normalized', v_urgency,
    'tier', v_tier::TEXT
  );

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
    v_breakdown, v_config_version, v_trigger, auth.uid()
  );

  trust := v_trust::SMALLINT;
  urgency := v_urgency::SMALLINT;
  risk := v_risk;
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.calculate_scores(UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_scoring_preview_samples(_limit INT DEFAULT 3)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit INT := LEAST(GREATEST(COALESCE(_limit, 3), 1), 10);
  v_rows JSONB;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT COALESCE(jsonb_agg(row_data ORDER BY sort_created DESC), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT
      jsonb_build_object(
        'id', r.id,
        'reference_code', r.reference_code,
        'full_name', r.full_name,
        'urgency_score', r.urgency_score,
        'effective_urgency', r.effective_urgency,
        'urgency_tier', r.urgency_tier,
        'urgency_breakdown', r.urgency_breakdown,
        'created_at', r.created_at
      ) AS row_data,
      r.created_at AS sort_created
    FROM public.aid_requests r
    ORDER BY r.created_at DESC
    LIMIT v_limit
  ) recent;

  RETURN v_rows;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_scoring_preview_samples(INT) TO authenticated;

CREATE OR REPLACE FUNCTION public.bulk_recalculate_scores(
  _offset INT DEFAULT 0,
  _batch_size INT DEFAULT 100
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_batch INT := LEAST(GREATEST(COALESCE(_batch_size, 100), 1), 500);
  v_offset INT := GREATEST(COALESCE(_offset, 0), 0);
  v_total INT := 0;
  v_processed INT := 0;
  rec RECORD;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'admin only';
  END IF;

  SELECT COUNT(*)::INT INTO v_total FROM public.aid_requests;

  FOR rec IN
    SELECT id
    FROM public.aid_requests
    ORDER BY created_at ASC
    OFFSET v_offset
    LIMIT v_batch
  LOOP
    PERFORM public.calculate_scores(rec.id, 'admin_recalc');
    v_processed := v_processed + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'processed', v_processed,
    'offset', v_offset,
    'total', v_total,
    'next_offset', CASE WHEN v_offset + v_processed < v_total THEN v_offset + v_processed ELSE NULL END,
    'has_more', (v_offset + v_processed) < v_total
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.bulk_recalculate_scores(INT, INT) TO authenticated;
