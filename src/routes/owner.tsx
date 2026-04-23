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
  { to: "/owner/reviews", label: "Recensioni", icon: "⭐" },
  { to: "/owner/social", label: "Social", icon: "📸" },
  { to: "/owner/stats", label: "Statistiche", icon: "📈" },
  { to: "/owner/settings", label: "Impostazioni", icon: "⚙️" },
] as const;

function OwnerLayout() {
  const loc = useLocation();
  const nav = useNavigate();
  const [ok, setOk] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem("owner-ok") !== "1") {
      if (loc.pathname !== "/owner") nav({ to: "/owner" });
    } else {
      setOk(true);
    }
  }, [loc.pathname, nav]);

  // PIN screen at /owner has no layout chrome
  if (loc.pathname === "/owner" || !ok) {
    return <Outlet />;
  }

  return (
    <div className="min-h-screen bg-background md:flex">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-sidebar p-4 md:flex">
        <div className="mb-6 px-2">
          <p className="font-display text-xs uppercase tracking-[0.25em] text-terracotta">Carpediem</p>
          <p className="font-display text-xl italic">Unobuono</p>
        </div>
        <nav className="flex-1 space-y-0.5">
          {NAV.map((n) => {
            const active = loc.pathname.startsWith(n.to);
            return (
              <Link key={n.to} to={n.to} className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${active ? "bg-terracotta text-paper" : "text-foreground hover:bg-cream"}`}>
                <span className="text-base">{n.icon}</span>
                {n.label}
              </Link>
            );
          })}
        </nav>
        <button onClick={() => { sessionStorage.removeItem("owner-ok"); nav({ to: "/owner" }); }} className="rounded-lg px-3 py-2 text-left text-xs text-muted-foreground hover:bg-cream">Esci</button>
      </aside>

      <main className="min-w-0 flex-1 pb-20 md:pb-0">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-border bg-cream px-1 py-1.5 md:hidden">
        {NAV.slice(0, 5).map((n) => {
          const active = loc.pathname.startsWith(n.to);
          return (
            <Link key={n.to} to={n.to} className={`flex flex-col items-center rounded-lg py-1.5 text-[10px] ${active ? "text-terracotta" : "text-muted-foreground"}`}>
              <span className="text-base">{n.icon}</span>
              {n.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
