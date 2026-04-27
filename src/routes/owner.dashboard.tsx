import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { isoDate, fmtDate, relTime, getMyRestaurant, type MenuItem } from "@/lib/restaurant";

export const Route = createFileRoute("/owner/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Unobuono" }] }),
  component: DashboardPage,
});

type Activity = { id: string; ts: string; icon: string; text: string };

async function checkAndSendEmails() {
  const restaurant = await getMyRestaurant();
  if (!restaurant) return;

  const { data: settings } = await supabase
    .from("restaurant_settings")
    .select("name, reminder_24h, followup_enabled, google_maps_url")
    .eq("restaurant_id", restaurant.id)
    .maybeSingle();
  if (!settings) return;

  const origin = window.location.origin;
  const tomorrow = isoDate(new Date(Date.now() + 86400e3));
  const yesterday = isoDate(new Date(Date.now() - 86400e3));

  if (settings.reminder_24h) {
    const { data: toRemind } = await supabase
      .from("reservations")
      .select("id, customer_name, customer_email, date, time, party_size")
      .eq("restaurant_id", restaurant.id)
      .eq("date", tomorrow)
      .eq("reminder_sent", false)
      .neq("status", "cancelled")
      .not("customer_email", "is", null);

    for (const r of toRemind || []) {
      if (!r.customer_email) continue;
      try {
        const res = await fetch(`${origin}/api/public/email/booking-confirm`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            templateName: "booking-reminder",
            recipientEmail: r.customer_email,
            reservationId: r.id,
            templateData: {
              customerName: r.customer_name,
              restaurantName: settings.name,
              date: fmtDate(r.date),
              time: r.time,
              partySize: r.party_size,
            },
          }),
        });
        if (res.ok) await supabase.from("reservations").update({ reminder_sent: true }).eq("id", r.id);
      } catch {}
    }
  }

  if (settings.followup_enabled) {
    const { data: toFollowup } = await (supabase as any)
      .from("reservations")
      .select("id, customer_name, customer_email")
      .eq("restaurant_id", restaurant.id)
      .eq("date", yesterday)
      .eq("followup_sent", false)
      .eq("arrived", true)
      .not("customer_email", "is", null);

    for (const r of toFollowup || []) {
      if (!r.customer_email) continue;
      try {
        const res = await fetch(`${origin}/api/public/email/booking-confirm`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            templateName: "booking-followup",
            recipientEmail: r.customer_email,
            reservationId: r.id,
            templateData: {
              customerName: r.customer_name,
              restaurantName: settings.name,
              reviewUrl: settings.google_maps_url || undefined,
            },
          }),
        });
        if (res.ok) await (supabase as any).from("reservations").update({ followup_sent: true }).eq("id", r.id);
      } catch {}
    }
  }
}

