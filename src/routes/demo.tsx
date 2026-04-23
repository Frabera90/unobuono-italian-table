import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/demo")({
  head: () => ({
    meta: [
      { title: "Unobuono — Demo" },
      { name: "description", content: "Esplora Unobuono: vista cliente, cameriere e titolare." },
    ],
  }),
  component: DemoPage,
});

function DemoPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl px-6 py-14 md:py-20">
        <header className="mb-14 text-center">
          <p className="font-display text-sm uppercase tracking-[0.3em] text-terracotta">Carpediem · Pescara</p>
          <h1 className="mt-4 font-display text-5xl leading-[1.05] text-foreground md:text-7xl">
            <span className="italic text-terracotta">Unobuono</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-balance text-muted-foreground md:text-lg">
            Il gestionale del ristorante che parla con i clienti, gestisce la sala e cura la presenza online.
          </p>
        </header>

        <div className="grid gap-6 md:grid-cols-3">
          <DemoCard
            tag="Cliente"
            title="Prenota un tavolo o sfoglia il menu"
            tone="terracotta"
            actions={[
              { label: "Vai alla pagina prenotazione", to: "/book/$restaurantId", params: { restaurantId: "carpediem" } },
              { label: "Menu al tavolo (QR)", to: "/menu/$tableNumber", params: { tableNumber: "7" }, ghost: true },
            ]}
          />
          <DemoCard
            tag="Cameriere"
            title="Gestisco le chiamate e gli ordini"
            tone="ink"
            actions={[{ label: "Apri vista cameriere", to: "/waiter" }]}
            footer="Salva sul telefono per le notifiche"
          />
          <DemoCard
            tag="Titolare"
            title="Gestisco tutto il ristorante"
            tone="gold"
            actions={[{ label: "Accedi alla dashboard", to: "/owner" }]}
            footer="PIN: 1234"
          />
        </div>

        <p className="mt-14 text-center text-xs uppercase tracking-[0.25em] text-muted-foreground">Demo · Tutti i dati sono di esempio</p>
      </div>
    </main>
  );
}

type Tone = "terracotta" | "ink" | "gold";
type Action = { label: string; to: string; params?: Record<string, string>; ghost?: boolean };

function DemoCard({ tag, title, actions, tone, footer }: { tag: string; title: string; actions: Action[]; tone: Tone; footer?: string }) {
  const bg =
    tone === "terracotta"
      ? "bg-card border-border"
      : tone === "ink"
      ? "bg-ink text-paper border-ink"
      : "bg-cream-dark border-border";
  const accent =
    tone === "terracotta" ? "text-terracotta" : tone === "ink" ? "text-gold" : "text-olive";

  return (
    <article className={`group flex flex-col rounded-2xl border p-7 transition-all hover:-translate-y-1 hover:shadow-xl ${bg}`}>
      <p className={`font-display text-xs uppercase tracking-[0.25em] ${accent}`}>{tag}</p>
      <h2 className="mt-3 font-display text-2xl leading-snug">{title}</h2>
      <div className="mt-auto flex flex-col gap-2 pt-8">
        {actions.map((a) => (
          <Link
            key={a.label}
            to={a.to as any}
            params={a.params as any}
            className={
              a.ghost
                ? `inline-flex items-center justify-center rounded-md border border-current px-4 py-2.5 text-sm font-medium transition-colors hover:bg-foreground/5 ${accent}`
                : tone === "ink"
                ? "inline-flex items-center justify-center rounded-md bg-paper px-4 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-cream"
                : "inline-flex items-center justify-center rounded-md bg-terracotta px-4 py-2.5 text-sm font-medium text-paper transition-colors hover:bg-terracotta-dark"
            }
          >
            {a.label}
          </Link>
        ))}
        {footer && <p className="mt-1 text-center text-xs text-muted-foreground">{footer}</p>}
      </div>
    </article>
  );
}
