import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { supabase } from "@/integrations/supabase/client";
import { getMyRestaurant, type Restaurant } from "@/lib/restaurant";
import { toast } from "sonner";
import { Plus, Trash2, QrCode } from "lucide-react";

export const Route = createFileRoute("/owner/sala")({
  head: () => ({ meta: [{ title: "Sala & Tavoli — Unobuono" }] }),
  component: SalaPage,
});

type Zone = {
  id: string;
  name: string;
  description: string | null;
  features: string | null;
  preferences: string | null;
  capacity: number;
  available: boolean;
  sort_order: number;
};
type Table = {
  id: string;
  zone_id: string | null;
  code: string;
  seats: number;
  min_seats: number | null;
  max_seats: number | null;
  notes: string | null;
  sort_order: number;
};

function SalaPage() {
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [zones, setZones] = useState<Zone[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);

  // form aggiungi area
  const [zoneFormOpen, setZoneFormOpen] = useState(false);
  const [zName, setZName] = useState("");
  const [zDesc, setZDesc] = useState("");
  const [zFeatures, setZFeatures] = useState("");
  const [zPrefs, setZPrefs] = useState("");

  // edit preferenze area inline
  const [editingPrefsZone, setEditingPrefsZone] = useState<string | null>(null);
  const [prefsDraft, setPrefsDraft] = useState("");

  // form aggiungi tavolo
  const [tableFormZone, setTableFormZone] = useState<string | null>(null);
  const [tCode, setTCode] = useState("");
  const [tSeats, setTSeats] = useState(2);

  // QR modal
  const [qrTable, setQrTable] = useState<Table | null>(null);
  const qrCanvas = useRef<HTMLCanvasElement>(null);

  async function reload(rid: string) {
    const [{ data: z }, { data: t }] = await Promise.all([
      supabase.from("room_zones").select("*").eq("restaurant_id", rid).order("sort_order"),
      supabase.from("tables").select("*").eq("restaurant_id", rid).order("code"),
    ]);
    setZones((z || []) as Zone[]);
    setTables((t || []) as Table[]);
  }

  useEffect(() => {
    (async () => {
      const r = await getMyRestaurant();
      setRestaurant(r);
      if (r) await reload(r.id);
      setLoading(false);
    })();
  }, []);

  // Render QR when modal opens
  useEffect(() => {
    if (!qrTable || !restaurant || !qrCanvas.current) return;
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const url = `${origin}/menu/${encodeURIComponent(qrTable.code)}?r=${restaurant.slug}&tid=${qrTable.id}`;
    QRCode.toCanvas(qrCanvas.current, url, { width: 280, margin: 2, color: { dark: "#1a1611", light: "#fdfaf3" } });
  }, [qrTable, restaurant]);

  async function addZone() {
    if (!restaurant || !zName.trim()) { toast.error("Inserisci il nome"); return; }
    const { error } = await supabase.from("room_zones").insert({
      restaurant_id: restaurant.id,
      name: zName.trim(),
      description: zDesc.trim() || null,
      features: zFeatures.trim() || null,
      preferences: zPrefs.trim() || null,
      sort_order: zones.length,
      capacity: 0,
      table_count: 0,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Area aggiunta");
    setZName(""); setZDesc(""); setZFeatures(""); setZPrefs(""); setZoneFormOpen(false);
    await reload(restaurant.id);
  }

  async function deleteZone(id: string) {
    if (!restaurant) return;
    if (!confirm("Eliminare questa area? I tavoli associati resteranno ma senza area.")) return;
    const { error } = await supabase.from("room_zones").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Area eliminata");
    await reload(restaurant.id);
  }

  async function savePrefs(zoneId: string) {
    if (!restaurant) return;
    const { error } = await supabase.from("room_zones").update({ preferences: prefsDraft.trim() || null }).eq("id", zoneId);
    if (error) { toast.error(error.message); return; }
    toast.success("Preferenze aggiornate");
    setEditingPrefsZone(null);
    await reload(restaurant.id);
  }

  async function addTable(zoneId: string) {
    if (!restaurant || !tCode.trim()) { toast.error("Inserisci il codice tavolo"); return; }
    const { error } = await supabase.from("tables").insert({
      restaurant_id: restaurant.id,
      zone_id: zoneId,
      code: tCode.trim().toUpperCase(),
      seats: tSeats,
      min_seats: Math.max(1, tSeats - 1),
      max_seats: tSeats,
      sort_order: tables.filter((x) => x.zone_id === zoneId).length,
    });
    if (error) {
      if (error.code === "23505") toast.error("Esiste già un tavolo con questo codice");
      else toast.error(error.message);
      return;
    }
    toast.success(`Tavolo ${tCode} aggiunto`);
    setTCode(""); setTSeats(2); setTableFormZone(null);
    await reload(restaurant.id);
  }

  async function deleteTable(id: string, code: string) {
    if (!restaurant) return;
    if (!confirm(`Eliminare il tavolo ${code}?`)) return;
    const { error } = await supabase.from("tables").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Tavolo eliminato");
    await reload(restaurant.id);
  }

  async function updateTableField(id: string, patch: Partial<Pick<Table, "seats" | "min_seats" | "max_seats">>) {
    const { error } = await supabase.from("tables").update(patch).eq("id", id);
    if (error) { toast.error(error.message); return; }
    setTables((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }

  function downloadQr() {
    if (!qrCanvas.current || !qrTable || !restaurant) return;
    const url = qrCanvas.current.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `qr-${restaurant.slug}-${qrTable.code}.png`;
    a.click();
    toast.success("QR scaricato");
  }

  // tavoli senza area
  const orphanTables = tables.filter((t) => !t.zone_id || !zones.find((z) => z.id === t.zone_id));

  if (loading) return <div className="p-8 text-sm text-muted-foreground">Caricamento...</div>;

  const totalSeats = tables.reduce((s, t) => s + t.seats, 0);

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-5 sm:py-7">
      <header className="mb-5">
        <h1 className="font-display text-2xl sm:text-3xl">Sala & Tavoli</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Crea le aree del tuo locale, i tavoli, le preferenze selezionabili dai clienti. Ogni tavolo ha un QR stabile da stampare.
        </p>
        <div className="mt-3 flex flex-wrap gap-3 text-xs">
          <span className="rounded-full border border-ink/20 bg-cream px-3 py-1"><strong>{zones.length}</strong> aree</span>
          <span className="rounded-full border border-ink/20 bg-cream px-3 py-1"><strong>{tables.length}</strong> tavoli</span>
          <span className="rounded-full border border-ink/20 bg-cream px-3 py-1"><strong>{totalSeats}</strong> coperti totali</span>
        </div>
      </header>

      {!zoneFormOpen ? (
        <button onClick={() => setZoneFormOpen(true)} className="mb-5 inline-flex items-center gap-2 rounded-lg border-2 border-ink bg-yellow px-4 py-2 text-sm font-bold uppercase tracking-wider hover:bg-yellow/80">
          <Plus className="h-4 w-4" /> Aggiungi area
        </button>
      ) : (
        <div className="mb-5 rounded-2xl border-2 border-ink bg-paper p-4 shadow-[6px_6px_0_0_hsl(var(--ink))]">
          <h3 className="mb-3 font-display text-lg text-terracotta">Nuova area</h3>
          <div className="space-y-3">
            <Field label="Nome area *"><input className="set-in" value={zName} onChange={(e) => setZName(e.target.value)} placeholder="Sala interna, Terrazza, Veranda…" /></Field>
            <Field label="Descrizione"><input className="set-in" value={zDesc} onChange={(e) => setZDesc(e.target.value)} placeholder="es. Vista mare al primo piano" /></Field>
            <Field label="Caratteristiche"><input className="set-in" value={zFeatures} onChange={(e) => setZFeatures(e.target.value)} placeholder="es. Riscaldata, dehor, fumatori…" /></Field>
            <Field label="Preferenze selezionabili dai clienti">
              <textarea
                className="set-in min-h-[70px]"
                value={zPrefs}
                onChange={(e) => setZPrefs(e.target.value)}
                placeholder={"Una per riga, es.:\nVicino alla finestra\nTavolo alto\nLontano dalla cucina"}
              />
            </Field>
            <div className="flex gap-2">
              <button onClick={addZone} className="flex-1 rounded-lg border-2 border-ink bg-yellow py-2 text-sm font-bold uppercase tracking-wider hover:bg-yellow/80">Salva area</button>
              <button onClick={() => { setZoneFormOpen(false); setZName(""); setZDesc(""); setZFeatures(""); setZPrefs(""); }} className="rounded-lg border-2 border-ink bg-paper px-4 py-2 text-sm font-bold uppercase tracking-wider hover:bg-cream-dark">Annulla</button>
            </div>
          </div>
        </div>
      )}

      {zones.length === 0 && orphanTables.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 p-8 text-center text-sm text-muted-foreground">
          Nessuna area ancora. Crea la prima per iniziare a gestire i tuoi tavoli.
        </div>
      )}

      <div className="space-y-4">
        {zones.map((zone) => {
          const zTables = tables.filter((t) => t.zone_id === zone.id).sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
          const zSeats = zTables.reduce((s, t) => s + t.seats, 0);
          const prefList = (zone.preferences || "").split("\n").map((p) => p.trim()).filter(Boolean);
          return (
            <div key={zone.id} className="rounded-2xl border-2 border-ink bg-paper p-4 shadow-[4px_4px_0_0_hsl(var(--ink))] sm:p-5">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h2 className="font-display text-xl text-terracotta">{zone.name}</h2>
                  {zone.description && <p className="mt-0.5 text-sm text-ink/70">{zone.description}</p>}
                  {zone.features && <p className="mt-0.5 text-xs text-ink/50">{zone.features}</p>}
                  <p className="mt-1 text-xs font-mono uppercase tracking-wider text-ink/60">{zTables.length} tavoli · {zSeats} coperti</p>
                </div>
                <button onClick={() => deleteZone(zone.id)} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-border text-muted-foreground hover:border-destructive hover:text-destructive" aria-label="Elimina area">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              {/* Preferenze */}
              <div className="mb-3 rounded-lg border border-ink/15 bg-cream/40 p-3">
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/60">Preferenze cliente</span>
                  {editingPrefsZone !== zone.id && (
                    <button
                      onClick={() => { setEditingPrefsZone(zone.id); setPrefsDraft(zone.preferences || ""); }}
                      className="text-[11px] font-bold uppercase tracking-wider text-terracotta hover:underline"
                    >
                      Modifica
                    </button>
                  )}
                </div>
                {editingPrefsZone === zone.id ? (
                  <>
                    <textarea
                      className="set-in min-h-[80px]"
                      value={prefsDraft}
                      onChange={(e) => setPrefsDraft(e.target.value)}
                      placeholder={"Una per riga, es.:\nVicino alla finestra\nTavolo alto"}
                    />
                    <div className="mt-2 flex gap-2">
                      <button onClick={() => savePrefs(zone.id)} className="rounded-lg border-2 border-ink bg-yellow px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider">Salva</button>
                      <button onClick={() => setEditingPrefsZone(null)} className="rounded-lg border-2 border-ink bg-paper px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider">Annulla</button>
                    </div>
                  </>
                ) : prefList.length === 0 ? (
                  <p className="text-xs italic text-ink/40">Nessuna preferenza definita per questa area.</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {prefList.map((p, i) => (
                      <span key={i} className="rounded-full border border-ink/20 bg-paper px-2.5 py-0.5 text-[11px]">{p}</span>
                    ))}
                  </div>
                )}
              </div>

              {/* Tavoli */}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                {zTables.map((t) => {
                  const minS = t.min_seats ?? Math.max(1, t.seats - 1);
                  const maxS = t.max_seats ?? t.seats;
                  return (
                  <div key={t.id} className="rounded-lg border-2 border-ink bg-cream p-3">
                    <div className="flex items-start justify-between">
                      <span className="font-display text-lg text-ink">{t.code}</span>
                      <div className="flex gap-1">
                        <button
                          onClick={() => setQrTable(t)}
                          className="text-ink/60 hover:text-terracotta"
                          aria-label="Mostra QR"
                          title="QR del tavolo"
                        >
                          <QrCode className="h-4 w-4" />
                        </button>
                        <button onClick={() => deleteTable(t.id, t.code)} className="text-muted-foreground hover:text-destructive" aria-label="Elimina tavolo">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="mt-2 space-y-1.5">
                      <label className="flex items-center justify-between gap-1 text-[10px] uppercase tracking-wider text-ink/60">
                        <span>Posti</span>
                        <input
                          type="number" min={1} max={20} value={t.seats}
                          onChange={(e) => {
                            const s = Math.max(1, Number(e.target.value));
                            updateTableField(t.id, { seats: s, max_seats: Math.max(maxS, s) });
                          }}
                          className="w-12 rounded border border-ink/20 bg-paper px-1 py-0.5 text-center text-xs"
                        />
                      </label>
                      <label className="flex items-center justify-between gap-1 text-[10px] uppercase tracking-wider text-ink/60" title="Numero minimo di persone per occupare questo tavolo (evita che 2 persone occupino un tavolo da 6)">
                        <span>Min</span>
                        <input
                          type="number" min={1} max={maxS} value={minS}
                          onChange={(e) => updateTableField(t.id, { min_seats: Math.max(1, Math.min(maxS, Number(e.target.value))) })}
                          className="w-12 rounded border border-ink/20 bg-paper px-1 py-0.5 text-center text-xs"
                        />
                      </label>
                      <label className="flex items-center justify-between gap-1 text-[10px] uppercase tracking-wider text-ink/60" title="Numero massimo di persone (di default = posti)">
                        <span>Max</span>
                        <input
                          type="number" min={minS} max={20} value={maxS}
                          onChange={(e) => updateTableField(t.id, { max_seats: Math.max(minS, Number(e.target.value)) })}
                          className="w-12 rounded border border-ink/20 bg-paper px-1 py-0.5 text-center text-xs"
                        />
                      </label>
                    </div>
                  </div>
                  );
                })}
              </div>

              {/* Aggiungi tavolo */}
              {tableFormZone === zone.id ? (
                <div className="mt-3 rounded-lg border border-ink/20 bg-cream p-3">
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
                    <input className="set-in" value={tCode} onChange={(e) => setTCode(e.target.value)} placeholder="Codice (T1, Finestra…)" autoFocus />
                    <input type="number" className="set-in sm:w-20" value={tSeats} onChange={(e) => setTSeats(Math.max(1, Number(e.target.value)))} min={1} placeholder="Posti" />
                    <button onClick={() => addTable(zone.id)} className="rounded-lg border-2 border-ink bg-yellow px-3 py-2 text-xs font-bold uppercase tracking-wider hover:bg-yellow/80">Aggiungi</button>
                    <button onClick={() => { setTableFormZone(null); setTCode(""); setTSeats(2); }} className="rounded-lg border-2 border-ink bg-paper px-3 py-2 text-xs font-bold uppercase tracking-wider">Annulla</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => { setTableFormZone(zone.id); setTCode(""); setTSeats(2); }} className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-dashed border-ink/30 bg-paper px-3 py-2 text-xs font-bold uppercase tracking-wider text-ink/70 hover:border-ink hover:bg-cream-dark">
                  <Plus className="h-3.5 w-3.5" /> Aggiungi tavolo a {zone.name}
                </button>
              )}
            </div>
          );
        })}

        {orphanTables.length > 0 && (
          <div className="rounded-2xl border border-dashed border-border bg-card/50 p-4">
            <h3 className="mb-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">Tavoli senza area</h3>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
              {orphanTables.map((t) => (
                <div key={t.id} className="rounded-lg border border-border bg-paper p-3">
                  <div className="flex items-start justify-between">
                    <span className="font-display text-lg">{t.code}</span>
                    <div className="flex gap-1">
                      <button onClick={() => setQrTable(t)} className="text-ink/60 hover:text-terracotta" aria-label="QR">
                        <QrCode className="h-4 w-4" />
                      </button>
                      <button onClick={() => deleteTable(t.id, t.code)} className="text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <p className="mt-1 text-[11px] uppercase tracking-wider text-muted-foreground">{t.seats} posti</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* QR Modal */}
      {qrTable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4" onClick={() => setQrTable(null)}>
          <div className="w-full max-w-sm rounded-2xl border-2 border-ink bg-paper p-5 shadow-[6px_6px_0_0_hsl(var(--ink))]" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-start justify-between">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/60">QR Tavolo</p>
                <h3 className="font-display text-2xl uppercase">{qrTable.code}</h3>
              </div>
              <button onClick={() => setQrTable(null)} className="text-2xl text-ink/60">×</button>
            </div>
            <div className="flex justify-center rounded-xl bg-cream p-3">
              <canvas ref={qrCanvas} />
            </div>
            <p className="mt-3 text-center text-xs text-ink/60">Stampa e attaccalo al tavolo. Il cliente lo scansiona e vede menu live, può ordinare e chiamare il cameriere.</p>
            <div className="mt-4 flex gap-2">
              <button onClick={downloadQr} className="flex-1 rounded-lg border-2 border-ink bg-yellow py-2.5 text-xs font-bold uppercase tracking-wider hover:bg-yellow/80">⬇ Scarica PNG</button>
              <button onClick={() => setQrTable(null)} className="rounded-lg border-2 border-ink bg-paper px-4 py-2.5 text-xs font-bold uppercase tracking-wider">Chiudi</button>
            </div>
          </div>
        </div>
      )}

      <style>{`.set-in{width:100%;border:2px solid hsl(var(--ink));background:hsl(var(--paper));border-radius:8px;padding:8px 10px;font-size:14px;color:inherit}`}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1 block text-xs font-bold uppercase tracking-wider text-ink/70">{label}</span>{children}</label>;
}
