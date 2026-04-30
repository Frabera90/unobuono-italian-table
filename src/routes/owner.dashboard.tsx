import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { isoDate, relTime, getMyRestaurant, type MenuItem } from "@/lib/restaurant";
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
    preorderStatus: string;
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

function playDing() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.35, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.6);
  } catch {}
}

// ── Dashboard ────────────────────────────────────────────────────────────────

function DashboardPage() {
  const today = isoDate(new Date());
  const [stats, setStats] = useState({ resv: 0, preo: 0 });
  const [sala, setSala] = useState<ActiveResv[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [closingId, setClosingId] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const [restId, setRestId] = useState<string | null>(null);

  async function loadStats() {
    const restaurant = await getMyRestaurant();
    if (!restaurant) return;
    if (!restId) setRestId(restaurant.id);
    const [r, p] = await Promise.all([
      supabase.from("reservations").select("id", { count: "exact", head: true }).eq("restaurant_id", restaurant.id).eq("date", today).neq("status", "cancelled"),
      supabase.from("preorders").select("id", { count: "exact", head: true }).eq("restaurant_id", restaurant.id).gte("created_at", today + "T00:00:00").neq("status", "cancelled"),
    ]);
    setStats({ resv: r.count || 0, preo: p.count || 0 });
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
          preorderStatus: pre.status || "pending",
          bill_requested: pre.status === "bill_requested",
        } : null,
      };
    }));
  }

  async function markArrived(resv: ActiveResv) {
    await supabase.from("reservations").update({ arrived: true }).eq("id", resv.id);
    // If there's a pending pre-order, confirm it so the kitchen picks it up immediately
    if (resv.preorder?.id && resv.preorder.preorderStatus === "pending") {
      await supabase.from("preorders")
        .update({ status: "confirmed" })
        .eq("id", resv.preorder.id);
    }
    toast.success(`${resv.customer_name} segnato arrivato${resv.preorder ? " — ordine confermato in cucina" : ""}`);
    await loadSala();
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
    supabase.from("menu_items").select("*").order("category").order("sort_order")
      .then(({ data }) => setItems((data || []) as MenuItem[]));

    const push = (a: Activity) => setActivity((prev) => [a, ...prev].slice(0, 20));

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
        } else if (p.eventType === "UPDATE" && r.status === "bill_requested") {
          push({ id: r.id + "b", ts: new Date().toISOString(), icon: "💳", text: `Conto richiesto — ${r.customer_name}` });
          toast("💳 Conto richiesto!", { description: r.customer_name || "Un cliente", duration: 10000 });
          playDing();
        }
        loadStats();
        loadSala();
      }).subscribe(),
      supabase.channel(`d-call-${uid}`).on("postgres_changes", { event: "INSERT", schema: "public", table: "waiter_calls" }, (p) => {
        const r = p.new as any;
        push({ id: r.id, ts: r.created_at, icon: "🔔", text: `Tavolo ${r.table_number}: ${r.message}` });
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
    <div className="relative min-h-screen overflow-x-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 -left-32 h-[420px] w-[420px] rounded-full bg-[oklch(0.92_0.18_99)] opacity-50 blur-3xl" />
        <div className="absolute top-40 -right-32 h-[480px] w-[480px] rounded-full bg-[oklch(0.85_0.06_240)] opacity-30 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-[360px] w-[360px] rounded-full bg-[oklch(0.9_0.08_140)] opacity-30 blur-3xl" />
      </div>

      <div className="mx-auto w-full max-w-6xl px-3 py-5 md:px-6 md:py-9">
        <header className="mb-5 flex items-end justify-between md:mb-7">
          <div>
            <h1 className="font-display text-3xl tracking-tight md:text-5xl">Dashboard</h1>
            <p className="mt-1 text-xs text-muted-foreground md:text-sm">Tutto quello che succede stasera, in tempo reale.</p>
          </div>
          <span className="hidden items-center gap-2 rounded-full border border-black/10 bg-white/60 px-3 py-1.5 text-xs backdrop-blur-xl md:inline-flex">
            <span className="live-dot" /> live
          </span>
        </header>

        {/* Stats */}
        <section className="grid grid-cols-2 gap-2.5 sm:gap-3">
          <StatCard icon="📅" label="Prenotazioni oggi" value={stats.resv} to="/owner/reservations" accent="yellow" />
          <StatCard icon="🍽️" label="Ordini attivi" value={stats.preo} to="/owner/reservations" accent="dark" />
        </section>

        {/* ── SALA LIVE ──────────────────────────────────────────────────── */}
        <section className="mt-6 md:mt-8">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <h2 className="font-display text-2xl tracking-tight md:text-3xl">Sala Live</h2>
              <span className="rounded-full border border-black/10 bg-white/70 px-2.5 py-0.5 text-[11px] text-muted-foreground backdrop-blur-xl">
                {arrivedCount} al tavolo
              </span>
              {urgentCount > 0 && (
                <span className="rounded-full bg-red-500/15 px-2.5 py-0.5 text-[11px] font-medium text-red-600 ring-1 ring-red-500/20 animate-pulse">
                  {urgentCount} urgenti
                </span>
              )}
            </div>
            <Link to="/owner/reservations" className="text-xs font-medium text-foreground/70 hover:text-foreground">
              Lista completa →
            </Link>
          </div>

          {sortedSala.length === 0 ? (
            <p className="rounded-3xl border border-dashed border-black/15 bg-white/50 p-10 text-center text-sm text-muted-foreground backdrop-blur-xl">
              Nessuna prenotazione per oggi.
            </p>
          ) : (
            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {sortedSala.map((resv) => (
                <TableCard
                  key={resv.id}
                  resv={resv}
                  isClosing={closingId === resv.id}
                  closingBusy={closing}
                  onRequestClose={() => setClosingId(resv.id)}
                  onConfirmClose={() => closeTable(resv)}
                  onCancelClose={() => setClosingId(null)}
                  onMarkArrived={() => markArrived(resv)}
                />
              ))}
            </div>
          )}
        </section>

        <div className="mt-5 grid gap-3 md:mt-8 md:gap-5 lg:grid-cols-3">
          <section className="min-w-0 rounded-3xl border border-black/8 bg-white/65 p-4 shadow-[0_1px_0_rgba(255,255,255,0.6)_inset,0_8px_30px_-12px_rgba(0,0,0,0.15)] backdrop-blur-2xl md:p-6 lg:col-span-2">
            <div className="mb-4 flex items-center justify-between gap-2">
              <h2 className="truncate font-display text-lg tracking-tight md:text-2xl">Attività in tempo reale</h2>
              <Link to="/owner/reservations" className="shrink-0 text-xs font-medium text-foreground/70 hover:text-foreground">
                Vedi tutto →
              </Link>
            </div>
            {activity.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">In attesa di nuovi eventi…</p>
            ) : (
              <ul className="space-y-1.5">
                {activity.map((a) => (
                  <li key={a.id} className="flex min-w-0 items-center gap-3 rounded-2xl bg-white/70 px-3 py-2.5 ring-1 ring-black/5 slide-in-right">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--yellow)]/30 text-base ring-1 ring-black/5">{a.icon}</span>
                    <span className="min-w-0 flex-1 break-words text-[13px] leading-snug text-foreground/90 md:text-sm">{a.text}</span>
                    <span className="shrink-0 text-[10px] text-muted-foreground md:text-xs">{relTime(a.ts)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="min-w-0 rounded-3xl border border-black/8 bg-white/65 p-4 shadow-[0_1px_0_rgba(255,255,255,0.6)_inset,0_8px_30px_-12px_rgba(0,0,0,0.15)] backdrop-blur-2xl md:p-6">
            <div className="mb-4 flex items-center justify-between gap-2">
              <h2 className="truncate font-display text-lg tracking-tight md:text-2xl">Menu — disponibilità</h2>
              <Link to="/owner/menu" className="shrink-0 text-xs font-medium text-foreground/70 hover:text-foreground">
                Modifica →
              </Link>
            </div>
            <ul className="max-h-[40vh] space-y-0.5 overflow-y-auto pr-1 md:max-h-[60vh]">
              {items.map((it) => (
                <li key={it.id} className="flex items-center justify-between gap-2 rounded-xl px-2.5 py-2 transition hover:bg-white/80">
                  <span className={`min-w-0 flex-1 truncate text-sm ${!it.available ? "text-muted-foreground line-through" : ""}`}>{it.name}</span>
                  <button
                    onClick={() => toggleItem(it)}
                    className={`relative h-6 w-11 shrink-0 rounded-full transition ${it.available ? "bg-[var(--ink)]" : "bg-black/15"}`}
                    aria-label="toggle"
                  >
                    <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${it.available ? "left-[22px]" : "left-0.5"}`} />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}

// ── TableCard ────────────────────────────────────────────────────────────────

function TableCard({ resv, isClosing, closingBusy, onRequestClose, onConfirmClose, onCancelClose, onMarkArrived }: {
  resv: ActiveResv;
  isClosing: boolean;
  closingBusy: boolean;
  onRequestClose: () => void;
  onConfirmClose: () => void;
  onCancelClose: () => void;
  onMarkArrived: () => void;
}) {
  const state = getCardState(resv);
  const isIncoming = state === "incoming";
  const canClose = !isIncoming && resv.arrived;
  const hasPreorder = !!resv.preorder;
  // A "confirmed" pre-order means the customer just arrived and the order went to kitchen
  const orderLabel = resv.arrived && hasPreorder ? "Ordine" : "Pre-ordine";

  const STATE_STYLE: Record<CardState, { label: string; pill: string; ring: string; tint: string }> = {
    bill:     { label: "Conto",     pill: "bg-red-500 text-white",                ring: "ring-red-400/40",     tint: "bg-red-50/80" },
    ready:    { label: "Pronto",    pill: "bg-emerald-500 text-white",            ring: "ring-emerald-400/40", tint: "bg-emerald-50/80" },
    cooking:  { label: "In cucina", pill: "bg-[var(--ink)] text-[var(--yellow)]", ring: "ring-black/15",       tint: "bg-[var(--yellow)]/15" },
    ordered:  { label: "Ordinato",  pill: "bg-sky-500 text-white",                ring: "ring-sky-400/30",     tint: "bg-sky-50/80" },
    seated:   { label: "Al tavolo", pill: "bg-white text-foreground ring-1 ring-black/15", ring: "ring-black/10", tint: "bg-white/70" },
    incoming: { label: "In arrivo", pill: "bg-white/70 text-muted-foreground ring-1 ring-black/10", ring: "ring-black/5", tint: "bg-white/50" },
  };
  const s = STATE_STYLE[state];

  return (
    <div className={`group relative overflow-hidden rounded-3xl ${s.tint} p-3.5 ring-1 ${s.ring} backdrop-blur-2xl shadow-[0_1px_0_rgba(255,255,255,0.7)_inset,0_8px_24px_-12px_rgba(0,0,0,0.18)] transition hover:-translate-y-0.5 ${isIncoming ? "opacity-80" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-base leading-tight tracking-tight">{resv.customer_name}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {resv.time}
            {" · "}{resv.party_size}p
            {resv.tableCode && <span className="ml-1 font-mono">· {resv.tableCode}</span>}
          </p>
          {resv.zone_name && !resv.tableCode && (
            <p className="text-[10px] text-muted-foreground/70">{resv.zone_name}</p>
          )}
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${s.pill}`}>
          {s.label}
        </span>
      </div>

      {/* Order items — shown as "Pre-ordine" before arrival, "Ordine" after */}
      {resv.preorder && resv.preorder.items.length > 0 && (
        <div className="mt-2.5 border-t border-black/5 pt-2">
          <p className="mb-1 text-[9px] font-bold uppercase tracking-widest text-muted-foreground">{orderLabel}</p>
          <ul className="space-y-0.5 text-xs text-foreground/80">
            {resv.preorder.items.slice(0, 4).map((it, i) => (
              <li key={i} className="flex items-baseline gap-1.5">
                <span className="font-mono text-[10px] text-muted-foreground">{it.qty}×</span>
                <span className="truncate">{it.name}</span>
              </li>
            ))}
            {resv.preorder.items.length > 4 && (
              <li className="text-[10px] opacity-60">+{resv.preorder.items.length - 4} altri</li>
            )}
          </ul>
        </div>
      )}

      <div className="mt-3 flex items-center justify-between gap-1.5">
        <span className="font-display text-sm tracking-tight">
          {resv.preorder?.total ? `€ ${Number(resv.preorder.total).toFixed(2)}` : ""}
        </span>

        {/* Segna arrivato — shown when customer hasn't arrived yet */}
        {isIncoming && !isClosing && (
          <button
            onClick={onMarkArrived}
            className="rounded-full bg-[var(--ink)] px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-white backdrop-blur-md transition hover:opacity-80"
          >
            {hasPreorder ? "✓ Arrivato + conferma ordine" : "✓ Segna arrivato"}
          </button>
        )}

        {canClose && !isClosing && (
          <button
            onClick={onRequestClose}
            className="rounded-full bg-white/80 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-foreground/70 ring-1 ring-black/10 backdrop-blur-md transition hover:text-foreground hover:ring-black/30"
          >
            Chiudi
          </button>
        )}

        {isClosing && (
          <div className="flex gap-1.5">
            <button
              onClick={onCancelClose}
              className="rounded-full bg-white/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground ring-1 ring-black/10"
            >
              No
            </button>
            <button
              onClick={onConfirmClose}
              disabled={closingBusy}
              className="rounded-full bg-[var(--ink)] px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-white disabled:opacity-50"
            >
              {closingBusy ? "…" : "Conferma"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ icon, label, value, to, alert, accent = "white" }: {
  icon: string; label: string; value: number; to?: string; alert?: boolean;
  accent?: "yellow" | "dark" | "white";
}) {
  const styles =
    accent === "yellow"
      ? "bg-[var(--yellow)] text-[var(--ink)] ring-black/10"
      : accent === "dark"
      ? "bg-[var(--ink)] text-white ring-white/10"
      : "bg-white/70 text-foreground ring-black/8 backdrop-blur-2xl";

  const inner = (
    <>
      <div className="flex items-center justify-between">
        <span className={`grid h-9 w-9 place-items-center rounded-full text-base ring-1 ${accent === "dark" ? "bg-white/10 ring-white/15" : "bg-black/5 ring-black/5"}`}>
          {icon}
        </span>
        {alert && value > 0 && <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />}
      </div>
      <div className="mt-3 font-display text-3xl leading-none tracking-tight md:text-4xl">{value}</div>
      <div className={`mt-1.5 truncate text-[11px] font-medium ${accent === "dark" ? "text-white/60" : "text-muted-foreground"}`}>
        {label}
      </div>
    </>
  );

  const cls = `block min-w-0 rounded-3xl p-4 ring-1 shadow-[0_1px_0_rgba(255,255,255,0.6)_inset,0_8px_24px_-12px_rgba(0,0,0,0.18)] transition hover:-translate-y-0.5 md:p-5 ${styles}`;

  return to ? <Link to={to} className={cls}>{inner}</Link> : <div className={cls}>{inner}</div>;
}
