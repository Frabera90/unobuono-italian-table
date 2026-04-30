import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { supabase } from "@/integrations/supabase/client";
import { getMyRestaurant, type Restaurant } from "@/lib/restaurant";
import { toast } from "sonner";

export const Route = createFileRoute("/owner/qr")({
  head: () => ({ meta: [{ title: "QR Code — Unobuono" }] }),
  component: QrPage,
});

type Zone = { id: string; name: string };
type Table = { id: string; zone_id: string | null; code: string; seats: number };

function QrPage() {
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [zones, setZones] = useState<Zone[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);
  const bookingRef = useRef<HTMLCanvasElement>(null);
  const tableCanvases = useRef<Map<string, HTMLCanvasElement>>(new Map());

  useEffect(() => {
    (async () => {
      const r = await getMyRestaurant();
      setRestaurant(r);
      if (r) {
        const [{ data: z }, { data: t }] = await Promise.all([
          supabase.from("room_zones").select("id,name").eq("restaurant_id", r.id).order("sort_order"),
          supabase.from("tables").select("id,zone_id,code,seats").eq("restaurant_id", r.id).order("code"),
        ]);
        setZones((z || []) as Zone[]);
        setTables((t || []) as Table[]);
      }
      setLoading(false);
    })();
  }, []);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const bookingUrl = restaurant ? `${origin}/r/${restaurant.slug}` : "";

  useEffect(() => {
    if (!bookingUrl || !bookingRef.current) return;
    QRCode.toCanvas(bookingRef.current, bookingUrl, { width: 240, margin: 2, color: { dark: "#1a1611", light: "#fdfaf3" } });
  }, [bookingUrl]);

  // Render tutti i QR tavoli
  useEffect(() => {
    if (!restaurant) return;
    for (const t of tables) {
      const canvas = tableCanvases.current.get(t.id);
      if (!canvas) continue;
      const url = `${origin}/menu/${encodeURIComponent(t.code)}?r=${restaurant.slug}&tid=${t.id}`;
      QRCode.toCanvas(canvas, url, { width: 180, margin: 2, color: { dark: "#1a1611", light: "#fdfaf3" } });
    }
  }, [tables, restaurant, origin]);

  function download(canvas: HTMLCanvasElement | null | undefined, filename: string) {
    if (!canvas) { toast.error("QR non pronto"); return; }
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    toast.success("QR scaricato");
  }

  function copy(text: string) {
    navigator.clipboard.writeText(text);
    toast.success("Link copiato");
  }

  async function downloadAll() {
    if (!restaurant) return;
    const items = tables
      .map((t) => ({ canvas: tableCanvases.current.get(t.id), code: t.code }))
      .filter((x): x is { canvas: HTMLCanvasElement; code: string } => !!x.canvas);
    if (items.length === 0) { toast.error("Nessun tavolo da scaricare"); return; }
    toast.info(`Scarico ${items.length} QR…`);
    // Sequenza con piccolo delay: alcuni browser bloccano click() multipli sincroni
    for (let i = 0; i < items.length; i++) {
      const { canvas, code } = items[i];
      const url = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = url;
      a.download = `qr-${restaurant.slug}-${code}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      await new Promise((r) => setTimeout(r, 250));
    }
    toast.success(`${items.length} QR scaricati`);
  }

  if (loading) return <div className="p-8 text-sm text-muted-foreground">Caricamento...</div>;
  if (!restaurant) return null;

  // Raggruppa tavoli per area
  const tablesByZone = new Map<string | null, Table[]>();
  for (const t of tables) {
    const k = t.zone_id ?? null;
    if (!tablesByZone.has(k)) tablesByZone.set(k, []);
    tablesByZone.get(k)!.push(t);
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-5 sm:py-7">
      <header className="mb-5">
        <h1 className="font-display text-2xl sm:text-3xl">QR Code</h1>
        <p className="text-sm text-muted-foreground">Stampa e attacca i QR. Quello del tavolo è permanente — il cliente lo scansiona e vede automaticamente la sua prenotazione.</p>
      </header>

      {/* Booking QR */}
      <section className="mb-6 rounded-2xl border-2 border-ink bg-paper p-4 shadow-[6px_6px_0_0_hsl(var(--ink))] sm:p-5">
        <div className="flex flex-col items-start gap-4 sm:flex-row">
          <div className="shrink-0">
            <canvas ref={bookingRef} className="rounded bg-cream p-2" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-xl text-terracotta">📅 QR Prenotazioni</h2>
            <p className="mt-1 text-sm text-ink/70">Pubblicalo su Google My Business, vetrina, biglietti da visita. Porta i clienti alla pagina di prenotazione.</p>
            <div className="my-3 break-all rounded-lg border border-border bg-cream p-2 font-mono text-[11px]">{bookingUrl}</div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => copy(bookingUrl)} className="rounded-lg border-2 border-ink bg-paper px-3 py-2 text-xs font-bold uppercase tracking-wider hover:bg-cream-dark">📋 Copia link</button>
              <button onClick={() => download(bookingRef.current, `qr-prenotazioni-${restaurant.slug}.png`)} className="rounded-lg border-2 border-ink bg-yellow px-3 py-2 text-xs font-bold uppercase tracking-wider hover:bg-yellow/80">⬇ Scarica PNG</button>
            </div>
          </div>
        </div>
      </section>

      {/* QR Tavoli */}
      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-xl text-terracotta">🪑 QR Tavoli</h2>
          {tables.length > 0 && (
            <button onClick={downloadAll} className="rounded-lg border-2 border-ink bg-yellow px-3 py-2 text-xs font-bold uppercase tracking-wider hover:bg-yellow/80">
              ⬇ Scarica tutti
            </button>
          )}
        </div>

        {tables.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/50 p-6 text-center text-sm">
            <p className="text-muted-foreground">Nessun tavolo creato.</p>
            <Link to="/owner/sala" className="mt-3 inline-block rounded-lg border-2 border-ink bg-yellow px-4 py-2 text-xs font-bold uppercase tracking-wider hover:bg-yellow/80">
              Vai a Sala & Tavoli →
            </Link>
          </div>
        ) : (
          <div className="space-y-5">
            {Array.from(tablesByZone.entries()).map(([zoneId, zTables]) => {
              const zoneName = zoneId ? zones.find((z) => z.id === zoneId)?.name || "Area sconosciuta" : "Senza area";
              return (
                <div key={zoneId ?? "orphan"}>
                  <h3 className="mb-2 font-mono text-[11px] uppercase tracking-[0.2em] text-ink/60">{zoneName}</h3>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                    {zTables.map((t) => (
                      <div key={t.id} className="rounded-2xl border-2 border-ink bg-paper p-3 shadow-[3px_3px_0_0_hsl(var(--ink))]">
                        <div className="mb-2 text-center">
                          <p className="font-display text-lg text-ink">{t.code}</p>
                          <p className="text-[10px] uppercase tracking-wider text-ink/50">{t.seats} posti</p>
                        </div>
                        <div className="mb-2 flex justify-center rounded-lg bg-cream p-1">
                          <canvas
                            ref={(el) => {
                              if (el) tableCanvases.current.set(t.id, el);
                              else tableCanvases.current.delete(t.id);
                            }}
                          />
                        </div>
                        <button
                          onClick={() => download(tableCanvases.current.get(t.id), `qr-${restaurant.slug}-${t.code}.png`)}
                          className="w-full rounded-lg border-2 border-ink bg-yellow py-1.5 text-[10px] font-bold uppercase tracking-wider hover:bg-yellow/80"
                        >
                          ⬇ Scarica
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <div className="mt-6 rounded-xl border border-border bg-cream-dark/30 p-4 text-sm">
        <strong>💡 Come funziona:</strong> stampa il QR Tavolo una volta sola e lascialo sul tavolo. Quando un cliente lo scansiona durante un orario di prenotazione attiva, vede automaticamente "Ciao [Nome], benvenuto!" con i dettagli della sua prenotazione, può ordinare e chiamare il cameriere.
      </div>
    </div>
  );
}
