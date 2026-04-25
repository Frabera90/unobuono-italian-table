import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getMyRestaurant, type MenuItem, type Restaurant } from "@/lib/restaurant";
import { extractMenuFromImage } from "@/server/ai";
import { toast } from "sonner";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2 } from "lucide-react";
import { ALLERGENS, DIETS, type AllergenKey, type DietKey } from "@/lib/allergens";

export const Route = createFileRoute("/owner/menu")({
  head: () => ({ meta: [{ title: "Menu — Unobuono" }] }),
  component: MenuPage,
});

// Ordine canonico classico italiano
const CATEGORY_ORDER = [
  "Antipasti",
  "Primi",
  "Secondi",
  "Pizze",
  "Contorni",
  "Insalate",
  "Dolci",
  "Caffetteria",
  "Bevande",
  "Birre",
  "Bollicine",
  "Vini Bianchi",
  "Vini Rossi",
  "Vini Rosati",
  "Vini",
  "Distillati",
  "Liquori",
  "Altro",
];
const DEFAULT_CATEGORIES = ["Antipasti", "Primi", "Secondi", "Pizze", "Contorni", "Dolci", "Bevande", "Vini"];
const EMPTY: Partial<MenuItem> = { name: "", description: "", price: 0, category: "", available: true, allergens: "", allergen_tags: [], diet_tags: [] };

// Indice della categoria nell'ordine canonico (case-insensitive, fuzzy)
function categoryRank(cat: string | null | undefined): number {
  if (!cat) return CATEGORY_ORDER.indexOf("Altro");
  const norm = cat.trim().toLowerCase();
  for (let i = 0; i < CATEGORY_ORDER.length; i++) {
    const ref = CATEGORY_ORDER[i].toLowerCase();
    if (norm === ref || norm.includes(ref) || ref.includes(norm)) return i;
  }
  return CATEGORY_ORDER.indexOf("Altro");
}

