-- Step 2.2 (SEC-Y01): track lookups only via rate-limited edge proxy (service_role RPC)

REVOKE EXECUTE ON FUNCTION public.track_request(TEXT, TEXT) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.track_request_history(TEXT, TEXT) FROM anon, authenticated;

GRANT EXECUTE ON FUNCTION public.track_request(TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.track_request_history(TEXT, TEXT) TO service_role;
