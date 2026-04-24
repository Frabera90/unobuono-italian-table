import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getSettings, type MenuItem, type RestaurantSettings } from "@/lib/restaurant";
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

function MenuPage() {
  const { tableNumber } = Route.useParams();
  const [settings, setSettings] = useState<RestaurantSettings | null>(null);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [recentlyChanged, setRecentlyChanged] = useState<Set<string>>(new Set());
  const [callOpen, setCallOpen] = useState(false);
  const [preorderOpen, setPreorderOpen] = useState(false);

  useEffect(() => {
    getSettings().then(setSettings);
    supabase.from("menu_items").select("*").order("sort_order").then(({ data }) => setItems((data || []) as MenuItem[]));

    const ch = supabase
      .channel("menu-public")
      .on("postgres_changes", { event: "*", schema: "public", table: "menu_items" }, (payload) => {
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
      </header>

      <div className="mx-auto max-w-3xl px-5 py-8">
        {grouped.length === 0 && <p className="text-center text-muted-foreground">Caricamento...</p>}
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
          >
            🛵 Pre-ordina
          </button>
        </div>
      </div>

      {callOpen && <WaiterCallSheet table={tableNumber} onClose={() => setCallOpen(false)} />}
      {preorderOpen && <PreorderOverlay items={items} onClose={() => setPreorderOpen(false)} />}
    </main>
  );
}

function WaiterCallSheet({ table, onClose }: { table: string; onClose: () => void }) {
  const [msg, setMsg] = useState<string>(QUICK[0]);
  const [custom, setCustom] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function send() {
    setBusy(true);
    const message = custom.trim() || msg;
    const { error } = await supabase.from("waiter_calls").insert({
      table_number: table,
      message,
      customer_name: name || null,
    });
    setBusy(false);
    if (error) {
      toast.error("Errore: " + error.message);
      return;
    }
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
                <button
                  key={q}
                  onClick={() => { setMsg(q); setCustom(""); }}
                  className={`rounded-lg border p-3 text-left text-sm transition ${msg === q && !custom ? "border-terracotta bg-terracotta/5" : "border-border bg-background"}`}
                >
                  {q}
                </button>
              ))}
            </div>
            <input
              placeholder="Oppure scrivi qui..."
              className="mt-3 w-full rounded-lg border border-border bg-background p-3 text-sm"
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
            />
            <input
              placeholder="Il tuo nome (opzionale)"
              className="mt-2 w-full rounded-lg border border-border bg-background p-3 text-sm"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <button onClick={send} disabled={busy} className="mt-5 w-full rounded-md bg-terracotta py-3.5 font-medium text-paper hover:bg-terracotta-dark disabled:opacity-40">
              {busy ? "Invio..." : "Conferma"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function PreorderOverlay({ items, onClose }: { items: MenuItem[]; onClose: () => void }) {
  const [qty, setQty] = useState<Record<string, number>>({});
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const total = useMemo(() => {
    return items.reduce((s, it) => s + (qty[it.id] || 0) * (Number(it.price) || 0), 0);
  }, [items, qty]);

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
    if (!name.trim()) return;
    const selected = items
      .filter((i) => qty[i.id])
      .map((i) => ({ name: i.name, qty: qty[i.id], price: Number(i.price) }));
    if (selected.length === 0) return;
    setBusy(true);
    const { error } = await supabase.from("preorders").insert({
      customer_name: name,
      items: selected,
      total,
    });
    setBusy(false);
    if (error) {
      toast.error("Errore: " + error.message);
      return;
    }
    setDone(true);
    setTimeout(onClose, 2200);
  }

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-cream">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-cream/95 px-5 py-4 backdrop-blur">
        <h2 className="font-display text-xl">Ordina prima di sederti</h2>
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
                        <button
                          onClick={() => setQty((q) => ({ ...q, [it.id]: Math.max(0, (q[it.id] || 0) - 1) }))}
                          className="h-8 w-8 rounded-full border border-border text-lg leading-none"
                        >
                          −
                        </button>
                        <span className="w-6 text-center text-sm font-medium">{qty[it.id] || 0}</span>
                        <button
                          onClick={() => setQty((q) => ({ ...q, [it.id]: (q[it.id] || 0) + 1 }))}
                          className="h-8 w-8 rounded-full bg-terracotta text-lg leading-none text-paper"
                        >
                          +
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
          <div className="fixed inset-x-0 bottom-0 border-t border-border bg-cream/95 p-4 backdrop-blur">
            <div className="mx-auto max-w-2xl">
              <input
                placeholder="Come ti chiami?"
                className="w-full rounded-lg border border-border bg-card p-3 text-sm"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <div className="mt-3 flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs text-muted-foreground">Totale</div>
                  <div className="font-display text-2xl text-terracotta">€ {total.toFixed(2).replace(".", ",")}</div>
                </div>
                <button
                  onClick={submit}
                  disabled={busy || !name.trim() || total === 0}
                  className="rounded-md bg-terracotta px-6 py-3 font-medium text-paper hover:bg-terracotta-dark disabled:opacity-40"
                >
                  {busy ? "Invio..." : "Manda ordine"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
