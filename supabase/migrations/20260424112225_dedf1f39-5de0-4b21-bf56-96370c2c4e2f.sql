
-- ==========================================
-- 1. SVUOTA TUTTI I DATI DEMO
-- ==========================================
TRUNCATE TABLE 
  preorders, waiter_calls, reservations, waitlist,
  menu_items, room_zones, clients, reviews,
  social_posts, campaigns, restaurant_settings
RESTART IDENTITY CASCADE;

-- ==========================================
-- 2. NUOVE TABELLE
-- ==========================================

-- Tabella restaurants (uno per owner)
CREATE TABLE public.restaurants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Il mio ristorante',
  slug text UNIQUE NOT NULL,
  onboarding_complete boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_restaurants_owner ON public.restaurants(owner_id);
CREATE INDEX idx_restaurants_slug ON public.restaurants(slug);

-- Tabella profiles
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enum ruoli
CREATE TYPE public.app_role AS ENUM ('owner', 'staff', 'admin');

-- Tabella user_roles (separata!)
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  restaurant_id uuid REFERENCES public.restaurants(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role, restaurant_id)
);

CREATE INDEX idx_user_roles_user ON public.user_roles(user_id);

-- ==========================================
-- 3. AGGIUNGI restaurant_id ALLE TABELLE ESISTENTI
-- ==========================================
ALTER TABLE public.menu_items ADD COLUMN restaurant_id uuid REFERENCES public.restaurants(id) ON DELETE CASCADE;
ALTER TABLE public.reservations ADD COLUMN restaurant_id uuid REFERENCES public.restaurants(id) ON DELETE CASCADE;
ALTER TABLE public.clients ADD COLUMN restaurant_id uuid REFERENCES public.restaurants(id) ON DELETE CASCADE;
ALTER TABLE public.reviews ADD COLUMN restaurant_id uuid REFERENCES public.restaurants(id) ON DELETE CASCADE;
ALTER TABLE public.room_zones ADD COLUMN restaurant_id uuid REFERENCES public.restaurants(id) ON DELETE CASCADE;
ALTER TABLE public.social_posts ADD COLUMN restaurant_id uuid REFERENCES public.restaurants(id) ON DELETE CASCADE;
ALTER TABLE public.campaigns ADD COLUMN restaurant_id uuid REFERENCES public.restaurants(id) ON DELETE CASCADE;
ALTER TABLE public.waiter_calls ADD COLUMN restaurant_id uuid REFERENCES public.restaurants(id) ON DELETE CASCADE;
ALTER TABLE public.waitlist ADD COLUMN restaurant_id uuid REFERENCES public.restaurants(id) ON DELETE CASCADE;
ALTER TABLE public.preorders ADD COLUMN restaurant_id uuid REFERENCES public.restaurants(id) ON DELETE CASCADE;
ALTER TABLE public.restaurant_settings ADD COLUMN restaurant_id uuid UNIQUE REFERENCES public.restaurants(id) ON DELETE CASCADE;

CREATE INDEX idx_menu_items_restaurant ON public.menu_items(restaurant_id);
CREATE INDEX idx_reservations_restaurant ON public.reservations(restaurant_id);
CREATE INDEX idx_clients_restaurant ON public.clients(restaurant_id);
CREATE INDEX idx_reviews_restaurant ON public.reviews(restaurant_id);
CREATE INDEX idx_room_zones_restaurant ON public.room_zones(restaurant_id);
CREATE INDEX idx_waiter_calls_restaurant ON public.waiter_calls(restaurant_id);

-- ==========================================
-- 4. FUNZIONI SICUREZZA (security definer)
-- ==========================================

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.owns_restaurant(_user_id uuid, _restaurant_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.restaurants WHERE id = _restaurant_id AND owner_id = _user_id);
$$;

CREATE OR REPLACE FUNCTION public.current_user_restaurant_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id FROM public.restaurants WHERE owner_id = auth.uid() LIMIT 1;
$$;

