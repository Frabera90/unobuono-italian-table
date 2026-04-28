import { supabase } from "@/integrations/supabase/client";
import { callAI } from "@/server/ai";

/** Estrae JSON azione da risposta AI. Ritorna null se è chat normale. */
export function parseAction(raw: string): any | null {
  const trimmed = raw.trim();
  try {
    const m = trimmed.match(/\{[\s\S]*\}/);
    if (m) {
      const parsed = JSON.parse(m[0]);
      if (parsed?.action) return parsed;
    }
  } catch {}
  return null;
}

/** Azioni che richiedono conferma esplicita prima dell'esecuzione. */
export function needsConfirm(action: any): boolean {
  if (!action) return false;
  if (action.action === "menu_remove") return true;
  if (action.action === "campaign_draft") return true;
  if (action.action === "menu_update" && action.set?.price_multiplier) return true;
  if (action.action === "menu_toggle" && action.filter?.all) return true;
  return false;
}

/** Descrizione human-readable di cosa farà l'azione. */
export function describeAction(action: any): string {
  if (!action) return "";
  switch (action.action) {
    case "menu_toggle":
      return `Renderò ${action.available === false ? "NON disponibili" : "disponibili"} i piatti che corrispondono al filtro.`;
    case "menu_remove":
      return `⚠️ Eliminerò DEFINITIVAMENTE dal menu i piatti contenenti "${action.item_name}". Irreversibile.`;
    case "menu_update":
      if (action.set?.price_multiplier) return `Modificherò i prezzi dei piatti selezionati × ${action.set.price_multiplier}.`;
      return `Aggiornerò i piatti corrispondenti.`;
    case "menu_add":
      return `Aggiungerò "${action.item?.name}" al menu${action.item?.price ? ` a €${action.item.price}` : ""}.`;
    case "menu_rewrite_description":
      return `Riscriverò la descrizione di "${action.item_name}".`;
    case "reply_review":
      return `Salverò questa risposta alla recensione.`;
    case "campaign_draft":
      return `Creerò una bozza di campagna "${action.name}" (${action.channel?.toUpperCase()}).`;
    case "navigate":
      return `Aprirò la pagina ${action.to}.`;
    default:
      return "";
  }
}

