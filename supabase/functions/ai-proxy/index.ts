// AI gateway — Google Gemini direct (preferred) or Lovable gateway (fallback).
// Set GEMINI_API_KEY in Supabase secrets (Google AI Studio) for direct Gemini access.
// Falls back to LOVABLE_API_KEY if GEMINI_API_KEY is absent.

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info",
};

// Map Lovable/OpenRouter model names → Google AI Studio model names
const MODEL_MAP: Record<string, string> = {
  "google/gemini-3-flash-preview": "gemini-2.0-flash",
  "google/gemini-2.5-pro": "gemini-2.5-pro",
  "google/gemini-2.5-flash-image": "gemini-2.0-flash-preview-image-generation",
};

function mapModel(m: string): string {
  return MODEL_MAP[m] ?? m.replace(/^google\//, "");
}

/** Text and vision via Google's OpenAI-compatible endpoint */
async function geminiText(key: string, model: string, body: Record<string, unknown>): Promise<Response> {
  return fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ ...body, model }),
  });
}

/** Image generation via native Gemini generateContent API.
 *  Normalizes the response to match the Lovable-compatible format expected by the client. */
async function geminiImage(key: string, model: string, messages: any[]): Promise<Response> {
  const userMsg = messages.find((m: any) => m.role === "user");
  const parts: any[] = [];

  if (Array.isArray(userMsg?.content)) {
    for (const p of userMsg.content) {
      if (p.type === "text") {
        parts.push({ text: p.text });
      } else if (p.type === "image_url") {
        const url: string = p.image_url?.url ?? "";
        if (url.startsWith("data:")) {
          const [header, data] = url.split(",");
          const mime = header.replace("data:", "").replace(";base64", "");
          parts.push({ inline_data: { mime_type: mime, data } });
        }
      }
    }
  } else if (typeof userMsg?.content === "string") {
    parts.push({ text: userMsg.content });
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: { responseModalities: ["Text", "Image"] },
      }),
    }
  );

  if (!res.ok) {
    const t = await res.text();
    return new Response(t, { status: res.status, headers: { "Content-Type": "application/json" } });
  }

  const j = await res.json();
  const rParts: any[] = j.candidates?.[0]?.content?.parts ?? [];
  let text = "";
  let imageUrl = "";
  for (const p of rParts) {
    if (p.text) text += p.text;
    if (p.inline_data) {
      const mime = p.inline_data.mime_type ?? "image/png";
      imageUrl = `data:${mime};base64,${p.inline_data.data}`;
    }
  }

  return new Response(
    JSON.stringify({
      choices: [{
        message: {
          role: "assistant",
          content: text,
          ...(imageUrl ? { images: [{ image_url: { url: imageUrl } }] } : {}),
        },
      }],
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  let payload: { path?: string; body?: any };
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), {
      status: 400, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const path = payload.path || "/v1/chat/completions";
  if (!path.startsWith("/v1/")) {
    return new Response(JSON.stringify({ error: "invalid_path" }), {
      status: 400, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const body = (payload.body ?? {}) as Record<string, any>;
  const geminiKey = Deno.env.get("GEMINI_API_KEY");
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");

  let upstream: Response;

  if (geminiKey) {
    const model = mapModel(body.model ?? "gemini-2.0-flash");
    if (model.includes("image-generation")) {
      upstream = await geminiImage(geminiKey, model, body.messages ?? []);
    } else {
      upstream = await geminiText(geminiKey, model, body);
    }
  } else if (lovableKey) {
    upstream = await fetch(`https://ai.gateway.lovable.dev${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${lovableKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } else {
    return new Response(JSON.stringify({ error: "missing_api_key" }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const text = await upstream.text();
  return new Response(text, {
    status: upstream.status,
    headers: { ...cors, "Content-Type": upstream.headers.get("content-type") ?? "application/json" },
  });
});