-- ==========================================
-- 5. TRIGGER AUTO-CREATE su signup
-- ==========================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  new_restaurant_id uuid;
  base_slug text;
  final_slug text;
  counter int := 0;
BEGIN
  -- profile
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)));

  -- slug base
  base_slug := lower(regexp_replace(split_part(NEW.email, '@', 1), '[^a-z0-9]+', '-', 'g'));
  final_slug := base_slug;
  WHILE EXISTS (SELECT 1 FROM public.restaurants WHERE slug = final_slug) LOOP
    counter := counter + 1;
    final_slug := base_slug || '-' || counter;
  END LOOP;

  -- restaurant
  INSERT INTO public.restaurants (owner_id, name, slug)
  VALUES (NEW.id, 'Il mio ristorante', final_slug)
  RETURNING id INTO new_restaurant_id;

  -- restaurant_settings vuote
  INSERT INTO public.restaurant_settings (restaurant_id, name) VALUES (new_restaurant_id, 'Il mio ristorante');

  -- ruolo owner
  INSERT INTO public.user_roles (user_id, role, restaurant_id) VALUES (NEW.id, 'owner', new_restaurant_id);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- updated_at trigger generico
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_restaurants_updated BEFORE UPDATE ON public.restaurants FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ==========================================
-- 6. ENABLE RLS
-- ==========================================
ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- 7. RIMUOVI VECCHIE POLICY public_all_*
-- ==========================================
DROP POLICY IF EXISTS public_all_campaigns ON public.campaigns;
DROP POLICY IF EXISTS public_all_clients ON public.clients;
DROP POLICY IF EXISTS public_all_menu_items ON public.menu_items;
DROP POLICY IF EXISTS public_all_preorders ON public.preorders;
DROP POLICY IF EXISTS public_all_reservations ON public.reservations;
DROP POLICY IF EXISTS public_all_restaurant_settings ON public.restaurant_settings;
DROP POLICY IF EXISTS public_all_reviews ON public.reviews;
DROP POLICY IF EXISTS public_all_room_zones ON public.room_zones;
DROP POLICY IF EXISTS public_all_social_posts ON public.social_posts;
DROP POLICY IF EXISTS public_all_waiter_calls ON public.waiter_calls;
DROP POLICY IF EXISTS public_all_waitlist ON public.waitlist;

-- ==========================================
-- 8. NUOVE POLICY RLS
-- ==========================================

-- restaurants
CREATE POLICY "owner_select_own_restaurant" ON public.restaurants FOR SELECT USING (owner_id = auth.uid());
CREATE POLICY "owner_update_own_restaurant" ON public.restaurants FOR UPDATE USING (owner_id = auth.uid());
CREATE POLICY "public_read_restaurants_by_slug" ON public.restaurants FOR SELECT USING (true); -- pubblico per pagina /r/:slug

-- profiles
CREATE POLICY "user_select_own_profile" ON public.profiles FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "user_update_own_profile" ON public.profiles FOR UPDATE USING (user_id = auth.uid());

-- user_roles (read-only per utente; insert solo via trigger)
CREATE POLICY "user_select_own_roles" ON public.user_roles FOR SELECT USING (user_id = auth.uid());

-- restaurant_settings (pubblico read per /r/:slug, owner write)
CREATE POLICY "public_read_settings" ON public.restaurant_settings FOR SELECT USING (true);
CREATE POLICY "owner_write_settings" ON public.restaurant_settings FOR ALL USING (public.owns_restaurant(auth.uid(), restaurant_id)) WITH CHECK (public.owns_restaurant(auth.uid(), restaurant_id));

-- room_zones (pubblico read, owner write)
CREATE POLICY "public_read_zones" ON public.room_zones FOR SELECT USING (true);
CREATE POLICY "owner_write_zones" ON public.room_zones FOR ALL USING (public.owns_restaurant(auth.uid(), restaurant_id)) WITH CHECK (public.owns_restaurant(auth.uid(), restaurant_id));

