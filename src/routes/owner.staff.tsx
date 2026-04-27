import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getMyRestaurant, type Restaurant } from "@/lib/restaurant";
import { toast } from "sonner";

export const Route = createFileRoute("/owner/staff")({
  head: () => ({ meta: [{ title: "Staff — Unobuono" }] }),
  component: OwnerStaffPage,
});

function OwnerStaffPage() {
  const [pin, setPin] = useState<string | null>(null);
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") setOrigin(window.location.origin);
    void load();
  }, []);

  async function load() {
    setLoading(true);
    const r = await getMyRestaurant();
    if (!r) { setLoading(false); return; }
    setRestaurant(r);
    const { data } = await supabase
      .from("restaurant_settings")
      .select("staff_pin")
      .eq("restaurant_id", r.id)
      .maybeSingle();
    setPin((data as any)?.staff_pin || null);
    setLoading(false);
  }

  async function regenerate() {
    if (!confirm("Generare un nuovo PIN? Il PIN attuale non funzionerà più: dovrai ridarlo a tutto lo staff.")) return;
    const { data, error } = await supabase.rpc("regenerate_staff_pin");
    if (error || !data) { toast.error("Errore nella rigenerazione"); return; }
    setPin(data as string);
    toast.success("Nuovo PIN generato!");
  }

  function copy(text: string) {
    navigator.clipboard.writeText(text);
    toast.success("Copiato!");
  }

  const slug = restaurant?.slug ?? "";
  const staffUrl = slug && pin
    ? `${origin}/staff/${slug}?pin=${pin}`
    : slug
    ? `${origin}/staff/${slug}`
    : `${origin}/staff`;
  const waMessage = `Ciao! Per accedere al pannello sala di ${restaurant?.name ?? "noi"} apri questo link: ${staffUrl}\nSi apre direttamente col PIN già inserito — devi solo mettere il tuo nome e toccare "Entra in sala".`;
  const waLink = `https://wa.me/?text=${encodeURIComponent(waMessage)}`;

  if (loading) return <div className="p-8 text-sm text-muted-foreground">Caricamento...</div>;

  return (
    <div className="mx-auto max-w-3xl px-5 py-8 md:px-8">
      <header className="mb-8">
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-ink/50">Pannello titolare</p>
        <h1 className="mt-2 font-display text-4xl uppercase tracking-tight">Staff & Sala</h1>
        <p className="mt-2 text-sm text-ink/70">Condividi questo PIN con i tuoi camerieri per dargli accesso al pannello sala in tempo reale.</p>
      </header>

      <section className="rounded-2xl border-2 border-ink bg-paper p-6 shadow-[6px_6px_0_0_hsl(var(--ink))]">
        <p className="text-xs font-bold uppercase tracking-wider text-ink/60">PIN ristorante</p>
        <div className="mt-3 flex items-center justify-between gap-4">
          <code className="font-mono text-5xl font-bold tracking-[0.2em] text-ink">{pin || "------"}</code>
          <div className="flex flex-col gap-2">
            <button onClick={() => pin && copy(pin)} className="rounded-lg border-2 border-ink bg-cream px-3 py-1.5 text-xs font-bold uppercase tracking-wider hover:bg-cream-dark">📋 Copia</button>
            <button onClick={regenerate} className="rounded-lg border-2 border-ink bg-paper px-3 py-1.5 text-xs font-bold uppercase tracking-wider hover:bg-cream-dark">🔄 Rigenera</button>
          </div>
        </div>
        <p className="mt-4 text-xs text-ink/60">⚠️ Chiunque abbia questo PIN può vedere chiamate tavoli e prenotazioni. Rigeneralo se un cameriere se ne va.</p>
      </section>

      <section className="mt-6 rounded-2xl border-2 border-ink bg-yellow/40 p-6">
        <h2 className="font-display text-xl uppercase tracking-tight">Come funziona</h2>
        <ol className="mt-3 space-y-2 text-sm">
          <li><b>1.</b> Manda al cameriere il link qui sotto — è univoco per il tuo ristorante e ha già il PIN incluso:<br/><code className="mt-1 block break-all rounded bg-paper px-1.5 py-0.5 font-mono text-xs">{staffUrl}</code></li>
          <li><b>2.</b> Il cameriere apre il link, inserisce solo il suo nome e tocca "Entra in sala" — il PIN è già pre-compilato</li>
          <li><b>3.</b> Da quel momento riceve in tempo reale le chiamate dei tavoli, le prenotazioni e i pre-ordini</li>
          <li><b>4.</b> Può aggiungere la pagina alla home del telefono per usarla come app</li>
        </ol>

        <a
          href={waLink}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-flex items-center gap-2 rounded-xl border-2 border-ink bg-paper px-4 py-2 text-sm font-bold uppercase tracking-wider text-ink hover:bg-cream-dark"
        >
          📱 Invia su WhatsApp
        </a>
      </section>

      <section className="mt-6 rounded-2xl border-2 border-ink/20 bg-paper p-5">
        <h3 className="font-display text-lg uppercase tracking-tight">Cosa vede lo staff</h3>
        <ul className="mt-2 space-y-1 text-sm text-ink/70">
          <li>🔔 <b>Chiamate cameriere</b> — notifica sonora in tempo reale</li>
          <li>📋 <b>Prenotazioni di oggi</b> — con allergie, occasioni, pre-ordini</li>
          <li>📦 <b>Pre-ordini</b> — può aggiornare lo stato (in preparazione / pronto)</li>
        </ul>
        <p className="mt-3 text-xs text-ink/50">Lo staff <b>non</b> vede menu, statistiche, CRM o impostazioni. Solo le info operative.</p>
      </section>
    </div>
  );
}
