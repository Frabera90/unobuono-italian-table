import { createFileRoute } from "@tanstack/react-router";
import { Stub } from "@/components/owner-stub";

export const Route = createFileRoute("/owner/reviews")({
  component: () => <Stub title="Recensioni" desc="Risposte AI in 3 toni, notifica audio per nuove recensioni." />,
});
