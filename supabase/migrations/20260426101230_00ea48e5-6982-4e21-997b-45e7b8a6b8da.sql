-- 1. Tabella staff_tasks
CREATE TABLE public.staff_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  table_number text,
  reservation_id uuid REFERENCES public.reservations(id) ON DELETE SET NULL,
  call_id uuid REFERENCES public.waiter_calls(id) ON DELETE SET NULL,
  menu_item_id uuid REFERENCES public.menu_items(id) ON DELETE SET NULL,
  menu_item_qty integer DEFAULT 1,
  description text NOT NULL,
  status text NOT NULL DEFAULT 'open', -- open | done
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX idx_staff_tasks_restaurant_status ON public.staff_tasks(restaurant_id, status, created_at DESC);

ALTER TABLE public.staff_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY owner_read_staff_tasks ON public.staff_tasks
  FOR SELECT USING (public.owns_restaurant(auth.uid(), restaurant_id));

CREATE POLICY owner_update_staff_tasks ON public.staff_tasks
  FOR UPDATE USING (public.owns_restaurant(auth.uid(), restaurant_id));

CREATE POLICY public_read_staff_tasks ON public.staff_tasks
  FOR SELECT USING (true);

-- 2. RPC: crea task (staff)
CREATE OR REPLACE FUNCTION public.staff_create_task(
  _pin text,
  _description text,
  _table_number text DEFAULT NULL,
  _reservation_id uuid DEFAULT NULL,
  _call_id uuid DEFAULT NULL,
  _menu_item_id uuid DEFAULT NULL,
  _menu_item_qty integer DEFAULT 1,
  _created_by text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _rest_id uuid;
  _new_id uuid;
BEGIN
  SELECT restaurant_id INTO _rest_id
    FROM public.restaurant_settings WHERE staff_pin = upper(_pin) LIMIT 1;
  IF _rest_id IS NULL THEN RETURN NULL; END IF;
  IF _description IS NULL OR length(trim(_description)) = 0 THEN RETURN NULL; END IF;

  INSERT INTO public.staff_tasks (
    restaurant_id, table_number, reservation_id, call_id,
    menu_item_id, menu_item_qty, description, created_by
  ) VALUES (
    _rest_id, _table_number, _reservation_id, _call_id,
    _menu_item_id, GREATEST(1, COALESCE(_menu_item_qty, 1)),
    trim(_description), _created_by
  ) RETURNING id INTO _new_id;

  RETURN _new_id;
END;
$$;

-- 3. RPC: completa task (auto-aggiunge al preorder se collegato a piatto+prenotazione)
CREATE OR REPLACE FUNCTION public.staff_complete_task(
  _pin text,
  _task_id uuid
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _rest_id uuid;
  _t public.staff_tasks%ROWTYPE;
  _mi public.menu_items%ROWTYPE;
  _pre_id uuid;
  _items jsonb;
  _new_item jsonb;
  _existing_total numeric;
  _customer text;
  _found_idx int;
  _i int;
  _cur jsonb;
BEGIN
  SELECT restaurant_id INTO _rest_id
    FROM public.restaurant_settings WHERE staff_pin = upper(_pin) LIMIT 1;
  IF _rest_id IS NULL THEN RETURN false; END IF;

  SELECT * INTO _t FROM public.staff_tasks WHERE id = _task_id;
  IF NOT FOUND OR _t.restaurant_id <> _rest_id THEN RETURN false; END IF;
  IF _t.status = 'done' THEN RETURN true; END IF;

  -- Se collegato a piatto + prenotazione, aggiungi al preorder
  IF _t.menu_item_id IS NOT NULL AND _t.reservation_id IS NOT NULL THEN
    SELECT * INTO _mi FROM public.menu_items WHERE id = _t.menu_item_id;
    IF FOUND THEN
      SELECT id, items, total, customer_name
        INTO _pre_id, _items, _existing_total, _customer
        FROM public.preorders
       WHERE reservation_id = _t.reservation_id LIMIT 1;

      IF _pre_id IS NULL THEN
        SELECT customer_name INTO _customer FROM public.reservations WHERE id = _t.reservation_id;
        _items := '[]'::jsonb;
        _existing_total := 0;
      END IF;

      _new_item := jsonb_build_object(
        'id', _mi.id::text,
        'name', _mi.name,
        'price', COALESCE(_mi.price, 0),
        'qty', _t.menu_item_qty,
        'addedBy', 'staff_task'
      );

      -- Cerca se piatto già presente: incrementa qty
      _found_idx := -1;
      IF jsonb_typeof(_items) = 'array' THEN
        FOR _i IN 0..(jsonb_array_length(_items) - 1) LOOP
          _cur := _items -> _i;
          IF (_cur ->> 'id') = _mi.id::text THEN
            _found_idx := _i;
            EXIT;
          END IF;
        END LOOP;
      ELSE
        _items := '[]'::jsonb;
      END IF;

      IF _found_idx >= 0 THEN
        _cur := _items -> _found_idx;
        _items := jsonb_set(
          _items,
          ARRAY[_found_idx::text, 'qty'],
          to_jsonb(COALESCE((_cur ->> 'qty')::int, 1) + _t.menu_item_qty)
        );
      ELSE
        _items := _items || _new_item;
      END IF;

      _existing_total := COALESCE(_existing_total, 0) + (COALESCE(_mi.price, 0) * _t.menu_item_qty);

      IF _pre_id IS NULL THEN
        INSERT INTO public.preorders (
          restaurant_id, reservation_id, customer_name, items, total, status, course_status
        ) VALUES (
          _rest_id, _t.reservation_id, _customer, _items, _existing_total, 'confirmed', 'pending'
        );
      ELSE
        UPDATE public.preorders SET items = _items, total = _existing_total WHERE id = _pre_id;
      END IF;
    END IF;
  END IF;

  UPDATE public.staff_tasks
     SET status = 'done', completed_at = now()
   WHERE id = _task_id;

  RETURN true;
END;
$$;

-- 4. RPC: riapri task
CREATE OR REPLACE FUNCTION public.staff_reopen_task(_pin text, _task_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _rest_id uuid;
  _task_rest uuid;
BEGIN
  SELECT restaurant_id INTO _rest_id
    FROM public.restaurant_settings WHERE staff_pin = upper(_pin) LIMIT 1;
  IF _rest_id IS NULL THEN RETURN false; END IF;
  SELECT restaurant_id INTO _task_rest FROM public.staff_tasks WHERE id = _task_id;
  IF _task_rest IS NULL OR _task_rest <> _rest_id THEN RETURN false; END IF;
  UPDATE public.staff_tasks SET status = 'open', completed_at = NULL WHERE id = _task_id;
  RETURN true;
END;
$$;

-- 5. RPC: elimina task
CREATE OR REPLACE FUNCTION public.staff_delete_task(_pin text, _task_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _rest_id uuid;
  _task_rest uuid;
BEGIN
  SELECT restaurant_id INTO _rest_id
    FROM public.restaurant_settings WHERE staff_pin = upper(_pin) LIMIT 1;
  IF _rest_id IS NULL THEN RETURN false; END IF;
  SELECT restaurant_id INTO _task_rest FROM public.staff_tasks WHERE id = _task_id;
  IF _task_rest IS NULL OR _task_rest <> _rest_id THEN RETURN false; END IF;
  DELETE FROM public.staff_tasks WHERE id = _task_id;
  RETURN true;
END;
$$;

-- 6. Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.staff_tasks;