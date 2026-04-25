import { createServerFn } from "@tanstack/react-start";

type Msg = { role: "system" | "user" | "assistant"; content: string };

export const callAI = createServerFn({ method: "POST" })
  .inputValidator((input: { messages: Msg[]; model?: string; json?: boolean }) => input)
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    const body: Record<string, unknown> = {
      model: data.model || "google/gemini-3-flash-preview",
      messages: data.messages,
    };
    if (data.json) body.response_format = { type: "json_object" };

    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (r.status === 429) return { content: "", error: "rate_limit" as const };
    if (r.status === 402) return { content: "", error: "credits" as const };
    if (!r.ok) {
      const t = await r.text();
      console.error("AI gateway error", r.status, t);
      return { content: "", error: "unknown" as const };
    }
    const j = await r.json();
    const content = j.choices?.[0]?.message?.content ?? "";
    return { content, error: null as null | "rate_limit" | "credits" | "unknown" };
  });

export const callAIVision = createServerFn({ method: "POST" })
  .inputValidator((input: { imageBase64: string; mimeType: string; prompt: string }) => input)
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: data.prompt },
              { type: "image_url", image_url: { url: `data:${data.mimeType};base64,${data.imageBase64}` } },
            ],
          },
        ],
      }),
    });
    if (r.status === 429) return { content: "", error: "rate_limit" as const };
    if (r.status === 402) return { content: "", error: "credits" as const };
    if (!r.ok) {
      const t = await r.text();
      console.error("AI vision error", r.status, t);
      return { content: "", error: "unknown" as const };
    }
    const j = await r.json();
    const content = j.choices?.[0]?.message?.content ?? "";
    return { content, error: null as null | "rate_limit" | "credits" | "unknown" };
  });

export const enhanceImage = createServerFn({ method: "POST" })
  .inputValidator((input: { imageBase64: string; mimeType: string; style?: string; extraInstructions?: string }) => input)
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    const STYLES: Record<string, string> = {
      // Naturali (realistici)
      auto: "Professional food photography enhancement: improve lighting, sharpness, color balance and appetizing look. Keep the dish authentic and recognizable. Realistic, no added elements.",
      bright: "Make it brighter, more vibrant, with natural warm lighting like sunlight from a window. Boost colors slightly. Subtle realistic enhancement only.",
      moody: "Add moody warm restaurant lighting, deeper shadows, cinematic and intimate atmosphere like a candlelit trattoria. Realistic, no added elements.",
      clean: "Clean white background, professional studio food photography lighting, minimal and elegant. Realistic only.",
      // Stilizzati (food magazine quality)
      pro_magazine: "Transform into a professional FOOD MAGAZINE photo: cinematic depth of field with creamy bokeh background, perfectly balanced soft warm lighting, crisp focus on the dish, vibrant appetizing colors, subtle steam if hot food, tiny natural garnish details (drops, herbs, crumbs) styled like a Michelin photographer, social-media ready composition.",
      minimal: "Minimal Scandinavian editorial style: lots of negative space, neutral beige/off-white surface, soft diffused daylight from one side, perfectly clean composition, muted natural tones, single subject hero. Refined and quiet.",
      elegant: "High-end fine dining photograph: dark elegant surface (slate or wood), dramatic single light source, deep rich shadows, gold/amber highlights on the dish, luxury restaurant mood, slight overhead 3/4 angle.",
      bistrot: "Authentic Italian bistrot vibe: rustic wooden table, checkered linen napkin or aged ceramic, warm golden hour light from a side window, glass of wine softly out of focus in background, lived-in cosy atmosphere.",
      rustic: "Warm rustic farm-to-table style: aged wooden cutting board, raw natural ingredients scattered around (herbs, garlic, olive oil drips), terracotta plate, warm earthy tones, slightly textured background.",
      hands: "Add natural human hands gently interacting with the dish (pouring sauce from above, sprinkling herbs, holding a fork) — hands must look real, casual, hyperrealistic, slightly out of focus. The dish stays the hero, sharp and centered.",
      context: "Add tasteful restaurant context around the plate: a glass of red wine, fresh bread, cutlery on linen napkin, soft blurred trattoria background with warm bokeh lights. The main dish stays sharply in focus.",
      overhead: "Top-down flat lay food photography: perfectly overhead 90° angle, symmetrical composition, complementary props (bread, wine, herbs) arranged geometrically around the dish, soft even shadows, instagram-ready square framing.",
      pop: "Bold modern pop-food editorial: clean colored background (warm terracotta or mustard yellow), high contrast, vivid saturated colors, slight tilt-shift, playful composition, contemporary cool restaurant brand vibe.",
      vintage: "Vintage 70s Italian cookbook aesthetic: warm faded film tones, slight grain, soft matte highlights, nostalgic colors (mustard, ochre, olive, brick), checkered tablecloth optional, analog film look.",
      noir: "Dark moody chef-table style: nearly black background, single rim light from behind making steam glow, deep contrast, dramatic shadows, single highlight on the dish, refined and intense.",
    };
    const stylePrompt = STYLES[data.style || "auto"] || STYLES.auto;

    const allowsAddons = ["hands", "context", "overhead", "pop", "rustic", "bistrot"].includes(data.style || "");
    const dishLock = allowsAddons
      ? "CRITICAL: The DISH itself, the ingredients, the toppings and the plate MUST stay 100% identical and recognizable. You may only add tasteful surrounding props/styling/light as described above. Output the enhanced image."
      : "CRITICAL: Do NOT change the dish itself, the ingredients, the toppings, the plate or the composition. Only enhance photo quality and ambient styling. Output the enhanced image.";
    const extra = (data.extraInstructions || "").trim().slice(0, 280);
    const extraBlock = extra ? ` ADDITIONAL USER REQUEST (apply gently, never break the dish): ${extra}.` : "";
    const prompt = `${stylePrompt} ${dishLock}${extraBlock}`;

    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: `data:${data.mimeType};base64,${data.imageBase64}` } },
            ],
          },
        ],
        modalities: ["image", "text"],
      }),
    });
    if (r.status === 429) return { imageUrl: "", error: "rate_limit" as const };
    if (r.status === 402) return { imageUrl: "", error: "credits" as const };
    if (!r.ok) {
      const t = await r.text();
      console.error("Image enhance error", r.status, t);
      return { imageUrl: "", error: "unknown" as const };
    }
    const j = await r.json();
    const imageUrl: string = j.choices?.[0]?.message?.images?.[0]?.image_url?.url ?? "";
    if (!imageUrl) return { imageUrl: "", error: "unknown" as const };
    return { imageUrl, error: null as null | "rate_limit" | "credits" | "unknown" };
  });

