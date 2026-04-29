-- RPC per aggiornare lo stato di un singolo item all'interno di un preorder.
-- items è un jsonb array; ogni item può avere un campo "status" tra:
--  pending | cooking | ready | served (default: pending)
-- Quando tutti gli item sono 'served', segniamo course_status='served' (chiusura comanda).

CREATE OR REPLACE FUNCTION public.staff_set_item_status(
  _pin text,
  _preorder_id uuid,
  _item_index integer,
  _status text
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _rest_id uuid;
  _pre_rest uuid;
  _items jsonb;
  _len int;
  _i int;
  _all_served boolean := true;
  _cur_status text;
BEGIN
  IF _status NOT IN ('pending','cooking','ready','served') THEN RETURN false; END IF;

  SELECT restaurant_id INTO _rest_id
    FROM public.restaurant_settings WHERE staff_pin = upper(_pin) LIMIT 1;
  IF _rest_id IS NULL THEN RETURN false; END IF;

  SELECT restaurant_id, items INTO _pre_rest, _items
    FROM public.preorders WHERE id = _preorder_id;
  IF _pre_rest IS NULL OR _pre_rest <> _rest_id THEN RETURN false; END IF;
  IF _items IS NULL OR jsonb_typeof(_items) <> 'array' THEN RETURN false; END IF;

  _len := jsonb_array_length(_items);
  IF _item_index < 0 OR _item_index >= _len THEN RETURN false; END IF;

  _items := jsonb_set(_items, ARRAY[_item_index::text, 'status'], to_jsonb(_status), true);

  -- Verifica se tutti gli item sono 'served'
  FOR _i IN 0.._len - 1 LOOP
    _cur_status := COALESCE(_items -> _i ->> 'status', 'pending');
    IF _cur_status <> 'served' THEN
      _all_served := false;
      EXIT;
    END IF;
  END LOOP;

  IF _all_served THEN
    UPDATE public.preorders
       SET items = _items, course_status = 'served'
     WHERE id = _preorder_id;
  ELSE
    UPDATE public.preorders SET items = _items WHERE id = _preorder_id;
  END IF;

  RETURN true;
END;
$$;