-- menu_items (pubblico read, owner write)
CREATE POLICY "public_read_menu" ON public.menu_items FOR SELECT USING (true);
CREATE POLICY "owner_write_menu" ON public.menu_items FOR ALL USING (public.owns_restaurant(auth.uid(), restaurant_id)) WITH CHECK (public.owns_restaurant(auth.uid(), restaurant_id));

-- reservations (chiunque INSERT, solo owner SELECT/UPDATE/DELETE)
CREATE POLICY "public_insert_reservations" ON public.reservations FOR INSERT WITH CHECK (restaurant_id IS NOT NULL);
CREATE POLICY "owner_manage_reservations" ON public.reservations FOR SELECT USING (public.owns_restaurant(auth.uid(), restaurant_id));
CREATE POLICY "owner_update_reservations" ON public.reservations FOR UPDATE USING (public.owns_restaurant(auth.uid(), restaurant_id));
CREATE POLICY "owner_delete_reservations" ON public.reservations FOR DELETE USING (public.owns_restaurant(auth.uid(), restaurant_id));

-- waitlist (chiunque INSERT, solo owner read)
CREATE POLICY "public_insert_waitlist" ON public.waitlist FOR INSERT WITH CHECK (restaurant_id IS NOT NULL);
CREATE POLICY "owner_manage_waitlist" ON public.waitlist FOR SELECT USING (public.owns_restaurant(auth.uid(), restaurant_id));
CREATE POLICY "owner_update_waitlist" ON public.waitlist FOR UPDATE USING (public.owns_restaurant(auth.uid(), restaurant_id));

-- waiter_calls (chiunque INSERT, owner manages)
CREATE POLICY "public_insert_waiter_calls" ON public.waiter_calls FOR INSERT WITH CHECK (restaurant_id IS NOT NULL);
CREATE POLICY "owner_manage_waiter_calls" ON public.waiter_calls FOR SELECT USING (public.owns_restaurant(auth.uid(), restaurant_id));
CREATE POLICY "owner_update_waiter_calls" ON public.waiter_calls FOR UPDATE USING (public.owns_restaurant(auth.uid(), restaurant_id));
CREATE POLICY "owner_delete_waiter_calls" ON public.waiter_calls FOR DELETE USING (public.owns_restaurant(auth.uid(), restaurant_id));

-- preorders (chiunque INSERT, owner read)
CREATE POLICY "public_insert_preorders" ON public.preorders FOR INSERT WITH CHECK (true);
CREATE POLICY "owner_read_preorders" ON public.preorders FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.reservations r WHERE r.id = reservation_id AND public.owns_restaurant(auth.uid(), r.restaurant_id))
);

-- clients (solo owner)
CREATE POLICY "owner_all_clients" ON public.clients FOR ALL USING (public.owns_restaurant(auth.uid(), restaurant_id)) WITH CHECK (public.owns_restaurant(auth.uid(), restaurant_id));

-- reviews (chiunque INSERT pubblicamente, solo owner manage)
CREATE POLICY "public_insert_reviews" ON public.reviews FOR INSERT WITH CHECK (restaurant_id IS NOT NULL);
CREATE POLICY "public_read_reviews" ON public.reviews FOR SELECT USING (true); -- visibili sul profilo pubblico
CREATE POLICY "owner_update_reviews" ON public.reviews FOR UPDATE USING (public.owns_restaurant(auth.uid(), restaurant_id));
CREATE POLICY "owner_delete_reviews" ON public.reviews FOR DELETE USING (public.owns_restaurant(auth.uid(), restaurant_id));

-- social_posts (solo owner)
CREATE POLICY "owner_all_social_posts" ON public.social_posts FOR ALL USING (public.owns_restaurant(auth.uid(), restaurant_id)) WITH CHECK (public.owns_restaurant(auth.uid(), restaurant_id));

-- campaigns (solo owner)
CREATE POLICY "owner_all_campaigns" ON public.campaigns FOR ALL USING (public.owns_restaurant(auth.uid(), restaurant_id)) WITH CHECK (public.owns_restaurant(auth.uid(), restaurant_id));
