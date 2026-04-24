import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { getMyRestaurant, type Restaurant } from "@/lib/restaurant";
import { toast } from "sonner";

export const Route = createFileRoute("/owner/qr")({
  head: () => ({ meta: [{ title: "QR Code — Unobuono" }] }),
  component: QrPage,
});

function QrPage() {
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [tableNum, setTableNum] = useState("1");
  const bookingRef = useRef<HTMLCanvasElement>(null);
  const tableRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => { void getMyRestaurant().then(setRestaurant); }, []);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const bookingUrl = restaurant ? `${origin}/r/${restaurant.slug}` : "";
  const tableUrl = restaurant ? `${origin}/menu/${tableNum}?r=${restaurant.slug}` : "";

  useEffect(() => {
    if (!bookingUrl || !bookingRef.current) return;
    QRCode.toCanvas(bookingRef.current, bookingUrl, { width: 280, margin: 2, color: { dark: "#1a1611", light: "#fdfaf3" } });
  }, [bookingUrl]);

  useEffect(() => {
    if (!tableUrl || !tableRef.current) return;
    QRCode.toCanvas(tableRef.current, tableUrl, { width: 280, margin: 2, color: { dark: "#1a1611", light: "#fdfaf3" } });
  }, [tableUrl]);

  function download(canvas: HTMLCanvasElement | null, filename: string) {
    if (!canvas) return;
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    toast.success("QR scaricato");
  }

  function copy(text: string) {
    navigator.clipboard.writeText(text);
    toast.success("Link copiato");
  }

  if (!restaurant) return <div className="p-8 text-sm text-muted-foreground">Caricamento...</div>;

  return (
    <div className="mx-auto max-w-4xl px-5 py-7">
      <header className="mb-6">
        <h1 className="font-display text-3xl">QR Code</h1>
        <p className="text-sm text-muted-foreground">Stampa e attacca i QR per prenotazioni e tavoli.</p>
      </header>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Booking QR */}
        <div className="rounded-2xl border-2 border-ink bg-paper p-5 shadow-[6px_6px_0_0_hsl(var(--ink))]">
          <h2 className="font-display text-xl text-terracotta">📅 QR Prenotazioni</h2>
          <p className="mt-1 text-xs text-muted-foreground">Mettilo su Google My Business, vetrina, biglietti da visita.</p>
          <div className="my-4 flex justify-center rounded-xl bg-cream p-4">
            <canvas ref={bookingRef} className="rounded" />
          </div>
          <div className="mb-3 break-all rounded-lg border border-border bg-cream p-2 text-center font-mono text-[11px] text-ink">
            {bookingUrl}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => copy(bookingUrl)} className="rounded-lg border-2 border-ink bg-paper py-2 text-xs font-bold uppercase tracking-wider hover:bg-cream-dark">📋 Copia link</button>
            <button onClick={() => download(bookingRef.current, `qr-prenotazioni-${restaurant.slug}.png`)} className="rounded-lg border-2 border-ink bg-yellow py-2 text-xs font-bold uppercase tracking-wider hover:bg-yellow/80">⬇ Scarica PNG</button>
          </div>
        </div>

        {/* Table QR */}
        <div className="rounded-2xl border-2 border-ink bg-paper p-5 shadow-[6px_6px_0_0_hsl(var(--ink))]">
          <h2 className="font-display text-xl text-terracotta">🪑 QR Tavolo</h2>
          <p className="mt-1 text-xs text-muted-foreground">Per ogni tavolo. Cliente vede il menu e chiama il cameriere.</p>
          <label className="mt-3 block">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-ink/70">Numero tavolo</span>
            <input value={tableNum} onChange={(e) => setTableNum(e.target.value)} className="w-full rounded-lg border-2 border-ink bg-paper px-3 py-2 text-sm" />
          </label>
          <div className="my-4 flex justify-center rounded-xl bg-cream p-4">
            <canvas ref={tableRef} className="rounded" />
          </div>
          <div className="mb-3 break-all rounded-lg border border-border bg-cream p-2 text-center font-mono text-[11px] text-ink">
            {tableUrl}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => copy(tableUrl)} className="rounded-lg border-2 border-ink bg-paper py-2 text-xs font-bold uppercase tracking-wider hover:bg-cream-dark">📋 Copia link</button>
            <button onClick={() => download(tableRef.current, `qr-tavolo-${tableNum}.png`)} className="rounded-lg border-2 border-ink bg-yellow py-2 text-xs font-bold uppercase tracking-wider hover:bg-yellow/80">⬇ Scarica PNG</button>
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-border bg-cream-dark/30 p-4 text-sm">
        <strong>💡 Consiglio:</strong> stampa il QR Prenotazioni in formato A5 e mettilo all'ingresso. Per ogni tavolo, stampa un piccolo cartoncino con il QR Tavolo. Personalizza il numero del tavolo qui sopra prima di scaricare.
      </div>
    </div>
  );
}
