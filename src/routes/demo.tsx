import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/demo")({
  head: () => ({
    meta: [
      { title: "UNOBUONO — Demo" },
      { name: "description", content: "Esplora UNOBUONO: vista cliente, cameriere e titolare." },
    ],
  }),
  component: DemoPage,
});

function DemoPage() {
  return (
    <main className="min-h-screen bg-yellow text-ink">
      {/* Top nav */}
      <nav className="flex items-center justify-between border-b-2 border-ink px-5 py-4 md:px-10">
        <Logo />
        <div className="hidden items-center gap-2 md:flex">
          <a href="#scopri" className="rounded-full border-2 border-ink bg-paper px-4 py-2 text-xs font-bold uppercase tracking-wider hover:bg-ink hover:text-paper">Scopri</a>
        </div>
      </nav>

      {/* Marquee strip */}
      <div className="marquee border-b-2 border-ink bg-ink py-2 text-paper">
        <div className="marquee-track text-sm font-bold uppercase tracking-[0.3em]">
          ★ Il gestionale più buono d'Italia ★ Prenotazioni · Menu live · Sala · CRM · Social ★ Powered by AI ★ Il gestionale più buono d'Italia ★
        </div>
      </div>

      {/* Hero */}
      <section className="border-b-2 border-ink px-5 py-14 md:px-10 md:py-24">
        <div className="mx-auto max-w-6xl">
          <p className="chip-ink mb-6">Carpediem · Pescara</p>
          <h1 className="font-display text-[16vw] leading-[0.85] uppercase md:text-[10rem]">
            UNO<br />BUONO
          </h1>
          <p className="mt-8 max-w-2xl text-balance text-lg font-medium md:text-2xl">
            Il gestionale del ristorante che <span className="bg-ink px-2 text-yellow">parla con i clienti</span>, gestisce la sala e cura la presenza online.
          </p>
        </div>
      </section>

      {/* Cards */}
      <section id="scopri" className="bg-paper px-5 py-14 md:px-10 md:py-20">
        <div className="mx-auto max-w-6xl">
          <div className="mb-10 flex items-end justify-between">
            <h2 className="font-display text-4xl uppercase md:text-6xl">Scegli un ruolo</h2>
            <span className="hidden font-mono text-xs uppercase tracking-widest text-ink/60 md:block">3 viste · 1 prodotto</span>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            <RoleCard
              tag="Cliente"
              num="01"
              title="Prenota un tavolo o sfoglia il menu"
              tone="yellow"
              actions={[
                { label: "Prenota un tavolo →", to: "/book/$restaurantId", params: { restaurantId: "carpediem" } },
                { label: "Menu al tavolo (QR)", to: "/menu/$tableNumber", params: { tableNumber: "7" }, ghost: true },
              ]}
            />
            <RoleCard
              tag="Cameriere"
              num="02"
              title="Gestisco le chiamate e gli ordini in tempo reale"
              tone="ink"
              actions={[{ label: "Apri vista cameriere →", to: "/waiter" }]}
              footer="Salva sul telefono per le notifiche"
            />
            <RoleCard
              tag="Titolare"
              num="03"
              title="Gestisco tutto il ristorante con l'AI"
              tone="paper"
              actions={[{ label: "Accedi alla dashboard →", to: "/owner" }]}
              footer="PIN demo: 1234"
            />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t-2 border-ink bg-yellow px-5 py-8 md:px-10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
          <Logo small />
          <p className="font-mono text-xs uppercase tracking-widest">Demo · Tutti i dati sono di esempio</p>
        </div>
      </footer>
    </main>
  );
}

function Logo({ small }: { small?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`grid place-items-center rounded-full bg-ink text-yellow ${small ? "h-7 w-7 text-xs" : "h-9 w-9 text-sm"} font-display`}>U</span>
      <span className={`font-display uppercase tracking-tight ${small ? "text-lg" : "text-xl md:text-2xl"}`}>UNOBUONO</span>
    </div>
  );
}

type Tone = "yellow" | "ink" | "paper";
type Action = { label: string; to: string; params?: Record<string, string>; ghost?: boolean };

function RoleCard({ tag, num, title, actions, tone, footer }: { tag: string; num: string; title: string; actions: Action[]; tone: Tone; footer?: string }) {
  const surface =
    tone === "yellow" ? "bg-yellow text-ink" :
    tone === "ink" ? "bg-ink text-paper" :
    "bg-paper text-ink";

  return (
    <article className={`group flex flex-col justify-between rounded-3xl border-2 border-ink p-7 transition-transform hover:-translate-x-1 hover:-translate-y-1 hover:shadow-brut-lg shadow-brut ${surface}`}>
      <div>
        <div className="flex items-start justify-between">
          <span className={`rounded-full border-2 border-current px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em]`}>{tag}</span>
          <span className="font-display text-3xl opacity-50">{num}</span>
        </div>
        <h3 className="mt-6 font-display text-3xl uppercase leading-[0.95]">{title}</h3>
      </div>
      <div className="mt-10 flex flex-col gap-2">
        {actions.map((a) => (
          <Link
            key={a.label}
            to={a.to as any}
            params={a.params as any}
            className={
              a.ghost
                ? "inline-flex items-center justify-center rounded-xl border-2 border-current px-4 py-3 text-sm font-bold uppercase tracking-wider transition hover:bg-current hover:text-yellow"
                : tone === "ink"
                ? "inline-flex items-center justify-center rounded-xl bg-yellow px-4 py-3 text-sm font-bold uppercase tracking-wider text-ink transition hover:bg-paper"
                : tone === "yellow"
                ? "inline-flex items-center justify-center rounded-xl bg-ink px-4 py-3 text-sm font-bold uppercase tracking-wider text-yellow transition hover:bg-paper hover:text-ink"
                : "inline-flex items-center justify-center rounded-xl bg-ink px-4 py-3 text-sm font-bold uppercase tracking-wider text-paper transition hover:bg-yellow hover:text-ink"
            }
          >
            {a.label}
          </Link>
        ))}
        {footer && <p className="mt-2 text-center font-mono text-[10px] uppercase tracking-widest opacity-70">{footer}</p>}
      </div>
    </article>
  );
}
