-- PRD v2 Feature B1: immutable FIFO queue number at insert

CREATE SEQUENCE IF NOT EXISTS public.aid_requests_queue_number_seq START WITH 1;

ALTER TABLE public.aid_requests
  ADD COLUMN IF NOT EXISTS queue_number BIGINT,
  ADD COLUMN IF NOT EXISTS queued_at TIMESTAMPTZ;

-- Backfill existing rows in arrival order (global sequence since launch)
WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC, id ASC) AS n
  FROM public.aid_requests
  WHERE queue_number IS NULL
)
UPDATE public.aid_requests r
SET
  queue_number = o.n,
  queued_at = r.created_at
FROM ordered o
WHERE r.id = o.id;

SELECT setval(
  'public.aid_requests_queue_number_seq',
  GREATEST(COALESCE((SELECT MAX(queue_number) FROM public.aid_requests), 0), 1)
);

ALTER TABLE public.aid_requests
  ALTER COLUMN queue_number SET NOT NULL,
  ALTER COLUMN queued_at SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_aid_requests_queue_number
  ON public.aid_requests (queue_number);

CREATE OR REPLACE FUNCTION public.assign_queue_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.queue_number IS NULL THEN
    NEW.queue_number := nextval('public.aid_requests_queue_number_seq');
  END IF;
  IF NEW.queued_at IS NULL THEN
    NEW.queued_at := COALESCE(NEW.created_at, now());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_queue_number ON public.aid_requests;
CREATE TRIGGER trg_assign_queue_number
  BEFORE INSERT ON public.aid_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_queue_number();
