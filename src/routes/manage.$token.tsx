import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fmtDate } from "@/lib/restaurant";
import { toast } from "sonner";

export const Route = createFileRoute("/manage/$token")({
  head: () => ({ meta: [{ title: "La tua prenotazione — Unobuono" }] }),
  component: ManagePage,
});

type Reservation = {
  id: string;
  customer_name: string;
  customer_email: string | null;
  party_size: number;
  date: string;
  time: string;
  zone_name: string | null;
  status: string | null;
  cancelled_at: string | null;
  restaurant_id: string;
  occasion: string | null;
  allergies: string | null;
  notes: string | null;
};

type Restaurant = { name: string; slug: string };
type Settings = { phone: string | null; address: string | null; preorder_hours_before: number | null };
type MenuItem = { id: string; name: string; description: string | null; price: number | null; category: string | null };

function ManagePage() {
  const { token } = Route.useParams();
  const [loading, setLoading] = useState(true);
  const [resv, setResv] = useState<Reservation | null>(null);
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [showPreorder, setShowPreorder] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const { data: r } = await supabase
        .from("reservations")
        .select("id,customer_name,customer_email,party_size,date,time,zone_name,status,cancelled_at,restaurant_id,occasion,allergies,notes")
        .eq("manage_token", token)
        .maybeSingle();
      if (!r || !r.restaurant_id) { setLoading(false); return; }
      setResv(r as Reservation);
      const rid = r.restaurant_id;
      const [{ data: rest }, { data: s }, { data: m }] = await Promise.all([
        supabase.from("restaurants").select("name,slug").eq("id", rid).maybeSingle(),
        supabase.from("restaurant_settings").select("phone,address,preorder_hours_before").eq("restaurant_id", rid).maybeSingle(),
        supabase.from("menu_items").select("id,name,description,price,category").eq("restaurant_id", rid).eq("available", true).order("sort_order"),
      ]);
      setRestaurant(rest as Restaurant | null);
      setSettings(s as Settings | null);
      setMenu((m || []) as MenuItem[]);
      setLoading(false);
    })();
  }, [token]);

  async function cancelReservation() {
    if (!resv) return;
    if (!confirm("Sicuro di voler disdire la prenotazione? Il tavolo verrà liberato.")) return;
    setSubmitting(true);
    const { error } = await supabase
      .from("reservations")
      .update({ status: "cancelled" })
      .eq("manage_token", token);
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Prenotazione disdetta. Riceverai una email di conferma.");
    setResv({ ...resv, status: "cancelled", cancelled_at: new Date().toISOString() });
    if (resv.customer_email) {
      const { sendBookingEmail, buildBookingEmailData } = await import("@/lib/email/booking");
      void sendBookingEmail({
        templateName: "booking-cancellation",
        recipientEmail: resv.customer_email,
        reservationId: resv.id,
        templateData: buildBookingEmailData({
          customerName: resv.customer_name,
          restaurantName: restaurant?.name || null,
          date: resv.date,
          time: resv.time,
          partySize: resv.party_size,
          reason: "Richiesta dal cliente",
        }),
      });
    }
    if (resv.restaurant_id) {
      const { notifyOwner } = await import("@/lib/email/notify-owner");
      void notifyOwner({
        restaurantId: resv.restaurant_id,
        reservationId: resv.id,
        eventType: "cancellation",
        customerName: resv.customer_name,
        date: resv.date,
        time: resv.time,
        partySize: resv.party_size,
        details: "Disdetta dal cliente tramite link di gestione",
      });
    }
  }

  async function submitPreorder() {
    if (!resv) return;
    const items = Object.entries(cart)
      .filter(([, qty]) => qty > 0)
      .map(([id, qty]) => {
        const m = menu.find((x) => x.id === id)!;
        return { id, name: m.name, qty, price: Number(m.price || 0) };
      });
    if (items.length === 0) { toast.error("Aggiungi almeno un piatto"); return; }
    const total = items.reduce((s, i) => s + i.price * i.qty, 0);
    setSubmitting(true);
    const { error } = await supabase.from("preorders").insert({
      restaurant_id: resv.restaurant_id,
      reservation_id: resv.id,
      customer_name: resv.customer_name,
      items: items as any,
      total,
      status: "pending",
    });
    if (!error) {
      await supabase.from("reservations").update({ preorder_link_sent: true }).eq("manage_token", token);
    }
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Pre-ordine inviato! Lo troverai pronto al tuo arrivo.");
    setShowPreorder(false);
    setCart({});
  }

  if (loading) return <div className="grid min-h-screen place-items-center bg-cream"><p className="text-sm text-ink/60">Caricamento…</p></div>;

  if (!resv) {
    return (
      <div className="grid min-h-screen place-items-center bg-cream px-5 text-center">
        <div>
          <h1 className="font-display text-3xl uppercase">Prenotazione non trovata</h1>
          <p className="mt-2 text-sm text-ink/60">Il link potrebbe essere scaduto o non valido.</p>
        </div>
      </div>
    );
  }

  const isCancelled = resv.status === "cancelled";
  const byCategory = new Map<string, MenuItem[]>();
  for (const it of menu) {
    const k = it.category || "Altro";
    if (!byCategory.has(k)) byCategory.set(k, []);
    byCategory.get(k)!.push(it);
  }
  const cartTotal = Object.entries(cart).reduce((s, [id, qty]) => {
    const m = menu.find((x) => x.id === id);
    return s + (m?.price ? Number(m.price) * qty : 0);
  }, 0);

  return (
    <main className="min-h-screen bg-cream pb-16">
      <header className="border-b-2 border-ink bg-yellow">
        <div className="mx-auto max-w-2xl px-5 py-8">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-ink/70">La tua prenotazione</p>
          <h1 className="mt-2 font-display text-4xl uppercase tracking-tight text-ink">{restaurant?.name}</h1>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-5 py-8">
        {/* Reservation card */}
        <section className={`rounded-2xl border-2 border-ink p-6 shadow-[6px_6px_0_0_hsl(var(--ink))] ${isCancelled ? "bg-muted" : "bg-paper"}`}>
          {isCancelled && (
            <div className="mb-4 rounded-lg bg-destructive/10 px-3 py-2 text-center text-sm font-bold uppercase tracking-wider text-destructive">
              ❌ Prenotazione disdetta
            </div>
          )}
          <p className="font-mono text-[11px] uppercase tracking-wider text-ink/60">Per</p>
          <p className="font-display text-2xl uppercase">{resv.customer_name}</p>

          <div className="mt-4 grid grid-cols-3 gap-3 border-y border-ink/10 py-4">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-wider text-ink/50">Data</p>
              <p className="mt-0.5 text-sm font-medium capitalize">{fmtDate(resv.date)}</p>
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-wider text-ink/50">Ora</p>
              <p className="mt-0.5 font-display text-lg text-terracotta">{resv.time}</p>
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-wider text-ink/50">Persone</p>
              <p className="mt-0.5 font-display text-lg">{resv.party_size}</p>
            </div>
          </div>

          {(resv.zone_name || resv.occasion || resv.allergies) && (
            <ul className="mt-3 space-y-1 text-xs text-ink/70">
              {resv.zone_name && <li>📍 {resv.zone_name}</li>}
              {resv.occasion && <li>🎂 {resv.occasion}</li>}
              {resv.allergies && <li>⚠ {resv.allergies}</li>}
            </ul>
          )}
        </section>

        {!isCancelled && (
          <>
            {/* Actions */}
            <section className="mt-6 grid gap-3 sm:grid-cols-2">
              <button
                onClick={() => setShowPreorder((v) => !v)}
                className="rounded-xl border-2 border-ink bg-yellow px-4 py-4 text-sm font-bold uppercase tracking-wider shadow-[3px_3px_0_0_hsl(var(--ink))] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none"
              >
                🍝 {showPreorder ? "Nascondi menu" : "Pre-ordina"}
              </button>
              <button
                onClick={cancelReservation}
                disabled={submitting}
                className="rounded-xl border-2 border-destructive bg-paper px-4 py-4 text-sm font-bold uppercase tracking-wider text-destructive hover:bg-destructive/5"
              >
                ❌ Disdici prenotazione
              </button>
            </section>

            {/* Preorder */}
            {showPreorder && (
              <section className="mt-6 rounded-2xl border-2 border-ink bg-paper p-5">
                <h2 className="font-display text-2xl uppercase tracking-tight">Pre-ordine</h2>
                <p className="mt-1 text-xs text-ink/60">Aggiungi i piatti che vuoi trovare pronti al tuo arrivo.</p>
                <div className="mt-4 space-y-5">
                  {Array.from(byCategory.entries()).map(([cat, items]) => (
                    <div key={cat}>
                      <h3 className="mb-2 font-mono text-[11px] uppercase tracking-wider text-ink/60">{cat}</h3>
                      <ul className="divide-y divide-ink/10">
                        {items.map((it) => {
                          const qty = cart[it.id] || 0;
                          return (
                            <li key={it.id} className="flex items-center gap-3 py-2.5">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-baseline justify-between gap-2">
                                  <p className="truncate font-display text-sm uppercase">{it.name}</p>
                                  {it.price != null && <span className="font-mono text-xs font-bold">€{Number(it.price).toFixed(2)}</span>}
                                </div>
                                {it.description && <p className="mt-0.5 line-clamp-1 text-xs text-ink/60">{it.description}</p>}
                              </div>
                              <div className="flex shrink-0 items-center gap-2">
                                <button
                                  onClick={() => setCart((c) => ({ ...c, [it.id]: Math.max(0, (c[it.id] || 0) - 1) }))}
                                  className="grid h-8 w-8 place-items-center rounded-full border border-ink/30 text-base"
                                >−</button>
                                <span className="w-5 text-center font-display text-base">{qty}</span>
                                <button
                                  onClick={() => setCart((c) => ({ ...c, [it.id]: (c[it.id] || 0) + 1 }))}
                                  className="grid h-8 w-8 place-items-center rounded-full border-2 border-ink bg-yellow text-base font-bold"
                                >+</button>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ))}
                  {menu.length === 0 && <p className="text-sm text-ink/60">Il ristorante non ha ancora pubblicato il menu.</p>}
                </div>
                {cartTotal > 0 && (
                  <div className="mt-5 flex items-center justify-between rounded-lg bg-cream-dark/40 px-4 py-3">
                    <span className="font-mono text-xs uppercase tracking-wider text-ink/70">Totale</span>
                    <span className="font-display text-xl">€ {cartTotal.toFixed(2)}</span>
                  </div>
                )}
                <button
                  onClick={submitPreorder}
                  disabled={submitting || cartTotal === 0}
                  className="mt-4 w-full rounded-xl border-2 border-ink bg-terracotta py-3.5 text-sm font-bold uppercase tracking-wider text-paper shadow-[3px_3px_0_0_hsl(var(--ink))] disabled:opacity-50"
                >
                  Invia pre-ordine
                </button>
              </section>
            )}
          </>
        )}

        {/* Restaurant info */}
        {settings && (
          <section className="mt-6 rounded-2xl border border-ink/15 bg-paper p-4 text-sm">
            <p className="font-mono text-[10px] uppercase tracking-wider text-ink/50">Ristorante</p>
            {settings.address && <p className="mt-1">📍 {settings.address}</p>}
            {settings.phone && <p className="mt-0.5">📞 <a className="underline" href={`tel:${settings.phone}`}>{settings.phone}</a></p>}
          </section>
        )}
      </div>
    </main>
  );
}
