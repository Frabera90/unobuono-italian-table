import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Unobuono — Il gestionale del ristorante" },
      { name: "description", content: "Prenotazioni, menu live, sala e CRM in un unico posto. Powered by AI." },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const nav = useNavigate();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Smistamento automatico: staff -> waiter, owner loggato -> dashboard
    const staffRid = localStorage.getItem("staff.restaurant_id");
    if (staffRid) {
      nav({ to: "/waiter" });
      return;
    }
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        nav({ to: "/owner" });
      } else {
        setChecking(false);
      }
    });
  }, [nav]);

  if (checking) {
    return <div className="grid min-h-screen place-items-center bg-yellow"><p className="font-mono text-xs uppercase tracking-widest">caricamento…</p></div>;
  }

  return (
    <main className="min-h-screen bg-yellow text-ink">
      <nav className="flex items-center justify-between border-b-2 border-ink px-5 py-4 md:px-10">
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-ink text-yellow font-display text-sm">U</span>
          <span className="font-display text-xl uppercase tracking-tight md:text-2xl">UNOBUONO</span>
        </div>
        <Link
          to="/auth"
          className="rounded-full border-2 border-ink bg-paper px-4 py-2 text-xs font-bold uppercase tracking-wider hover:bg-ink hover:text-paper"
        >
          Accedi
        </Link>
      </nav>

      <div className="marquee border-b-2 border-ink bg-ink py-2 text-paper">
        <div className="marquee-track text-sm font-bold uppercase tracking-[0.3em]">
          ★ Il gestionale più buono d'Italia ★ Prenotazioni · Menu live · Sala · CRM · Social ★ Powered by AI ★
        </div>
      </div>

      <section className="border-b-2 border-ink px-5 py-14 md:px-10 md:py-24">
        <div className="mx-auto max-w-6xl">
          <p className="chip-ink mb-6">Per ristoratori</p>
          <h1 className="font-display text-[16vw] leading-[0.85] uppercase md:text-[10rem]">
            UNO<br />BUONO
          </h1>
          <p className="mt-8 max-w-2xl text-balance text-lg font-medium md:text-2xl">
            Il gestionale del ristorante che <span className="bg-ink px-2 text-yellow">parla con i clienti</span>, gestisce la sala e cura la presenza online.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link
              to="/auth"
              className="inline-flex items-center justify-center rounded-xl bg-ink px-6 py-4 text-sm font-bold uppercase tracking-wider text-yellow shadow-brut hover:shadow-brut-lg"
            >
              Inizia gratis →
            </Link>
            <Link
              to="/auth"
              className="inline-flex items-center justify-center rounded-xl border-2 border-ink bg-paper px-6 py-4 text-sm font-bold uppercase tracking-wider text-ink hover:bg-ink hover:text-paper"
            >
              Ho già un account
            </Link>
          </div>
        </div>
      </section>

      <section className="bg-paper px-5 py-14 md:px-10 md:py-20">
        <div className="mx-auto max-w-6xl">
          <h2 className="font-display text-4xl uppercase md:text-6xl">Tutto in un posto</h2>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {FEATURES.map((f) => (
              <article key={f.title} className="rounded-3xl border-2 border-ink bg-yellow p-7 shadow-brut">
                <span className="font-display text-3xl">{f.icon}</span>
                <h3 className="mt-4 font-display text-2xl uppercase leading-tight">{f.title}</h3>
                <p className="mt-2 text-sm text-ink/80">{f.desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t-2 border-ink bg-yellow px-5 py-8 md:px-10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-ink text-yellow font-display text-xs">U</span>
            <span className="font-display text-lg uppercase tracking-tight">UNOBUONO</span>
          </div>
          <p className="font-mono text-xs uppercase tracking-widest">Il gestionale più buono d'Italia</p>
        </div>
      </footer>
    </main>
  );
}

const FEATURES = [
  { icon: "📅", title: "Prenotazioni", desc: "Calendario sempre aggiornato. Liste d'attesa, occasioni speciali, allergie." },
  { icon: "🍕", title: "Menu live", desc: "Carica il menu da una foto. L'AI lo trascrive. Modifica in un click." },
  { icon: "📱", title: "Sala in tempo reale", desc: "I camerieri ricevono chiamate tavoli e pre-ordini sul telefono." },
  { icon: "👥", title: "CRM clienti", desc: "Storico visite, preferenze, allergie. Ricontatta chi ami di più." },
  { icon: "⭐", title: "Recensioni con AI", desc: "Risposte pronte in tono brand, da rivedere e pubblicare." },
  { icon: "📸", title: "Social automatici", desc: "Post Instagram pianificati con immagini, copy e hashtag." },
];
