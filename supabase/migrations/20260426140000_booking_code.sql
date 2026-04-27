-- Add a short, human-readable booking code (e.g. "A3F7K2") for reservation lookup
-- without requiring email. Customers can use this code at /trova to access their booking.

ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS booking_code text;

-- Backfill: derive code from first 6 chars of manage_token (uppercase alphanumeric)
UPDATE public.reservations
SET booking_code = upper(substring(manage_token FROM 1 FOR 6))
WHERE booking_code IS NULL AND manage_token IS NOT NULL;

-- Make it unique and set a default for new rows
CREATE UNIQUE INDEX IF NOT EXISTS idx_reservations_booking_code
  ON public.reservations(booking_code);

-- Function to generate a unique 6-char code
CREATE OR REPLACE FUNCTION public.generate_booking_code()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- no O/0/I/1 to avoid confusion
  code text;
  attempts int := 0;
BEGIN
  LOOP
    code := '';
    FOR i IN 1..6 LOOP
      code := code || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    END LOOP;
    BEGIN
      -- Test uniqueness (will raise if duplicate)
      IF NOT EXISTS (SELECT 1 FROM public.reservations WHERE booking_code = code) THEN
        RETURN code;
      END IF;
    END;
    attempts := attempts + 1;
    IF attempts > 20 THEN RAISE EXCEPTION 'Could not generate unique booking code'; END IF;
  END LOOP;
END;
$$;

-- Trigger to auto-assign booking_code on INSERT
CREATE OR REPLACE FUNCTION public.set_booking_code()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.booking_code IS NULL THEN
    NEW.booking_code := public.generate_booking_code();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_booking_code ON public.reservations;
CREATE TRIGGER trg_set_booking_code
  BEFORE INSERT ON public.reservations
  FOR EACH ROW EXECUTE FUNCTION public.set_booking_code();

-- RLS: allow public lookup by booking_code (same policy as manage_token)
DO $$ BEGIN
  CREATE POLICY "Public can read reservations by booking_code"
    ON public.reservations FOR SELECT
    USING (booking_code IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
