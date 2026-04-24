import { useMemo } from "react";

type CalPost = {
  id: string;
  scheduled_at: string | null;
  created_at: string;
  status: string;
  caption: string;
  image_url: string | null;
};

export function CalendarGrid({
  posts,
  monthOffset,
  onChangeMonth,
  onPick,
}: {
  posts: CalPost[];
  monthOffset: number;
  onChangeMonth: (delta: number) => void;
  onPick: (post: CalPost) => void;
}) {
  const today = new Date();
  const view = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
  const year = view.getFullYear();
  const month = view.getMonth();
  const monthLabel = view.toLocaleDateString("it-IT", { month: "long", year: "numeric" });

  const cells = useMemo(() => {
    const first = new Date(year, month, 1);
    const startWeekday = (first.getDay() + 6) % 7; // monday-first
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const arr: Array<{ day: number | null; date: string | null }> = [];
    for (let i = 0; i < startWeekday; i++) arr.push({ day: null, date: null });
    for (let d = 1; d <= daysInMonth; d++) {
      const dStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      arr.push({ day: d, date: dStr });
    }
    while (arr.length % 7 !== 0) arr.push({ day: null, date: null });
    return arr;
  }, [year, month]);

  const postsByDate = useMemo(() => {
    const m = new Map<string, CalPost[]>();
    for (const p of posts) {
      const ref = p.scheduled_at || p.created_at;
      if (!ref) continue;
      const key = ref.slice(0, 10);
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(p);
    }
    return m;
  }, [posts]);

  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const weekdays = ["L", "M", "M", "G", "V", "S", "D"];

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <button
          onClick={() => onChangeMonth(-1)}
          className="rounded-md border-2 border-ink bg-paper px-3 py-1 text-sm font-bold hover:bg-yellow"
        >
          ←
        </button>
        <h3 className="font-display text-xl uppercase">{monthLabel}</h3>
        <button
          onClick={() => onChangeMonth(1)}
          className="rounded-md border-2 border-ink bg-paper px-3 py-1 text-sm font-bold hover:bg-yellow"
        >
          →
        </button>
      </div>

      <div className="mb-1 grid grid-cols-7 gap-1">
        {weekdays.map((w, i) => (
          <div key={i} className="text-center text-[10px] font-bold uppercase text-muted-foreground">
            {w}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((c, i) => {
          if (!c.day) return <div key={i} className="aspect-square rounded-md bg-cream-dark/20" />;
          const dayPosts = (c.date && postsByDate.get(c.date)) || [];
          const isToday = c.date === todayKey;
          return (
            <div
              key={i}
              className={`relative aspect-square overflow-hidden rounded-md border ${isToday ? "border-2 border-ink" : "border-border"} bg-paper`}
            >
              <span className={`absolute left-1 top-0.5 z-10 text-[10px] font-bold ${isToday ? "text-ink" : "text-muted-foreground"}`}>
                {c.day}
              </span>
              {dayPosts[0]?.image_url ? (
                <button
                  onClick={() => onPick(dayPosts[0])}
                  className="absolute inset-0 h-full w-full"
                  title={dayPosts[0].caption}
                >
                  <img src={dayPosts[0].image_url} alt="" className="h-full w-full object-cover" />
                  {dayPosts.length > 1 && (
                    <span className="absolute bottom-0.5 right-0.5 rounded-full border border-ink bg-yellow px-1 text-[9px] font-bold">
                      +{dayPosts.length - 1}
                    </span>
                  )}
                  {dayPosts[0].status === "scheduled" && (
                    <span className="absolute right-0.5 top-0.5 h-2 w-2 rounded-full border border-ink bg-yellow" title="Programmato" />
                  )}
                </button>
              ) : dayPosts.length > 0 ? (
                <button
                  onClick={() => onPick(dayPosts[0])}
                  className="absolute inset-0 flex items-center justify-center bg-yellow/30"
                >
                  <span className="text-base">📝</span>
                </button>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full border border-ink bg-yellow" /> Programmato</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full border border-ink bg-paper" /> Pubblicato</span>
      </div>
    </div>
  );
}