function MenuPage() {
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [edit, setEdit] = useState<Partial<MenuItem> | null>(null);
  const [filter, setFilter] = useState("");
  const [importing, setImporting] = useState(false);
  const [newCatMode, setNewCatMode] = useState(false);
  const [newCatValue, setNewCatValue] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  async function load(rid?: string) {
    const target = rid ?? restaurant?.id;
    if (!target) return;
    const { data } = await supabase.from("menu_items").select("*").eq("restaurant_id", target).order("sort_order").order("name");
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

  const categories = useMemo(() => {
    const set = new Set<string>(DEFAULT_CATEGORIES);
    for (const it of items) if (it.category) set.add(it.category);
    return Array.from(set).sort((a, b) => categoryRank(a) - categoryRank(b));
  }, [items]);

  // Raggruppa + ordina per categoria canonica + ordina items per sort_order
  const grouped = useMemo(() => {
    const f = filter.toLowerCase();
    const filtered = f ? items.filter((i) => i.name.toLowerCase().includes(f) || i.category?.toLowerCase().includes(f)) : items;
    const map = new Map<string, MenuItem[]>();
    for (const it of filtered) {
      const k = it.category || "Altro";
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(it);
    }
    // Ordina items dentro la categoria per sort_order, poi nome
    for (const [, arr] of map) {
      arr.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name));
    }
    // Ordina categorie
    return Array.from(map.entries()).sort(([a], [b]) => categoryRank(a) - categoryRank(b));
  }, [items, filter]);

  async function toggle(it: MenuItem) {
    await supabase.from("menu_items").update({ available: !it.available, updated_at: new Date().toISOString() }).eq("id", it.id);
  }
  async function toggleFeatured(it: MenuItem) {
    await supabase.from("menu_items").update({ featured: !it.featured, updated_at: new Date().toISOString() }).eq("id", it.id);
  }
  async function quickDelete(it: MenuItem) {
    if (!confirm(`Eliminare "${it.name}" dal menu?`)) return;
    const { error } = await supabase.from("menu_items").delete().eq("id", it.id);
    if (error) toast.error(error.message);
    else toast.success("Piatto eliminato");
  }

  // Drag end: riordina solo dentro la stessa categoria
  async function handleDragEnd(category: string, e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const inCat = items
      .filter((i) => (i.category || "Altro") === category)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name));
    const oldIdx = inCat.findIndex((i) => i.id === active.id);
    const newIdx = inCat.findIndex((i) => i.id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    const reordered = arrayMove(inCat, oldIdx, newIdx);
    // Optimistic update
    setItems((prev) => {
      const others = prev.filter((p) => (p.category || "Altro") !== category);
      const updated = reordered.map((it, idx) => ({ ...it, sort_order: idx }));
      return [...others, ...updated];
    });
    // Persist
    await Promise.all(
      reordered.map((it, idx) =>
        supabase.from("menu_items").update({ sort_order: idx, updated_at: new Date().toISOString() }).eq("id", it.id)
      )
    );
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
      allergen_tags: edit.allergen_tags || [],
      diet_tags: edit.diet_tags || [],
      updated_at: new Date().toISOString(),
    };
    if (edit.id) {
      const { error } = await supabase.from("menu_items").update(payload).eq("id", edit.id);
      if (error) return toast.error(error.message);
      toast.success("Aggiornato");
    } else {
      const sameCat = items.filter((i) => (i.category || "") === finalCategory);
      const maxSort = sameCat.reduce((m, i) => Math.max(m, i.sort_order ?? 0), -1);
      const { error } = await supabase.from("menu_items").insert({ ...payload, restaurant_id: restaurant.id, sort_order: maxSort + 1 });
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
      // Per ogni nuovo piatto, sort_order = max della sua categoria nel db corrente + indice
      const maxByCat = new Map<string, number>();
      for (const it of items) {
        const k = it.category || "";
        maxByCat.set(k, Math.max(maxByCat.get(k) ?? -1, it.sort_order ?? 0));
      }
      const records = res.items.map((it: any) => {
        const cat = it.category ? String(it.category).slice(0, 80) : null;
        const k = cat || "";
        const next = (maxByCat.get(k) ?? -1) + 1;
        maxByCat.set(k, next);
        const validAllergens = new Set(ALLERGENS.map((a) => a.key));
        const validDiets = new Set(DIETS.map((d) => d.key));
        return {
          restaurant_id: restaurant.id,
          name: String(it.name || "").slice(0, 200),
          description: it.description ? String(it.description).slice(0, 500) : null,
          price: it.price != null && !Number.isNaN(Number(it.price)) ? Number(it.price) : null,
          category: cat,
          available: true,
          allergen_tags: Array.isArray(it.allergen_tags) ? it.allergen_tags.filter((x: any) => validAllergens.has(x)) : [],
          diet_tags: Array.isArray(it.diet_tags) ? it.diet_tags.filter((x: any) => validDiets.has(x)) : [],
          sort_order: next,
          updated_at: new Date().toISOString(),
        };
      }).filter((r) => r.name);
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
    <div className="mx-auto max-w-5xl px-4 py-5 md:px-5 md:py-7">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl md:text-3xl">Menu</h1>
          <p className="text-xs text-muted-foreground md:text-sm">{items.length} piatti · {items.filter((i) => !i.available).length} non disponibili · Trascina per riordinare</p>
        </div>
        <div className="flex w-full flex-wrap gap-2 md:w-auto">
          <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Cerca..." className="min-w-0 flex-1 rounded-lg border border-border bg-card px-3 py-2 text-sm md:flex-none md:w-40" />
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePhotoImport(f); }} />
          <button onClick={() => fileRef.current?.click()} disabled={importing} className="rounded-lg border-2 border-ink bg-yellow px-3 py-2 text-xs font-bold text-ink disabled:opacity-50 md:px-4 md:text-sm">
            {importing ? "Leggo..." : "📷 Importa foto"}
          </button>
          <button onClick={openNew} className="rounded-lg bg-terracotta px-3 py-2 text-xs font-medium text-paper md:px-4 md:text-sm">+ Aggiungi</button>
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
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => handleDragEnd(cat, e)}>
              <SortableContext items={list.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                <ul className="divide-y divide-border rounded-xl border border-border bg-card">
                  {list.map((it) => (
                    <SortableRow
                      key={it.id}
                      item={it}
                      onEdit={() => openEdit(it)}
                      onToggle={() => toggle(it)}
                      onToggleFeatured={() => toggleFeatured(it)}
                      onDelete={() => quickDelete(it)}
                    />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
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
                <Field label="Note allergeni (testo libero)"><input value={edit.allergens || ""} onChange={(e) => setEdit({ ...edit, allergens: e.target.value })} className="ed-input" placeholder="es. tracce di..." /></Field>
              </div>

              <Field label="Allergeni (UE)">
                <div className="flex flex-wrap gap-1.5">
                  {ALLERGENS.map((a) => {
                    const active = (edit.allergen_tags || []).includes(a.key);
                    return (
                      <button
                        key={a.key}
                        type="button"
                        onClick={() => {
                          const cur = new Set(edit.allergen_tags || []);
                          if (active) cur.delete(a.key); else cur.add(a.key);
                          setEdit({ ...edit, allergen_tags: Array.from(cur) as AllergenKey[] });
                        }}
                        className={`rounded-full border px-2 py-1 text-xs transition ${active ? "border-terracotta bg-terracotta/10 text-terracotta" : "border-border text-muted-foreground hover:bg-cream"}`}
                      >
                        {a.emoji} {a.label}
                      </button>
                    );
                  })}
                </div>
              </Field>

              <Field label="Diete / opzioni">
                <div className="flex flex-wrap gap-1.5">
                  {DIETS.map((d) => {
                    const active = (edit.diet_tags || []).includes(d.key);
                    return (
                      <button
                        key={d.key}
                        type="button"
                        onClick={() => {
                          const cur = new Set(edit.diet_tags || []);
                          if (active) cur.delete(d.key); else cur.add(d.key);
                          setEdit({ ...edit, diet_tags: Array.from(cur) as DietKey[] });
                        }}
                        className={`rounded-full border px-2 py-1 text-xs transition ${active ? "border-emerald-600 bg-emerald-600/10 text-emerald-700" : "border-border text-muted-foreground hover:bg-cream"}`}
                      >
                        {d.emoji} {d.label}
                      </button>
                    );
                  })}
                </div>
              </Field>
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

function SortableRow({
  item: it,
  onEdit,
  onToggle,
  onToggleFeatured,
  onDelete,
}: {
  item: MenuItem;
  onEdit: () => void;
  onToggle: () => void;
  onToggleFeatured: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: it.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <li ref={setNodeRef} style={style} className="flex items-center gap-2 p-2.5 md:gap-3 md:p-3">
      <button
        {...attributes}
        {...listeners}
        className="touch-none cursor-grab text-muted-foreground/50 hover:text-foreground active:cursor-grabbing"
        aria-label="Trascina per riordinare"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <button onClick={onEdit} className="min-w-0 flex-1 text-left">
        <div className={`text-sm font-medium ${!it.available ? "text-muted-foreground line-through" : ""}`}>
          {it.featured && <span className="mr-1 text-amber-500">⭐</span>}
          {it.name}
        </div>
        {it.description && <div className="truncate text-xs text-muted-foreground">{it.description}</div>}
      </button>
      <div className="shrink-0 text-sm text-terracotta">{it.price != null ? `€ ${Number(it.price).toFixed(2)}` : "—"}</div>
      <button onClick={onToggleFeatured} title="In evidenza" className={`shrink-0 text-base transition ${it.featured ? "text-amber-500" : "text-muted-foreground/40 hover:text-amber-500"}`}>★</button>
      <button onClick={onToggle} className={`relative h-5 w-9 shrink-0 rounded-full transition ${it.available ? "bg-terracotta" : "bg-border"}`} title={it.available ? "Disponibile" : "Non disponibile"}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-paper transition ${it.available ? "left-[18px]" : "left-0.5"}`} />
      </button>
      <button
        onClick={onDelete}
        className="shrink-0 rounded-md p-1.5 text-muted-foreground/60 transition hover:bg-destructive/10 hover:text-destructive"
        title="Elimina definitivamente"
        aria-label="Elimina"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </li>
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
