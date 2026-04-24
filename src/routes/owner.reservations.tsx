import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { isoDate, fmtDate, type Reservation } from "@/lib/restaurant";
import { toast } from "sonner";

export const Route = createFileRoute("/owner/reservations")({
  head: () => ({ meta: [{ title: "Prenotazioni — Unobuono" }] }),
  component: ReservationsPage,
});

type Waitlist = { id: string; customer_name: string; customer_phone: string | null; party_size: number; date: string; preferred_time: string | null; status: string; created_at: string };
type TableLite = { id: string; code: string; seats: number; zone_id: string | null };

function ReservationsPage() {
  const [date, setDate] = useState(isoDate(new Date()));
  const [list, setList] = useState<Reservation[]>([]);
  const [waitlist, setWaitlist] = useState<Waitlist[]>([]);
  const [tables, setTables] = useState<TableLite[]>([]);
  const [tab, setTab] = useState<"list" | "waitlist">("list");
  const [restaurantId, setRestaurantId] = useState<string | null>(null);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: rest } = await supabase.from("restaurants").select("id").eq("owner_id", user.id).maybeSingle();
    if (!rest) return;
    setRestaurantId(rest.id);
    const [{ data: r }, { data: w }, { data: t }] = await Promise.all([
      supabase.from("reservations").select("*").eq("restaurant_id", rest.id).eq("date", date).order("time"),
      supabase.from("waitlist").select("*").eq("restaurant_id", rest.id).eq("date", date).eq("status", "waiting").order("created_at"),
      supabase.from("tables").select("id,code,seats,zone_id").eq("restaurant_id", rest.id).order("code"),
    ]);
    setList((r || []) as Reservation[]);
    setWaitlist((w || []) as Waitlist[]);
    setTables((t || []) as TableLite[]);
  }

  useEffect(() => {
    load();
    const ch = supabase.channel("o-resv-" + date)
      .on("postgres_changes", { event: "*", schema: "public", table: "reservations" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "waitlist" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [date]);

  const active = useMemo(() => list.filter((r) => r.status !== "cancelled"), [list]);
  const cancelled = useMemo(() => list.filter((r) => r.status === "cancelled"), [list]);

  const totals = useMemo(() => ({
    covers: active.reduce((s, r) => s + r.party_size, 0),
    arrived: active.filter((r) => r.arrived).length,
  }), [active]);

  async function toggleArrived(r: Reservation) {
    await supabase.from("reservations").update({ arrived: !r.arrived }).eq("id", r.id);
  }
  async function cancel(id: string) {
    if (!confirm("Disdire la prenotazione? Il tavolo verrà liberato.")) return;
    const { error } = await supabase.from("reservations").update({ status: "cancelled" }).eq("id", id);
    if (error) toast.error(error.message); else toast.success("Prenotazione disdetta");
  }
  async function moveTable(reservationId: string, newTableId: string | null) {
    const { error } = await supabase.from("reservations").update({ table_id: newTableId }).eq("id", reservationId);
    if (error) toast.error(error.message); else toast.success("Tavolo aggiornato");
  }
  async function confirmWait(w: Waitlist) {
    if (!restaurantId) return;
    await supabase.from("reservations").insert({
      restaurant_id: restaurantId,
      customer_name: w.customer_name,
      customer_phone: w.customer_phone,
      party_size: w.party_size,
      date: w.date,
      time: w.preferred_time || "20:00",
    });
    await supabase.from("waitlist").update({ status: "confirmed" }).eq("id", w.id);
  }

  return (
    <div className="mx-auto max-w-5xl px-5 py-7">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl">Prenotazioni</h1>
          <p className="text-sm text-muted-foreground capitalize">{fmtDate(date)}</p>
        </div>
        <div className="flex items-center gap-3">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-lg border border-border bg-card px-3 py-2 text-sm" />
          <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs">
            <span className="font-display text-base">{totals.covers}</span>
            <span className="text-muted-foreground"> coperti · </span>
            <span className="font-display text-base text-terracotta">{totals.arrived}</span>
            <span className="text-muted-foreground"> arrivati</span>
          </div>
        </div>
      </header>

      <div className="mb-4 flex gap-2 border-b border-border">
        <Tab active={tab === "list"} onClick={() => setTab("list")}>Prenotazioni ({list.length})</Tab>
        <Tab active={tab === "waitlist"} onClick={() => setTab("waitlist")}>Lista d'attesa ({waitlist.length})</Tab>
      </div>

      {tab === "list" && (
        <>
          <ul className="space-y-2">
            {active.length === 0 && <li className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">Nessuna prenotazione.</li>}
            {active.map((r) => {
              const compatible = tables.filter((t) => t.seats >= r.party_size);
              return (
                <li key={r.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4">
                  <div className="font-display text-2xl text-terracotta">{r.time}</div>
                  <div className="min-w-0 flex-1">
                    <div className="font-display text-base">{r.customer_name} · {r.party_size} pers</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {r.zone_name}{r.customer_phone ? ` · ${r.customer_phone}` : ""}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {r.occasion && <Badge>🎂 {r.occasion}</Badge>}
                      {r.allergies && <Badge tone="warn">⚠️ {r.allergies}</Badge>}
                      {r.preorder_link_sent && <Badge>🛵 pre-ordine</Badge>}
                    </div>
                  </div>
                  <select
                    value={r.table_id ?? ""}
                    onChange={(e) => moveTable(r.id, e.target.value || null)}
                    className="rounded-md border border-border bg-background px-2 py-1.5 text-xs"
                    title="Sposta tavolo"
                  >
                    <option value="">— Nessun tavolo —</option>
                    {compatible.map((t) => (
                      <option key={t.id} value={t.id}>{t.code} ({t.seats}p)</option>
                    ))}
                  </select>
                  <button onClick={() => toggleArrived(r)} className={`rounded-md px-3 py-2 text-xs font-medium ${r.arrived ? "bg-emerald-600 text-white" : "border border-border"}`}>
                    {r.arrived ? "✓ Arrivato" : "Segna arrivato"}
                  </button>
                  <button onClick={() => cancel(r.id)} className="text-xs text-muted-foreground hover:text-destructive" title="Disdici">×</button>
                </li>
              );
            })}
          </ul>
          {cancelled.length > 0 && (
            <details className="mt-5">
              <summary className="cursor-pointer text-xs font-mono uppercase tracking-wider text-muted-foreground">Disdette ({cancelled.length})</summary>
              <ul className="mt-2 space-y-1">
                {cancelled.map((r) => (
                  <li key={r.id} className="flex items-center gap-3 rounded-lg border border-dashed border-border bg-muted/30 p-2.5 text-xs text-muted-foreground line-through">
                    <span className="font-display text-base">{r.time}</span>
                    <span>{r.customer_name} · {r.party_size}p</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}

      {tab === "waitlist" && (
        <ul className="space-y-2">
          {waitlist.length === 0 && <li className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">Nessuno in lista d'attesa.</li>}
          {waitlist.map((w) => (
            <li key={w.id} className="flex items-center gap-4 rounded-xl border border-border bg-card p-4">
              <div className="min-w-0 flex-1">
                <div className="font-display text-base">{w.customer_name} · {w.party_size} pers</div>
                <div className="text-xs text-muted-foreground">{w.customer_phone} · pref. {w.preferred_time || "—"}</div>
              </div>
              <button onClick={() => confirmWait(w)} className="rounded-md bg-terracotta px-3 py-2 text-xs font-medium text-paper">Conferma tavolo</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Tab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`relative px-4 py-2 text-sm font-medium ${active ? "text-terracotta" : "text-muted-foreground"}`}>
      {children}
      {active && <span className="absolute inset-x-0 -bottom-px h-0.5 bg-terracotta" />}
    </button>
  );
}

function Badge({ children, tone }: { children: React.ReactNode; tone?: "warn" }) {
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${tone === "warn" ? "bg-amber-500/15 text-amber-700" : "bg-terracotta/15 text-terracotta"}`}>{children}</span>;
}
