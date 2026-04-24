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
  "Elimina la Diavola dal menu",
  "Cambia prezzo Margherita a 9€",
  "Quali piatti non sono disponibili stasera?",
  "Crea campagna 1° Maggio per i lavoratori",
  "Quanti coperti ho stasera?",
];

const SYSTEM = `Sei l'agente AI del ristorante Carpediem (gestionale Unobuono). Capisci comandi in italiano e li esegui restituendo SOLO un JSON valido (nessun testo prima/dopo), oppure testo libero per chat normale.

AZIONI MENU DISPONIBILI:

1) menu_toggle — segna piatto/i come NON disponibile o disponibile STASERA (temporaneo, modifica solo il flag available).
   Triggers: "togli stasera", "non disponibile stasera", "finita per oggi", "esaurita", "rimettila disponibile", "ripristina"
   Formato: {"action":"menu_toggle","filter":{"name_contains":"diavola"} | {"all":true},"available":false}

2) menu_remove — ELIMINA DEFINITIVAMENTE il piatto dal menu (DELETE dal database, irreversibile).
   Triggers: "togli definitivamente", "elimina", "rimuovi dal menu", "non la facciamo più", "cancella dal menu", "rimuovila per sempre"
   Formato: {"action":"menu_remove","item_name":"diavola"}

3) menu_update — modifica nome, prezzo, descrizione o categoria di un piatto esistente. Supporta anche moltiplicatore prezzo.
   Triggers: "cambia prezzo X a Y€", "rinomina", "riscrivi descrizione", "aumenta del N% i prezzi"
   Formato: {"action":"menu_update","filter":{"name_contains":"margherita"} | {"category":"Pizze"},"set":{"price":9.00,"name":"...","description":"...","category":"...","price_multiplier":1.1}}

4) menu_add — aggiunge un nuovo piatto al menu.
   Triggers: "aggiungi X a Y€ — descrizione", "nuovo piatto"
   Formato: {"action":"menu_add","item":{"name":"...","price":12.50,"description":"...","category":"Pizze"}}

5) menu_rewrite_description — chiede all'AI di riscrivere in modo evocativo la descrizione di un piatto, poi la salva.
   Triggers: "riscrivi la descrizione di X", "rendi più evocativa la descrizione di X"
   Formato: {"action":"menu_rewrite_description","item_name":"diavola"}

6) query — risposte informative dal database.
   Formato: {"action":"query","question":"coperti_oggi" | "recensioni_nuove" | "piatti_non_disponibili"}

7) campaign_draft — crea una BOZZA di campagna SMS/WhatsApp ai clienti. NON invia, salva la bozza nello storico campagne. L'owner deve aprire la pagina Campagne per filtrare destinatari e inviare.
   Triggers: "manda offerta ai clienti", "campagna sms", "promo a tutti", "messaggio ai clienti", "festa del 1 maggio"
   Formato: {"action":"campaign_draft","name":"Festa 1 Maggio","channel":"sms" | "whatsapp","message":"testo del messaggio già pronto"}

REGOLA CRITICA: distingui SEMPRE tra TEMPORANEO (stasera/oggi/finita/esaurita → menu_toggle) e DEFINITIVO (definitivamente/per sempre/elimina/cancella → menu_remove). In caso di ambiguità preferisci menu_toggle (più sicuro, reversibile).

REGOLA INVIO: NON puoi inviare SMS/email/WhatsApp direttamente. Per le offerte ai clienti usa SOLO campaign_draft (crea la bozza) e poi indica all'owner di aprire la pagina Campagne per inviare. NON dire mai che hai inviato qualcosa che non hai inviato.

Per chat normale, rispondi in italiano max 2 frasi senza JSON.

ESEMPI:
- "togli la diavola stasera" → {"action":"menu_toggle","filter":{"name_contains":"diavola"},"available":false}
- "elimina la diavola dal menu" → {"action":"menu_remove","item_name":"diavola"}
- "non facciamo più la quattro formaggi" → {"action":"menu_remove","item_name":"quattro formaggi"}
- "ripristina tutti i piatti" → {"action":"menu_toggle","filter":{"all":true},"available":true}
- "rimetti disponibili tutte le pizze" → {"action":"menu_toggle","filter":{"category":"Pizze"},"available":true}
- "aumenta del 10% i prezzi delle pizze" → {"action":"menu_update","filter":{"category":"Pizze"},"set":{"price_multiplier":1.1}}
- "cambia prezzo margherita a 9€" → {"action":"menu_update","filter":{"name_contains":"margherita"},"set":{"price":9.00}}
- "aggiungi Bufalina a 11€ — pomodoro, mozzarella di bufala, basilico" → {"action":"menu_add","item":{"name":"Bufalina","price":11.00,"description":"pomodoro, mozzarella di bufala, basilico","category":"Pizze"}}
- "riscrivi la descrizione della diavola" → {"action":"menu_rewrite_description","item_name":"diavola"}
- "quali piatti non sono disponibili stasera?" → {"action":"query","question":"piatti_non_disponibili"}
- "quanti coperti stasera?" → {"action":"query","question":"coperti_oggi"}
- "quante recensioni nuove?" → {"action":"query","question":"recensioni_nuove"}
- "manda un messaggio per la festa del 1 maggio, pizza offerta ai lavoratori" → {"action":"campaign_draft","name":"Festa del 1° Maggio","channel":"sms","message":"🌹 Buon 1° Maggio dai Carpediem! Per i lavoratori oggi una pizza è offerta. Mostra questo messaggio in cassa. Ti aspettiamo!"}`;

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

    // Helper: build filter query
    const applyFilter = (q: any, filter: any) => {
      if (!filter || filter.all) return q;
      if (filter.name_contains) q = q.ilike("name", `%${filter.name_contains}%`);
      if (filter.category) q = q.ilike("category", `%${filter.category}%`);
      return q;
    };

    if (json.action === "menu_toggle") {
      let q = supabase.from("menu_items").select("*");
      q = applyFilter(q, json.filter);
      const { data: matches } = await q;
      if (!matches || matches.length === 0) return "Non ho trovato piatti corrispondenti.";
      const available = json.available !== false;
      await Promise.all(matches.map((it: any) =>
        supabase.from("menu_items").update({ available, updated_at: new Date().toISOString() }).eq("id", it.id)
      ));
      const verb = available ? "ripristinati" : "resi non disponibili";
      return `✓ ${matches.length} piatti ${verb}: ${matches.slice(0, 3).map((m: any) => m.name).join(", ")}${matches.length > 3 ? "..." : ""}`;
    }

    if (json.action === "menu_remove") {
      const name = json.item_name;
      if (!name) return "Specifica quale piatto eliminare.";
      const { data: matches } = await supabase.from("menu_items").select("*").ilike("name", `%${name}%`);
      if (!matches || matches.length === 0) return `Nessun piatto trovato con "${name}".`;
      const { error } = await supabase.from("menu_items").delete().ilike("name", `%${name}%`);
      if (error) return `Errore eliminazione: ${error.message}`;
      return `🗑️ Eliminati definitivamente dal menu ${matches.length} piatti: ${matches.map((m: any) => m.name).join(", ")}`;
    }

    if (json.action === "menu_update") {
      let q = supabase.from("menu_items").select("*");
      q = applyFilter(q, json.filter);
      const { data: matches } = await q;
      if (!matches || matches.length === 0) return "Non ho trovato piatti corrispondenti.";

      await Promise.all(matches.map(async (it: any) => {
        const upd: any = { updated_at: new Date().toISOString() };
        if (json.set.available !== undefined) upd.available = json.set.available;
        if (json.set.name) upd.name = json.set.name;
        if (json.set.description) upd.description = json.set.description;
        if (json.set.category) upd.category = json.set.category;
        if (json.set.price !== undefined) upd.price = Number(json.set.price);
        if (json.set.price_multiplier && it.price) upd.price = Math.round(Number(it.price) * json.set.price_multiplier * 100) / 100;
        return supabase.from("menu_items").update(upd).eq("id", it.id);
      }));
      return `✓ Aggiornati ${matches.length} piatti: ${matches.slice(0, 3).map((m: any) => m.name).join(", ")}${matches.length > 3 ? "..." : ""}`;
    }

    if (json.action === "menu_add") {
      const it = json.item || {};
      if (!it.name) return "Manca il nome del piatto.";
      const payload: any = {
        name: it.name,
        price: it.price != null ? Number(it.price) : null,
        description: it.description || null,
        category: it.category || null,
        available: true,
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase.from("menu_items").insert(payload);
      if (error) return `Errore: ${error.message}`;
      return `➕ Aggiunto al menu: ${it.name}${it.price ? ` (€${Number(it.price).toFixed(2)})` : ""}`;
    }

    if (json.action === "menu_rewrite_description") {
      const name = json.item_name;
      if (!name) return "Specifica il piatto.";
      const { data: matches } = await supabase.from("menu_items").select("*").ilike("name", `%${name}%`).limit(1);
      if (!matches || matches.length === 0) return `Nessun piatto trovato con "${name}".`;
      const item = matches[0];
      const r = await callAI({ data: { messages: [
        { role: "system", content: "Sei un copywriter di menu di pizzeria italiana. Scrivi descrizioni evocative, brevi (max 15 parole), sensoriali, in italiano. Solo la descrizione, niente virgolette." },
        { role: "user", content: `Riscrivi in modo evocativo la descrizione del piatto "${item.name}". Descrizione attuale: "${item.description || "(nessuna)"}". Categoria: ${item.category || "—"}.` },
      ] } });
      if (r.error || !r.content) return "Errore generazione descrizione.";
      const newDesc = r.content.trim().replace(/^["']|["']$/g, "");
      await supabase.from("menu_items").update({ description: newDesc, updated_at: new Date().toISOString() }).eq("id", item.id);
      return `✍️ Nuova descrizione di ${item.name}: "${newDesc}"`;
    }

    if (json.action === "query") {
      const today = new Date().toISOString().slice(0, 10);
      const q = (json.question || "").toLowerCase();
      if (q.includes("piatti_non_disponibili") || /non disponib|esaurit|finit/i.test(q)) {
        const { data } = await supabase.from("menu_items").select("name, category").eq("available", false).order("category");
        if (!data || data.length === 0) return "Tutti i piatti sono disponibili stasera. ✅";
        return `Non disponibili stasera (${data.length}): ${data.map((d: any) => d.name).join(", ")}`;
      }
      if (q.includes("copert") || q.includes("prenot")) {
        const { data } = await supabase.from("reservations").select("party_size").eq("date", today);
        const covers = (data || []).reduce((s: number, r: any) => s + r.party_size, 0);
        return `Stasera hai ${data?.length || 0} prenotazioni per un totale di ${covers} coperti.`;
      }
      if (q.includes("recension")) {
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
