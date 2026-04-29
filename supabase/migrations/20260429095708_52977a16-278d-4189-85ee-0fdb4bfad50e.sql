-- 1. Aggiorna staff_set_course_status per accettare 'awaiting'
CREATE OR REPLACE FUNCTION public.staff_set_course_status(_pin text, _preorder_id uuid, _course_status text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _rest_id uuid;
  _pre_rest uuid;
BEGIN
  IF _course_status NOT IN ('awaiting','pending','cooking','ready','served') THEN RETURN false; END IF;
  SELECT restaurant_id INTO _rest_id
    FROM public.restaurant_settings WHERE staff_pin = upper(_pin) LIMIT 1;
  IF _rest_id IS NULL THEN RETURN false; END IF;
  SELECT restaurant_id INTO _pre_rest
    FROM public.preorders WHERE id = _preorder_id;
  IF _pre_rest IS NULL OR _pre_rest <> _rest_id THEN RETURN false; END IF;
  UPDATE public.preorders SET course_status = _course_status WHERE id = _preorder_id;
  RETURN true;
END;
$function$;

-- 2. Nuova RPC: cameriere conferma il pre-ordine e lo invia in cucina (awaiting -> pending)
CREATE OR REPLACE FUNCTION public.staff_confirm_preorder(_pin text, _preorder_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _rest_id uuid;
  _pre_rest uuid;
BEGIN
  SELECT restaurant_id INTO _rest_id
    FROM public.restaurant_settings WHERE staff_pin = upper(_pin) LIMIT 1;
  IF _rest_id IS NULL THEN RETURN false; END IF;
  SELECT restaurant_id INTO _pre_rest
    FROM public.preorders WHERE id = _preorder_id;
  IF _pre_rest IS NULL OR _pre_rest <> _rest_id THEN RETURN false; END IF;
  UPDATE public.preorders 
     SET course_status = 'pending', status = 'confirmed' 
   WHERE id = _preorder_id;
  RETURN true;
END;
$function$;

-- 3. staff_upsert_preorder: il cameriere invia direttamente in cucina (pending), 
-- non in awaiting (perché è già lui che conferma)
CREATE OR REPLACE FUNCTION public.staff_upsert_preorder(_pin text, _reservation_id uuid, _items jsonb, _total numeric DEFAULT NULL::numeric)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
           total = COALESCE(_total, total),
           course_status = CASE WHEN course_status = 'awaiting' THEN 'pending' ELSE course_status END,
           status = 'confirmed'
     WHERE id = _existing;
  END IF;

  RETURN _existing;
END;
$function$;

-- 4. Aggiorna preorder esistenti: i pre-ordini fatti dal cliente (status pending) 
-- e ancora in pending course_status ricevono awaiting solo se la prenotazione non è arrivata.
-- (Lo applichiamo a runtime, qui solo cambiamo il default per i nuovi insert pubblici.)
ALTER TABLE public.preorders ALTER COLUMN course_status SET DEFAULT 'awaiting';