
-- =============================================================================
-- SANAD — Additive migration: scoring engine + missing tables
-- =============================================================================

-- 1. ENUMS
DO $$ BEGIN
  CREATE TYPE public.risk_level AS ENUM ('low','medium','high','critical','fraud');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.distribution_status AS ENUM ('scheduled','in_progress','completed','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.reference_contact_result AS ENUM ('pending','confirmed','denied','unreachable');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Extend aid_requests with scoring + auth signals
ALTER TABLE public.aid_requests
  ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS device_fingerprint TEXT,
  ADD COLUMN IF NOT EXISTS is_duplicate BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS priority_override BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS risk_level public.risk_level NOT NULL DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS last_scored_at TIMESTAMPTZ;

-- 3. mukhtar_whitelist
CREATE TABLE IF NOT EXISTS public.mukhtar_whitelist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL UNIQUE,
  region TEXT,
  title TEXT,
  verified_at TIMESTAMPTZ,
  added_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mukhtar_whitelist TO authenticated;
GRANT ALL ON public.mukhtar_whitelist TO service_role;
ALTER TABLE public.mukhtar_whitelist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read whitelist" ON public.mukhtar_whitelist FOR SELECT TO authenticated USING (is_staff(auth.uid()));
CREATE POLICY "admins manage whitelist" ON public.mukhtar_whitelist FOR ALL TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

-- 4. phone_verifications
CREATE TABLE IF NOT EXISTS public.phone_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL,
  code TEXT NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  verified_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '10 minutes'),
  ip_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.phone_verifications TO anon, authenticated;
GRANT ALL ON public.phone_verifications TO service_role;
ALTER TABLE public.phone_verifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone create otp" ON public.phone_verifications FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anyone update otp" ON public.phone_verifications FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "staff read otp" ON public.phone_verifications FOR SELECT TO authenticated USING (is_staff(auth.uid()));
CREATE INDEX IF NOT EXISTS idx_otp_phone ON public.phone_verifications(phone, created_at DESC);

