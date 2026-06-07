-- Admin-controlled public copy for /track, submit-success QR, and contact info.

CREATE TABLE IF NOT EXISTS public.public_site_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version INT NOT NULL,
  config JSONB NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

ALTER TABLE public.public_site_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS public_site_config_staff_read ON public.public_site_config;
DROP POLICY IF EXISTS public_site_config_admin_write ON public.public_site_config;

CREATE POLICY public_site_config_staff_read
  ON public.public_site_config FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE POLICY public_site_config_admin_write
  ON public.public_site_config FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

GRANT SELECT ON public.public_site_config TO authenticated;
GRANT ALL ON public.public_site_config TO service_role;

INSERT INTO public.public_site_config (version, config, is_active)
SELECT 1, jsonb_build_object(
  'track', jsonb_build_object(
    'enabled', TRUE,
    'show_queue_position', TRUE,
    'page_title', 'تتبّع طلبك',
    'page_subtitle', 'أدخل رقم هاتفك والرقم المرجعي لمعرفة آخر تحديثات حالتك.',
    'not_found_title', 'لم نعثر على طلب بهذه المعلومات',
    'not_found_bullets', jsonb_build_array(
      'تأكّد أنّ الرقم المرجعي بصيغة SND-XXXXX.',
      'تأكّد أنّ رقم الهاتف هو نفسه الذي استخدمته عند التقديم.',
      'إذا استمرّت المشكلة، تواصل مع فريقنا مباشرةً.'
    ),
    'rate_limit_message', 'عدد محاولات التتبّع كبير من هذا الاتصال. يرجى الانتظار ساعة ثم المحاولة مجدداً.',
    'reminders', jsonb_build_array(
      'احتفظ برقمك المرجعي — ستحتاج إليه في أي متابعة لاحقة.',
      'تأكّد أن هاتفك متاح — سيتواصل معك الفريق على الرقم الذي قدّمته.',
      'إذا تغيّر وضعك (موقع جديد، حالة طبية طارئة) تواصل معنا فوراً.',
      'قد نتّصل من رقم غير معروف — يرجى الرّد على جميع الاتصالات.'
    ),
    'contact_heading', 'للحالات الإنسانية العاجلة فقط',
    'contact_subheading', 'اتصال أو واتساب',
    'contact_phone', '+961 70 000 000',
    'contact_hours', 'يومياً ٨ صباحاً — ٨ مساءً',
    'status_labels', jsonb_build_object(
      'submitted', 'قيد الانتظار',
      'reviewing', 'قيد المراجعة',
      'verifying', 'التحقق من المرجع',
      'approved', 'موافق عليه',
      'distributed', 'تم التوزيع',
      'rejected', 'مرفوض',
      'on_hold', 'يحتاج مزيداً من المعلومات'
    ),
    'next_steps', jsonb_build_object(
      'submitted', 'طلبك في قائمة الانتظار. سيبدأ فريقنا بمراجعته قريباً. لا حاجة لأي إجراء من جهتك الآن.',
      'reviewing', 'فريقنا يراجع طلبك حالياً. قد نتواصل معك على رقمك إذا احتجنا إلى مزيد من المعلومات.',
      'verifying', 'نتواصل مع المرجع الذي ذكرته للتحقق من هويتك. تأكد أن المرجع يعرف بتقديمك لهذا الطلب.',
      'approved', 'تهانينا — تم الموافقة على طلبك. سيتواصل معك فريقنا على رقم هاتفك لتحديد موعد وموقع استلام المساعدات.',
      'distributed', 'تم توزيع المساعدات على عائلتك. نأمل أن تكون قد وصلت في الوقت المناسب. شكراً لثقتك بسند.',
      'rejected', 'نأسف لإبلاغك أن طلبك لم يتم قبوله في الوقت الحالي. للاستفسار عن السبب يرجى التواصل معنا مباشرة.',
      'on_hold', 'فريقنا بحاجة إلى مزيد من المعلومات. يرجى انتظار اتصالنا على رقم هاتفك أو التواصل معنا مباشرة.'
    ),
    'timeline_stages', jsonb_build_array(
      jsonb_build_object('key', 'submitted', 'title', 'تم تقديم الطلب', 'desc', 'تم استلام طلبك بنجاح.'),
      jsonb_build_object('key', 'reviewing', 'title', 'قيد المراجعة', 'desc', 'يقوم فريقنا بمراجعة المعلومات المُقدّمة.'),
      jsonb_build_object('key', 'verifying', 'title', 'التحقق من المرجع', 'desc', 'نتواصل مع المرجع الذي ذكرته للتأكد من حالتك.'),
      jsonb_build_object('key', 'approved', 'title', 'موافق عليه', 'desc', 'تمّت الموافقة وتمّت جدولة التوزيع.'),
      jsonb_build_object('key', 'distributed', 'title', 'تم التوزيع', 'desc', 'وصلت المساعدات إلى العائلة.')
    )
  ),
  'qr', jsonb_build_object(
    'show_on_submit_success', TRUE,
    'show_on_track_when_approved', TRUE,
    'submit_success_title', 'تم استلام طلبك بنجاح',
    'submit_success_subtitle', 'سيتواصل معك فريق سند على رقم هاتفك في أقرب وقت ممكن.',
    'submit_success_instructions', 'احفظ هذا الرمز. سيُطلب منك عرضه عند توزيع المساعدة لتأكيد هويتك.',
    'submit_success_steps', jsonb_build_array(
      'يُراجع طلبك من قبل فريقنا.',
      'نتواصل مع المرجع للتحقق من حالتك.',
      'نتواصل معك لتحديد موعد التوزيع.'
    ),
    'track_qr_instructions', 'اعرض هذا الرمز عند نقطة التوزيع مع رقم الهوية. سيُطلب منك أيضاً إدخال الرمز السري.'
  ),
  'contact', jsonb_build_object(
    'footer_phone', '+961 70 000 000',
    'footer_email', 'hello@sanad.lb',
    'footer_location', 'صور — الجنوب اللبناني'
  )
), TRUE
WHERE NOT EXISTS (SELECT 1 FROM public.public_site_config WHERE is_active = TRUE);

