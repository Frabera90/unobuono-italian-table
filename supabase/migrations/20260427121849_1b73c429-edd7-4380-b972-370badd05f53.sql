
CREATE TABLE public.instagram_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL UNIQUE,
  ig_user_id text NOT NULL,
  ig_username text,
  fb_page_id text NOT NULL,
  fb_page_name text,
  access_token text NOT NULL,
  token_expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.instagram_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_all_ig_connections"
ON public.instagram_connections
FOR ALL
USING (public.owns_restaurant(auth.uid(), restaurant_id))
WITH CHECK (public.owns_restaurant(auth.uid(), restaurant_id));

CREATE TRIGGER set_ig_connections_updated_at
BEFORE UPDATE ON public.instagram_connections
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
