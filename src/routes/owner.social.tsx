import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { callAI, callAIVision, enhanceImage } from "@/server/ai";
import { getSettings, type RestaurantSettings } from "@/lib/restaurant";
import { CalendarGrid } from "@/components/social/CalendarGrid";
import { PlanGenerator } from "@/components/social/PlanGenerator";
import { toast } from "sonner";

export const Route = createFileRoute("/owner/social")({
  head: () => ({ meta: [{ title: "Social — Unobuono" }] }),
  component: SocialPage,
});

type Post = {
  id: string;
  platform: string;
  caption: string;
  hashtags: string;
  image_url: string | null;
  status: string;
  scheduled_at: string | null;
  created_at: string;
};

type Step = "upload" | "analyzing" | "review" | "publishing" | "done";

function SocialPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [settings, setSettings] = useState<RestaurantSettings | null>(null);
  const [tab, setTab] = useState<"composer" | "calendar" | "plan">("composer");
  const [monthOffset, setMonthOffset] = useState(0);

  // Composer state
  const [step, setStep] = useState<Step>("upload");
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [imageMime, setImageMime] = useState<string>("image/jpeg");
  const [caption, setCaption] = useState("");
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [extraContext, setExtraContext] = useState("");
  const [platform, setPlatform] = useState<"instagram" | "facebook" | "both">("instagram");
  const [scheduleNow, setScheduleNow] = useState(true);
  const [scheduledAt, setScheduledAt] = useState<string>("");
  const [confetti, setConfetti] = useState(false);
  const [enhancing, setEnhancing] = useState(false);
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [enhanced, setEnhanced] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);

  async function loadPosts() {
    const { data } = await supabase
      .from("social_posts")
      .select("*")
      .order("created_at", { ascending: false });
    setPosts((data || []) as Post[]);
  }

  useEffect(() => {
    getSettings().then(setSettings);
    loadPosts();
  }, []);

  function handleFile(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Carica un'immagine (JPG, PNG, WEBP).");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Immagine troppo grande (max 8MB).");
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = String(reader.result || "");
      setImageDataUrl(dataUrl);
      setImageMime(file.type);
      await analyze(dataUrl, file.type, "");
    };
    reader.readAsDataURL(file);
  }

  async function analyze(dataUrl: string, mime: string, extra: string) {
    setStep("analyzing");
    try {
      const base64 = dataUrl.split(",")[1] || "";
      const prompt = `Sei il social media manager di ${settings?.name || "Carpediem Pizzeria"}, Pescara.
Bio: ${settings?.bio || ""}
Tono: ${settings?.tone || "autentico e caldo"}

Guarda questa foto di un piatto del nostro ristorante e scrivi una caption per Instagram.
MAI commerciale, MAI generica. Autentica, calda, come parlerebbe un pizzaiolo appassionato.
Racconta qualcosa del piatto, degli ingredienti, o dell'emozione.
Max 150 caratteri per la caption principale.
Poi 8 hashtag rilevanti (mix italiano/inglese, locali e di settore).
${extra ? `\nContesto aggiuntivo dal proprietario: ${extra}` : ""}

Rispondi SOLO con JSON valido: {"caption":"...","hashtags":"#tag1 #tag2 #tag3 #tag4 #tag5 #tag6 #tag7 #tag8"}`;

      const r = await callAIVision({ data: { imageBase64: base64, mimeType: mime, prompt } });
      if (r.error === "rate_limit") { toast.error("Troppe richieste. Riprova tra poco."); setStep("upload"); return; }
      if (r.error === "credits") { toast.error("Crediti AI esauriti."); setStep("upload"); return; }
      if (r.error || !r.content) { toast.error("Errore generazione caption."); setStep("upload"); return; }

      const m = r.content.match(/\{[\s\S]*\}/);
      const parsed = m ? JSON.parse(m[0]) : { caption: r.content, hashtags: "" };
      setCaption(String(parsed.caption || "").trim());
      setHashtags(
        String(parsed.hashtags || "")
          .split(/\s+/)
          .map((h: string) => h.trim())
          .filter((h: string) => h.startsWith("#")),
      );
      setStep("review");
    } catch (e: any) {
      toast.error(e.message || "Errore");
      setStep("upload");
    }
  }

  async function regenerate() {
    if (!imageDataUrl) return;
    await analyze(imageDataUrl, imageMime, extraContext);
  }

  function reset() {
    setStep("upload");
    setImageDataUrl(null);
    setOriginalImage(null);
    setEnhanced(false);
    setCaption("");
    setHashtags([]);
    setExtraContext("");
    setScheduleNow(true);
    setScheduledAt("");
    setPlatform("instagram");
  }

  async function enhance(style: "auto" | "bright" | "moody" | "clean") {
    if (!imageDataUrl || enhancing) return;
    setEnhancing(true);
    try {
      const base64 = imageDataUrl.split(",")[1] || "";
      const r = await enhanceImage({ data: { imageBase64: base64, mimeType: imageMime, style } });
      if (r.error === "rate_limit") { toast.error("Troppe richieste. Riprova tra poco."); return; }
      if (r.error === "credits") { toast.error("Crediti AI esauriti."); return; }
      if (r.error || !r.imageUrl) { toast.error("Ritocco non riuscito. Riprova."); return; }
      if (!originalImage) setOriginalImage(imageDataUrl);
      setImageDataUrl(r.imageUrl);
      setImageMime("image/png");
      setEnhanced(true);
      toast.success("Foto ritoccata ✨");
    } catch (e: any) {
      toast.error(e.message || "Errore");
    } finally {
      setEnhancing(false);
    }
  }

  function revertEnhance() {
    if (!originalImage) return;
    setImageDataUrl(originalImage);
    setEnhanced(false);
    setOriginalImage(null);
  }

  async function publish() {
    if (!imageDataUrl || !caption.trim()) return;
    setStep("publishing");
    await new Promise((r) => setTimeout(r, 1800));

    const platformValue = platform === "both" ? "instagram,facebook" : platform;
    const { data, error } = await supabase
      .from("social_posts")
      .insert({
        caption,
        hashtags: hashtags.join(" "),
        platform: platformValue,
        image_url: imageDataUrl,
        status: scheduleNow ? "published" : "scheduled",
        scheduled_at: scheduleNow ? null : scheduledAt || null,
      })
      .select()
      .single();

    if (error) {
      toast.error(error.message);
      setStep("review");
      return;
    }
    if (data) setPosts((p) => [data as Post, ...p]);
    setConfetti(true);
    setStep("done");
    setTimeout(() => setConfetti(false), 2500);
  }

  const handle = (settings?.instagram_handle || "@carpediempescara").replace(/^@/, "");

  return (
    <div className="mx-auto max-w-3xl px-5 py-7">
      <header className="mb-5">
        <h1 className="font-display text-3xl">Social</h1>
        <p className="text-sm text-muted-foreground">Foto → AI scrive → tu approvi → pubblica.</p>
      </header>

      {/* Composer */}
      <div className="rounded-2xl border border-border bg-card p-5">
        {step === "upload" && (
          <div>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
            <button
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const f = e.dataTransfer.files?.[0];
                if (f) handleFile(f);
              }}
              className="flex w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border bg-background py-14 text-center transition hover:border-terracotta hover:bg-cream-dark/30"
            >
              <span className="text-4xl">📸</span>
              <span className="text-lg font-medium">Carica la foto del piatto</span>
              <span className="text-sm text-muted-foreground">
                Scatta una foto con il telefono o carica dal computer
              </span>
              <span className="mt-1 text-xs text-muted-foreground">JPG · PNG · WEBP · max 8MB</span>
            </button>
          </div>
        )}

        {step === "analyzing" && imageDataUrl && (
          <div className="flex flex-col items-center gap-4 py-8">
            <img src={imageDataUrl} alt="Anteprima" className="h-48 w-48 rounded-xl object-cover shadow-md" />
            <div className="flex items-center gap-2 text-sm">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-terracotta" />
              <span>✨ L'AI sta analizzando la foto...</span>
            </div>
          </div>
        )}

        {(step === "review" || step === "publishing" || step === "done") && imageDataUrl && (
          <div className="grid gap-5 md:grid-cols-2">
            {/* Instagram preview */}
            <div className="rounded-xl border border-border bg-background p-3">
              <div className="mb-2 flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 p-[2px]">
                  <div className="h-full w-full rounded-full bg-background" />
                </div>
                <span className="text-sm font-semibold">{handle}</span>
              </div>
              <div className="relative">
                <img src={imageDataUrl} alt="Post" className="aspect-square w-full rounded-md object-cover" />
                {enhanced && (
                  <span className="absolute left-2 top-2 rounded-full border border-ink bg-yellow px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                    ✨ Ritoccata AI
                  </span>
                )}
              </div>
              <div className="mt-2 flex items-center gap-3 text-xl">
                <span>♡</span>
                <span>💬</span>
                <span>↗</span>
                <span className="ml-auto">🔖</span>
              </div>
              <p className="mt-2 line-clamp-2 text-sm">
                <span className="font-semibold">{handle}</span>{" "}
                {caption || "—"}
                <span className="text-muted-foreground"> ... altro</span>
              </p>
              {hashtags.length > 0 && (
                <p className="mt-1 text-sm text-blue-600 dark:text-blue-400">{hashtags.join(" ")}</p>
              )}
            </div>

            {/* Editor */}
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs uppercase tracking-wider text-muted-foreground">Caption</label>
                <textarea
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  rows={4}
                  className="w-full rounded-lg border border-border bg-background p-2 text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs uppercase tracking-wider text-muted-foreground">Hashtag</label>
                <div className="flex flex-wrap gap-1.5">
                  {hashtags.map((h, i) => (
                    <button
                      key={i}
                      onClick={() => setHashtags((arr) => arr.filter((_, j) => j !== i))}
                      className="rounded-full bg-cream-dark/60 px-2.5 py-1 text-xs hover:bg-terracotta hover:text-paper"
                      title="Rimuovi"
                    >
                      {h} ✕
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs uppercase tracking-wider text-muted-foreground">Aggiungi contesto (opzionale)</label>
                <input
                  value={extraContext}
                  onChange={(e) => setExtraContext(e.target.value)}
                  placeholder="es. nuovo piatto estivo"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              </div>

              <button
                onClick={regenerate}
                disabled={step !== "review"}
                className="w-full rounded-lg border border-border bg-background py-2 text-sm hover:bg-cream-dark/40 disabled:opacity-40"
              >
                🔄 Rigenera caption
              </button>

              <div className="rounded-lg border-2 border-ink bg-yellow/40 p-3">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider">✨ Ritocca foto con AI</span>
                  {enhanced && (
                    <button
                      onClick={revertEnhance}
                      disabled={enhancing}
                      className="text-[11px] underline disabled:opacity-40"
                    >
                      ↩ originale
                    </button>
                  )}
                </div>
                <p className="mb-2 text-[11px] text-muted-foreground">
                  Non sei un fotografo? Lascia che l'AI migliori luce, colori e nitidezza. Il piatto resta lo stesso.
                </p>
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                  {([
                    { k: "auto", label: "Auto" },
                    { k: "bright", label: "Luminoso" },
                    { k: "moody", label: "Caldo" },
                    { k: "clean", label: "Pulito" },
                  ] as const).map((s) => (
                    <button
                      key={s.k}
                      onClick={() => enhance(s.k)}
                      disabled={enhancing || step !== "review"}
                      className="rounded-md border border-ink bg-paper px-2 py-1.5 text-xs font-medium hover:bg-yellow disabled:opacity-40"
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
                {enhancing && (
                  <div className="mt-2 flex items-center gap-2 text-xs">
                    <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-ink" />
                    Ritocco in corso… (~10s)
                  </div>
                )}
              </div>

              <div className="border-t border-border pt-3">
                <label className="mb-1 block text-xs uppercase tracking-wider text-muted-foreground">Piattaforma</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(["instagram", "facebook", "both"] as const).map((p) => (
                    <button
                      key={p}
                      onClick={() => setPlatform(p)}
                      className={`rounded-md border px-2 py-1.5 text-xs ${platform === p ? "border-terracotta bg-terracotta text-paper" : "border-border bg-background"}`}
                    >
                      {p === "instagram" ? "Instagram" : p === "facebook" ? "Facebook" : "Entrambi"}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={scheduleNow} onChange={(e) => setScheduleNow(e.target.checked)} />
                  Pubblica ora
                </label>
                {!scheduleNow && (
                  <input
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  />
                )}
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  onClick={reset}
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
                >
                  Annulla
                </button>
                <button
                  onClick={publish}
                  disabled={step !== "review" || !caption.trim()}
                  className="flex-1 rounded-lg bg-terracotta px-4 py-2 text-sm font-medium text-paper disabled:opacity-40"
                >
                  {step === "publishing" ? "Pubblicazione..." : scheduleNow ? "Approva e pubblica" : "Approva e programma"}
                </button>
              </div>

              {step === "done" && (
                <div className="relative rounded-lg border border-terracotta/40 bg-terracotta/10 p-3 text-center text-sm">
                  ✓ Pubblicato su @{handle}! 🎉
                  {confetti && <Confetti />}
                  <button onClick={reset} className="mt-2 block w-full rounded-md bg-terracotta px-3 py-1.5 text-xs text-paper">
                    Crea un altro post
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* History */}
      <ul className="mt-6 space-y-3">
        {posts.map((p) => (
          <li key={p.id} className="flex gap-3 rounded-xl border border-border bg-card p-3">
            {p.image_url ? (
              <img src={p.image_url} alt="" className="h-20 w-20 flex-shrink-0 rounded-lg object-cover" />
            ) : (
              <div className="h-20 w-20 flex-shrink-0 rounded-lg bg-cream-dark/40" />
            )}
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-xs uppercase tracking-wider text-muted-foreground">
                  {p.platform} · {p.status}
                </span>
              </div>
              <p className="line-clamp-2 text-sm">{p.caption}</p>
              <p className="mt-1 line-clamp-1 text-xs text-terracotta">{p.hashtags}</p>
            </div>
          </li>
        ))}
        {posts.length === 0 && (
          <li className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
            Nessun post ancora.
          </li>
        )}
      </ul>
    </div>
  );
}

function Confetti() {
  const pieces = Array.from({ length: 24 });
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {pieces.map((_, i) => {
        const left = Math.random() * 100;
        const delay = Math.random() * 0.4;
        const duration = 1.4 + Math.random() * 0.8;
        const colors = ["#c4592a", "#e8b04b", "#7aa874", "#d97757", "#6b8cae"];
        const bg = colors[i % colors.length];
        return (
          <span
            key={i}
            className="absolute top-0 h-2 w-2 rounded-sm"
            style={{
              left: `${left}%`,
              backgroundColor: bg,
              animation: `confetti-fall ${duration}s ${delay}s ease-out forwards`,
            }}
          />
        );
      })}
      <style>{`@keyframes confetti-fall { 0% { transform: translateY(-10px) rotate(0deg); opacity: 1; } 100% { transform: translateY(120px) rotate(360deg); opacity: 0; } }`}</style>
    </div>
  );
}
