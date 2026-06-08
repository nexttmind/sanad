-- Phase A3: prevent concurrent first-login race on admin bootstrap.
-- Advisory lock ensures only one claim_first_admin succeeds when user_roles is empty.

CREATE OR REPLACE FUNCTION public.claim_first_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  has_any BOOLEAN;
  uid UUID;
BEGIN
  uid := auth.uid();
  IF uid IS NULL THEN
    RETURN FALSE;
  END IF;

  PERFORM pg_advisory_xact_lock(987654321);

  SELECT EXISTS(SELECT 1 FROM public.user_roles) INTO has_any;
  IF has_any THEN
    RETURN FALSE;
  END IF;

  INSERT INTO public.user_roles (user_id, role) VALUES (uid, 'admin');
  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_first_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_first_admin() TO authenticated;
