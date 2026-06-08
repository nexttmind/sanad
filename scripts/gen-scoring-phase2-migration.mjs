import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const src = fs.readFileSync(
  path.join(root, "supabase/migrations/20260609130000_scoring_v2_correctness_and_signals.sql"),
  "utf8",
);
const m = src.match(/CREATE OR REPLACE FUNCTION public\.calculate_scores[\s\S]+?\$\$;\s*/);
if (!m) throw new Error("calculate_scores not found");
let fn = m[0];

fn = fn.replace("v_raw_max INT := 105;", "v_raw_max INT := 117;");
fn = fn.replace(
  "v_max_reference INT := 5;",
  "v_max_reference INT := 15;\n  v_max_financial INT := 12;",
);
fn = fn.replace(
  "v_reference_confirmed_pts INT := 5;",
  "v_reference_confirmed_pts INT := 10;\n  v_verified_mukhtar_pts INT := 15;",
);
fn = fn.replace(
  "v_displaced_180d_pts INT := 2;",
  "v_displaced_180d_pts INT := 2;\n  v_financial_pts INT := 0;\n  v_financial_eviction_pts INT := 12;\n  v_financial_debt_pts INT := 8;\n  v_financial_reasons TEXT[] := '{}';",
);
fn = fn.replace(
  "v_reference_reasons TEXT[] := '{}';",
  "v_reference_reasons TEXT[] := '{}';\n  v_ref_whitelisted BOOLEAN := false;",
);
fn = fn.replace(
  "v_max_reference := GREATEST(COALESCE((v_cfg->'categories'->'reference'->>'max')::INT, 5), 0);",
  "v_max_reference := GREATEST(COALESCE((v_cfg->'categories'->'reference'->>'max')::INT, 15), 0);\n    v_max_financial := GREATEST(COALESCE((v_cfg->'categories'->'financial'->>'max')::INT, 12), 0);",
);
fn = fn.replace(
  "v_reference_confirmed_pts := GREATEST(COALESCE((v_cfg->'categories'->'reference'->'weights'->>'reference_confirmed')::INT, 5), 0);",
  "v_reference_confirmed_pts := GREATEST(COALESCE((v_cfg->'categories'->'reference'->'weights'->>'reference_confirmed')::INT, 10), 0);\n    v_verified_mukhtar_pts := GREATEST(COALESCE((v_cfg->'categories'->'reference'->'weights'->>'verified_mukhtar')::INT, 15), 0);",
);
fn = fn.replace(
  "v_displaced_180d_pts := GREATEST(COALESCE((v_cfg->'categories'->'displacement'->'weights'->>'displaced_180d')::INT, 2), 0);",
  "v_displaced_180d_pts := GREATEST(COALESCE((v_cfg->'categories'->'displacement'->'weights'->>'displaced_180d')::INT, 2), 0);\n    v_financial_eviction_pts := GREATEST(COALESCE((v_cfg->'categories'->'financial'->'weights'->>'eviction_risk')::INT, 12), 0);\n    v_financial_debt_pts := GREATEST(COALESCE((v_cfg->'categories'->'financial'->'weights'->>'debt_critical')::INT, 8), 0);",
);
fn = fn.replace("COALESCE((v_cfg->>'raw_max')::INT, 105)", "COALESCE((v_cfg->>'raw_max')::INT, 117)");
fn = fn.replace(
  `  IF r.disabled THEN
    v_medical_pts := v_medical_pts + v_medical_disabled_pts;
    v_medical_reasons := array_append(v_medical_reasons, 'disabled');
  END IF;
  v_medical_pts := public.least_cat(v_medical_pts, v_max_medical);`,
  `  IF r.disabled THEN
    v_medical_pts := v_medical_pts + v_medical_disabled_pts;
    v_medical_reasons := array_append(v_medical_reasons, 'disabled');
  END IF;
  IF public.scoring_detect_critical_medication(r.notes, v_needs) THEN
    v_medical_pts := v_medical_pts + v_medical_critical_pts;
    v_medical_reasons := array_append(v_medical_reasons, 'critical_medication');
  END IF;
  v_medical_pts := public.least_cat(v_medical_pts, v_max_medical);`,
);
fn = fn.replace(
  `    ELSIF r.displacement_date >= (CURRENT_DATE - INTERVAL '90 days') THEN
      v_displacement_pts := v_displaced_90d_pts;
      v_displacement_reasons := array_append(v_displacement_reasons, 'displaced_90d');
    END IF;`,
  `    ELSIF r.displacement_date >= (CURRENT_DATE - INTERVAL '90 days') THEN
      v_displacement_pts := v_displaced_90d_pts;
      v_displacement_reasons := array_append(v_displacement_reasons, 'displaced_90d');
    ELSIF r.displacement_date >= (CURRENT_DATE - INTERVAL '180 days') THEN
      v_displacement_pts := v_displaced_180d_pts;
      v_displacement_reasons := array_append(v_displacement_reasons, 'displaced_180d');
    END IF;`,
);
fn = fn.replace(
  `  SELECT sr.contact_result::TEXT INTO v_ref_result
  FROM public.submission_references sr
  WHERE sr.request_id = r.id
  LIMIT 1;

  IF v_ref_result = 'confirmed' THEN
    v_reference_pts := v_reference_confirmed_pts;
    v_reference_reasons := array_append(v_reference_reasons, 'reference_confirmed');`,
  `  SELECT sr.contact_result::TEXT, sr.is_whitelisted INTO v_ref_result, v_ref_whitelisted
  FROM public.submission_references sr
  WHERE sr.request_id = r.id
  LIMIT 1;

  IF v_ref_result = 'confirmed' THEN
    IF v_ref_whitelisted THEN
      v_reference_pts := v_verified_mukhtar_pts;
      v_reference_reasons := array_append(v_reference_reasons, 'verified_mukhtar');
    ELSE
      v_reference_pts := v_reference_confirmed_pts;
      v_reference_reasons := array_append(v_reference_reasons, 'reference_confirmed');
    END IF;`,
);
fn = fn.replace(
  `  v_reference_pts := public.least_cat(v_reference_pts, v_max_reference);

  v_raw := v_shelter_pts + v_medical_pts + v_dependents_pts + v_displacement_pts + v_household_pts + v_reference_pts;`,
  `  v_reference_pts := public.least_cat(v_reference_pts, v_max_reference);

  IF public.scoring_detect_eviction_risk(r.notes, v_needs) THEN
    v_financial_pts := GREATEST(v_financial_pts, v_financial_eviction_pts);
    v_financial_reasons := array_append(v_financial_reasons, 'eviction_risk');
  END IF;
  IF public.scoring_detect_debt_critical(r.notes, v_needs) THEN
    v_financial_pts := v_financial_pts + v_financial_debt_pts;
    v_financial_reasons := array_append(v_financial_reasons, 'debt_critical');
  END IF;
  v_financial_pts := public.least_cat(v_financial_pts, v_max_financial);

  v_raw := v_shelter_pts + v_medical_pts + v_dependents_pts + v_displacement_pts + v_household_pts + v_reference_pts + v_financial_pts;`,
);
fn = fn.replace(
  `      'reference', jsonb_build_object('points', v_reference_pts, 'max', v_max_reference, 'reasons', to_jsonb(v_reference_reasons))`,
  `      'reference', jsonb_build_object('points', v_reference_pts, 'max', v_max_reference, 'reasons', to_jsonb(v_reference_reasons)),
      'financial', jsonb_build_object('points', v_financial_pts, 'max', v_max_financial, 'reasons', to_jsonb(v_financial_reasons))`,
);

