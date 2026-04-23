import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/owner/settings")({
  head: () => ({ meta: [{ title: "Impostazioni — Unobuono" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const [s, setS] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.from("restaurant_settings").select("*").limit(1).maybeSingle().then(({ data }) => setS(data));
  }, []);

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
        <h1 className="font-display text-3xl">Impostazioni</h1>
        <p className="text-sm text-muted-foreground">Profilo del ristorante e preferenze.</p>
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

        <Section title="Prenotazioni">
          <Toggle label="Chiedi occasione speciale" v={s.ask_occasion} onChange={(v) => setS({ ...s, ask_occasion: v })} />
          <Toggle label="Chiedi allergie" v={s.ask_allergies} onChange={(v) => setS({ ...s, ask_allergies: v })} />
          <Toggle label="Lista d'attesa attiva" v={s.waitlist_enabled} onChange={(v) => setS({ ...s, waitlist_enabled: v })} />
          <Toggle label="Reminder 24h prima" v={s.reminder_24h} onChange={(v) => setS({ ...s, reminder_24h: v })} />
          <Toggle label="Follow-up post-cena" v={s.followup_enabled} onChange={(v) => setS({ ...s, followup_enabled: v })} />
        </Section>
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
