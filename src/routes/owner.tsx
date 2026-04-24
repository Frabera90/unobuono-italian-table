import { createFileRoute, Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getMyRestaurant, type Restaurant } from "@/lib/restaurant";

export const Route = createFileRoute("/owner")({
  component: OwnerLayout,
});

const NAV = [
  { to: "/owner/dashboard", label: "Dashboard", icon: "📊" },
  { to: "/owner/reservations", label: "Prenotazioni", icon: "📅" },
  { to: "/owner/menu", label: "Menu", icon: "🍕" },
  { to: "/owner/qr", label: "QR Code", icon: "📱" },
  { to: "/owner/staff", label: "Staff", icon: "👨‍🍳" },
  { to: "/owner/agent", label: "Agente AI", icon: "🤖" },
  { to: "/owner/crm", label: "Clienti", icon: "👥" },
  { to: "/owner/campaigns", label: "Campagne", icon: "📣" },
  { to: "/owner/reviews", label: "Recensioni", icon: "⭐" },
  { to: "/owner/social", label: "Social", icon: "📸" },
  { to: "/owner/stats", label: "Statistiche", icon: "📈" },
  { to: "/owner/settings", label: "Impostazioni", icon: "⚙️" },
] as const;

function OwnerLayout() {
  const loc = useLocation();
  const nav = useNavigate();
  const [authState, setAuthState] = useState<"loading" | "ok" | "no">("loading");
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);

  useEffect(() => {
    let mounted = true;
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!mounted) return;
      if (!session) { setAuthState("no"); nav({ to: "/auth" }); return; }
      setAuthState("ok");
      void getMyRestaurant().then((r) => {
        if (!mounted) return;
        setRestaurant(r);
        if (r && !r.onboarding_complete && loc.pathname !== "/onboarding") nav({ to: "/onboarding" });
      });
    });
    void supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      if (!data.session) { setAuthState("no"); nav({ to: "/auth" }); return; }
      setAuthState("ok");
      void getMyRestaurant().then((r) => {
        if (!mounted) return;
        setRestaurant(r);
        if (r && !r.onboarding_complete && loc.pathname !== "/onboarding") nav({ to: "/onboarding" });
      });
    });
    return () => { mounted = false; sub.subscription.unsubscribe(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function logout() {
    await supabase.auth.signOut();
    nav({ to: "/auth" });
  }

  if (authState === "loading") return <div className="grid min-h-screen place-items-center bg-cream text-sm text-muted-foreground">Caricamento...</div>;
  if (authState === "no") return <div className="min-h-screen bg-background" />;

  return (
    <div className="min-h-screen bg-cream md:flex">
      <aside className="hidden w-64 shrink-0 flex-col border-r-2 border-ink bg-ink p-5 text-paper md:flex">
        <div className="mb-8 flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-yellow font-display text-ink">U</span>
          <div className="min-w-0">
            <p className="font-display text-lg uppercase leading-none tracking-tight">UNOBUONO</p>
            <p className="mt-1 truncate font-mono text-[9px] uppercase tracking-[0.2em] text-paper/50">{restaurant?.name || "—"}</p>
          </div>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto">
          {NAV.map((n) => {
            const active = loc.pathname.startsWith(n.to);
            return (
              <Link key={n.to} to={n.to}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${active ? "bg-yellow text-ink" : "text-paper/80 hover:bg-paper/10 hover:text-paper"}`}>
                <span className="text-base">{n.icon}</span>
                {n.label}
              </Link>
            );
          })}
        </nav>
        <button onClick={logout} className="mt-4 rounded-xl border-2 border-paper/20 px-3 py-2 text-left text-xs font-bold uppercase tracking-wider text-paper/70 hover:border-yellow hover:text-yellow">
          Esci
        </button>
      </aside>

      <main className="min-w-0 flex-1 pb-24 md:pb-0">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t-2 border-ink bg-ink px-1 py-1.5 text-paper md:hidden">
        {NAV.slice(0, 5).map((n) => {
          const active = loc.pathname.startsWith(n.to);
          return (
            <Link key={n.to} to={n.to}
              className={`flex flex-col items-center rounded-lg py-1.5 text-[10px] font-bold uppercase tracking-wider ${active ? "bg-yellow text-ink" : "text-paper/70"}`}>
              <span className="text-base">{n.icon}</span>
              {n.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
