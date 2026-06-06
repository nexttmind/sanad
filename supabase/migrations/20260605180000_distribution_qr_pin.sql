-- Feature 6: Distribution QR — PIN on approval + one completion per request

ALTER TABLE public.aid_requests
  ADD COLUMN IF NOT EXISTS qr_pin TEXT;

CREATE OR REPLACE FUNCTION public.assign_qr_pin_on_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'approved'::public.request_status
     AND (OLD.status IS DISTINCT FROM 'approved'::public.request_status)
     AND (NEW.qr_pin IS NULL OR NEW.qr_pin = '') THEN
    NEW.qr_pin := lpad((floor(random() * 10000)::int)::text, 4, '0');
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_assign_qr_pin ON public.aid_requests;
CREATE TRIGGER trg_assign_qr_pin
  BEFORE UPDATE ON public.aid_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_qr_pin_on_approval();

CREATE UNIQUE INDEX IF NOT EXISTS idx_qr_completions_request_unique
  ON public.qr_completions(request_id);

-- PIN for requests already approved before this migration
UPDATE public.aid_requests
SET qr_pin = lpad((floor(random() * 10000)::int)::text, 4, '0')
WHERE status = 'approved'::public.request_status
  AND (qr_pin IS NULL OR qr_pin = '');

-- Staff can read all distribution events (including completed)
DROP POLICY IF EXISTS "staff read all distributions" ON public.distribution_events;
CREATE POLICY "staff read all distributions"
ON public.distribution_events
FOR SELECT
TO authenticated
USING (public.is_staff(auth.uid()));
