import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/callback")({
  head: () => ({ meta: [{ title: "Accesso in corso... — Unobuono" }] }),
  component: OAuthCallbackPage,
});

function OAuthCallbackPage() {
  const nav = useNavigate();

  useEffect(() => {
    // Supabase JS v2 automatically detects ?code= or #access_token= in the URL
    // and fires SIGNED_IN via onAuthStateChange once the exchange completes.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) {
        nav({ to: "/owner/dashboard", replace: true });
      }
    });

    // Fallback: if no session arrives within 10s, send to auth page
    const timeout = setTimeout(() => nav({ to: "/auth", replace: true }), 10_000);

    return () => {
      sub.subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, [nav]);

  return (
    <div className="grid min-h-screen place-items-center bg-cream px-5">
      <div className="text-center">
        <div className="mb-4 text-5xl animate-pulse">🔐</div>
        <p className="font-display text-xl text-ink">Accesso in corso…</p>
        <p className="mt-2 text-sm text-muted-foreground">Verifica dell'autenticazione Google</p>
      </div>
    </div>
  );
}