CREATE OR REPLACE FUNCTION public.get_public_site_config()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT c.config
      FROM public.public_site_config c
      WHERE c.is_active = TRUE
      ORDER BY c.version DESC
      LIMIT 1
    ),
    '{}'::jsonb
  );
$$;

REVOKE ALL ON FUNCTION public.get_public_site_config() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_site_config() TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.save_public_site_config(_config JSONB)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_version INT;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'admin only' USING ERRCODE = '42501';
  END IF;

  UPDATE public.public_site_config SET is_active = FALSE WHERE is_active = TRUE;
  SELECT COALESCE(MAX(version), 0) + 1 INTO v_version FROM public.public_site_config;
  INSERT INTO public.public_site_config (version, config, is_active, updated_by)
  VALUES (v_version, _config, TRUE, auth.uid());
  RETURN v_version;
END;
$$;

REVOKE ALL ON FUNCTION public.save_public_site_config(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_public_site_config(JSONB) TO authenticated;

-- Expose request_id on track lookup for approved/distributed QR re-display.
-- Must DROP first: PostgreSQL cannot change OUT/RETURNS TABLE shape via CREATE OR REPLACE.
DROP FUNCTION IF EXISTS public.track_request(TEXT, TEXT);

CREATE FUNCTION public.track_request(_code TEXT, _phone TEXT)
RETURNS TABLE (
  reference_code TEXT,
  full_name TEXT,
  phone_masked TEXT,
  governorate TEXT,
  district TEXT,
  town TEXT,
  family_size INT,
  status public.request_status,
  distribution_date DATE,
  distribution_location TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  request_id UUID
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    r.reference_code,
    r.full_name,
    regexp_replace(r.phone, '^(.{0,4}).+(.{3})$', '\1••• ••• \2'),
    r.governorate,
    r.district,
    r.town,
    r.family_size,
    r.status,
    CASE WHEN r.status = 'distributed' THEN r.distribution_date ELSE NULL END,
    CASE WHEN r.status = 'distributed' THEN r.distribution_location ELSE NULL END,
    r.created_at,
    r.updated_at,
    CASE WHEN r.status IN ('approved', 'distributed') THEN r.id ELSE NULL END
  FROM public.aid_requests r
  WHERE upper(r.reference_code) = upper(_code)
    AND r.phone_normalized = public.normalize_lebanese_phone(_phone)
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.track_request(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.track_request(TEXT, TEXT) TO service_role;
