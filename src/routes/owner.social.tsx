import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { callAI } from "@/server/ai";
import { getSettings, type RestaurantSettings } from "@/lib/restaurant";
import { toast } from "sonner";

export const Route = createFileRoute("/owner/social")({
  head: () => ({ meta: [{ title: "Social — Unobuono" }] }),
  component: SocialPage,
});

type Post = { id: string; platform: string; caption: string; hashtags: string; image_url: string | null; status: string; scheduled_at: string | null; created_at: string };

function SocialPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [topic, setTopic] = useState("");
  const [busy, setBusy] = useState(false);
  const [settings, setSettings] = useState<RestaurantSettings | null>(null);

  useEffect(() => {
    getSettings().then(setSettings);
    supabase.from("social_posts").select("*").order("created_at", { ascending: false }).then(({ data }) => setPosts((data || []) as Post[]));
  }, []);

  async function generate() {
    if (!topic.trim()) return;
    setBusy(true);
    try {
      const r = await callAI({ data: {
        messages: [
          { role: "system", content: `Sei il social media manager di ${settings?.name || "un ristorante"}. Tono: ${settings?.tone || "caldo"}. Bio: ${settings?.bio || ""}. Genera UN post Instagram in italiano. Risposta JSON: {"caption":"...","hashtags":"#... #..."}. Caption max 200 caratteri, vivida e autentica. 5-8 hashtag pertinenti.` },
          { role: "user", content: topic },
        ],
        json: true,
      } });
      if (r.error) { toast.error("Errore AI"); return; }
      const parsed = JSON.parse(r.content);
      const { data } = await supabase.from("social_posts").insert({ caption: parsed.caption, hashtags: parsed.hashtags, platform: "instagram", status: "draft" }).select().single();
      if (data) setPosts((p) => [data as Post, ...p]);
      setTopic("");
      toast.success("Post generato");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(p: Post, status: string) {
    await supabase.from("social_posts").update({ status }).eq("id", p.id);
    setPosts((prev) => prev.map((x) => x.id === p.id ? { ...x, status } : x));
  }

  return (
    <div className="mx-auto max-w-3xl px-5 py-7">
      <header className="mb-5">
        <h1 className="font-display text-3xl">Social</h1>
        <p className="text-sm text-muted-foreground">Genera post Instagram con l'AI.</p>
      </header>

      <div className="rounded-2xl border border-border bg-card p-4">
        <label className="mb-2 block text-xs uppercase tracking-wider text-muted-foreground">Cosa vuoi raccontare?</label>
        <textarea value={topic} onChange={(e) => setTopic(e.target.value)} rows={2} placeholder="Es: nuova pizza con datterino giallo e burrata pugliese" className="w-full rounded-lg border border-border bg-background p-3 text-sm" />
        <button onClick={generate} disabled={busy || !topic.trim()} className="mt-3 rounded-lg bg-terracotta px-4 py-2 text-sm font-medium text-paper disabled:opacity-40">{busy ? "Genero..." : "✨ Genera post"}</button>
      </div>

      <ul className="mt-6 space-y-3">
        {posts.map((p) => (
          <li key={p.id} className="rounded-xl border border-border bg-card p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">{p.platform} · {p.status}</span>
              <div className="flex gap-1">
                {p.status === "draft" && <button onClick={() => setStatus(p, "scheduled")} className="rounded-md border border-border px-2 py-1 text-xs">Programma</button>}
                {p.status !== "published" && <button onClick={() => setStatus(p, "published")} className="rounded-md bg-terracotta px-2 py-1 text-xs text-paper">Pubblica</button>}
              </div>
            </div>
            <p className="whitespace-pre-wrap text-sm">{p.caption}</p>
            <p className="mt-2 text-xs text-terracotta">{p.hashtags}</p>
          </li>
        ))}
        {posts.length === 0 && <li className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">Nessun post ancora.</li>}
      </ul>
    </div>
  );
}
