import { useState } from "react";
import { planSocialCalendar } from "@/server/ai";
import { supabase } from "@/integrations/supabase/client";
import { getMyRestaurant, type RestaurantSettings } from "@/lib/restaurant";
import { toast } from "sonner";

type PlanItem = {
  date: string;
  time: string;
  theme: string;
  photo_idea: string;
  caption: string;
  hashtags: string;
  approved?: boolean;
};

export function PlanGenerator({
  settings,
  onAfterSave,
}: {
  settings: RestaurantSettings | null;
  onAfterSave: () => void;
}) {
  const [range, setRange] = useState<"week" | "month">("week");
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<PlanItem[]>([]);
  const [saving, setSaving] = useState(false);

  async function generate() {
    setLoading(true);
    setItems([]);
    try {
      const startDateISO = new Date().toISOString().slice(0, 10);
      const r = await planSocialCalendar({
        data: {
          range,
          restaurantName: settings?.name || "Il ristorante",
          bio: settings?.bio || "",
          tone: settings?.tone || "autentico e caldo",
          startDateISO,
        },
      });
      if (r.error === "rate_limit") { toast.error("Troppe richieste. Riprova tra poco."); return; }
      if (r.error === "credits") { toast.error("Crediti AI esauriti."); return; }
      if (r.error || !r.posts.length) { toast.error("Errore generazione piano."); return; }
      setItems((r.posts as PlanItem[]).map((p) => ({ ...p, approved: true })));
      toast.success(`${r.posts.length} idee generate ✨`);
    } finally {
      setLoading(false);
    }
  }

  function toggle(i: number) {
    setItems((arr) => arr.map((it, j) => (j === i ? { ...it, approved: !it.approved } : it)));
  }

  function update(i: number, field: keyof PlanItem, value: string) {
    setItems((arr) => arr.map((it, j) => (j === i ? { ...it, [field]: value } : it)));
  }

  async function saveAll() {
    const approved = items.filter((it) => it.approved);
    if (!approved.length) { toast.error("Nessun post approvato."); return; }
    setSaving(true);
    try {
      const r = await getMyRestaurant();
      if (!r) { toast.error("Ristorante non trovato."); return; }
      const rows = approved.map((it) => ({
        restaurant_id: r.id,
        caption: it.caption,
        hashtags: it.hashtags,
        platform: "instagram",
        image_url: null,
        status: "scheduled",
        scheduled_at: new Date(`${it.date}T${it.time}:00`).toISOString(),
      }));
      const { error } = await supabase.from("social_posts").insert(rows);
      if (error) { toast.error(error.message); return; }
      toast.success(`${approved.length} post programmati 📅`);
      setItems([]);
      onAfterSave();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border-2 border-ink bg-yellow p-4">
        <h3 className="font-display text-xl uppercase">📅 Piano editoriale AI</h3>
        <p className="mt-1 text-sm">L'AI genera idee per {range === "week" ? "una settimana" : "un mese"}: tema, orario, caption e hashtag. Tu approvi e carichi le foto dopo.</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="flex rounded-md border-2 border-ink overflow-hidden">
            <button
              onClick={() => setRange("week")}
              className={`px-3 py-1.5 text-xs font-bold uppercase ${range === "week" ? "bg-ink text-paper" : "bg-paper"}`}
            >
              Settimana
            </button>
            <button
              onClick={() => setRange("month")}
              className={`px-3 py-1.5 text-xs font-bold uppercase ${range === "month" ? "bg-ink text-paper" : "bg-paper"}`}
            >
              Mese
            </button>
          </div>
          <button
            onClick={generate}
            disabled={loading}
            className="rounded-md border-2 border-ink bg-ink px-4 py-1.5 text-xs font-bold uppercase text-paper disabled:opacity-40"
          >
            {loading ? "Generando..." : "✨ Genera piano"}
          </button>
        </div>
      </div>

      {items.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {items.filter((i) => i.approved).length}/{items.length} approvati
            </span>
            <button
              onClick={saveAll}
              disabled={saving}
              className="rounded-md border-2 border-ink bg-yellow px-4 py-2 text-sm font-bold uppercase shadow-brut hover:translate-y-[1px] hover:shadow-none disabled:opacity-40"
            >
              {saving ? "Salvataggio..." : `📤 Programma ${items.filter((i) => i.approved).length} post`}
            </button>
          </div>

          <ul className="space-y-2">
            {items.map((it, i) => (
              <li
                key={i}
                className={`rounded-xl border-2 p-3 transition ${it.approved ? "border-ink bg-paper" : "border-border bg-cream-dark/20 opacity-60"}`}
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={!!it.approved}
                      onChange={() => toggle(i)}
                      className="h-4 w-4 accent-ink"
                    />
                    <input
                      type="date"
                      value={it.date}
                      onChange={(e) => update(i, "date", e.target.value)}
                      className="rounded border border-border bg-background px-1.5 py-0.5 text-xs"
                    />
                    <input
                      type="time"
                      value={it.time}
                      onChange={(e) => update(i, "time", e.target.value)}
                      className="rounded border border-border bg-background px-1.5 py-0.5 text-xs"
                    />
                    <span className="rounded-full bg-yellow px-2 py-0.5 text-[10px] font-bold uppercase">{it.theme}</span>
                  </div>
                </div>
                <p className="mb-1 text-xs italic text-muted-foreground">📸 {it.photo_idea}</p>
                <textarea
                  value={it.caption}
                  onChange={(e) => update(i, "caption", e.target.value)}
                  rows={2}
                  className="w-full rounded border border-border bg-background p-1.5 text-sm"
                />
                <input
                  value={it.hashtags}
                  onChange={(e) => update(i, "hashtags", e.target.value)}
                  className="mt-1 w-full rounded border border-border bg-background px-1.5 py-1 text-xs text-terracotta"
                />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
