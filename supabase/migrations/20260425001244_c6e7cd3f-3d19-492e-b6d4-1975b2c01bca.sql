-- Style presets riusabili per generare foto social sempre coerenti
CREATE TABLE IF NOT EXISTS public.social_style_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name text NOT NULL,
  style_key text NOT NULL,
  extra_instructions text,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_social_style_presets_restaurant
  ON public.social_style_presets(restaurant_id);

ALTER TABLE public.social_style_presets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS owner_all_style_presets ON public.social_style_presets;
CREATE POLICY owner_all_style_presets
  ON public.social_style_presets
  FOR ALL
  TO public
  USING (public.owns_restaurant(auth.uid(), restaurant_id))
  WITH CHECK (public.owns_restaurant(auth.uid(), restaurant_id));

-- Solo un default per ristorante
CREATE UNIQUE INDEX IF NOT EXISTS uq_style_preset_default
  ON public.social_style_presets(restaurant_id)
  WHERE is_default = true;