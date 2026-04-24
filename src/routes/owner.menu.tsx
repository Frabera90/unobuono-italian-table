import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getMyRestaurant, type MenuItem, type Restaurant } from "@/lib/restaurant";
import { extractMenuFromImage } from "@/server/ai";
import { toast } from "sonner";

export const Route = createFileRoute("/owner/menu")({
  head: () => ({ meta: [{ title: "Menu — Unobuono" }] }),
  component: MenuPage,
});

const DEFAULT_CATEGORIES = ["Antipasti", "Primi", "Secondi", "Pizze", "Contorni", "Dolci", "Bevande", "Vini"];
const EMPTY: Partial<MenuItem> = { name: "", description: "", price: 0, category: "", available: true, allergens: "" };

function MenuPage() {
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [edit, setEdit] = useState<Partial<MenuItem> | null>(null);
  const [filter, setFilter] = useState("");
  const [importing, setImporting] = useState(false);
  const [newCatMode, setNewCatMode] = useState(false);
  const [newCatValue, setNewCatValue] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function load(rid?: string) {
    const target = rid ?? restaurant?.id;
    if (!target) return;
    const { data } = await supabase.from("menu_items").select("*").eq("restaurant_id", target).order("category").order("sort_order");
    setItems((data || []) as MenuItem[]);
  }

  useEffect(() => {
    (async () => {
      const r = await getMyRestaurant();
      if (!r) return;
      setRestaurant(r);
      await load(r.id);
    })();
  }, []);

  useEffect(() => {
    if (!restaurant) return;
    const ch = supabase.channel("o-menu").on("postgres_changes",
      { event: "*", schema: "public", table: "menu_items", filter: `restaurant_id=eq.${restaurant.id}` },
      () => load(restaurant.id)).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [restaurant]);

  // Category list = defaults + any used in items, deduped
  const categories = useMemo(() => {
    const set = new Set<string>(DEFAULT_CATEGORIES);
    for (const it of items) if (it.category) set.add(it.category);
    return Array.from(set);
  }, [items]);

  const grouped = useMemo(() => {
    const f = filter.toLowerCase();
    const filtered = f ? items.filter((i) => i.name.toLowerCase().includes(f) || i.category?.toLowerCase().includes(f)) : items;
    const map = new Map<string, MenuItem[]>();
    for (const it of filtered) {
      const k = it.category || "Altro";
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(it);
    }
    return Array.from(map.entries());
  }, [items, filter]);

  async function toggle(it: MenuItem) {
    await supabase.from("menu_items").update({ available: !it.available, updated_at: new Date().toISOString() }).eq("id", it.id);
  }
  async function toggleFeatured(it: MenuItem) {
    await supabase.from("menu_items").update({ featured: !it.featured, updated_at: new Date().toISOString() }).eq("id", it.id);
  }
  async function save() {
    if (!restaurant) { toast.error("Ristorante non trovato"); return; }
    if (!edit?.name) { toast.error("Nome obbligatorio"); return; }
    const finalCategory = newCatMode ? newCatValue.trim() : (edit.category || "");
    const payload: any = {
      name: edit.name,
      description: edit.description,
      price: edit.price != null && edit.price !== ("" as any) ? Number(edit.price) : null,
      category: finalCategory || null,
      available: edit.available !== false,
      featured: !!edit.featured,
      allergens: edit.allergens,
      updated_at: new Date().toISOString(),
    };
    if (edit.id) {
      const { error } = await supabase.from("menu_items").update(payload).eq("id", edit.id);
      if (error) return toast.error(error.message);
      toast.success("Aggiornato");
    } else {
      const { error } = await supabase.from("menu_items").insert({ ...payload, restaurant_id: restaurant.id });
      if (error) return toast.error(error.message);
      toast.success("Aggiunto");
    }
    setEdit(null);
    setNewCatMode(false);
    setNewCatValue("");
  }
  async function remove(id: string) {
    if (!confirm("Eliminare il piatto?")) return;
    await supabase.from("menu_items").delete().eq("id", id);
    setEdit(null);
  }

  function openNew() {
    setEdit({ ...EMPTY });
    setNewCatMode(false);
    setNewCatValue("");
  }

  function openEdit(it: MenuItem) {
    setEdit(it);
    setNewCatMode(false);
    setNewCatValue("");
  }

  async function handlePhotoImport(file: File) {
    if (!restaurant) return;
    if (file.size > 8 * 1024 * 1024) { toast.error("Immagine troppo grande (max 8MB)"); return; }
    setImporting(true);
    try {
      const base64 = await fileToBase64(file);
      const res = await extractMenuFromImage({ data: { imageBase64: base64, mimeType: file.type || "image/jpeg" } });
      if (res.error === "rate_limit") { toast.error("Troppe richieste, riprova tra poco"); return; }
      if (res.error === "credits") { toast.error("Crediti AI esauriti"); return; }
      if (res.error || !Array.isArray(res.items) || res.items.length === 0) { toast.error("Nessun piatto rilevato. Riprova con una foto più nitida."); return; }
      const baseSort = items.length;
      const records = res.items.map((it: any, idx: number) => ({
        restaurant_id: restaurant.id,
        name: String(it.name || "").slice(0, 200),
        description: it.description ? String(it.description).slice(0, 500) : null,
        price: it.price != null && !Number.isNaN(Number(it.price)) ? Number(it.price) : null,
        category: it.category ? String(it.category).slice(0, 80) : null,
        available: true,
        sort_order: baseSort + idx,
        updated_at: new Date().toISOString(),
      })).filter((r) => r.name);
      if (records.length === 0) { toast.error("Nessun piatto valido"); return; }
      const { error } = await supabase.from("menu_items").insert(records);
      if (error) { toast.error(error.message); return; }
      toast.success(`Importati ${records.length} piatti dal menu 🎉`);
    } catch (e: any) {
      toast.error(e?.message || "Errore importazione");
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-5 py-7">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl">Menu</h1>
          <p className="text-sm text-muted-foreground">{items.length} piatti · {items.filter((i) => !i.available).length} non disponibili</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Cerca..." className="rounded-lg border border-border bg-card px-3 py-2 text-sm" />
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePhotoImport(f); }} />
          <button onClick={() => fileRef.current?.click()} disabled={importing} className="rounded-lg border-2 border-ink bg-yellow px-4 py-2 text-sm font-bold text-ink disabled:opacity-50">
            {importing ? "Leggo il menu..." : "📷 Importa da foto"}
          </button>
          <button onClick={openNew} className="rounded-lg bg-terracotta px-4 py-2 text-sm font-medium text-paper">+ Aggiungi</button>
        </div>
      </header>

      {items.length === 0 && !importing && (
        <div className="mb-5 rounded-xl border-2 border-dashed border-terracotta/40 bg-terracotta/5 p-5 text-center">
          <p className="font-display text-lg text-ink">Nessun piatto ancora</p>
          <p className="mt-1 text-sm text-muted-foreground">Scatta una foto del tuo menu cartaceo: l'AI lo trascrive automaticamente in pochi secondi.</p>
          <button onClick={() => fileRef.current?.click()} className="mt-3 rounded-lg border-2 border-ink bg-yellow px-5 py-2 text-sm font-bold text-ink">📷 Importa il menu da foto</button>
        </div>
      )}

      <div className="space-y-6">
        {grouped.map(([cat, list]) => (
          <section key={cat}>
            <h2 className="mb-2 font-display text-lg italic text-terracotta">{cat}</h2>
            <ul className="divide-y divide-border rounded-xl border border-border bg-card">
              {list.map((it) => (
                <li key={it.id} className="flex items-center gap-3 p-3">
                  <button onClick={() => openEdit(it)} className="min-w-0 flex-1 text-left">
                    <div className={`text-sm font-medium ${!it.available ? "text-muted-foreground line-through" : ""}`}>
                      {it.featured && <span className="mr-1 text-amber-500">⭐</span>}
                      {it.name}
                    </div>
                    {it.description && <div className="truncate text-xs text-muted-foreground">{it.description}</div>}
                  </button>
                  <div className="text-sm text-terracotta">{it.price != null ? `€ ${Number(it.price).toFixed(2)}` : "—"}</div>
                  <button onClick={() => toggleFeatured(it)} title="In evidenza" className={`text-base transition ${it.featured ? "text-amber-500" : "text-muted-foreground/40 hover:text-amber-500"}`}>★</button>
                  <button onClick={() => toggle(it)} className={`relative h-5 w-9 rounded-full transition ${it.available ? "bg-terracotta" : "bg-border"}`}>
                    <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-paper transition ${it.available ? "left-[18px]" : "left-0.5"}`} />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      {edit && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-ink/40 p-4" onClick={() => setEdit(null)}>
          <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-4 font-display text-2xl">{edit.id ? "Modifica" : "Nuovo piatto"}</h3>
            <div className="space-y-3">
              <Field label="Nome"><input value={edit.name || ""} onChange={(e) => setEdit({ ...edit, name: e.target.value })} className="ed-input" /></Field>

              <Field label="Categoria">
                {newCatMode ? (
                  <div className="flex gap-2">
                    <input autoFocus value={newCatValue} onChange={(e) => setNewCatValue(e.target.value)} className="ed-input" placeholder="Nome nuova categoria" />
                    <button type="button" onClick={() => { setNewCatMode(false); setNewCatValue(""); }} className="rounded-md border border-border px-3 text-xs">Annulla</button>
                  </div>
                ) : (
                  <select
                    value={edit.category || ""}
                    onChange={(e) => {
                      if (e.target.value === "__new__") { setNewCatMode(true); setNewCatValue(""); }
                      else setEdit({ ...edit, category: e.target.value });
                    }}
                    className="ed-input"
                  >
                    <option value="">— Seleziona categoria —</option>
                    {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                    <option value="__new__">+ Crea nuova categoria...</option>
                  </select>
                )}
              </Field>

              <Field label="Descrizione"><textarea value={edit.description || ""} onChange={(e) => setEdit({ ...edit, description: e.target.value })} className="ed-input" rows={2} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Prezzo €"><input type="number" step="0.5" value={edit.price ?? ""} onChange={(e) => setEdit({ ...edit, price: e.target.value === "" ? (null as any) : Number(e.target.value) })} className="ed-input" /></Field>
                <Field label="Allergeni"><input value={edit.allergens || ""} onChange={(e) => setEdit({ ...edit, allergens: e.target.value })} className="ed-input" placeholder="glutine, latte" /></Field>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={edit.available !== false} onChange={(e) => setEdit({ ...edit, available: e.target.checked })} />
                Disponibile
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={!!edit.featured} onChange={(e) => setEdit({ ...edit, featured: e.target.checked })} />
                ⭐ In evidenza (mostrato nella pagina di prenotazione)
              </label>
            </div>
            <div className="mt-5 flex items-center justify-between gap-2">
              {edit.id ? <button onClick={() => remove(edit.id!)} className="text-sm text-destructive">Elimina</button> : <span />}
              <div className="flex gap-2">
                <button onClick={() => setEdit(null)} className="rounded-md border border-border px-4 py-2 text-sm">Annulla</button>
                <button onClick={save} className="rounded-md bg-terracotta px-4 py-2 text-sm font-medium text-paper">Salva</button>
              </div>
            </div>
          </div>
        </div>
      )}
      <style>{`.ed-input{width:100%;border:1px solid hsl(var(--border));background:hsl(var(--background));border-radius:8px;padding:8px 10px;font-size:14px;color:inherit}`}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1 block text-xs uppercase tracking-wider text-muted-foreground">{label}</span>{children}</label>;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = String(r.result || "");
      const i = s.indexOf(",");
      resolve(i >= 0 ? s.slice(i + 1) : s);
    };
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}
