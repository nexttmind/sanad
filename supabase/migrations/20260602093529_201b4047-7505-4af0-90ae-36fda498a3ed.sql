
-- id-docs bucket
CREATE POLICY "anyone upload id docs"
ON storage.objects FOR INSERT
TO anon, authenticated
WITH CHECK (bucket_id = 'id-docs');

CREATE POLICY "staff read id docs"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'id-docs' AND public.is_staff(auth.uid()));

CREATE POLICY "staff delete id docs"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'id-docs' AND public.is_staff(auth.uid()));

-- payment-proofs bucket
CREATE POLICY "anyone upload payment proofs"
ON storage.objects FOR INSERT
TO anon, authenticated
WITH CHECK (bucket_id = 'payment-proofs');

CREATE POLICY "staff read payment proofs"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'payment-proofs' AND public.is_staff(auth.uid()));

CREATE POLICY "staff delete payment proofs"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'payment-proofs' AND public.is_staff(auth.uid()));
