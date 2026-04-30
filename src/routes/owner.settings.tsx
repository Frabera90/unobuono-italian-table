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
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pinBusy, setPinBusy] = useState(false);

  useEffect(() => {
    (async () => {
      // 1) Get the current user's restaurant_id (only the owner sees this row)
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error("Devi accedere come proprietario"); return; }

      const { data: rest } = await supabase
        .from("restaurants")
        .select("id")
        .eq("owner_id", user.id)
        .maybeSingle();

      if (!rest?.id) { toast.error("Ristorante non trovato per questo account"); return; }
      setRestaurantId(rest.id);

      // 2) Load settings filtered explicitly by restaurant_id (no cross-account leakage)
      const { data: settings } = await supabase
        .from("restaurant_settings")
        .select("*")
        .eq("restaurant_id", rest.id)
        .maybeSingle();

      if (settings) {
        setS(settings);
      } else {
        // No settings row yet — create a minimal one so the form has something to update
        const { data: created } = await supabase
          .from("restaurant_settings")
          .insert({ restaurant_id: rest.id })
          .select("*")
          .maybeSingle();
        setS(created);
      }
    })();
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
    if (!s || !restaurantId) return;
    setBusy(true);
    // Strip identity fields and force-scope to the current owner's restaurant_id.
    // Never trust the in-memory `s.restaurant_id` — always re-bind to the verified owner's id.
    const { id: _ignoreId, restaurant_id: _ignoreRid, created_at: _ignoreCreated, ...rest } = s;
    const { error } = await supabase
      .from("restaurant_settings")
      .update({ ...rest, updated_at: new Date().toISOString() })
      .eq("restaurant_id", restaurantId);
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
          <Field label="📧 Email per notifiche (prenotazioni, pre-ordini, disdette)">
            <input type="email" className="set-in" value={s.notification_email || ""} onChange={(e) => setS({ ...s, notification_email: e.target.value })} placeholder="proprietario@ristorante.it" />
          </Field>
        </Section>

        <Section title="Capacità">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Coperti max"><input type="number" className="set-in" value={s.max_covers || 0} onChange={(e) => setS({ ...s, max_covers: Number(e.target.value) })} /></Field>
            <Field label="Durata media tavolo (min)"><input type="number" className="set-in" value={s.avg_table_duration || 0} onChange={(e) => setS({ ...s, avg_table_duration: Number(e.target.value) })} /></Field>
          </div>
        </Section>

        <Section title="Orari di apertura">
          <p className="-mt-1 text-xs text-muted-foreground">Aggiungi uno o più turni per ogni giorno (es. pranzo + cena). Lascia vuoto se chiuso.</p>
          <OpeningHoursEditor
            value={s.opening_hours || {}}
            onChange={(v) => setS({ ...s, opening_hours: v })}
          />
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

      {/* AI info */}
      <div className="mt-5 rounded-2xl border border-border bg-card p-5">
        <h2 className="mb-1 font-display text-lg italic text-terracotta">Intelligenza Artificiale</h2>
        <p className="mb-4 text-xs text-muted-foreground">Le funzioni AI (assistente, descrizioni menu, miglioramento foto, social calendar) sono incluse nella piattaforma.</p>

        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
          <p className="mb-1 text-sm font-semibold text-amber-900 dark:text-amber-200">I crediti AI sono limitati</p>
          <p className="text-xs leading-relaxed text-amber-800 dark:text-amber-300">
            Ogni richiesta all'AI consuma crediti inclusi nel piano Unobuono. Quando i crediti
            si esauriscono, le funzioni AI mostrano un avviso e vengono temporaneamente
            disabilitate fino al giorno successivo. Per un uso intensivo (es. migliaia di foto
            al giorno) contatta il supporto.
          </p>
        </div>

        <div className="mt-4 space-y-2 text-xs text-muted-foreground">
          <p>Funzioni che usano crediti AI:</p>
          <ul className="ml-3 list-disc space-y-1">
            <li>Assistente AI (chat + azioni sul menu)</li>
            <li>Miglioramento foto piatti</li>
            <li>Estrazione menu da foto</li>
            <li>Social calendar automatico</li>
            <li>Riscrivi descrizioni menu</li>
          </ul>
        </div>
      </div>

      <button onClick={save} disabled={busy} className="mt-5 rounded-lg bg-terracotta px-6 py-3 font-medium text-paper disabled:opacity-40">{busy ? "Salvo..." : "Salva modifiche"}</button>

      <style>{`
        .set-in{width:100%;border:1.5px solid hsl(var(--border));background:hsl(var(--background));border-radius:10px;padding:10px 12px;font-size:14px;color:hsl(var(--foreground));transition:border-color .15s, box-shadow .15s;outline:none;box-shadow:0 1px 0 rgba(0,0,0,0.02) inset;}
        .set-in:hover{border-color:hsl(var(--foreground)/0.35);}
        .set-in:focus{border-color:hsl(var(--primary));box-shadow:0 0 0 3px hsl(var(--primary)/0.18);}
        .set-in::placeholder{color:hsl(var(--muted-foreground)/0.7);}
      `}</style>
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

type Hours = Record<string, string>;
const DAYS: { k: string; label: string }[] = [
  { k: "mon", label: "Lunedì" },
  { k: "tue", label: "Martedì" },
  { k: "wed", label: "Mercoledì" },
  { k: "thu", label: "Giovedì" },
  { k: "fri", label: "Venerdì" },
  { k: "sat", label: "Sabato" },
  { k: "sun", label: "Domenica" },
];

function parseShifts(raw: string): Array<[string, string]> {
  if (!raw || raw.trim().toLowerCase() === "closed") return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const [a, b] = s.split("-").map((x) => (x || "").trim());
      return [a || "", b || ""] as [string, string];
    });
}
function serializeShifts(shifts: Array<[string, string]>): string {
  const valid = shifts.filter(([a, b]) => a && b);
  if (valid.length === 0) return "closed";
  return valid.map(([a, b]) => `${a}-${b}`).join(",");
}

