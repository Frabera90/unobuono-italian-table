-- 1) TABLES: min/max coperti
ALTER TABLE public.tables
  ADD COLUMN IF NOT EXISTS min_seats integer,
  ADD COLUMN IF NOT EXISTS max_seats integer;

-- default sensato: max = seats, min = max(1, seats-1) per evitare spreco di tavoli grossi
UPDATE public.tables
SET max_seats = COALESCE(max_seats, seats),
    min_seats = COALESCE(min_seats, GREATEST(1, seats - 1))
WHERE max_seats IS NULL OR min_seats IS NULL;

-- 2) RESERVATIONS: source + tavoli uniti
ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS source text DEFAULT 'online',
  ADD COLUMN IF NOT EXISTS joined_table_ids uuid[] DEFAULT NULL;

-- 3) MENU_ITEMS: tag strutturati allergeni e diete
ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS allergen_tags text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS diet_tags text[] DEFAULT '{}';

-- 4) PREORDERS: stato portata generale
ALTER TABLE public.preorders
  ADD COLUMN IF NOT EXISTS course_status text DEFAULT 'pending';

-- 5) FUNZIONI HELPER STAFF (security definer, validano via PIN)

-- Crea walk-in (prenotazione immediata da staff)
CREATE OR REPLACE FUNCTION public.staff_create_walkin(
  _pin text,
  _customer_name text,
  _party_size integer,
  _table_id uuid DEFAULT NULL,
  _notes text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _rest_id uuid;
  _new_id uuid;
  _now timestamptz := now();
BEGIN
  SELECT restaurant_id INTO _rest_id
    FROM public.restaurant_settings
   WHERE staff_pin = upper(_pin) LIMIT 1;
  IF _rest_id IS NULL THEN RETURN NULL; END IF;

  INSERT INTO public.reservations (
    restaurant_id, customer_name, party_size, date, time,
    status, source, table_id, notes, arrived
  ) VALUES (
    _rest_id,
    COALESCE(NULLIF(trim(_customer_name), ''), 'Walk-in'),
    GREATEST(1, _party_size),
    (_now AT TIME ZONE 'UTC')::date,
    to_char(_now AT TIME ZONE 'UTC', 'HH24:MI'),
    'confirmed',
    'walkin',
    _table_id,
    _notes,
    true
  ) RETURNING id INTO _new_id;

  RETURN _new_id;
END;
$$;

-- Aggiorna note di un singolo item dentro preorders.items (jsonb array)
CREATE OR REPLACE FUNCTION public.staff_set_preorder_item_notes(
  _pin text,
  _preorder_id uuid,
  _item_index integer,
  _notes text
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _rest_id uuid;
  _pre_rest uuid;
  _items jsonb;
BEGIN
  SELECT restaurant_id INTO _rest_id
    FROM public.restaurant_settings WHERE staff_pin = upper(_pin) LIMIT 1;
  IF _rest_id IS NULL THEN RETURN false; END IF;

  SELECT restaurant_id, items INTO _pre_rest, _items
    FROM public.preorders WHERE id = _preorder_id;
  IF _pre_rest IS NULL OR _pre_rest <> _rest_id THEN RETURN false; END IF;
  IF _items IS NULL OR jsonb_typeof(_items) <> 'array' THEN RETURN false; END IF;
  IF _item_index < 0 OR _item_index >= jsonb_array_length(_items) THEN RETURN false; END IF;

  UPDATE public.preorders
     SET items = jsonb_set(_items, ARRAY[_item_index::text, 'notes'], to_jsonb(COALESCE(_notes, '')), true)
   WHERE id = _preorder_id;
  RETURN true;
END;
$$;

-- Crea/aggiorna preorder via staff (upsert per reservation_id)
CREATE OR REPLACE FUNCTION public.staff_upsert_preorder(
  _pin text,
  _reservation_id uuid,
  _items jsonb,
  _total numeric DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _rest_id uuid;
  _resv_rest uuid;
  _existing uuid;
  _customer text;
BEGIN
  SELECT restaurant_id INTO _rest_id
    FROM public.restaurant_settings WHERE staff_pin = upper(_pin) LIMIT 1;
  IF _rest_id IS NULL THEN RETURN NULL; END IF;

  SELECT restaurant_id, customer_name INTO _resv_rest, _customer
    FROM public.reservations WHERE id = _reservation_id;
  IF _resv_rest IS NULL OR _resv_rest <> _rest_id THEN RETURN NULL; END IF;

  SELECT id INTO _existing
    FROM public.preorders WHERE reservation_id = _reservation_id LIMIT 1;

  IF _existing IS NULL THEN
    INSERT INTO public.preorders (restaurant_id, reservation_id, customer_name, items, total, status, course_status)
    VALUES (_rest_id, _reservation_id, _customer, COALESCE(_items, '[]'::jsonb), _total, 'confirmed', 'pending')
    RETURNING id INTO _existing;
  ELSE
    UPDATE public.preorders
       SET items = COALESCE(_items, items),
           total = COALESCE(_total, total)
     WHERE id = _existing;
  END IF;

  RETURN _existing;
END;
$$;

-- Aggiorna stato portata di un preorder (kitchen status)
CREATE OR REPLACE FUNCTION public.staff_set_course_status(
  _pin text,
  _preorder_id uuid,
  _course_status text
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _rest_id uuid;
  _pre_rest uuid;
BEGIN
  IF _course_status NOT IN ('pending','cooking','ready','served') THEN RETURN false; END IF;
  SELECT restaurant_id INTO _rest_id
    FROM public.restaurant_settings WHERE staff_pin = upper(_pin) LIMIT 1;
  IF _rest_id IS NULL THEN RETURN false; END IF;
  SELECT restaurant_id INTO _pre_rest
    FROM public.preorders WHERE id = _preorder_id;
  IF _pre_rest IS NULL OR _pre_rest <> _rest_id THEN RETURN false; END IF;
  UPDATE public.preorders SET course_status = _course_status WHERE id = _preorder_id;
  RETURN true;
END;
$$;

-- Assegna tavolo (singolo o uniti) a una reservation lato staff
CREATE OR REPLACE FUNCTION public.staff_assign_table(
  _pin text,
  _reservation_id uuid,
  _table_id uuid,
  _joined_ids uuid[] DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _rest_id uuid;
  _resv_rest uuid;
BEGIN
  SELECT restaurant_id INTO _rest_id
    FROM public.restaurant_settings WHERE staff_pin = upper(_pin) LIMIT 1;
  IF _rest_id IS NULL THEN RETURN false; END IF;
  SELECT restaurant_id INTO _resv_rest
    FROM public.reservations WHERE id = _reservation_id;
  IF _resv_rest IS NULL OR _resv_rest <> _rest_id THEN RETURN false; END IF;

  UPDATE public.reservations
     SET table_id = _table_id,
         joined_table_ids = _joined_ids
   WHERE id = _reservation_id;
  RETURN true;
END;
$$;