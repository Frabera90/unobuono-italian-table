import { createFileRoute } from "@tanstack/react-router";
import { Stub } from "@/components/owner-stub";

export const Route = createFileRoute("/owner/agent")({
  component: () => <Stub title="Agente AI" desc="Chat stile Telegram per gestire menu, prenotazioni, recensioni e social." />,
});
