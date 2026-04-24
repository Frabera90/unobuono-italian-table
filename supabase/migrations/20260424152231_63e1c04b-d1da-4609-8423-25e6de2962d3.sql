-- Tabella tavoli individuali
CREATE TABLE public.tables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  zone_id uuid REFERENCES public.room_zones(id) ON DELETE SET NULL,
  code text NOT NULL,
  seats integer NOT NULL DEFAULT 2,
  notes text,
  sort_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, code)
);

CREATE INDEX idx_tables_restaurant ON public.tables(restaurant_id);
CREATE INDEX idx_tables_zone ON public.tables(zone_id);

ALTER TABLE public.tables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_tables" ON public.tables FOR SELECT USING (true);
CREATE POLICY "owner_write_tables" ON public.tables FOR ALL
  USING (public.owns_restaurant(auth.uid(), restaurant_id))
  WITH CHECK (public.owns_restaurant(auth.uid(), restaurant_id));

-- Aggiungi table_id alle prenotazioni
ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS table_id uuid REFERENCES public.tables(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_reservations_table ON public.reservations(table_id);