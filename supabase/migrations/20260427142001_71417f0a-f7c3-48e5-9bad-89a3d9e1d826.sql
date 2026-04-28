-- Allow walk-in preorders without a reservation
DROP POLICY IF EXISTS public_insert_preorders ON public.preorders;

CREATE POLICY public_insert_preorders ON public.preorders
  FOR INSERT
  WITH CHECK (
    -- Walk-in: no reservation, but must reference an existing restaurant
    (reservation_id IS NULL AND EXISTS (SELECT 1 FROM public.restaurants WHERE id = preorders.restaurant_id))
    OR
    -- Linked to an existing reservation
    (reservation_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.reservations WHERE id = preorders.reservation_id))
  );