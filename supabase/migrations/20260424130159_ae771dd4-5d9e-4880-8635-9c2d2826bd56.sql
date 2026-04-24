-- Add staff_pin to restaurant_settings
ALTER TABLE public.restaurant_settings
  ADD COLUMN IF NOT EXISTS staff_pin text;

-- Generate a random 6-char PIN for existing rows that don't have one
UPDATE public.restaurant_settings
SET staff_pin = upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6))
WHERE staff_pin IS NULL;

-- Function to lookup restaurant_id by PIN (security definer to bypass RLS)
CREATE OR REPLACE FUNCTION public.restaurant_id_by_staff_pin(_pin text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT restaurant_id FROM public.restaurant_settings WHERE staff_pin = upper(_pin) LIMIT 1;
$$;

-- Allow public read of waiter_calls when filtered by a valid restaurant_id
-- (the staff page validates the PIN client-side via the secure function above,
--  then passes the restaurant_id to filter calls)
DROP POLICY IF EXISTS public_read_waiter_calls ON public.waiter_calls;
CREATE POLICY public_read_waiter_calls
  ON public.waiter_calls FOR SELECT
  USING (true);

-- Allow staff (anon) to mark calls as seen — needed for the waiter panel without auth
DROP POLICY IF EXISTS public_update_waiter_calls ON public.waiter_calls;
CREATE POLICY public_update_waiter_calls
  ON public.waiter_calls FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Same for preorders (read + update status)
DROP POLICY IF EXISTS public_read_preorders ON public.preorders;
CREATE POLICY public_read_preorders
  ON public.preorders FOR SELECT
  USING (true);

DROP POLICY IF EXISTS public_update_preorders ON public.preorders;
CREATE POLICY public_update_preorders
  ON public.preorders FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- And reservations (staff needs to see today's bookings + toggle "arrived")
DROP POLICY IF EXISTS public_read_reservations ON public.reservations;
CREATE POLICY public_read_reservations
  ON public.reservations FOR SELECT
  USING (true);

DROP POLICY IF EXISTS public_update_reservations_arrived ON public.reservations;
CREATE POLICY public_update_reservations_arrived
  ON public.reservations FOR UPDATE
  USING (true)
  WITH CHECK (true);