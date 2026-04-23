import { supabase } from "@/integrations/supabase/client";

export type RestaurantSettings = {
  id: string;
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
};

export type RoomZone = {
  id: string;
  name: string;
  description: string | null;
  features: string | null;
  table_count: number;
  capacity: number;
  available: boolean;
  sort_order: number;
};

export type MenuItem = {
  id: string;
  name: string;
  description: string | null;
  price: number | null;
  category: string | null;
  available: boolean;
  photo_url: string | null;
  allergens: string | null;
  sort_order: number;
  updated_at: string;
};

export type Reservation = {
  id: string;
  customer_name: string;
  customer_phone: string | null;
  party_size: number;
  date: string;
  time: string;
  zone_id: string | null;
  zone_name: string | null;
  occasion: string | null;
  allergies: string | null;
  notes: string | null;
  status: string;
  preorder_link_sent: boolean;
  reminder_sent: boolean;
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

export async function getSettings(): Promise<RestaurantSettings | null> {
  const { data } = await supabase.from("restaurant_settings").select("*").limit(1).maybeSingle();
  return data as RestaurantSettings | null;
}

export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function fmtDate(s: string): string {
  const d = new Date(s + "T00:00:00");
  return d.toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" });
}

export function relTime(iso: string): string {
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "ora";
  if (diff < 3600) return `${Math.floor(diff / 60)} min fa`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} ore fa`;
  return `${Math.floor(diff / 86400)} giorni fa`;
}
