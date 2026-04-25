import { createFileRoute, Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getMyRestaurant, type Restaurant } from "@/lib/restaurant";
import { X } from "lucide-react";
import { BrandLockup, BrandMark } from "@/components/brand";

export const Route = createFileRoute("/owner")({
  head: () => ({
    links: [{ rel: "manifest", href: "/manifest.webmanifest" }],
  }),
  component: OwnerLayout,
});

const NAV = [
  { to: "/owner/dashboard", label: "Dashboard", short: "Home", icon: "📊" },
  { to: "/owner/reservations", label: "Prenotazioni", short: "Preno", icon: "📅" },
  { to: "/owner/sala", label: "Sala & Tavoli", short: "Sala", icon: "🪑" },
  { to: "/owner/menu", label: "Menu", short: "Menu", icon: "🍕" },
  { to: "/owner/qr", label: "QR Code", short: "QR", icon: "📱" },
  { to: "/owner/staff", label: "Staff", short: "Staff", icon: "👨‍🍳" },
  { to: "/owner/crm", label: "Clienti", short: "Clienti", icon: "👥" },
  { to: "/owner/social", label: "Social", short: "Social", icon: "📸" },
  { to: "/owner/settings", label: "Il mio locale", short: "Locale", icon: "🏠" },
  { to: "/owner/pro", label: "Pro / Prossimamente", short: "Pro", icon: "✨" },
] as const;

function OwnerLayout() {
  const loc = useLocation();
  const nav = useNavigate();
  const [authState, setAuthState] = useState<"loading" | "ok" | "no">("loading");
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  // chiudi burger menu al cambio rotta
  useEffect(() => { setMenuOpen(false); }, [loc.pathname]);

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
        <div className="mb-8">
          <BrandLockup variant="yellow" size="md" subtitle={restaurant?.name || "—"} />
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
        {/* Header mobile (senza burger: il menu sta nel bottom nav "Altro") */}
        <div className="sticky top-0 z-20 flex items-center justify-between border-b-2 border-ink bg-ink px-4 py-3 text-paper md:hidden">
          <BrandLockup variant="yellow" size="sm" subtitle={restaurant?.name || "—"} />
        </div>

        <Outlet />
      </main>

      {/* Bottom nav mobile: 4 voci principali + Altro */}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t-2 border-ink bg-ink text-paper md:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        {NAV.slice(0, 4).map((n) => {
          const active = loc.pathname.startsWith(n.to);
          return (
            <Link key={n.to} to={n.to}
              className={`flex min-w-0 flex-col items-center justify-center gap-0.5 px-1 py-2 text-center ${active ? "bg-yellow text-ink" : "text-paper/70"}`}>
              <span className="text-[18px] leading-none">{n.icon}</span>
              <span className="block w-full truncate text-[10px] font-bold uppercase leading-none tracking-wide">{n.short}</span>
            </Link>
          );
        })}
        <button
          onClick={() => setMenuOpen(true)}
          className={`flex min-w-0 flex-col items-center justify-center gap-0.5 px-1 py-2 text-center ${menuOpen ? "bg-yellow text-ink" : "text-paper/70"}`}
        >
          <span className="text-[18px] leading-none">☰</span>
          <span className="block w-full truncate text-[10px] font-bold uppercase leading-none tracking-wide">Altro</span>
        </button>
      </nav>

      {/* Drawer burger menu */}
      {menuOpen && (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-ink/60" onClick={() => setMenuOpen(false)} />
          <div className="absolute right-0 top-0 flex h-full w-[82%] max-w-sm flex-col border-l-2 border-ink bg-ink p-5 text-paper shadow-2xl">
            <div className="mb-6 flex items-center justify-between">
              <p className="font-display text-lg uppercase tracking-tight">Menu</p>
              <button onClick={() => setMenuOpen(false)} className="grid h-9 w-9 place-items-center rounded-lg border border-paper/20" aria-label="Chiudi menu">
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 space-y-1 overflow-y-auto">
              {NAV.map((n) => {
                const active = loc.pathname.startsWith(n.to);
                return (
                  <Link key={n.to} to={n.to}
                    className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition ${active ? "bg-yellow text-ink" : "text-paper/80 hover:bg-paper/10 hover:text-paper"}`}>
                    <span className="text-base">{n.icon}</span>
                    {n.label}
                  </Link>
                );
              })}
            </nav>
            <button onClick={logout} className="mt-4 rounded-xl border-2 border-paper/20 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-paper/70 hover:border-yellow hover:text-yellow">
              Esci
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
