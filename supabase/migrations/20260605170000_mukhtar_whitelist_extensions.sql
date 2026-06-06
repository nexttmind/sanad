-- Feature 5: Mukhtar whitelist admin page — extended columns + reference counter

ALTER TABLE public.mukhtar_whitelist
  ADD COLUMN IF NOT EXISTS village TEXT,
  ADD COLUMN IF NOT EXISTS reference_type TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS times_referenced INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deactivation_reason TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- Backfill reference_type from legacy title column when present
UPDATE public.mukhtar_whitelist
SET reference_type = title
WHERE reference_type IS NULL AND title IS NOT NULL;

CREATE OR REPLACE FUNCTION public.bump_mukhtar_whitelist_reference_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.whitelist_id IS NOT NULL THEN
    UPDATE public.mukhtar_whitelist
    SET times_referenced = times_referenced + 1
    WHERE id = NEW.whitelist_id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_bump_whitelist_refs ON public.submission_references;
CREATE TRIGGER trg_bump_whitelist_refs
  AFTER INSERT ON public.submission_references
  FOR EACH ROW
  EXECUTE FUNCTION public.bump_mukhtar_whitelist_reference_count();
