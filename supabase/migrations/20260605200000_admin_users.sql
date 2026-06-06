-- Feature 8: Admin users — is_active + list RPC + staff checks respect active status

ALTER TABLE public.user_roles
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
      AND is_active = TRUE
  )
$$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin', 'reviewer', 'distributor', 'viewer')
      AND is_active = TRUE
  )
$$;

CREATE OR REPLACE FUNCTION public.list_staff_members()
RETURNS TABLE (
  user_id UUID,
  role public.app_role,
  email TEXT,
  display_name TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    ur.user_id,
    ur.role,
    u.email::text,
    COALESCE(
      u.raw_user_meta_data->>'full_name',
      u.raw_user_meta_data->>'name',
      split_part(u.email::text, '@', 1)
    )::text AS display_name
  FROM public.user_roles ur
  INNER JOIN auth.users u ON u.id = ur.user_id
  WHERE ur.role IN ('admin', 'reviewer', 'distributor', 'viewer')
    AND ur.is_active = TRUE
  ORDER BY ur.role, display_name;
END $$;

CREATE OR REPLACE FUNCTION public.list_admin_users()
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  display_name TEXT,
  role public.app_role,
  is_active BOOLEAN,
  created_at TIMESTAMPTZ,
  last_sign_in_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    ur.user_id,
    u.email::text,
    COALESCE(
      u.raw_user_meta_data->>'full_name',
      u.raw_user_meta_data->>'name',
      split_part(u.email::text, '@', 1)
    )::text AS display_name,
    ur.role,
    ur.is_active,
    ur.created_at,
    u.last_sign_in_at
  FROM public.user_roles ur
  INNER JOIN auth.users u ON u.id = ur.user_id
  ORDER BY ur.created_at DESC;
END $$;

REVOKE ALL ON FUNCTION public.list_admin_users() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_admin_users() TO authenticated;
