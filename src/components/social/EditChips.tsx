/**
 * Chip preimpostati per "edit guidato" della foto AI.
 * Sono CONTESTUALI: mostrano solo modifiche coerenti con lo stato corrente
 * (es. se non hai aggiunto le mani, non ti propone "togli le mani").
 */
import { ADDON_OPTIONS, type AddonKey } from "./StyleWizard";

type ToneEdit = { key: string; label: string; emoji: string; instruction: string };

const TONE_EDITS: ToneEdit[] = [
  { key: "brighter", emoji: "🌞", label: "Più luminosa", instruction: "make it slightly brighter and more luminous" },
  { key: "warmer", emoji: "🕯️", label: "Più calda", instruction: "warmer tones, golden ambient light" },
  { key: "cooler", emoji: "❄️", label: "Più fresca", instruction: "cooler tones, slightly desaturated" },
  { key: "less_sat", emoji: "🎯", label: "Meno saturata", instruction: "reduce saturation, more natural elegant colors" },
  { key: "contrast", emoji: "✨", label: "Più contrasto", instruction: "increase contrast, deeper shadows, crisper highlights" },
  { key: "blur", emoji: "🫧", label: "Sfondo più sfocato", instruction: "stronger background blur (bokeh), keep dish razor sharp" },
];

export function EditChips({
  activeAddons,
  onAdd,
  onRemove,
  onTone,
  disabled,
}: {
  activeAddons: AddonKey[];
  onAdd: (addon: AddonKey) => void;
  onRemove: (addon: AddonKey) => void;
  onTone: (instruction: string) => void;
  disabled?: boolean;
}) {
  const missing = ADDON_OPTIONS.filter((a) => !activeAddons.includes(a.k as AddonKey));
  const present = ADDON_OPTIONS.filter((a) => activeAddons.includes(a.k as AddonKey));

  return (
    <div className="space-y-3">
      <div>
        <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          🎛️ Tono e luce
        </div>
        <div className="flex flex-wrap gap-1.5">
          {TONE_EDITS.map((q) => (
            <button
              key={q.key}
              onClick={() => onTone(q.instruction)}
              disabled={disabled}
              className="rounded-full border border-ink/40 bg-paper px-2.5 py-1 text-xs hover:bg-yellow disabled:opacity-40"
              title={q.instruction}
            >
              {q.emoji} {q.label}
            </button>
          ))}
        </div>
      </div>

      {present.length > 0 && (
        <div>
          <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            🚫 Togli (attivi adesso)
          </div>
          <div className="flex flex-wrap gap-1.5">
            {present.map((a) => (
              <button
                key={a.k}
                onClick={() => onRemove(a.k as AddonKey)}
                disabled={disabled}
                className="rounded-full border border-destructive/50 bg-destructive/10 px-2.5 py-1 text-xs hover:bg-destructive hover:text-paper disabled:opacity-40"
              >
                ✕ {a.emoji} {a.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {missing.length > 0 && (
        <div>
          <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            ➕ Aggiungi
          </div>
          <div className="flex flex-wrap gap-1.5">
            {missing.map((a) => (
              <button
                key={a.k}
                onClick={() => onAdd(a.k as AddonKey)}
                disabled={disabled}
                className="rounded-full border border-ink/40 bg-paper px-2.5 py-1 text-xs hover:bg-yellow disabled:opacity-40"
              >
                + {a.emoji} {a.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
