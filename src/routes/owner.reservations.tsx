import { createFileRoute } from "@tanstack/react-router";
import { Stub } from "@/components/owner-stub";

export const Route = createFileRoute("/owner/reservations")({
  component: () => <Stub title="Prenotazioni" desc="Gestione prenotazioni di oggi, calendario mensile e lista d'attesa." />,
});
