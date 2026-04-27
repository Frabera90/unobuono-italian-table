import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { callAI, callAIVision, enhanceImage, planSocialCalendar } from "@/server/ai";
import { getMySettings, getMyRestaurant, type RestaurantSettings, type Restaurant } from "@/lib/restaurant";
import { CalendarGrid } from "@/components/social/CalendarGrid";
import { StyleWizard, type AddonKey } from "@/components/social/StyleWizard";
import { EditChips } from "@/components/social/EditChips";
import {
  getInstagramStatus,
  startInstagramOAuth,
  disconnectInstagram,
  publishToInstagram,
} from "@/server/instagram";
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

type MainTab = "foto" | "piano" | "storico";
type PhotoStep = "upload" | "style" | "enhancing" | "compare" | "captioning" | "editor" | "done";
type PlanStep = "questions" | "generating" | "results";

type PlanPost = {
  date: string;
  time: string;
  theme: string;
  type: string;
  photo_idea: string;
  caption: string;
  hashtags: string;
  approved: boolean;
  editing: boolean;
};


const CUISINE_CHIPS = ["Italiana", "Pizza", "Pesce", "Carne", "Vegetariana", "Fusion", "Regionale"];
const GOAL_CHIPS    = ["Nuovi clienti", "Fidelizzare", "Mostrare il team", "Lanciare un piatto", "Promuovere un evento"];
const SEASON_CHIPS  = ["Primavera", "Estate", "Autunno", "Inverno", "Natale", "Ferragosto", "Pasqua", "Sagra"];

