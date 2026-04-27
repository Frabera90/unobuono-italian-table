// OAuth callback for Meta/Instagram.
// Exchanges the code for a long-lived token, finds the IG Business account
// linked to one of the user's Pages, and saves the connection.

import { createFileRoute } from "@tanstack/react-router";
import { getCookie, deleteCookie } from "@tanstack/react-start/server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const FB_GRAPH = "https://graph.facebook.com/v21.0";

function htmlPage(title: string, body: string) {
  return new Response(
    `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
<style>body{font-family:system-ui,sans-serif;max-width:560px;margin:60px auto;padding:24px;line-height:1.5;color:#222}h1{margin-top:0}a{color:#c4592a}</style>
</head><body>${body}<p><a href="/owner/social">Torna a Social</a></p></body></html>`,
    { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

export const Route = createFileRoute("/api/public/instagram/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const errorDesc = url.searchParams.get("error_description");

        if (errorDesc) {
          return htmlPage("Errore", `<h1>❌ Autorizzazione annullata</h1><p>${errorDesc}</p>`);
        }
        if (!code || !state) {
          return htmlPage("Errore", `<h1>❌ Parametri mancanti</h1>`);
        }

        const cookieState = getCookie("ig_oauth_state");
        if (!cookieState || cookieState !== state) {
          return htmlPage("Errore", `<h1>❌ State non valido</h1><p>Riprova dalla pagina Social.</p>`);
        }
        deleteCookie("ig_oauth_state", { path: "/" });

        const restaurantId = state.split(".")[0];
        const APP_ID = process.env.META_APP_ID;
        const APP_SECRET = process.env.META_APP_SECRET;
        if (!APP_ID || !APP_SECRET) {
          return htmlPage("Errore", `<h1>❌ Configurazione mancante</h1>`);
        }

        const redirectUri = `${url.origin}/api/public/instagram/callback`;

        // 1) Exchange code → short-lived token
        const tokRes = await fetch(
          `${FB_GRAPH}/oauth/access_token?client_id=${APP_ID}&client_secret=${APP_SECRET}` +
            `&redirect_uri=${encodeURIComponent(redirectUri)}&code=${encodeURIComponent(code)}`
        );
        const tokJson = (await tokRes.json()) as { access_token?: string; error?: { message?: string } };
        if (!tokRes.ok || !tokJson.access_token) {
          return htmlPage("Errore", `<h1>❌ Token error</h1><p>${tokJson.error?.message || ""}</p>`);
        }

        // 2) Upgrade to long-lived token (~60 giorni)
        const llRes = await fetch(
          `${FB_GRAPH}/oauth/access_token?grant_type=fb_exchange_token` +
            `&client_id=${APP_ID}&client_secret=${APP_SECRET}` +
            `&fb_exchange_token=${tokJson.access_token}`
        );
        const llJson = (await llRes.json()) as {
          access_token?: string;
          expires_in?: number;
          error?: { message?: string };
        };
        const userToken = llJson.access_token || tokJson.access_token;
        const expiresAt = llJson.expires_in
          ? new Date(Date.now() + llJson.expires_in * 1000).toISOString()
          : null;

        // 3) Find the user's pages
        const pagesRes = await fetch(
          `${FB_GRAPH}/me/accounts?fields=id,name,access_token,instagram_business_account&access_token=${userToken}`
        );
        const pagesJson = (await pagesRes.json()) as {
          data?: Array<{
            id: string;
            name: string;
            access_token: string;
            instagram_business_account?: { id: string };
          }>;
          error?: { message?: string };
        };
        if (!pagesRes.ok || !pagesJson.data) {
          return htmlPage("Errore", `<h1>❌ Errore Pagine</h1><p>${pagesJson.error?.message || ""}</p>`);
        }

        const pageWithIG = pagesJson.data.find((p) => p.instagram_business_account?.id);
        if (!pageWithIG) {
          return htmlPage(
            "Account Instagram non trovato",
            `<h1>⚠️ Nessun account Instagram Business collegato</h1>
             <p>Devi:</p>
             <ol>
               <li>Convertire il tuo Instagram a <b>Business</b> dall'app IG</li>
               <li>Collegarlo a una <b>Pagina Facebook</b> di cui sei admin</li>
               <li>Riprovare il collegamento</li>
             </ol>`
          );
        }

        const igUserId = pageWithIG.instagram_business_account!.id;
        const pageToken = pageWithIG.access_token;

        // 4) Get IG username
        const igRes = await fetch(`${FB_GRAPH}/${igUserId}?fields=username&access_token=${pageToken}`);
        const igJson = (await igRes.json()) as { username?: string };

        // 5) Save connection
        const { error: upErr } = await supabaseAdmin.from("instagram_connections").upsert(
          {
            restaurant_id: restaurantId,
            ig_user_id: igUserId,
            ig_username: igJson.username || null,
            fb_page_id: pageWithIG.id,
            fb_page_name: pageWithIG.name,
            access_token: pageToken,
            token_expires_at: expiresAt,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "restaurant_id" }
        );
        if (upErr) {
          return htmlPage("Errore", `<h1>❌ DB error</h1><p>${upErr.message}</p>`);
        }

        return htmlPage(
          "Collegato!",
          `<h1>✅ Instagram collegato</h1>
           <p>Account: <b>@${igJson.username || "(?)"}</b></p>
           <p>Pagina FB: <b>${pageWithIG.name}</b></p>`
        );
      },
    },
  },
});
