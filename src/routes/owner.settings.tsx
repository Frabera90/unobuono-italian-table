import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Copy, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/owner/settings")({
  head: () => ({ meta: [{ title: "Il mio locale — Unobuono" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const [s, setS] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [pinBusy, setPinBusy] = useState(false);

  useEffect(() => {
    supabase.from("restaurant_settings").select("*").limit(1).maybeSingle().then(({ data }) => setS(data));
  }, []);

  async function regeneratePin() {
    setPinBusy(true);
    const { data, error } = await supabase.rpc("regenerate_staff_pin");
    setPinBusy(false);
    if (error || !data) { toast.error("Errore rigenera PIN"); return; }
    setS((prev: any) => ({ ...prev, staff_pin: data as string }));
    toast.success("PIN rigenerato — aggiorna i link condivisi con lo staff");
  }

  function copyLink(path: string) {
    const url = `${window.location.origin}${path}`;
    navigator.clipboard.writeText(url).then(() => toast.success("Link copiato!")).catch(() => toast.error("Copia non riuscita"));
  }

  async function save() {
    if (!s) return;
    setBusy(true);
    const { error } = await supabase.from("restaurant_settings").update({ ...s, updated_at: new Date().toISOString() }).eq("id", s.id);
    setBusy(false);
    if (error) toast.error(error.message);
    else toast.success("Salvato");
  }

  if (!s) return <div className="p-8 text-sm text-muted-foreground">Caricamento...</div>;

  return (
    <div className="mx-auto max-w-3xl px-5 py-7">
      <header className="mb-5">
        <h1 className="font-display text-3xl">Il mio locale</h1>
        <p className="text-sm text-muted-foreground">Dati, identità e preferenze del ristorante.</p>
      </header>

      <div className="space-y-5 rounded-2xl border border-border bg-card p-5">
        <Section title="Identità">
          <Field label="Nome"><input className="set-in" value={s.name || ""} onChange={(e) => setS({ ...s, name: e.target.value })} /></Field>
          <Field label="Indirizzo"><input className="set-in" value={s.address || ""} onChange={(e) => setS({ ...s, address: e.target.value })} /></Field>
          <Field label="Telefono"><input className="set-in" value={s.phone || ""} onChange={(e) => setS({ ...s, phone: e.target.value })} /></Field>
          <Field label="Bio"><textarea className="set-in" rows={3} value={s.bio || ""} onChange={(e) => setS({ ...s, bio: e.target.value })} /></Field>
          <Field label="Tono di voce"><input className="set-in" value={s.tone || ""} onChange={(e) => setS({ ...s, tone: e.target.value })} /></Field>
        </Section>

        <Section title="Capacità">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Coperti max"><input type="number" className="set-in" value={s.max_covers || 0} onChange={(e) => setS({ ...s, max_covers: Number(e.target.value) })} /></Field>
            <Field label="Durata media tavolo (min)"><input type="number" className="set-in" value={s.avg_table_duration || 0} onChange={(e) => setS({ ...s, avg_table_duration: Number(e.target.value) })} /></Field>
          </div>
        </Section>

        <Section title="Social">
          <Field label="Instagram"><input className="set-in" value={s.instagram_handle || ""} onChange={(e) => setS({ ...s, instagram_handle: e.target.value })} /></Field>
          <Field label="Facebook"><input className="set-in" value={s.facebook_handle || ""} onChange={(e) => setS({ ...s, facebook_handle: e.target.value })} /></Field>
          <Field label="TikTok"><input className="set-in" value={s.tiktok_handle || ""} onChange={(e) => setS({ ...s, tiktok_handle: e.target.value })} /></Field>
        </Section>

        <Section title="Info per i clienti">
          <Field label="Link Google Maps"><input className="set-in" value={s.google_maps_url || ""} onChange={(e) => setS({ ...s, google_maps_url: e.target.value })} placeholder="https://maps.app.goo.gl/..." /></Field>
          <Field label="Cosa sapere prima di venire"><textarea className="set-in" rows={2} value={s.good_to_know || ""} onChange={(e) => setS({ ...s, good_to_know: e.target.value })} placeholder="es. Si consiglia la prenotazione il weekend. Tavolo libero per max 2h." /></Field>
          <Toggle label="♿ Accessibile a sedie a rotelle" v={!!s.wheelchair_accessible} onChange={(v) => setS({ ...s, wheelchair_accessible: v })} />
          <Toggle label="🐶 Animali ammessi" v={!!s.pets_allowed} onChange={(v) => setS({ ...s, pets_allowed: v })} />
          <Toggle label="🅿 Parcheggio disponibile" v={!!s.parking_available} onChange={(v) => setS({ ...s, parking_available: v })} />
          <Toggle label="👶 Adatto ai bambini" v={!!s.kid_friendly} onChange={(v) => setS({ ...s, kid_friendly: v })} />
          <Field label="Età minima (lascia vuoto se non c'è)"><input type="number" className="set-in" value={s.min_age ?? ""} onChange={(e) => setS({ ...s, min_age: e.target.value ? Number(e.target.value) : null })} /></Field>
        </Section>

        <Section title="Prenotazioni">
          <Toggle label="Chiedi occasione speciale" v={s.ask_occasion} onChange={(v) => setS({ ...s, ask_occasion: v })} />
          <Toggle label="Chiedi allergie" v={s.ask_allergies} onChange={(v) => setS({ ...s, ask_allergies: v })} />
          <Toggle label="Lista d'attesa attiva" v={s.waitlist_enabled} onChange={(v) => setS({ ...s, waitlist_enabled: v })} />
          <Toggle label="Reminder 24h prima" v={s.reminder_24h} onChange={(v) => setS({ ...s, reminder_24h: v })} />
          <Toggle label="Follow-up post-cena" v={s.followup_enabled} onChange={(v) => setS({ ...s, followup_enabled: v })} />
        </Section>
      </div>

      {/* Staff access — separate card so it stands out */}
      <div className="mt-5 rounded-2xl border border-border bg-card p-5">
        <h2 className="mb-1 font-display text-lg italic text-terracotta">Accesso Staff</h2>
        <p className="mb-4 text-xs text-muted-foreground">Condividi i link con il tuo staff. Chiunque abbia il PIN può accedere all'app corrispondente.</p>

        {/* PIN display + regenerate */}
        <div className="mb-4 flex items-center gap-3">
          <div className="flex-1">
            <span className="mb-1 block text-xs uppercase tracking-wider text-muted-foreground">PIN corrente</span>
            <span className="font-mono text-2xl tracking-[0.3em] text-foreground">
              {s.staff_pin || "—"}
            </span>
          </div>
          <button
            onClick={regeneratePin}
            disabled={pinBusy}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:border-terracotta hover:text-terracotta disabled:opacity-40"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            {pinBusy ? "..." : "Rigenera"}
          </button>
        </div>

        <div className="space-y-2">
          {/* Sala link */}
          <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2.5">
            <span className="mr-1 text-base">👨‍🍽️</span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold">App Cameriere</p>
              <p className="truncate font-mono text-[11px] text-muted-foreground">
                {typeof window !== "undefined" ? window.location.origin : ""}/staff?pin={s.staff_pin || "…"}
              </p>
            </div>
            <button
              onClick={() => copyLink(`/staff?pin=${s.staff_pin || ""}`)}
              className="shrink-0 rounded-md border border-border p-1.5 text-muted-foreground hover:text-foreground"
              title="Copia link"
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Cucina link */}
          <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2.5">
            <span className="mr-1 text-base">👨‍🍳</span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold">App Cucina</p>
              <p className="truncate font-mono text-[11px] text-muted-foreground">
                {typeof window !== "undefined" ? window.location.origin : ""}/kitchen?pin={s.staff_pin || "…"}
              </p>
            </div>
            <button
              onClick={() => copyLink(`/kitchen?pin=${s.staff_pin || ""}`)}
              className="shrink-0 rounded-md border border-border p-1.5 text-muted-foreground hover:text-foreground"
              title="Copia link"
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <p className="mt-3 text-[11px] text-muted-foreground/60">
          Dopo aver rigenerato il PIN, i vecchi link non funzioneranno più. Ricondividi i link con lo staff.
        </p>
      </div>

      <button onClick={save} disabled={busy} className="mt-5 rounded-lg bg-terracotta px-6 py-3 font-medium text-paper disabled:opacity-40">{busy ? "Salvo..." : "Salva modifiche"}</button>

      <style>{`.set-in{width:100%;border:1px solid hsl(var(--border));background:hsl(var(--background));border-radius:8px;padding:8px 10px;font-size:14px;color:inherit}`}</style>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 font-display text-lg italic text-terracotta">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1 block text-xs uppercase tracking-wider text-muted-foreground">{label}</span>{children}</label>;
}
function Toggle({ label, v, onChange }: { label: string; v: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between py-1 text-sm">
      <span>{label}</span>
      <button type="button" onClick={() => onChange(!v)} className={`relative h-5 w-9 rounded-full transition ${v ? "bg-terracotta" : "bg-border"}`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-paper transition ${v ? "left-[18px]" : "left-0.5"}`} />
      </button>
    </label>
  );
}
