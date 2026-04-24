
-- Fix policy "Always True" sostituendo true con check di esistenza ristorante
DROP POLICY IF EXISTS "public_insert_reservations" ON public.reservations;
CREATE POLICY "public_insert_reservations" ON public.reservations FOR INSERT 
  WITH CHECK (EXISTS (SELECT 1 FROM public.restaurants WHERE id = restaurant_id));

DROP POLICY IF EXISTS "public_insert_waitlist" ON public.waitlist;
CREATE POLICY "public_insert_waitlist" ON public.waitlist FOR INSERT 
  WITH CHECK (EXISTS (SELECT 1 FROM public.restaurants WHERE id = restaurant_id));

DROP POLICY IF EXISTS "public_insert_waiter_calls" ON public.waiter_calls;
CREATE POLICY "public_insert_waiter_calls" ON public.waiter_calls FOR INSERT 
  WITH CHECK (EXISTS (SELECT 1 FROM public.restaurants WHERE id = restaurant_id));

DROP POLICY IF EXISTS "public_insert_reviews" ON public.reviews;
CREATE POLICY "public_insert_reviews" ON public.reviews FOR INSERT 
  WITH CHECK (EXISTS (SELECT 1 FROM public.restaurants WHERE id = restaurant_id));

DROP POLICY IF EXISTS "public_insert_preorders" ON public.preorders;
CREATE POLICY "public_insert_preorders" ON public.preorders FOR INSERT 
  WITH CHECK (EXISTS (SELECT 1 FROM public.reservations WHERE id = reservation_id));

-- Fix search_path su set_updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