-- 5. fraud_events
CREATE TABLE IF NOT EXISTS public.fraud_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.aid_requests(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'medium',
  points_delta INT NOT NULL DEFAULT 0,
  details JSONB,
  resolved BOOLEAN NOT NULL DEFAULT FALSE,
  resolved_by UUID,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fraud_events TO authenticated;
GRANT ALL ON public.fraud_events TO service_role;
ALTER TABLE public.fraud_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read fraud" ON public.fraud_events FOR SELECT TO authenticated USING (is_staff(auth.uid()));
CREATE POLICY "staff manage fraud" ON public.fraud_events FOR ALL TO authenticated USING (is_staff(auth.uid())) WITH CHECK (is_staff(auth.uid()));
CREATE INDEX IF NOT EXISTS idx_fraud_request ON public.fraud_events(request_id);

-- 6. distribution_events
CREATE TABLE IF NOT EXISTS public.distribution_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  location TEXT NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  capacity INT,
  status public.distribution_status NOT NULL DEFAULT 'scheduled',
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.distribution_events TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.distribution_events TO authenticated;
GRANT ALL ON public.distribution_events TO service_role;
ALTER TABLE public.distribution_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read upcoming distributions" ON public.distribution_events FOR SELECT TO anon, authenticated USING (status IN ('scheduled','in_progress'));
CREATE POLICY "staff manage distributions" ON public.distribution_events FOR ALL TO authenticated USING (is_staff(auth.uid())) WITH CHECK (is_staff(auth.uid()));
CREATE TRIGGER set_dist_updated_at BEFORE UPDATE ON public.distribution_events FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 7. qr_completions
CREATE TABLE IF NOT EXISTS public.qr_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.aid_requests(id) ON DELETE CASCADE,
  event_id UUID REFERENCES public.distribution_events(id) ON DELETE SET NULL,
  pin TEXT NOT NULL,
  scanned_by UUID,
  scanned_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.qr_completions TO authenticated;
GRANT ALL ON public.qr_completions TO service_role;
ALTER TABLE public.qr_completions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff manage qr" ON public.qr_completions FOR ALL TO authenticated USING (is_staff(auth.uid())) WITH CHECK (is_staff(auth.uid()));

-- 8. tags + request_tags
CREATE TABLE IF NOT EXISTS public.tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name_ar TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#5ced73',
  category TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.tags TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.tags TO authenticated;
GRANT ALL ON public.tags TO service_role;
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone read tags" ON public.tags FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "staff manage tags" ON public.tags FOR ALL TO authenticated USING (is_staff(auth.uid())) WITH CHECK (is_staff(auth.uid()));

CREATE TABLE IF NOT EXISTS public.request_tags (
  request_id UUID NOT NULL REFERENCES public.aid_requests(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (request_id, tag_id)
);
GRANT SELECT, INSERT, DELETE ON public.request_tags TO authenticated;
GRANT ALL ON public.request_tags TO service_role;
ALTER TABLE public.request_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff manage request tags" ON public.request_tags FOR ALL TO authenticated USING (is_staff(auth.uid())) WITH CHECK (is_staff(auth.uid()));

-- 9. rate_limit_log
CREATE TABLE IF NOT EXISTS public.rate_limit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier TEXT NOT NULL,
  action TEXT NOT NULL,
  is_blocked BOOLEAN NOT NULL DEFAULT FALSE,
  meta JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT INSERT ON public.rate_limit_log TO anon, authenticated;
GRANT SELECT, UPDATE, DELETE ON public.rate_limit_log TO authenticated;
GRANT ALL ON public.rate_limit_log TO service_role;
ALTER TABLE public.rate_limit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone log rate" ON public.rate_limit_log FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "staff read rate" ON public.rate_limit_log FOR SELECT TO authenticated USING (is_staff(auth.uid()));
CREATE INDEX IF NOT EXISTS idx_rate_ident ON public.rate_limit_log(identifier, action, created_at DESC);

-- 10. conflict_zones
CREATE TABLE IF NOT EXISTS public.conflict_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  region_name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.conflict_zones TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.conflict_zones TO authenticated;
GRANT ALL ON public.conflict_zones TO service_role;
ALTER TABLE public.conflict_zones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone read zones" ON public.conflict_zones FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admins manage zones" ON public.conflict_zones FOR ALL TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

INSERT INTO public.conflict_zones (region_name) VALUES
  ('قضاء صور'),('صور'),('القليلة'),('قضاء بنت جبيل'),('بنت جبيل'),('عيترون'),
  ('ميس الجبل'),('كفركلا'),('يارون'),('عيتا الشعب'),('مارون الراس'),
  ('قضاء مرجعيون'),('مرجعيون'),('الخيام'),('كفرصوبا'),('حولا'),
  ('قضاء النبطية'),('النبطية'),('كفررمان'),('زوطر'),('شقرا'),
  ('الضاحية الجنوبية'),('برج البراجنة'),('حارة حريك'),('الغبيري')
ON CONFLICT DO NOTHING;

-- 11. Scoring engine
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
BEGIN
  SELECT * INTO r FROM public.aid_requests WHERE id = _request_id;
  IF NOT FOUND THEN RETURN; END IF;

  v_shelter := COALESCE(LOWER(r.housing_type), '');
  v_needs := COALESCE(r.needs, ARRAY[]::TEXT[]);

  -- URGENCY: Shelter
  IF v_shelter LIKE '%school%' OR v_shelter LIKE '%مدرسة%' THEN v_urgency := v_urgency + 30;
  ELSIF v_shelter LIKE '%maawe%' OR v_shelter LIKE '%مأوى%' OR v_shelter LIKE '%shelter%' THEN v_urgency := v_urgency + 30;
  ELSIF v_shelter LIKE '%rent%' OR v_shelter LIKE '%إيجار%' THEN v_urgency := v_urgency + 10;
  ELSIF v_shelter LIKE '%host%' OR v_shelter LIKE '%أقارب%' OR v_shelter LIKE '%relative%' THEN v_urgency := v_urgency + 5;
  ELSIF v_shelter <> '' AND v_shelter NOT LIKE '%own%' AND v_shelter NOT LIKE '%منزل%' THEN v_urgency := v_urgency + 15;
  END IF;

  -- URGENCY: Medical
  IF 'medicine' = ANY(v_needs) OR 'medication' = ANY(v_needs) OR 'دواء' = ANY(v_needs) THEN v_urgency := v_urgency + 10; END IF;
  IF r.disabled THEN v_urgency := v_urgency + 20; END IF;
  IF r.chronic_illness THEN v_urgency := v_urgency + 15; END IF;
  IF r.elderly > 0 THEN v_urgency := v_urgency + 15; END IF;

  -- URGENCY: Infants & children
  IF r.infants >= 1 THEN v_urgency := v_urgency + 25; END IF;
  IF 'diapers' = ANY(v_needs) OR 'milk' = ANY(v_needs) OR 'حفاضات' = ANY(v_needs) OR 'حليب' = ANY(v_needs) THEN v_urgency := v_urgency + 8; END IF;
  IF r.children >= 3 THEN v_urgency := v_urgency + 10; END IF;

  -- URGENCY: Displacement
  IF r.displaced AND r.displacement_date IS NOT NULL AND r.displacement_date >= (CURRENT_DATE - INTERVAL '7 days') THEN v_urgency := v_urgency + 10; END IF;
  IF r.family_size >= 6 THEN v_urgency := v_urgency + 10; END IF;
  IF 'money' = ANY(v_needs) OR 'مال' = ANY(v_needs) THEN v_urgency := v_urgency + 7; END IF;
  IF r.alt_phone IS NULL OR r.alt_phone = '' THEN v_urgency := v_urgency + 5; END IF;

  v_urgency := LEAST(v_urgency, 100);

  -- TRUST positives
  IF r.phone_verified THEN v_trust := v_trust + 20; END IF;
  IF r.origin_town IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.conflict_zones z WHERE z.is_active AND r.origin_town ILIKE '%'||z.region_name||'%'
  ) THEN v_trust := v_trust + 15; END IF;
  IF r.town IS NOT NULL AND r.origin_town IS NOT NULL AND LOWER(r.town) NOT LIKE '%'||LOWER(r.origin_town)||'%' THEN v_trust := v_trust + 10; END IF;

  -- TRUST negatives
  IF r.is_duplicate THEN v_trust := v_trust - 40; END IF;

  -- Duplicate phone in other active requests
  IF EXISTS (
    SELECT 1 FROM public.aid_requests x
    WHERE x.id <> r.id AND regexp_replace(x.phone,'[^0-9]','','g') = regexp_replace(r.phone,'[^0-9]','','g')
      AND x.status NOT IN ('rejected')
  ) THEN v_trust := v_trust - 40; END IF;

  -- Device fingerprint reuse
  IF r.device_fingerprint IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.aid_requests x
    WHERE x.id <> r.id AND x.device_fingerprint = r.device_fingerprint
      AND x.status NOT IN ('rejected')
  ) THEN v_trust := v_trust - 25; END IF;

  -- Fast submission
  IF r.submission_seconds IS NOT NULL AND r.submission_seconds < 60 THEN v_trust := v_trust - 20; END IF;

  -- IP cluster (uses ip_hash)
  IF r.ip_hash IS NOT NULL AND (
    SELECT COUNT(*) FROM public.aid_requests x
    WHERE x.id <> r.id AND x.ip_hash = r.ip_hash AND x.created_at > v_now - INTERVAL '1 hour'
  ) >= 4 THEN v_trust := v_trust - 30; END IF;

  -- Same town as origin = inconsistent displacement
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
        last_scored_at = v_now
    WHERE id = _request_id;

  trust := v_trust::SMALLINT;
  urgency := v_urgency::SMALLINT;
  risk := v_risk;
  RETURN NEXT;
END $$;

-- 12. Trigger: auto-score on insert and on relevant updates
CREATE OR REPLACE FUNCTION public.trg_score_request()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.calculate_scores(NEW.id);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS aid_requests_autoscore_ins ON public.aid_requests;
CREATE TRIGGER aid_requests_autoscore_ins
  AFTER INSERT ON public.aid_requests
  FOR EACH ROW EXECUTE FUNCTION public.trg_score_request();

DROP TRIGGER IF EXISTS aid_requests_autoscore_upd ON public.aid_requests;
CREATE TRIGGER aid_requests_autoscore_upd
  AFTER UPDATE OF needs, housing_type, disabled, chronic_illness, elderly,
                  infants, children, family_size, displaced, displacement_date,
                  alt_phone, phone, town, origin_town, phone_verified,
                  is_duplicate, device_fingerprint
  ON public.aid_requests
  FOR EACH ROW EXECUTE FUNCTION public.trg_score_request();

-- Backfill scores for existing rows
DO $$ DECLARE rec RECORD; BEGIN
  FOR rec IN SELECT id FROM public.aid_requests LOOP
    PERFORM public.calculate_scores(rec.id);
  END LOOP;
END $$;
