-- Create a small seed table for donation proof gallery metadata.
CREATE TABLE IF NOT EXISTS public.donation_proof_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_key text NOT NULL UNIQUE,
  label text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.donation_proof_photos (asset_key, label, sort_order)
VALUES
  ('donation_received', 'استلام التبرع', 10),
  ('basket_prep', 'تحضير السلة', 20),
  ('purchase_supplies', 'شراء المواد', 30),
  ('package_ready', 'تجهيز الطرود', 40),
  ('shipment_in_transit', 'شحن المساعدات', 50),
  ('field_team_arrival', 'وصول الفريق الميداني', 60),
  ('distribution', 'توزيع المواد', 70),
  ('family_signature', 'توقيع العائلة', 80),
  ('delivery_docs', 'وثائق التسليم', 90)
ON CONFLICT (asset_key) DO NOTHING;
