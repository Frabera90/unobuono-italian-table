-- Add short booking_code to reservations
ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS booking_code text;

-- Backfill existing rows with a random 6-char uppercase code
UPDATE public.reservations
SET booking_code = upper(substr(md5(random()::text || id::text), 1, 6))
WHERE booking_code IS NULL;

-- Default for new rows
ALTER TABLE public.reservations
  ALTER COLUMN booking_code SET DEFAULT upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));

-- Unique index for lookup
CREATE UNIQUE INDEX IF NOT EXISTS reservations_booking_code_key
  ON public.reservations (booking_code);
