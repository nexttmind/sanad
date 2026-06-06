-- Step 1.1 (SEC-R05): RLS and grants for donation_proof_photos gallery metadata

GRANT SELECT ON public.donation_proof_photos TO anon, authenticated;
GRANT ALL ON public.donation_proof_photos TO service_role;

ALTER TABLE public.donation_proof_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public read donation proof photos" ON public.donation_proof_photos;
CREATE POLICY "public read donation proof photos"
  ON public.donation_proof_photos
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "admins manage donation proof photos" ON public.donation_proof_photos;
CREATE POLICY "admins manage donation proof photos"
  ON public.donation_proof_photos
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

REVOKE INSERT, UPDATE, DELETE ON public.donation_proof_photos FROM anon;
