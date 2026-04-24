import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/owner/pro")({
  head: () => ({ meta: [{ title: "Pro / Prossimamente — Unobuono" }] }),
  component: ProPage,
});

const FEATURES = [
  { icon: "📣", name: "Campagne SMS & Email", desc: "Invia promozioni e inviti ai tuoi clienti con un click. Segmentazione per visite, occasioni, tag." },
  { icon: "📈", name: "Statistiche avanzate", desc: "Coperti per fascia oraria, tasso di no-show, valore medio cliente, trend mensili." },
  { icon: "⭐", name: "Recensioni AI", desc: "Risposta automatica suggerita per ogni recensione Google con il tuo tono di voce." },
  { icon: "🤖", name: "Agente AI Concierge", desc: "Chatbot che risponde 24/7 a clienti su menu, allergeni, disponibilità, prenotazioni." },
];

function ProPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-5 sm:py-10">
      <header className="mb-6 text-center">
        <span className="inline-block rounded-full border-2 border-ink bg-yellow px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-ink">Pro / Prossimamente</span>
        <h1 className="mt-3 font-display text-3xl sm:text-4xl">Funzioni in arrivo</h1>
        <p className="mt-2 text-sm text-muted-foreground">Stiamo lavorando per renderle disponibili. Disponibili nel piano Pro al lancio.</p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        {FEATURES.map((f) => (
          <div key={f.name} className="rounded-2xl border-2 border-ink bg-paper p-4 shadow-[4px_4px_0_0_hsl(var(--ink))]">
            <div className="mb-2 text-2xl">{f.icon}</div>
            <h2 className="font-display text-lg text-terracotta">{f.name}</h2>
            <p className="mt-1 text-sm text-ink/70">{f.desc}</p>
            <span className="mt-3 inline-block rounded-full border border-ink/30 bg-cream px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-ink/60">In arrivo</span>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-xl border border-border bg-cream-dark/30 p-4 text-center text-sm text-ink/70">
        Hai bisogno di una di queste funzioni adesso? Scrivici, daremo priorità in base alla domanda.
      </div>
    </div>
  );
}
