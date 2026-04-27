import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callAI } from "@/server/ai";

/** Snapshot compatto dei dati LIVE del ristorante. Iniettato come system message. */
async function buildContext(supabase: any, restaurantId: string) {
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

  const [
    { data: restaurant },
    { data: settings },
    { data: resvToday },
    { data: resvTomorrow },
    { data: menuStats },
    { data: menuOff },
    { data: reviewsNew },
    { data: tasksOpen },
    { data: callsPending },
    { count: clientCount },
  ] = await Promise.all([
    supabase.from("restaurants").select("name, slug").eq("id", restaurantId).maybeSingle(),
    supabase.from("restaurant_settings").select("max_covers, opening_hours, tone, bio").eq("restaurant_id", restaurantId).maybeSingle(),
    supabase.from("reservations").select("id, customer_name, party_size, time, status, arrived, allergies, occasion").eq("restaurant_id", restaurantId).eq("date", today),
    supabase.from("reservations").select("id, party_size, time").eq("restaurant_id", restaurantId).eq("date", tomorrow),
    supabase.from("menu_items").select("id, name, category, price, available, featured").eq("restaurant_id", restaurantId),
    supabase.from("menu_items").select("name").eq("restaurant_id", restaurantId).eq("available", false),
    supabase.from("reviews").select("id, author, rating, text, platform, date").eq("restaurant_id", restaurantId).eq("status", "new").order("date", { ascending: false }).limit(5),
    supabase.from("staff_tasks").select("id, description, table_number").eq("restaurant_id", restaurantId).eq("status", "open").limit(10),
    supabase.from("waiter_calls").select("id, table_number, message").eq("restaurant_id", restaurantId).eq("status", "pending").limit(10),
    supabase.from("clients").select("id", { count: "exact", head: true }).eq("restaurant_id", restaurantId),
  ]);

  const coversToday = (resvToday || []).reduce((s: number, r: any) => s + (r.party_size || 0), 0);
  const coversTomorrow = (resvTomorrow || []).reduce((s: number, r: any) => s + (r.party_size || 0), 0);
  const maxCovers = settings?.max_covers || 60;
  const occupancy = Math.round((coversToday / maxCovers) * 100);

  const arrived = (resvToday || []).filter((r: any) => r.arrived).length;
  const featuredCount = (menuStats || []).filter((m: any) => m.featured).length;

  return {
    today,
    restaurant: restaurant?.name || "—",
    capacity: maxCovers,
    bookings_today: {
      count: resvToday?.length || 0,
      covers: coversToday,
      occupancy_pct: occupancy,
      arrived,
      details: (resvToday || []).slice(0, 12).map((r: any) => `${r.time} ${r.customer_name} (${r.party_size}p)${r.arrived ? " ✓" : ""}${r.allergies ? ` allergie: ${r.allergies}` : ""}`),
    },
    bookings_tomorrow: { count: resvTomorrow?.length || 0, covers: coversTomorrow },
    menu: {
      total: menuStats?.length || 0,
      available: (menuStats || []).filter((m: any) => m.available).length,
      featured: featuredCount,
      unavailable_today: (menuOff || []).map((m: any) => m.name),
      categories: Array.from(new Set((menuStats || []).map((m: any) => m.category).filter(Boolean))) as string[],
    },
    reviews_new: (reviewsNew || []).map((r: any) => ({
      id: r.id, author: r.author, rating: r.rating, text: (r.text || "").slice(0, 200), platform: r.platform,
    })),
    staff_tasks_open: tasksOpen?.length || 0,
    waiter_calls_pending: callsPending?.length || 0,
    clients_total: clientCount || 0,
    tone: settings?.tone || "amichevole e professionale",
  };
}

/** Insights proattivi: cosa merita attenzione ORA. Ritorna anche il suggerimento del prompt. */
export const getAssistantInsights = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data: restaurant } = await supabase.from("restaurants").select("id").maybeSingle();
    if (!restaurant) return { alerts: [], chips: [] };

    const ctx = await buildContext(supabase, restaurant.id);
    const alerts: { level: "red" | "yellow" | "green"; text: string }[] = [];
    const chips: string[] = [];

    // Recensioni negative non risposte
    const negative = ctx.reviews_new.filter((r: { rating: number | null }) => (r.rating || 0) <= 2);
    if (negative.length > 0) {
      alerts.push({ level: "red", text: `${negative.length} recensione/i 1-2★ da gestire` });
      chips.push(`Aiutami a rispondere alla recensione di ${negative[0].author || "cliente"} (${negative[0].rating}★)`);
    } else if (ctx.reviews_new.length > 0) {
      chips.push(`Rispondi alle ${ctx.reviews_new.length} recensioni nuove`);
    }

    // Occupazione
    if (ctx.bookings_today.occupancy_pct >= 90) {
      alerts.push({ level: "yellow", text: `Stasera al ${ctx.bookings_today.occupancy_pct}% — quasi sold out` });
      chips.push("Strategia per gestire la sera piena");
    } else if (ctx.bookings_today.occupancy_pct < 30 && ctx.bookings_today.count < 5) {
      alerts.push({ level: "yellow", text: `Stasera solo ${ctx.bookings_today.covers} coperti — sotto media` });
      chips.push("Idee per riempire la sera (promo, social)");
    }

    // Chiamate cameriere pendenti
    if (ctx.waiter_calls_pending > 0) {
      alerts.push({ level: "red", text: `${ctx.waiter_calls_pending} chiamate cameriere in attesa` });
    }

    // Chip sempre utili (contestuali)
    chips.push(`Quanti coperti ho oggi?`);
    if (ctx.menu.unavailable_today.length > 0) {
      chips.push(`Riepilogo piatti non disponibili stasera`);
    }
    chips.push("Suggerisci un piatto del giorno");
    chips.push("Riassumi la settimana");
    if (ctx.bookings_tomorrow.count > 0) {
      chips.push(`Prepara la giornata di domani`);
    }

    return { alerts, chips: chips.slice(0, 6), context: ctx };
  });

