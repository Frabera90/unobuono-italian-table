import { createFileRoute } from "@tanstack/react-router";
import { Stub } from "@/components/owner-stub";

export const Route = createFileRoute("/owner/stats")({
  component: () => <Stub title="Statistiche" desc="Coperti, pre-ordini, piatti top, clienti, recensioni." />,
});
