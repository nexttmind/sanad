
-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('admin', 'reviewer', 'distributor', 'viewer');
CREATE TYPE public.request_status AS ENUM ('submitted','reviewing','verifying','approved','distributed','rejected','on_hold');
CREATE TYPE public.donation_status AS ENUM ('pending','verified','rejected','refunded');
CREATE TYPE public.donation_method AS ENUM ('whish','omt','moneygram','western_union','paypal','taptap','bank_transfer','other');

-- ============ HELPER ============
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE OR REPLACE FUNCTION public.gen_request_code()
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE n INT; BEGIN
  n := floor(random()*90000+10000)::int;
  RETURN 'SND-' || n::text;
END $$;

CREATE OR REPLACE FUNCTION public.gen_donation_code()
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE n INT; BEGIN
  n := floor(random()*900000+100000)::int;
  RETURN 'DON-' || n::text;
END $$;

-- ============ USER ROLES ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role=_role)
$$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles
    WHERE user_id=_user_id AND role IN ('admin','reviewer','distributor','viewer'))
$$;

CREATE POLICY "users read own roles" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "admins manage roles" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- bootstrap: first authenticated user with no roles becomes admin (via RPC below)
CREATE OR REPLACE FUNCTION public.claim_first_admin()
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE has_any BOOLEAN;
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.user_roles) INTO has_any;
  IF has_any THEN RETURN FALSE; END IF;
  INSERT INTO public.user_roles(user_id, role) VALUES (auth.uid(),'admin');
  RETURN TRUE;
END $$;
GRANT EXECUTE ON FUNCTION public.claim_first_admin() TO authenticated;

-- ============ AID REQUESTS ============
CREATE TABLE public.aid_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_code TEXT NOT NULL UNIQUE DEFAULT public.gen_request_code(),
  -- applicant
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  alt_phone TEXT,
  national_id TEXT,
  -- location
  governorate TEXT,
  district TEXT,
  town TEXT,
  current_address TEXT,
  housing_type TEXT, -- hosted/rented/shelter/own/destroyed
  -- family
  family_size INT NOT NULL DEFAULT 1,
  infants INT NOT NULL DEFAULT 0,
  children INT NOT NULL DEFAULT 0,
  elderly INT NOT NULL DEFAULT 0,
  disabled BOOLEAN NOT NULL DEFAULT FALSE,
  chronic_illness BOOLEAN NOT NULL DEFAULT FALSE,
  pregnant_or_nursing BOOLEAN NOT NULL DEFAULT FALSE,
  -- displacement
  displaced BOOLEAN NOT NULL DEFAULT FALSE,
  displacement_date DATE,
  origin_town TEXT,
  -- needs
  needs TEXT[] NOT NULL DEFAULT '{}',
  needs_other TEXT,
  notes TEXT, -- applicant note
  -- internal
  status public.request_status NOT NULL DEFAULT 'submitted',
  trust_score INT NOT NULL DEFAULT 50,
  urgency_score INT NOT NULL DEFAULT 50,
  flags TEXT[] NOT NULL DEFAULT '{}',
  rejection_reason TEXT, -- internal only
  distribution_date DATE,
  distribution_location TEXT,
  submission_seconds INT, -- time spent filling
  ip_hash TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.aid_requests(status);
CREATE INDEX ON public.aid_requests(phone);
CREATE INDEX ON public.aid_requests(created_at DESC);
CREATE TRIGGER trg_aid_requests_updated BEFORE UPDATE ON public.aid_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT INSERT ON public.aid_requests TO anon, authenticated;
GRANT SELECT, UPDATE ON public.aid_requests TO authenticated;
GRANT ALL ON public.aid_requests TO service_role;
ALTER TABLE public.aid_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone can submit" ON public.aid_requests FOR INSERT TO anon, authenticated
  WITH CHECK (true);
CREATE POLICY "staff read all" ON public.aid_requests FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
CREATE POLICY "staff update" ON public.aid_requests FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- ============ AID REQUEST FILES ============
CREATE TABLE public.aid_request_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.aid_requests(id) ON DELETE CASCADE,
  bucket TEXT NOT NULL, -- 'id-docs' | 'damage-photos'
  storage_path TEXT NOT NULL,
  kind TEXT NOT NULL, -- 'id_front'|'id_back'|'damage'|'other'
  size_bytes INT,
  mime TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.aid_request_files(request_id);

GRANT INSERT ON public.aid_request_files TO anon, authenticated;
GRANT SELECT, DELETE ON public.aid_request_files TO authenticated;
GRANT ALL ON public.aid_request_files TO service_role;
ALTER TABLE public.aid_request_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone insert file refs" ON public.aid_request_files FOR INSERT TO anon, authenticated
  WITH CHECK (true);
CREATE POLICY "staff read files" ON public.aid_request_files FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
CREATE POLICY "staff delete files" ON public.aid_request_files FOR DELETE TO authenticated
  USING (public.is_staff(auth.uid()));

-- ============ INTERNAL NOTES ============
CREATE TABLE public.aid_request_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.aid_requests(id) ON DELETE CASCADE,
  author_id UUID REFERENCES auth.users(id),
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.aid_request_notes(request_id);

