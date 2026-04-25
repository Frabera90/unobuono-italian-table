/**
 * Chip preimpostati per "edit guidato" della foto AI.
 * Niente prompt libero illimitato — l'utente sceglie tra micro-modifiche sicure
 * (oppure scrive max 120 caratteri).
 */
const QUICK_EDITS: { label: string; instruction: string; emoji: string }[] = [
  { emoji: "🌞", label: "Più luminosa", instruction: "make it slightly brighter and more luminous" },
  { emoji: "🕯️", label: "Più calda", instruction: "warmer tones, golden ambient light" },
  { emoji: "❄️", label: "Più fresca", instruction: "cooler tones, slightly desaturated" },
  { emoji: "🎯", label: "Meno saturata", instruction: "reduce saturation, more natural and elegant colors" },
  { emoji: "✨", label: "Più contrasto", instruction: "increase contrast, deeper shadows, crisper highlights" },
  { emoji: "🫧", label: "Sfondo sfocato", instruction: "stronger background blur (bokeh), keep dish razor sharp" },
  { emoji: "🚫🖐️", label: "Niente mani", instruction: "remove any hands or human elements, dish only" },
  { emoji: "🚫🍷", label: "Niente extra", instruction: "remove all surrounding props, keep only the dish on a simple surface" },
];

export function EditChips({
  onPick,
  disabled,
}: {
  onPick: (instruction: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        🎛️ Modifica veloce (tieni lo stesso stile, cambia solo questo)
      </div>
      <div className="flex flex-wrap gap-1.5">
        {QUICK_EDITS.map((q) => (
          <button
            key={q.label}
            onClick={() => onPick(q.instruction)}
            disabled={disabled}
            className="rounded-full border border-ink/40 bg-paper px-2.5 py-1 text-xs hover:bg-yellow disabled:opacity-40"
            title={q.instruction}
          >
            {q.emoji} {q.label}
          </button>
        ))}
      </div>
    </div>
  );
}
