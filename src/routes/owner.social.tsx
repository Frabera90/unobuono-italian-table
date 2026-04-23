import { createFileRoute } from "@tanstack/react-router";
import { Stub } from "@/components/owner-stub";

export const Route = createFileRoute("/owner/social")({
  component: () => <Stub title="Social" desc="Genera post Instagram/Facebook con caption AI dalla foto del piatto." />,
});
