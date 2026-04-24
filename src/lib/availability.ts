import { supabase } from "@/integrations/supabase/client";

export type SlotInfo = { slot: string; bookable: boolean; freeTables: number };
export type TableRow = { id: string; code: string; seats: number; zone_id: string | null };
export type ReservationLite = { id: string; time: string; party_size: number; table_id: string | null; status: string | null };

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

function parseRanges(raw: string | undefined): Array<[number, number]> {
  if (!raw || raw === "closed") return [];
  return String(raw)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((range) => {
      const [start, end] = range.split("-").map((s) => s.trim());
      if (!start || !end) return null;
      const [sh, sm] = start.split(":").map(Number);
      const [eh, em] = end.split(":").map(Number);
      if ([sh, eh].some((n) => Number.isNaN(n))) return null;
      return [sh * 60 + (sm || 0), eh * 60 + (em || 0)] as [number, number];
    })
    .filter((x): x is [number, number] => !!x);
}

export function generateSlots(openingHours: Record<string, string> | null | undefined, dateIso: string, avgDuration = 90, stepMin = 30): string[] {
  if (!openingHours) return [];
  const d = new Date(dateIso + "T00:00:00");
  const ranges = parseRanges(openingHours[DAY_KEYS[d.getDay()]]);
  const out: string[] = [];
  for (const [start, end] of ranges) {
    let cur = start;
    const last = end - avgDuration;
    while (cur <= last) {
      out.push(`${String(Math.floor(cur / 60)).padStart(2, "0")}:${String(cur % 60).padStart(2, "0")}`);
      cur += stepMin;
    }
  }
  return out;
}

function timeToMin(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

/** Two reservations conflict if their windows overlap (avgDuration each). */
function overlaps(slotA: string, slotB: string, avgDuration: number): boolean {
  const a = timeToMin(slotA);
  const b = timeToMin(slotB);
  return Math.abs(a - b) < avgDuration;
}

/**
 * For each slot, returns whether at least one table can host party_size,
 * considering already-booked tables in that overlapping window.
 */
export function computeAvailability(
  slots: string[],
  tables: TableRow[],
  reservations: ReservationLite[],
  partySize: number,
  avgDuration = 90,
  zoneId: string | null = null,
): SlotInfo[] {
  const candidateTables = tables.filter((t) => t.seats >= partySize && (zoneId == null || t.zone_id === zoneId));
  const activeRes = reservations.filter((r) => r.status !== "cancelled" && r.table_id);

  return slots.map((slot) => {
    const occupied = new Set(activeRes.filter((r) => overlaps(r.time, slot, avgDuration)).map((r) => r.table_id!));
    const free = candidateTables.filter((t) => !occupied.has(t.id));
    return { slot, freeTables: free.length, bookable: free.length > 0 };
  });
}

/** Pick the smallest table that fits, preferring requested zone. */
export function pickTable(
  tables: TableRow[],
  reservations: ReservationLite[],
  slot: string,
  partySize: number,
  avgDuration = 90,
  zoneId: string | null = null,
): TableRow | null {
  const activeRes = reservations.filter((r) => r.status !== "cancelled" && r.table_id);
  const occupied = new Set(activeRes.filter((r) => overlaps(r.time, slot, avgDuration)).map((r) => r.table_id!));
  const candidates = tables
    .filter((t) => t.seats >= partySize && !occupied.has(t.id))
    .sort((a, b) => {
      // Prefer requested zone first, then smallest fit
      const zScore = (t: TableRow) => (zoneId && t.zone_id === zoneId ? 0 : 1);
      return zScore(a) - zScore(b) || a.seats - b.seats;
    });
  return candidates[0] ?? null;
}

export async function loadDayContext(restaurantId: string, dateIso: string) {
  const [{ data: tables }, { data: reservations }] = await Promise.all([
    supabase.from("tables").select("id,code,seats,zone_id").eq("restaurant_id", restaurantId).order("seats"),
    supabase
      .from("reservations")
      .select("id,time,party_size,table_id,status")
      .eq("restaurant_id", restaurantId)
      .eq("date", dateIso)
      .neq("status", "cancelled"),
  ]);
  return {
    tables: (tables || []) as TableRow[],
    reservations: (reservations || []) as ReservationLite[],
  };
}
