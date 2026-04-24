DROP POLICY IF EXISTS owner_update_preorders ON public.preorders;
CREATE POLICY owner_update_preorders ON public.preorders
  FOR UPDATE TO public
  USING (public.owns_restaurant(auth.uid(), restaurant_id))
  WITH CHECK (public.owns_restaurant(auth.uid(), restaurant_id));