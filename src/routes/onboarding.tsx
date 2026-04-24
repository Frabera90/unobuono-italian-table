import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getMyRestaurant, type Restaurant } from "@/lib/restaurant";
import { toast } from "sonner";

export const Route = createFileRoute("/onboarding")({
  head: () => ({ meta: [{ title: "Setup ristorante — Unobuono" }] }),
  component: OnboardingPage,
});

const DAYS = [
  { key: "mon", label: "Lunedì" }, { key: "tue", label: "Martedì" },
  { key: "wed", label: "Mercoledì" }, { key: "thu", label: "Giovedì" },
  { key: "fri", label: "Venerdì" }, { key: "sat", label: "Sabato" }, { key: "sun", label: "Domenica" },
];

function OnboardingPage() {
  const nav = useNavigate();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [busy, setBusy] = useState(false);

  // Step 1
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("+39 ");
  const [bio, setBio] = useState("");

  // Step 2
  const [hours, setHours] = useState<Record<string, { open: boolean; value: string }>>({
    mon: { open: false, value: "19:00-23:00" }, tue: { open: true, value: "19:00-23:00" },
    wed: { open: true, value: "19:00-23:00" }, thu: { open: true, value: "19:00-23:00" },
    fri: { open: true, value: "19:00-24:00" }, sat: { open: true, value: "12:00-15:00,19:00-24:00" },
    sun: { open: true, value: "12:00-15:00" },
  });

  // Step 3
  const [zoneName, setZoneName] = useState("Sala interna");
  const [capacity, setCapacity] = useState(40);
  const [tableCount, setTableCount] = useState(10);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) { nav({ to: "/auth" }); return; }
      const r = await getMyRestaurant();
      if (!r) { toast.error("Ristorante non trovato"); return; }
      setRestaurant(r);
      if (r.onboarding_complete) nav({ to: "/owner/dashboard" });
      setName(r.name === "Il mio ristorante" ? "" : r.name);
    })();
  }, [nav]);

  async function saveStep1() {
    if (!restaurant || !name.trim()) { toast.error("Inserisci il nome"); return; }
    setBusy(true);
    const { error: e1 } = await supabase.from("restaurants").update({ name }).eq("id", restaurant.id);
    const { error: e2 } = await supabase.from("restaurant_settings").update({ name, address, phone, bio }).eq("restaurant_id", restaurant.id);
    setBusy(false);
    if (e1 || e2) { toast.error((e1 || e2)?.message); return; }
    setStep(2);
  }

  async function saveStep2() {
    if (!restaurant) return;
    setBusy(true);
    const opening_hours: Record<string, string> = {};
    for (const d of DAYS) opening_hours[d.key] = hours[d.key].open ? hours[d.key].value : "closed";
    const { error } = await supabase.from("restaurant_settings").update({ opening_hours }).eq("restaurant_id", restaurant.id);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setStep(3);
  }

  async function finish() {
    if (!restaurant) return;
    setBusy(true);
    await supabase.from("restaurants").update({ onboarding_complete: true }).eq("id", restaurant.id);
    setBusy(false);
    toast.success("Setup completato! Ora crea le tue aree e i tavoli →");
    nav({ to: "/owner/sala" });
  }

  return (
    <div className="min-h-screen bg-cream px-5 py-8">
      <div className="mx-auto max-w-xl">
        <div className="mb-6 text-center">
          <h1 className="font-display text-3xl text-ink">Setup ristorante</h1>
          <p className="mt-1 text-sm text-muted-foreground">Step {step} di 3</p>
          <div className="mt-3 flex justify-center gap-1.5">
            {[1, 2, 3].map((s) => (
              <div key={s} className={`h-1.5 w-12 rounded-full ${s <= step ? "bg-terracotta" : "bg-border"}`} />
            ))}
          </div>
        </div>

        <div className="rounded-2xl border-2 border-ink bg-paper p-6 shadow-[8px_8px_0_0_hsl(var(--ink))]">
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="font-display text-xl text-terracotta">Identità del ristorante</h2>
              <Field label="Nome del ristorante *"><input className="ob-in" value={name} onChange={(e) => setName(e.target.value)} placeholder="Trattoria del Borgo" /></Field>
              <Field label="Indirizzo"><input className="ob-in" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Via Roma 12, Pescara" /></Field>
              <Field label="Telefono"><input className="ob-in" value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
              <Field label="Breve descrizione"><textarea className="ob-in" rows={3} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Cucina di pesce, ambiente familiare..." /></Field>
              <PrimaryBtn onClick={saveStep1} busy={busy}>Continua →</PrimaryBtn>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <h2 className="font-display text-xl text-terracotta">Orari di apertura</h2>
              {DAYS.map((d) => (
                <div key={d.key} className="flex items-center gap-3 rounded-lg border border-border p-2">
                  <button type="button" onClick={() => setHours({ ...hours, [d.key]: { ...hours[d.key], open: !hours[d.key].open } })}
                    className={`relative h-5 w-9 shrink-0 rounded-full transition ${hours[d.key].open ? "bg-terracotta" : "bg-border"}`}>
                    <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-paper transition ${hours[d.key].open ? "left-[18px]" : "left-0.5"}`} />
                  </button>
                  <span className="w-20 text-sm font-medium">{d.label}</span>
                  {hours[d.key].open ? (
                    <input className="ob-in flex-1 text-xs" value={hours[d.key].value} onChange={(e) => setHours({ ...hours, [d.key]: { ...hours[d.key], value: e.target.value } })} placeholder="19:00-23:00" />
                  ) : (
                    <span className="flex-1 text-xs text-muted-foreground">Chiuso</span>
                  )}
                </div>
              ))}
              <div className="flex gap-2">
                <SecondaryBtn onClick={() => setStep(1)}>← Indietro</SecondaryBtn>
                <PrimaryBtn onClick={saveStep2} busy={busy}>Continua →</PrimaryBtn>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h2 className="font-display text-xl text-terracotta">Quasi pronto!</h2>
              <p className="text-sm text-ink/70">Subito dopo configurerai <strong>aree e tavoli</strong> del tuo locale (puoi creare più aree, ognuna con i suoi tavoli e QR code stampabili).</p>
              <div className="rounded-lg border border-terracotta/30 bg-terracotta/5 p-3 text-xs text-ink/80">
                📋 Poi caricherai il menu — anche solo con una foto, l'AI lo trascrive per te.
              </div>
              <div className="flex gap-2">
                <SecondaryBtn onClick={() => setStep(2)}>← Indietro</SecondaryBtn>
                <PrimaryBtn onClick={finish} busy={busy}>Vai a Sala & Tavoli →</PrimaryBtn>
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`.ob-in{width:100%;border:2px solid hsl(var(--ink));background:hsl(var(--paper));border-radius:8px;padding:8px 12px;font-size:14px}`}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1 block text-xs font-bold uppercase tracking-wider text-ink/70">{label}</span>{children}</label>;
}
function PrimaryBtn({ onClick, busy, children }: { onClick: () => void; busy: boolean; children: React.ReactNode }) {
  return <button onClick={onClick} disabled={busy} className="flex-1 rounded-lg border-2 border-ink bg-yellow py-2.5 text-sm font-bold uppercase tracking-wider text-ink transition hover:bg-yellow/80 disabled:opacity-50">{busy ? "..." : children}</button>;
}
function SecondaryBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} className="rounded-lg border-2 border-ink bg-paper px-4 py-2.5 text-sm font-bold uppercase tracking-wider text-ink hover:bg-cream-dark">{children}</button>;
}