function SocialPage() {
  const [tab, setTab]           = useState<MainTab>("foto");
  const [posts, setPosts]       = useState<Post[]>([]);
  const [settings, setSettings] = useState<RestaurantSettings | null>(null);
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [monthOffset, setMonthOffset] = useState(0);

  // ── Photo flow ──────────────────────────────────────
  const [photoStep, setPhotoStep]       = useState<PhotoStep>("upload");
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [imageMime, setImageMime]       = useState("image/jpeg");
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [enhancing, setEnhancing]       = useState(false);
  const [captioning, setCaptioning]     = useState(false);
  const [caption, setCaption]           = useState("");
  const [hashtags, setHashtags]         = useState<string[]>([]);
  const [platform, setPlatform]         = useState<"instagram" | "facebook" | "both">("instagram");
  const [scheduleMode, setScheduleMode] = useState<"now" | "today" | "custom">("now");
  const [scheduledAt, setScheduledAt]   = useState("");
  const [todayTime, setTodayTime]       = useState("19:30");
  const [publishing, setPublishing]     = useState(false);
  const [confetti, setConfetti]         = useState(false);
  // wizard state
  const [showWizard, setShowWizard]     = useState(false);
  const [currentStyle, setCurrentStyle] = useState<string>("auto");
  const [currentAddons, setCurrentAddons] = useState<string[]>([]);
  const [currentExtra, setCurrentExtra]   = useState<string>("");

  // ── Plan flow ────────────────────────────────────────
  const [planStep, setPlanStep]         = useState<PlanStep>("questions");
  const [planRange, setPlanRange]       = useState<"week" | "month">("week");
  const [cuisineChips, setCuisineChips] = useState<string[]>([]);
  const [goalChips, setGoalChips]       = useState<string[]>([]);
  const [seasonChips, setSeasonChips]   = useState<string[]>([]);
  const [events, setEvents]             = useState("");
  const [planPosts, setPlanPosts]       = useState<PlanPost[]>([]);

  const fileRef = useRef<HTMLInputElement>(null);

  async function loadPosts(restaurantId?: string) {
    const rid = restaurantId ?? restaurant?.id;
    if (!rid) return;
    const { data } = await supabase
      .from("social_posts")
      .select("*")
      .eq("restaurant_id", rid)
      .order("created_at", { ascending: false });
    setPosts((data || []) as Post[]);
  }

  // ── Instagram connection ────────────────────────────
  const [igStatus, setIgStatus] = useState<{ connected: boolean; ig_username?: string | null; fb_page_name?: string | null } | null>(null);
  const [igBusy, setIgBusy] = useState(false);
  const [igPublishing, setIgPublishing] = useState<string | null>(null);

  async function refreshIgStatus() {
    try {
      const r = await getInstagramStatus();
      setIgStatus(r as any);
    } catch { setIgStatus({ connected: false }); }
  }

  async function connectIg() {
    setIgBusy(true);
    try {
      const r = await startInstagramOAuth({ data: { origin: window.location.origin } });
      if ("error" in r && r.error) { toast.error(r.error); return; }
      if ("url" in r && r.url) window.location.href = r.url;
    } finally { setIgBusy(false); }
  }

  async function disconnectIg() {
    if (!confirm("Scollegare Instagram?")) return;
    setIgBusy(true);
    try {
      await disconnectInstagram();
      toast.success("Instagram scollegato");
      await refreshIgStatus();
    } finally { setIgBusy(false); }
  }

  async function publishIgNow(postId: string) {
    setIgPublishing(postId);
    try {
      const r = await publishToInstagram({ data: { postId } });
      if (!r.ok) { toast.error(r.error || "Errore"); return; }
      toast.success("📸 Pubblicato su Instagram!");
    } catch (e: any) {
      toast.error(e?.message || "Errore");
    } finally { setIgPublishing(null); }
  }

  useEffect(() => {
    let mounted = true;
    void Promise.all([getMySettings(), getMyRestaurant(), refreshIgStatus()]).then(([s, r]) => {
      if (!mounted) return;
      setSettings(s);
      setRestaurant(r);
      if (r) void loadPosts(r.id);
    });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!restaurant?.id) return;
    const ch = supabase
      .channel(`social_posts_${restaurant.id}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "social_posts", filter: `restaurant_id=eq.${restaurant.id}` },
        () => { void loadPosts(restaurant.id); })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurant?.id]);

  // ── Photo handlers ───────────────────────────────────

  function handleFile(file: File) {
    if (!file.type.startsWith("image/")) { toast.error("Carica un'immagine (JPG, PNG, WEBP)."); return; }
    if (file.size > 8 * 1024 * 1024) { toast.error("Immagine troppo grande (max 8MB)."); return; }
    const reader = new FileReader();
    reader.onload = () => {
      setImageDataUrl(String(reader.result || ""));
      setImageMime(file.type);
      setOriginalImage(null);
      setPhotoStep("style");
    };
    reader.readAsDataURL(file);
  }

  async function applyStyle(styleKey: string, addons: string[] = currentAddons, extra: string = currentExtra) {
    if (!imageDataUrl || enhancing) return;
    setEnhancing(true);
    setPhotoStep("enhancing");
    setCurrentStyle(styleKey);
    setCurrentAddons(addons);
    setCurrentExtra(extra);
    try {
      // Always re-enhance starting from the ORIGINAL when available, so edits don't compound.
      const sourceImg = originalImage || imageDataUrl;
      const base64 = sourceImg.split(",")[1] || "";
      const r = await enhanceImage({ data: { imageBase64: base64, mimeType: imageMime, style: styleKey, addons, extraInstructions: extra } });
      if (r.error === "rate_limit") { toast.error("Troppe richieste. Riprova tra poco."); setPhotoStep("style"); return; }
      if (r.error === "credits")    { toast.error("Crediti AI esauriti.");                setPhotoStep("style"); return; }
      if (r.error || !r.imageUrl)  { toast.error("Ritocco non riuscito. Riprova.");       setPhotoStep("style"); return; }
      if (!originalImage) setOriginalImage(imageDataUrl);
      setImageDataUrl(r.imageUrl);
      setImageMime("image/png");
      setPhotoStep("compare");
    } catch (e: any) {
      toast.error(e.message || "Errore");
      setPhotoStep("style");
    } finally {
      setEnhancing(false);
    }
  }

  // contextual edit: tweak tone/light without changing style
  async function applyToneTweak(instruction: string) {
    const merged = (currentExtra ? currentExtra + ". " : "") + instruction;
    await applyStyle(currentStyle, currentAddons, merged.slice(0, 280));
  }
  function addAddon(k: AddonKey) {
    if (currentAddons.includes(k)) return;
    void applyStyle(currentStyle, [...currentAddons, k], currentExtra);
  }
  function removeAddon(k: AddonKey) {
    void applyStyle(currentStyle, currentAddons.filter((x) => x !== k), currentExtra);
  }

  async function generateCaption() {
    if (!imageDataUrl) return;
    setCaptioning(true);
    setPhotoStep("captioning");
    try {
      const base64 = imageDataUrl.split(",")[1] || "";
      const prompt = `Sei il social media manager di ${settings?.name || "questo ristorante"}.
Bio: ${settings?.bio || ""}
Tono: ${settings?.tone || "autentico e caldo"}

Guarda questa foto e scrivi una caption Instagram autentica, calda, come un cuoco appassionato.
MAI commerciale o generica. Max 150 caratteri. Poi 8 hashtag (mix italiano/inglese).

Rispondi SOLO con JSON: {"caption":"...","hashtags":"#tag1 #tag2 #tag3 #tag4 #tag5 #tag6 #tag7 #tag8"}`;
      const r = await callAIVision({ data: { imageBase64: base64, mimeType: imageMime, prompt } });
      if (r.error === "rate_limit") { toast.error("Troppe richieste."); setPhotoStep("compare"); return; }
      if (r.error === "credits")    { toast.error("Crediti esauriti.");  setPhotoStep("compare"); return; }
      if (r.error || !r.content)   { toast.error("Errore caption.");     setPhotoStep("compare"); return; }
      const m = r.content.match(/\{[\s\S]*\}/);
      const parsed = m ? JSON.parse(m[0]) : { caption: r.content, hashtags: "" };
      setCaption(String(parsed.caption || "").trim());
      setHashtags(String(parsed.hashtags || "").split(/\s+/).map((h: string) => h.trim()).filter((h: string) => h.startsWith("#")));
      setPhotoStep("editor");
    } catch (e: any) {
      toast.error(e.message || "Errore");
      setPhotoStep("compare");
    } finally {
      setCaptioning(false);
    }
  }

  async function publish() {
    if (!imageDataUrl || !caption.trim() || !restaurant?.id) return;
    setPublishing(true);
    let scheduledISO: string | null = null;
    if (scheduleMode === "today") {
      const [hh, mm] = todayTime.split(":");
      const d = new Date();
      d.setHours(Number(hh) || 19, Number(mm) || 30, 0, 0);
      if (d.getTime() < Date.now()) d.setDate(d.getDate() + 1);
      scheduledISO = d.toISOString();
    } else if (scheduleMode === "custom") {
      if (!scheduledAt) { toast.error("Scegli data e ora."); setPublishing(false); return; }
      scheduledISO = new Date(scheduledAt).toISOString();
    }
    const { error } = await supabase.from("social_posts").insert({
      restaurant_id: restaurant.id,
      caption,
      hashtags: hashtags.join(" "),
      platform: platform === "both" ? "instagram,facebook" : platform,
      image_url: imageDataUrl,
      status: scheduleMode === "now" ? "published" : "scheduled",
      scheduled_at: scheduledISO,
    });
    setPublishing(false);
    if (error) { toast.error(error.message); return; }
    setConfetti(true);
    setPhotoStep("done");
    setTimeout(() => setConfetti(false), 2500);
  }

  function resetPhoto() {
    setPhotoStep("upload");
    setImageDataUrl(null);
    setOriginalImage(null);
    setCaption("");
    setHashtags([]);
    setScheduleMode("now");
    setScheduledAt("");
    setPlatform("instagram");
    setCurrentStyle("auto");
    setCurrentAddons([]);
    setCurrentExtra("");
    setShowWizard(false);
  }

  // ── Plan handlers ────────────────────────────────────

  async function generatePlan() {
    if (!settings || !restaurant) { toast.error("Impostazioni ristorante non trovate."); return; }
    setPlanStep("generating");
    const context = [
      cuisineChips.length ? `Cucina: ${cuisineChips.join(", ")}` : "",
      goalChips.length   ? `Obiettivo: ${goalChips.join(", ")}` : "",
      seasonChips.length ? `Periodo: ${seasonChips.join(", ")}` : "",
      events             ? `Note: ${events}` : "",
    ].filter(Boolean).join(". ");
    try {
      const today = new Date().toISOString().slice(0, 10);
      const r = await planSocialCalendar({
        data: {
          range: planRange,
          restaurantName: settings.name || "il ristorante",
          bio:            settings.bio  || "",
          tone:           settings.tone || "autentico",
          startDateISO:   today,
          context,
        },
      });
      if (r.error === "rate_limit") { toast.error("Troppe richieste."); setPlanStep("questions"); return; }
      if (r.error === "credits")    { toast.error("Crediti AI esauriti."); setPlanStep("questions"); return; }
      if (r.error || !r.posts.length) { toast.error("Nessun piano generato. Riprova."); setPlanStep("questions"); return; }
      setPlanPosts(r.posts.map((p: any) => ({ ...p, approved: false, editing: false })));
      setPlanStep("results");
    } catch (e: any) {
      toast.error(e.message || "Errore");
      setPlanStep("questions");
    }
  }

  async function regeneratePost(index: number) {
    if (!settings) return;
    const p = planPosts[index];
    try {
      const r = await callAI({
        data: {
          messages: [
            { role: "system", content: `Sei il social media manager di ${settings.name}. Bio: ${settings.bio}. Tono: ${settings.tone}.` },
            { role: "user",   content: `Scrivi caption Instagram (max 140 char, in italiano) e 8 hashtag per: data ${p.date} alle ${p.time}, tema "${p.theme}", tipo "${p.type}". Rispondi SOLO con JSON: {"caption":"...","hashtags":"#a #b ..."}` },
          ],
          json: true,
        },
      });
      if (r.error || !r.content) { toast.error("Rigenera fallita."); return; }
      const parsed = JSON.parse(r.content);
      setPlanPosts((arr) => arr.map((pp, i) => i === index ? { ...pp, caption: parsed.caption, hashtags: parsed.hashtags, editing: false } : pp));
    } catch {
      toast.error("Errore nella rigenerazione.");
    }
  }

  function addManualPost() {
    const today = new Date();
    const d = new Date(today.getTime() + 24 * 60 * 60 * 1000);
    const dateISO = d.toISOString().slice(0, 10);
    setPlanPosts((arr) => [
      ...arr,
      {
        date: dateISO,
        time: "19:30",
        theme: "Idea personale",
        type: "custom",
        photo_idea: "",
        caption: "",
        hashtags: "",
        approved: true,
        editing: true,
      },
    ]);
    if (planStep !== "results") setPlanStep("results");
  }

  function removePlanPost(index: number) {
    setPlanPosts((arr) => arr.filter((_, i) => i !== index));
  }

  async function deletePost(id: string) {
    if (!confirm("Eliminare questo post?")) return;
    const { error } = await supabase.from("social_posts").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Post eliminato");
    await loadPosts();
  }

  async function clearHistory() {
    if (!restaurant?.id) return;
    if (!confirm("Cancellare TUTTO lo storico social? L'azione è irreversibile.")) return;
    const { error } = await supabase
      .from("social_posts")
      .delete()
      .eq("restaurant_id", restaurant.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Storico svuotato");
    await loadPosts();
  }

  async function clearScheduled() {
    if (!restaurant?.id) return;
    if (!confirm("Cancellare tutti i post programmati (non pubblicati)?")) return;
    const { error } = await supabase
      .from("social_posts")
      .delete()
      .eq("restaurant_id", restaurant.id)
      .eq("status", "scheduled");
    if (error) { toast.error(error.message); return; }
    toast.success("Post programmati eliminati");
    await loadPosts();
  }

  async function saveApproved() {
    if (!restaurant?.id) return;
    const approved = planPosts.filter((p) => p.approved && p.caption.trim());
    if (!approved.length) { toast.error("Approva almeno un post con caption."); return; }
    const rows = approved.map((p) => ({
      restaurant_id: restaurant!.id,
      caption:       p.caption,
      hashtags:      p.hashtags,
      platform:      "instagram",
      image_url:     null,
      status:        "scheduled",
      scheduled_at:  `${p.date}T${p.time}:00`,
    }));
    const { error } = await supabase.from("social_posts").insert(rows);
    if (error) { toast.error(error.message); return; }
    toast.success(`${approved.length} post programmati nel calendario!`);
    setPlanStep("questions");
    setPlanPosts([]);
    setTab("storico");
    await loadPosts();
  }

  function toggleChip<T extends string>(arr: T[], val: T, set: (v: T[]) => void) {
    set(arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val]);
  }

  const handle = (settings?.instagram_handle || "@iltuoristorante").replace(/^@/, "");

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 md:px-5 md:py-7">
      <header className="mb-5">
        <h1 className="font-display text-2xl uppercase md:text-3xl">Social</h1>
        <p className="text-sm text-muted-foreground">Foto, piano editoriale e calendario — tutto in un posto.</p>
      </header>

      {/* Instagram connection bar */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border-2 border-ink bg-paper p-3 shadow-brut">
        {igStatus?.connected ? (
          <>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-lg">📸</span>
              <span>
                Instagram collegato: <b>@{igStatus.ig_username || "—"}</b>
                {igStatus.fb_page_name && <span className="text-muted-foreground"> · {igStatus.fb_page_name}</span>}
              </span>
            </div>
            <button
              onClick={disconnectIg}
              disabled={igBusy}
              className="rounded-md border border-red-400 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              Scollega
            </button>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-lg">📸</span>
              <span>Instagram <b>non collegato</b> — collega per pubblicare in automatico.</span>
            </div>
            <button
              onClick={connectIg}
              disabled={igBusy}
              className="rounded-md border-2 border-ink bg-yellow px-3 py-1.5 text-xs font-bold uppercase shadow-brut hover:translate-y-[1px] hover:shadow-none disabled:opacity-50"
            >
              {igBusy ? "..." : "Collega Instagram"}
            </button>
          </>
        )}
      </div>

      {/* Tab bar */}
      <div className="mb-5 flex gap-1 rounded-xl border-2 border-ink bg-paper p-1 shadow-brut">
        {([
          { key: "foto",    label: "📸 Foto" },
          { key: "piano",   label: "✨ Piano AI" },
          { key: "storico", label: "🗓 Storico" },
        ] as const).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 rounded-lg py-2 text-sm font-bold transition ${
              tab === key ? "bg-ink text-paper" : "text-muted-foreground hover:text-ink"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ═══════════════ TAB: FOTO ═══════════════ */}
      {tab === "foto" && (
        <div className="rounded-2xl border-2 border-ink bg-paper p-4 shadow-brut md:p-6">

          {/* upload */}
          {photoStep === "upload" && (
            <>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
              <button
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) handleFile(f); }}
                className="flex w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-ink bg-cream py-14 text-center transition hover:bg-yellow/30"
              >
                <span className="text-5xl">📸</span>
                <span className="text-base font-bold uppercase tracking-wide">Carica una foto del piatto</span>
                <span className="text-sm text-muted-foreground">Trascina qui oppure clicca per scegliere</span>
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">JPG · PNG · WEBP · max 8MB</span>
              </button>
            </>
          )}

          {/* style selection — full wizard */}
          {photoStep === "style" && imageDataUrl && restaurant?.id && (
            <div>
              <div className="mb-5 flex items-center gap-4">
                <img src={imageDataUrl} alt="Foto" className="h-20 w-20 rounded-xl object-cover shadow-md" />
                <div className="min-w-0 flex-1">
                  <p className="text-lg font-bold">Scegli stile e contesto</p>
                  <p className="text-sm text-muted-foreground">12 stili visivi + contesto (mani, piatto, persone…) + ritocchi guidati.</p>
                </div>
              </div>
              <button
                onClick={() => setShowWizard(true)}
                className="w-full rounded-xl border-2 border-ink bg-yellow py-4 text-sm font-bold uppercase tracking-wider shadow-brut transition hover:-translate-y-0.5 hover:shadow-none"
              >
                🎨 Apri wizard stile
              </button>
              <button onClick={resetPhoto}
                className="mt-3 w-full rounded-lg border border-border py-2 text-sm text-muted-foreground hover:bg-cream-dark/40">
                ← Cambia foto
              </button>
              {showWizard && (
                <StyleWizard
                  restaurantId={restaurant.id}
                  initialStyle={currentStyle}
                  initialAddons={currentAddons}
                  onApply={(s, a, e) => { void applyStyle(s, a, e); }}
                  onClose={() => setShowWizard(false)}
                />
              )}
            </div>
          )}

          {/* enhancing */}
          {photoStep === "enhancing" && imageDataUrl && (
            <div className="flex flex-col items-center gap-5 py-12">
              <img src={imageDataUrl} alt="Elaborazione" className="h-40 w-40 rounded-xl object-cover shadow-md opacity-60" />
              <div className="flex items-center gap-3">
                <span className="inline-block h-3 w-3 animate-pulse rounded-full bg-terracotta" />
                <span className="font-medium">L'AI sta ritoccando la foto…</span>
              </div>
              <p className="text-center text-sm text-muted-foreground">Richiede circa 15 secondi</p>
            </div>
          )}

          {/* before / after compare + contextual editing */}
          {photoStep === "compare" && originalImage && imageDataUrl && restaurant?.id && (
            <div>
              <h2 className="mb-4 font-display text-xl">Prima / Dopo</h2>
              <div className="mb-5 grid grid-cols-2 gap-3">
                <div>
                  <p className="mb-1 text-center text-xs font-bold uppercase tracking-wider text-muted-foreground">Prima</p>
                  <img src={originalImage} alt="Originale" className="aspect-square w-full rounded-xl object-cover" />
                </div>
                <div>
                  <p className="mb-1 text-center text-xs font-bold uppercase tracking-wider text-terracotta">✨ Dopo</p>
                  <img src={imageDataUrl} alt="Migliorata" className="aspect-square w-full rounded-xl object-cover ring-2 ring-terracotta" />
                </div>
              </div>

              {/* contextual editing chips */}
              <div className="mb-4 rounded-xl border-2 border-dashed border-ink/30 bg-cream/40 p-3">
                <div className="mb-2 text-xs font-bold uppercase tracking-wider text-ink/70">🪄 Ritocca al volo</div>
                <EditChips
                  activeAddons={currentAddons as AddonKey[]}
                  onAdd={addAddon}
                  onRemove={removeAddon}
                  onTone={(instr) => void applyToneTweak(instr)}
                  disabled={enhancing}
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setShowWizard(true)}
                  className="flex-1 rounded-xl border-2 border-ink bg-paper py-3 text-sm font-bold hover:bg-cream-dark/30"
                >
                  🎨 Cambia stile
                </button>
                <button
                  onClick={() => { if (originalImage) { setImageDataUrl(originalImage); setOriginalImage(null); setPhotoStep("style"); } }}
                  className="rounded-xl border-2 border-ink py-3 px-3 text-sm font-bold hover:bg-cream-dark/30"
                >
                  ↺ Originale
                </button>
                <button
                  onClick={generateCaption}
                  disabled={captioning}
                  className="flex-1 rounded-xl border-2 border-ink bg-ink py-3 text-sm font-bold text-paper transition hover:bg-yellow hover:text-ink disabled:opacity-50"
                >
                  ✓ Continua →
                </button>
              </div>
              {showWizard && (
                <StyleWizard
                  restaurantId={restaurant.id}
                  initialStyle={currentStyle}
                  initialAddons={currentAddons}
                  onApply={(s, a, e) => { void applyStyle(s, a, e); }}
                  onClose={() => setShowWizard(false)}
                />
              )}
            </div>
          )}

          {/* captioning */}
          {photoStep === "captioning" && (
            <div className="flex flex-col items-center gap-5 py-12">
              {imageDataUrl && <img src={imageDataUrl} alt="Foto" className="h-40 w-40 rounded-xl object-cover shadow-md opacity-80" />}
              <div className="flex items-center gap-3">
                <span className="inline-block h-3 w-3 animate-pulse rounded-full bg-yellow" />
                <span className="font-medium">L'AI sta scrivendo la caption…</span>
              </div>
            </div>
          )}

          {/* editor */}
          {photoStep === "editor" && imageDataUrl && (
            <div className="grid gap-5 md:grid-cols-2">
              {/* Instagram preview */}
              <div className="rounded-xl border border-border bg-background p-3">
                <div className="mb-2 flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 p-[2px]">
                    <div className="h-full w-full rounded-full bg-background" />
                  </div>
                  <span className="text-sm font-semibold">@{handle}</span>
                </div>
                <img src={imageDataUrl} alt="Post" className="aspect-square w-full rounded-md object-cover" />
                <div className="mt-2 flex items-center gap-3 text-xl">
                  <span>♡</span><span>💬</span><span>↗</span>
                  <span className="ml-auto">🔖</span>
                </div>
                <p className="mt-2 line-clamp-2 text-sm">
                  <span className="font-semibold">@{handle}</span>{" "}{caption || "—"}
                </p>
                {hashtags.length > 0 && (
                  <p className="mt-1 text-sm text-blue-600 dark:text-blue-400">{hashtags.join(" ")}</p>
                )}
              </div>

              {/* Editor panel */}
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-muted-foreground">Caption</label>
                  <textarea
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    rows={4}
                    className="w-full rounded-lg border border-border bg-background p-2 text-sm"
                  />
                  <p className="mt-0.5 text-right text-[10px] text-muted-foreground">{caption.length}/150</p>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-muted-foreground">Hashtag</label>
                  <div className="flex flex-wrap gap-1.5">
                    {hashtags.map((h, i) => (
                      <button key={i} onClick={() => setHashtags((arr) => arr.filter((_, j) => j !== i))}
                        className="rounded-full bg-cream-dark/60 px-2.5 py-1 text-xs hover:bg-terracotta hover:text-paper">
                        {h} ✕
                      </button>
                    ))}
                  </div>
                </div>

                <button onClick={generateCaption} disabled={captioning}
                  className="w-full rounded-lg border border-border py-2 text-sm hover:bg-cream-dark/40 disabled:opacity-40">
                  🔄 Rigenera caption
                </button>

                <div className="border-t border-border pt-3">
                  <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-muted-foreground">Piattaforma</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(["instagram", "facebook", "both"] as const).map((p) => (
                      <button key={p} onClick={() => setPlatform(p)}
                        className={`rounded-md border px-2 py-1.5 text-xs font-medium ${
                          platform === p ? "border-terracotta bg-terracotta text-paper" : "border-border"
                        }`}>
                        {p === "instagram" ? "Instagram" : p === "facebook" ? "Facebook" : "Entrambi"}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-lg border-2 border-ink bg-cream/60 p-3">
                  <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest">⏰ Quando pubblicare</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {([
                      { k: "now",    label: "Subito" },
                      { k: "today",  label: "Oggi a…" },
                      { k: "custom", label: "Altro" },
                    ] as const).map((m) => (
                      <button key={m.k} onClick={() => setScheduleMode(m.k)}
                        className={`rounded-md border px-2 py-1.5 text-xs font-medium ${
                          scheduleMode === m.k ? "border-ink bg-ink text-paper" : "border-ink/40 bg-paper"
                        }`}>
                        {m.label}
                      </button>
                    ))}
                  </div>
                  {scheduleMode === "today" && (
                    <input type="time" value={todayTime} onChange={(e) => setTodayTime(e.target.value)}
                      className="mt-2 w-full rounded-md border border-ink bg-paper px-3 py-2 text-sm" />
                  )}
                  {scheduleMode === "custom" && (
                    <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)}
                      className="mt-2 w-full rounded-md border border-ink bg-paper px-3 py-2 text-sm" />
                  )}
                </div>

                <div className="flex gap-2 pt-1">
                  <button onClick={() => setPhotoStep("compare")}
                    className="rounded-lg border border-border px-3 py-2 text-sm">
                    ← Indietro
                  </button>
                  <button onClick={publish} disabled={publishing || !caption.trim()}
                    className="flex-1 rounded-lg bg-terracotta px-4 py-2 text-sm font-bold text-paper disabled:opacity-40">
                    {publishing ? "Pubblicazione…" : scheduleMode === "now" ? "Pubblica ora" : "Programma"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* done */}
          {photoStep === "done" && (
            <div className="relative py-10 text-center">
              <div className="mb-3 text-6xl">🎉</div>
              <p className="font-display text-2xl">Post {scheduleMode === "now" ? "pubblicato" : "programmato"}!</p>
              <p className="mt-1 text-sm text-muted-foreground">Visibile nel calendario dello storico.</p>
              {confetti && <Confetti />}
              <button onClick={resetPhoto}
                className="mt-6 rounded-xl border-2 border-ink bg-yellow px-6 py-3 font-bold uppercase tracking-wider shadow-brut transition hover:-translate-y-0.5 hover:shadow-none">
                📸 Nuovo post
              </button>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════ TAB: PIANO AI ═══════════════ */}
      {tab === "piano" && (
        <div className="rounded-2xl border-2 border-ink bg-paper p-4 shadow-brut md:p-6">

          {planStep === "questions" && (
            <div className="space-y-6">
              <div>
                <h2 className="font-display text-xl">Piano editoriale AI</h2>
                <p className="text-sm text-muted-foreground">4 domande rapide — poi l'AI genera caption, hashtag e orari ottimali.</p>
              </div>

              {/* Duration */}
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider">Durata del piano</label>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { k: "week",  label: "1 settimana", sub: "3–5 post" },
                    { k: "month", label: "1 mese",      sub: "12–20 post" },
                  ] as const).map((r) => (
                    <button key={r.k} onClick={() => setPlanRange(r.k)}
                      className={`rounded-xl border-2 p-3 text-left transition ${
                        planRange === r.k ? "border-ink bg-ink text-paper" : "border-ink/30 hover:border-ink"
                      }`}>
                      <div className="font-bold">{r.label}</div>
                      <div className="text-xs opacity-70">{r.sub}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Cuisine */}
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider">Tipo di cucina</label>
                <div className="flex flex-wrap gap-2">
                  {CUISINE_CHIPS.map((c) => (
                    <button key={c} onClick={() => toggleChip(cuisineChips, c, setCuisineChips)}
                      className={`rounded-full border-2 px-3 py-1.5 text-sm font-medium transition ${
                        cuisineChips.includes(c) ? "border-ink bg-ink text-paper" : "border-ink/30 hover:border-ink"
                      }`}>
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              {/* Goals */}
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider">Obiettivo principale</label>
                <div className="flex flex-wrap gap-2">
                  {GOAL_CHIPS.map((c) => (
                    <button key={c} onClick={() => toggleChip(goalChips, c, setGoalChips)}
                      className={`rounded-full border-2 px-3 py-1.5 text-sm font-medium transition ${
                        goalChips.includes(c) ? "border-terracotta bg-terracotta text-paper" : "border-ink/30 hover:border-ink"
                      }`}>
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              {/* Season */}
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider">Stagione / periodo speciale</label>
                <div className="flex flex-wrap gap-2">
                  {SEASON_CHIPS.map((c) => (
                    <button key={c} onClick={() => toggleChip(seasonChips, c, setSeasonChips)}
                      className={`rounded-full border-2 px-3 py-1.5 text-sm font-medium transition ${
                        seasonChips.includes(c) ? "border-yellow bg-yellow text-ink" : "border-ink/30 hover:border-ink"
                      }`}>
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              {/* Events */}
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider">
                  Piatti speciali o eventi (opzionale)
                </label>
                <textarea
                  value={events}
                  onChange={(e) => setEvents(e.target.value)}
                  rows={2}
                  placeholder="Es. Domenica sera DJ set, lancio nuovo menu pesce, anniversario del locale…"
                  className="w-full rounded-lg border border-border bg-background p-2 text-sm"
                />
              </div>

              <button onClick={generatePlan}
                className="w-full rounded-xl border-2 border-ink bg-ink py-3 font-bold uppercase tracking-wider text-paper shadow-brut transition hover:-translate-y-0.5 hover:bg-yellow hover:text-ink hover:shadow-none">
                ✨ Genera piano editoriale
              </button>
              <button onClick={addManualPost}
                className="w-full rounded-xl border-2 border-dashed border-ink py-3 text-sm font-bold hover:bg-yellow/30">
                ➕ Aggiungi idea manualmente (senza AI)
              </button>
            </div>
          )}

          {planStep === "generating" && (
            <div className="flex flex-col items-center gap-5 py-14">
              <div className="text-6xl animate-bounce">🤖</div>
              <div className="flex items-center gap-3">
                <span className="inline-block h-3 w-3 animate-pulse rounded-full bg-yellow" />
                <span className="font-medium">L'AI sta creando il tuo piano…</span>
              </div>
              <p className="text-center text-sm text-muted-foreground">Sto pensando a caption, hashtag e orari ottimali per ogni post.</p>
            </div>
          )}

          {planStep === "results" && (
            <div>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-xl">Piano generato</h2>
                  <p className="text-sm text-muted-foreground">
                    {planPosts.length} post · approva quelli che vuoi, poi li programma nel calendario.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { setPlanStep("questions"); setPlanPosts([]); }}
                    className="rounded-lg border border-border px-3 py-2 text-xs hover:bg-cream-dark/40">
                    ← Rigenera
                  </button>
                  <button onClick={saveApproved} disabled={!planPosts.some((p) => p.approved)}
                    className="rounded-lg bg-terracotta px-3 py-2 text-xs font-bold text-paper disabled:opacity-40">
                    ✓ Salva approvati ({planPosts.filter((p) => p.approved).length})
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                {planPosts.map((p, i) => (
                  <div key={i} className={`rounded-xl border-2 p-4 transition ${
                    p.approved ? "border-terracotta bg-terracotta/5" : "border-ink/20 bg-cream/30"
                  }`}>
                    <div className="mb-2 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-sm font-bold">{p.date}</span>
                          <span className="text-xs text-muted-foreground">{p.time}</span>
                          <span className="rounded-full border border-ink/20 px-2 py-0.5 text-[10px]">{p.type}</span>
                        </div>
                        <p className="mt-0.5 text-sm font-medium">{p.theme}</p>
                      </div>
                      <div className="flex shrink-0 gap-1.5">
                        <button
                          onClick={() => setPlanPosts((arr) => arr.map((pp, j) => j === i ? { ...pp, editing: !pp.editing } : pp))}
                          className="rounded-md border border-ink/30 px-2 py-1 text-[11px] hover:bg-cream-dark/40"
                          title="Modifica">
                          ✏️
                        </button>
                        <button onClick={() => regeneratePost(i)}
                          className="rounded-md border border-ink/30 px-2 py-1 text-[11px] hover:bg-cream-dark/40"
                          title="Rigenera">
                          🔄
                        </button>
                        <button onClick={() => removePlanPost(i)}
                          className="rounded-md border border-red-400 px-2 py-1 text-[11px] text-red-600 hover:bg-red-50"
                          title="Rimuovi">
                          🗑
                        </button>
                        <button
                          onClick={() => setPlanPosts((arr) => arr.map((pp, j) => j === i ? { ...pp, approved: !pp.approved } : pp))}
                          className={`rounded-md px-3 py-1 text-[11px] font-bold transition ${
                            p.approved
                              ? "bg-terracotta text-paper"
                              : "border border-terracotta text-terracotta hover:bg-terracotta hover:text-paper"
                          }`}>
                          {p.approved ? "✓ Approvato" : "Approva"}
                        </button>
                      </div>
                    </div>

                    {p.photo_idea && (
                      <p className="mb-2 rounded-lg bg-yellow/20 px-3 py-1.5 text-xs">
                        📷 <strong>Cosa fotografare:</strong> {p.photo_idea}
                      </p>
                    )}

                    {p.editing ? (
                      <div className="space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="date"
                            value={p.date}
                            onChange={(e) => setPlanPosts((arr) => arr.map((pp, j) => j === i ? { ...pp, date: e.target.value } : pp))}
                            className="rounded-lg border border-border bg-background px-2 py-1 text-xs"
                          />
                          <input
                            type="time"
                            value={p.time}
                            onChange={(e) => setPlanPosts((arr) => arr.map((pp, j) => j === i ? { ...pp, time: e.target.value } : pp))}
                            className="rounded-lg border border-border bg-background px-2 py-1 text-xs"
                          />
                        </div>
                        <input
                          value={p.theme}
                          onChange={(e) => setPlanPosts((arr) => arr.map((pp, j) => j === i ? { ...pp, theme: e.target.value } : pp))}
                          placeholder="Tema (es. Pasta fresca della casa)"
                          className="w-full rounded-lg border border-border bg-background px-2 py-1 text-xs"
                        />
                        <input
                          value={p.photo_idea}
                          onChange={(e) => setPlanPosts((arr) => arr.map((pp, j) => j === i ? { ...pp, photo_idea: e.target.value } : pp))}
                          placeholder="Cosa fotografare (opzionale)"
                          className="w-full rounded-lg border border-border bg-background px-2 py-1 text-xs"
                        />
                        <textarea
                          value={p.caption}
                          onChange={(e) => setPlanPosts((arr) => arr.map((pp, j) => j === i ? { ...pp, caption: e.target.value } : pp))}
                          rows={3}
                          placeholder="Caption del post…"
                          className="w-full rounded-lg border border-border bg-background p-2 text-sm"
                        />
                        <input
                          value={p.hashtags}
                          onChange={(e) => setPlanPosts((arr) => arr.map((pp, j) => j === i ? { ...pp, hashtags: e.target.value } : pp))}
                          className="w-full rounded-lg border border-border bg-background px-2 py-1 text-xs"
                          placeholder="Hashtag separati da spazio"
                        />
                        <button
                          onClick={() => setPlanPosts((arr) => arr.map((pp, j) => j === i ? { ...pp, editing: false } : pp))}
                          className="rounded-md border border-border px-3 py-1 text-xs hover:bg-cream-dark/40">
                          ✓ Fatto
                        </button>
                      </div>
                    ) : (
                      <div>
                        <p className="text-sm">{p.caption || <em className="text-muted-foreground">Nessuna caption — clicca ✏️ per scriverla</em>}</p>
                        <p className="mt-1 text-xs text-blue-600 dark:text-blue-400">{p.hashtags}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button onClick={addManualPost}
                  className="flex-1 rounded-xl border-2 border-dashed border-ink py-3 text-sm font-bold hover:bg-yellow/30">
                  ➕ Aggiungi idea
                </button>
                <button onClick={() => { if (confirm("Svuotare il piano corrente?")) { setPlanPosts([]); setPlanStep("questions"); } }}
                  className="rounded-xl border-2 border-red-400 px-4 py-3 text-sm font-bold text-red-600 hover:bg-red-50">
                  🗑 Svuota piano
                </button>
              </div>

              <div className="mt-3 flex gap-2">
                <button onClick={() => { setPlanStep("questions"); setPlanPosts([]); }}
                  className="flex-1 rounded-xl border-2 border-ink py-3 text-sm font-bold hover:bg-cream-dark/30">
                  ← Rigenera tutto
                </button>
                <button onClick={saveApproved} disabled={!planPosts.some((p) => p.approved && p.caption.trim())}
                  className="flex-1 rounded-xl bg-terracotta py-3 text-sm font-bold text-paper disabled:opacity-40">
                  ✓ Salva {planPosts.filter((p) => p.approved && p.caption.trim()).length} post
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════ TAB: STORICO ═══════════════ */}
      {tab === "storico" && (
        <div className="space-y-5">
          <section className="rounded-2xl border-2 border-ink bg-paper p-4 shadow-brut md:p-5">
            <h2 className="mb-3 font-display text-xl uppercase">📅 Calendario</h2>
            <CalendarGrid
              posts={posts}
              monthOffset={monthOffset}
              onChangeMonth={(d) => setMonthOffset((m) => m + d)}
              onPick={(p) => {
                toast(p.caption || "Post", {
                  description: p.scheduled_at
                    ? `Programmato: ${new Date(p.scheduled_at).toLocaleString("it-IT")}`
                    : `Pubblicato: ${new Date(p.created_at).toLocaleString("it-IT")}`,
                });
              }}
            />
          </section>

          {posts.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card px-3 py-2">
              <span className="text-xs text-muted-foreground">
                {posts.length} post · {posts.filter((p) => p.status === "scheduled").length} programmati
              </span>
              <div className="flex gap-2">
                <button onClick={clearScheduled}
                  className="rounded-md border border-red-400 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50">
                  🗑 Cancella programmati
                </button>
                <button onClick={clearHistory}
                  className="rounded-md border-2 border-red-500 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-100">
                  🗑 Svuota tutto
                </button>
              </div>
            </div>
          )}

          <ul className="space-y-3">
            {posts.map((p) => (
              <li key={p.id} className="flex gap-3 rounded-xl border border-border bg-card p-3">
                {p.image_url ? (
                  <img src={p.image_url} alt="" className="h-16 w-16 shrink-0 rounded-lg object-cover md:h-20 md:w-20" />
                ) : (
                  <div className="grid h-16 w-16 shrink-0 place-items-center rounded-lg bg-yellow/40 text-xl md:h-20 md:w-20">📝</div>
                )}
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {p.platform} · {p.status}
                    {p.scheduled_at && ` · ${new Date(p.scheduled_at).toLocaleDateString("it-IT")}`}
                  </span>
                  <p className="mt-0.5 line-clamp-2 text-sm">{p.caption}</p>
                  <p className="mt-1 line-clamp-1 text-xs text-terracotta">{p.hashtags}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {igStatus?.connected && p.image_url && p.status !== "published" && p.platform.includes("instagram") && (
                    <button
                      onClick={() => publishIgNow(p.id)}
                      disabled={igPublishing === p.id}
                      className="rounded-md border-2 border-ink bg-yellow px-2 py-1 text-[11px] font-bold uppercase shadow-brut hover:translate-y-[1px] hover:shadow-none disabled:opacity-50"
                      title="Pubblica ora su Instagram"
                    >
                      {igPublishing === p.id ? "..." : "📸 IG"}
                    </button>
                  )}
                  <button
                    onClick={() => deletePost(p.id)}
                    className="rounded-md border border-red-300 px-2 py-1 text-[11px] text-red-600 opacity-70 transition hover:opacity-100 hover:bg-red-50"
                    title="Elimina post">
                    🗑
                  </button>
                </div>
              </li>
            ))}
            {posts.length === 0 && (
              <li className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground md:p-8">
                Nessun post ancora. Pubblica la tua prima foto dalla tab 📸.
              </li>
            )}
          </ul>
        </div>
      )}
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
          <span key={i} className="absolute top-0 h-2 w-2 rounded-sm"
            style={{ left: `${left}%`, backgroundColor: bg, animation: `confetti-fall ${duration}s ${delay}s ease-out forwards` }} />
        );
      })}
      <style>{`@keyframes confetti-fall { 0% { transform: translateY(-10px) rotate(0deg); opacity: 1; } 100% { transform: translateY(120px) rotate(360deg); opacity: 0; } }`}</style>
    </div>
  );
}