const header = `-- Scoring v2 phase 2 — reference bump, financial urgency, phase-1 signal fixes
-- After deploy: bulk recalc from /admin/scoring

CREATE OR REPLACE FUNCTION public.scoring_detect_eviction_risk(_notes TEXT, _needs TEXT[])
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT COALESCE(_notes, '') ~* '(إخلاء|طرد|expulsion|eviction|rent overdue|تأخر.*(إيجار|rent))'
    OR EXISTS (
      SELECT 1 FROM unnest(COALESCE(_needs, ARRAY[]::TEXT[])) AS n(val)
      WHERE val ~* '(إخلاء|طرد|eviction|rent|إيجار)'
    );
$$;

CREATE OR REPLACE FUNCTION public.scoring_detect_debt_critical(_notes TEXT, _needs TEXT[])
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT COALESCE(_notes, '') ~* '(ديون|فلس|bankruptcy|debt|مديون|لا.*(نقد|money))'
    OR EXISTS (
      SELECT 1 FROM unnest(COALESCE(_needs, ARRAY[]::TEXT[])) AS n(val)
      WHERE val ~* '(مساعدة مالية|financial|ديون|debt)'
        AND COALESCE(_notes, '') ~* '(عاجل|critical|فوري|إخلاء|طرد|rent|إيجار|ديون|debt)'
    );
$$;

UPDATE public.scoring_config
SET rules = jsonb_set(
  jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          jsonb_set(
            jsonb_set(
              jsonb_set(
                rules,
                '{raw_max}', '117'::jsonb, true
              ),
              '{categories,reference,max}', '15'::jsonb, true
            ),
            '{categories,reference,weights,reference_confirmed}', '10'::jsonb, true
          ),
          '{categories,reference,weights,verified_mukhtar}', '15'::jsonb, true
        ),
        '{categories,financial}', '{"max":12,"weights":{"eviction_risk":12,"debt_critical":8}}'::jsonb, true
      ),
      '{categories,medical,weights,critical_medication}', '20'::jsonb, true
    ),
    '{categories,displacement,weights,displaced_180d}', '2'::jsonb, true
  ),
  '{categories,reference,weights,reference_denied}', '-10'::jsonb, true
)
WHERE is_active = TRUE;

`;

