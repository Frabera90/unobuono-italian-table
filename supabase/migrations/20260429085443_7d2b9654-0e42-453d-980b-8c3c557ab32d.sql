CREATE OR REPLACE FUNCTION public.staff_create_walkin(
  _pin text,
  _customer_name text,
  _party_size integer,
  _table_id uuid DEFAULT NULL::uuid,
  _notes text DEFAULT NULL::text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _rest_id uuid;
  _new_id uuid;
  _now_local timestamp;
  _local_date date;
  _local_time text;
  _local_minutes int;
  _avg_dur int := 90;
  _conflict_id uuid;
BEGIN
  SELECT restaurant_id INTO _rest_id
    FROM public.restaurant_settings
   WHERE staff_pin = upper(_pin) LIMIT 1;
  IF _rest_id IS NULL THEN RETURN NULL; END IF;

  -- Use restaurant local timezone (Europe/Rome) for date/time
  _now_local := (now() AT TIME ZONE 'Europe/Rome');
  _local_date := _now_local::date;
  _local_time := to_char(_now_local, 'HH24:MI');
  _local_minutes := extract(hour from _now_local)::int * 60 + extract(minute from _now_local)::int;

  -- Read avg_table_duration from settings
  SELECT COALESCE(avg_table_duration, 90) INTO _avg_dur
    FROM public.restaurant_settings
   WHERE restaurant_id = _rest_id LIMIT 1;

  -- If a specific table is requested, ensure it's not already booked in overlapping window
  IF _table_id IS NOT NULL THEN
    SELECT r.id INTO _conflict_id
      FROM public.reservations r
     WHERE r.restaurant_id = _rest_id
       AND r.table_id = _table_id
       AND r.date = _local_date
       AND COALESCE(r.status, 'confirmed') NOT IN ('cancelled', 'completed', 'no_show')
       AND abs(
            (split_part(r.time, ':', 1)::int * 60 + split_part(r.time, ':', 2)::int)
            - _local_minutes
          ) < _avg_dur
     LIMIT 1;

    IF _conflict_id IS NOT NULL THEN
      RAISE EXCEPTION 'Tavolo già occupato in questo orario'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  INSERT INTO public.reservations (
    restaurant_id, customer_name, party_size, date, time,
    status, source, table_id, notes, arrived
  ) VALUES (
    _rest_id,
    COALESCE(NULLIF(trim(_customer_name), ''), 'Walk-in'),
    GREATEST(1, _party_size),
    _local_date,
    _local_time,
    'confirmed',
    'walkin',
    _table_id,
    _notes,
    true
  ) RETURNING id INTO _new_id;

  RETURN _new_id;
END;
$function$;