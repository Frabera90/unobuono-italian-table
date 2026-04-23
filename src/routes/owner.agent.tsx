import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { callAI } from "@/server/ai";
import { toast } from "sonner";

export const Route = createFileRoute("/owner/agent")({
  head: () => ({ meta: [{ title: "Agente AI — Unobuono" }] }),
  component: AgentPage,
});

type Msg = { role: "user" | "assistant"; content: string; ts: number };

const SUGGESTIONS = [
  "Togli la Diavola stasera",
  "Rendi disponibili tutti i piatti",
  "Aumenta del 10% i prezzi delle pizze",
  "Quanti coperti ho stasera?",
];

const SYSTEM = `Sei l'agente AI del ristorante Carpediem (gestionale Unobuono). Capisci comandi in italiano e li esegui.

Quando l'utente chiede di MODIFICARE qualcosa nel menu, rispondi SOLO con un JSON valido (nessun testo prima/dopo) di questo formato:
{"action":"menu_update","filter":{"name_contains":"...", "category":"..."},"set":{"available":true|false,"price_multiplier":1.1,"price":12.50}}

Quando l'utente chiede INFORMAZIONI (quanti coperti, prenotazioni, recensioni), rispondi SOLO con:
{"action":"query","question":"..."}

Per chat normale, rispondi in italiano in modo conciso (max 2 frasi).

Esempi:
- "togli la diavola stasera" → {"action":"menu_update","filter":{"name_contains":"diavola"},"set":{"available":false}}
- "rimetti disponibili tutti i piatti" → {"action":"menu_update","filter":{},"set":{"available":true}}
- "aumenta del 10% i prezzi delle pizze" → {"action":"menu_update","filter":{"category":"Pizze"},"set":{"price_multiplier":1.1}}
- "quanti coperti stasera?" → {"action":"query","question":"coperti_oggi"}`;

function AgentPage() {
  const [msgs, setMsgs] = useState<Msg[]>([
    { role: "assistant", content: "Ciao! Sono il tuo agente. Dimmi cosa vuoi fare — modificare il menu, controllare le prenotazioni, qualsiasi cosa.", ts: Date.now() },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight); }, [msgs]);

  async function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content || busy) return;
    setInput("");
    const newMsgs = [...msgs, { role: "user" as const, content, ts: Date.now() }];
    setMsgs(newMsgs);
    setBusy(true);
    try {
      const r = await callAI({ data: { messages: [{ role: "system", content: SYSTEM }, ...newMsgs.map((m) => ({ role: m.role, content: m.content }))] } });
      if (r.error === "rate_limit") { toast.error("Troppe richieste. Riprova tra poco."); setBusy(false); return; }
      if (r.error === "credits") { toast.error("Crediti AI esauriti."); setBusy(false); return; }
      if (r.error || !r.content) { toast.error("Errore AI"); setBusy(false); return; }

      const reply = await execute(r.content);
      setMsgs((m) => [...m, { role: "assistant", content: reply, ts: Date.now() }]);
    } finally {
      setBusy(false);
    }
  }

  async function execute(raw: string): Promise<string> {
    const trimmed = raw.trim();
    let json: any = null;
    try {
      const m = trimmed.match(/\{[\s\S]*\}/);
      if (m) json = JSON.parse(m[0]);
    } catch {}

    if (!json?.action) return raw;

    if (json.action === "menu_update") {
      let q = supabase.from("menu_items").select("*");
      if (json.filter?.name_contains) q = q.ilike("name", `%${json.filter.name_contains}%`);
      if (json.filter?.category) q = q.ilike("category", `%${json.filter.category}%`);
      const { data: matches } = await q;
      if (!matches || matches.length === 0) return "Non ho trovato piatti corrispondenti.";

      await Promise.all(matches.map(async (it: any) => {
        const upd: any = { updated_at: new Date().toISOString() };
        if (json.set.available !== undefined) upd.available = json.set.available;
        if (json.set.price !== undefined) upd.price = json.set.price;
        if (json.set.price_multiplier && it.price) upd.price = Math.round(Number(it.price) * json.set.price_multiplier * 100) / 100;
        return supabase.from("menu_items").update(upd).eq("id", it.id);
      }));
      return `✓ Aggiornati ${matches.length} piatti: ${matches.slice(0, 3).map((m: any) => m.name).join(", ")}${matches.length > 3 ? "..." : ""}`;
    }

    if (json.action === "query") {
      const today = new Date().toISOString().slice(0, 10);
      if (/copert|prenot/i.test(json.question)) {
        const { data } = await supabase.from("reservations").select("party_size").eq("date", today);
        const covers = (data || []).reduce((s: number, r: any) => s + r.party_size, 0);
        return `Stasera hai ${data?.length || 0} prenotazioni per un totale di ${covers} coperti.`;
      }
      if (/recension/i.test(json.question)) {
        const { count } = await supabase.from("reviews").select("id", { count: "exact" }).eq("status", "new");
        return `Hai ${count || 0} recensioni nuove a cui rispondere.`;
      }
      return "Non ho capito la domanda.";
    }
    return raw;
  }

  return (
    <div className="mx-auto flex h-screen max-w-3xl flex-col px-5 py-7">
      <header className="mb-4">
        <h1 className="font-display text-3xl">Agente AI</h1>
        <p className="text-sm text-muted-foreground">Comanda il ristorante in linguaggio naturale.</p>
      </header>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto rounded-2xl border border-border bg-card p-4">
        {msgs.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${m.role === "user" ? "bg-terracotta text-paper" : "bg-cream-dark/60 text-foreground"}`}>{m.content}</div>
          </div>
        ))}
        {busy && <div className="text-sm text-muted-foreground">L'agente sta pensando...</div>}
      </div>

      {msgs.length <= 2 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button key={s} onClick={() => send(s)} className="rounded-full border border-border bg-card px-3 py-1.5 text-xs hover:bg-cream-dark">{s}</button>
          ))}
        </div>
      )}

      <div className="mt-3 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Scrivi un comando..."
          disabled={busy}
          className="flex-1 rounded-lg border border-border bg-card px-4 py-3 text-sm"
        />
        <button onClick={() => send()} disabled={busy || !input.trim()} className="rounded-lg bg-terracotta px-5 py-3 text-sm font-medium text-paper disabled:opacity-40">Invia</button>
      </div>
    </div>
  );
}
