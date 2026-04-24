-- 1. Nuovi campi su reservations
ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS manage_token text UNIQUE,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS confirmation_sent boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS reminder_email_sent boolean DEFAULT false;

-- 2. Backfill manage_token per le prenotazioni esistenti
UPDATE public.reservations
SET manage_token = encode(gen_random_bytes(16), 'hex')
WHERE manage_token IS NULL;

-- 3. Default automatico per le nuove prenotazioni
ALTER TABLE public.reservations
  ALTER COLUMN manage_token SET DEFAULT encode(gen_random_bytes(16), 'hex');

-- 4. Indici performance
CREATE INDEX IF NOT EXISTS idx_reservations_rest_date_status
  ON public.reservations (restaurant_id, date, status);
CREATE INDEX IF NOT EXISTS idx_reservations_table_date
  ON public.reservations (table_id, date) WHERE table_id IS NOT NULL;

-- 5. Trigger: quando status='cancelled', libera il tavolo e timestamp
CREATE OR REPLACE FUNCTION public.handle_reservation_cancellation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'cancelled' AND (OLD.status IS DISTINCT FROM 'cancelled') THEN
    NEW.table_id := NULL;
    NEW.cancelled_at := COALESCE(NEW.cancelled_at, now());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reservation_cancellation ON public.reservations;
CREATE TRIGGER trg_reservation_cancellation
  BEFORE UPDATE ON public.reservations
  FOR EACH ROW EXECUTE FUNCTION public.handle_reservation_cancellation();

-- 6. RLS: accesso pubblico via manage_token (per pagina /manage/:token)
DROP POLICY IF EXISTS public_read_reservation_by_token ON public.reservations;
CREATE POLICY public_read_reservation_by_token ON public.reservations
  FOR SELECT TO anon, authenticated
  USING (manage_token IS NOT NULL);

-- Permetti al cliente di disdire usando il proprio token (update solo status -> cancelled)
DROP POLICY IF EXISTS public_cancel_by_token ON public.reservations;
CREATE POLICY public_cancel_by_token ON public.reservations
  FOR UPDATE TO anon, authenticated
  USING (manage_token IS NOT NULL)
  WITH CHECK (manage_token IS NOT NULL);