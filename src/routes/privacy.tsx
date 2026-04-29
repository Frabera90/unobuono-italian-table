import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
  head: () => ({ meta: [{ title: "Privacy Policy — Unobuono" }] }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <div className="min-h-screen bg-cream px-5 py-12">
      <div className="mx-auto max-w-2xl">
        <Link to="/" className="mb-8 block font-mono text-[11px] uppercase tracking-widest text-ink/50 hover:text-ink">← Unobuono</Link>
        <h1 className="mb-2 font-display text-4xl uppercase text-ink">Privacy Policy</h1>
        <p className="mb-8 font-mono text-xs text-ink/50">Ultimo aggiornamento: aprile 2025</p>

        <div className="space-y-8 text-sm leading-relaxed text-ink/80">
          <Section title="1. Titolare del trattamento">
            <p>Il titolare del trattamento dei dati personali è <strong>Unobuono</strong> (di seguito "noi" o "il Titolare"). Per qualsiasi richiesta relativa alla privacy puoi scrivere a: <a href="mailto:privacy@unobuono.xyz" className="underline">privacy@unobuono.xyz</a>.</p>
          </Section>

          <Section title="2. Dati che raccogliamo">
            <p>Raccogliamo le seguenti categorie di dati personali:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li><strong>Dati di account:</strong> nome, indirizzo email, password (cifrata) forniti in fase di registrazione.</li>
              <li><strong>Dati del ristorante:</strong> nome, indirizzo, telefono, orari, menu e altre informazioni inserite dall'utente.</li>
              <li><strong>Dati delle prenotazioni:</strong> nome e cognome del cliente, numero di telefono, indirizzo email, data, ora, numero di persone, note.</li>
              <li><strong>Dati di utilizzo:</strong> log di accesso, indirizzo IP, tipo di browser per finalità di sicurezza e debug.</li>
            </ul>
          </Section>

          <Section title="3. Finalità e base giuridica del trattamento">
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li><strong>Erogazione del servizio</strong> (base: esecuzione del contratto) — gestione account, prenotazioni, menu, comunicazioni transazionali.</li>
              <li><strong>Sicurezza e prevenzione frodi</strong> (base: interesse legittimo) — log di accesso, monitoraggio anomalie.</li>
              <li><strong>Obblighi di legge</strong> (base: obbligo legale) — conservazione dati fiscali ove applicabile.</li>
            </ul>
          </Section>

          <Section title="4. Conservazione dei dati">
            <p>I dati dell'account vengono conservati per tutta la durata del contratto e per un massimo di 12 mesi dopo la cancellazione dell'account. I dati delle prenotazioni vengono conservati per 24 mesi per finalità statistiche e di supporto.</p>
          </Section>

          <Section title="5. Destinatari dei dati">
            <p>I tuoi dati sono trattati da fornitori di servizi tecnici che agiscono come responsabili del trattamento:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li><strong>Supabase Inc.</strong> — database e autenticazione (USA, con garanzie Standard Contractual Clauses).</li>
              <li><strong>Cloudflare Inc.</strong> — CDN e hosting (USA, con garanzie SCCs).</li>
              <li><strong>Lovable Technologies</strong> — infrastruttura email transazionale.</li>
            </ul>
          </Section>

          <Section title="6. I tuoi diritti (GDPR)">
            <p>Hai diritto di accedere, rettificare, cancellare, limitare o opporti al trattamento dei tuoi dati personali, nonché il diritto alla portabilità dei dati. Puoi esercitare questi diritti scrivendo a <a href="mailto:privacy@unobuono.xyz" className="underline">privacy@unobuono.xyz</a>. Hai altresì diritto di proporre reclamo all'Autorità Garante per la Protezione dei Dati Personali (<a href="https://www.garanteprivacy.it" target="_blank" rel="noreferrer" className="underline">garanteprivacy.it</a>).</p>
          </Section>

          <Section title="7. Cookie e tecnologie di tracciamento">
            <p>Il sito utilizza esclusivamente cookie tecnici e funzionali necessari all'erogazione del servizio (sessione di autenticazione). Non utilizziamo cookie di profilazione o di terze parti per finalità pubblicitarie.</p>
          </Section>

          <Section title="8. Modifiche a questa policy">
            <p>Ci riserviamo di aggiornare questa Privacy Policy. In caso di modifiche sostanziali, ti informeremo via email o tramite avviso nell'applicazione.</p>
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
