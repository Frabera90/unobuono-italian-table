import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { relTime, isoDate } from "@/lib/restaurant";
import { playDing } from "@/lib/sounds";
import { toast } from "sonner";
import { TodoTab, AddTaskModal } from "@/components/waiter/TodoTab";

export const Route = createFileRoute("/waiter")({
  head: () => ({
    meta: [
      { title: "Sala — Unobuono" },
      { name: "theme-color", content: "#0a0a0a" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "Sala" },
    ],
    links: [{ rel: "manifest", href: "/staff.webmanifest" }],
  }),
  component: WaiterPage,
});

type Tab = "calls" | "todo" | "reservations" | "ordini" | "cucina";

type KitchenOrder = {
  id: string; reservation_id: string | null; customer_name: string | null;
  items: { name: string; qty: number; price?: number; notes?: string }[];
  course_status: string; created_at: string;
  tableCode: string | null; reservationTime: string | null;
};
type TableLite = { id: string; code: string; seats: number };
type MenuItemLite = { id: string; name: string; price: number | null; category: string | null };
type CartEntry = { item: MenuItemLite; qty: number; notes: string };

type Call = {
  id: string; table_number: string; customer_name: string | null;
  message: string | null; status: string; created_at: string; restaurant_id: string;
};
type Resv = {
  id: string; customer_name: string; customer_phone: string | null;
  party_size: number; date: string; time: string; zone_name: string | null;
  occasion: string | null; allergies: string | null; preferences: string[] | null;
  arrived: boolean; restaurant_id: string;
};
type Preo = {
  id: string; reservation_id: string | null; customer_name: string | null;
  items: any; total: number | null; status: string; course_status: string;
  created_at: string; restaurant_id: string;
};

