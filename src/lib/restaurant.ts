import { supabase } from "@/integrations/supabase/client";

export type Restaurant = {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  onboarding_complete: boolean;
};

export type RestaurantSettings = {
  id: string;
  restaurant_id: string;
  name: string;
  address: string;
  phone: string;
  opening_hours: Record<string, string>;
  max_covers: number;
  avg_table_duration: number;
  bio: string;
  tone: string;
  instagram_handle: string;
  facebook_handle: string;
  tiktok_handle: string | null;
  ask_occasion: boolean;
  ask_allergies: boolean;
  waitlist_enabled: boolean;
  preorder_hours_before: number;
  reminder_24h: boolean;
  followup_enabled: boolean;
  cover_photo_url: string | null;
  logo_url: string | null;
  pets_allowed?: boolean | null;
  wheelchair_accessible?: boolean | null;
  parking_available?: boolean | null;
  kid_friendly?: boolean | null;
  min_age?: number | null;
  good_to_know?: string | null;
  google_maps_url?: string | null;
  delivery_enabled?: boolean | null;
  delivery_just_eat_url?: string | null;
  delivery_deliveroo_url?: string | null;
  delivery_glovo_url?: string | null;
  delivery_other_url?: string | null;
  delivery_other_label?: string | null;
};

export type RoomZone = {
  id: string;
  restaurant_id: string;
  name: string;
  description: string | null;
  features: string | null;
  preferences: string | null;
  table_count: number;
  capacity: number;
  available: boolean;
  sort_order: number;
};

export type MenuItem = {
  id: string;
  restaurant_id: string;
  name: string;
  description: string | null;
  price: number | null;
  category: string | null;
  available: boolean;
  photo_url: string | null;
  allergens: string | null;
  allergen_tags?: string[] | null;
  diet_tags?: string[] | null;
  sort_order: number;
  updated_at: string;
  featured?: boolean | null;
};

export type Reservation = {
  id: string;
  restaurant_id: string;
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  party_size: number;
  date: string;
  time: string;
  zone_id: string | null;
  zone_name: string | null;
  table_id: string | null;
  occasion: string | null;
  occasion_type: string | null;
  preferences: string[] | null;
  allergies: string | null;
  notes: string | null;
  status: string;
  source: string | null;
  preorder_link_sent: boolean;
  reminder_sent: boolean;
  followup_sent?: boolean;
  arrived: boolean;
  created_at: string;
};

export const TIME_SLOTS = ["19:00", "19:30", "20:00", "20:30", "21:00", "21:30", "22:00"];
export const LUNCH_SLOTS = ["12:00", "12:30", "13:00", "13:30", "14:00"];

export function dayKey(d: Date): string {
  const days = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  return days[d.getDay()];
}

export function isClosed(settings: RestaurantSettings | null, d: Date): boolean {
  if (!settings) return false;
  const v = settings.opening_hours?.[dayKey(d)];
  return !v || v === "closed";
}

/** Restaurant of the currently logged-in owner */
export async function getMyRestaurant(): Promise<Restaurant | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("restaurants").select("*").eq("owner_id", user.id).maybeSingle();
  return data as Restaurant | null;
}

/** Settings of the currently logged-in owner's restaurant */
export async function getMySettings(): Promise<RestaurantSettings | null> {
  const r = await getMyRestaurant();
  if (!r) return null;
  const { data } = await supabase.from("restaurant_settings").select("*").eq("restaurant_id", r.id).maybeSingle();
  return data as RestaurantSettings | null;
}

/** Public: settings by slug */
export async function getSettingsBySlug(slug: string): Promise<{ restaurant: Restaurant; settings: RestaurantSettings | null } | null> {
  const { data: r } = await supabase.from("restaurants").select("*").eq("slug", slug).maybeSingle();
  if (!r) return null;
  const { data: s } = await supabase.from("restaurant_settings").select("*").eq("restaurant_id", r.id).maybeSingle();
  return { restaurant: r as Restaurant, settings: (s as RestaurantSettings | null) };
}

/** Public: settings by restaurant id (used in booking page) */
export async function getSettingsByRestaurantId(restaurantId: string): Promise<RestaurantSettings | null> {
  const { data } = await supabase.from("restaurant_settings").select("*").eq("restaurant_id", restaurantId).maybeSingle();
  return data as RestaurantSettings | null;
}

/** @deprecated kept for compatibility — returns owner's settings */
export async function getSettings(): Promise<RestaurantSettings | null> {
  return getMySettings();
}

/** Data ISO (YYYY-MM-DD) calcolata sul fuso LOCALE — evita shift UTC. */
export function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

/** Parse "YYYY-MM-DD" come Date locale a mezzanotte (no UTC shift). */
export function parseLocalDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function fmtDate(s: string): string {
  return parseLocalDate(s).toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" });
}

export function fmtDateShort(s: string): string {
  return parseLocalDate(s).toLocaleDateString("it-IT", { day: "2-digit", month: "short" });
}

export function relTime(iso: string): string {
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "ora";
  if (diff < 3600) return `${Math.floor(diff / 60)} min fa`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} ore fa`;
  return `${Math.floor(diff / 86400)} giorni fa`;
}
