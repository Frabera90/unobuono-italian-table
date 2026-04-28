import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { isoDate } from "@/lib/restaurant";
import { toast } from "sonner";

export const Route = createFileRoute("/kitchen")({
  validateSearch: (search: Record<string, unknown>) => ({
    pin: typeof search.pin === "string" ? search.pin.toUpperCase() : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Cucina — Unobuono" },
      { name: "theme-color", content: "#0a0a0a" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "Cucina" },
    ],
    links: [{ rel: "manifest", href: "/staff.webmanifest" }],
  }),
  component: KitchenPage,
});

type OrderItem = { name: string; qty: number; price?: number; notes?: string };
type Order = {
  id: string;
  reservation_id: string | null;
  customer_name: string | null;
  items: OrderItem[];
  course_status: string;
  created_at: string;
  tableCode: string | null;
  reservationTime: string | null;
};

const COLS = [
  { key: "pending", label: "In attesa", color: "border-white/20 text-paper/60" },
  { key: "cooking", label: "In cucina", color: "border-yellow text-yellow" },
  { key: "ready",   label: "Pronti",    color: "border-emerald-400 text-emerald-400" },
] as const;

const NEXT_ACTION: Record<string, { label: string; next: string; cls: string }> = {
  pending: { label: "▶ Inizia",  next: "cooking", cls: "bg-yellow text-ink" },
  cooking: { label: "✓ Pronto",  next: "ready",   cls: "bg-emerald-500 text-paper" },
  ready:   { label: "✓ Servito", next: "served",  cls: "bg-emerald-700/80 text-paper" },
};

