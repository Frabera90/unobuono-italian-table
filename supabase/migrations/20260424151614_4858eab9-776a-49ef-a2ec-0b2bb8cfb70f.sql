-- Rimuovere riferimenti hardcoded a "Carpediem" dai default e dai dati legacy
ALTER TABLE public.restaurant_settings ALTER COLUMN name SET DEFAULT NULL;
ALTER TABLE public.restaurant_settings ALTER COLUMN address SET DEFAULT NULL;
ALTER TABLE public.restaurant_settings ALTER COLUMN phone SET DEFAULT NULL;
ALTER TABLE public.restaurant_settings ALTER COLUMN bio SET DEFAULT NULL;
ALTER TABLE public.restaurant_settings ALTER COLUMN tone SET DEFAULT NULL;
ALTER TABLE public.restaurant_settings ALTER COLUMN instagram_handle SET DEFAULT NULL;
ALTER TABLE public.restaurant_settings ALTER COLUMN facebook_handle SET DEFAULT NULL;
ALTER TABLE public.restaurant_settings ALTER COLUMN opening_hours SET DEFAULT '{}'::jsonb;

-- Pulire eventuali righe esistenti con valori demo Carpediem
UPDATE public.restaurant_settings
SET 
  name = CASE WHEN name ILIKE '%carpediem%' THEN NULL ELSE name END,
  address = CASE WHEN address ILIKE '%pescara%' OR address ILIKE '%via roma 1%' THEN NULL ELSE address END,
  phone = CASE WHEN phone = '+39 085 123456' THEN NULL ELSE phone END,
  bio = CASE WHEN bio ILIKE '%pescara%' OR bio ILIKE '%pizzeria di ricerca%' THEN NULL ELSE bio END,
  instagram_handle = CASE WHEN instagram_handle ILIKE '%carpediem%' THEN NULL ELSE instagram_handle END,
  facebook_handle = CASE WHEN facebook_handle ILIKE '%carpediem%' THEN NULL ELSE facebook_handle END;