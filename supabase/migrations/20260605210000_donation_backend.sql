-- Feature 9: Donation backend — public RPCs for stats, families, ledger

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
        ELSE GREATEST(
          0,
          FLOOR(EXTRACT(EPOCH FROM (now() - MAX(d.created_at))) / 60)
        )::int
      END
      FROM public.donations d
    )
  );
$$;

GRANT EXECUTE ON FUNCTION public.donation_impact_stats() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.adoptable_families(_limit INT DEFAULT 10)
RETURNS TABLE (
  request_id UUID,
  reference_code TEXT,
  region TEXT,
  family_size INT,
  infants INT,
  needs_summary TEXT,
  tag TEXT,
  raised NUMERIC,
  goal NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    r.id,
    r.reference_code,
    COALESCE(NULLIF(trim(r.governorate), ''), NULLIF(trim(r.town), ''), '—') AS region,
    r.family_size,
    r.infants,
    NULLIF(array_to_string(r.needs, '، '), '') AS needs_summary,
    CASE
      WHEN r.urgency_score >= 80 THEN 'أولوية قصوى'
      WHEN r.displaced THEN 'نزوح حديث'
      WHEN r.chronic_illness THEN 'مرض مزمن'
      ELSE 'معتمدة'
    END AS tag,
    COALESCE((
      SELECT SUM(d.amount)::numeric
      FROM public.donations d
      WHERE d.pledged_for_request = r.id
        AND d.status IN ('verified'::public.donation_status, 'pending'::public.donation_status)
    ), 0) AS raised,
    GREATEST(200, (r.family_size * 40 + r.infants * 25))::numeric AS goal
  FROM public.aid_requests r
  WHERE r.status = 'approved'::public.request_status
  ORDER BY r.urgency_score DESC, r.created_at ASC
  LIMIT LEAST(GREATEST(_limit, 1), 20);
$$;

GRANT EXECUTE ON FUNCTION public.adoptable_families(INT) TO anon, authenticated;

-- Return type changed (added beneficiary_code) — must drop before recreate
DROP FUNCTION IF EXISTS public.public_ledger(INT);

CREATE OR REPLACE FUNCTION public.public_ledger(_limit INT DEFAULT 10)
RETURNS TABLE (
  reference_code TEXT,
  donor_display TEXT,
  amount NUMERIC,
  currency TEXT,
  method public.donation_method,
  message TEXT,
  beneficiary_code TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    d.reference_code,
    CASE
      WHEN d.is_anonymous OR d.donor_name IS NULL THEN 'متبرّع'
      ELSE d.donor_name
    END,
    d.amount,
    d.currency,
    d.method,
    d.message,
    r.reference_code,
    d.created_at
  FROM public.donations d
  LEFT JOIN public.aid_requests r ON r.id = d.pledged_for_request
  WHERE d.status = 'verified'::public.donation_status
  ORDER BY d.created_at DESC
  LIMIT GREATEST(1, LEAST(_limit, 50));
$$;

GRANT EXECUTE ON FUNCTION public.public_ledger(INT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.recent_donation_messages(_limit INT DEFAULT 6)
RETURNS TABLE (
  donor_display TEXT,
  message TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    CASE
      WHEN d.is_anonymous OR d.donor_name IS NULL THEN 'مجهول'
      ELSE d.donor_name
    END,
    d.message
  FROM public.donations d
  WHERE d.message IS NOT NULL
    AND length(trim(d.message)) > 0
    AND d.status IN ('verified'::public.donation_status, 'pending'::public.donation_status)
  ORDER BY d.created_at DESC
  LIMIT GREATEST(1, LEAST(_limit, 20));
$$;

GRANT EXECUTE ON FUNCTION public.recent_donation_messages(INT) TO anon, authenticated;
