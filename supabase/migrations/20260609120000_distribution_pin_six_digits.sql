-- Phase C3: 6-digit distribution PIN (was 4 digits — 10k space too small).

CREATE OR REPLACE FUNCTION public.assign_qr_pin_on_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'approved'::public.request_status
     AND (OLD.status IS DISTINCT FROM 'approved'::public.request_status)
     AND (NEW.qr_pin IS NULL OR NEW.qr_pin = '' OR length(NEW.qr_pin) < 6) THEN
    NEW.qr_pin := lpad((floor(random() * 1000000)::int)::text, 6, '0');
  END IF;
  RETURN NEW;
END;
$$;

-- Regenerate weak PINs for approved requests not yet distributed.
UPDATE public.aid_requests
SET qr_pin = lpad((floor(random() * 1000000)::int)::text, 6, '0')
WHERE status = 'approved'::public.request_status
  AND (qr_pin IS NULL OR qr_pin = '' OR length(qr_pin) < 6);
