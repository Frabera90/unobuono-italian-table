import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useMemo } from "react";
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

type ItemStatus = "pending" | "cooking" | "ready" | "served";
type OrderItem = { name: string; qty: number; price?: number; notes?: string; status?: ItemStatus; category?: string | null };
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

const ITEM_NEXT: Record<ItemStatus, { label: string; next: ItemStatus; cls: string } | null> = {
  pending: { label: "▶ Inizia", next: "cooking", cls: "bg-yellow text-ink" },
  cooking: { label: "✓ Pronto", next: "ready", cls: "bg-emerald-500 text-paper" },
  ready: { label: "✓ Consegnato", next: "served", cls: "bg-emerald-700 text-paper" },
  served: null,
};

const ITEM_BADGE: Record<ItemStatus, string> = {
  pending: "border-white/20 text-paper/60 bg-white/5",
  cooking: "border-yellow/60 text-yellow bg-yellow/10",
  ready: "border-emerald-400 text-emerald-300 bg-emerald-500/15",
  served: "border-white/10 text-paper/30 bg-white/5 line-through",
};

function getItemStatus(it: OrderItem): ItemStatus {
  return (it.status as ItemStatus) || "pending";
}

function KitchenPage() {
  const { pin: pinParam } = Route.useSearch();
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [pin, setPin] = useState(pinParam ?? "");
  const [pinBusy, setPinBusy] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [menuCats, setMenuCats] = useState<Map<string, string | null>>(new Map());

  const loadOrders = useCallback(async (rid: string) => {
    const today = isoDate(new Date());
    // 1) Reservation di oggi del ristorante
    const { data: todayResvs } = await supabase
      .from("reservations")
      .select("id, time, table_id, customer_name")
      .eq("restaurant_id", rid)
      .eq("date", today)
      .neq("status", "cancelled");
    const todayResvIds = (todayResvs || []).map((r) => r.id);

    // 2) Preorder collegati a quelle reservation + walk-in di oggi senza reservation
    const orFilter = todayResvIds.length
      ? `reservation_id.in.(${todayResvIds.join(",")}),and(reservation_id.is.null,created_at.gte.${today})`
      : `and(reservation_id.is.null,created_at.gte.${today})`;
    const { data: preorders } = await supabase
      .from("preorders")
      .select("id, reservation_id, customer_name, items, course_status, created_at")
      .eq("restaurant_id", rid)
      .neq("course_status", "served")
      .or(orFilter)
      .order("created_at");

    if (!preorders?.length) { setOrders([]); return; }

    const { data: tbls } = await supabase
      .from("tables").select("id, code").eq("restaurant_id", rid);
    const resvMap = new Map((todayResvs || []).map((r) => [r.id, r]));
    const tableMap = new Map((tbls || []).map((t) => [t.id, t.code]));

    setOrders(
      preorders.map((p) => {
        const resv = p.reservation_id ? resvMap.get(p.reservation_id) : null;
        const tableCode = resv?.table_id ? (tableMap.get(resv.table_id) ?? null) : null;
        return {
          id: p.id,
          reservation_id: p.reservation_id,
          customer_name: p.customer_name || resv?.customer_name || null,
          items: Array.isArray(p.items) ? (p.items as OrderItem[]) : [],
          course_status: (p as any).course_status ?? "pending",
          created_at: p.created_at ?? "",
          tableCode,
          reservationTime: resv?.time ?? null,
        };
      })
    );
  }, []);

  // Auth check
  useEffect(() => {
    const rid = localStorage.getItem("kitchen.restaurant_id");
    if (rid) {
      setRestaurantId(rid);
      setAuthChecked(true);
      return;
    }
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
    // Carica categorie menu per badge categoria
    void supabase.from("menu_items").select("name,category").eq("restaurant_id", restaurantId)
      .then(({ data }) => {
        const m = new Map<string, string | null>();
        (data || []).forEach((mi) => m.set(mi.name, mi.category));
        setMenuCats(m);
      });
    const ch = supabase
      .channel("kitchen-" + restaurantId)
      .on("postgres_changes", { event: "*", schema: "public", table: "preorders", filter: `restaurant_id=eq.${restaurantId}` }, () => loadOrders(restaurantId))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [restaurantId, loadOrders]);

  async function advanceItem(orderId: string, itemIndex: number, currentStatus: ItemStatus) {
    const p = localStorage.getItem("kitchen.pin");
    if (!p) return;
    const action = ITEM_NEXT[currentStatus];
    if (!action) return;
    const { data, error } = await supabase.rpc("staff_set_item_status", {
      _pin: p,
      _preorder_id: orderId,
      _item_index: itemIndex,
      _status: action.next,
    });
    if (error || !data) toast.error("Errore aggiornamento piatto");
  }

  async function confirmPreorder(orderId: string) {
    const p = localStorage.getItem("kitchen.pin");
    if (!p) return;
    // Cucina non può confermare; mostra info
    toast.info("Solo il cameriere può confermare il pre-ordine dopo l'arrivo del cliente");
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

  // Raggruppa per tavolo (o per reservation se senza tavolo, o per ID preorder se walk-in senza nulla).
  // Cucina vuole vedere "Tavolo 5" con tutti i piatti, non card separate per ogni round di ordine.
  const groupsByTable = useMemo(() => {
    const map = new Map<string, Order[]>();
    for (const o of orders) {
      const key = o.tableCode ? `T:${o.tableCode}` : (o.reservation_id ? `R:${o.reservation_id}` : `O:${o.id}`);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(o);
    }
    // Ordina i gruppi: awaiting in fondo, poi per orario
    return Array.from(map.entries())
      .map(([key, grp]) => ({
        key,
        orders: grp.sort((a, b) => a.created_at.localeCompare(b.created_at)),
        // status del gruppo = se ALMENO uno è non-awaiting allora il gruppo è attivo
        anyActive: grp.some((g) => g.course_status !== "awaiting"),
        firstTime: grp[0].reservationTime || grp[0].created_at,
      }))
      .sort((a, b) => {
        if (a.anyActive !== b.anyActive) return a.anyActive ? -1 : 1;
        return a.firstTime.localeCompare(b.firstTime);
      });
  }, [orders]);

  const total = orders.length;

  return (
    <div className="min-h-screen bg-ink px-3 pb-6 pt-3 text-paper">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h1 className="font-display text-2xl text-yellow">👨‍🍳 Cucina</h1>
        <div className="flex items-center gap-3">
          {total > 0 && (
            <span className="rounded-full border border-yellow/30 px-2.5 py-0.5 font-mono text-xs text-yellow">
              {groupsByTable.length} tavoli · {total} comande
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

      {groupsByTable.length === 0 ? (
        <div className="mt-20 text-center">
          <div className="text-6xl">✅</div>
          <p className="mt-4 font-display text-2xl text-paper/40">Cucina libera</p>
          <p className="mt-1 text-sm text-paper/25">Nessuna comanda in coda</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {groupsByTable.map((g) => (
            <TableGroupCard
              key={g.key}
              orders={g.orders}
              menuCats={menuCats}
              onAdvanceItem={advanceItem}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function OrderCard({
  order,
  menuCats,
  onAdvanceItem,
}: {
  order: Order;
  menuCats: Map<string, string | null>;
  onAdvanceItem: (orderId: string, itemIndex: number, status: ItemStatus) => void;
}) {
  const isAwaiting = order.course_status === "awaiting";

  // Raggruppa items per categoria mantenendo l'indice originale
  const grouped = useMemo(() => {
    const groups = new Map<string, { idx: number; item: OrderItem }[]>();
    order.items.forEach((it, idx) => {
      const cat = it.category || menuCats.get(it.name) || "Altro";
      if (!groups.has(cat)) groups.set(cat, []);
      groups.get(cat)!.push({ idx, item: it });
    });
    return Array.from(groups.entries());
  }, [order.items, menuCats]);

  // Stats per progress
  const total = order.items.reduce((s, i) => s + (i.qty || 1), 0);
  const served = order.items.filter((i) => getItemStatus(i) === "served").reduce((s, i) => s + (i.qty || 1), 0);
  const ready = order.items.filter((i) => getItemStatus(i) === "ready").length;
  const cooking = order.items.filter((i) => getItemStatus(i) === "cooking").length;

  return (
    <div className={`rounded-2xl border-2 p-4 ${isAwaiting ? "border-orange-400/50 bg-orange-400/5" : "border-white/15 bg-white/5"}`}>
      {/* Header */}
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          {order.tableCode && (
            <div className="font-display text-4xl leading-none text-yellow">{order.tableCode}</div>
          )}
          <div className="mt-1 truncate text-sm text-paper/70">
            {order.customer_name || "Cliente"}
            {order.reservationTime && ` · ${order.reservationTime}`}
          </div>
        </div>
        {isAwaiting ? (
          <span className="shrink-0 rounded-lg border border-orange-400/40 bg-orange-400/10 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-orange-300">
            ⏸ Attesa cameriere
          </span>
        ) : (
          <div className="shrink-0 text-right text-xs">
            <div className="font-mono text-paper/50">{served}/{total}</div>
            {(cooking > 0 || ready > 0) && (
              <div className="mt-0.5 text-[10px]">
                {cooking > 0 && <span className="text-yellow">{cooking}🔥</span>}
                {cooking > 0 && ready > 0 && " "}
                {ready > 0 && <span className="text-emerald-400">{ready}✓</span>}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Items grouped by category */}
      <div className="space-y-3">
        {grouped.map(([cat, entries]) => (
          <div key={cat}>
            <div className="mb-1.5 flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-paper/40">{cat}</span>
              <span className="h-px flex-1 bg-white/10" />
            </div>
            <ul className="space-y-1.5">
              {entries.map(({ idx, item }) => {
                const status = getItemStatus(item);
                const action = ITEM_NEXT[status];
                return (
                  <li
                    key={idx}
                    className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 ${ITEM_BADGE[status]}`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className="font-mono text-xs">{item.qty}×</span>
                        <span className="text-sm font-medium">{item.name}</span>
                      </div>
                      {item.notes && (
                        <div className="mt-0.5 text-xs italic text-paper/50">📝 {item.notes}</div>
                      )}
                    </div>
                    {!isAwaiting && action && (
                      <button
                        onClick={() => onAdvanceItem(order.id, idx, status)}
                        className={`shrink-0 rounded-md px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider ${action.cls}`}
                      >
                        {action.label}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
