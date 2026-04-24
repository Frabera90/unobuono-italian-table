import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { isoDate, relTime, type MenuItem } from "@/lib/restaurant";

export const Route = createFileRoute("/owner/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Unobuono" }] }),
  component: DashboardPage,
});

type Activity = { id: string; ts: string; icon: string; text: string };

function DashboardPage() {
  const today = isoDate(new Date());
  const [stats, setStats] = useState({ resv: 0, preo: 0, reviews: 0, waitlist: 0 });
  const [activity, setActivity] = useState<Activity[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);

  async function loadStats() {
    const [r, p, rv, wl] = await Promise.all([
      // Solo prenotazioni NON cancellate per oggi
      supabase.from("reservations").select("id", { count: "exact", head: true }).eq("date", today).neq("status", "cancelled"),
      supabase.from("preorders").select("id", { count: "exact", head: true }).gte("created_at", today + "T00:00:00").neq("status", "cancelled"),
      supabase.from("reviews").select("id", { count: "exact", head: true }).eq("status", "new"),
      supabase.from("waitlist").select("id", { count: "exact", head: true }).eq("status", "waiting"),
    ]);
    setStats({ resv: r.count || 0, preo: p.count || 0, reviews: rv.count || 0, waitlist: wl.count || 0 });
  }

  useEffect(() => {
    loadStats();
    supabase.from("menu_items").select("*").order("category").order("sort_order").then(({ data }) => setItems((data || []) as MenuItem[]));

    const push = (a: Activity) => setActivity((prev) => [a, ...prev].slice(0, 20));

    const channels = [
      supabase.channel("d-resv").on("postgres_changes", { event: "*", schema: "public", table: "reservations" }, (p) => {
        const r = (p.new || p.old) as any;
        if (p.eventType === "INSERT") {
          push({ id: r.id, ts: r.created_at, icon: "📅", text: `Nuova prenotazione: ${r.customer_name} per ${r.party_size} alle ${r.time}` });
        } else if (p.eventType === "UPDATE" && r.status === "cancelled") {
          push({ id: r.id + "c", ts: new Date().toISOString(), icon: "❌", text: `Disdetta: ${r.customer_name} (${r.party_size}p alle ${r.time})` });
        }
        loadStats();
      }).subscribe(),
      supabase.channel("d-pre").on("postgres_changes", { event: "*", schema: "public", table: "preorders" }, (p) => {
        const r = (p.new || p.old) as any;
        if (p.eventType === "INSERT") {
          const items = Array.isArray(r.items) ? r.items.slice(0, 2).map((i: any) => `${i.qty}× ${i.name}`).join(", ") : "";
          push({ id: r.id, ts: r.created_at, icon: "🛵", text: `Pre-ordine da ${r.customer_name}: ${items}…` });
        }
        loadStats();
      }).subscribe(),
      supabase.channel("d-call").on("postgres_changes", { event: "INSERT", schema: "public", table: "waiter_calls" }, (p) => {
        const r = p.new as any;
        push({ id: r.id, ts: r.created_at, icon: "🔔", text: `Tavolo ${r.table_number}: ${r.message}` });
      }).subscribe(),
      supabase.channel("d-rev").on("postgres_changes", { event: "INSERT", schema: "public", table: "reviews" }, (p) => {
        const r = p.new as any;
        push({ id: r.id, ts: r.date || r.created_at, icon: "⭐", text: `Nuova recensione ${r.rating}★ da ${r.author}` });
        loadStats();
      }).subscribe(),
      supabase.channel("d-menu").on("postgres_changes", { event: "UPDATE", schema: "public", table: "menu_items" }, (p) => {
        const r = p.new as any;
        push({ id: r.id + r.updated_at, ts: r.updated_at, icon: "📋", text: `Menu aggiornato: ${r.name}` });
        setItems((prev) => prev.map((x) => x.id === r.id ? r : x));
      }).subscribe(),
    ];
    return () => { channels.forEach((c) => supabase.removeChannel(c)); };
  }, [today]);

  async function toggleItem(it: MenuItem) {
    setItems((prev) => prev.map((x) => x.id === it.id ? { ...x, available: !x.available } : x));
    await supabase.from("menu_items").update({ available: !it.available, updated_at: new Date().toISOString() }).eq("id", it.id);
  }

  return (
    <div className="mx-auto max-w-6xl px-5 py-7">
      <header className="mb-6">
        <h1 className="font-display text-3xl">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Tutto quello che succede stasera, in tempo reale.</p>
      </header>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatLink to="/owner/reservations" icon="📅" label="Prenotazioni oggi" value={stats.resv} />
        <StatLink to="/owner/reservations" icon="🛵" label="Pre-ordini" value={stats.preo} />
        <StatLink to="/owner/reviews" icon="⭐" label="Recensioni nuove" value={stats.reviews} alert={stats.reviews > 0} />
        <StatLink to="/owner/reservations" icon="⏳" label="Lista d'attesa" value={stats.waitlist} />
      </section>

      <div className="mt-7 grid gap-5 lg:grid-cols-3">
        <section className="lg:col-span-2 rounded-2xl border border-border bg-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-xl">Attività in tempo reale</h2>
            <Link to="/owner/reservations" className="font-mono text-[10px] uppercase tracking-wider text-terracotta hover:underline">
              Vedi tutto →
            </Link>
          </div>
          {activity.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">In attesa di nuovi eventi...</p>
          ) : (
            <ul className="space-y-2">
              {activity.map((a) => (
                <li key={a.id} className="flex items-start gap-3 rounded-lg border border-border/60 bg-background/40 px-3 py-2 text-sm slide-in-right">
                  <span className="text-base">{a.icon}</span>
                  <span className="flex-1">{a.text}</span>
                  <span className="text-xs text-muted-foreground">{relTime(a.ts)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-border bg-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-xl">Menu — disponibilità</h2>
            <Link to="/owner/menu" className="font-mono text-[10px] uppercase tracking-wider text-terracotta hover:underline">
              Modifica →
            </Link>
          </div>
          <ul className="max-h-[60vh] space-y-1 overflow-y-auto pr-1">
            {items.map((it) => (
              <li key={it.id} className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 hover:bg-cream-dark/50">
                <span className={`min-w-0 flex-1 truncate text-sm ${!it.available ? "text-muted-foreground line-through" : ""}`}>{it.name}</span>
                <button onClick={() => toggleItem(it)} className={`relative h-5 w-9 rounded-full transition ${it.available ? "bg-terracotta" : "bg-border"}`}>
                  <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-paper transition ${it.available ? "left-[18px]" : "left-0.5"}`} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

function StatLink({ to, icon, label, value, alert }: { to: string; icon: string; label: string; value: number; alert?: boolean }) {
  return (
    <Link
      to={to}
      className="block rounded-2xl border border-border bg-card p-5 transition hover:border-terracotta hover:shadow-md"
    >
      <div className="text-2xl">{icon}</div>
      <div className="mt-2 font-display text-3xl">
        {value}
        {alert && value > 0 && <span className="ml-2 inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-destructive align-middle" />}
      </div>
      <div className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
    </Link>
  );
}
