import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type StylePreset = {
  id: string;
  name: string;
  style_key: string;
  extra_instructions: string | null;
  is_default: boolean;
};

// STILE VISIVO — uno solo (luce, colori, sfondo, mood)
const STYLE_OPTIONS = [
  { k: "auto", label: "Auto", emoji: "🪄", hint: "Migliora luce e colori" },
  { k: "bright", label: "Luminoso", emoji: "☀️", hint: "Luce naturale calda" },
  { k: "moody", label: "Caldo / moody", emoji: "🕯️", hint: "Lume di candela" },
  { k: "clean", label: "Pulito", emoji: "⚪", hint: "Sfondo bianco studio" },
  { k: "minimal", label: "Minimal", emoji: "🤍", hint: "Editoriale scandinavo" },
  { k: "elegant", label: "Elegante", emoji: "🥂", hint: "Fine dining scuro" },
  { k: "bistrot", label: "Bistrot", emoji: "🍷", hint: "Trattoria italiana" },
  { k: "rustic", label: "Rustico", emoji: "🌾", hint: "Farm-to-table" },
  { k: "vintage", label: "Vintage", emoji: "📻", hint: "Anni 70 film" },
  { k: "noir", label: "Noir", emoji: "🌑", hint: "Sfondo nero cinematico" },
  { k: "pop", label: "Pop", emoji: "🎨", hint: "Colorato vivace" },
  { k: "overhead", label: "Dall'alto", emoji: "🔝", hint: "Flat lay 90°" },
  { k: "pro_magazine", label: "Pro magazine", emoji: "📸", hint: "Food magazine" },
] as const;

// CONTESTO / ADDONS — multi-select (oggetti, persone attorno al piatto)
export const ADDON_OPTIONS = [
  { k: "hands", label: "Mani sul piatto", emoji: "🖐️" },
  { k: "context", label: "Contesto tavola", emoji: "🍽️" },
  { k: "eating", label: "Qualcuno che mangia", emoji: "😋" },
  { k: "props", label: "Styling props", emoji: "🌿" },
  { k: "steam", label: "Vapore", emoji: "♨️" },
  { k: "drink", label: "Bicchiere sfondo", emoji: "🍷" },
] as const;

export type AddonKey = (typeof ADDON_OPTIONS)[number]["k"];