const SYSTEM_PROMPT = `Sei l'assistente AI di Unobuono per i ristoratori. Hai ACCESSO IN TEMPO REALE ai dati del ristorante che ti vengono iniettati nel contesto qui sotto.

REGOLE CRITICHE:
1. Usa SOLO i dati nel CONTESTO. Non inventare numeri, nomi clienti, prenotazioni o piatti.
2. Se non hai un dato, dillo onestamente: "non ho questa info, vai su <pagina>".
3. Risposte BREVI, in italiano, con tono pratico. Mai più di 6 righe per chat normale.
4. Per AZIONI usa SOLO un JSON valido (nessun testo prima/dopo).

AZIONI DISPONIBILI:

1) menu_toggle — rendi piatto/i (non) disponibile/i SOLO per oggi (reversibile).
   {"action":"menu_toggle","filter":{"name_contains":"diavola"} | {"category":"Pizze"} | {"all":true},"available":false}

2) menu_remove — ELIMINA definitivamente piatti dal menu (irreversibile, conferma sempre).
   {"action":"menu_remove","item_name":"diavola"}

3) menu_update — modifica nome/prezzo/descrizione/categoria.
   {"action":"menu_update","filter":{"name_contains":"x"} | {"category":"Y"},"set":{"price":9,"price_multiplier":1.1,"name":"...","description":"...","category":"..."}}

4) menu_add — nuovo piatto.
   {"action":"menu_add","item":{"name":"...","price":12,"description":"...","category":"Pizze"}}

5) menu_rewrite_description — riscrivi una descrizione in modo evocativo.
   {"action":"menu_rewrite_description","item_name":"diavola"}

6) reply_review — bozza di risposta per una recensione (poi l'owner conferma).
   {"action":"reply_review","review_id":"<uuid>","reply":"testo della risposta"}

7) campaign_draft — crea bozza campagna SMS/WhatsApp (NON invia).
   {"action":"campaign_draft","name":"...","channel":"sms"|"whatsapp","message":"..."}

8) navigate — invita a aprire una pagina specifica.
   {"action":"navigate","to":"/owner/reservations"|"/owner/menu"|"/owner/reviews"|"/owner/social"|"/owner/crm"|"/owner/campaigns","reason":"..."}

REGOLA CONFERME: per menu_remove, menu_update con price_multiplier che cambia >5 piatti, e campaign_draft, l'owner vedrà un bottone "Conferma" prima dell'esecuzione. Tu emetti il JSON normalmente, il client gestisce la conferma.

REGOLA RECENSIONI: quando proponi una risposta a recensione negativa, sii empatico, prendi responsabilità, offri di rimediare. Mai aggressivo.

ESEMPI:
- "quanti coperti stasera?" → risposta testuale dai dati del contesto.
- "togli la diavola stasera" → {"action":"menu_toggle","filter":{"name_contains":"diavola"},"available":false}
- "rispondi alla recensione di Mario" → trova review_id nel contesto, emetti reply_review con bozza.
- "fammi vedere le prenotazioni di domani" → {"action":"navigate","to":"/owner/reservations","reason":"per vedere domani in dettaglio"}`;

/** Decide modello in base alla query: pro per analisi/strategia, flash per Q&A. */
function pickModel(userMessage: string): string {
  const q = userMessage.toLowerCase();
  const proTriggers = ["analizza", "strateg", "perché", "consigli", "come migliorare", "settimana", "mese", "trend", "scrivi", "riscrivi", "rispondi alla recension", "pian"];
  if (proTriggers.some((t) => q.includes(t))) return "google/gemini-2.5-pro";
  return "google/gemini-3-flash-preview";
}

export const askAssistant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { messages: { role: "user" | "assistant"; content: string }[] }) => input)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: restaurant } = await supabase.from("restaurants").select("id").maybeSingle();
    if (!restaurant) return { content: "", error: "no_restaurant" as const };

    const ctx = await buildContext(supabase, restaurant.id);
    const lastUser = [...data.messages].reverse().find((m) => m.role === "user")?.content || "";
    const model = pickModel(lastUser);

    const systemMessages = [
      { role: "system" as const, content: SYSTEM_PROMPT },
      { role: "system" as const, content: `CONTESTO LIVE (snapshot di ${new Date().toLocaleString("it-IT")}):\n${JSON.stringify(ctx, null, 2)}` },
    ];

    const r = await callAI({ data: { messages: [...systemMessages, ...data.messages], model } });
    return { content: r.content, error: r.error, model_used: model };
  });