GRANT SELECT, INSERT, DELETE ON public.aid_request_notes TO authenticated;
GRANT ALL ON public.aid_request_notes TO service_role;
ALTER TABLE public.aid_request_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff read notes" ON public.aid_request_notes FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
CREATE POLICY "staff write notes" ON public.aid_request_notes FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()) AND author_id = auth.uid());
CREATE POLICY "author or admin delete notes" ON public.aid_request_notes FOR DELETE TO authenticated
  USING (author_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- ============ STATUS HISTORY ============
CREATE TABLE public.aid_request_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.aid_requests(id) ON DELETE CASCADE,
  from_status public.request_status,
  to_status public.request_status NOT NULL,
  changed_by UUID REFERENCES auth.users(id),
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.aid_request_history(request_id);

GRANT SELECT, INSERT ON public.aid_request_history TO authenticated;
GRANT ALL ON public.aid_request_history TO service_role;
ALTER TABLE public.aid_request_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff read history" ON public.aid_request_history FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
CREATE POLICY "staff write history" ON public.aid_request_history FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));

-- automatic history trigger
CREATE OR REPLACE FUNCTION public.log_request_status_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.aid_request_history(request_id, from_status, to_status, changed_by)
      VALUES (NEW.id, NULL, NEW.status, NULL);
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.aid_request_history(request_id, from_status, to_status, changed_by, reason)
      VALUES (NEW.id, OLD.status, NEW.status, auth.uid(), NEW.rejection_reason);
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_aid_request_status AFTER INSERT OR UPDATE OF status ON public.aid_requests
  FOR EACH ROW EXECUTE FUNCTION public.log_request_status_change();

-- ============ PUBLIC TRACK RPC (privacy-respecting) ============
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
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    r.reference_code,
    r.full_name,
    regexp_replace(r.phone, '^(.{0,4}).+(.{3})$', '\1••• ••• \2'),
    r.governorate, r.district, r.town,
    r.family_size,
    r.status,
    CASE WHEN r.status='distributed' THEN r.distribution_date ELSE NULL END,
    CASE WHEN r.status='distributed' THEN r.distribution_location ELSE NULL END,
    r.created_at, r.updated_at
  FROM public.aid_requests r
  WHERE upper(r.reference_code) = upper(_code)
    AND regexp_replace(r.phone,'[^0-9]','','g') = regexp_replace(_phone,'[^0-9]','','g')
  LIMIT 1
$$;
GRANT EXECUTE ON FUNCTION public.track_request(TEXT, TEXT) TO anon, authenticated;

-- ============ DONATIONS ============
CREATE TABLE public.donations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_code TEXT NOT NULL UNIQUE DEFAULT public.gen_donation_code(),
  donor_name TEXT,
  donor_email TEXT,
  donor_phone TEXT,
  is_anonymous BOOLEAN NOT NULL DEFAULT FALSE,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  method public.donation_method NOT NULL,
  pledged_for_request UUID REFERENCES public.aid_requests(id), -- adopt-a-family
  message TEXT,
  status public.donation_status NOT NULL DEFAULT 'pending',
  internal_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.donations(status, created_at DESC);
CREATE TRIGGER trg_donations_updated BEFORE UPDATE ON public.donations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT INSERT ON public.donations TO anon, authenticated;
GRANT SELECT, UPDATE ON public.donations TO authenticated;
GRANT ALL ON public.donations TO service_role;
ALTER TABLE public.donations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone pledge" ON public.donations FOR INSERT TO anon, authenticated
  WITH CHECK (true);
CREATE POLICY "staff read donations" ON public.donations FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
CREATE POLICY "staff update donations" ON public.donations FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- Public ledger RPC: only verified donations, donor masked
CREATE OR REPLACE FUNCTION public.public_ledger(_limit INT DEFAULT 10)
RETURNS TABLE (
  reference_code TEXT,
  donor_display TEXT,
  amount NUMERIC,
  currency TEXT,
  method public.donation_method,
  message TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    d.reference_code,
    CASE WHEN d.is_anonymous OR d.donor_name IS NULL THEN 'متبرّع' ELSE d.donor_name END,
    d.amount, d.currency, d.method, d.message, d.created_at
  FROM public.donations d
  WHERE d.status = 'verified'
  ORDER BY d.created_at DESC
  LIMIT GREATEST(1, LEAST(_limit, 50))
$$;
GRANT EXECUTE ON FUNCTION public.public_ledger(INT) TO anon, authenticated;

-- ============ PAYMENT PROOFS ============
CREATE TABLE public.payment_proofs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  donation_id UUID NOT NULL REFERENCES public.donations(id) ON DELETE CASCADE,
  bucket TEXT NOT NULL DEFAULT 'payment-proofs',
  storage_path TEXT NOT NULL,
  claimed_amount NUMERIC(12,2),
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT INSERT ON public.payment_proofs TO anon, authenticated;
GRANT SELECT, UPDATE ON public.payment_proofs TO authenticated;
GRANT ALL ON public.payment_proofs TO service_role;
ALTER TABLE public.payment_proofs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone upload proof" ON public.payment_proofs FOR INSERT TO anon, authenticated
  WITH CHECK (true);
CREATE POLICY "staff read proofs" ON public.payment_proofs FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
CREATE POLICY "staff verify proofs" ON public.payment_proofs FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- ============ AUDIT LOG ============
CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id UUID,
  diff JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.audit_log(created_at DESC);
GRANT SELECT, INSERT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read audit" ON public.audit_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "staff write audit" ON public.audit_log FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()) AND actor_id = auth.uid());
