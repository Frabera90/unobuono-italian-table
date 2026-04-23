
-- TABLES
create table public.restaurant_settings (
  id uuid default gen_random_uuid() primary key,
  name text default 'Carpediem Pizzeria',
  address text default 'Via Roma 1, Pescara',
  phone text default '+39 085 123456',
  opening_hours jsonb default '{"mon":"closed","tue":"19:00-23:00","wed":"19:00-23:00","thu":"19:00-23:00","fri":"19:00-24:00","sat":"12:00-15:00,19:00-24:00","sun":"12:00-15:00"}'::jsonb,
  max_covers integer default 60,
  avg_table_duration integer default 90,
  logo_url text,
  cover_photo_url text,
  bio text default 'Pizzeria di ricerca a Pescara. Impasti naturali, ingredienti selezionati, passione vera.',
  tone text default 'Autentico e caldo',
  instagram_handle text default '@carpediempescara',
  facebook_handle text default '@CarpediemPizzeriaPescara',
  tiktok_handle text,
  ask_occasion boolean default true,
  ask_allergies boolean default true,
  waitlist_enabled boolean default true,
  preorder_hours_before integer default 2,
  reminder_24h boolean default true,
  followup_enabled boolean default true,
  updated_at timestamptz default now()
);

create table public.room_zones (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  description text,
  features text,
  table_count integer default 5,
  capacity integer default 20,
  available boolean default true,
  sort_order integer default 0
);

create table public.menu_items (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  description text,
  price numeric,
  category text,
  available boolean default true,
  photo_url text,
  allergens text,
  sort_order integer default 0,
  updated_at timestamptz default now()
);

create table public.reservations (
  id uuid default gen_random_uuid() primary key,
  customer_name text not null,
  customer_phone text,
  party_size integer not null,
  date date not null,
  time text not null,
  zone_id uuid references public.room_zones(id),
  zone_name text,
  occasion text,
  allergies text,
  notes text,
  status text default 'confirmed',
  preorder_link_sent boolean default false,
  reminder_sent boolean default false,
  arrived boolean default false,
  created_at timestamptz default now()
);

create table public.waitlist (
  id uuid default gen_random_uuid() primary key,
  customer_name text not null,
  customer_phone text,
  party_size integer not null,
  date date not null,
  preferred_time text,
  status text default 'waiting',
  created_at timestamptz default now()
);

create table public.preorders (
  id uuid default gen_random_uuid() primary key,
  reservation_id uuid references public.reservations(id) on delete cascade,
  customer_name text,
  items jsonb,
  total numeric,
  status text default 'pending',
  created_at timestamptz default now()
);

create table public.waiter_calls (
  id uuid default gen_random_uuid() primary key,
  table_number text not null,
  reservation_id uuid references public.reservations(id) on delete set null,
  customer_name text,
  message text,
  status text default 'pending',
  created_at timestamptz default now()
);

create table public.clients (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  phone text,
  visit_count integer default 1,
  last_visit date,
  birthday date,
  tags text[],
  allergens text,
  notes text,
  total_spent numeric default 0,
  created_at timestamptz default now()
);

create table public.reviews (
  id uuid default gen_random_uuid() primary key,
  platform text default 'google',
  author text,
  rating integer,
  text text,
  date timestamptz default now(),
  status text default 'new',
  ai_responses jsonb,
  owner_response text
);

create table public.social_posts (
  id uuid default gen_random_uuid() primary key,
  image_url text,
  caption text,
  hashtags text,
  platform text default 'instagram',
  scheduled_at timestamptz,
  status text default 'draft',
  created_at timestamptz default now()
);

-- RLS: public read+write (demo, no auth)
alter table public.restaurant_settings enable row level security;
alter table public.room_zones enable row level security;
alter table public.menu_items enable row level security;
alter table public.reservations enable row level security;
alter table public.waitlist enable row level security;
alter table public.preorders enable row level security;
alter table public.waiter_calls enable row level security;
alter table public.clients enable row level security;
alter table public.reviews enable row level security;
alter table public.social_posts enable row level security;

do $$
declare t text;
begin
  for t in select unnest(array['restaurant_settings','room_zones','menu_items','reservations','waitlist','preorders','waiter_calls','clients','reviews','social_posts'])
  loop
    execute format('create policy "public_all_%s" on public.%I for all using (true) with check (true)', t, t);
  end loop;
end$$;

-- REALTIME
alter publication supabase_realtime add table public.restaurant_settings;
alter publication supabase_realtime add table public.room_zones;
alter publication supabase_realtime add table public.menu_items;
alter publication supabase_realtime add table public.reservations;
alter publication supabase_realtime add table public.waitlist;
alter publication supabase_realtime add table public.preorders;
alter publication supabase_realtime add table public.waiter_calls;
alter publication supabase_realtime add table public.clients;
alter publication supabase_realtime add table public.reviews;
alter publication supabase_realtime add table public.social_posts;

