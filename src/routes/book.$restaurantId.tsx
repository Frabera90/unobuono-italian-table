import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  TIME_SLOTS,
  LUNCH_SLOTS,
  isClosed,
  getSettings,
  isoDate,
  fmtDate,
  type RestaurantSettings,
  type RoomZone,
  type MenuItem,
} from "@/lib/restaurant";
import { toast } from "sonner";

const OCCASION_CHIPS = ["Compleanno", "Anniversario", "Cena romantica", "Business", "Famiglia", "Amici"];
const PREFERENCE_CHIPS = ["Vicino alla finestra", "Zona tranquilla", "Vicino al bagno", "Lontano dalla cucina", "Tavolo alto", "Senza glutine", "Vegetariano"];
const DAY_LABELS: Record<string, string> = { mon: "Lun", tue: "Mar", wed: "Mer", thu: "Gio", fri: "Ven", sat: "Sab", sun: "Dom" };

export const Route = createFileRoute("/book/$restaurantId")({
  head: () => ({
    meta: [
      { title: "Prenota un tavolo — Carpediem Pescara" },
      { name: "description", content: "Prenota online da Carpediem Pizzeria. Scegli zona, orario e occasione." },
      { property: "og:title", content: "Prenota un tavolo — Carpediem" },
      { property: "og:description", content: "Pizzeria di ricerca a Pescara." },
    ],
  }),
  component: BookingPage,
});

type Step = 1 | 2 | 3 | 4 | "waitlist" | "done";

