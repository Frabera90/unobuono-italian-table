// Server functions for Instagram Graph API integration.
// Handles: connection status, starting OAuth, disconnect, publishing posts.

import { createServerFn } from "@tanstack/react-start";
import { setCookie } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const FB_GRAPH = "https://graph.facebook.com/v21.0";

function getRedirectUri(origin: string) {
  return `${origin}/api/public/instagram/callback`;
}

/** Returns IG connection info for the current user's restaurant (no token). */
export const getInstagramStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: rest } = await supabase
      .from("restaurants")
      .select("id")
      .eq("owner_id", userId)
      .maybeSingle();
    if (!rest) return { connected: false as const };

    const { data: conn } = await supabaseAdmin
      .from("instagram_connections")
      .select("ig_username, fb_page_name, ig_user_id, token_expires_at, updated_at")
      .eq("restaurant_id", rest.id)
      .maybeSingle();

    if (!conn) return { connected: false as const };
    return {
      connected: true as const,
      ig_username: conn.ig_username,
      fb_page_name: conn.fb_page_name,
      token_expires_at: conn.token_expires_at,
    };
  });

/** Builds the Meta OAuth URL and sets a state cookie tied to the restaurant. */
export const startInstagramOAuth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { origin: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const APP_ID = process.env.META_APP_ID;
    if (!APP_ID) return { error: "META_APP_ID non configurato" as const };

    const { data: rest } = await supabase
      .from("restaurants")
      .select("id")
      .eq("owner_id", userId)
      .maybeSingle();
    if (!rest) return { error: "Ristorante non trovato" as const };

    const state = `${rest.id}.${crypto.randomUUID()}`;
    setCookie("ig_oauth_state", state, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 600,
      path: "/",
    });

    const redirectUri = getRedirectUri(data.origin);
    const scopes = [
      "instagram_basic",
      "instagram_content_publish",
      "pages_show_list",
      "pages_read_engagement",
      "business_management",
    ].join(",");

    const url =
      `https://www.facebook.com/v21.0/dialog/oauth` +
      `?client_id=${encodeURIComponent(APP_ID)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&state=${encodeURIComponent(state)}` +
      `&scope=${encodeURIComponent(scopes)}` +
      `&response_type=code`;

    return { url };
  });

/** Removes the IG connection for the current user's restaurant. */
export const disconnectInstagram = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: rest } = await supabase
      .from("restaurants")
      .select("id")
      .eq("owner_id", userId)
      .maybeSingle();
    if (!rest) return { ok: false as const };
    await supabaseAdmin.from("instagram_connections").delete().eq("restaurant_id", rest.id);
    return { ok: true as const };
  });

/** Publishes an image+caption to Instagram for the current user's restaurant. */
export const publishToInstagram = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { postId: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: rest } = await supabase
      .from("restaurants")
      .select("id")
      .eq("owner_id", userId)
      .maybeSingle();
    if (!rest) return { ok: false as const, error: "Ristorante non trovato" };

    const { data: post } = await supabase
      .from("social_posts")
      .select("*")
      .eq("id", data.postId)
      .eq("restaurant_id", rest.id)
      .maybeSingle();
    if (!post) return { ok: false as const, error: "Post non trovato" };
    if (!post.image_url) return { ok: false as const, error: "Manca l'immagine" };
    if (post.image_url.startsWith("data:"))
      return {
        ok: false as const,
        error: "L'immagine deve essere un URL pubblico (https). Salva prima la foto su un hosting o carica un'immagine diversa.",
      };

    const { data: conn } = await supabaseAdmin
      .from("instagram_connections")
      .select("ig_user_id, access_token")
      .eq("restaurant_id", rest.id)
      .maybeSingle();
    if (!conn) return { ok: false as const, error: "Instagram non collegato" };

    const captionFull = [post.caption || "", post.hashtags || ""].filter(Boolean).join("\n\n");

    // 1) Create media container
    const createRes = await fetch(`${FB_GRAPH}/${conn.ig_user_id}/media`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image_url: post.image_url,
        caption: captionFull,
        access_token: conn.access_token,
      }),
    });
    const createJson = (await createRes.json()) as { id?: string; error?: { message?: string } };
    if (!createRes.ok || !createJson.id) {
      return { ok: false as const, error: createJson.error?.message || "Errore creazione media IG" };
    }

    // 2) Publish container
    const pubRes = await fetch(`${FB_GRAPH}/${conn.ig_user_id}/media_publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        creation_id: createJson.id,
        access_token: conn.access_token,
      }),
    });
    const pubJson = (await pubRes.json()) as { id?: string; error?: { message?: string } };
    if (!pubRes.ok || !pubJson.id) {
      return { ok: false as const, error: pubJson.error?.message || "Errore pubblicazione IG" };
    }

    await supabaseAdmin
      .from("social_posts")
      .update({ status: "published", scheduled_at: null })
      .eq("id", post.id);

    return { ok: true as const, ig_media_id: pubJson.id };
  });
