import { createFileRoute, Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getMyRestaurant, type Restaurant } from "@/lib/restaurant";
import {
  X,
  LayoutDashboard,
  CalendarDays,
  UtensilsCrossed,
  Armchair,
  Users,
  ChefHat,
  Flame,
  Store,
  BarChart2,
  Menu as MenuIcon,
  LogOut,
  ExternalLink,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { BrandLockup } from "@/components/brand";
import { FloatingAssistant } from "@/components/FloatingAssistant";

export const Route = createFileRoute("/owner")({
  head: () => ({
    links: [{ rel: "manifest", href: "/manifest.webmanifest" }],
  }),
  component: OwnerLayout,
});

type NavItem = { to: string; label: string; short: string; Icon: LucideIcon };

const NAV: NavItem[] = [
  { to: "/owner/dashboard",    label: "Dashboard",      short: "Home",   Icon: LayoutDashboard },
  { to: "/owner/reservations", label: "Prenotazioni",   short: "Preno",  Icon: CalendarDays },
  { to: "/owner/sala",         label: "Sala & Tavoli",  short: "Sala",   Icon: Armchair },
  { to: "/owner/menu",         label: "Menu",           short: "Menu",   Icon: UtensilsCrossed },
  { to: "/owner/crm",          label: "Clienti",        short: "CRM",    Icon: Users },
  { to: "/owner/stats",        label: "Statistiche",    short: "Stats",  Icon: BarChart2 },
  { to: "/owner/settings",     label: "Il mio locale",  short: "Locale", Icon: Store },
];

type ExtLink = { href: string; label: string; short: string; Icon: LucideIcon };
const EXT_LINKS: ExtLink[] = [
  { href: "/waiter",  label: "App Cameriere", short: "Sala",   Icon: ChefHat },
  { href: "/kitchen", label: "Cucina (KDS)",  short: "Cucina", Icon: Flame },
];

// Bottom nav mobile: 4 voci principali + "Altro" (drawer). Esattamente 5 slot.
const BOTTOM: NavItem[] = NAV.slice(0, 4);

function OwnerLayout() {
  const loc = useLocation();
  const nav = useNavigate();
  const [authState, setAuthState] = useState<"loading" | "ok" | "no">("loading");
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => { setMenuOpen(false); }, [loc.pathname]);

  useEffect(() => {
    let mounted = true;

    function handleSession(session: import("@supabase/supabase-js").Session | null) {
      if (!mounted) return;
      if (!session) { setAuthState("no"); nav({ to: "/auth" }); return; }
      setAuthState("ok");
      void getMyRestaurant().then((r) => {
        if (!mounted) return;
        setRestaurant(r);
        if (r && !r.onboarding_complete && window.location.pathname !== "/onboarding") {
          nav({ to: "/onboarding" });
        }
      });
    }

    // Initial session check — single source of truth on mount
    void supabase.auth.getSession().then(({ data }) => handleSession(data.session));

    // Listen only for SIGN_OUT and token changes after initial load
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === "SIGNED_OUT") { setAuthState("no"); nav({ to: "/auth" }); return; }
      if (event === "TOKEN_REFRESHED" && !session) { setAuthState("no"); nav({ to: "/auth" }); }
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
                <n.Icon className="h-4 w-4 shrink-0" strokeWidth={2.25} />
                <span className="truncate">{n.label}</span>
              </Link>
            );
          })}
          <div className="mt-2 border-t border-paper/10 pt-2">
            {EXT_LINKS.map((n) => (
              <a key={n.href} href={n.href} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-paper/70 transition hover:bg-paper/10 hover:text-paper">
                <n.Icon className="h-4 w-4 shrink-0" strokeWidth={2.25} />
                <span className="truncate">{n.label}</span>
                <ExternalLink className="ml-auto h-3 w-3 shrink-0 opacity-40" strokeWidth={2} />
              </a>
            ))}
          </div>
        </nav>
        <button onClick={logout} className="mt-4 flex items-center gap-2 rounded-xl border-2 border-paper/20 px-3 py-2 text-left text-xs font-bold uppercase tracking-wider text-paper/70 hover:border-yellow hover:text-yellow">
          <LogOut className="h-4 w-4" strokeWidth={2.25} /> Esci
        </button>
      </aside>

      <main className="min-w-0 flex-1 overflow-x-hidden pb-24 md:pb-0">
        <div className="sticky top-0 z-20 flex items-center justify-between border-b-2 border-ink bg-ink px-4 py-3 text-paper md:hidden">
          <BrandLockup variant="yellow" size="sm" subtitle={restaurant?.name || "—"} />
        </div>
        <Outlet />
      </main>

      {/* Bottom nav mobile: 5 slot fissi, niente wrap */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t-2 border-ink bg-ink text-paper md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="grid grid-cols-5">
          {BOTTOM.map((n) => {
            const active = loc.pathname.startsWith(n.to);
            return (
              <Link
                key={n.to}
                to={n.to}
                className={`flex min-w-0 flex-col items-center justify-center gap-1 px-1 py-2 text-center ${active ? "bg-yellow text-ink" : "text-paper/75"}`}
              >
                <n.Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={2.25} />
                <span className="block w-full truncate text-[10px] font-bold uppercase leading-none tracking-wide">{n.short}</span>
              </Link>
            );
          })}
          <button
            onClick={() => setMenuOpen(true)}
            className={`flex min-w-0 flex-col items-center justify-center gap-1 px-1 py-2 text-center ${menuOpen ? "bg-yellow text-ink" : "text-paper/75"}`}
            aria-label="Altro"
          >
            <MenuIcon className="h-[18px] w-[18px] shrink-0" strokeWidth={2.25} />
            <span className="block w-full truncate text-[10px] font-bold uppercase leading-none tracking-wide">Altro</span>
          </button>
        </div>
      </nav>

      {menuOpen && (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-ink/60" onClick={() => setMenuOpen(false)} />
          <div className="absolute right-0 top-0 flex h-full w-[82%] max-w-sm flex-col border-l-2 border-ink bg-ink p-5 text-paper shadow-2xl">
            <div className="mb-6 flex items-center justify-between">
              <BrandLockup variant="yellow" size="sm" />
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
                    <n.Icon className="h-4 w-4 shrink-0" strokeWidth={2.25} />
                    <span className="truncate">{n.label}</span>
                  </Link>
                );
              })}
              <div className="mt-2 border-t border-paper/10 pt-2">
                {EXT_LINKS.map((n) => (
                  <a key={n.href} href={n.href} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-paper/70 transition hover:bg-paper/10 hover:text-paper">
                    <n.Icon className="h-4 w-4 shrink-0" strokeWidth={2.25} />
                    <span className="truncate">{n.label}</span>
                    <ExternalLink className="ml-auto h-3 w-3 shrink-0 opacity-40" strokeWidth={2} />
                  </a>
                ))}
              </div>
            </nav>
            <button onClick={logout} className="mt-4 flex items-center gap-2 rounded-xl border-2 border-paper/20 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-paper/70 hover:border-yellow hover:text-yellow">
              <LogOut className="h-4 w-4" strokeWidth={2.25} /> Esci
            </button>
          </div>
        </div>
      )}

      {/* Floating AI assistant — visibile su tutte le route /owner/* */}
      <FloatingAssistant />
    </div>
  );
}