export function StyleWizard({
  restaurantId,
  initialStyle,
  initialAddons,
  onApply,
  onClose,
}: {
  restaurantId: string;
  initialStyle?: string;
  initialAddons?: string[];
  onApply: (style: string, addons: string[], extra: string) => void;
  onClose: () => void;
}) {
  const [presets, setPresets] = useState<StylePreset[]>([]);
  const [tab, setTab] = useState<"presets" | "new">("presets");
  const [selectedStyle, setSelectedStyle] = useState<string>(initialStyle || "bistrot");
  const [selectedAddons, setSelectedAddons] = useState<string[]>(initialAddons || []);
  const [extra, setExtra] = useState("");
  const [name, setName] = useState("");
  const [setDefault, setSetDefault] = useState(false);
  const [saving, setSaving] = useState(false);

  async function load() {
    const { data } = await supabase
      .from("social_style_presets")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false });
    const list = (data || []) as StylePreset[];
    setPresets(list);
    if (list.length === 0) setTab("new");
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId]);

  function toggleAddon(k: string) {
    setSelectedAddons((arr) => (arr.includes(k) ? arr.filter((x) => x !== k) : [...arr, k]));
  }

  async function savePreset() {
    if (!name.trim()) { toast.error("Dai un nome al preset"); return; }
    setSaving(true);
    try {
      if (setDefault) {
        await supabase.from("social_style_presets")
          .update({ is_default: false })
          .eq("restaurant_id", restaurantId)
          .eq("is_default", true);
      }
      const { error } = await supabase.from("social_style_presets").insert({
        restaurant_id: restaurantId,
        name: name.trim(),
        style_key: selectedStyle,
        extra_instructions: extra.trim() || null,
        is_default: setDefault,
      });
      if (error) { toast.error(error.message); return; }
      toast.success("Preset salvato ✨");
      setName("");
      setSetDefault(false);
      await load();
      setTab("presets");
    } finally {
      setSaving(false);
    }
  }

  async function deletePreset(id: string) {
    const { error } = await supabase.from("social_style_presets").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    await load();
  }

  function applyPreset(p: StylePreset) {
    onApply(p.style_key, selectedAddons, p.extra_instructions || "");
    onClose();
  }

  function applyNow() {
    onApply(selectedStyle, selectedAddons, extra.trim());
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 sm:items-center" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-t-3xl border-t-2 border-ink bg-paper p-5 shadow-2xl sm:rounded-2xl sm:border-2" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-xl uppercase">🎨 Stile foto</h3>
          <button onClick={onClose} className="text-2xl text-muted-foreground">×</button>
        </div>

        <div className="mb-4 flex gap-2 border-b-2 border-ink/10">
          <button
            onClick={() => setTab("presets")}
            className={`px-3 py-1.5 text-xs font-bold uppercase ${tab === "presets" ? "border-b-2 border-ink" : "text-muted-foreground"}`}
          >
            I miei preset ({presets.length})
          </button>
          <button
            onClick={() => setTab("new")}
            className={`px-3 py-1.5 text-xs font-bold uppercase ${tab === "new" ? "border-b-2 border-ink" : "text-muted-foreground"}`}
          >
            ➕ Crea / scegli
          </button>
        </div>

        {tab === "presets" && (
          <>
            {presets.length === 0 ? (
              <p className="rounded-lg bg-yellow/30 p-4 text-sm">
                Nessun preset salvato. Crea il tuo "stile del locale" così tutte le foto saranno coerenti.
              </p>
            ) : (
              <ul className="space-y-2">
                {presets.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2 rounded-xl border-2 border-ink bg-paper p-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold">{p.name}</span>
                        {p.is_default && <span className="rounded-full bg-yellow px-2 py-0.5 text-[10px] font-bold uppercase">Default</span>}
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {STYLE_OPTIONS.find((s) => s.k === p.style_key)?.label || p.style_key}
                        {p.extra_instructions ? ` · ${p.extra_instructions}` : ""}
                      </p>
                    </div>
                    <button onClick={() => applyPreset(p)} className="rounded-md border-2 border-ink bg-yellow px-3 py-1.5 text-xs font-bold uppercase">
                      Applica
                    </button>
                    <button onClick={() => deletePreset(p.id)} className="text-lg text-muted-foreground hover:text-destructive" title="Elimina">×</button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {tab === "new" && (
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                1️⃣ Stile visivo (uno) — luce, colori, sfondo
              </label>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                {STYLE_OPTIONS.map((s) => (
                  <button
                    key={s.k}
                    onClick={() => setSelectedStyle(s.k)}
                    title={s.hint}
                    className={`rounded-lg border-2 px-2 py-2 text-left text-xs transition ${selectedStyle === s.k ? "border-ink bg-yellow" : "border-ink/20 bg-paper hover:border-ink/60"}`}
                  >
                    <div className="font-bold">{s.emoji} {s.label}</div>
                    <div className="mt-0.5 text-[10px] text-muted-foreground">{s.hint}</div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                2️⃣ Contesto (anche più di uno) — cosa metto attorno
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {ADDON_OPTIONS.map((a) => {
                  const on = selectedAddons.includes(a.k);
                  return (
                    <button
                      key={a.k}
                      onClick={() => toggleAddon(a.k)}
                      className={`rounded-lg border-2 px-2 py-2 text-xs transition ${on ? "border-ink bg-yellow" : "border-ink/20 bg-paper hover:border-ink/60"}`}
                    >
                      {on ? "✓ " : ""}{a.emoji} {a.label}
                    </button>
                  );
                })}
              </div>
              {selectedAddons.length === 0 && (
                <p className="mt-1 text-[10px] text-muted-foreground">Nessuno = solo il piatto, niente extra attorno.</p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                3️⃣ Note extra (opzionale, max 280 char)
              </label>
              <textarea
                value={extra}
                onChange={(e) => setExtra(e.target.value.slice(0, 280))}
                placeholder='es. "tovaglietta a quadri rossa", "luce dalla destra"'
                rows={2}
                className="w-full rounded-lg border-2 border-ink/30 bg-background p-2 text-sm"
              />
              <p className="mt-1 text-right text-[10px] text-muted-foreground">{extra.length}/280</p>
            </div>

            <div className="rounded-lg border-2 border-dashed border-ink/30 p-3">
              <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                💾 Salva come preset (riusa sempre)
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder='es. "Stile Unobuono"'
                  className="min-w-0 flex-1 rounded-md border border-ink/30 bg-background px-2 py-1.5 text-sm"
                />
                <label className="flex items-center gap-1 text-xs">
                  <input type="checkbox" checked={setDefault} onChange={(e) => setSetDefault(e.target.checked)} className="accent-ink" />
                  Predefinito
                </label>
                <button
                  onClick={savePreset}
                  disabled={saving || !name.trim()}
                  className="rounded-md border-2 border-ink bg-paper px-3 py-1.5 text-xs font-bold uppercase disabled:opacity-40"
                >
                  {saving ? "..." : "Salva"}
                </button>
              </div>
            </div>

            <button
              onClick={applyNow}
              className="w-full rounded-xl border-2 border-ink bg-ink px-4 py-3 text-sm font-bold uppercase text-paper shadow-brut hover:translate-y-[1px] hover:shadow-none"
            >
              ✨ Applica alla foto
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
