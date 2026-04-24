import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { callAI } from "@/server/ai";

export const Route = createFileRoute("/owner/campaigns")({
  head: () => ({ meta: [{ title: "Campagne — Unobuono" }] }),
  component: CampaignsPage,
});

type Client = {
  id: string;
  name: string;
  phone: string | null;
  visit_count: number | null;
  total_spent: number | null;
  last_visit: string | null;
  birthday: string | null;
  tags: string[] | null;
};

type Campaign = {
  id: string;
  name: string;
  channel: string;
  message: string;
  recipient_count: number | null;
  sent_count: number | null;
  failed_count: number | null;
  status: string | null;
  sent_at: string | null;
  created_at: string | null;
};

type Filters = {
  minVisits: number;
  hasPhone: boolean;
  birthdayMonth: number | null; // 1-12
  tag: string;
  daysSinceVisit: number | null;
};

const DEFAULT_FILTERS: Filters = {
  minVisits: 0,
  hasPhone: true,
  birthdayMonth: null,
  tag: "",
  daysSinceVisit: null,
};

function applyFilters(clients: Client[], f: Filters): Client[] {
  return clients.filter((c) => {
    if (f.hasPhone && !c.phone) return false;
    if ((c.visit_count || 0) < f.minVisits) return false;
    if (f.tag && !(c.tags || []).map((t) => t.toLowerCase()).includes(f.tag.toLowerCase())) return false;
    if (f.birthdayMonth && c.birthday) {
      const m = new Date(c.birthday).getMonth() + 1;
      if (m !== f.birthdayMonth) return false;
    } else if (f.birthdayMonth && !c.birthday) {
      return false;
    }
    if (f.daysSinceVisit && c.last_visit) {
      const days = (Date.now() - new Date(c.last_visit).getTime()) / 86400000;
      if (days < f.daysSinceVisit) return false;
    }
    return true;
  });
}

