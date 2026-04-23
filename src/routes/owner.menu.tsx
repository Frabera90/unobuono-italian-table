import { createFileRoute } from "@tanstack/react-router";
import { Stub } from "@/components/owner-stub";

export const Route = createFileRoute("/owner/menu")({
  component: () => <Stub title="Menu" desc="Modifica piatti, importa da foto/PDF, riscrittura AI." />,
});
