import { createFileRoute } from "@tanstack/react-router";

function Stub({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="mx-auto max-w-3xl px-5 py-10">
      <h1 className="font-display text-3xl">{title}</h1>
      <p className="mt-2 text-muted-foreground">{desc}</p>
      <div className="mt-8 rounded-2xl border border-dashed border-border bg-card/50 p-10 text-center text-sm text-muted-foreground">
        🚧 In arrivo nella prossima fase del rilascio.
      </div>
    </div>
  );
}

export const reservationsRoute = createFileRoute("/owner/reservations")({
  component: () => <Stub title="Prenotazioni" desc="Gestione prenotazioni di oggi, calendario mensile e lista d'attesa." />,
});
export const menuRoute = createFileRoute("/owner/menu")({
  component: () => <Stub title="Menu" desc="Modifica piatti, importa da foto/PDF, riscrittura AI." />,
});
export const agentRoute = createFileRoute("/owner/agent")({
  component: () => <Stub title="Agente AI" desc="Chat stile Telegram per gestire menu, prenotazioni, recensioni e social." />,
});
export const crmRoute = createFileRoute("/owner/crm")({
  component: () => <Stub title="Clienti (CRM)" desc="Storico clienti, segmenti, campagne WhatsApp con AI." />,
});
export const reviewsRoute = createFileRoute("/owner/reviews")({
  component: () => <Stub title="Recensioni" desc="Risposte AI in 3 toni, notifica audio per nuove recensioni." />,
});
export const socialRoute = createFileRoute("/owner/social")({
  component: () => <Stub title="Social" desc="Genera post Instagram/Facebook con caption AI dalla foto del piatto." />,
});
export const statsRoute = createFileRoute("/owner/stats")({
  component: () => <Stub title="Statistiche" desc="Coperti, pre-ordini, piatti top, clienti, recensioni." />,
});
export const settingsRoute = createFileRoute("/owner/settings")({
  component: () => <Stub title="Impostazioni" desc="Profilo ristorante e mapping sale." />,
});
