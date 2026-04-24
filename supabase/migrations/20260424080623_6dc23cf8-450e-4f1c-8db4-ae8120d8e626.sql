
-- Ensure full row data is sent on UPDATE/DELETE events
ALTER TABLE public.menu_items REPLICA IDENTITY FULL;
ALTER TABLE public.waiter_calls REPLICA IDENTITY FULL;
ALTER TABLE public.reservations REPLICA IDENTITY FULL;
ALTER TABLE public.preorders REPLICA IDENTITY FULL;
ALTER TABLE public.reviews REPLICA IDENTITY FULL;

-- Add tables to the supabase_realtime publication (idempotent)
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['menu_items','waiter_calls','reservations','preorders','reviews']
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;
