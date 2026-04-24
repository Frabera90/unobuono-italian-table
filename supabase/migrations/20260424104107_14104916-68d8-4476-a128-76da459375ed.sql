ALTER TABLE public.restaurant_settings
  ADD COLUMN IF NOT EXISTS pets_allowed boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS wheelchair_accessible boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS parking_available boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS kid_friendly boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS min_age integer,
  ADD COLUMN IF NOT EXISTS good_to_know text,
  ADD COLUMN IF NOT EXISTS google_maps_url text;

ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS featured boolean DEFAULT false;

ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS occasion_type text,
  ADD COLUMN IF NOT EXISTS preferences text[];