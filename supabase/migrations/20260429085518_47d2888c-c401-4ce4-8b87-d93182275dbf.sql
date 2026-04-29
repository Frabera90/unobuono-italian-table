-- Shared notes table for staff + owner communication
CREATE TABLE IF NOT EXISTS public.staff_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL,
  body text NOT NULL,
  author_name text,
  pinned boolean NOT NULL DEFAULT false,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_staff_notes_restaurant ON public.staff_notes(restaurant_id, created_at DESC);

ALTER TABLE public.staff_notes ENABLE ROW LEVEL SECURITY;

-- Owner full access
CREATE POLICY "owner_all_staff_notes" ON public.staff_notes
  FOR ALL USING (owns_restaurant(auth.uid(), restaurant_id))
  WITH CHECK (owns_restaurant(auth.uid(), restaurant_id));

-- Public read (needed for staff PIN client; restaurant_id scoped)
CREATE POLICY "public_read_staff_notes" ON public.staff_notes
  FOR SELECT USING (true);

-- Staff create via PIN-protected RPC
CREATE OR REPLACE FUNCTION public.staff_create_note(
  _pin text,
  _body text,
  _author_name text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _rest_id uuid; _new_id uuid;
BEGIN
  SELECT restaurant_id INTO _rest_id FROM public.restaurant_settings
   WHERE staff_pin = upper(_pin) LIMIT 1;
  IF _rest_id IS NULL THEN RETURN NULL; END IF;
  IF length(trim(coalesce(_body,''))) = 0 THEN RETURN NULL; END IF;
  INSERT INTO public.staff_notes (restaurant_id, body, author_name)
  VALUES (_rest_id, _body, NULLIF(trim(_author_name), ''))
  RETURNING id INTO _new_id;
  RETURN _new_id;
END $$;

CREATE OR REPLACE FUNCTION public.staff_update_note(
  _pin text,
  _note_id uuid,
  _body text DEFAULT NULL,
  _pinned boolean DEFAULT NULL,
  _resolved boolean DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _rest_id uuid;
BEGIN
  SELECT restaurant_id INTO _rest_id FROM public.restaurant_settings
   WHERE staff_pin = upper(_pin) LIMIT 1;
  IF _rest_id IS NULL THEN RETURN false; END IF;
  UPDATE public.staff_notes SET
    body = COALESCE(_body, body),
    pinned = COALESCE(_pinned, pinned),
    resolved_at = CASE WHEN _resolved IS NULL THEN resolved_at
                       WHEN _resolved THEN now() ELSE NULL END,
    updated_at = now()
  WHERE id = _note_id AND restaurant_id = _rest_id;
  RETURN FOUND;
END $$;

CREATE OR REPLACE FUNCTION public.staff_delete_note(
  _pin text,
  _note_id uuid
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _rest_id uuid;
BEGIN
  SELECT restaurant_id INTO _rest_id FROM public.restaurant_settings
   WHERE staff_pin = upper(_pin) LIMIT 1;
  IF _rest_id IS NULL THEN RETURN false; END IF;
  DELETE FROM public.staff_notes WHERE id = _note_id AND restaurant_id = _rest_id;
  RETURN FOUND;
END $$;

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.staff_notes;