const previewFn = `
CREATE OR REPLACE FUNCTION public.get_scoring_preview_samples(_limit INT DEFAULT 20)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit INT := LEAST(GREATEST(COALESCE(_limit, 20), 1), 20);
  v_rows JSONB;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT COALESCE(jsonb_agg(row_data ORDER BY sort_created DESC), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT
      jsonb_build_object(
        'id', r.id,
        'reference_code', r.reference_code,
        'full_name', r.full_name,
        'urgency_score', r.urgency_score,
        'effective_urgency', r.effective_urgency,
        'urgency_tier', r.urgency_tier,
        'urgency_breakdown', r.urgency_breakdown,
        'created_at', r.created_at
      ) AS row_data,
      r.created_at AS sort_created
    FROM public.aid_requests r
    ORDER BY r.created_at DESC
    LIMIT v_limit
  ) recent;

  RETURN v_rows;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_scoring_preview_samples(INT) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_scoring_tier_distribution()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  RETURN (
    SELECT jsonb_build_object(
      'critical', COUNT(*) FILTER (WHERE urgency_tier = 'critical'),
      'high', COUNT(*) FILTER (WHERE urgency_tier = 'high'),
      'medium', COUNT(*) FILTER (WHERE urgency_tier = 'medium'),
      'low', COUNT(*) FILTER (WHERE urgency_tier = 'low'),
      'total', COUNT(*)
    )
    FROM public.aid_requests
    WHERE status NOT IN ('rejected')
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_scoring_tier_distribution() TO authenticated;
`;

const out = path.join(root, "supabase/migrations/20260609140000_scoring_v2_phase2_reference_financial.sql");
fs.writeFileSync(out, header + fn + "\n" + previewFn);
console.log("Wrote", out, "calculate_scores length:", fn.length);
