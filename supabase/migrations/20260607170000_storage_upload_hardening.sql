-- Step 4.1 (SEC-R03): Block direct public storage INSERT to id-docs / payment-proofs.
-- Path (UUID folder), MIME allowlist, and 5MB max are enforced in edge functions:
--   upload-id-doc (aid ID docs, 5 uploads/hr/IP)
--   submit-donation (payment proofs via service_role)

DROP POLICY IF EXISTS "anyone upload id docs" ON storage.objects;
DROP POLICY IF EXISTS "anyone upload payment proofs" ON storage.objects;

CREATE POLICY "block public storage insert on sensitive buckets"
ON storage.objects
FOR INSERT
TO anon, authenticated
WITH CHECK (
  bucket_id NOT IN ('id-docs', 'payment-proofs')
);
