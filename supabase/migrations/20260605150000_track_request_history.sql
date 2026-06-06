-- Public-safe timeline for /track — returns status transitions only (no internal notes).

CREATE OR REPLACE FUNCTION public.track_request_history(_code TEXT, _phone TEXT)
RETURNS TABLE (
  to_status public.request_status,
  changed_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT h.to_status, h.created_at AS changed_at
  FROM public.aid_request_history h
  INNER JOIN public.aid_requests r ON r.id = h.request_id
  WHERE upper(r.reference_code) = upper(_code)
    AND regexp_replace(r.phone, '[^0-9]', '', 'g') = regexp_replace(_phone, '[^0-9]', '', 'g')
  ORDER BY h.created_at ASC;
$$;

REVOKE ALL ON FUNCTION public.track_request_history(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.track_request_history(TEXT, TEXT) TO anon, authenticated;
