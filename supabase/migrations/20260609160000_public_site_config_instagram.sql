-- Add Instagram URL to public site contact config.

UPDATE public.public_site_config
SET
  config = jsonb_set(
    config,
    '{contact,instagram_url}',
    '"https://www.instagram.com/hsaleh94/?hl=en"'::jsonb,
    true
  ),
  updated_at = now()
WHERE is_active = TRUE;
