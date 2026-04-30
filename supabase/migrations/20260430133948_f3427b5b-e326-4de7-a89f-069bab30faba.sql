ALTER TABLE public.restaurant_settings
  ADD COLUMN IF NOT EXISTS delivery_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS delivery_just_eat_url text,
  ADD COLUMN IF NOT EXISTS delivery_deliveroo_url text,
  ADD COLUMN IF NOT EXISTS delivery_glovo_url text,
  ADD COLUMN IF NOT EXISTS delivery_other_url text,
  ADD COLUMN IF NOT EXISTS delivery_other_label text;