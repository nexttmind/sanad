import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const src = fs.readFileSync(
  path.join(root, "supabase/migrations/20260606070000_list_submissions_ops_filters.sql"),
  "utf8",
);
const fnMatch = src.match(/CREATE OR REPLACE FUNCTION public\.list_submissions[\s\S]+?\$\$;\s*/);
if (!fnMatch) throw new Error("list_submissions not found");
let fn = fnMatch[0];

fn = fn.replace(
  "  v_created_from TIMESTAMPTZ := NULL;\n  v_created_to TIMESTAMPTZ := NULL;",
  "  v_created_from TIMESTAMPTZ := NULL;\n  v_created_to TIMESTAMPTZ := NULL;\n  v_beirut_date DATE := NULL;\n  v_beirut_day_start TIMESTAMPTZ := NULL;\n  v_beirut_day_end TIMESTAMPTZ := NULL;",
);

fn = fn.replace(
  `  IF NULLIF(trim(_filters->>'created_to'), '') IS NOT NULL THEN
    v_created_to := ((_filters->>'created_to')::date + INTERVAL '1 day');
  END IF;`,
  `  IF NULLIF(trim(_filters->>'created_to'), '') IS NOT NULL THEN
    v_created_to := ((_filters->>'created_to')::date + INTERVAL '1 day');
  END IF;

  IF NULLIF(trim(_filters->>'beirut_date'), '') IS NOT NULL THEN
    v_beirut_date := (_filters->>'beirut_date')::date;
    v_beirut_day_start := date_trunc('day', v_beirut_date::timestamp AT TIME ZONE 'Asia/Beirut') AT TIME ZONE 'Asia/Beirut';
    v_beirut_day_end := v_beirut_day_start + INTERVAL '1 day';
    v_created_from := NULL;
    v_created_to := NULL;
  END IF;`,
);

const dateFilter = `    AND (
      CASE
        WHEN v_beirut_day_start IS NOT NULL THEN
          r.created_at >= v_beirut_day_start AND r.created_at < v_beirut_day_end
        ELSE
          (v_created_from IS NULL OR r.created_at >= v_created_from)
          AND (v_created_to IS NULL OR r.created_at < v_created_to)
      END
    )`;

fn = fn.replace(
  /    AND \(v_created_from IS NULL OR r\.created_at >= v_created_from\)\n    AND \(v_created_to IS NULL OR r\.created_at < v_created_to\)/g,
  dateFilter,
);

const header = `-- Daily cap is admin batching only (50 FIFO per Beirut day) — public submissions stay open.
-- Admin: filter by beirut_date + queue_number asc + offset batches of 50.

DROP TRIGGER IF EXISTS trg_enforce_daily_cap ON public.aid_requests;
DROP FUNCTION IF EXISTS public.enforce_daily_submission_cap();

CREATE OR REPLACE FUNCTION public.get_submission_status()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit INT := 50;
  v_count INT;
BEGIN
  v_count := public.submissions_today_count();

  RETURN jsonb_build_object(
    'accepting', TRUE,
    'daily_count', v_count,
    'daily_limit', v_limit,
    'message_ar', NULL
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.check_submission_eligibility(_phone TEXT, _national_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phone_norm TEXT;
  v_id_norm TEXT;
  v_existing RECORD;
  v_phone_message TEXT := 'سبق أن قدّمت طلباً من هذا الرقم. يُسمح بطلب واحد فقط لكل رقم هاتف.';
  v_id_message TEXT := 'سبق أن قُدّم طلب بهذه الوثيقة. يُسمح بطلب واحد فقط لكل رقم وثيقة.';
BEGIN
  v_phone_norm := public.normalize_lebanese_phone(_phone);
  IF v_phone_norm IS NULL THEN
    RETURN jsonb_build_object(
      'allowed', FALSE,
      'reason', 'invalid_phone',
      'message_ar', 'يرجى التحقق من رقم الهاتف.',
      'existing_reference_code', NULL
    );
  END IF;

  IF _national_id IS NULL OR trim(_national_id) = '' THEN
    RETURN jsonb_build_object(
      'allowed', FALSE,
      'reason', 'invalid_national_id',
      'message_ar', 'يرجى إدخال رقم الوثيقة.',
      'existing_reference_code', NULL
    );
  END IF;

  v_id_norm := public.normalize_national_id(_national_id);
  IF v_id_norm IS NULL OR trim(v_id_norm) = '' THEN
    RETURN jsonb_build_object(
      'allowed', FALSE,
      'reason', 'invalid_national_id',
      'message_ar', 'يرجى إدخال رقم الوثيقة.',
      'existing_reference_code', NULL
    );
  END IF;

  SELECT r.reference_code INTO v_existing
  FROM public.aid_requests r
  WHERE r.phone_normalized = v_phone_norm
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'allowed', FALSE,
      'reason', 'phone_already_submitted',
      'message_ar', v_phone_message,
      'existing_reference_code', public.mask_reference_code(v_existing.reference_code)
    );
  END IF;

  SELECT r.reference_code INTO v_existing
  FROM public.aid_requests r
  WHERE r.national_id_normalized = v_id_norm
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'allowed', FALSE,
      'reason', 'id_already_submitted',
      'message_ar', v_id_message,
      'existing_reference_code', public.mask_reference_code(v_existing.reference_code)
    );
  END IF;

  RETURN jsonb_build_object(
    'allowed', TRUE,
    'reason', NULL,
    'message_ar', NULL,
    'existing_reference_code', NULL
  );
END;
$$;

`;

const out = path.join(root, "supabase/migrations/20260609150000_daily_cap_admin_batches_only.sql");
fs.writeFileSync(out, header + fn + "\n");
console.log("Wrote", out);
