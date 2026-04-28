CREATE OR REPLACE FUNCTION public.staff_set_preorder_status(_preorder_id uuid, _status text, _pin text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _rest_id uuid;
  _pre_rest_id uuid;
BEGIN
  IF _status NOT IN ('pending','preparing','ready','served','bill_requested','completed','cancelled') THEN RETURN false; END IF;
  SELECT restaurant_id INTO _rest_id FROM public.restaurant_settings WHERE staff_pin = upper(_pin) LIMIT 1;
  IF _rest_id IS NULL THEN RETURN false; END IF;
  SELECT restaurant_id INTO _pre_rest_id FROM public.preorders WHERE id = _preorder_id;
  IF _pre_rest_id IS NULL OR _pre_rest_id <> _rest_id THEN RETURN false; END IF;
  UPDATE public.preorders SET status = _status WHERE id = _preorder_id;
  RETURN true;
END;
$function$;