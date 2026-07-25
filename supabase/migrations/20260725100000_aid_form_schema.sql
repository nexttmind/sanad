-- Admin-editable aid request form schema + custom response storage.

ALTER TABLE public.aid_requests
  ADD COLUMN IF NOT EXISTS form_responses JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS public.aid_form_schema (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version INT NOT NULL,
  schema JSONB NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

ALTER TABLE public.aid_form_schema ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS aid_form_schema_staff_read ON public.aid_form_schema;
DROP POLICY IF EXISTS aid_form_schema_staff_write ON public.aid_form_schema;

CREATE POLICY aid_form_schema_staff_read
  ON public.aid_form_schema FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE POLICY aid_form_schema_staff_write
  ON public.aid_form_schema FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

GRANT SELECT ON public.aid_form_schema TO authenticated;
GRANT ALL ON public.aid_form_schema TO service_role;

CREATE OR REPLACE FUNCTION public.get_aid_form_schema()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT s.schema
      FROM public.aid_form_schema s
      WHERE s.is_active = TRUE
      ORDER BY s.version DESC
      LIMIT 1
    ),
    '{}'::jsonb
  );
$$;

REVOKE ALL ON FUNCTION public.get_aid_form_schema() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_aid_form_schema() TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.save_aid_form_schema(_schema JSONB)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_version INT;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'staff only' USING ERRCODE = '42501';
  END IF;

  UPDATE public.aid_form_schema SET is_active = FALSE WHERE is_active = TRUE;
  SELECT COALESCE(MAX(version), 0) + 1 INTO v_version FROM public.aid_form_schema;
  INSERT INTO public.aid_form_schema (version, schema, is_active, updated_by)
  VALUES (v_version, _schema, TRUE, auth.uid());
  RETURN v_version;
END;
$$;

REVOKE ALL ON FUNCTION public.save_aid_form_schema(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_aid_form_schema(JSONB) TO authenticated;
