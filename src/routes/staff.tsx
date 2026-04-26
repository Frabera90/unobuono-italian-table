import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { BrandMark } from "@/components/brand";

export const Route = createFileRoute("/staff")({
  validateSearch: (search: Record<string, unknown>) => ({
    pin: typeof search.pin === "string" ? search.pin.toUpperCase() : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Sala — Unobuono" },
      { name: "theme-color", content: "#0a0a0a" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "Sala" },
    ],
    links: [
      { rel: "manifest", href: "/staff.webmanifest" },
    ],
  }),
  component: StaffJoinPage,
});

function StaffJoinPage() {
  const nav = useNavigate();
  const { pin: pinParam } = Route.useSearch();
  const [pin, setPin] = useState(pinParam ?? "");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const existing = localStorage.getItem("staff.restaurant_id");
    const existingPin = localStorage.getItem("staff.pin");
    // If a PIN is in the URL and it differs from the stored one, force fresh login
    if (pinParam && existingPin && existingPin !== pinParam) {
      localStorage.removeItem("staff.restaurant_id");
      localStorage.removeItem("staff.pin");
      localStorage.removeItem("staff.name");
      return;
    }
    if (existing) nav({ to: "/waiter" });
  }, [nav, pinParam]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pin.trim().length < 4) return toast.error("Inserisci un PIN valido");
    if (!name.trim()) return toast.error("Inserisci il tuo nome");
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc("restaurant_id_by_staff_pin", { _pin: pin.trim() });
      if (error) throw error;
      if (!data) {
        toast.error("PIN non valido. Chiedi al titolare.");
        return;
      }
      localStorage.setItem("staff.restaurant_id", data as string);
      localStorage.setItem("staff.pin", pin.trim().toUpperCase());
      localStorage.setItem("staff.name", name.trim());
      toast.success(`Benvenuto, ${name}!`);
      nav({ to: "/waiter" });
    } catch (err: any) {
      toast.error(err.message || "Errore");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-ink px-5 py-10 text-paper">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <BrandMark variant="yellow" className="h-12 w-12" />
          <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.3em] text-paper/50">UNOBUONO</p>
          <h1 className="mt-1 font-display text-4xl uppercase tracking-tight text-yellow">Sala</h1>
          <p className="mt-2 text-sm text-paper/60">Accesso staff con PIN ristorante</p>
        </div>

        <form onSubmit={submit} className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-6">
          <label className="block">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-paper/70">Il tuo nome</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Marco"
              className="w-full rounded-lg border-2 border-white/15 bg-ink px-3 py-2 text-base text-paper placeholder:text-paper/30 focus:border-yellow focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-paper/70">PIN ristorante</span>
            <input
              value={pin}
              onChange={(e) => setPin(e.target.value.toUpperCase())}
              required
              maxLength={8}
              placeholder="ABC123"
              autoCapitalize="characters"
              readOnly={!!pinParam}
              className={`w-full rounded-lg border-2 bg-ink px-3 py-3 text-center font-mono text-2xl tracking-[0.4em] text-yellow placeholder:text-paper/20 focus:outline-none ${pinParam ? "border-yellow/60 opacity-80" : "border-white/15 focus:border-yellow"}`}
            />
            <span className="mt-1 block text-[11px] text-paper/50">{pinParam ? "PIN ricevuto dal titolare" : "Chiedi il PIN al titolare"}</span>
          </label>

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg border-2 border-yellow bg-yellow py-3 text-sm font-bold uppercase tracking-wider text-ink transition hover:bg-yellow/80 disabled:opacity-50"
          >
            {busy ? "Verifica..." : "Entra in sala"}
          </button>
        </form>

        <p className="mt-5 text-center text-[11px] text-paper/40">
          Aggiungi questa pagina alla home del telefono per ricevere notifiche istantanee.
        </p>
      </div>
    </div>
  );
}
