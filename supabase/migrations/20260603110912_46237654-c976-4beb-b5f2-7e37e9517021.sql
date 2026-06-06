DROP POLICY IF EXISTS "anyone pledge" ON public.donations;
CREATE POLICY "anyone pledge"
ON public.donations
FOR INSERT
WITH CHECK (
  status = 'pending'::donation_status
  AND amount > 0
);