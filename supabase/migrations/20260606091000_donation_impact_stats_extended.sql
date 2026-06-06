-- Extend public donation stats for the public homepage hero counters.
CREATE OR REPLACE FUNCTION public.donation_impact_stats()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'week_total_usd', COALESCE((
      SELECT SUM(d.amount)::numeric
      FROM public.donations d
      WHERE d.status = 'verified'::public.donation_status
        AND d.created_at > now() - interval '7 days'
    ), 0),
    'families_helped', (
      SELECT COUNT(*)::int
      FROM public.aid_requests r
      WHERE r.status = 'distributed'::public.request_status
    ),
    'last_donation_minutes', (
      SELECT CASE
        WHEN MAX(d.created_at) IS NULL THEN NULL
        ELSE GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (now() - MAX(d.created_at))) / 60))::int
      END
      FROM public.donations d
    ),
    'requests_received', (
      SELECT COUNT(*)::int
      FROM public.aid_requests
    ),
    'verify_rate', (
      SELECT CASE
        WHEN COUNT(*) = 0 THEN 0
        ELSE ROUND(100.0 * SUM((d.status = 'verified'::public.donation_status)::int) / COUNT(*))::int
      END
      FROM public.donations d
      WHERE d.status IN (
        'pending'::public.donation_status,
        'verified'::public.donation_status,
        'rejected'::public.donation_status
      )
    ),
    'avg_response_minutes', (
      SELECT CASE
        WHEN COUNT(*) = 0 THEN NULL
        ELSE FLOOR(AVG(EXTRACT(EPOCH FROM (r.distribution_date::timestamptz - r.created_at)) / 60))::int
      END
      FROM public.aid_requests r
      WHERE r.status = 'distributed'::public.request_status
        AND r.distribution_date IS NOT NULL
    )
  );
$$;

GRANT EXECUTE ON FUNCTION public.donation_impact_stats() TO anon, authenticated;
