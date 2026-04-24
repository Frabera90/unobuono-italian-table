import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/owner/")({
  head: () => ({ meta: [{ title: "Area titolare — Unobuono" }] }),
  component: OwnerIndex,
});

function OwnerIndex() {
  const nav = useNavigate();
  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      nav({ to: data.session ? "/owner/dashboard" : "/auth" });
    });
  }, [nav]);
  return <div className="grid min-h-screen place-items-center bg-cream text-sm text-muted-foreground">Caricamento...</div>;
}
