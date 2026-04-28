ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS followup_sent boolean DEFAULT false;
ALTER TABLE public.restaurant_settings ADD COLUMN IF NOT EXISTS notification_email text;
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS intro_seen boolean NOT NULL DEFAULT false;