function BookingPage() {
  const [settings, setSettings] = useState<RestaurantSettings | null>(null);
  const [zones, setZones] = useState<RoomZone[]>([]);
  const [step, setStep] = useState<Step>(1);

  const [date, setDate] = useState<string>(isoDate(new Date()));
  const [partySize, setPartySize] = useState(2);
  const [time, setTime] = useState<string | null>(null);
  const [zoneId, setZoneId] = useState<string | null>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("+39 ");
  const [hasOccasion, setHasOccasion] = useState(false);
  const [occasionType, setOccasionType] = useState<string | null>(null);
  const [occasion, setOccasion] = useState("");
  const [hasAllergies, setHasAllergies] = useState(false);
  const [allergies, setAllergies] = useState("");
  const [preferences, setPreferences] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirmedRes, setConfirmedRes] = useState<{ id: string } | null>(null);

  // Waitlist fields
  const [wlName, setWlName] = useState("");
  const [wlPhone, setWlPhone] = useState("+39 ");
  const [wlPreferred, setWlPreferred] = useState("20:00");

  const [reservations, setReservations] = useState<{ time: string; party_size: number }[]>([]);
  const [featured, setFeatured] = useState<MenuItem[]>([]);

  useEffect(() => {
    getSettings().then(setSettings);
    supabase.from("room_zones").select("*").order("sort_order").then(({ data }) => setZones((data || []) as RoomZone[]));
    supabase
      .from("menu_items")
      .select("*")
      .eq("available", true)
      .eq("featured", true)
      .order("sort_order")
      .limit(6)
      .then(({ data }) => setFeatured((data || []) as MenuItem[]));
  }, []);

  useEffect(() => {
    supabase
      .from("reservations")
      .select("time, party_size")
      .eq("date", date)
      .then(({ data }) => setReservations((data || []) as any));
  }, [date]);

  const allSlots = useMemo(() => {
    const d = new Date(date + "T00:00:00");
    const day = d.getDay();
    if (day === 0) return LUNCH_SLOTS; // Sun lunch only per opening_hours
    if (day === 6) return [...LUNCH_SLOTS, ...TIME_SLOTS]; // Sat both
    return TIME_SLOTS;
  }, [date]);

  const slots = useMemo(() => {
    const max = settings?.max_covers ?? 60;
    return allSlots.map((slot) => {
      const booked = reservations.filter((r) => r.time === slot).reduce((s, r) => s + r.party_size, 0);
      const available = max - booked;
      return { slot, available, bookable: available >= partySize };
    });
  }, [allSlots, reservations, partySize, settings]);

  const noAvailability = slots.every((s) => !s.bookable);

  // calendar for next 30 days
  const days = useMemo(() => {
    const out: { iso: string; d: Date; closed: boolean }[] = [];
    for (let i = 0; i < 30; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      out.push({ iso: isoDate(d), d, closed: isClosed(settings, d) });
    }
    return out;
  }, [settings]);

  async function submitBooking() {
    if (!firstName.trim() || !lastName.trim() || !phone.trim() || !time) return;
    setSubmitting(true);
    const zone = zones.find((z) => z.id === zoneId);
    const fullName = `${firstName.trim()} ${lastName.trim()}`;
    const { data, error } = await supabase
      .from("reservations")
      .insert({
        customer_name: fullName,
        customer_phone: phone,
        party_size: partySize,
        date,
        time,
        zone_id: zoneId,
        zone_name: zone?.name,
        occasion: hasOccasion && occasion ? occasion : null,
        allergies: hasAllergies && allergies ? allergies : null,
        notes: notes || null,
      })
      .select("id")
      .single();
    if (error) {
      toast.error("Errore: " + error.message);
      setSubmitting(false);
      return;
    }

    // upsert client by phone
    const { data: existing } = await supabase.from("clients").select("id, visit_count").eq("phone", phone).maybeSingle();
    if (existing) {
      await supabase
        .from("clients")
        .update({ visit_count: (existing.visit_count || 0) + 1, last_visit: date })
        .eq("id", existing.id);
    } else {
      await supabase.from("clients").insert({
        name: fullName,
        phone,
        visit_count: 1,
        last_visit: date,
        allergens: hasAllergies && allergies ? allergies : null,
      });
    }

    setConfirmedRes({ id: data!.id });
    setStep("done");
    setSubmitting(false);
  }

  async function submitWaitlist() {
    if (!wlName.trim() || !wlPhone.trim()) return;
    const { error } = await supabase.from("waitlist").insert({
      customer_name: wlName,
      customer_phone: wlPhone,
      party_size: partySize,
      date,
      preferred_time: wlPreferred,
    });
    if (error) {
      toast.error("Errore: " + error.message);
      return;
    }
    toast.success("Sei in lista d'attesa! Ti avvisiamo su WhatsApp.");
    setStep(1);
    setWlName("");
    setWlPhone("+39 ");
  }

  return (
    <main className="min-h-screen bg-cream pb-16">
      {/* Header */}
      <header className="border-b-2 border-ink bg-yellow">
        <div className="mx-auto max-w-3xl px-6 py-10 md:py-14">
          <Link to="/demo" className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink/70 hover:text-ink">← Demo</Link>
          <h1 className="mt-4 font-display text-5xl uppercase leading-[0.9] text-ink md:text-7xl">{settings?.name || "Carpediem"}</h1>
          <p className="mt-4 max-w-xl text-balance font-medium text-ink/80">{settings?.bio}</p>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            {settings?.address && <span className="chip-ink">📍 {settings.address}</span>}
            {settings?.phone && <span className="chip-ink">📞 {settings.phone}</span>}
            <a
              href="/r/ristorante"
              target="_blank"
              rel="noreferrer"
              className="rounded-full border-2 border-ink bg-paper px-3 py-1 font-mono text-[11px] uppercase tracking-wider text-ink hover:bg-cream-dark"
            >
              📖 Vedi il menu
            </a>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-5 py-10">
        <Stepper step={typeof step === "number" ? step : step === "waitlist" ? 2 : 4} />

        {step === 1 && (
          <Section title="Quando vieni?">
            <p className="mb-3 text-sm text-muted-foreground">Scegli la data</p>
            <div className="grid grid-cols-7 gap-2">
              {days.map((d) => {
                const sel = d.iso === date;
                return (
                  <button
                    key={d.iso}
                    disabled={d.closed}
                    onClick={() => setDate(d.iso)}
                    className={`rounded-lg border p-2 text-center transition ${
                      d.closed
                        ? "cursor-not-allowed border-border bg-muted/30 text-muted-foreground/40"
                        : sel
                        ? "border-terracotta bg-terracotta text-paper"
                        : "border-border bg-card hover:border-terracotta"
                    }`}
                  >
                    <div className="text-[10px] uppercase tracking-wider opacity-80">
                      {d.d.toLocaleDateString("it-IT", { weekday: "short" })}
                    </div>
                    <div className="font-display text-lg">{d.d.getDate()}</div>
                  </button>
                );
              })}
            </div>

            <p className="mb-2 mt-7 text-sm text-muted-foreground">Quanti siete?</p>
            <div className="flex items-center gap-4">
              <button onClick={() => setPartySize(Math.max(1, partySize - 1))} className="h-12 w-12 rounded-full border border-border bg-card text-xl">−</button>
              <div className="flex-1 text-center">
                <span className="font-display text-4xl">{partySize}</span>
                <span className="ml-2 text-muted-foreground">{partySize === 1 ? "persona" : "persone"}</span>
              </div>
              <button onClick={() => setPartySize(Math.min(20, partySize + 1))} className="h-12 w-12 rounded-full border border-border bg-card text-xl">+</button>
            </div>

            <button
              onClick={() => setStep(2)}
              className="mt-8 w-full rounded-md bg-terracotta py-3.5 font-medium text-paper hover:bg-terracotta-dark"
            >
              Cerca disponibilità
            </button>
          </Section>
        )}

        {step === 2 && (
          <Section title={fmtDate(date)} onBack={() => setStep(1)}>
            <p className="mb-2 text-sm text-muted-foreground">Orario</p>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {slots.map((s) => (
                <button
                  key={s.slot}
                  disabled={!s.bookable}
                  onClick={() => setTime(s.slot)}
                  className={`rounded-lg border p-3 text-center transition ${
                    !s.bookable
                      ? "cursor-not-allowed border-border bg-muted/30 text-muted-foreground/40"
                      : time === s.slot
                      ? "border-terracotta bg-terracotta text-paper"
                      : "border-border bg-card hover:border-terracotta"
                  }`}
                >
                  <div className="font-display text-lg">{s.slot}</div>
                  <div className="text-[10px] opacity-70">{s.available} posti</div>
                </button>
              ))}
            </div>

            {noAvailability && settings?.waitlist_enabled && (
              <div className="mt-6 rounded-xl border border-dashed border-terracotta bg-terracotta/5 p-5">
                <p className="font-display text-lg">Siamo al completo per questa data</p>
                <p className="mt-1 text-sm text-muted-foreground">Vuoi entrare in lista d'attesa? Ti avvisiamo su WhatsApp appena si libera un posto.</p>
                <button onClick={() => setStep("waitlist")} className="mt-4 rounded-md border border-terracotta px-4 py-2 text-sm font-medium text-terracotta hover:bg-terracotta hover:text-paper">
                  Entra in lista d'attesa
                </button>
              </div>
            )}

            {time && (
              <>
                <p className="mb-2 mt-7 text-sm text-muted-foreground">Dove preferisci sederti?</p>
                <div className="grid gap-3">
                  {zones.filter((z) => z.available).map((z) => {
                    const sel = z.id === zoneId;
                    return (
                      <button
                        key={z.id}
                        onClick={() => setZoneId(z.id)}
                        className={`flex gap-4 rounded-xl border p-4 text-left transition ${
                          sel ? "border-terracotta bg-terracotta/5" : "border-border bg-card hover:border-terracotta"
                        }`}
                      >
                        <div className="grid h-16 w-16 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-cream-dark to-gold/40 font-display text-2xl text-terracotta">
                          {z.name.charAt(0)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-display text-lg">{z.name}</div>
                          <div className="truncate text-xs text-muted-foreground">{z.description}</div>
                          <div className="mt-1 truncate text-xs text-olive">{z.features}</div>
                          <div className="mt-1 text-xs font-medium text-terracotta">{z.capacity} posti disponibili</div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={() => zoneId && setStep(3)}
                  disabled={!zoneId}
                  className="mt-7 w-full rounded-md bg-terracotta py-3.5 font-medium text-paper transition hover:bg-terracotta-dark disabled:opacity-40"
                >
                  Continua
                </button>
              </>
            )}
          </Section>
        )}

        {step === "waitlist" && (
          <Section title="Lista d'attesa" onBack={() => setStep(2)}>
            <p className="mb-5 text-sm text-muted-foreground">{fmtDate(date)} · {partySize} {partySize === 1 ? "persona" : "persone"}</p>
            <Field label="Nome">
              <input className="input" value={wlName} onChange={(e) => setWlName(e.target.value)} />
            </Field>
            <Field label="Numero WhatsApp">
              <input className="input" value={wlPhone} onChange={(e) => setWlPhone(e.target.value)} />
            </Field>
            <Field label="Orario preferito">
              <select className="input" value={wlPreferred} onChange={(e) => setWlPreferred(e.target.value)}>
                {allSlots.map((s) => <option key={s}>{s}</option>)}
              </select>
            </Field>
            <button onClick={submitWaitlist} className="mt-3 w-full rounded-md bg-terracotta py-3.5 font-medium text-paper hover:bg-terracotta-dark">
              Avvisami quando si libera
            </button>
          </Section>
        )}

        {step === 3 && (
          <Section title="Ultimi dettagli" onBack={() => setStep(2)}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Nome">
                <input className="input" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              </Field>
              <Field label="Cognome">
                <input className="input" value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </Field>
            </div>
            <Field label="🇮🇹 Numero WhatsApp">
              <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </Field>
            {settings?.ask_occasion && (
              <Toggle label="È un'occasione speciale?" value={hasOccasion} onChange={setHasOccasion}>
                {hasOccasion && (
                  <input
                    placeholder="compleanno, anniversario, proposta di matrimonio..."
                    className="input mt-2"
                    value={occasion}
                    onChange={(e) => setOccasion(e.target.value)}
                  />
                )}
              </Toggle>
            )}
            {settings?.ask_allergies && (
              <Toggle label="Hai allergie o preferenze alimentari?" value={hasAllergies} onChange={setHasAllergies}>
                {hasAllergies && (
                  <input
                    placeholder="es. lattosio, glutine..."
                    className="input mt-2"
                    value={allergies}
                    onChange={(e) => setAllergies(e.target.value)}
                  />
                )}
              </Toggle>
            )}
            <Field label="Note aggiuntive (opzionale)">
              <textarea className="input min-h-[80px]" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>
            <button
              onClick={() => setStep(4)}
              disabled={!firstName || !lastName || !phone}
              className="mt-3 w-full rounded-md bg-terracotta py-3.5 font-medium text-paper hover:bg-terracotta-dark disabled:opacity-40"
            >
              Vedi riepilogo
            </button>
          </Section>
        )}

        {step === 4 && (
          <Section title="Conferma prenotazione" onBack={() => setStep(3)}>
            <div className="space-y-3 rounded-xl border border-border bg-card p-5">
              <SummaryRow label="Quando" value={`${fmtDate(date)} · ore ${time}`} />
              <SummaryRow label="Persone" value={`${partySize}`} />
              <SummaryRow label="Zona" value={zones.find((z) => z.id === zoneId)?.name || "—"} />
              <SummaryRow label="Nome" value={`${firstName} ${lastName}`} />
              <SummaryRow label="WhatsApp" value={phone} />
              {hasOccasion && occasion && <SummaryRow label="Occasione" value={occasion} />}
              {hasAllergies && allergies && <SummaryRow label="Allergie" value={allergies} />}
              {notes && <SummaryRow label="Note" value={notes} />}
            </div>
            <button
              onClick={submitBooking}
              disabled={submitting}
              className="mt-5 w-full rounded-md bg-terracotta py-3.5 font-medium text-paper hover:bg-terracotta-dark disabled:opacity-40"
            >
              {submitting ? "Confermo..." : "Conferma prenotazione"}
            </button>
          </Section>
        )}

        {step === "done" && confirmedRes && (
          <div className="rounded-2xl border border-border bg-card p-7 text-center">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-terracotta/10 text-3xl text-terracotta">✓</div>
            <h2 className="mt-4 font-display text-3xl">Prenotazione confermata!</h2>
            <p className="mt-2 text-sm text-muted-foreground">Riceverai una conferma su WhatsApp.</p>

            <div className="mx-auto mt-6 max-w-sm rounded-2xl bg-[#dcf8c6] p-4 text-left text-ink shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wider opacity-60">{settings?.name}</p>
              <p className="mt-1 text-sm">
                Ciao {firstName}! 👋 La tua prenotazione è confermata:<br />
                📅 {fmtDate(date)} · ore {time}<br />
                👥 {partySize} {partySize === 1 ? "persona" : "persone"} · {zones.find((z) => z.id === zoneId)?.name}<br />
                {hasOccasion && occasion ? `🎉 ${occasion}\n` : ""}
                A presto!
              </p>
            </div>

            <Link to="/menu/$tableNumber" params={{ tableNumber: "7" }} className="mt-7 inline-flex rounded-md border border-terracotta px-5 py-2 text-sm font-medium text-terracotta hover:bg-terracotta hover:text-paper">
              Vedi il menu
            </Link>
          </div>
        )}
      </div>

      <style>{`
        .input { width: 100%; border-radius: 0.5rem; border: 1px solid var(--color-border); background: var(--color-card); padding: 0.7rem 0.9rem; font-family: var(--font-body); }
        .input:focus { outline: 2px solid var(--color-terracotta); outline-offset: -1px; }
      `}</style>
    </main>
  );
}

function Stepper({ step }: { step: number }) {
  return (
    <div className="mb-7 flex items-center gap-2">
      {[1, 2, 3, 4].map((n) => (
        <div key={n} className={`h-1 flex-1 rounded ${n <= step ? "bg-terracotta" : "bg-border"}`} />
      ))}
    </div>
  );
}

function Section({ title, children, onBack }: { title: string; children: React.ReactNode; onBack?: () => void }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-6">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="font-display text-2xl">{title}</h2>
        {onBack && <button onClick={onBack} className="text-sm text-muted-foreground hover:text-terracotta">← Indietro</button>}
      </div>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="mt-3 block">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function Toggle({ label, value, onChange, children }: { label: string; value: boolean; onChange: (v: boolean) => void; children?: React.ReactNode }) {
  return (
    <div className="mt-3 rounded-lg border border-border bg-background/60 p-3">
      <label className="flex cursor-pointer items-center justify-between gap-3">
        <span className="text-sm">{label}</span>
        <span className={`relative h-6 w-11 rounded-full transition ${value ? "bg-terracotta" : "bg-border"}`}>
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-paper transition ${value ? "left-[22px]" : "left-0.5"}`} />
          <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} className="sr-only" />
        </span>
      </label>
      {children}
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border/50 pb-2 last:border-none last:pb-0">
      <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className="text-right text-sm">{value}</span>
    </div>
  );
}
