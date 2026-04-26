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
  .inputValidator((input: { imageBase64: string; mimeType: string; style?: string; addons?: string[]; extraInstructions?: string }) => input)
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    // STILE VISIVO (uno solo) — descrive luce, colori, sfondo, mood. NON aggiunge oggetti/persone.
    const STYLES: Record<string, string> = {
      auto: "Professional food photography enhancement: improve lighting, sharpness, color balance and appetizing look. Keep the dish authentic and recognizable. Realistic.",
      bright: "Bright vibrant lighting, natural warm sunlight feel like from a window. Boost colors slightly. Subtle realistic enhancement.",
      moody: "Moody warm restaurant lighting, deeper shadows, cinematic intimate atmosphere like a candlelit trattoria.",
      clean: "Clean white seamless background, professional studio food photography lighting, minimal and elegant.",
      pro_magazine: "Professional FOOD MAGAZINE look: cinematic depth of field with creamy bokeh, perfectly balanced soft warm lighting, crisp focus on the dish, vibrant appetizing colors, Michelin-photographer styling.",
      minimal: "Minimal Scandinavian editorial style: lots of negative space, neutral beige/off-white surface, soft diffused daylight from one side, muted natural tones.",
      elegant: "High-end fine dining look: dark elegant surface (slate or wood), dramatic single light source, deep rich shadows, gold/amber highlights, luxury restaurant mood.",
      bistrot: "Authentic Italian bistrot vibe: rustic wooden surface tone, warm golden hour light, lived-in cosy atmosphere — atmosphere only, no added props.",
      rustic: "Warm rustic farm-to-table tone: aged wooden surface feel, warm earthy color palette, slightly textured background.",
      overhead: "Top-down flat lay framing: perfectly overhead 90° angle, symmetrical composition, soft even shadows.",
      pop: "Bold modern pop-food editorial: clean colored background (warm terracotta or mustard yellow), high contrast, vivid saturated colors, playful contemporary vibe.",
      vintage: "Vintage 70s Italian cookbook aesthetic: warm faded film tones, slight grain, soft matte highlights, nostalgic colors (mustard, ochre, olive, brick), analog film look.",
      noir: "Dark moody chef-table look: nearly black background, single rim light from behind, deep contrast, dramatic shadows, refined and intense.",
    };

    // ADDONS / CONTESTO (multi) — aggiungono OGGETTI o PERSONE attorno al piatto.
    const ADDONS: Record<string, string> = {
      hands: "Add natural human hands gently interacting with the dish (pouring sauce, sprinkling herbs, or holding a fork from above) — hyperrealistic, casual, slightly out of focus. Dish stays the sharp hero.",
      context: "Add tasteful restaurant context around the plate: a glass of wine, fresh bread, cutlery on a linen napkin, soft blurred background with warm bokeh. Dish stays sharp.",
      eating: "Add a person subtly eating or about to eat the dish — only mouth/hand area visible, hyperrealistic, lifestyle feel. Dish remains the focus.",
      props: "Add a few tasteful styling props nearby: linen napkin, small herbs, olive oil drops, raw ingredient hints. Keep composition clean.",
      steam: "Add a subtle wisp of natural steam rising from the dish (only if it would be a hot dish), hyperrealistic.",
      drink: "Add a softly out-of-focus glass of wine or drink in the background corner. Dish stays sharp and centered.",
    };

    const styleKey = data.style || "auto";
    const stylePrompt = STYLES[styleKey] || STYLES.auto;
    const addonKeys = (data.addons || []).filter((k) => ADDONS[k]);
    const addonBlocks = addonKeys.map((k) => ADDONS[k]).join(" ");
    const hasAddons = addonKeys.length > 0;

    const dishLock = hasAddons
      ? "CRITICAL: The DISH itself, its ingredients, toppings and plate MUST stay 100% identical and recognizable. You may only add the surrounding elements described above. No other additions. Output the enhanced image."
      : "CRITICAL: Do NOT add any new objects, hands, people, props, drinks or food around the dish. Do NOT change the dish itself, the ingredients, the toppings, the plate or the composition. Only adjust lighting, color, sharpness and background mood. Output the enhanced image.";

    const extra = (data.extraInstructions || "").trim().slice(0, 280);
    const extraBlock = extra ? ` ADDITIONAL USER REQUEST (apply gently, never break the dish): ${extra}.` : "";
    const prompt = `STYLE: ${stylePrompt}${hasAddons ? ` CONTEXT TO ADD: ${addonBlocks}` : ""} ${dishLock}${extraBlock}`;

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
  .inputValidator((input: { range: "week" | "month"; restaurantName: string; bio: string; tone: string; startDateISO: string; context?: string }) => input)
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    const days = data.range === "week" ? 7 : 30;
    const contextBlock = data.context ? `\nDettagli dal proprietario: ${data.context}` : "";
    const prompt = `Sei il social media manager di ${data.restaurantName}.
Bio: ${data.bio}
Tono: ${data.tone}${contextBlock}

Genera un PIANO EDITORIALE Instagram per ${days} giorni a partire da ${data.startDateISO}.
Mix variato (NON sempre piatto del giorno): piatto signature, dietro le quinte/cucina, ingrediente di stagione, storia/aneddoto, team/persona, ambiente sala, recensione cliente, citazione, evento weekend, behind-the-scenes.
Frequenza: 3-5 post a settimana, mai due giorni di fila uguali.
Orari ottimali: pranzo 12:30, aperitivo 18:30, sera 20:30.
Tipi di contenuto disponibili: "Foto piatto", "Video cucina", "Storia staff", "Dietro le quinte", "Promozione", "Ingrediente", "Ambiente".

Per ogni post: data (YYYY-MM-DD), ora (HH:MM), tema breve, type (uno dei tipi sopra), photo_idea (cosa fotografare), caption (max 140 char, autentica, in italiano), hashtags (8 hashtag separati da spazio).

Rispondi SOLO con JSON valido:
{"posts":[{"date":"2026-04-25","time":"20:30","theme":"...","type":"Foto piatto","photo_idea":"...","caption":"...","hashtags":"#a #b ..."}]}`;

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
Per ogni piatto fornisci:
- name (string)
- description (string, vuota se assente)
- price (numero in euro, null se non visibile)
- category (es. Antipasti, Primi, Secondi, Pizze, Dolci, Bevande, Vini, Contorni)
- allergen_tags: array di chiavi tra: ["gluten","crustaceans","eggs","fish","peanuts","soy","milk","nuts","celery","mustard","sesame","sulphites","lupin","molluscs"] — DEDUCI dagli ingredienti tipici del piatto (es. carbonara: gluten, eggs, milk)
- diet_tags: array di chiavi tra: ["vegetarian","vegan","gluten_free","lactose_free","spicy"] — assegna SOLO se evidente dal nome/descrizione
Mantieni l'ordine originale.
Rispondi SOLO con JSON valido, senza markdown:
{"items":[{"name":"...","description":"...","price":12.5,"category":"Primi","allergen_tags":["gluten","eggs"],"diet_tags":["vegetarian"]}]}`;

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
