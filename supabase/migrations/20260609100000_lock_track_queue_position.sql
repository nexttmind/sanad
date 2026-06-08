-- Phase A1: track_queue_position must only run via track-request-proxy (service_role).
-- Direct anon/authenticated calls bypass proxy rate limits.

REVOKE ALL ON FUNCTION public.track_queue_position(TEXT, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.track_queue_position(TEXT, TEXT) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.track_queue_position(TEXT, TEXT) TO service_role;