export const planSocialCalendar = createServerFn({ method: "POST" })
  .inputValidator((input: { range: "week" | "month"; restaurantName: string; bio: string; tone: string; startDateISO: string }) => input)
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    const days = data.range === "week" ? 7 : 30;
    const prompt = `Sei il social media manager di ${data.restaurantName}.
Bio: ${data.bio}
Tono: ${data.tone}

Genera un PIANO EDITORIALE Instagram per ${days} giorni a partire da ${data.startDateISO}.
Mix variato (NON sempre piatto del giorno): piatto signature, dietro le quinte/cucina, ingrediente di stagione, storia/aneddoto, team/persona, ambiente sala, recensione cliente, citazione, evento weekend, behind-the-scenes pizzaiolo.
Frequenza tipica: 3-5 post a settimana, mai due giorni di fila uguali, evita lunedì se chiuso.
Orari ottimali: pranzo 12:30, aperitivo 18:30, sera 20:30.

Per ogni post fornisci: data (YYYY-MM-DD), ora (HH:MM), tema breve, idea_foto (cosa fotografare), caption (max 140 char, autentica), hashtags (8 hashtag separati da spazio).

Rispondi SOLO con JSON valido:
{"posts":[{"date":"2026-04-25","time":"20:30","theme":"...","photo_idea":"...","caption":"...","hashtags":"#a #b ..."}]}`;

    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      }),
    });
    if (r.status === 429) return { posts: [], error: "rate_limit" as const };
    if (r.status === 402) return { posts: [], error: "credits" as const };
    if (!r.ok) {
      const t = await r.text();
      console.error("planSocialCalendar error", r.status, t);
      return { posts: [], error: "unknown" as const };
    }
    const j = await r.json();
    const content = j.choices?.[0]?.message?.content ?? "{}";
    try {
      const parsed = JSON.parse(content);
      const posts = Array.isArray(parsed.posts) ? parsed.posts : [];
      return { posts, error: null as null | "rate_limit" | "credits" | "unknown" };
    } catch {
      return { posts: [], error: "unknown" as const };
    }
  });

export const extractMenuFromImage = createServerFn({ method: "POST" })
  .inputValidator((input: { imageBase64: string; mimeType: string }) => input)
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    const prompt = `Analizza questa foto di un menu di ristorante italiano ed estrai TUTTI i piatti visibili.
Per ogni piatto fornisci: nome, descrizione (se presente, altrimenti stringa vuota), prezzo in euro come numero (null se non visibile), categoria (es. Antipasti, Primi, Secondi, Pizze, Dolci, Bevande, Vini, Contorni — usa quella che vedi sul menu o deduci dal contesto).
Mantieni l'ordine originale e raggruppa per categoria.
Rispondi SOLO con JSON valido, senza markdown:
{"items":[{"name":"...","description":"...","price":12.5,"category":"Primi"}]}`;

    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [{
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: `data:${data.mimeType};base64,${data.imageBase64}` } },
          ],
        }],
        response_format: { type: "json_object" },
      }),
    });
    if (r.status === 429) return { items: [], error: "rate_limit" as const };
    if (r.status === 402) return { items: [], error: "credits" as const };
    if (!r.ok) {
      const t = await r.text();
      console.error("extractMenuFromImage error", r.status, t);
      return { items: [], error: "unknown" as const };
    }
    const j = await r.json();
    const content = j.choices?.[0]?.message?.content ?? "{}";
    try {
      const parsed = JSON.parse(content);
      const items = Array.isArray(parsed.items) ? parsed.items : [];
      return { items, error: null as null | "rate_limit" | "credits" | "unknown" };
    } catch {
      return { items: [], error: "unknown" as const };
    }
  });