function KitchenPage() {
  const { pin: pinParam } = Route.useSearch();
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [pin, setPin] = useState(pinParam ?? "");
  const [pinBusy, setPinBusy] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);

  const loadOrders = useCallback(async (rid: string) => {
    const today = isoDate(new Date());
    const { data: preorders } = await supabase
      .from("preorders")
      .select("id, reservation_id, customer_name, items, course_status, created_at")
      .eq("restaurant_id", rid)
      .gte("created_at", today)
      .neq("course_status", "served")
      .order("created_at");

    if (!preorders?.length) { setOrders([]); return; }

    const resvIds = [...new Set(preorders.map((p) => p.reservation_id).filter(Boolean))];
    const [{ data: resvs }, { data: tbls }] = await Promise.all([
      resvIds.length
        ? supabase.from("reservations").select("id, time, table_id").in("id", resvIds as string[])
        : Promise.resolve({ data: [] }),
      supabase.from("tables").select("id, code").eq("restaurant_id", rid),
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
          items: Array.isArray(p.items) ? (p.items as OrderItem[]) : [],
          course_status: (p as any).course_status ?? "pending",
          created_at: p.created_at ?? "",
          tableCode,
          reservationTime: resv?.time ?? null,
        };
      })
    );
  }, []);

  // Auth check — reads kitchen.* keys (separate from waiter staff.* keys)
  useEffect(() => {
    const rid = localStorage.getItem("kitchen.restaurant_id");
    if (rid) {
      setRestaurantId(rid);
      setAuthChecked(true);
      return;
    }
    // Auto-login when PIN comes from URL
    if (pinParam) {
      void (async () => {
        const { data } = await supabase.rpc("restaurant_id_by_staff_pin", { _pin: pinParam });
        if (data) {
          localStorage.setItem("kitchen.restaurant_id", data as string);
          localStorage.setItem("kitchen.pin", pinParam);
          setRestaurantId(data as string);
        }
        setAuthChecked(true);
      })();
    } else {
      setAuthChecked(true);
    }
  }, [pinParam]);

  useEffect(() => {
    if (!restaurantId) return;
    loadOrders(restaurantId);
    const ch = supabase
      .channel("kitchen-" + restaurantId)
      .on("postgres_changes", { event: "*", schema: "public", table: "preorders", filter: `restaurant_id=eq.${restaurantId}` }, () => loadOrders(restaurantId))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [restaurantId, loadOrders]);

  async function advance(order: Order) {
    const p = localStorage.getItem("kitchen.pin");
    if (!p) return;
    const action = NEXT_ACTION[order.course_status];
    if (!action) return;
    const { data, error } = await supabase.rpc("staff_set_course_status", {
      _pin: p,
      _preorder_id: order.id,
      _course_status: action.next,
    });
    if (error || !data) toast.error("Errore aggiornamento stato");
  }

  async function doLogin() {
    const trimmed = pin.trim().toUpperCase();
    if (trimmed.length < 4) { toast.error("PIN non valido"); return; }
    setPinBusy(true);
    const { data } = await supabase.rpc("restaurant_id_by_staff_pin", { _pin: trimmed });
    setPinBusy(false);
    if (!data) { toast.error("PIN non valido"); return; }
    localStorage.setItem("kitchen.restaurant_id", data as string);
    localStorage.setItem("kitchen.pin", trimmed);
    setRestaurantId(data as string);
  }

  function logout() {
    localStorage.removeItem("kitchen.restaurant_id");
    localStorage.removeItem("kitchen.pin");
    setRestaurantId(null);
    setOrders([]);
  }

  if (!authChecked) return null;

  if (!restaurantId) {
    return (
      <div className="grid min-h-screen place-items-center bg-ink px-5">
        <div className="w-full max-w-xs text-center">
          <div className="mb-2 text-5xl">👨‍🍳</div>
          <h1 className="font-display text-4xl text-yellow">Cucina</h1>
          <p className="mt-2 text-sm text-paper/50">
            {pinParam ? "Verifica PIN cucina..." : "Inserisci il PIN cucina"}
          </p>
          {!pinParam && (
            <div className="mt-6 space-y-3">
              <input
                type="text"
                value={pin}
                onChange={(e) => setPin(e.target.value.toUpperCase())}
                placeholder="PIN"
                maxLength={8}
                autoCapitalize="characters"
                className="w-full rounded-xl border-2 border-white/20 bg-white/5 px-4 py-3 text-center font-display text-3xl tracking-[0.4em] text-yellow focus:border-yellow focus:outline-none"
                onKeyDown={(e) => e.key === "Enter" && doLogin()}
              />
              <button
                onClick={doLogin}
                disabled={pinBusy}
                className="w-full rounded-xl bg-yellow py-3 text-sm font-bold uppercase tracking-wider text-ink disabled:opacity-50"
              >
                {pinBusy ? "..." : "Accedi alla cucina"}
              </button>
            </div>
          )}
          <p className="mt-5 text-xs text-paper/30">PIN fornito dall'owner del ristorante</p>
        </div>
      </div>
    );
  }

  const cols = COLS.map((c) => ({
    ...c,
    orders: orders.filter((o) => (o.course_status || "pending") === c.key),
  }));

  const total = orders.length;

  return (
    <div className="min-h-screen bg-ink px-3 pb-6 pt-3 text-paper">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h1 className="font-display text-2xl text-yellow">👨‍🍳 Cucina</h1>
        <div className="flex items-center gap-3">
          {total > 0 && (
            <span className="rounded-full border border-yellow/30 px-2.5 py-0.5 font-mono text-xs text-yellow">
              {total} ordini attivi
            </span>
          )}
          <span className="font-mono text-xs text-paper/30">
            {new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}
          </span>
          <button
            onClick={logout}
            className="rounded-lg border border-white/15 px-2.5 py-1 text-xs text-paper/40 hover:text-paper/70"
          >
            Esci
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {cols.map(({ key, label, color, orders: colOrders }) => (
          <div key={key} className={`rounded-2xl border-2 p-3 ${color.split(" ")[0]}`}>
            <div className={`mb-3 flex items-center justify-between ${color.split(" ")[1]}`}>
              <h2 className="font-display text-xl">{label}</h2>
              {colOrders.length > 0 && (
                <span className="rounded-full bg-white/10 px-2 py-0.5 font-mono text-xs">
                  {colOrders.length}
                </span>
              )}
            </div>

            {colOrders.length === 0 ? (
              <p className="py-8 text-center text-sm text-paper/25">Nessun ordine</p>
            ) : (
              <div className="space-y-3">
                {colOrders.map((order) => {
                  const action = NEXT_ACTION[order.course_status];
                  return (
                    <div key={order.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                      <div className="mb-2 flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          {order.tableCode && (
                            <div className="font-display text-3xl leading-none text-yellow">{order.tableCode}</div>
                          )}
                          <div className="mt-0.5 truncate text-sm text-paper/60">
                            {order.customer_name || "Cliente"}
                            {order.reservationTime && ` · ${order.reservationTime}`}
                          </div>
                        </div>
                        {action && (
                          <button
                            onClick={() => advance(order)}
                            className={`shrink-0 rounded-lg px-3 py-2 text-xs font-bold uppercase tracking-wider ${action.cls}`}
                          >
                            {action.label}
                          </button>
                        )}
                      </div>
                      <ul className="mt-2 divide-y divide-white/10">
                        {order.items.map((it, i) => (
                          <li key={i} className="flex flex-wrap items-baseline justify-between gap-x-2 py-1.5">
                            <span className="text-sm">
                              <span className="font-mono text-xs text-yellow">{it.qty}×</span>{" "}
                              <span className="font-medium">{it.name}</span>
                            </span>
                            {it.notes && (
                              <span className="text-xs italic text-paper/40">{it.notes}</span>
                            )}
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

      {total === 0 && (
        <div className="mt-20 text-center">
          <div className="text-6xl">✅</div>
          <p className="mt-4 font-display text-2xl text-paper/40">Cucina libera</p>
          <p className="mt-1 text-sm text-paper/25">Nessun ordine in coda</p>
        </div>
      )}
    </div>
  );
}
