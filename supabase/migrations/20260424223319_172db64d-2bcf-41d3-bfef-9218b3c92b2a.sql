
-- Trigger: alla creazione di una prenotazione, crea/aggiorna scheda cliente CRM
CREATE OR REPLACE FUNCTION public.upsert_client_from_reservation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _existing_id uuid;
BEGIN
  IF NEW.restaurant_id IS NULL OR NEW.customer_name IS NULL THEN
    RETURN NEW;
  END IF;

  -- match per telefono (se presente) altrimenti nome
  IF NEW.customer_phone IS NOT NULL AND length(trim(NEW.customer_phone)) > 0 THEN
    SELECT id INTO _existing_id
    FROM public.clients
    WHERE restaurant_id = NEW.restaurant_id
      AND phone = NEW.customer_phone
    LIMIT 1;
  ELSE
    SELECT id INTO _existing_id
    FROM public.clients
    WHERE restaurant_id = NEW.restaurant_id
      AND lower(name) = lower(NEW.customer_name)
    LIMIT 1;
  END IF;

  IF _existing_id IS NULL THEN
    INSERT INTO public.clients (restaurant_id, name, phone, last_visit, visit_count, allergens, notes)
    VALUES (
      NEW.restaurant_id,
      NEW.customer_name,
      NEW.customer_phone,
      NEW.date,
      1,
      NEW.allergies,
      NEW.notes
    );
  ELSE
    UPDATE public.clients
       SET visit_count = COALESCE(visit_count, 0) + 1,
           last_visit  = GREATEST(COALESCE(last_visit, NEW.date), NEW.date),
           phone       = COALESCE(phone, NEW.customer_phone),
           allergens   = COALESCE(allergens, NEW.allergies)
     WHERE id = _existing_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_upsert_client_from_reservation ON public.reservations;
CREATE TRIGGER trg_upsert_client_from_reservation
AFTER INSERT ON public.reservations
FOR EACH ROW
EXECUTE FUNCTION public.upsert_client_from_reservation();
