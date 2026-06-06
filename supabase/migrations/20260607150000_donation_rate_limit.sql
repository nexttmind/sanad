-- Step 2.3 (SEC-Y02): donation pledges only via rate-limited edge proxy (service_role insert)

REVOKE INSERT ON TABLE public.donations FROM anon, authenticated;
REVOKE INSERT ON TABLE public.payment_proofs FROM anon, authenticated;