function WaiterPage() {
  const nav = useNavigate();
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [pin, setPin] = useState<string | null>(null);
  const [staffName, setStaffName] = useState<string>("");
  const [tab, setTab] = useState<Tab>("calls");
  const [calls, setCalls] = useState<Call[]>([]);
  const [reservations, setReservations] = useState<Resv[]>([]);
  const [preorders, setPreorders] = useState<Preo[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItemLite[]>([]);
  const [readCalls, setReadCalls] = useState(0);
  const [showInstall, setShowInstall] = useState(false);
  const [taskFromCall, setTaskFromCall] = useState<Call | null>(null);
  const [tables, setTables] = useState<TableLite[]>([]);

  // Walk-in state
  const [walkinOpen, setWalkinOpen] = useState(false);
  const [walkinName, setWalkinName] = useState("");
  const [walkinSize, setWalkinSize] = useState(2);
  const [walkinTable, setWalkinTable] = useState("");
  const [walkinBusy, setWalkinBusy] = useState(false);

  // Order entry state
  const [orderResv, setOrderResv] = useState<Resv | null>(null);
  const [cart, setCart] = useState<Record<string, CartEntry>>({});
  const [orderBusy, setOrderBusy] = useState(false);

  const today = isoDate(new Date());

  const pronti = useMemo(
    () => preorders.filter((p) => (p.course_status || "pending") === "ready"),
    [preorders],
  );

  // Auth gate
  useEffect(() => {
    if (typeof window === "undefined") return;
    const rid = localStorage.getItem("staff.restaurant_id");
    const p = localStorage.getItem("staff.pin");
    const n = localStorage.getItem("staff.name") || "";
    if (!rid || !p) { nav({ to: "/staff", search: { pin: undefined } }); return; }
    setRestaurantId(rid);
    setPin(p);
    setStaffName(n);
    if (!localStorage.getItem("waiter-install-dismissed")) setShowInstall(true);
  }, [nav]);

  // Data loading + real-time subscriptions
  useEffect(() => {
    if (!restaurantId) return;

    void supabase.from("waiter_calls").select("*")
      .eq("restaurant_id", restaurantId).eq("status", "pending")
      .order("created_at", { ascending: false })
      .then(({ data }) => { setCalls((data || []) as Call[]); setReadCalls((data || []).length); });

    void supabase.from("reservations").select("*")
      .eq("restaurant_id", restaurantId).eq("date", today)
      .neq("status", "cancelled").neq("status", "completed")
      .order("time")
      .then(({ data }) => setReservations((data || []) as Resv[]));

    void supabase.from("preorders").select("*")
      .eq("restaurant_id", restaurantId).gte("created_at", today)
      .order("created_at", { ascending: false })
      .then(({ data }) => setPreorders((data || []) as Preo[]));

    void supabase.from("tables").select("id,code,seats")
      .eq("restaurant_id", restaurantId).order("code")
      .then(({ data }) => setTables((data || []) as TableLite[]));

    void supabase.from("menu_items").select("id,name,price,category")
      .eq("restaurant_id", restaurantId).eq("available", true)
      .order("category").order("sort_order")
      .then(({ data }) => setMenuItems((data || []) as MenuItemLite[]));

    // Real-time: chiamate tavolo
    const c1 = supabase.channel(`w-calls-${restaurantId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "waiter_calls", filter: `restaurant_id=eq.${restaurantId}` }, (p) => {
        if (p.eventType === "INSERT") {
          setCalls((prev) => [p.new as Call, ...prev]);
          try { playDing(); } catch {}
          toast.success(`🔔 Tavolo ${(p.new as Call).table_number}`);
        } else if (p.eventType === "UPDATE") {
          setCalls((prev) => prev.map((x) => x.id === (p.new as Call).id ? (p.new as Call) : x).filter((x) => x.status === "pending"));
        }
      }).subscribe();

    // Real-time: prenotazioni
    const c2 = supabase.channel(`w-resv-${restaurantId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "reservations", filter: `restaurant_id=eq.${restaurantId}` }, (p) => {
        const row = (p.new || p.old) as Resv;
        if (row.date !== today) return;
        const newStatus = (p.new as any)?.status;
        if (p.eventType === "DELETE" || newStatus === "cancelled" || newStatus === "completed") {
          setReservations((prev) => prev.filter((r) => r.id !== row.id));
        } else {
          setReservations((prev) => {
            const i = prev.findIndex((r) => r.id === row.id);
            if (i === -1) return [...prev, row].sort((a, b) => a.time.localeCompare(b.time));
            const copy = [...prev]; copy[i] = row; return copy;
          });
        }
      }).subscribe();

    // Real-time: ordini — notifica piatto pronto
    const c3 = supabase.channel(`w-pre-${restaurantId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "preorders", filter: `restaurant_id=eq.${restaurantId}` }, (p) => {
        const row = (p.new || p.old) as Preo;
        if (p.eventType === "DELETE") {
          setPreorders((prev) => prev.filter((r) => r.id !== row.id));
          return;
        }
        // Notifica cameriere quando la cucina marca "pronto"
        if (p.eventType === "UPDATE" && (p.new as any).course_status === "ready") {
          try { playDing(); setTimeout(playDing, 300); } catch {}
          toast.success(`🍽️ Pronto — ${(p.new as any).customer_name || "Tavolo"}`);
        }
        setPreorders((prev) => {
          const i = prev.findIndex((r) => r.id === row.id);
          if (i === -1) return [row, ...prev];
          const copy = [...prev]; copy[i] = row; return copy;
        });
      }).subscribe();

    return () => { void supabase.removeChannel(c1); void supabase.removeChannel(c2); void supabase.removeChannel(c3); };
  }, [restaurantId, today]);

  // Handlers
  async function markCallSeen(id: string) {
    if (!pin) return;
    const { data, error } = await supabase.rpc("staff_mark_call_seen", { _call_id: id, _pin: pin });
    if (error || !data) toast.error("Errore");
    else setCalls((prev) => prev.filter((x) => x.id !== id));
  }

  async function toggleArrived(r: Resv) {
    if (!pin) return;
    const { data, error } = await supabase.rpc("staff_toggle_arrived", { _reservation_id: r.id, _pin: pin });
    if (error || !data) toast.error("Errore");
  }

  async function markServed(preorderId: string) {
    if (!pin) return;
    const { data, error } = await supabase.rpc("staff_set_course_status", {
      _preorder_id: preorderId,
      _course_status: "served",
      _pin: pin,
    });
    if (error || !data) toast.error("Errore aggiornamento");
  }

  async function requestBill(preorderId: string) {
    if (!pin) return;
    const { data, error } = await supabase.rpc("staff_set_preorder_status", {
      _preorder_id: preorderId,
      _status: "bill_requested",
      _pin: pin,
    });
    if (error || !data) toast.error("Errore richiesta conto");
    else toast.success("💳 Conto richiesto — l'owner lo vedrà subito");
  }

  function logout() {
    localStorage.removeItem("staff.restaurant_id");
    localStorage.removeItem("staff.pin");
    localStorage.removeItem("staff.name");
    nav({ to: "/staff", search: { pin: undefined } });
  }

  async function createWalkin(e: React.FormEvent) {
    e.preventDefault();
    if (!pin || !restaurantId) return;
    setWalkinBusy(true);
    try {
      const { data, error } = await supabase.rpc("staff_create_walkin", {
        _pin: pin,
        _customer_name: walkinName.trim() || "Walk-in",
        _party_size: walkinSize,
        _table_id: walkinTable || undefined,
      });
      if (error) throw error;
      if (!data) throw new Error("Errore");
      toast.success(`Walk-in creato${walkinTable ? " · " + (tables.find((t) => t.id === walkinTable)?.code || "") : ""}`);
      setWalkinOpen(false);
      setWalkinName(""); setWalkinSize(2); setWalkinTable("");
    } catch (err: any) {
      toast.error(err.message || "Errore creazione walk-in");
    } finally {
      setWalkinBusy(false);
    }
  }

  async function submitOrder() {
    if (!pin || !orderResv) return;
    const items = Object.values(cart)
      .filter((e) => e.qty > 0)
      .map(({ item, qty, notes }) => ({
        name: item.name,
        qty,
        price: item.price ?? 0,
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      }));
    if (items.length === 0) { toast.error("Aggiungi almeno un piatto"); return; }
    const total = items.reduce((s, i) => s + i.qty * (i.price || 0), 0);
    setOrderBusy(true);
    try {
      const { data: preorderId, error } = await supabase.rpc("staff_upsert_preorder", {
        _pin: pin,
        _reservation_id: orderResv.id,
        _items: items,
        _total: total,
      });
      if (error) throw error;
      if (!preorderId) throw new Error("PIN non autorizzato o prenotazione non trovata");
      toast.success("✓ Ordine inviato in cucina");
      setOrderResv(null);
      setCart({});
    } catch (err: any) {
      toast.error(err.message || "Errore");
    } finally {
      setOrderBusy(false);
    }
  }

  function adjustCart(item: MenuItemLite, delta: number) {
    setCart((prev) => {
      const qty = (prev[item.id]?.qty || 0) + delta;
      if (qty <= 0) {
        const { [item.id]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [item.id]: { item, qty, notes: prev[item.id]?.notes ?? "" } };
    });
  }

  function setCartNotes(itemId: string, notes: string) {
    setCart((prev) => prev[itemId] ? { ...prev, [itemId]: { ...prev[itemId], notes } } : prev);
  }

  if (!restaurantId) return (
    <div className="grid min-h-screen place-items-center bg-ink text-paper/60 text-sm">Caricamento...</div>
  );

  const callsBadge = calls.length;
  const menuByCategory = menuItems.reduce<Record<string, MenuItemLite[]>>((acc, item) => {
    const cat = item.category || "Altro";
    (acc[cat] ??= []).push(item);
    return acc;
  }, {});
  const cartTotal = Object.values(cart).reduce((s, e) => s + e.qty * (e.item.price || 0), 0);
  const cartCount = Object.values(cart).reduce((s, e) => s + e.qty, 0);

  return (
    <main className="min-h-screen bg-ink text-paper">
      {/* Install banner */}
      {showInstall && (
        <div className="border-b-2 border-yellow bg-yellow px-4 py-2 text-center text-xs font-bold uppercase tracking-wider text-ink">
          💡 Aggiungi alla home per le notifiche
          <button className="ml-3 text-ink/60" onClick={() => { localStorage.setItem("waiter-install-dismissed", "1"); setShowInstall(false); }}>×</button>
        </div>
      )}

      {/* Top bar */}
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2 text-xs">
        <span className="text-paper/60">👤 {staffName || "Staff"}</span>
        <button onClick={logout} className="text-paper/50 underline hover:text-paper">Esci</button>
      </div>

      {/* Tab bar */}
      <div className="sticky top-0 z-10 grid grid-cols-5 border-b-2 border-yellow bg-ink">
        <TabBtn active={tab === "calls"} onClick={() => { setTab("calls"); setReadCalls(calls.length); }} badge={callsBadge}>🔔 Call</TabBtn>
        <TabBtn active={tab === "todo"} onClick={() => setTab("todo")}>✅ To-do</TabBtn>
        <TabBtn active={tab === "reservations"} onClick={() => setTab("reservations")}>📋 Sala</TabBtn>
        <TabBtn active={tab === "ordini"} onClick={() => setTab("ordini")} badge={pronti.length > 0 ? pronti.length : undefined}>🍽️ Ordini</TabBtn>
        <TabBtn active={tab === "cucina"} onClick={() => setTab("cucina")}>👨‍🍳 Cucina</TabBtn>
      </div>

      {/* Piatti pronti — banner sempre visibile */}
      {pronti.length > 0 && (
        <div className="border-b-2 border-emerald-400 bg-emerald-900/40 px-4 py-3">
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-emerald-400">
            🍽️ {pronti.length} {pronti.length === 1 ? "piatto pronto" : "piatti pronti"} — vai a prendere!
          </p>
          <ul className="space-y-1.5">
            {pronti.map((p) => {
              const resv = reservations.find((r) => r.id === p.reservation_id);
              return (
                <li key={p.id} className="flex items-center justify-between gap-3 rounded-lg border border-emerald-400/20 bg-emerald-600/10 px-3 py-2">
                  <div className="min-w-0">
                    <span className="text-sm font-bold text-paper">{p.customer_name || resv?.customer_name || "Walk-in"}</span>
                    <span className="ml-2 text-xs text-emerald-300/80">
                      {(Array.isArray(p.items) ? p.items : []).map((it: any) => `${it.qty}× ${it.name}`).join(", ")}
                    </span>
                  </div>
                  <button
                    onClick={() => markServed(p.id)}
                    className="shrink-0 rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-paper hover:bg-emerald-400 active:scale-95"
                  >
                    ✓ Servito
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Tab content */}
      <div className="mx-auto max-w-2xl px-4 py-5">
        {tab === "calls" && (
          <ul className="space-y-3">
            {calls.length === 0 && (
              <li className="rounded-2xl border border-white/10 p-8 text-center text-paper/60">Nessuna chiamata in attesa.</li>
            )}
            {calls.map((c) => (
              <li key={c.id} className="slide-in-right rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="font-display text-4xl text-yellow sm:text-5xl">Tav. {c.table_number}</div>
                    {c.customer_name && <div className="mt-1 text-sm text-paper/70">{c.customer_name}</div>}
                    <div className="mt-2 text-base">{c.message}</div>
                    <div className="mt-1 text-xs text-paper/50">{relTime(c.created_at)}</div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button onClick={() => setTaskFromCall(c)} className="rounded-lg border-2 border-yellow bg-transparent px-3 py-2 text-xs font-bold uppercase tracking-wider text-yellow hover:bg-yellow/10">+ Task</button>
                    <button onClick={() => markCallSeen(c.id)} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold uppercase tracking-wider text-paper hover:bg-emerald-500">✓ Visto</button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        {tab === "todo" && (
          <TodoTab restaurantId={restaurantId} pin={pin || ""} staffName={staffName} />
        )}

        {tab === "reservations" && (
          <>
            <div className="mb-4 flex justify-end">
              <button
                onClick={() => setWalkinOpen(true)}
                className="rounded-lg border-2 border-yellow bg-transparent px-4 py-2 text-sm font-bold uppercase tracking-wider text-yellow hover:bg-yellow/10"
              >
                + Walk-in
              </button>
            </div>
            <ResvList
              reservations={reservations}
              preorders={preorders}
              onToggle={toggleArrived}
              onOrder={(r) => {
                // Pre-popola il carrello con i piatti già ordinati
                const existingPre = preorders.find((p) => p.reservation_id === r.id);
                if (existingPre && Array.isArray(existingPre.items) && existingPre.items.length > 0) {
                  const preCart: Record<string, CartEntry> = {};
                  for (const it of existingPre.items as any[]) {
                    const mi = menuItems.find((m) => m.name === it.name);
                    if (mi) preCart[mi.id] = { item: mi, qty: it.qty, notes: it.notes || "" };
                  }
                  setCart(preCart);
                } else {
                  setCart({});
                }
                setOrderResv(r);
              }}
              onBillRequest={requestBill}
            />
          </>
        )}

        {tab === "ordini" && (
          <OrdiniTab
            preorders={preorders}
            reservations={reservations}
            onMarkServed={markServed}
            onBillRequest={requestBill}
          />
        )}

        {tab === "cucina" && restaurantId && pin && (
          <CucinaTab restaurantId={restaurantId} pin={pin} />
        )}
      </div>

      {/* Task modal */}
      {taskFromCall && pin && (
        <AddTaskModal
          restaurantId={restaurantId}
          pin={pin}
          staffName={staffName}
          defaultTableNumber={taskFromCall.table_number}
          defaultDescription={taskFromCall.message ? `Tav. ${taskFromCall.table_number}: ${taskFromCall.message}` : `Tav. ${taskFromCall.table_number}`}
          callId={taskFromCall.id}
          onClose={() => setTaskFromCall(null)}
        />
      )}

      {/* Walk-in modal */}
      {walkinOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/60 p-4 sm:items-center" onClick={() => setWalkinOpen(false)}>
          <form
            onSubmit={createWalkin}
            className="w-full max-w-sm rounded-2xl border border-white/15 bg-ink p-6 text-paper"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-4 font-display text-2xl text-yellow">Nuovo Walk-in</h2>
            <div className="space-y-3">
              <label className="block">
                <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-paper/70">Nome cliente (opzionale)</span>
                <input value={walkinName} onChange={(e) => setWalkinName(e.target.value)} placeholder="Walk-in"
                  className="w-full rounded-lg border-2 border-white/15 bg-white/5 px-3 py-2 text-paper placeholder:text-paper/30 focus:border-yellow focus:outline-none" />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-paper/70">Numero persone *</span>
                <input type="number" min={1} max={30} value={walkinSize} onChange={(e) => setWalkinSize(Math.max(1, Number(e.target.value)))} required
                  className="w-full rounded-lg border-2 border-white/15 bg-white/5 px-3 py-2 text-center font-display text-2xl text-yellow focus:border-yellow focus:outline-none" />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-paper/70">Tavolo</span>
                <select value={walkinTable} onChange={(e) => setWalkinTable(e.target.value)}
                  className="w-full rounded-lg border-2 border-white/15 bg-ink px-3 py-2 text-paper focus:border-yellow focus:outline-none">
                  <option value="">— Nessun tavolo —</option>
                  {tables.map((t) => <option key={t.id} value={t.id}>{t.code} ({t.seats}p)</option>)}
                </select>
              </label>
            </div>
            <div className="mt-5 flex gap-2">
              <button type="submit" disabled={walkinBusy}
                className="flex-1 rounded-lg border-2 border-yellow bg-yellow py-3 text-sm font-bold uppercase tracking-wider text-ink hover:bg-yellow/80 disabled:opacity-50">
                {walkinBusy ? "..." : "Crea walk-in"}
              </button>
              <button type="button" onClick={() => setWalkinOpen(false)}
                className="rounded-lg border-2 border-white/20 px-4 py-3 text-sm font-bold uppercase tracking-wider text-paper/70">
                Annulla
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Order entry modal */}
      {orderResv && (
        <OrderModal
          resv={orderResv}
          menuByCategory={menuByCategory}
          cart={cart}
          cartTotal={cartTotal}
          cartCount={cartCount}
          busy={orderBusy}
          onAdjust={adjustCart}
          onNotes={setCartNotes}
          onSubmit={submitOrder}
          onClose={() => { setOrderResv(null); setCart({}); }}
        />
      )}
    </main>
  );
}

// ── Tab button ───────────────────────────────────────────────────────────────

function TabBtn({ active, onClick, children, badge }: {
  active: boolean; onClick: () => void; children: React.ReactNode; badge?: number;
}) {
  return (
    <button onClick={onClick} className={`relative px-2 py-4 text-sm font-medium transition ${active ? "text-yellow" : "text-paper/60"}`}>
      {children}
      {badge ? (
        <span className="absolute right-1 top-2 inline-flex min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-paper">
          {badge}
        </span>
      ) : null}
      {active && <span className="absolute inset-x-2 bottom-0 h-0.5 bg-yellow" />}
    </button>
  );
}

// ── Ordini tab ───────────────────────────────────────────────────────────────

function OrdiniTab({ preorders, reservations, onMarkServed, onBillRequest }: {
  preorders: Preo[];
  reservations: Resv[];
  onMarkServed: (id: string) => void;
  onBillRequest: (id: string) => void;
}) {
  const todayResvIds = useMemo(() => new Set(reservations.map((r) => r.id)), [reservations]);
  const active = preorders.filter(
    (p) =>
      (!p.reservation_id || todayResvIds.has(p.reservation_id)) &&
      (p.course_status !== "served" || p.status === "bill_requested"),
  );

  const STATUS: Record<string, { label: string; cls: string }> = {
    pending: { label: "In attesa",  cls: "bg-white/10 text-paper/50" },
    cooking: { label: "In cucina",  cls: "bg-yellow/20 text-yellow" },
    ready:   { label: "Pronto ✓",   cls: "bg-emerald-500/20 text-emerald-400" },
  };

  if (active.length === 0) {
    return (
      <p className="rounded-2xl border border-white/10 p-8 text-center text-paper/60">
        Nessun ordine attivo.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {active.map((p) => {
        const resv = reservations.find((r) => r.id === p.reservation_id);
        const st = STATUS[p.course_status || "pending"] || STATUS.pending;
        const isReady = p.course_status === "ready";
        return (
          <li key={p.id} className={`rounded-2xl border p-4 ${isReady ? "border-emerald-400 bg-emerald-900/20" : "border-white/10 bg-white/5"}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="font-display text-xl text-yellow">{resv?.time || "—"}</span>
                  <span className="font-display text-base">{p.customer_name || resv?.customer_name || "Walk-in"}</span>
                </div>
                <ul className="mt-2 space-y-0.5 text-sm">
                  {(Array.isArray(p.items) ? p.items : []).map((it: any, i: number) => (
                    <li key={i} className="flex items-baseline gap-2">
                      <span className="font-mono text-xs text-yellow">{it.qty}×</span>
                      <span>{it.name}</span>
                      {it.notes && <span className="text-xs italic text-paper/40">{it.notes}</span>}
                    </li>
                  ))}
                </ul>
                {p.total != null && p.total > 0 && (
                  <p className="mt-2 text-sm text-paper/50">€ {Number(p.total).toFixed(2)}</p>
                )}
              </div>
              <div className="flex flex-col items-end gap-2">
                <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${st.cls}`}>
                  {st.label}
                </span>
                {isReady && (
                  <button
                    onClick={() => onMarkServed(p.id)}
                    className="rounded-lg bg-emerald-500 px-3 py-2 text-xs font-bold uppercase tracking-wider text-paper hover:bg-emerald-400"
                  >
                    ✓ Servito
                  </button>
                )}
                {p.status === "bill_requested" ? (
                  <span className="rounded-full bg-orange-500/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-orange-300">
                    💳 Conto
                  </span>
                ) : (
                  <button
                    onClick={() => onBillRequest(p.id)}
                    className="rounded-lg border border-orange-400/40 px-3 py-2 text-xs font-bold uppercase tracking-wider text-orange-300 hover:bg-orange-400/10"
                  >
                    💳 Conto
                  </button>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

// ── Reservation list ─────────────────────────────────────────────────────────

function ResvList({ reservations, preorders, onToggle, onOrder, onBillRequest }: {
  reservations: Resv[];
  preorders: Preo[];
  onToggle: (r: Resv) => void;
  onOrder: (r: Resv) => void;
  onBillRequest: (preorderId: string) => void;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const preMap = useMemo(() => {
    const m = new Map<string, Preo>();
    for (const p of preorders) if (p.reservation_id) m.set(p.reservation_id, p);
    return m;
  }, [preorders]);

  if (reservations.length === 0) {
    return <p className="rounded-2xl border border-white/10 p-8 text-center text-paper/60">Nessuna prenotazione oggi.</p>;
  }

  return (
    <ul className="space-y-3">
      {reservations.map((r) => {
        const exp = open === r.id;
        const pre = preMap.get(r.id);
        const hasActiveOrder = pre && pre.course_status !== "served";
        return (
          <li key={r.id} className="rounded-2xl border border-white/10 bg-white/5">
            <button onClick={() => setOpen(exp ? null : r.id)} className="flex w-full items-center gap-4 p-4 text-left">
              <div className="font-display text-3xl text-yellow">{r.time}</div>
              <div className="min-w-0 flex-1">
                <div className="font-display text-base">{r.customer_name} · {r.party_size} pers</div>
                <div className="truncate text-xs text-paper/60">{r.zone_name}</div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {r.occasion && <Badge>🎂 {r.occasion}</Badge>}
                  {pre?.status === "bill_requested" && <Badge tone="bill">💳 Conto</Badge>}
                  {pre && pre.course_status === "ready" && <Badge tone="ok">✅ Pronto!</Badge>}
                  {pre && pre.course_status === "cooking" && <Badge>👨‍🍳 In cucina</Badge>}
                  {pre && hasActiveOrder && pre.course_status !== "cooking" && pre.course_status !== "ready" && <Badge>📝 Ordinato</Badge>}
                  {pre && !hasActiveOrder && <Badge>🛵 Pre-ordine</Badge>}
                  {r.allergies && <Badge tone="warn">⚠️ Allergie</Badge>}
                </div>
              </div>
              {r.arrived ? (
                <span className="shrink-0 rounded-lg bg-emerald-500/20 px-2.5 py-1.5 text-xs font-bold text-emerald-400">
                  Arrivato ✓
                </span>
              ) : (
                <button
                  onClick={(e) => { e.stopPropagation(); onToggle(r); }}
                  className="shrink-0 rounded-lg border-2 border-yellow px-2.5 py-1.5 text-xs font-bold uppercase tracking-wider text-yellow hover:bg-yellow/10 active:scale-95"
                >
                  Segna arrivato
                </button>
              )}
            </button>

            {exp && (
              <div className="space-y-2 border-t border-white/10 p-4 text-sm">
                {r.allergies && <p>⚠️ <span className="text-paper/70">Allergie:</span> {r.allergies}</p>}
                {r.occasion && <p>🎉 <span className="text-paper/70">Occasione:</span> {r.occasion}</p>}
                {Array.isArray((r as any).preferences) && (r as any).preferences.length > 0 && (
                  <p>💺 <span className="text-paper/70">Preferenze:</span> {(r as any).preferences.join(", ")}</p>
                )}
                {r.customer_phone && (
                  <p>📞 <a href={`tel:${r.customer_phone}`} className="text-yellow underline">{r.customer_phone}</a></p>
                )}
                {pre && (
                  <div className="mt-1">
                    <p className="text-paper/70">
                      {pre.course_status === "served" ? "Ordine servito" : "Ordine in corso"} (€ {Number(pre.total).toFixed(2)}):
                    </p>
                    <ul className="mt-1 space-y-0.5 text-paper/80">
                      {(Array.isArray(pre.items) ? pre.items : []).map((it: any, i: number) => (
                        <li key={i}>· {it.qty}× {it.name}{it.notes ? ` — ${it.notes}` : ""}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <button
                  onClick={() => onOrder(r)}
                  className="mt-1 w-full rounded-lg border-2 border-yellow py-2.5 text-sm font-bold uppercase tracking-wider text-yellow hover:bg-yellow/10"
                >
                  🍽️ {pre ? "Modifica ordine" : "Prendi ordine"}
                </button>
                {pre && (
                  pre.status === "bill_requested" ? (
                    <div className="mt-1 flex items-center justify-center gap-2 rounded-lg border-2 border-orange-400/30 bg-orange-400/10 py-2.5 text-sm font-bold text-orange-300">
                      💳 Conto richiesto — in attesa chiusura
                    </div>
                  ) : (
                    <button
                      onClick={() => onBillRequest(pre.id)}
                      className="mt-1 w-full rounded-lg border-2 border-orange-400 py-2.5 text-sm font-bold uppercase tracking-wider text-orange-300 hover:bg-orange-400/10"
                    >
                      💳 Chiedi conto
                    </button>
                  )
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

// ── Order entry modal ────────────────────────────────────────────────────────

function OrderModal({ resv, menuByCategory, cart, cartTotal, cartCount, busy, onAdjust, onNotes, onSubmit, onClose }: {
  resv: Resv;
  menuByCategory: Record<string, MenuItemLite[]>;
  cart: Record<string, CartEntry>;
  cartTotal: number;
  cartCount: number;
  busy: boolean;
  onAdjust: (item: MenuItemLite, delta: number) => void;
  onNotes: (itemId: string, notes: string) => void;
  onSubmit: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-ink text-paper">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b-2 border-white/15 px-4 py-3">
        <div>
          <p className="font-display text-lg text-yellow">{resv.customer_name}</p>
          <p className="text-xs text-paper/50">{resv.time} · {resv.party_size} {resv.party_size === 1 ? "persona" : "persone"}</p>
        </div>
        <button onClick={onClose} className="rounded-lg border border-white/20 px-3 py-1.5 text-xs text-paper/70 hover:text-paper">
          ✕ Chiudi
        </button>
      </div>

      {/* Menu scrollabile */}
      <div className="flex-1 overflow-y-auto">
        {Object.keys(menuByCategory).length === 0 && (
          <p className="py-20 text-center text-paper/40">Nessun piatto disponibile.</p>
        )}
        {Object.entries(menuByCategory).map(([cat, items]) => (
          <div key={cat}>
            <div className="sticky top-0 bg-ink/95 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-paper/40 backdrop-blur">
              {cat}
            </div>
            {items.map((item) => {
              const entry = cart[item.id];
              const qty = entry?.qty || 0;
              return (
                <div key={item.id} className="border-b border-white/5 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{item.name}</p>
                      {item.price != null && (
                        <p className="text-xs text-paper/50">€ {Number(item.price).toFixed(2)}</p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {qty > 0 && (
                        <button
                          onClick={() => onAdjust(item, -1)}
                          className="grid h-8 w-8 place-items-center rounded-full border-2 border-white/20 text-lg font-bold text-paper/80 hover:border-yellow hover:text-yellow"
                        >
                          −
                        </button>
                      )}
                      {qty > 0 && (
                        <span className="w-5 text-center font-display text-lg text-yellow">{qty}</span>
                      )}
                      <button
                        onClick={() => onAdjust(item, 1)}
                        className="grid h-8 w-8 place-items-center rounded-full border-2 border-yellow text-lg font-bold text-yellow hover:bg-yellow/10"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  {qty > 0 && (
                    <input
                      value={entry?.notes || ""}
                      onChange={(e) => onNotes(item.id, e.target.value)}
                      placeholder="Note (es. senza cipolla)"
                      className="mt-2 w-full rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-paper placeholder:text-paper/30 focus:border-yellow/50 focus:outline-none"
                    />
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Footer con totale e invio */}
      <div className="shrink-0 border-t-2 border-white/15 bg-ink px-4 py-4">
        <div className="mb-3 flex items-baseline justify-between">
          <span className="text-sm text-paper/60">
            {cartCount} {cartCount === 1 ? "piatto" : "piatti"}
          </span>
          <span className="font-display text-2xl text-yellow">€ {cartTotal.toFixed(2)}</span>
        </div>
        <button
          onClick={onSubmit}
          disabled={busy || cartCount === 0}
          className="w-full rounded-xl border-2 border-yellow bg-yellow py-3.5 text-sm font-bold uppercase tracking-wider text-ink disabled:opacity-40"
        >
          {busy ? "Invio..." : "🍽️ Invia in cucina"}
        </button>
      </div>
    </div>
  );
}

// ── Cucina tab (embedded KDS) ────────────────────────────────────────────────

const KITCHEN_COLS = [
  { key: "pending", label: "In attesa",  color: "border-white/20",    label_cls: "text-paper/60" },
  { key: "cooking", label: "In cucina",  color: "border-yellow",      label_cls: "text-yellow" },
  { key: "ready",   label: "Pronti ✓",   color: "border-emerald-400", label_cls: "text-emerald-400" },
] as const;

const KITCHEN_ACTION: Record<string, { label: string; next: string; cls: string }> = {
  pending: { label: "▶ Inizia",  next: "cooking", cls: "bg-yellow text-ink" },
  cooking: { label: "✓ Pronto",  next: "ready",   cls: "bg-emerald-500 text-paper" },
  ready:   { label: "✓ Servito", next: "served",  cls: "bg-emerald-700/80 text-paper" },
};

function CucinaTab({ restaurantId, pin }: { restaurantId: string; pin: string }) {
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const today = isoDate(new Date());

  const loadOrders = useCallback(async () => {
    const { data: preorders } = await supabase
      .from("preorders")
      .select("id, reservation_id, customer_name, items, course_status, created_at")
      .eq("restaurant_id", restaurantId)
      .gte("created_at", today)
      .or("course_status.neq.served,course_status.is.null")
      .order("created_at");

    if (!preorders?.length) { setOrders([]); return; }

    const resvIds = [...new Set(preorders.map((p) => p.reservation_id).filter(Boolean))];
    const [{ data: resvs }, { data: tbls }] = await Promise.all([
      resvIds.length
        ? supabase.from("reservations").select("id, time, table_id").in("id", resvIds as string[])
        : Promise.resolve({ data: [] }),
      supabase.from("tables").select("id, code").eq("restaurant_id", restaurantId),
    ]);
    const resvMap = new Map((resvs || []).map((r) => [r.id, r]));
    const tableMap = new Map((tbls || []).map((t) => [t.id, t.code]));

    setOrders(
      preorders.map((p) => {
        const resv = p.reservation_id ? resvMap.get(p.reservation_id) : null;
        const tableCode = resv?.table_id ? (tableMap.get(resv.table_id) ?? null) : null;
        return {
          id: p.id,
          reservation_id: p.reservation_id,
          customer_name: p.customer_name,
          items: Array.isArray(p.items) ? (p.items as KitchenOrder["items"]) : [],
          course_status: (p as any).course_status ?? "pending",
          created_at: p.created_at ?? "",
          tableCode,
          reservationTime: resv?.time ?? null,
        };
      })
    );
  }, [restaurantId, today]);

  useEffect(() => {
    loadOrders();
    const ch = supabase
      .channel(`wk-pre-${restaurantId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "preorders", filter: `restaurant_id=eq.${restaurantId}` }, () => loadOrders())
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [restaurantId, loadOrders]);

  async function advance(order: KitchenOrder) {
    const action = KITCHEN_ACTION[order.course_status];
    if (!action) return;
    const { data, error } = await supabase.rpc("staff_set_course_status", {
      _pin: pin,
      _preorder_id: order.id,
      _course_status: action.next,
    });
    if (error || !data) toast.error("Errore aggiornamento stato");
  }

  const cols = KITCHEN_COLS.map((c) => ({
    ...c,
    items: orders.filter((o) => (o.course_status || "pending") === c.key),
  }));

  if (orders.length === 0) {
    return (
      <div className="py-20 text-center">
        <div className="text-5xl">✅</div>
        <p className="mt-4 font-display text-xl text-paper/40">Cucina libera</p>
        <p className="mt-1 text-sm text-paper/25">Nessun ordine in coda</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <span className="text-xs text-paper/50">{orders.length} ordini attivi</span>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {cols.map(({ key, label, color, label_cls, items: colOrders }) => (
          <div key={key} className={`rounded-2xl border-2 p-3 ${color}`}>
            <h3 className={`mb-2 flex items-center gap-2 font-display text-base ${label_cls}`}>
              {label}
              {colOrders.length > 0 && (
                <span className="rounded-full bg-white/10 px-1.5 py-0.5 font-mono text-xs">{colOrders.length}</span>
              )}
            </h3>
            {colOrders.length === 0 ? (
              <p className="py-6 text-center text-xs text-paper/20">Nessun ordine</p>
            ) : (
              <div className="space-y-2">
                {colOrders.map((order) => {
                  const action = KITCHEN_ACTION[order.course_status];
                  return (
                    <div key={order.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          {order.tableCode && (
                            <div className="font-display text-2xl leading-none text-yellow">{order.tableCode}</div>
                          )}
                          <div className="mt-0.5 truncate text-xs text-paper/50">
                            {order.customer_name || "Cliente"}
                            {order.reservationTime && ` · ${order.reservationTime}`}
                          </div>
                        </div>
                        {action && (
                          <button
                            onClick={() => advance(order)}
                            className={`shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-bold uppercase tracking-wider ${action.cls}`}
                          >
                            {action.label}
                          </button>
                        )}
                      </div>
                      <ul className="mt-2 divide-y divide-white/10">
                        {order.items.map((it, i) => (
                          <li key={i} className="flex flex-wrap items-baseline gap-x-2 py-1">
                            <span className="font-mono text-xs text-yellow">{it.qty}×</span>
                            <span className="text-sm">{it.name}</span>
                            {it.notes && <span className="text-xs italic text-paper/40">{it.notes}</span>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Badge ────────────────────────────────────────────────────────────────────

function Badge({ children, tone }: { children: React.ReactNode; tone?: "warn" | "ok" | "bill" }) {
  const cls =
    tone === "warn" ? "bg-amber-500/20 text-amber-300" :
    tone === "ok"   ? "bg-emerald-500/20 text-emerald-300" :
    tone === "bill" ? "bg-orange-500/20 text-orange-300" :
                      "bg-yellow/20 text-yellow";
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${cls}`}>{children}</span>;
}
