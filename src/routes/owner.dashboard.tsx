import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { isoDate, fmtDate, relTime, getMyRestaurant, type MenuItem } from "@/lib/restaurant";
import { toast } from "sonner";

export const Route = createFileRoute("/owner/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Unobuono" }] }),
  component: DashboardPage,
});

// ── Types ────────────────────────────────────────────────────────────────────

type Activity = { id: string; ts: string; icon: string; text: string };

type OrderItem = { name: string; qty: number; price?: number; notes?: string };

type ActiveResv = {
  id: string;
  customer_name: string;
  customer_phone: string | null;
  party_size: number;
  time: string;
  arrived: boolean;
  status: string | null;
  table_id: string | null;
  zone_name: string | null;
  tableCode: string | null;
  preorder: {
    id: string;
    items: OrderItem[];
    total: number | null;
    course_status: string;
    bill_requested: boolean;
  } | null;
};

type CardState = "bill" | "ready" | "cooking" | "ordered" | "seated" | "incoming";

function getCardState(r: ActiveResv): CardState {
  if (r.preorder?.bill_requested) return "bill";
  const cs = r.preorder?.course_status;
  if (cs === "ready") return "ready";
  if (cs === "cooking") return "cooking";
  if (r.preorder) return "ordered";
  if (r.arrived) return "seated";
  return "incoming";
}

const CARD_CFG: Record<CardState, { label: string; border: string; badge: string }> = {
  bill:     { label: "Conto",     border: "border-red-400/80 bg-red-900/10",        badge: "bg-red-500/20 text-red-300" },
  ready:    { label: "Pronto ✓",  border: "border-emerald-400 bg-emerald-900/10",   badge: "bg-emerald-500/20 text-emerald-300" },
  cooking:  { label: "In cucina", border: "border-yellow/70 bg-yellow/5",           badge: "bg-yellow/20 text-yellow" },
  ordered:  { label: "Ordinato",  border: "border-sky-400/40 bg-sky-900/5",         badge: "bg-sky-500/15 text-sky-300" },
  seated:   { label: "Al tavolo", border: "border-border bg-card",                  badge: "bg-muted text-muted-foreground" },
  incoming: { label: "In arrivo", border: "border-border/40 bg-transparent",        badge: "bg-muted/40 text-muted-foreground/60" },
};

// ── Email helpers ────────────────────────────────────────────────────────────

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
            templateData: { customerName: r.customer_name, restaurantName: settings.name, date: fmtDate(r.date), time: r.time, partySize: r.party_size },
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
            templateData: { customerName: r.customer_name, restaurantName: settings.name, reviewUrl: settings.google_maps_url || undefined },
          }),
        });
        if (res.ok) await (supabase as any).from("reservations").update({ followup_sent: true }).eq("id", r.id);
      } catch {}
    }
  }
}

// ── Dashboard ────────────────────────────────────────────────────────────────

