import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { MenuItem } from "@/lib/restaurant";
import { toast } from "sonner";

export const Route = createFileRoute("/owner/menu")({
  head: () => ({ meta: [{ title: "Menu — Unobuono" }] }),
  component: MenuPage,
});

const EMPTY: Partial<MenuItem> = { name: "", description: "", price: 0, category: "", available: true, allergens: "" };

function MenuPage() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [edit, setEdit] = useState<Partial<MenuItem> | null>(null);
  const [filter, setFilter] = useState("");

  async function load() {
    const { data } = await supabase.from("menu_items").select("*").order("category").order("sort_order");
    setItems((data || []) as MenuItem[]);
  }

  useEffect(() => {
    load();
    const ch = supabase.channel("o-menu").on("postgres_changes", { event: "*", schema: "public", table: "menu_items" }, load).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

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
    if (!edit?.name) { toast.error("Nome obbligatorio"); return; }
    const payload: any = { name: edit.name, description: edit.description, price: Number(edit.price) || null, category: edit.category, available: edit.available !== false, featured: !!edit.featured, allergens: edit.allergens, updated_at: new Date().toISOString() };
    if (edit.id) {
      const { error } = await supabase.from("menu_items").update(payload).eq("id", edit.id);
      if (error) return toast.error(error.message);
      toast.success("Aggiornato");
    } else {
      const { error } = await supabase.from("menu_items").insert(payload);
      if (error) return toast.error(error.message);
      toast.success("Aggiunto");
    }
    setEdit(null);
  }
  async function remove(id: string) {
    if (!confirm("Eliminare il piatto?")) return;
    await supabase.from("menu_items").delete().eq("id", id);
    setEdit(null);
  }

  return (
    <div className="mx-auto max-w-5xl px-5 py-7">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl">Menu</h1>
          <p className="text-sm text-muted-foreground">{items.length} piatti · {items.filter((i) => !i.available).length} non disponibili</p>
        </div>
        <div className="flex gap-2">
          <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Cerca..." className="rounded-lg border border-border bg-card px-3 py-2 text-sm" />
          <button onClick={() => setEdit({ ...EMPTY })} className="rounded-lg bg-terracotta px-4 py-2 text-sm font-medium text-paper">+ Aggiungi</button>
        </div>
      </header>

      <div className="space-y-6">
        {grouped.map(([cat, list]) => (
          <section key={cat}>
            <h2 className="mb-2 font-display text-lg italic text-terracotta">{cat}</h2>
            <ul className="divide-y divide-border rounded-xl border border-border bg-card">
              {list.map((it) => (
                <li key={it.id} className="flex items-center gap-3 p-3">
                  <button onClick={() => setEdit(it)} className="min-w-0 flex-1 text-left">
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
              <Field label="Categoria"><input value={edit.category || ""} onChange={(e) => setEdit({ ...edit, category: e.target.value })} className="ed-input" placeholder="Pizze, Antipasti..." /></Field>
              <Field label="Descrizione"><textarea value={edit.description || ""} onChange={(e) => setEdit({ ...edit, description: e.target.value })} className="ed-input" rows={2} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Prezzo €"><input type="number" step="0.5" value={edit.price ?? ""} onChange={(e) => setEdit({ ...edit, price: Number(e.target.value) })} className="ed-input" /></Field>
                <Field label="Allergeni"><input value={edit.allergens || ""} onChange={(e) => setEdit({ ...edit, allergens: e.target.value })} className="ed-input" placeholder="glutine, latte" /></Field>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={edit.available !== false} onChange={(e) => setEdit({ ...edit, available: e.target.checked })} />
                Disponibile
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
