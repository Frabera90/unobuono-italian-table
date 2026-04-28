import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Unobuono — Il gestionale del ristorante" },
      { name: "description", content: "Il gestionale AI per ristoranti: prenotazioni, sala, cucina, social. Tutto in un posto." },
      { property: "og:title", content: "Unobuono — Il gestionale del ristorante" },
      { property: "og:description", content: "Prenotazioni, sala, cucina, CRM e social. Powered by AI." },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const nav = useNavigate();
  const [checking, setChecking] = useState(true);
  const [findOpen, setFindOpen] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Smistamento staff: se PIN è in localStorage, vai al pannello cameriere
    const staffRid = localStorage.getItem("staff.restaurant_id");
    if (staffRid) {
      nav({ to: "/waiter" });
      return;
    }
    setChecking(false);
  }, [nav]);

  async function findReservation(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length < 4) return toast.error("Inserisci il codice prenotazione");
    setBusy(true);
    try {
      const { data, error } = await supabase
        .from("reservations")
        .select("manage_token")
        .eq("booking_code", trimmed)
        .maybeSingle();
      if (error) throw error;
      if (!data?.manage_token) {
        toast.error("Codice non trovato. Controllalo e riprova.");
        return;
      }
      nav({ to: "/manage/$token", params: { token: data.manage_token } });
    } catch (err: any) {
      toast.error(err.message || "Errore");
    } finally {
      setBusy(false);
    }
  }

  if (checking) {
    return <div className="grid min-h-screen place-items-center bg-yellow"><p className="font-mono text-xs uppercase tracking-widest">caricamento…</p></div>;
  }

  return (
    <main className="min-h-screen bg-yellow text-ink">
      <nav className="flex items-center justify-between border-b-2 border-ink px-5 py-4 md:px-10">
        <div className="flex items-center">
          <img src="/splash-wordmark.png" alt="Unobuono" className="h-9 object-contain select-none" draggable={false} />
        </div>
        <button
          onClick={() => setFindOpen(true)}
          className="rounded-full border-2 border-ink bg-paper px-4 py-2 text-xs font-bold uppercase tracking-wider hover:bg-ink hover:text-paper"
        >
          Ho già prenotato
        </button>
      </nav>

      <div className="marquee border-b-2 border-ink bg-ink py-2 text-paper">
        <div className="marquee-track text-sm font-bold uppercase tracking-[0.3em]">
          ★ Il gestionale più buono d'Italia ★ Prenotazioni · Sala · Cucina · CRM · Social ★ Powered by AI ★
        </div>
      </div>

      {/* HERO */}
      <section className="border-b-2 border-ink px-5 py-12 md:px-10 md:py-20">
        <div className="mx-auto max-w-5xl">
          <p className="chip-ink mb-6">Per ristoratori</p>
          <h1 className="font-display text-[14vw] leading-[0.85] uppercase md:text-[8rem]">
            UNO<br />BUONO
          </h1>
          <p className="mt-8 max-w-2xl text-balance text-lg font-medium md:text-2xl">
            Il gestionale del ristorante che <span className="bg-ink px-2 text-yellow">parla con i clienti</span>, gestisce sala e cucina, e cura la presenza online. Tutto con l'AI.
          </p>

          {/* DUE SOLI ACCESSI */}
          <div className="mt-10 grid gap-4 md:grid-cols-2 md:gap-5">
            <Link
              to="/auth"
              className="group relative overflow-hidden rounded-2xl border-2 border-ink bg-ink p-6 text-paper shadow-brut transition hover:shadow-brut-lg md:p-7"
            >
              <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-yellow/80">Sei un ristoratore?</p>
              <h2 className="mt-2 font-display text-3xl uppercase leading-tight text-yellow md:text-4xl">Entra nel pannello</h2>
              <p className="mt-2 text-sm text-paper/80">Gestisci prenotazioni, menu, sala, cucina e social. Inizia gratis.</p>
              <span className="mt-5 inline-flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-yellow">Accedi / Registrati →</span>
            </Link>

            <button
              onClick={() => setFindOpen(true)}
              className="group relative overflow-hidden rounded-2xl border-2 border-ink bg-paper p-6 text-left shadow-brut transition hover:shadow-brut-lg md:p-7"
            >
              <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-ink/60">Sei un cliente?</p>
              <h2 className="mt-2 font-display text-3xl uppercase leading-tight md:text-4xl">Hai già prenotato?</h2>
              <p className="mt-2 text-sm text-ink/70">Apri, modifica o disdici la tua prenotazione con il codice ricevuto.</p>
              <span className="mt-5 inline-flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-terracotta">Inserisci codice →</span>
            </button>
          </div>
        </div>
      </section>

      {/* COSA FA L'APP — 3 step chiari */}
      <section className="border-b-2 border-ink bg-paper px-5 py-14 md:px-10 md:py-20">
        <div className="mx-auto max-w-5xl">
          <p className="chip-ink mb-3">Come funziona</p>
          <h2 className="font-display text-4xl uppercase leading-tight md:text-6xl">Tre cose che cambia subito</h2>

          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <article key={s.title} className="rounded-2xl border-2 border-ink bg-yellow p-6 shadow-brut">
                <div className="flex items-center gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-full border-2 border-ink bg-paper font-display text-lg">{i + 1}</span>
                  <span className="font-display text-3xl">{s.icon}</span>
                </div>
                <h3 className="mt-4 font-display text-2xl uppercase leading-tight">{s.title}</h3>
                <p className="mt-2 text-sm text-ink/80">{s.desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* TUTTO IN UN POSTO — feature grid */}
      <section className="bg-cream px-5 py-14 md:px-10 md:py-20">
        <div className="mx-auto max-w-5xl">
          <h2 className="font-display text-4xl uppercase md:text-5xl">Tutto in un posto</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {FEATURES.map((f) => (
              <article key={f.title} className="rounded-2xl border-2 border-ink bg-paper p-5">
                <span className="font-display text-2xl">{f.icon}</span>
                <h3 className="mt-2 font-display text-xl uppercase leading-tight">{f.title}</h3>
                <p className="mt-1 text-sm text-ink/70">{f.desc}</p>
              </article>
            ))}
          </div>

          <div className="mt-10 flex flex-wrap gap-3">
            <Link
              to="/auth"
              className="inline-flex items-center justify-center rounded-xl bg-ink px-6 py-4 text-sm font-bold uppercase tracking-wider text-yellow shadow-brut hover:shadow-brut-lg"
            >
              Inizia gratis →
            </Link>
            <button
              onClick={() => setFindOpen(true)}
              className="inline-flex items-center justify-center rounded-xl border-2 border-ink bg-paper px-6 py-4 text-sm font-bold uppercase tracking-wider hover:bg-ink hover:text-paper"
            >
              Ho già prenotato
            </button>
          </div>
        </div>
      </section>

      <footer className="border-t-2 border-ink bg-yellow px-5 py-8 md:px-10">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4">
          <div className="flex items-center">
            <img src="/splash-wordmark.png" alt="Unobuono" className="h-7 object-contain select-none" draggable={false} />
          </div>
          <p className="font-mono text-xs uppercase tracking-widest">Il gestionale più buono d'Italia</p>
        </div>
      </footer>

      {/* MODAL: Trova prenotazione */}
      {findOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/70 px-4" onClick={() => setFindOpen(false)} role="dialog" aria-modal="true">
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-2xl border-2 border-ink bg-paper p-6 shadow-[8px_8px_0_0_hsl(var(--ink))]">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-ink/50">Hai già prenotato?</p>
                <h3 className="mt-1 font-display text-2xl uppercase">Inserisci il codice</h3>
              </div>
              <button onClick={() => setFindOpen(false)} aria-label="Chiudi" className="grid h-8 w-8 place-items-center rounded-lg border border-ink/20 hover:bg-ink/5">✕</button>
            </div>
            <p className="mt-2 text-xs text-ink/60">6 caratteri, ricevuti via email dopo la prenotazione.</p>
            <form onSubmit={findReservation} className="mt-4 space-y-4">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                required
                maxLength={8}
                placeholder="A3F7K2"
                autoCapitalize="characters"
                autoFocus
                className="w-full rounded-lg border-2 border-ink/20 bg-cream px-3 py-3 text-center font-mono text-3xl font-bold tracking-[0.4em] text-terracotta placeholder:text-ink/20 focus:border-ink focus:outline-none"
              />
              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-lg border-2 border-ink bg-ink py-3 text-sm font-bold uppercase tracking-wider text-paper transition hover:bg-ink/80 disabled:opacity-50"
              >
                {busy ? "Cerco..." : "Apri prenotazione →"}
              </button>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}

const STEPS = [
  { icon: "📅", title: "Ricevi prenotazioni", desc: "I clienti prenotano dal tuo link. Tu vedi tutto in tempo reale, senza chiamate." },
  { icon: "🍳", title: "Sala e cucina sincronizzate", desc: "Il cameriere prende l'ordine sul telefono, la cucina lo vede subito. Niente foglietti." },
  { icon: "🤖", title: "L'AI fa il marketing", desc: "Risposte alle recensioni, post Instagram, calendario editoriale. Tu approvi." },
];

const FEATURES = [
  { icon: "📅", title: "Prenotazioni", desc: "Calendario live, liste d'attesa, occasioni e allergie." },
  { icon: "🍕", title: "Menu live", desc: "Carica il menu da una foto. L'AI lo trascrive." },
  { icon: "📱", title: "Sala in tempo reale", desc: "Camerieri ricevono chiamate e pre-ordini sul telefono." },
  { icon: "👨‍🍳", title: "Cucina (KDS)", desc: "Display ordini con stati: in attesa, in cucina, pronti." },
  { icon: "👥", title: "CRM clienti", desc: "Storico visite, preferenze, allergie, ricontatto." },
  { icon: "📸", title: "Social automatici", desc: "Post Instagram con immagini, copy e hashtag." },
];
