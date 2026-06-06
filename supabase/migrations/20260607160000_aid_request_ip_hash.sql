-- Step 3.1 (SEC-R02): aid request submit only via edge proxy (service_role sets ip_hash)

REVOKE INSERT ON TABLE public.aid_requests FROM anon, authenticated;
