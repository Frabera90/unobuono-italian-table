-- Remove the overly permissive UPDATE policies
DROP POLICY IF EXISTS public_update_waiter_calls ON public.waiter_calls;
DROP POLICY IF EXISTS public_update_preorders ON public.preorders;
DROP POLICY IF EXISTS public_update_reservations_arrived ON public.reservations;

-- Server-side function: mark a waiter call as seen, validated by PIN
CREATE OR REPLACE FUNCTION public.staff_mark_call_seen(_call_id uuid, _pin text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _rest_id uuid;
  _call_rest_id uuid;
BEGIN
  SELECT restaurant_id INTO _rest_id FROM public.restaurant_settings WHERE staff_pin = upper(_pin) LIMIT 1;
  IF _rest_id IS NULL THEN RETURN false; END IF;
  SELECT restaurant_id INTO _call_rest_id FROM public.waiter_calls WHERE id = _call_id;
  IF _call_rest_id IS NULL OR _call_rest_id <> _rest_id THEN RETURN false; END IF;
  UPDATE public.waiter_calls SET status = 'seen' WHERE id = _call_id;
  RETURN true;
END;
$$;

-- Server-side function: toggle arrived flag, validated by PIN
CREATE OR REPLACE FUNCTION public.staff_toggle_arrived(_reservation_id uuid, _pin text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _rest_id uuid;
  _resv_rest_id uuid;
  _current boolean;
BEGIN
  SELECT restaurant_id INTO _rest_id FROM public.restaurant_settings WHERE staff_pin = upper(_pin) LIMIT 1;
  IF _rest_id IS NULL THEN RETURN false; END IF;
  SELECT restaurant_id, arrived INTO _resv_rest_id, _current FROM public.reservations WHERE id = _reservation_id;
  IF _resv_rest_id IS NULL OR _resv_rest_id <> _rest_id THEN RETURN false; END IF;
  UPDATE public.reservations SET arrived = NOT COALESCE(_current, false) WHERE id = _reservation_id;
  RETURN true;
END;
$$;

-- Server-side function: set preorder status, validated by PIN
CREATE OR REPLACE FUNCTION public.staff_set_preorder_status(_preorder_id uuid, _status text, _pin text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _rest_id uuid;
  _pre_rest_id uuid;
BEGIN
  IF _status NOT IN ('pending','preparing','ready','served') THEN RETURN false; END IF;
  SELECT restaurant_id INTO _rest_id FROM public.restaurant_settings WHERE staff_pin = upper(_pin) LIMIT 1;
  IF _rest_id IS NULL THEN RETURN false; END IF;
  SELECT restaurant_id INTO _pre_rest_id FROM public.preorders WHERE id = _preorder_id;
  IF _pre_rest_id IS NULL OR _pre_rest_id <> _rest_id THEN RETURN false; END IF;
  UPDATE public.preorders SET status = _status WHERE id = _preorder_id;
  RETURN true;
END;
$$;

-- Server-side function: regenerate the staff PIN (owner only)
CREATE OR REPLACE FUNCTION public.regenerate_staff_pin()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _rest_id uuid;
  _new_pin text;
BEGIN
  SELECT id INTO _rest_id FROM public.restaurants WHERE owner_id = auth.uid() LIMIT 1;
  IF _rest_id IS NULL THEN RETURN NULL; END IF;
  _new_pin := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
  UPDATE public.restaurant_settings SET staff_pin = _new_pin WHERE restaurant_id = _rest_id;
  RETURN _new_pin;
END;
$$;