alter table public.restaurant_settings replica identity full;
alter table public.room_zones replica identity full;
alter table public.menu_items replica identity full;
alter table public.reservations replica identity full;
alter table public.waitlist replica identity full;
alter table public.preorders replica identity full;
alter table public.waiter_calls replica identity full;
alter table public.clients replica identity full;
alter table public.reviews replica identity full;
alter table public.social_posts replica identity full;

-- SEEDS
insert into public.restaurant_settings (id) values (gen_random_uuid());

insert into public.room_zones (name, description, features, table_count, capacity, sort_order) values
('Sala principale','Ambiente caldo e vivace','Ideale per gruppi e famiglie',8,32,1),
('Patio esterno','Vista sul giardino, aria aperta','Perfetta per serate estive',6,24,2),
('Bancone pizza','Vicino al forno, esperienza unica','Per chi ama vedere la pizza nascere',1,4,3),
('Saletta riservata','Ambiente intimo e riservato','Ideale per occasioni speciali e aziende',3,12,4);

insert into public.menu_items (name, description, price, category, allergens, sort_order) values
('Bruschetta classica','Pane bruscato, pomodoro datterino, basilico, olio EVO',6,'Antipasti','glutine',1),
('Burrata e alici','Burrata pugliese, alici del Cantabrico, crostini',12,'Antipasti','glutine, lattosio, pesce',2),
('Tagliere Carpediem','Selezione di salumi e formaggi locali',16,'Antipasti','lattosio',3),
('Margherita','Pomodoro San Marzano, fior di latte, basilico, olio EVO',8,'Pizze Classiche','glutine, lattosio',1),
('Marinara','Pomodoro, aglio, origano, olio EVO',6.5,'Pizze Classiche','glutine',2),
('Diavola','Pomodoro, fior di latte, salame piccante',10,'Pizze Classiche','glutine, lattosio',3),
('Capricciosa','Pomodoro, mozzarella, prosciutto cotto, funghi, carciofi, olive',12,'Pizze Classiche','glutine, lattosio',4),
('Quattro formaggi','Fior di latte, gorgonzola, parmigiano, scamorza affumicata',12,'Pizze Classiche','glutine, lattosio',5),
('Carpediem','Crema di zucca, fior di latte, guanciale croccante, pecorino, pepe nero',14,'Pizze Speciali','glutine, lattosio',1),
('Mare nostrum','Pomodorino giallo, gambero rosso, stracciatella, scorza di limone',16,'Pizze Speciali','glutine, lattosio, crostacei',2),
('Tartufo nero','Fior di latte, mortadella IGP, pistacchi, tartufo nero estivo',18,'Pizze Speciali','glutine, lattosio, frutta a guscio',3),
('Verace 2024','Pomodoro del piennolo, bufala campana DOP, basilico, olio EVO Coratina',14,'Pizze Speciali','glutine, lattosio',4),
('Crocchè di patate','Tre pezzi, ripieni di provola',5,'Fritti','glutine, lattosio',1),
('Frittatine napoletane','Pasta, besciamella, prosciutto, piselli',6,'Fritti','glutine, lattosio, uova',2),
('Montanare','Pizza fritta, pomodoro, parmigiano, basilico',7,'Fritti','glutine, lattosio',3),
('Tiramisù della casa','Ricetta classica con savoiardi e mascarpone',6,'Dolci','glutine, lattosio, uova',1),
('Cannolo siciliano','Ricotta di pecora fresca, scorza d''arancia, pistacchi',6,'Dolci','glutine, lattosio, frutta a guscio',2),
('Sbriciolata di nocciole','Con gelato fior di latte',7,'Dolci','glutine, lattosio, frutta a guscio',3),
('Acqua naturale 0,75L',2.5,null,'Bevande',null,1),
('Acqua frizzante 0,75L',2.5,null,'Bevande',null,2),
('Birra Peroni 0,33L',4,null,'Bevande','glutine',3),
('Birra artigianale Maltovivo',6,null,'Bevande','glutine',4),
('Calice di vino della casa',5,null,'Bevande','solfiti',5),
('Coca Cola 0,33L',3.5,null,'Bevande',null,6),
('Caffè espresso',1.5,null,'Bevande',null,7);

-- Fix bevande rows (price/category swapped above due to ordering trick - rewrite cleanly)
delete from public.menu_items where category is null;
insert into public.menu_items (name, description, price, category, allergens, sort_order) values
('Acqua naturale 0,75L','',2.5,'Bevande',null,1),
('Acqua frizzante 0,75L','',2.5,'Bevande',null,2),
('Birra Peroni 0,33L','',4,'Bevande','glutine',3),
('Birra artigianale Maltovivo','IPA locale',6,'Bevande','glutine',4),
('Calice di vino della casa','Rosso o bianco',5,'Bevande','solfiti',5),
('Coca Cola 0,33L','',3.5,'Bevande',null,6),
('Caffè espresso','',1.5,'Bevande',null,7);

-- Reservations: today + tomorrow
do $$
declare
  z_sala uuid; z_patio uuid; z_banc uuid; z_sal uuid;
  r1 uuid; r2 uuid; r3 uuid;