function OpeningHoursEditor({ value, onChange }: { value: Hours; onChange: (v: Hours) => void }) {
  function update(day: string, shifts: Array<[string, string]>) {
    onChange({ ...value, [day]: serializeShifts(shifts) });
  }
  return (
    <div className="space-y-2">
      {DAYS.map(({ k, label }) => {
        const raw = value[k] ?? "";
        const closed = !raw || raw.trim().toLowerCase() === "closed";
        const shifts = parseShifts(raw);
        return (
          <div key={k} className="rounded-xl border-2 border-border bg-background p-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium">{label}</span>
              <label className="flex cursor-pointer select-none items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-terracotta"
                  checked={!closed}
                  onChange={(e) => {
                    if (e.target.checked) update(k, shifts.length ? shifts : [["12:00", "14:30"]]);
                    else onChange({ ...value, [k]: "closed" });
                  }}
                />
                {closed ? "Chiuso" : "Aperto"}
              </label>
            </div>
            {!closed && (
              <div className="mt-3 space-y-2">
                {(shifts.length ? shifts : [["", ""] as [string, string]]).map(([from, to], idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="time"
                      className="set-in flex-1"
                      value={from}
                      onChange={(e) => {
                        const next = shifts.length ? [...shifts] : [["", ""] as [string, string]];
                        next[idx] = [e.target.value, to];
                        update(k, next);
                      }}
                    />
                    <span className="text-xs text-muted-foreground">→</span>
                    <input
                      type="time"
                      className="set-in flex-1"
                      value={to}
                      onChange={(e) => {
                        const next = shifts.length ? [...shifts] : [["", ""] as [string, string]];
                        next[idx] = [from, e.target.value];
                        update(k, next);
                      }}
                    />
                    {shifts.length > 1 && (
                      <button
                        type="button"
                        onClick={() => update(k, shifts.filter((_, i) => i !== idx))}
                        className="rounded-md border border-border px-2 py-1.5 text-xs text-muted-foreground hover:border-destructive hover:text-destructive"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => update(k, [...shifts, ["19:00", "23:00"]])}
                  className="text-xs font-medium text-terracotta hover:underline"
                >
                  + Aggiungi turno
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
