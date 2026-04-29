import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { type MenuItem, type RestaurantSettings } from "@/lib/restaurant";
import { toast } from "sonner";

export const Route = createFileRoute("/menu/$tableNumber")({
  head: () => ({
    meta: [{ title: "Menu — Unobuono" }, { name: "description", content: "Il menu live al tuo tavolo." }],
  }),
  component: MenuPage,
});

const QUICK = [
  "Vorrei ordinare",
  "Il conto per favore",
  "Informazioni allergeni",
  "Altra richiesta",
];

type ActiveReservation = {
  id: string;
  customer_name: string;
  party_size: number;
  date: string;
  time: string;
  arrived: boolean;
};

function MenuPage() {
  const { tableNumber } = Route.useParams();
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [settings, setSettings] = useState<RestaurantSettings | null>(null);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [activeRes, setActiveRes] = useState<ActiveReservation | null>(null);
  const [recentlyChanged, setRecentlyChanged] = useState<Set<string>>(new Set());
  const [callOpen, setCallOpen] = useState(false);
  const [preorderOpen, setPreorderOpen] = useState(false);

  // Resolve restaurant from query string ?r=slug or ?tid=tableId
  useEffect(() => {
    void (async () => {
      const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
      const slug = params.get("r");
      const tid = params.get("tid");
      let rid: string | null = null;
      if (slug) {
        const { data: r } = await supabase.from("restaurants").select("id").eq("slug", slug).maybeSingle();
        rid = r?.id ?? null;
      }
      if (!rid && tid) {
        const { data: t } = await supabase.from("tables").select("restaurant_id").eq("id", tid).maybeSingle();
        rid = t?.restaurant_id ?? null;
      }
      if (!rid) return;
      setRestaurantId(rid);

      const [{ data: s }, { data: m }] = await Promise.all([
        supabase.from("restaurant_settings").select("*").eq("restaurant_id", rid).maybeSingle(),
        supabase.from("menu_items").select("*").eq("restaurant_id", rid).order("sort_order"),
      ]);
      setSettings(s as RestaurantSettings | null);
      setItems((m || []) as MenuItem[]);

      // Find an active reservation today on this table
      const today = new Date().toISOString().slice(0, 10);
      let resQ = supabase
        .from("reservations")
        .select("id,customer_name,party_size,date,time")
        .eq("restaurant_id", rid)
        .eq("date", today)
        .neq("status", "cancelled")
        .order("time");
      if (tid) resQ = resQ.eq("table_id", tid);
      const { data: rs } = await resQ;
      // pick the closest in time, but only if within ±3h (altrimenti walk-in)
      if (rs && rs.length) {
        const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
        const sorted = [...rs]
          .map((r) => ({ r, diff: Math.abs(toMin(r.time) - nowMin) }))
          .sort((a, b) => a.diff - b.diff);
        const best = sorted[0];
        if (best && best.diff <= 180) {
          setActiveRes(best.r as ActiveReservation);
        }
      }

      const ch = supabase
        .channel("menu-public-" + rid)
        .on("postgres_changes", { event: "*", schema: "public", table: "menu_items", filter: `restaurant_id=eq.${rid}` }, (payload) => {
          const row = (payload.new || payload.old) as MenuItem;
          if (payload.eventType === "DELETE") {
            setItems((prev) => prev.filter((i) => i.id !== row.id));
            return;
          }
          setItems((prev) => {
            const idx = prev.findIndex((i) => i.id === row.id);
            if (idx === -1) return [...prev, row].sort((a, b) => a.sort_order - b.sort_order);
            const copy = [...prev];
            copy[idx] = row;
            return copy;
          });
          setRecentlyChanged((s) => new Set(s).add(row.id));
          setTimeout(() => setRecentlyChanged((s) => {
            const n = new Set(s);
            n.delete(row.id);
            return n;
          }), 2200);
        })
        .subscribe();
      return () => { supabase.removeChannel(ch); };
    })();
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<string, MenuItem[]>();
    for (const it of items) {
      const k = it.category || "Altro";
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(it);
    }
    return Array.from(map.entries());
  }, [items]);

  if (!restaurantId) {
    return (
      <main className="grid min-h-screen place-items-center bg-cream px-5 text-center">
        <div>
          <h1 className="font-display text-3xl uppercase">Menu non disponibile</h1>
          <p className="mt-2 text-sm text-ink/60">Questo QR non è collegato a un ristorante. Chiedi al cameriere.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-paper pb-32">
      <header className="sticky top-0 z-20 border-b-2 border-ink bg-yellow px-5 py-4">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-ink font-display text-yellow">U</span>
            <div>
              <h1 className="font-display text-2xl uppercase leading-none tracking-tight text-ink">{settings?.name || "Il ristorante"}</h1>
              <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.25em] text-ink/70">Tavolo {tableNumber} · Menu live</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-full border-2 border-ink bg-paper px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-ink">
            <span className="live-dot" /> live
          </div>
        </div>
        {activeRes ? (
          <div className="mx-auto mt-3 max-w-3xl rounded-xl border-2 border-ink bg-paper px-3 py-2 text-sm">
            👋 Ciao <strong>{activeRes.customer_name}</strong>! Prenotazione delle {activeRes.time} per {activeRes.party_size}.
          </div>
        ) : (
          <div className="mx-auto mt-3 max-w-3xl rounded-xl border-2 border-ink bg-paper px-3 py-2 text-sm">
            👋 Benvenuto! Sfoglia il menu, chiama il cameriere quando vuoi ordinare.
          </div>
        )}
      </header>

      <div className="mx-auto max-w-3xl px-5 py-8">
        {grouped.length === 0 && <p className="text-center text-muted-foreground">Nessun piatto disponibile.</p>}
        {grouped.map(([cat, list]) => (
          <section key={cat} className="mb-12">
            <div className="flex items-baseline justify-between">
              <h2 className="font-display text-4xl uppercase text-ink md:text-5xl">{cat}</h2>
              <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink/50">{list.length} piatti</span>
            </div>
            <div className="mt-2 h-1 w-16 bg-yellow" />
            <ul className="mt-6 space-y-3">
              {list.map((it) => {
                const flash = recentlyChanged.has(it.id);
                return (
                  <li
                    key={it.id}
                    className={`flex gap-4 rounded-2xl border-2 border-ink bg-paper p-4 transition ${flash ? "ring-pulse-gold bg-yellow" : ""} ${
                      !it.available ? "opacity-50" : ""
                    }`}
                  >
                    {it.photo_url && (
                      <img src={it.photo_url} alt={it.name} className="h-20 w-20 shrink-0 rounded-xl border-2 border-ink object-cover" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-3">
                        <h3 className="font-display text-lg uppercase">{it.name}</h3>
                        <span className={`shrink-0 rounded-full bg-yellow px-2.5 py-0.5 font-display text-base text-ink ${!it.available ? "line-through" : ""}`}>
                          {it.price != null ? `€ ${Number(it.price).toFixed(2).replace(".", ",")}` : ""}
                        </span>
                      </div>
                      {it.description && <p className="mt-1 text-sm text-ink/70">{it.description}</p>}
                      <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] font-bold uppercase tracking-wider">
                        {it.allergens && <span className="rounded-full bg-cream-dark px-2 py-0.5 text-ink/70">{it.allergens}</span>}
                        {!it.available && <span className="rounded-full bg-destructive px-2 py-0.5 text-paper">Non disponibile stasera</span>}
                        {flash && <span className="rounded-full bg-ink px-2 py-0.5 text-yellow">⚡ aggiornato</span>}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      {/* Sticky bottom bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t-2 border-ink bg-paper px-4 py-3">
        <div className="mx-auto flex max-w-3xl gap-3">
          <button
            onClick={() => setCallOpen(true)}
            className="flex-1 rounded-xl border-2 border-ink bg-paper py-3.5 text-sm font-bold uppercase tracking-wider text-ink shadow-brut-sm transition hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-brut"
          >
            🙋 Cameriere
          </button>
          <button
            onClick={() => setPreorderOpen(true)}
            className="flex-1 rounded-xl border-2 border-ink bg-yellow py-3.5 text-sm font-bold uppercase tracking-wider text-ink shadow-brut-sm transition hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-brut"
            title={activeRes ? "Fai preparare i piatti in anticipo." : "Pre-ordina anche senza prenotazione: lo staff lo riceve subito."}
          >
            🛵 {activeRes ? "Pre-ordina" : "Ordina"}
          </button>
        </div>
      </div>

      {callOpen && <WaiterCallSheet table={tableNumber} restaurantId={restaurantId} reservationId={activeRes?.id ?? null} defaultName={activeRes?.customer_name ?? ""} onClose={() => setCallOpen(false)} />}
      {preorderOpen && <PreorderOverlay items={items} restaurantId={restaurantId} reservationId={activeRes?.id ?? null} tableNumber={tableNumber} defaultName={activeRes?.customer_name ?? ""} onClose={() => setPreorderOpen(false)} />}
    </main>
  );
}

function toMin(t: string) { const [h, m] = t.split(":").map(Number); return h * 60 + (m || 0); }

function WaiterCallSheet({ table, restaurantId, reservationId, defaultName, onClose }: { table: string; restaurantId: string; reservationId: string | null; defaultName: string; onClose: () => void }) {
  const [msg, setMsg] = useState<string>(QUICK[0]);
  const [custom, setCustom] = useState("");
  const [name, setName] = useState(defaultName);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function send() {
    setBusy(true);
    const message = custom.trim() || msg;
    const { error } = await supabase.from("waiter_calls").insert({
      restaurant_id: restaurantId,
      reservation_id: reservationId,
      table_number: table,
      message,
      customer_name: name || null,
    });
    setBusy(false);
    if (error) { toast.error("Errore: " + error.message); return; }
    setDone(true);
    setTimeout(onClose, 1800);
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/40" onClick={onClose}>
      <div className="w-full max-w-lg rounded-t-3xl bg-card p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {done ? (
          <div className="py-10 text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-terracotta/10 text-2xl text-terracotta">✓</div>
            <p className="mt-3 font-display text-xl">Il cameriere arriva subito!</p>
          </div>
        ) : (
          <>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-display text-2xl">Chiama il cameriere</h3>
              <button onClick={onClose} className="text-2xl text-muted-foreground">×</button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {QUICK.map((q) => (
                <button key={q} onClick={() => { setMsg(q); setCustom(""); }} className={`rounded-lg border p-3 text-left text-sm transition ${msg === q && !custom ? "border-terracotta bg-terracotta/5" : "border-border bg-background"}`}>{q}</button>
              ))}
            </div>
            <input placeholder="Oppure scrivi qui..." className="mt-3 w-full rounded-lg border border-border bg-background p-3 text-sm" value={custom} onChange={(e) => setCustom(e.target.value)} />
            <input placeholder="Il tuo nome (opzionale)" className="mt-2 w-full rounded-lg border border-border bg-background p-3 text-sm" value={name} onChange={(e) => setName(e.target.value)} />
            <button onClick={send} disabled={busy} className="mt-5 w-full rounded-md bg-terracotta py-3.5 font-medium text-paper hover:bg-terracotta-dark disabled:opacity-40">{busy ? "Invio..." : "Conferma"}</button>
          </>
        )}
      </div>
    </div>
  );
}

function PreorderOverlay({ items, restaurantId, reservationId, tableNumber, defaultName, onClose }: { items: MenuItem[]; restaurantId: string; reservationId: string | null; tableNumber: string; defaultName: string; onClose: () => void }) {
  const [qty, setQty] = useState<Record<string, number>>({});
  const [name, setName] = useState(defaultName);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const total = useMemo(() => items.reduce((s, it) => s + (qty[it.id] || 0) * (Number(it.price) || 0), 0), [items, qty]);
  const grouped = useMemo(() => {
    const m = new Map<string, MenuItem[]>();
    for (const it of items.filter((i) => i.available && i.price)) {
      const k = it.category || "Altro";
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(it);
    }
    return Array.from(m.entries());
  }, [items]);

  async function submit() {
    if (!name.trim()) { toast.error("Inserisci il tuo nome"); return; }
    const selected = items.filter((i) => qty[i.id]).map((i) => ({ id: i.id, name: i.name, qty: qty[i.id], price: Number(i.price) }));
    if (selected.length === 0) { toast.error("Aggiungi almeno un piatto"); return; }
    setBusy(true);
    // Walk-in: prefisso "Tav. X — Nome" così lo staff vede subito da quale tavolo arriva
    const customerLabel = reservationId ? name : `Tav. ${tableNumber} — ${name}`;
    const { error } = await supabase.from("preorders").insert({
      restaurant_id: restaurantId,
      reservation_id: reservationId,
      customer_name: customerLabel,
      items: selected,
      total,
      status: "pending",
    });
    setBusy(false);
    if (error) { toast.error("Errore: " + error.message); return; }
    setDone(true);
    setTimeout(onClose, 2200);
  }

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-cream">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-cream/95 px-5 py-4 backdrop-blur">
        <div>
          <h2 className="font-display text-xl leading-none">{reservationId ? "Pre-ordina" : "Ordina al tavolo"}</h2>
          <p className="mt-1 text-[11px] text-muted-foreground">{reservationId ? "Aiuta la cucina a prepararsi: arrivi, ti siedi e mangi subito." : `Tavolo ${tableNumber} · l'ordine arriva subito allo staff.`}</p>
        </div>
        <button onClick={onClose} className="text-2xl text-muted-foreground">×</button>
      </div>

      {done ? (
        <div className="py-20 text-center">
          <div className="text-6xl">🎉</div>
          <p className="mt-4 font-display text-2xl">Ordine ricevuto!</p>
          <p className="mt-1 text-muted-foreground">Iniziamo a preparare.</p>
        </div>
      ) : (
        <>
          <div className="mx-auto max-w-2xl px-5 py-6 pb-40">
            {!reservationId && (
              <div className="mb-4 rounded-lg border border-border bg-paper p-3 text-xs text-ink/70">
                ℹ️ Stai ordinando come <b>walk-in</b> dal tavolo <b>{tableNumber}</b>. Lo staff riceverà l'ordine subito.
              </div>
            )}
            {grouped.map(([cat, list]) => (
              <section key={cat} className="mb-7">
                <h3 className="font-display text-xl italic text-terracotta">{cat}</h3>
                <ul className="mt-3 space-y-2">
                  {list.map((it) => (
                    <li key={it.id} className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium">{it.name}</div>
                        <div className="text-xs text-terracotta">€ {Number(it.price).toFixed(2).replace(".", ",")}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => setQty((q) => ({ ...q, [it.id]: Math.max(0, (q[it.id] || 0) - 1) }))} className="h-8 w-8 rounded-full border border-border text-lg leading-none">−</button>
                        <span className="w-6 text-center text-sm font-medium">{qty[it.id] || 0}</span>
                        <button onClick={() => setQty((q) => ({ ...q, [it.id]: (q[it.id] || 0) + 1 }))} className="h-8 w-8 rounded-full bg-terracotta text-lg leading-none text-paper">+</button>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
          <div className="fixed inset-x-0 bottom-0 border-t border-border bg-cream/95 p-4 backdrop-blur">
            <div className="mx-auto max-w-2xl">
              <input placeholder="Come ti chiami?" className="w-full rounded-lg border border-border bg-card p-3 text-sm" value={name} onChange={(e) => setName(e.target.value)} />
              <div className="mt-3 flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs text-muted-foreground">Totale</div>
                  <div className="font-display text-2xl text-terracotta">€ {total.toFixed(2).replace(".", ",")}</div>
                </div>
                <button onClick={submit} disabled={busy || !name.trim() || total === 0} className="rounded-md bg-terracotta px-6 py-3 font-medium text-paper hover:bg-terracotta-dark disabled:opacity-40">{busy ? "Invio..." : (reservationId ? "Manda pre-ordine" : "Manda ordine")}</button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