begin
  select id into z_sala from public.room_zones where name='Sala principale';
  select id into z_patio from public.room_zones where name='Patio esterno';
  select id into z_banc from public.room_zones where name='Bancone pizza';
  select id into z_sal from public.room_zones where name='Saletta riservata';

  insert into public.reservations (customer_name, customer_phone, party_size, date, time, zone_id, zone_name, occasion, allergies, notes)
  values
    ('Marco Rossi','+39 333 1234567', 4, current_date, '19:30', z_patio, 'Patio esterno', null, null, 'Tavolo lato giardino se possibile') returning id into r1;
  insert into public.reservations (customer_name, customer_phone, party_size, date, time, zone_id, zone_name, occasion, allergies)
  values
    ('Giulia Bianchi','+39 347 9876543', 2, current_date, '20:00', z_banc, 'Bancone pizza', 'Anniversario', null) returning id into r2;
  insert into public.reservations (customer_name, customer_phone, party_size, date, time, zone_id, zone_name, occasion, allergies, notes)
  values
    ('Famiglia Esposito','+39 320 5544332', 5, current_date, '20:30', z_sala, 'Sala principale', null, 'lattosio (1 persona)', 'Bambini al seguito') returning id into r3;
  insert into public.reservations (customer_name, customer_phone, party_size, date, time, zone_id, zone_name, occasion)
  values
    ('Luca De Santis','+39 339 1122334', 2, current_date, '21:00', z_patio, 'Patio esterno', null),
    ('Chiara Marini','+39 345 7788990', 6, current_date, '21:30', z_sal, 'Saletta riservata', 'Compleanno'),
    ('Andrea Conti','+39 366 4455667', 3, current_date+1, '20:00', z_sala, 'Sala principale', null),
    ('Sara Fontana','+39 328 9988776', 4, current_date+1, '20:30', z_patio, 'Patio esterno', 'Proposta di matrimonio'),
    ('Paolo Greco','+39 331 2233445', 2, current_date+1, '21:00', z_banc, 'Bancone pizza', null);

  -- 3 preorders for the first 3 of today
  insert into public.preorders (reservation_id, customer_name, items, total, status) values
    (r1, 'Marco Rossi', '[{"name":"Margherita","qty":2,"price":8},{"name":"Diavola","qty":1,"price":10},{"name":"Carpediem","qty":1,"price":14},{"name":"Birra Peroni 0,33L","qty":4,"price":4}]'::jsonb, 56, 'pending'),
    (r2, 'Giulia Bianchi', '[{"name":"Burrata e alici","qty":1,"price":12},{"name":"Tartufo nero","qty":2,"price":18},{"name":"Calice di vino della casa","qty":2,"price":5}]'::jsonb, 58, 'preparing'),
    (r3, 'Famiglia Esposito', '[{"name":"Bruschetta classica","qty":2,"price":6},{"name":"Margherita","qty":3,"price":8},{"name":"Capricciosa","qty":1,"price":12},{"name":"Tiramisù della casa","qty":3,"price":6}]'::jsonb, 66, 'pending');
end$$;

-- Clients
insert into public.clients (name, phone, visit_count, last_visit, birthday, tags, allergens, notes, total_spent) values
('Marco Rossi','+39 333 1234567', 8, current_date - 7, '1985-04-12', array['VIP','Fedele'], null, 'Ama il patio. Sempre Diavola.', 420),
('Giulia Bianchi','+39 347 9876543', 5, current_date - 14, '1990-07-23', array['Coppia','Fedele'], null, 'Anniversario il 12/03', 280),
('Famiglia Esposito','+39 320 5544332', 12, current_date - 21, null, array['VIP','Famiglia','Allergie'], 'lattosio', 'Una persona intollerante al lattosio', 890),
('Luca De Santis','+39 339 1122334', 1, current_date - 90, null, array['Inattivo'], null, null, 35),
('Chiara Marini','+39 345 7788990', 3, current_date - 30, '1992-12-05', array['Compleanni'], null, null, 180);

-- Reviews
insert into public.reviews (platform, author, rating, text, date, status) values
('google','Alessandro M.', 5, 'Pizza eccezionale, impasto digeribile e ingredienti di qualità top. La Carpediem è un capolavoro. Servizio attento e ambiente curato. Tornerò sicuramente.', now() - interval '2 days', 'responded'),
('google','Maria T.', 5, 'Una delle migliori pizzerie di Pescara. Patio bellissimo d''estate. Personale gentilissimo. Provate la Mare nostrum!', now() - interval '5 days', 'responded'),
('tripadvisor','Roberto P.', 2, 'Tempi di attesa lunghissimi, oltre 40 minuti per la pizza. Cameriere distratto. La pizza era buona ma l''esperienza no.', now() - interval '1 day', 'new'),
('tripadvisor','Elena V.', 4, 'Ottima cena, locale carino. Solo un appunto: i fritti erano un po'' unti. Per il resto tutto perfetto, prezzi onesti.', now() - interval '3 days', 'new');