/** Esegue l'azione lato client (RLS protegge). Ritorna messaggio di esito. */
export async function executeAction(action: any): Promise<{ ok: boolean; message: string; navigate?: string }> {
  const applyFilter = (q: any, filter: any) => {
    if (!filter || filter.all) return q;
    if (filter.name_contains) q = q.ilike("name", `%${filter.name_contains}%`);
    if (filter.category) q = q.ilike("category", `%${filter.category}%`);
    return q;
  };

  if (action.action === "menu_toggle") {
    let q = supabase.from("menu_items").select("*");
    q = applyFilter(q, action.filter);
    const { data: matches } = await q;
    if (!matches || matches.length === 0) return { ok: false, message: "Non ho trovato piatti corrispondenti." };
    const available = action.available !== false;
    await Promise.all(matches.map((it: any) =>
      supabase.from("menu_items").update({ available, updated_at: new Date().toISOString() }).eq("id", it.id)
    ));
    return { ok: true, message: `✓ ${matches.length} piatti ${available ? "ripristinati" : "resi non disponibili"}: ${matches.slice(0, 3).map((m: any) => m.name).join(", ")}${matches.length > 3 ? "..." : ""}` };
  }

  if (action.action === "menu_remove") {
    const name = action.item_name;
    if (!name) return { ok: false, message: "Specifica quale piatto eliminare." };
    const { data: matches } = await supabase.from("menu_items").select("*").ilike("name", `%${name}%`);
    if (!matches || matches.length === 0) return { ok: false, message: `Nessun piatto trovato con "${name}".` };
    const { error } = await supabase.from("menu_items").delete().ilike("name", `%${name}%`);
    if (error) return { ok: false, message: `Errore: ${error.message}` };
    return { ok: true, message: `🗑️ Eliminati ${matches.length} piatti: ${matches.map((m: any) => m.name).join(", ")}` };
  }

  if (action.action === "menu_update") {
    let q = supabase.from("menu_items").select("*");
    q = applyFilter(q, action.filter);
    const { data: matches } = await q;
    if (!matches || matches.length === 0) return { ok: false, message: "Non ho trovato piatti corrispondenti." };
    await Promise.all(matches.map(async (it: any) => {
      const upd: any = { updated_at: new Date().toISOString() };
      if (action.set?.available !== undefined) upd.available = action.set.available;
      if (action.set?.name) upd.name = action.set.name;
      if (action.set?.description) upd.description = action.set.description;
      if (action.set?.category) upd.category = action.set.category;
      if (action.set?.price !== undefined) upd.price = Number(action.set.price);
      if (action.set?.price_multiplier && it.price) upd.price = Math.round(Number(it.price) * action.set.price_multiplier * 100) / 100;
      return supabase.from("menu_items").update(upd).eq("id", it.id);
    }));
    return { ok: true, message: `✓ Aggiornati ${matches.length} piatti.` };
  }

  if (action.action === "menu_add") {
    const it = action.item || {};
    if (!it.name) return { ok: false, message: "Manca il nome del piatto." };
    const { error } = await supabase.from("menu_items").insert({
      name: it.name,
      price: it.price != null ? Number(it.price) : null,
      description: it.description || null,
      category: it.category || null,
      available: true,
      updated_at: new Date().toISOString(),
    });
    if (error) return { ok: false, message: `Errore: ${error.message}` };
    return { ok: true, message: `➕ Aggiunto: ${it.name}${it.price ? ` (€${Number(it.price).toFixed(2)})` : ""}` };
  }

  if (action.action === "menu_rewrite_description") {
    const name = action.item_name;
    if (!name) return { ok: false, message: "Specifica il piatto." };
    const { data: matches } = await supabase.from("menu_items").select("*").ilike("name", `%${name}%`).limit(1);
    if (!matches || matches.length === 0) return { ok: false, message: `Nessun piatto trovato.` };
    const item = matches[0];
    const r = await callAI({ data: { messages: [
      { role: "system", content: "Sei un copywriter di menu italiano. Scrivi descrizioni evocative, brevi (max 15 parole), sensoriali. Solo la descrizione, niente virgolette." },
      { role: "user", content: `Riscrivi la descrizione di "${item.name}". Attuale: "${item.description || "(nessuna)"}".` },
    ] } });
    if (r.error || !r.content) return { ok: false, message: "Errore generazione." };
    const newDesc = r.content.trim().replace(/^["']|["']$/g, "");
    await supabase.from("menu_items").update({ description: newDesc, updated_at: new Date().toISOString() }).eq("id", item.id);
    return { ok: true, message: `✍️ ${item.name}: "${newDesc}"` };
  }

  if (action.action === "reply_review") {
    if (!action.review_id || !action.reply) return { ok: false, message: "Manca review_id o testo risposta." };
    const { error } = await supabase.from("reviews").update({
      owner_response: action.reply,
      status: "replied",
    }).eq("id", action.review_id);
    if (error) return { ok: false, message: `Errore: ${error.message}` };
    return { ok: true, message: `💬 Risposta salvata.` };
  }

  if (action.action === "campaign_draft") {
    const { count: clientCount } = await supabase.from("clients").select("id", { count: "exact", head: true }).not("phone", "is", null);
    const { error } = await supabase.from("campaigns").insert({
      name: action.name || "Senza nome",
      channel: action.channel === "whatsapp" ? "whatsapp" : "sms",
      message: action.message,
      recipient_count: clientCount || 0,
      status: "draft",
    });
    if (error) return { ok: false, message: `Errore: ${error.message}` };
    return { ok: true, message: `📣 Bozza creata. Apri Campagne per inviare a ~${clientCount || 0} clienti.`, navigate: "/owner/campaigns" };
  }

  if (action.action === "navigate") {
    return { ok: true, message: action.reason || "Apro la pagina.", navigate: action.to };
  }

  return { ok: false, message: "Azione non riconosciuta." };
}