function exportCsv(rows: Client[]) {
  const header = ["name", "phone", "visit_count", "total_spent", "last_visit", "tags"];
  const esc = (v: any) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push([r.name, r.phone || "", r.visit_count || 0, r.total_spent || 0, r.last_visit || "", (r.tags || []).join("|")].map(esc).join(","));
  }
  const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `destinatari-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function CampaignsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [name, setName] = useState("");
  const [channel, setChannel] = useState<"sms" | "whatsapp">("sms");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    const [c, k] = await Promise.all([
      supabase.from("clients").select("*").order("visit_count", { ascending: false }),
      supabase.from("campaigns").select("*").order("created_at", { ascending: false }).limit(20),
    ]);
    setClients((c.data || []) as Client[]);
    setCampaigns((k.data || []) as Campaign[]);
  }

  const recipients = useMemo(() => applyFilters(clients, filters), [clients, filters]);
  const allTags = useMemo(() => {
    const s = new Set<string>();
    clients.forEach((c) => (c.tags || []).forEach((t) => s.add(t)));
    return Array.from(s);
  }, [clients]);

  async function generateMessage() {
    if (!name.trim()) { toast.error("Dai un nome alla campagna prima"); return; }
    setGenerating(true);
    try {
      const r = await callAI({ data: { messages: [
        { role: "system", content: "Scrivi messaggi SMS/WhatsApp brevi (max 280 caratteri), caldi, in italiano, per una pizzeria. Includi nome ristorante 'Carpediem' e chiamata all'azione chiara. Niente emoji eccessive (1-2 max). Niente link." },
        { role: "user", content: `Campagna: "${name}". Canale: ${channel}. Scrivi solo il testo del messaggio, niente altro.` },
      ] } });
      if (r.error || !r.content) { toast.error("Errore AI"); return; }
      setMessage(r.content.trim().replace(/^["']|["']$/g, ""));
    } finally { setGenerating(false); }
  }

  async function sendCampaign() {
    if (!name.trim() || !message.trim()) { toast.error("Nome e messaggio sono obbligatori"); return; }
    if (recipients.length === 0) { toast.error("Nessun destinatario con questi filtri"); return; }
    if (!confirm(`Inviare "${name}" a ${recipients.length} clienti via ${channel.toUpperCase()}?`)) return;
    setSending(true);
    try {
      const { data, error } = await supabase.from("campaigns").insert({
        name,
        channel,
        message,
        filter: filters as any,
        recipient_count: recipients.length,
        sent_count: recipients.length,
        failed_count: 0,
        status: "sent",
        sent_at: new Date().toISOString(),
      }).select().single();
      if (error) throw error;
      setCampaigns((p) => [data as Campaign, ...p]);
      toast.success(`Campagna registrata per ${recipients.length} clienti. Per l'invio reale via ${channel.toUpperCase()}, collega Twilio dalle Impostazioni.`);
      setName(""); setMessage("");
    } catch (e: any) {
      toast.error(e.message || "Errore");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-5 py-7">
      <header className="mb-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink/50">Marketing</p>
        <h1 className="font-display text-4xl uppercase tracking-tight">Campagne</h1>
        <p className="mt-1 text-sm text-muted-foreground">Invia offerte ai tuoi clienti via SMS o WhatsApp.</p>
      </header>

      <div className="mb-6 rounded-2xl border-2 border-yellow bg-yellow/15 px-4 py-3 text-xs">
        <strong className="font-bold uppercase tracking-wider">Modalità demo.</strong>{" "}
        Le campagne vengono salvate ma non spedite davvero. Per attivare l'invio reale collega <strong>Twilio</strong> (SMS/WhatsApp) — chiedi all'agente "collega Twilio".
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* Composer */}
        <section className="space-y-5 rounded-2xl border-2 border-ink bg-paper p-5">
          <div>
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-ink/60">Nome campagna</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Es. Festa del 1° Maggio"
              className="w-full rounded-lg border-2 border-ink bg-paper px-3 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-yellow"
            />
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-ink/60">Canale</label>
            <div className="flex gap-2">
              {(["sms", "whatsapp"] as const).map((ch) => (
                <button
                  key={ch}
                  onClick={() => setChannel(ch)}
                  className={`flex-1 rounded-lg border-2 border-ink px-3 py-2 text-xs font-bold uppercase tracking-wider ${channel === ch ? "bg-ink text-yellow" : "bg-paper text-ink hover:bg-cream-dark"}`}
                >
                  {ch === "sms" ? "📱 SMS" : "💬 WhatsApp"}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-[11px] font-bold uppercase tracking-wider text-ink/60">Messaggio</label>
              <button
                onClick={generateMessage}
                disabled={generating}
                className="text-[11px] font-bold uppercase tracking-wider text-ink underline-offset-2 hover:underline disabled:opacity-40"
              >
                {generating ? "Genero..." : "✨ Genera con AI"}
              </button>
            </div>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Es. 🌹 Buon 1° Maggio dai Carpediem! Per i lavoratori, oggi una pizza è offerta. Mostra questo messaggio in cassa. Ti aspettiamo!"
              rows={6}
              maxLength={320}
              className="w-full rounded-lg border-2 border-ink bg-paper px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow"
            />
            <div className="mt-1 flex justify-between text-[10px] uppercase tracking-wider text-ink/50">
              <span>{message.length}/320 caratteri</span>
              <span>{channel === "sms" ? `${Math.ceil(message.length / 160) || 1} SMS` : "1 messaggio"}</span>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 border-t-2 border-ink/10 pt-4">
            <div>
              <p className="font-display text-2xl">{recipients.length}</p>
              <p className="text-[10px] uppercase tracking-wider text-ink/60">destinatari selezionati</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => exportCsv(recipients)}
                disabled={recipients.length === 0}
                className="rounded-xl border-2 border-ink bg-paper px-4 py-3 text-xs font-bold uppercase tracking-wider text-ink hover:bg-cream-dark disabled:opacity-40"
                title="Scarica CSV per inviare a mano via WhatsApp Business"
              >
                ⬇ CSV
              </button>
              <button
                onClick={sendCampaign}
                disabled={sending || !message.trim() || !name.trim() || recipients.length === 0}
                className="rounded-xl border-2 border-ink bg-yellow px-6 py-3 text-sm font-bold uppercase tracking-wider text-ink shadow-[4px_4px_0_0_#000] transition active:translate-x-0.5 active:translate-y-0.5 active:shadow-none disabled:opacity-40"
              >
                {sending ? "Invio..." : `Invia a ${recipients.length}`}
              </button>
            </div>
          </div>
        </section>

        {/* Filters */}
        <aside className="space-y-4 rounded-2xl border-2 border-ink bg-paper p-5">
          <h3 className="font-display text-lg uppercase tracking-tight">Filtra clienti</h3>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={filters.hasPhone} onChange={(e) => setFilters({ ...filters, hasPhone: e.target.checked })} className="h-4 w-4 accent-yellow" />
            <span>Solo con telefono</span>
          </label>

          <div>
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-ink/60">Visite minime</label>
            <input type="number" min={0} value={filters.minVisits} onChange={(e) => setFilters({ ...filters, minVisits: Number(e.target.value) || 0 })} className="w-full rounded-lg border-2 border-ink bg-paper px-3 py-2 text-sm" />
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-ink/60">Compleanno nel mese</label>
            <select value={filters.birthdayMonth ?? ""} onChange={(e) => setFilters({ ...filters, birthdayMonth: e.target.value ? Number(e.target.value) : null })} className="w-full rounded-lg border-2 border-ink bg-paper px-3 py-2 text-sm">
              <option value="">— tutti —</option>
              {["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"].map((m, i) => (
                <option key={i} value={i + 1}>{m}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-ink/60">Inattivi da (giorni)</label>
            <input type="number" min={0} value={filters.daysSinceVisit ?? ""} onChange={(e) => setFilters({ ...filters, daysSinceVisit: e.target.value ? Number(e.target.value) : null })} placeholder="es. 60" className="w-full rounded-lg border-2 border-ink bg-paper px-3 py-2 text-sm" />
          </div>

          {allTags.length > 0 && (
            <div>
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-ink/60">Tag</label>
              <div className="flex flex-wrap gap-1.5">
                <button onClick={() => setFilters({ ...filters, tag: "" })} className={`rounded-full border-2 border-ink px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider ${!filters.tag ? "bg-ink text-yellow" : "bg-paper"}`}>tutti</button>
                {allTags.map((t) => (
                  <button key={t} onClick={() => setFilters({ ...filters, tag: t })} className={`rounded-full border-2 border-ink px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider ${filters.tag === t ? "bg-ink text-yellow" : "bg-paper"}`}>{t}</button>
                ))}
              </div>
            </div>
          )}

          <button onClick={() => setFilters(DEFAULT_FILTERS)} className="w-full rounded-lg border-2 border-ink/20 px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-ink/60 hover:border-ink hover:text-ink">
            Reset filtri
          </button>
        </aside>
      </div>

      {/* History */}
      <section className="mt-8">
        <h2 className="mb-3 font-display text-2xl uppercase tracking-tight">Storico</h2>
        {campaigns.length === 0 ? (
          <p className="rounded-2xl border-2 border-dashed border-ink/20 p-8 text-center text-sm text-muted-foreground">Nessuna campagna ancora.</p>
        ) : (
          <ul className="divide-y-2 divide-ink/10 overflow-hidden rounded-2xl border-2 border-ink bg-paper">
            {campaigns.map((c) => (
              <li key={c.id} className="flex items-start gap-4 p-4">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-yellow text-base">{c.channel === "whatsapp" ? "💬" : "📱"}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="font-display text-base uppercase tracking-tight">{c.name}</h3>
                    <span className="font-mono text-[10px] uppercase tracking-wider text-ink/50">
                      {c.sent_at ? new Date(c.sent_at).toLocaleString("it-IT", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "bozza"}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-ink/70">{c.message}</p>
                  <p className="mt-1 text-[11px] uppercase tracking-wider text-ink/50">→ {c.sent_count || 0} destinatari</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}