function DashboardPage() {
  const today = isoDate(new Date());
  const [stats, setStats] = useState({ resv: 0, preo: 0, reviews: 0, waitlist: 0 });
  const [sala, setSala] = useState<ActiveResv[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [closingId, setClosingId] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const [restId, setRestId] = useState<string | null>(null);

  async function loadStats() {
    const restaurant = await getMyRestaurant();
    if (restaurant && !restId) setRestId(restaurant.id);
    const [r, p, rv, wl] = await Promise.all([
      supabase.from("reservations").select("id", { count: "exact", head: true }).eq("date", today).neq("status", "cancelled"),
      supabase.from("preorders").select("id", { count: "exact", head: true }).gte("created_at", today + "T00:00:00").neq("status", "cancelled"),
      supabase.from("reviews").select("id", { count: "exact", head: true }).eq("status", "new"),
      supabase.from("waitlist").select("id", { count: "exact", head: true }).eq("status", "waiting"),
    ]);
    setStats({ resv: r.count || 0, preo: p.count || 0, reviews: rv.count || 0, waitlist: wl.count || 0 });
  }

  async function loadSala() {
    const restaurant = await getMyRestaurant();
    if (!restaurant) return;
    if (!restId) setRestId(restaurant.id);

    const [{ data: resvData }, { data: preData }, { data: tableData }] = await Promise.all([
      supabase.from("reservations")
        .select("id,customer_name,customer_phone,party_size,time,arrived,status,table_id,zone_name")
        .eq("restaurant_id", restaurant.id)
        .eq("date", today)
        .neq("status", "cancelled")
        .neq("status", "completed")
        .order("time"),
      supabase.from("preorders")
        .select("id,reservation_id,items,total,course_status,status")
        .eq("restaurant_id", restaurant.id)
        .gte("created_at", today + "T00:00:00"),
      supabase.from("tables")
        .select("id,code")
        .eq("restaurant_id", restaurant.id),
    ]);

    const preMap = new Map((preData || []).map((p: any) => [p.reservation_id, p]));
    const tableMap = new Map((tableData || []).map((t: any) => [t.id, t.code as string]));

    setSala((resvData || []).map((r: any): ActiveResv => {
      const pre = preMap.get(r.id) as any;
      return {
        id: r.id,
        customer_name: r.customer_name,
        customer_phone: r.customer_phone,
        party_size: r.party_size,
        time: r.time,
        arrived: r.arrived,
        status: r.status,
        table_id: r.table_id,
        zone_name: r.zone_name,
        tableCode: r.table_id ? (tableMap.get(r.table_id) ?? null) : null,
        preorder: pre ? {
          id: pre.id,
          items: Array.isArray(pre.items) ? pre.items : [],
          total: pre.total,
          course_status: pre.course_status || "pending",
          bill_requested: pre.status === "bill_requested",
        } : null,
      };
    }));
  }

  async function closeTable(resv: ActiveResv) {
    const rid = restId;
    if (!rid) return;
    setClosing(true);
    try {
      const orderTotal = resv.preorder?.total ?? 0;

      if (resv.customer_phone) {
        const { data: existing } = await supabase.from("clients")
          .select("id,visit_count,total_spent")
          .eq("restaurant_id", rid)
          .eq("phone", resv.customer_phone)
          .maybeSingle();

        if (existing) {
          await supabase.from("clients").update({
            visit_count: (existing.visit_count || 0) + 1,
            total_spent: (existing.total_spent || 0) + orderTotal,
            last_visit: today,
          }).eq("id", existing.id);
        } else {
          await supabase.from("clients").insert({
            restaurant_id: rid,
            name: resv.customer_name,
            phone: resv.customer_phone,
            visit_count: 1,
            total_spent: orderTotal || null,
            last_visit: today,
          });
        }
      }

      await supabase.from("reservations").update({ status: "completed" }).eq("id", resv.id);

      toast.success(`${resv.customer_name} — tavolo chiuso ✓`);
      setClosingId(null);
    } catch (err: any) {
      toast.error(err.message || "Errore chiusura tavolo");
    } finally {
      setClosing(false);
    }
  }

  useEffect(() => {
    loadStats();
    loadSala();
    checkAndSendEmails().catch(() => {});
    supabase.from("menu_items").select("*").order("category").order("sort_order")
      .then(({ data }) => setItems((data || []) as MenuItem[]));

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
        loadSala();
      }).subscribe(),
      supabase.channel(`d-pre-${uid}`).on("postgres_changes", { event: "*", schema: "public", table: "preorders" }, (p) => {
        const r = (p.new || p.old) as any;
        if (p.eventType === "INSERT") {
          const itms = Array.isArray(r.items) ? r.items.slice(0, 2).map((i: any) => `${i.qty}× ${i.name}`).join(", ") : "";
          push({ id: r.id, ts: r.created_at, icon: "🍽️", text: `Ordine da ${r.customer_name}: ${itms}…` });
        } else if (p.eventType === "UPDATE" && r.course_status === "ready") {
          push({ id: r.id + "r", ts: new Date().toISOString(), icon: "✅", text: `Pronto — ${r.customer_name}` });
        }
        loadStats();
        loadSala();
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today]);

  async function toggleItem(it: MenuItem) {
    setItems((prev) => prev.map((x) => x.id === it.id ? { ...x, available: !x.available } : x));
    await supabase.from("menu_items").update({ available: !it.available, updated_at: new Date().toISOString() }).eq("id", it.id);
  }

  // Ordina le card per urgenza: bill > ready > cooking > ordered > seated > incoming, poi per orario
  const PRIORITY: Record<CardState, number> = { bill: 0, ready: 1, cooking: 2, ordered: 3, seated: 4, incoming: 5 };
  const sortedSala = [...sala].sort((a, b) => {
    const pa = PRIORITY[getCardState(a)];
    const pb = PRIORITY[getCardState(b)];
    if (pa !== pb) return pa - pb;
    return a.time.localeCompare(b.time);
  });

  const arrivedCount = sala.filter((r) => r.arrived).length;
  const urgentCount = sala.filter((r) => { const s = getCardState(r); return s === "bill" || s === "ready"; }).length;

  return (
    <div className="mx-auto w-full max-w-6xl overflow-x-hidden px-3 py-4 md:px-5 md:py-7">
      <header className="mb-4 md:mb-6">
        <h1 className="font-display text-2xl md:text-3xl">Dashboard</h1>
        <p className="text-xs text-muted-foreground md:text-sm">Tutto quello che succede stasera, in tempo reale.</p>
      </header>

      {/* Stats compatte */}
      <section className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-4">
        <StatCard icon="📅" label="Prenotazioni oggi" value={stats.resv} to="/owner/reservations" />
        <StatCard icon="🍽️" label="Ordini attivi" value={stats.preo} to="/owner/reservations" />
        <StatCard icon="⭐" label="Recensioni nuove" value={stats.reviews} alert={stats.reviews > 0} />
        <StatCard icon="⏳" label="Lista d'attesa" value={stats.waitlist} />
      </section>

      {/* ── SALA LIVE ──────────────────────────────────────────────────── */}
      <section className="mt-4 md:mt-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <h2 className="font-display text-xl md:text-2xl">Sala Live</h2>
            <span className="rounded-full border border-border px-2.5 py-0.5 font-mono text-xs text-muted-foreground">
              {arrivedCount} al tavolo
            </span>
            {urgentCount > 0 && (
              <span className="rounded-full bg-red-500/20 px-2.5 py-0.5 font-mono text-xs text-red-400 animate-pulse">
                {urgentCount} urgenti
              </span>
            )}
          </div>
          <Link to="/owner/reservations" className="font-mono text-[10px] uppercase tracking-wider text-terracotta hover:underline">
            Lista completa →
          </Link>
        </div>

        {sortedSala.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Nessuna prenotazione per oggi.
          </p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {sortedSala.map((resv) => (
              <TableCard
                key={resv.id}
                resv={resv}
                isClosing={closingId === resv.id}
                closingBusy={closing}
                onRequestClose={() => setClosingId(resv.id)}
                onConfirmClose={() => closeTable(resv)}
                onCancelClose={() => setClosingId(null)}
              />
            ))}
          </div>
        )}
      </section>

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

// ── TableCard ────────────────────────────────────────────────────────────────

function TableCard({ resv, isClosing, closingBusy, onRequestClose, onConfirmClose, onCancelClose }: {
  resv: ActiveResv;
  isClosing: boolean;
  closingBusy: boolean;
  onRequestClose: () => void;
  onConfirmClose: () => void;
  onCancelClose: () => void;
}) {
  const state = getCardState(resv);
  const cfg = CARD_CFG[state];
  const isIncoming = state === "incoming";
  const canClose = !isIncoming && resv.arrived;

  return (
    <div className={`rounded-xl border-2 p-3 transition ${cfg.border} ${isIncoming ? "opacity-60" : ""}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-base leading-tight">{resv.customer_name}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {resv.time}
            {" · "}{resv.party_size}p
            {resv.tableCode && <span className="ml-1 font-mono">· {resv.tableCode}</span>}
          </p>
          {resv.zone_name && !resv.tableCode && (
            <p className="text-[10px] text-muted-foreground/70">{resv.zone_name}</p>
          )}
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${cfg.badge}`}>
          {cfg.label}
        </span>
      </div>

      {/* Ordine */}
      {resv.preorder && resv.preorder.items.length > 0 && (
        <ul className="mt-2 space-y-0.5 border-t border-current/10 pt-2 text-xs text-muted-foreground">
          {resv.preorder.items.slice(0, 4).map((it, i) => (
            <li key={i} className="flex items-baseline gap-1">
              <span className="font-mono text-[10px]">{it.qty}×</span>
              <span className="truncate">{it.name}</span>
            </li>
          ))}
          {resv.preorder.items.length > 4 && (
            <li className="text-[10px] opacity-60">+{resv.preorder.items.length - 4} altri</li>
          )}
        </ul>
      )}

      {/* Footer */}
      <div className="mt-2.5 flex items-center justify-between gap-1.5">
        <span className="font-display text-sm">
          {resv.preorder?.total ? `€ ${Number(resv.preorder.total).toFixed(2)}` : ""}
        </span>

        {canClose && !isClosing && (
          <button
            onClick={onRequestClose}
            className="rounded-md border border-current/25 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground hover:border-current/60 hover:text-foreground"
          >
            Chiudi
          </button>
        )}

        {isClosing && (
          <div className="flex gap-1.5">
            <button
              onClick={onCancelClose}
              className="rounded-md border border-border px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground hover:text-foreground"
            >
              No
            </button>
            <button
              onClick={onConfirmClose}
              disabled={closingBusy}
              className="rounded-md bg-terracotta px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-paper disabled:opacity-50"
            >
              {closingBusy ? "..." : "Conferma"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ icon, label, value, to, alert }: {
  icon: string; label: string; value: number; to?: string; alert?: boolean;
}) {
  const inner = (
    <>
      <div className="text-lg md:text-2xl">{icon}</div>
      <div className="mt-1 font-display text-xl leading-tight md:mt-2 md:text-3xl">
        {value}
        {alert && value > 0 && <span className="ml-2 inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-destructive align-middle" />}
      </div>
      <div className="mt-1 truncate text-[10px] uppercase tracking-wider text-muted-foreground md:text-xs">{label}</div>
    </>
  );
  return to ? (
    <Link to={to} className="block min-w-0 rounded-2xl border border-border bg-card p-3 transition hover:border-terracotta hover:shadow-md md:p-5">
      {inner}
    </Link>
  ) : (
    <div className="block min-w-0 rounded-2xl border border-border bg-card p-3 md:p-5">{inner}</div>
  );
}

