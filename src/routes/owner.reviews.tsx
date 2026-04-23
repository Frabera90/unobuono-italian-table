import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { callAI } from "@/server/ai";
import { playDing } from "@/lib/sounds";
import { relTime, getSettings, type RestaurantSettings } from "@/lib/restaurant";
import { toast } from "sonner";

export const Route = createFileRoute("/owner/reviews")({
  head: () => ({ meta: [{ title: "Recensioni — Unobuono" }] }),
  component: ReviewsPage,
});

type Review = { id: string; platform: string; author: string; rating: number; text: string; date: string; status: string; owner_response: string | null; ai_responses: any };

const TONES = ["Caloroso", "Professionale", "Spiritoso"] as const;

function ReviewsPage() {
  const [list, setList] = useState<Review[]>([]);
  const [active, setActive] = useState<Review | null>(null);
  const [settings, setSettings] = useState<RestaurantSettings | null>(null);
  const [generating, setGenerating] = useState(false);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [tone, setTone] = useState<(typeof TONES)[number]>("Caloroso");

  useEffect(() => {
    getSettings().then(setSettings);
    supabase.from("reviews").select("*").order("date", { ascending: false }).then(({ data }) => setList((data || []) as Review[]));
    const ch = supabase.channel("o-rev").on("postgres_changes", { event: "INSERT", schema: "public", table: "reviews" }, (p) => {
      setList((prev) => [p.new as Review, ...prev]);
      try { playDing(); setTimeout(playDing, 250); } catch {}
      toast.success(`⭐ Nuova recensione ${(p.new as any).rating}★`);
    }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  async function generate(rev: Review) {
    setGenerating(true);
    setResponses({});
    try {
      const results: Record<string, string> = {};
      await Promise.all(TONES.map(async (t) => {
        const r = await callAI({ data: { messages: [
          { role: "system", content: `Sei il proprietario di ${settings?.name || "un ristorante"}. Rispondi alla recensione con tono "${t}", in italiano, max 3 frasi. Firmati alla fine.` },
          { role: "user", content: `Recensione ${rev.rating}★ di ${rev.author}: "${rev.text}"` },
        ] } });
        if (!r.error) results[t] = r.content;
      }));
      setResponses(results);
    } finally {
      setGenerating(false);
    }
  }

  async function publish(rev: Review, text: string) {
    await supabase.from("reviews").update({ owner_response: text, status: "responded" }).eq("id", rev.id);
    setList((prev) => prev.map((r) => r.id === rev.id ? { ...r, owner_response: text, status: "responded" } : r));
    setActive(null);
    toast.success("Risposta pubblicata");
  }

  async function simulate() {
    const samples = [
      { author: "Giulia P.", rating: 5, text: "Pizza incredibile, impasto leggerissimo. Servizio attento e ambiente caldo. Torneremo!" },
      { author: "Marco R.", rating: 2, text: "Tempi di attesa lunghi e pizza tiepida. Peccato, ci speravamo." },
      { author: "Anna B.", rating: 4, text: "Ottimi ingredienti, prezzo onesto. Solo un po' rumoroso il sabato sera." },
    ];
    const s = samples[Math.floor(Math.random() * samples.length)];
    await supabase.from("reviews").insert({ ...s, platform: "google", status: "new", date: new Date().toISOString() });
  }

  return (
    <div className="mx-auto max-w-5xl px-5 py-7">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl">Recensioni</h1>
          <p className="text-sm text-muted-foreground">{list.filter((r) => r.status === "new").length} nuove · {list.length} totali</p>
        </div>
        <button onClick={simulate} className="rounded-lg border border-border bg-card px-3 py-2 text-xs">+ Simula recensione</button>
      </header>

      <ul className="space-y-3">
        {list.map((r) => (
          <li key={r.id} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-display text-base">{r.author}</span>
                  <span className="text-amber-500">{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</span>
                  {r.status === "new" && <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] text-destructive">NUOVA</span>}
                </div>
                <p className="mt-2 text-sm">{r.text}</p>
                <p className="mt-1 text-xs text-muted-foreground">{relTime(r.date)} · {r.platform}</p>
                {r.owner_response && (
                  <div className="mt-3 rounded-lg border-l-2 border-terracotta bg-cream-dark/40 px-3 py-2 text-sm">
                    <div className="text-xs uppercase text-muted-foreground">La tua risposta</div>
                    <p className="mt-1">{r.owner_response}</p>
                  </div>
                )}
              </div>
              {!r.owner_response && (
                <button onClick={() => { setActive(r); setResponses({}); generate(r); }} className="rounded-md bg-terracotta px-3 py-2 text-xs font-medium text-paper">Rispondi con AI</button>
              )}
            </div>
          </li>
        ))}
      </ul>

      {active && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-ink/40 p-4" onClick={() => setActive(null)}>
          <div className="w-full max-w-2xl rounded-2xl bg-card p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-1 font-display text-2xl">Risposte AI</h3>
            <p className="mb-4 text-sm text-muted-foreground">Scegli un tono e personalizza prima di pubblicare.</p>
            <div className="mb-4 flex gap-2">
              {TONES.map((t) => (
                <button key={t} onClick={() => setTone(t)} className={`rounded-full px-3 py-1.5 text-xs ${tone === t ? "bg-terracotta text-paper" : "border border-border"}`}>{t}</button>
              ))}
            </div>
            {generating && !responses[tone] ? (
              <div className="py-10 text-center text-sm text-muted-foreground">Generazione in corso...</div>
            ) : (
              <textarea
                value={responses[tone] || ""}
                onChange={(e) => setResponses({ ...responses, [tone]: e.target.value })}
                rows={6}
                className="w-full rounded-lg border border-border bg-background p-3 text-sm"
              />
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setActive(null)} className="rounded-md border border-border px-4 py-2 text-sm">Annulla</button>
              <button onClick={() => publish(active, responses[tone] || "")} disabled={!responses[tone]} className="rounded-md bg-terracotta px-4 py-2 text-sm font-medium text-paper disabled:opacity-40">Pubblica</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