function DashboardPage() {
  const today = isoDate(new Date());
  const [stats, setStats] = useState({ resv: 0, preo: 0, reviews: 0, waitlist: 0, occupiedTables: 0, totalTables: 0 });
  const [kitchen, setKitchen] = useState({ pending: 0, cooking: 0, ready: 0 });
  const [activity, setActivity] = useState<Activity[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);

  async function loadStats() {
    const restaurant = await getMyRestaurant();
    const restId = restaurant?.id;
    const [r, p, rv, wl, occupied, total, kpending, kcooking, kready] = await Promise.all([
      supabase.from("reservations").select("id", { count: "exact", head: true }).eq("date", today).neq("status", "cancelled"),
      supabase.from("preorders").select("id", { count: "exact", head: true }).gte("created_at", today + "T00:00:00").neq("status", "cancelled"),
      supabase.from("reviews").select("id", { count: "exact", head: true }).eq("status", "new"),
      supabase.from("waitlist").select("id", { count: "exact", head: true }).eq("status", "waiting"),
      restId
        ? supabase.from("reservations").select("id", { count: "exact", head: true }).eq("restaurant_id", restId).eq("date", today).eq("arrived", true).neq("status", "cancelled").not("table_id", "is", null)
        : Promise.resolve({ count: 0 }),
      restId
        ? supabase.from("tables").select("id", { count: "exact", head: true }).eq("restaurant_id", restId)
        : Promise.resolve({ count: 0 }),
      restId
        ? supabase.from("preorders").select("id", { count: "exact", head: true }).eq("restaurant_id", restId).gte("created_at", today + "T00:00:00").eq("course_status", "pending")
        : Promise.resolve({ count: 0 }),
      restId
        ? supabase.from("preorders").select("id", { count: "exact", head: true }).eq("restaurant_id", restId).gte("created_at", today + "T00:00:00").eq("course_status", "cooking")
        : Promise.resolve({ count: 0 }),
      restId
        ? supabase.from("preorders").select("id", { count: "exact", head: true }).eq("restaurant_id", restId).gte("created_at", today + "T00:00:00").eq("course_status", "ready")
        : Promise.resolve({ count: 0 }),
    ]);
    setStats({ resv: r.count || 0, preo: p.count || 0, reviews: rv.count || 0, waitlist: wl.count || 0, occupiedTables: (occupied as any).count || 0, totalTables: (total as any).count || 0 });
    setKitchen({ pending: (kpending as any).count || 0, cooking: (kcooking as any).count || 0, ready: (kready as any).count || 0 });
  }

  useEffect(() => {
    loadStats();
    checkAndSendEmails().catch(() => {});
    supabase.from("menu_items").select("*").order("category").order("sort_order").then(({ data }) => setItems((data || []) as MenuItem[]));

    const push = (a: Activity) => setActivity((prev) => [a, ...prev].slice(0, 20));

    // Suffisso univoco per evitare conflitti di canali (StrictMode / più tab)
    const uid = Math.random().toString(36).slice(2, 8);

    const channels = [
      supabase.channel(`d-resv-${uid}`).on("postgres_changes", { event: "*", schema: "public", table: "reservations" }, (p) => {
        const r = (p.new || p.old) as any;
        if (p.eventType === "INSERT") {
          push({ id: r.id, ts: r.created_at, icon: "📅", text: `Nuova prenotazione: ${r.customer_name} per ${r.party_size} alle ${r.time}` });
        } else if (p.eventType === "UPDATE" && r.status === "cancelled") {
          push({ id: r.id + "c", ts: new Date().toISOString(), icon: "❌", text: `Disdetta: ${r.customer_name} (${r.party_size}p alle ${r.time})` });
        }
        loadStats();
      }).subscribe(),
      supabase.channel(`d-pre-${uid}`).on("postgres_changes", { event: "*", schema: "public", table: "preorders" }, (p) => {
        const r = (p.new || p.old) as any;
        if (p.eventType === "INSERT") {
          const items = Array.isArray(r.items) ? r.items.slice(0, 2).map((i: any) => `${i.qty}× ${i.name}`).join(", ") : "";
          push({ id: r.id, ts: r.created_at, icon: "🛵", text: `Pre-ordine da ${r.customer_name}: ${items}…` });
        }
        loadStats();
      }).subscribe(),
      supabase.channel(`d-call-${uid}`).on("postgres_changes", { event: "INSERT", schema: "public", table: "waiter_calls" }, (p) => {
        const r = p.new as any;
        push({ id: r.id, ts: r.created_at, icon: "🔔", text: `Tavolo ${r.table_number}: ${r.message}` });
      }).subscribe(),
      supabase.channel(`d-rev-${uid}`).on("postgres_changes", { event: "INSERT", schema: "public", table: "reviews" }, (p) => {
        const r = p.new as any;
        push({ id: r.id, ts: r.date || r.created_at, icon: "⭐", text: `Nuova recensione ${r.rating}★ da ${r.author}` });
        loadStats();
      }).subscribe(),
      supabase.channel(`d-menu-${uid}`).on("postgres_changes", { event: "UPDATE", schema: "public", table: "menu_items" }, (p) => {
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
    <div className="mx-auto w-full max-w-6xl overflow-x-hidden px-3 py-4 md:px-5 md:py-7">
      <header className="mb-4 md:mb-6">
        <h1 className="font-display text-2xl md:text-3xl">Dashboard</h1>
        <p className="text-xs text-muted-foreground md:text-sm">Tutto quello che succede stasera, in tempo reale.</p>
      </header>

      <section className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-4">
        <StatLink to="/owner/reservations" icon="📅" label="Prenotazioni oggi" value={stats.resv} />
        <StatLink to="/owner/reservations" icon="🛵" label="Pre-ordini" value={stats.preo} />
        <StatLink to="/owner/reviews" icon="⭐" label="Recensioni nuove" value={stats.reviews} alert={stats.reviews > 0} />
        <StatLink to="/owner/reservations" icon="⏳" label="Lista d'attesa" value={stats.waitlist} />
      </section>

      {/* Sala Live — accesso rapido */}
      <Link
        to="/owner/reservations"
        className="mt-3 flex items-center justify-between gap-4 rounded-2xl border-2 border-ink bg-ink px-5 py-4 text-paper transition hover:bg-ink/90 md:mt-4"
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">🍽️</span>
          <div>
            <p className="font-display text-lg leading-tight text-yellow">Sala Live</p>
            <p className="text-xs text-paper/60">Tavoli, ordini e conti in tempo reale</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="font-display text-2xl text-yellow">{stats.occupiedTables}<span className="text-base text-paper/50">/{stats.totalTables}</span></p>
            <p className="text-[10px] uppercase tracking-wider text-paper/50">tavoli occupati</p>
          </div>
          <span className="font-mono text-sm text-paper/40">→</span>
        </div>
      </Link>

      {/* Cucina — KDS */}
      <Link
        to="/kitchen"
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 flex items-center justify-between gap-4 rounded-2xl border-2 border-terracotta bg-terracotta px-5 py-4 text-paper transition hover:bg-terracotta/90"
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">👨‍🍳</span>
          <div>
            <p className="font-display text-lg leading-tight">Cucina (KDS)</p>
            <p className="text-xs text-paper/80">Apri il display di cucina in una nuova scheda</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden gap-3 sm:flex">
            <KitchenChip label="Da fare" value={kitchen.pending} />
            <KitchenChip label="In cottura" value={kitchen.cooking} />
            <KitchenChip label="Pronti" value={kitchen.ready} highlight={kitchen.ready > 0} />
          </div>
          <span className="font-mono text-sm text-paper/70">↗</span>
        </div>
      </Link>

      <div className="mt-4 grid gap-3 md:mt-7 md:gap-5 lg:grid-cols-3">
        <section className="min-w-0 rounded-2xl border border-border bg-card p-3 md:p-5 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="truncate font-display text-base md:text-xl">Attività in tempo reale</h2>
            <Link to="/owner/reservations" className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-terracotta hover:underline">
              Vedi tutto →
            </Link>
          </div>
          {activity.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">In attesa di nuovi eventi...</p>
          ) : (
            <ul className="space-y-2">
              {activity.map((a) => (
                <li key={a.id} className="flex min-w-0 items-start gap-2 rounded-lg border border-border/60 bg-background/40 px-2 py-2 slide-in-right md:gap-3 md:px-3">
                  <span className="shrink-0 text-base leading-tight">{a.icon}</span>
                  <span className="min-w-0 flex-1 break-words text-[12px] leading-snug md:text-sm">{a.text}</span>
                  <span className="shrink-0 text-[10px] text-muted-foreground md:text-xs">{relTime(a.ts)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="min-w-0 rounded-2xl border border-border bg-card p-3 md:p-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="truncate font-display text-base md:text-xl">Menu — disponibilità</h2>
            <Link to="/owner/menu" className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-terracotta hover:underline">
              Modifica →
            </Link>
          </div>
          <ul className="max-h-[40vh] space-y-1 overflow-y-auto pr-1 md:max-h-[60vh]">
            {items.map((it) => (
              <li key={it.id} className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-cream-dark/50">
                <span className={`min-w-0 flex-1 truncate text-sm ${!it.available ? "text-muted-foreground line-through" : ""}`}>{it.name}</span>
                <button onClick={() => toggleItem(it)} className={`relative h-5 w-9 shrink-0 rounded-full transition ${it.available ? "bg-terracotta" : "bg-border"}`}>
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
      className="block min-w-0 rounded-2xl border border-border bg-card p-3 transition hover:border-terracotta hover:shadow-md md:p-5"
    >
      <div className="text-lg md:text-2xl">{icon}</div>
      <div className="mt-1 font-display text-xl leading-tight md:mt-2 md:text-3xl">
        {value}
        {alert && value > 0 && <span className="ml-2 inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-destructive align-middle" />}
      </div>
      <div className="mt-1 truncate text-[10px] uppercase tracking-wider text-muted-foreground md:text-xs">{label}</div>
    </Link>
  );
}

function KitchenChip({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`min-w-[60px] rounded-lg px-2.5 py-1 text-center ${highlight ? "bg-yellow text-ink" : "bg-paper/15 text-paper"}`}>
      <p className="font-display text-lg leading-none">{value}</p>
      <p className="mt-0.5 text-[9px] font-bold uppercase tracking-wider opacity-80">{label}</p>
    </div>
  );
}
