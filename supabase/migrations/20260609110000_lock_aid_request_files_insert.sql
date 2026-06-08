-- Phase B3: file metadata rows only via upload-id-doc edge function (service_role).
-- Public clients upload bytes to storage through the proxy; direct INSERT bypassed RLS timing checks.

DROP POLICY IF EXISTS "anyone insert file refs" ON public.aid_request_files;

REVOKE INSERT ON public.aid_request_files FROM anon, authenticated;
