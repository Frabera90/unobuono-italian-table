import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/terms")({
  head: () => ({ meta: [{ title: "Termini di Servizio — Unobuono" }] }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <div className="min-h-screen bg-cream px-5 py-12">
      <div className="mx-auto max-w-2xl">
        <Link to="/" className="mb-8 block font-mono text-[11px] uppercase tracking-widest text-ink/50 hover:text-ink">← Unobuono</Link>
        <h1 className="mb-2 font-display text-4xl uppercase text-ink">Termini di Servizio</h1>
        <p className="mb-8 font-mono text-xs text-ink/50">Ultimo aggiornamento: aprile 2025</p>

        <div className="space-y-8 text-sm leading-relaxed text-ink/80">
          <Section title="1. Accettazione dei termini">
            <p>Utilizzando Unobuono (di seguito "il Servizio") accetti integralmente i presenti Termini di Servizio. Se non li accetti, non puoi utilizzare il Servizio.</p>
          </Section>

          <Section title="2. Descrizione del Servizio">
            <p>Unobuono è una piattaforma SaaS che offre agli esercenti del settore della ristorazione strumenti per la gestione di prenotazioni, menu, sala, cucina e marketing digitale. Il Servizio è attualmente in fase beta.</p>
          </Section>

          <Section title="3. Account e accesso">
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Devi avere almeno 18 anni per registrarti.</li>
              <li>Sei responsabile della sicurezza delle tue credenziali di accesso.</li>
              <li>Puoi avere un solo account per ristorante.</li>
              <li>Ci riserviamo il diritto di sospendere account che violino questi termini.</li>
            </ul>
          </Section>

          <Section title="4. Uso accettabile">
            <p>Ti impegni a non utilizzare il Servizio per:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Inserire dati falsi o fuorvianti nelle prenotazioni o nel menu.</li>
              <li>Attività illegali o in violazione di normative applicabili.</li>
              <li>Tentare di accedere a dati di altri ristoranti o utenti.</li>
              <li>Sovraccaricare o compromettere l'infrastruttura del Servizio.</li>
            </ul>
          </Section>

          <Section title="5. Dati e contenuti">
            <p>Sei il titolare dei dati inseriti nel Servizio (menu, prenotazioni, clienti). Ci concedi una licenza limitata per elaborarli al fine di erogare il Servizio. Non vendiamo i tuoi dati a terzi. Vedi la nostra <Link to="/privacy" className="underline">Privacy Policy</Link> per maggiori dettagli.</p>
          </Section>

          <Section title="6. Disponibilità del Servizio">
            <p>Ci impegniamo a garantire la massima disponibilità del Servizio, ma non forniamo garanzie di uptime. Il Servizio è in fase beta e potrebbe essere soggetto a interruzioni per manutenzione o miglioramenti.</p>
          </Section>

          <Section title="7. Limitazione di responsabilità">
            <p>Il Servizio è fornito "così com'è". Non siamo responsabili per danni indiretti, perdita di dati o mancati guadagni derivanti dall'utilizzo o dall'impossibilità di utilizzare il Servizio, nei limiti consentiti dalla legge italiana.</p>
          </Section>

          <Section title="8. Cancellazione">
            <p>Puoi cancellare il tuo account in qualsiasi momento scrivendo a <a href="mailto:support@unobuono.xyz" className="underline">support@unobuono.xyz</a>. I dati saranno conservati per 12 mesi come previsto dalla Privacy Policy, dopodiché eliminati definitivamente.</p>
          </Section>

          <Section title="9. Legge applicabile">
            <p>I presenti termini sono regolati dalla legge italiana. Per qualsiasi controversia è competente il foro di Milano, salvo diversa previsione di legge.</p>
          </Section>

          <Section title="10. Contatti">
            <p>Per qualsiasi domanda su questi Termini: <a href="mailto:support@unobuono.xyz" className="underline">support@unobuono.xyz</a></p>
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 font-display text-lg uppercase text-ink">{title}</h2>
      {children}
    </section>
  );
}
