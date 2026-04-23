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
