import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getSettingsBySlug, type RestaurantSettings, type MenuItem, type Restaurant } from "@/lib/restaurant";

export const Route = createFileRoute("/r/$slug")({
  head: ({ loaderData }) => {
    const s = loaderData as { settings: RestaurantSettings | null; restaurant: Restaurant | null } | undefined;
    const name = s?.settings?.name || s?.restaurant?.name || "Ristorante";
    const desc = s?.settings?.bio || "Prenota un tavolo, sfoglia il menu, scopri il ristorante.";
    const img = s?.settings?.cover_photo_url || s?.settings?.logo_url || undefined;
    return {
      meta: [
        { title: `${name} — Prenota & Menu` },
        { name: "description", content: desc },
        { property: "og:title", content: name },
        { property: "og:description", content: desc },
        ...(img ? [{ property: "og:image", content: img }, { name: "twitter:image", content: img }] : []),
      ],
    };
  },
  loader: async ({ params }) => {
    const r = await getSettingsBySlug(params.slug);
    return { settings: r?.settings ?? null, restaurant: r?.restaurant ?? null };
  },
  component: PublicPage,
});


function PublicPage() {
  const data = Route.useLoaderData() as { settings: RestaurantSettings | null; restaurant: Restaurant | null };
  const { settings, restaurant } = data;
  const [menu, setMenu] = useState<MenuItem[]>([]);

  useEffect(() => {
    if (!restaurant) return;
    void (async () => {
      const m = await supabase.from("menu_items").select("*").eq("restaurant_id", restaurant.id).eq("available", true).order("sort_order");
      setMenu((m.data || []) as MenuItem[]);
    })();
  }, [restaurant]);

  const byCategory = useMemo(() => {
    const m = new Map<string, MenuItem[]>();
    for (const it of menu) {
      const k = it.category || "Altro";
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(it);
    }
    return Array.from(m.entries());
  }, [menu]);

  if (!restaurant) {
    return <div className="grid min-h-screen place-items-center bg-cream px-5 text-center"><div><h1 className="font-display text-3xl">Ristorante non trovato</h1><Link to="/" className="mt-4 inline-block underline">Torna alla home</Link></div></div>;
  }

  const cover = settings?.cover_photo_url;
  const bookId = restaurant.id;

  return (
    <div className="min-h-screen bg-cream text-ink">
      {/* Hero */}
      <header className="relative overflow-hidden border-b-2 border-ink">
        {cover && (
          <div className="absolute inset-0">
            <img src={cover} alt="" className="h-full w-full object-cover opacity-30" />
          </div>
        )}
        <div className="relative mx-auto max-w-4xl px-5 py-16 text-center">
          {settings?.logo_url && (
            <img src={settings.logo_url} alt={settings.name} className="mx-auto mb-4 h-16 w-16 rounded-full border-2 border-ink object-cover" />
          )}
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-ink/60">{settings?.address?.split(",").pop()?.trim() || "Italia"}</p>
          <h1 className="mt-2 font-display text-5xl uppercase tracking-tight md:text-6xl">{settings?.name || "Ristorante"}</h1>
          {settings?.bio && <p className="mx-auto mt-3 max-w-xl text-base text-ink/70">{settings.bio}</p>}
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              to="/book/$restaurantId"
              params={{ restaurantId: bookId }}
              className="rounded-xl border-2 border-ink bg-yellow px-6 py-3 text-sm font-bold uppercase tracking-wider text-ink shadow-[4px_4px_0_0_#000] transition active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
            >
              Prenota un tavolo
            </Link>
            {settings?.phone && (
              <a
                href={`tel:${settings.phone.replace(/\s/g, "")}`}
                className="rounded-xl border-2 border-ink bg-paper px-6 py-3 text-sm font-bold uppercase tracking-wider hover:bg-cream-dark"
              >
                📞 Chiama
              </a>
            )}
            {settings?.phone && (
              <a
                href={`https://wa.me/${settings.phone.replace(/[^\d+]/g, "").replace(/^\+/, "")}`}
                target="_blank"
                rel="noreferrer"
                className="rounded-xl border-2 border-ink bg-[#25D366] px-6 py-3 text-sm font-bold uppercase tracking-wider text-white hover:opacity-90"
              >
                💬 WhatsApp
              </a>
            )}
            {(settings?.google_maps_url || settings?.address) && (
              <a
                href={settings?.google_maps_url || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(settings?.address || "")}`}
                target="_blank"
                rel="noreferrer"
                className="rounded-xl border-2 border-ink bg-paper px-6 py-3 text-sm font-bold uppercase tracking-wider hover:bg-cream-dark"
              >
                📍 Indicazioni
              </a>
            )}
          </div>
        </div>
      </header>

      {/* Info */}
      {settings && (
        <section className="border-b-2 border-ink/10 bg-paper">
          <div className="mx-auto grid max-w-4xl gap-4 px-5 py-6 text-sm sm:grid-cols-3">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-wider text-ink/50">Indirizzo</p>
              <p className="mt-1">{settings.address}</p>
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-wider text-ink/50">Telefono</p>
              <p className="mt-1">{settings.phone || "—"}</p>
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-wider text-ink/50">Social</p>
              <p className="mt-1 space-x-2">
                {settings.instagram_handle && <a className="underline" href={`https://instagram.com/${settings.instagram_handle.replace("@", "")}`} target="_blank" rel="noreferrer">Instagram</a>}
                {settings.facebook_handle && <a className="underline" href={`https://facebook.com/${settings.facebook_handle.replace("@", "")}`} target="_blank" rel="noreferrer">Facebook</a>}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Menu */}
      <section className="mx-auto max-w-4xl px-5 py-10">
        <h2 className="mb-6 font-display text-3xl uppercase tracking-tight">Menu</h2>
        {byCategory.length === 0 ? (
          <p className="text-sm text-muted-foreground">Menu in aggiornamento.</p>
        ) : (
          <div className="space-y-8">
            {byCategory.map(([cat, items]) => (
              <div key={cat}>
                <h3 className="mb-3 font-display text-xl uppercase tracking-tight text-ink/80">{cat}</h3>
                <ul className="divide-y-2 divide-ink/10 overflow-hidden rounded-2xl border-2 border-ink bg-paper">
                  {items.map((it) => (
                    <li key={it.id} className="flex items-start gap-4 p-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-3">
                          <h4 className="font-display text-base uppercase tracking-tight">{it.name}</h4>
                          {it.price != null && <span className="font-mono text-sm font-bold">€ {Number(it.price).toFixed(2)}</span>}
                        </div>
                        {it.description && <p className="mt-1 text-sm text-ink/70">{it.description}</p>}
                        {it.allergens && <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-amber-700">⚠ {it.allergens}</p>}
                      </div>
                      {it.photo_url && <img src={it.photo_url} alt={it.name} loading="lazy" className="h-16 w-16 shrink-0 rounded-lg border border-ink/10 object-cover" />}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* CTA bottom */}
      <section className="border-t-2 border-ink bg-ink py-12 text-center text-paper">
        <h2 className="font-display text-3xl uppercase tracking-tight">Vieni a trovarci</h2>
        <p className="mt-2 text-sm text-paper/70">Prenota online, niente attese.</p>
        <Link
          to="/book/$restaurantId"
          params={{ restaurantId: bookId }}
          className="mt-5 inline-block rounded-xl border-2 border-yellow bg-yellow px-6 py-3 text-sm font-bold uppercase tracking-wider text-ink shadow-[4px_4px_0_0_#fff3] transition active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
        >
          Prenota ora
        </Link>
      </section>
    </div>
  );
}
