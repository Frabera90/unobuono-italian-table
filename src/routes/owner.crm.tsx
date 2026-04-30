import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/owner/crm")({
  head: () => ({ meta: [{ title: "Clienti — Unobuono" }] }),
  component: CrmPage,
});

type Client = { id: string; name: string; phone: string | null; visit_count: number; total_spent: number; last_visit: string | null; birthday: string | null; notes: string | null; allergens: string | null; tags: string[] | null; created_at: string };

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQ = false;
      else field += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ",") { cur.push(field); field = ""; }
      else if (c === "\n" || c === "\r") {
        if (field !== "" || cur.length) { cur.push(field); rows.push(cur); cur = []; field = ""; }
        if (c === "\r" && text[i + 1] === "\n") i++;
      } else field += c;
    }
  }
  if (field !== "" || cur.length) { cur.push(field); rows.push(cur); }
  return rows.filter((r) => r.some((v) => v.trim() !== ""));
}

function exportCsv(rows: Client[]) {
  const header = ["name", "phone", "visit_count", "total_spent", "last_visit", "birthday", "tags", "allergens", "notes"];
  const esc = (v: any) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push([r.name, r.phone || "", r.visit_count, r.total_spent, r.last_visit || "", r.birthday || "", (r.tags || []).join("|"), r.allergens || "", r.notes || ""].map(esc).join(","));
  }
  const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `clienti-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function CrmPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [q, setQ] = useState("");
  const [active, setActive] = useState<Client | null>(null);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [restaurantId, setRestaurantId] = useState<string | null>(null);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: rest } = await supabase.from("restaurants").select("id").eq("owner_id", user.id).maybeSingle();
    if (!rest) return;
    setRestaurantId(rest.id);
    const { data } = await supabase.from("clients").select("*").eq("restaurant_id", rest.id).order("visit_count", { ascending: false });
    setClients((data || []) as Client[]);
  }

  useEffect(() => { void load(); }, []);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setImporting(true);
    try {
      const text = await f.text();
      const rows = parseCsv(text);
      if (rows.length < 2) { toast.error("CSV vuoto"); return; }
      const header = rows[0].map((h) => h.trim().toLowerCase());
      const idx = (k: string, ...alts: string[]) => {
        const all = [k, ...alts];
        for (const a of all) {
          const i = header.indexOf(a);
          if (i >= 0) return i;
        }
        return -1;
      };
      const iName = idx("name", "nome");
      const iPhone = idx("phone", "telefono", "tel");
      const iVisits = idx("visit_count", "visite");
      const iSpent = idx("total_spent", "speso", "totale");
      const iLast = idx("last_visit", "ultima_visita");
      const iBday = idx("birthday", "compleanno");
      const iTags = idx("tags", "tag");
      const iAllerg = idx("allergens", "allergie");
      const iNotes = idx("notes", "note");

      if (iName < 0) { toast.error("Manca la colonna 'name'"); return; }

      const records = rows.slice(1).map((r) => ({
        name: r[iName]?.trim() || "Anonimo",
        phone: iPhone >= 0 ? (r[iPhone]?.trim() || null) : null,
        visit_count: iVisits >= 0 ? Number(r[iVisits]) || 1 : 1,
        total_spent: iSpent >= 0 ? Number(r[iSpent]) || 0 : 0,
        last_visit: iLast >= 0 && r[iLast]?.trim() ? r[iLast].trim() : null,
        birthday: iBday >= 0 && r[iBday]?.trim() ? r[iBday].trim() : null,
        tags: iTags >= 0 && r[iTags]?.trim() ? r[iTags].split(/[|;,]/).map((t) => t.trim()).filter(Boolean) : null,
        allergens: iAllerg >= 0 ? (r[iAllerg]?.trim() || null) : null,
        notes: iNotes >= 0 ? (r[iNotes]?.trim() || null) : null,
      })).filter((r) => r.name);

      if (records.length === 0) { toast.error("Nessun cliente valido"); return; }

      const { error } = await supabase.from("clients").insert(records);
      if (error) throw error;
      toast.success(`Importati ${records.length} clienti`);
      await load();
    } catch (e: any) {
      toast.error(e.message || "Errore import");
    } finally {
      setImporting(false);
    }
  }

  const filtered = q ? clients.filter((c) => c.name.toLowerCase().includes(q.toLowerCase()) || c.phone?.includes(q)) : clients;

  return (
    <div className="mx-auto max-w-5xl px-5 py-7">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl">Clienti</h1>
          <p className="text-sm text-muted-foreground">{clients.length} clienti · €{clients.reduce((s, c) => s + Number(c.total_spent || 0), 0).toFixed(0)} fatturato totale</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cerca nome o telefono..." className="rounded-lg border border-border bg-card px-3 py-2 text-sm" />
          <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={onFile} className="hidden" />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={importing}
            className="rounded-lg border-2 border-ink bg-yellow px-3 py-2 text-xs font-bold uppercase tracking-wider text-ink hover:bg-yellow/80 disabled:opacity-50"
            title="Importa CSV (colonne: name, phone, visit_count, total_spent, ...)"
          >
            {importing ? "Importo..." : "⬆ Importa CSV"}
          </button>
          <button
            onClick={() => exportCsv(clients)}
            disabled={clients.length === 0}
            className="rounded-lg border-2 border-ink bg-paper px-3 py-2 text-xs font-bold uppercase tracking-wider text-ink hover:bg-cream-dark disabled:opacity-40"
          >
            ⬇ Export
          </button>
        </div>
      </header>

      <p className="mb-3 text-[11px] text-muted-foreground">
        CSV: prima riga con intestazioni. Obbligatoria <code className="rounded bg-cream-dark px-1">name</code>. Opzionali: <code className="rounded bg-cream-dark px-1">phone</code>, <code className="rounded bg-cream-dark px-1">visit_count</code>, <code className="rounded bg-cream-dark px-1">total_spent</code>, <code className="rounded bg-cream-dark px-1">last_visit</code> (YYYY-MM-DD), <code className="rounded bg-cream-dark px-1">birthday</code>, <code className="rounded bg-cream-dark px-1">tags</code> (separati da |), <code className="rounded bg-cream-dark px-1">allergens</code>, <code className="rounded bg-cream-dark px-1">notes</code>.
      </p>

      <ul className="divide-y divide-border rounded-xl border border-border bg-card">
        {filtered.length === 0 && <li className="p-8 text-center text-sm text-muted-foreground">Nessun cliente.</li>}
        {filtered.map((c) => (
          <li key={c.id}>
            <button onClick={() => setActive(c)} className="flex w-full items-center gap-4 p-3 text-left hover:bg-cream-dark/40">
              <div className="grid h-10 w-10 place-items-center rounded-full bg-terracotta/10 font-display text-terracotta">{c.name.charAt(0).toUpperCase()}</div>
              <div className="min-w-0 flex-1">
                <div className="font-display text-base">{c.name}</div>
                <div className="text-xs text-muted-foreground">{c.phone || "—"} · {c.visit_count} visite · €{Number(c.total_spent || 0).toFixed(0)}</div>
              </div>
              <div className="flex flex-wrap gap-1">
                {c.allergens && <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] text-amber-700">⚠️ {c.allergens}</span>}
                {(c.tags || []).slice(0, 2).map((t) => <span key={t} className="rounded-full bg-terracotta/15 px-2 py-0.5 text-[10px] text-terracotta">{t}</span>)}
              </div>
            </button>
          </li>
        ))}
      </ul>

      {active && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-ink/40 p-4" onClick={() => setActive(null)}>
          <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h3 className="font-display text-2xl">{active.name}</h3>
                <p className="text-sm text-muted-foreground">{active.phone || "Nessun telefono"}</p>
              </div>
              <button onClick={() => setActive(null)} className="text-2xl text-muted-foreground">×</button>
            </div>
            <dl className="space-y-2 text-sm">
              <Row label="Visite">{active.visit_count}</Row>
              <Row label="Speso totale">€ {Number(active.total_spent || 0).toFixed(2)}</Row>
              <Row label="Ultima visita">{active.last_visit || "—"}</Row>
              <Row label="Compleanno">{active.birthday || "—"}</Row>
              {active.allergens && <Row label="Allergie">{active.allergens}</Row>}
              {active.notes && <Row label="Note">{active.notes}</Row>}
            </dl>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex justify-between gap-3 border-b border-border/50 py-1.5"><dt className="text-muted-foreground">{label}</dt><dd className="text-right">{children}</dd></div>;
}
