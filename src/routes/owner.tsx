import { createFileRoute, Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/owner")({
  component: OwnerLayout,
});

const NAV = [
  { to: "/owner/dashboard", label: "Dashboard", icon: "📊" },
  { to: "/owner/reservations", label: "Prenotazioni", icon: "📅" },
  { to: "/owner/menu", label: "Menu", icon: "🍕" },
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
  const [authState, setAuthState] = useState<"loading" | "ok" | "no">(() => {
    if (typeof window === "undefined") return "loading";
    return sessionStorage.getItem("owner-ok") === "1" ? "ok" : "no";
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const ok = sessionStorage.getItem("owner-ok") === "1";
    setAuthState(ok ? "ok" : "no");
    if (!ok && loc.pathname !== "/owner") nav({ to: "/owner" });
  }, [loc.pathname, nav]);

  if (loc.pathname === "/owner") return <Outlet />;
  if (authState !== "ok") return <div className="min-h-screen bg-background" />;

  return (
    <div className="min-h-screen bg-cream md:flex">
      <aside className="hidden w-64 shrink-0 flex-col border-r-2 border-ink bg-ink p-5 text-paper md:flex">
        <div className="mb-8 flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-yellow font-display text-ink">U</span>
          <div>
            <p className="font-display text-lg uppercase leading-none tracking-tight">UNOBUONO</p>
            <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.2em] text-paper/50">Carpediem · Pescara</p>
          </div>
        </div>
        <nav className="flex-1 space-y-1">
          {NAV.map((n) => {
            const active = loc.pathname.startsWith(n.to);
            return (
              <Link
                key={n.to}
                to={n.to}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                  active
                    ? "bg-yellow text-ink"
                    : "text-paper/80 hover:bg-paper/10 hover:text-paper"
                }`}
              >
                <span className="text-base">{n.icon}</span>
                {n.label}
              </Link>
            );
          })}
        </nav>
        <button
          onClick={() => { sessionStorage.removeItem("owner-ok"); nav({ to: "/owner" }); }}
          className="mt-4 rounded-xl border-2 border-paper/20 px-3 py-2 text-left text-xs font-bold uppercase tracking-wider text-paper/70 hover:border-yellow hover:text-yellow"
        >
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
            <Link
              key={n.to}
              to={n.to}
              className={`flex flex-col items-center rounded-lg py-1.5 text-[10px] font-bold uppercase tracking-wider ${
                active ? "bg-yellow text-ink" : "text-paper/70"
              }`}
            >
              <span className="text-base">{n.icon}</span>
              {n.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
