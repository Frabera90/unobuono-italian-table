import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { BrandMark } from "@/components/brand";

export const Route = createFileRoute("/trova")({
  head: () => ({ meta: [{ title: "Trova prenotazione — Unobuono" }] }),
  component: TrovaPage,
});

function TrovaPage() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length < 4) return toast.error("Inserisci il codice prenotazione");
    setBusy(true);
    try {
      const { data, error } = await supabase
        .from("reservations")
        .select("manage_token")
        .eq("booking_code", trimmed)
        .maybeSingle();
      if (error) throw error;
      if (!data?.manage_token) {
        toast.error("Codice non trovato. Controlla di averlo inserito correttamente.");
        return;
      }
      navigate({ to: "/manage/$token", params: { token: data.manage_token } });
    } catch (err: any) {
      toast.error(err.message || "Errore");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-cream px-5 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <BrandMark variant="dark" className="h-12 w-12" />
          <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.3em] text-ink/50">UNOBUONO</p>
          <h1 className="mt-1 font-display text-4xl uppercase tracking-tight text-ink">Trova prenotazione</h1>
          <p className="mt-2 text-sm text-ink/60">Inserisci il codice di 6 caratteri ricevuto alla prenotazione.</p>
        </div>

        <form onSubmit={submit} className="space-y-5 rounded-2xl border-2 border-ink bg-paper p-6 shadow-[6px_6px_0_0_hsl(var(--ink))]">
          <label className="block">
            <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-ink/70">Codice prenotazione</span>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              required
              maxLength={8}
              placeholder="A3F7K2"
              autoCapitalize="characters"
              className="w-full rounded-lg border-2 border-ink/20 bg-cream px-3 py-3 text-center font-mono text-3xl font-bold tracking-[0.4em] text-terracotta placeholder:text-ink/20 focus:border-ink focus:outline-none"
            />
          </label>

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg border-2 border-ink bg-ink py-3 text-sm font-bold uppercase tracking-wider text-paper transition hover:bg-ink/80 disabled:opacity-50"
          >
            {busy ? "Cerco..." : "Apri prenotazione →"}
          </button>
        </form>

        <p className="mt-5 text-center text-[11px] text-ink/40">
          Il codice ti è stato mostrato dopo la prenotazione e inviato per email.
        </p>
      </div>
    </div>
  );
}
