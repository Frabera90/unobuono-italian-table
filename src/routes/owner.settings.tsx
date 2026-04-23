import { createFileRoute } from "@tanstack/react-router";
import { Stub } from "@/components/owner-stub";

export const Route = createFileRoute("/owner/settings")({
  component: () => <Stub title="Impostazioni" desc="Profilo ristorante e mapping sale." />,
});
