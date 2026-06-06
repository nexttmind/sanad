-- Structured reference person per aid request (Feature 12)

CREATE TABLE IF NOT EXISTS public.submission_references (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL UNIQUE REFERENCES public.aid_requests(id) ON DELETE CASCADE,
  reference_type TEXT NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  region TEXT,
  village TEXT,
  known_duration TEXT,
  notes TEXT,
  is_whitelisted BOOLEAN NOT NULL DEFAULT FALSE,
  whitelist_id UUID REFERENCES public.mukhtar_whitelist(id) ON DELETE SET NULL,
  contact_result public.reference_contact_result NOT NULL DEFAULT 'pending',
  contacted_at TIMESTAMPTZ,
  contact_notes TEXT,
  contacted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_submission_references_request ON public.submission_references(request_id);
CREATE INDEX IF NOT EXISTS idx_submission_references_phone ON public.submission_references(phone);

GRANT INSERT ON public.submission_references TO anon, authenticated;
GRANT SELECT, UPDATE ON public.submission_references TO authenticated;
GRANT ALL ON public.submission_references TO service_role;

ALTER TABLE public.submission_references ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anyone insert reference" ON public.submission_references;
CREATE POLICY "anyone insert reference"
ON public.submission_references
FOR INSERT
TO anon, authenticated
WITH CHECK (
  contact_result = 'pending'::reference_contact_result
  AND contacted_at IS NULL
  AND contact_notes IS NULL
  AND contacted_by IS NULL
  AND EXISTS (
    SELECT 1 FROM public.aid_requests r
    WHERE r.id = request_id
      AND r.created_at > now() - interval '1 hour'
      AND r.status = 'submitted'::request_status
  )
);

DROP POLICY IF EXISTS "staff read references" ON public.submission_references;
CREATE POLICY "staff read references"
ON public.submission_references
FOR SELECT
TO authenticated
USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "staff update references" ON public.submission_references;
CREATE POLICY "staff update references"
ON public.submission_references
FOR UPDATE
TO authenticated
USING (public.is_staff(auth.uid()))
WITH CHECK (public.is_staff(auth.uid()));

-- Match reference phone against mukhtar whitelist (server-side, SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.resolve_submission_reference_whitelist()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  wid UUID;
BEGIN
  SELECT w.id INTO wid
  FROM public.mukhtar_whitelist w
  WHERE regexp_replace(w.phone, '[^0-9]', '', 'g')
      = regexp_replace(NEW.phone, '[^0-9]', '', 'g')
  LIMIT 1;

  IF wid IS NOT NULL THEN
    NEW.whitelist_id := wid;
    NEW.is_whitelisted := true;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_submission_reference_whitelist ON public.submission_references;
CREATE TRIGGER trg_submission_reference_whitelist
  BEFORE INSERT ON public.submission_references
  FOR EACH ROW
  EXECUTE FUNCTION public.resolve_submission_reference_whitelist();
