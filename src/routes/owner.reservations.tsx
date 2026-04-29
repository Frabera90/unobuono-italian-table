import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { isoDate, fmtDate, fmtDateShort, TIME_SLOTS, LUNCH_SLOTS, type Reservation } from "@/lib/restaurant";
import { toast } from "sonner";

export const Route = createFileRoute("/owner/reservations")({
  head: () => ({ meta: [{ title: "Prenotazioni — Unobuono" }] }),
  component: ReservationsPage,
});

type TableLite = { id: string; code: string; seats: number; zone_id: string | null };
type Preorder = { id: string; customer_name: string | null; reservation_id: string | null; total: number | null; status: string | null; items: Array<{ name: string; qty: number; price: number }> | null; created_at: string };
type WaiterCall = { id: string; table_number: string; message: string; status: string; created_at: string };

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

const EMPTY_FORM = { name: "", phone: "", email: "", partySize: 2, date: isoDate(new Date()), time: "20:00", notes: "" };

function ReservationsPage() {
  const today = isoDate(new Date());
  const [showHistory, setShowHistory] = useState(false);
  const [date, setDate] = useState<string | null>(null); // null = "da oggi in poi" (o tutte se showHistory)
  const [list, setList] = useState<Reservation[]>([]);
  const [tables, setTables] = useState<TableLite[]>([]);
  const [preorders, setPreorders] = useState<Preorder[]>([]);
  const [waitercalls, setWaitercalls] = useState<WaiterCall[]>([]);
  const [awaitingBill, setAwaitingBill] = useState<Set<string>>(new Set());
  const [billModal, setBillModal] = useState<{ reservation: Reservation; preorders: Preorder[]; tableCode: string } | null>(null);
  const [tab, setTab] = useState<"list" | "preorders" | "tables">("tables");
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [newForm, setNewForm] = useState({ ...EMPTY_FORM });
  const [newBusy, setNewBusy] = useState(false);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: rest } = await supabase.from("restaurants").select("id").eq("owner_id", user.id).maybeSingle();
    if (!rest) return;
    setRestaurantId(rest.id);

    let resvQuery = supabase.from("reservations").select("*").eq("restaurant_id", rest.id);

    if (date) {
      resvQuery = resvQuery.eq("date", date).order("time");
    } else if (!showHistory) {
      resvQuery = resvQuery.gte("date", today).order("date").order("time").limit(300);
    } else {
      resvQuery = resvQuery.order("date", { ascending: false }).order("time", { ascending: false }).limit(500);
    }

    // Pre-orders
    let preoQuery = supabase.from("preorders").select("id,customer_name,reservation_id,total,status,items,created_at").eq("restaurant_id", rest.id).order("created_at", { ascending: false });
    if (date) {
      preoQuery = preoQuery.gte("created_at", date + "T00:00:00").lte("created_at", date + "T23:59:59");
    } else if (!showHistory) {
      preoQuery = preoQuery.gte("created_at", today + "T00:00:00");
    }
    preoQuery = preoQuery.limit(200);

    // Waiter calls — solo pendenti di oggi
    const callsQuery = supabase
      .from("waiter_calls")
      .select("id,table_number,message,status,created_at")
      .eq("restaurant_id", rest.id)
      .eq("status", "pending")
      .gte("created_at", today + "T00:00:00")
      .order("created_at", { ascending: false });

    const [{ data: r }, { data: t }, { data: p }, { data: c }] = await Promise.all([
      resvQuery,
      supabase.from("tables").select("id,code,seats,zone_id").eq("restaurant_id", rest.id).order("code"),
      preoQuery,
      callsQuery,
    ]);
    setList((r || []) as Reservation[]);
    setTables((t || []) as TableLite[]);
    setPreorders((p || []) as Preorder[]);
    setWaitercalls((c || []) as WaiterCall[]);
  }

  useEffect(() => {
    load();
    const ch = supabase.channel("o-resv-" + (date ?? "all") + (showHistory ? "-h" : ""))
      .on("postgres_changes", { event: "*", schema: "public", table: "reservations" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "preorders" }, (payload) => {
        const r = (payload.new || payload.old) as any;
        if (payload.eventType === "UPDATE" && r.status === "bill_requested") {
          toast("💳 Conto richiesto!", { description: r.customer_name || "Un cliente", duration: 10000 });
          playDing();
        }
        load();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "waiter_calls" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, showHistory]);

  const active = useMemo(() => list.filter((r) => r.status !== "cancelled"), [list]);
  const cancelled = useMemo(() => list.filter((r) => r.status === "cancelled"), [list]);

  const totals = useMemo(() => ({
    covers: active.reduce((s, r) => s + r.party_size, 0),
    arrived: active.filter((r) => r.arrived).length,
  }), [active]);

  async function toggleArrived(r: Reservation) {
    await supabase.from("reservations").update({ arrived: !r.arrived }).eq("id", r.id);
  }
  async function cancel(r: Reservation) {
    if (!confirm("Disdire la prenotazione? Il tavolo verrà liberato e il cliente riceverà una email.")) return;
    const { error } = await supabase.from("reservations").update({ status: "cancelled" }).eq("id", r.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Prenotazione disdetta");
    const email = (r as any).customer_email as string | null;
    if (email && restaurantId) {
      const { sendBookingEmail, buildBookingEmailData } = await import("@/lib/email/booking");
      const settingsRow = (await supabase.from("restaurant_settings").select("name").eq("restaurant_id", restaurantId).maybeSingle()).data;
      void sendBookingEmail({
        templateName: "booking-cancellation",
        recipientEmail: email,
        reservationId: r.id,
        templateData: buildBookingEmailData({
          customerName: r.customer_name,
          restaurantName: settingsRow?.name || null,
          date: r.date,
          time: r.time,
          partySize: r.party_size,
        }),
      });
    }
  }
  async function moveTable(reservationId: string, newTableId: string | null) {
    const { error } = await supabase.from("reservations").update({ table_id: newTableId }).eq("id", reservationId);
    if (error) toast.error(error.message); else toast.success("Tavolo aggiornato");
  }
  async function createReservation(e: React.FormEvent) {
    e.preventDefault();
    if (!restaurantId || !newForm.name.trim() || !newForm.date || !newForm.time) return;
    setNewBusy(true);
    const { error } = await supabase.from("reservations").insert({
      restaurant_id: restaurantId,
      customer_name: newForm.name.trim(),
      customer_phone: newForm.phone.trim() || null,
      customer_email: newForm.email.trim() || null,
      party_size: newForm.partySize,
      date: newForm.date,
      time: newForm.time,
      notes: newForm.notes.trim() || null,
      source: "manual",
    } as any);
    setNewBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Prenotazione creata!");
    setNewOpen(false);
    setNewForm({ ...EMPTY_FORM });
  }

  return (
    <div className="mx-auto max-w-5xl px-5 py-7">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl">Prenotazioni</h1>
          <p className="text-sm text-muted-foreground capitalize">
            {date ? fmtDate(date) : showHistory ? "Tutto lo storico" : "Oggi e prossime"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setNewOpen(true)}
            className="rounded-lg bg-terracotta px-4 py-2 text-sm font-bold uppercase tracking-wider text-paper hover:bg-terracotta-dark"
          >
            + Nuova
          </button>
          <div className="rounded-lg border-2 border-ink bg-yellow/40 px-2 py-1.5">
            <label className="mb-0.5 block text-[9px] font-bold uppercase tracking-widest text-ink/70">
              📅 Filtra per giorno
            </label>
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={date ?? ""}
                onChange={(e) => setDate(e.target.value || null)}
                className="rounded-md border border-ink bg-paper px-2 py-1 text-sm"
              />
              {date && (
                <button
                  onClick={() => setDate(null)}
                  className="rounded-md border border-ink bg-paper px-2 py-1 text-[10px] font-bold uppercase tracking-wider hover:bg-ink hover:text-paper"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
          <button
            onClick={() => { setShowHistory((h) => !h); setDate(null); }}
            className={`rounded-lg border-2 px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition ${showHistory ? "border-ink bg-ink text-paper" : "border-ink bg-paper text-ink hover:bg-cream-dark"}`}
          >
            {showHistory ? "📜 Nascondi storico" : "📜 Storico"}
          </button>
          <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs">
            <span className="font-display text-base">{totals.covers}</span>
            <span className="text-muted-foreground"> coperti · </span>
            <span className="font-display text-base text-terracotta">{totals.arrived}</span>
            <span className="text-muted-foreground"> arrivati</span>
          </div>
        </div>
      </header>

      <div className="mb-4 flex flex-wrap gap-2 border-b border-border">
        <Tab active={tab === "tables"} onClick={() => setTab("tables")}>Tavoli oggi</Tab>
        <Tab active={tab === "list"} onClick={() => setTab("list")}>Prenotazioni ({active.length})</Tab>
        <Tab active={tab === "preorders"} onClick={() => setTab("preorders")}>Pre-ordini ({preorders.length})</Tab>
      </div>

      {tab === "list" && (
        <>
          <ul className="space-y-2">
            {active.length === 0 && <li className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">Nessuna prenotazione.</li>}
            {active.map((r) => {
              const compatible = tables.filter((t) => t.seats >= r.party_size);
              const tb = r.table_id ? tables.find((t) => t.id === r.table_id) : null;
              return (
                <li key={r.id} className="rounded-xl border border-border bg-card p-3 md:p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex shrink-0 flex-col items-center">
                      <div className="font-display text-xl leading-none text-terracotta md:text-2xl">{r.time}</div>
                      {!date && (
                        <div className="mt-0.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                          {fmtDateShort(r.date)}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-display text-base leading-tight">
                        <span className="break-words">{r.customer_name}</span>
                        <span className="text-muted-foreground"> · {r.party_size} pers</span>
                      </div>
                      <div className="mt-0.5 break-words text-xs text-muted-foreground">
                        {r.zone_name}
                        {tb && ` · 🪑 ${tb.code}`}
                        {r.customer_phone ? ` · ${r.customer_phone}` : ""}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {r.occasion && <Badge>{occasionEmoji(r.occasion_type)} {r.occasion}</Badge>}
                        {r.allergies && <Badge tone="warn">⚠️ {r.allergies}</Badge>}
                        {r.preorder_link_sent && <Badge>🛵 pre-ordine</Badge>}
                        {r.source === "walkin" && <Badge tone="info">🚶 walk-in</Badge>}
                        {Array.isArray(r.preferences) && r.preferences.map((p, i) => <Badge key={i} tone="pref">💺 {p}</Badge>)}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border/60 pt-2">
                    <select
                      value={r.table_id ?? ""}
                      onChange={(e) => moveTable(r.id, e.target.value || null)}
                      className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-xs sm:flex-none"
                      title="Sposta tavolo"
                    >
                      <option value="">— Nessun tavolo —</option>
                      {compatible.map((t) => (
                        <option key={t.id} value={t.id}>{t.code} ({t.seats}p)</option>
                      ))}
                    </select>
                    <button onClick={() => toggleArrived(r)} className={`rounded-md px-3 py-1.5 text-xs font-medium ${r.arrived ? "bg-emerald-600 text-white" : "border border-border"}`}>
                      {r.arrived ? "✓ Arrivato" : "Segna arrivato"}
                    </button>
                    <button
                      onClick={() => cancel(r)}
                      className="rounded-md border border-destructive/40 px-2.5 py-1.5 text-[11px] font-medium uppercase tracking-wider text-destructive hover:bg-destructive hover:text-paper"
                      title="Disdici prenotazione"
                    >
                      Disdici
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
          {cancelled.length > 0 && (
            <details className="mt-5">
              <summary className="cursor-pointer text-xs font-mono uppercase tracking-wider text-muted-foreground">Disdette ({cancelled.length})</summary>
              <ul className="mt-2 space-y-1">
                {cancelled.map((r) => (
                  <li key={r.id} className="flex items-center gap-3 rounded-lg border border-dashed border-border bg-muted/30 p-2.5 text-xs text-muted-foreground line-through">
                    <span className="font-display text-base">{r.time}</span>
                    <span>{r.customer_name} · {r.party_size}p</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}

      {tab === "preorders" && (
        <ul className="space-y-2">
          {preorders.length === 0 && <li className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">Nessun pre-ordine ricevuto.</li>}
          {preorders.map((p) => {
            const linked = p.reservation_id ? list.find((r) => r.id === p.reservation_id) : null;
            return (
              <li key={p.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <div className="font-display text-base">{p.customer_name || "Cliente"}{linked ? ` · ${fmtDateShort(linked.date)} ore ${linked.time}` : ""}</div>
                    <div className="text-xs text-muted-foreground">Ordinato {new Date(p.created_at).toLocaleString("it-IT")}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${p.status === "bill_requested" ? "bg-red-500/15 text-red-700" : p.status === "ready" ? "bg-emerald-500/15 text-emerald-700" : p.status === "preparing" ? "bg-amber-500/15 text-amber-700" : "bg-terracotta/15 text-terracotta"}`}>{p.status === "bill_requested" ? "💳 conto" : p.status || "pending"}</span>
                    <span className="font-display text-lg text-terracotta">€ {Number(p.total || 0).toFixed(2)}</span>
                  </div>
                </div>
                {Array.isArray(p.items) && p.items.length > 0 && (
                  <ul className="mt-2 divide-y divide-border/40 text-sm">
                    {p.items.map((it, i) => (
                      <li key={i} className="flex justify-between py-1">
                        <span><span className="font-mono text-xs text-muted-foreground">{it.qty}×</span> {it.name}</span>
                        <span className="text-xs text-muted-foreground">€ {(Number(it.price) * it.qty).toFixed(2)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {tab === "tables" && (
        <TablesView
          tables={tables}
          reservations={list}
          preorders={preorders}
          waitercalls={waitercalls}
          awaitingBill={awaitingBill}
          onToggleBill={(id) => setAwaitingBill((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; })}
          onOpenBill={(reservation, preorders, tableCode) => setBillModal({ reservation, preorders, tableCode })}
          today={today}
          onMoveTable={moveTable}
        />
      )}

      {billModal && (
        <BillModal
          reservation={billModal.reservation}
          preorders={billModal.preorders}
          tableCode={billModal.tableCode}
          onClose={() => setBillModal(null)}
        />
      )}

      {newOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center" onClick={() => setNewOpen(false)}>
          <form
            onSubmit={createReservation}
            className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-5 font-display text-2xl">Nuova prenotazione</h2>
            <div className="space-y-3">
              <Field label="Nome cliente *">
                <input required value={newForm.name} onChange={(e) => setNewForm((f) => ({ ...f, name: e.target.value }))} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" placeholder="Mario Rossi" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Telefono">
                  <input type="tel" value={newForm.phone} onChange={(e) => setNewForm((f) => ({ ...f, phone: e.target.value }))} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" placeholder="+39 333..." />
                </Field>
                <Field label="Coperti *">
                  <input type="number" required min={1} max={50} value={newForm.partySize} onChange={(e) => setNewForm((f) => ({ ...f, partySize: Number(e.target.value) }))} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
                </Field>
              </div>
              <Field label="Email">
                <input type="email" value={newForm.email} onChange={(e) => setNewForm((f) => ({ ...f, email: e.target.value }))} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" placeholder="mario@email.com" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Data *">
                  <input type="date" required value={newForm.date} onChange={(e) => setNewForm((f) => ({ ...f, date: e.target.value }))} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
                </Field>
                <Field label="Orario *">
                  <select required value={newForm.time} onChange={(e) => setNewForm((f) => ({ ...f, time: e.target.value }))} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
                    <optgroup label="Pranzo">
                      {LUNCH_SLOTS.map((t) => <option key={t} value={t}>{t}</option>)}
                    </optgroup>
                    <optgroup label="Cena">
                      {TIME_SLOTS.map((t) => <option key={t} value={t}>{t}</option>)}
                    </optgroup>
                  </select>
                </Field>
              </div>
              <Field label="Note">
                <textarea value={newForm.notes} onChange={(e) => setNewForm((f) => ({ ...f, notes: e.target.value }))} rows={2} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" placeholder="Richieste speciali, ecc." />
              </Field>
            </div>
            <div className="mt-5 flex gap-2">
              <button type="submit" disabled={newBusy} className="flex-1 rounded-lg bg-terracotta py-2.5 text-sm font-bold uppercase tracking-wider text-paper hover:bg-terracotta-dark disabled:opacity-50">
                {newBusy ? "..." : "Crea prenotazione"}
              </button>
              <button type="button" onClick={() => setNewOpen(false)} className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted">
                Annulla
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function Tab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`relative px-4 py-2 text-sm font-medium ${active ? "text-terracotta" : "text-muted-foreground"}`}>
      {children}
      {active && <span className="absolute inset-x-0 -bottom-px h-0.5 bg-terracotta" />}
    </button>
  );
}

function Badge({ children, tone }: { children: React.ReactNode; tone?: "warn" | "info" | "pref" }) {
  const cls = tone === "warn" ? "bg-amber-500/15 text-amber-700"
    : tone === "info" ? "bg-sky-500/15 text-sky-700"
    : tone === "pref" ? "bg-violet-500/15 text-violet-700"
    : "bg-terracotta/15 text-terracotta";
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${cls}`}>{children}</span>;
}

function occasionEmoji(type: string | null | undefined): string {
  if (!type) return "🎉";
  const m: Record<string, string> = {
    "Compleanno": "🎂",
    "Anniversario": "💍",
    "Cena romantica": "❤️",
    "Business": "💼",
    "Famiglia": "👨‍👩‍👧",
    "Amici": "🥂",
  };
  return m[type] ?? "🎉";
}

function BillModal({ reservation, preorders, tableCode, onClose }: { reservation: Reservation; preorders: Preorder[]; tableCode: string; onClose: () => void }) {
  const allItems: { name: string; qty: number; price: number }[] = preorders.flatMap((p) => Array.isArray(p.items) ? p.items : []);
  const total = preorders.reduce((s, p) => s + Number(p.total ?? 0), 0);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl border-2 border-ink bg-paper p-6 shadow-[8px_8px_0_0_hsl(var(--ink))]" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between">
          <div>
            <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Conto tavolo {tableCode}</p>
            <p className="font-display text-2xl">{reservation.customer_name}</p>
            <p className="text-sm text-muted-foreground">{reservation.party_size} pers · ore {reservation.time}</p>
          </div>
          <button onClick={onClose} className="rounded-lg border border-border px-3 py-1.5 text-xs font-bold hover:bg-muted">✕</button>
        </div>
        {allItems.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground italic">Nessun ordine registrato</p>
        ) : (
          <ul className="divide-y divide-border">
            {allItems.map((it, i) => (
              <li key={i} className="flex items-center justify-between py-2 text-sm">
                <span><span className="mr-1.5 font-mono text-xs text-muted-foreground">{it.qty}×</span>{it.name}</span>
                <span className="font-medium">€{(Number(it.price) * it.qty).toFixed(2)}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4 flex items-center justify-between border-t-2 border-ink pt-3">
          <span className="font-bold uppercase tracking-wider">Totale</span>
          <span className="font-display text-3xl text-terracotta">€{total.toFixed(2)}</span>
        </div>
        <button onClick={() => window.print()} className="mt-4 w-full rounded-lg border-2 border-ink bg-yellow py-2 text-sm font-bold uppercase tracking-wider text-ink hover:bg-yellow/80">
          🖨 Stampa conto
        </button>
      </div>
    </div>
  );
}

function TablesView({
  tables,
  reservations,
  preorders,
  waitercalls,
  awaitingBill,
  onToggleBill,
  onOpenBill,
  today,
  onMoveTable,
}: {
  tables: { id: string; code: string; seats: number; zone_id: string | null }[];
  reservations: Reservation[];
  preorders: Preorder[];
  waitercalls: WaiterCall[];
  awaitingBill: Set<string>;
  onToggleBill: (reservationId: string) => void;
  onOpenBill: (reservation: Reservation, preorders: Preorder[], tableCode: string) => void;
  today: string;
  onMoveTable: (reservationId: string, tableId: string | null) => void;
}) {
  // Only look at today's active reservations
  const todayActive = reservations.filter((r) => r.date === today && r.status !== "cancelled");
  const hasToday = todayActive.length > 0 || tables.length > 0;
  // Pending waiter calls indexed by table code
  const callsByTable = waitercalls.reduce<Record<string, WaiterCall[]>>((acc, c) => {
    (acc[c.table_number] = acc[c.table_number] || []).push(c);
    return acc;
  }, {});

  if (tables.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        Nessun tavolo configurato. Vai su <strong>Sala &amp; Tavoli</strong> per aggiungere i tavoli del tuo locale.
      </div>
    );
  }

  // Tables with a reservation today, sorted: occupied first, then reserved, then free
  const tableRows = tables.map((t) => {
    const occupied = todayActive.find((r) => r.table_id === t.id && r.arrived);
    const reserved = !occupied ? todayActive.find((r) => r.table_id === t.id && !r.arrived) : undefined;
    const activeResv = occupied ?? reserved ?? null;
    const tablePreos = activeResv
      ? preorders.filter((p) => p.reservation_id === activeResv.id)
      : [];
    const total = tablePreos.reduce((s, p) => s + Number(p.total ?? 0), 0);
    return { table: t, occupied, reserved, activeResv, tablePreos, total };
  });
  tableRows.sort((a, b) => {
    const rank = (x: typeof a) => (x.occupied ? 0 : x.reserved ? 1 : 2);
    return rank(a) - rank(b);
  });

  // Reservations without a table assigned (walk-ins or not yet assigned)
  const unassigned = todayActive.filter((r) => !r.table_id);

  return (
    <div>
      <p className="mb-4 text-sm text-muted-foreground">
        Vista in tempo reale dei tavoli di oggi — ideale per fare il conto a fine servizio.
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {tableRows.map(({ table, occupied, reserved, activeResv, tablePreos, total }) => {
          const pendingCalls = callsByTable[table.code] ?? [];
          const isAwaitingBill = activeResv
            ? (tablePreos.some((p) => p.status === "bill_requested") || awaitingBill.has(activeResv.id))
            : false;
          return (
          <div
            key={table.id}
            className={`rounded-xl border-2 p-4 transition ${
              isAwaitingBill
                ? "border-red-500 bg-red-50/30 dark:bg-red-900/10 animate-pulse"
                : occupied
                ? "border-terracotta bg-terracotta/5"
                : reserved
                ? "border-amber-400/70 bg-amber-50/20 dark:bg-amber-900/10"
                : "border-border bg-card opacity-60"
            }`}
          >
            {/* Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <div className="font-display text-2xl leading-none">{table.code}</div>
                {pendingCalls.length > 0 && (
                  <span className="animate-pulse rounded-full bg-red-500 px-1.5 py-0.5 text-[9px] font-bold text-white">🔔 {pendingCalls.length}</span>
                )}
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                  isAwaitingBill
                    ? "bg-red-500 text-white"
                    : occupied
                    ? "bg-terracotta text-paper"
                    : reserved
                    ? "bg-amber-400 text-ink"
                    : "bg-emerald-500/15 text-emerald-700"
                }`}
              >
                {isAwaitingBill ? "💳 Conto" : occupied ? "Occupato" : reserved ? "Prenotato" : "Libero"}
              </span>
            </div>

            {/* Pending calls */}
            {pendingCalls.length > 0 && (
              <div className="mt-2 rounded-lg bg-red-50 dark:bg-red-900/20 px-2 py-1.5 text-xs text-red-700 dark:text-red-300">
                {pendingCalls.map((c) => <div key={c.id}>🔔 {c.message}</div>)}
              </div>
            )}

            {/* Reservation info */}
            {activeResv && (
              <div className="mt-3">
                <div className="font-medium">{activeResv.customer_name}</div>
                <div className="text-xs text-muted-foreground">
                  {activeResv.party_size} pers · ore {activeResv.time}
                  {activeResv.source === "walkin" && " · 🚶 walk-in"}
                </div>
                {activeResv.occasion && <div className="mt-1 text-xs">{occasionEmoji(activeResv.occasion_type)} {activeResv.occasion}</div>}
                {activeResv.allergies && <div className="text-xs text-amber-700">⚠️ {activeResv.allergies}</div>}
                {Array.isArray(activeResv.preferences) && activeResv.preferences.length > 0 && (
                  <div className="mt-1 text-xs text-muted-foreground">💺 {activeResv.preferences.join(", ")}</div>
                )}
                {/* Table re-assignment */}
                <select
                  value={activeResv.table_id ?? ""}
                  onChange={(e) => onMoveTable(activeResv.id, e.target.value || null)}
                  className="mt-2 w-full rounded border border-border bg-background px-1.5 py-1 text-xs"
                  title="Sposta su altro tavolo"
                >
                  <option value="">— Sposta tavolo —</option>
                  {tables.filter((t) => t.seats >= activeResv.party_size).map((t) => (
                    <option key={t.id} value={t.id}>{t.code} ({t.seats}p)</option>
                  ))}
                </select>
              </div>
            )}

            {/* Pre-orders / orders */}
            {tablePreos.length > 0 && (
              <div className="mt-3 rounded-lg border border-border/60 bg-background/50 p-3">
                <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Ordini ({tablePreos.length})
                </div>
                {tablePreos.map((p) => (
                  <div key={p.id} className="mb-2 last:mb-0">
                    <div className="mb-0.5 flex items-center gap-1.5">
                      <span className="text-[10px] text-muted-foreground">{p.customer_name || "Cliente"}</span>
                      <span
                        className={`rounded-full px-1.5 py-px text-[9px] font-bold uppercase ${
                          p.status === "bill_requested"
                            ? "bg-red-500/15 text-red-700"
                            : p.status === "ready"
                            ? "bg-emerald-500/15 text-emerald-700"
                            : p.status === "preparing"
                            ? "bg-amber-500/15 text-amber-700"
                            : p.status === "served"
                            ? "bg-muted text-muted-foreground"
                            : "bg-terracotta/15 text-terracotta"
                        }`}
                      >
                        {p.status === "bill_requested" ? "💳 conto" : p.status === "served" ? "servito" : p.status === "ready" ? "pronto" : p.status === "preparing" ? "in prep." : "in attesa"}
                      </span>
                    </div>
                    {Array.isArray(p.items) &&
                      p.items.map((it, i) => (
                        <div key={i} className="flex justify-between text-xs">
                          <span>
                            <span className="font-mono text-muted-foreground">{it.qty}×</span> {it.name}
                          </span>
                          <span className="text-muted-foreground">€{(Number(it.price) * it.qty).toFixed(2)}</span>
                        </div>
                      ))}
                  </div>
                ))}
                <div className="mt-2 flex items-center justify-between border-t border-border/60 pt-2">
                  <span className="text-xs font-medium text-muted-foreground">Totale</span>
                  <span className="font-display text-xl text-terracotta">€ {total.toFixed(2)}</span>
                </div>
              </div>
            )}

            {activeResv && tablePreos.length === 0 && (
              <div className="mt-2 text-xs italic text-muted-foreground">Nessun ordine registrato</div>
            )}

            {/* Actions for occupied tables */}
            {activeResv && (occupied || (activeResv.source === "walkin")) && (
              <div className="mt-3 flex gap-2 border-t border-border/40 pt-2">
                <button
                  onClick={() => onOpenBill(activeResv, tablePreos, table.code)}
                  className="flex-1 rounded-lg border border-ink bg-paper py-1.5 text-[11px] font-bold uppercase tracking-wider hover:bg-cream-dark"
                >
                  🧾 Apri conto
                </button>
                <button
                  onClick={() => onToggleBill(activeResv.id)}
                  className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wider transition ${isAwaitingBill ? "border-red-500 bg-red-100 text-red-700" : "border-border hover:bg-muted"}`}
                  title="Segna in attesa conto"
                >
                  {isAwaitingBill ? "💳 Conto ✓" : "In attesa conto"}
                </button>
              </div>
            )}
          </div>
          );
        })}
      </div>

      {/* Walk-ins / unassigned reservations */}
      {unassigned.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Senza tavolo assegnato ({unassigned.length})
          </h3>
          <ul className="space-y-2">
            {unassigned.map((r) => {
              const rPreos = preorders.filter((p) => p.reservation_id === r.id);
              const rTotal = rPreos.reduce((s, p) => s + Number(p.total ?? 0), 0);
              return (
                <li key={r.id} className="rounded-xl border border-dashed border-border bg-card p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="font-medium">{r.customer_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {r.party_size} pers · ore {r.time}
                        {(r as any).source === "walkin" && " · walk-in"}
                        {r.arrived && " · ✓ arrivato"}
                      </div>
                    </div>
                    {rTotal > 0 && (
                      <span className="font-display text-lg text-terracotta">€ {rTotal.toFixed(2)}</span>
                    )}
                  </div>
                  {rPreos.length > 0 && (
                    <div className="mt-2 text-xs text-muted-foreground">
                      {rPreos.flatMap((p) => (Array.isArray(p.items) ? p.items : [])).map((it, i) => (
                        <span key={i} className="mr-2">{it.qty}× {it.name}</span>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {!hasToday && (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Nessuna prenotazione per oggi. I tavoli appaiono qui quando ci sono clienti.
        </div>
      )}
    </div>
  );
}
