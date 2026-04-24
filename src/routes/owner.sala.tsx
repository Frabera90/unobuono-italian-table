import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getMyRestaurant, type Restaurant } from "@/lib/restaurant";
import { toast } from "sonner";
import { Plus, Trash2, Pencil } from "lucide-react";

export const Route = createFileRoute("/owner/sala")({
  head: () => ({ meta: [{ title: "Sala & Tavoli — Unobuono" }] }),
  component: SalaPage,
});

type Zone = {
  id: string;
  name: string;
  description: string | null;
  features: string | null;
  capacity: number;
  available: boolean;
  sort_order: number;
};
type Table = {
  id: string;
  zone_id: string | null;
  code: string;
  seats: number;
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

  // form aggiungi tavolo
  const [tableFormZone, setTableFormZone] = useState<string | null>(null);
  const [tCode, setTCode] = useState("");
  const [tSeats, setTSeats] = useState(2);

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

  async function addZone() {
    if (!restaurant || !zName.trim()) { toast.error("Inserisci il nome"); return; }
    const { error } = await supabase.from("room_zones").insert({
      restaurant_id: restaurant.id,
      name: zName.trim(),
      description: zDesc.trim() || null,
      features: zFeatures.trim() || null,
      sort_order: zones.length,
      capacity: 0,
      table_count: 0,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Area aggiunta");
    setZName(""); setZDesc(""); setZFeatures(""); setZoneFormOpen(false);
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

  async function addTable(zoneId: string) {
    if (!restaurant || !tCode.trim()) { toast.error("Inserisci il codice tavolo"); return; }
    const { error } = await supabase.from("tables").insert({
      restaurant_id: restaurant.id,
      zone_id: zoneId,
      code: tCode.trim().toUpperCase(),
      seats: tSeats,
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

  async function updateTableSeats(id: string, seats: number) {
    const { error } = await supabase.from("tables").update({ seats }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    setTables((prev) => prev.map((t) => (t.id === id ? { ...t, seats } : t)));
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
          Crea le aree del tuo locale e i tavoli al loro interno. Ogni tavolo avrà un QR code stabile collegato alla prenotazione di quell'orario.
        </p>
        <div className="mt-3 flex flex-wrap gap-3 text-xs">
          <span className="rounded-full border border-ink/20 bg-cream px-3 py-1"><strong>{zones.length}</strong> aree</span>
          <span className="rounded-full border border-ink/20 bg-cream px-3 py-1"><strong>{tables.length}</strong> tavoli</span>
          <span className="rounded-full border border-ink/20 bg-cream px-3 py-1"><strong>{totalSeats}</strong> coperti totali</span>
        </div>
      </header>

      {/* Aggiungi area */}
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
            <div className="flex gap-2">
              <button onClick={addZone} className="flex-1 rounded-lg border-2 border-ink bg-yellow py-2 text-sm font-bold uppercase tracking-wider hover:bg-yellow/80">Salva area</button>
              <button onClick={() => { setZoneFormOpen(false); setZName(""); setZDesc(""); setZFeatures(""); }} className="rounded-lg border-2 border-ink bg-paper px-4 py-2 text-sm font-bold uppercase tracking-wider hover:bg-cream-dark">Annulla</button>
            </div>
          </div>
        </div>
      )}

      {/* Lista aree */}
      {zones.length === 0 && orphanTables.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 p-8 text-center text-sm text-muted-foreground">
          Nessuna area ancora. Crea la prima per iniziare a gestire i tuoi tavoli.
        </div>
      )}

      <div className="space-y-4">
        {zones.map((zone) => {
          const zTables = tables.filter((t) => t.zone_id === zone.id).sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
          const zSeats = zTables.reduce((s, t) => s + t.seats, 0);
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

              {/* Tavoli */}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                {zTables.map((t) => (
                  <div key={t.id} className="rounded-lg border-2 border-ink bg-cream p-3">
                    <div className="flex items-start justify-between">
                      <span className="font-display text-lg text-ink">{t.code}</span>
                      <button onClick={() => deleteTable(t.id, t.code)} className="text-muted-foreground hover:text-destructive" aria-label="Elimina tavolo">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <label className="mt-1 flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-ink/60">
                      Posti
                      <input
                        type="number"
                        min={1}
                        max={20}
                        value={t.seats}
                        onChange={(e) => updateTableSeats(t.id, Math.max(1, Number(e.target.value)))}
                        className="w-12 rounded border border-ink/20 bg-paper px-1 py-0.5 text-center text-xs"
                      />
                    </label>
                  </div>
                ))}
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

        {/* Tavoli orfani */}
        {orphanTables.length > 0 && (
          <div className="rounded-2xl border border-dashed border-border bg-card/50 p-4">
            <h3 className="mb-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">Tavoli senza area</h3>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
              {orphanTables.map((t) => (
                <div key={t.id} className="rounded-lg border border-border bg-paper p-3">
                  <div className="flex items-start justify-between">
                    <span className="font-display text-lg">{t.code}</span>
                    <button onClick={() => deleteTable(t.id, t.code)} className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <p className="mt-1 text-[11px] uppercase tracking-wider text-muted-foreground">{t.seats} posti</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 rounded-xl border border-border bg-cream-dark/30 p-4 text-sm">
        <strong>💡 Come funziona:</strong> ogni tavolo ha un QR code stabile (lo stampi e lo lasci sul tavolo). Quando un cliente lo scansiona, vede la sua prenotazione attiva per quell'orario, può ordinare e chiamare il cameriere. Vai in <strong>QR Code</strong> per stamparli.
      </div>

      <style>{`.set-in{width:100%;border:2px solid hsl(var(--ink));background:hsl(var(--paper));border-radius:8px;padding:8px 10px;font-size:14px;color:inherit}`}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1 block text-xs font-bold uppercase tracking-wider text-ink/70">{label}</span>{children}</label>;
}
