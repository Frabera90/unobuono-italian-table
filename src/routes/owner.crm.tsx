import { createFileRoute } from "@tanstack/react-router";
import { Stub } from "@/components/owner-stub";

export const Route = createFileRoute("/owner/crm")({
  component: () => <Stub title="Clienti (CRM)" desc="Storico clienti, segmenti, campagne WhatsApp con AI." />,
});
