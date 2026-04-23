import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/owner/crm")({
  head: () => ({ meta: [{ title: "Clienti — Unobuono" }] }),
  component: CrmPage,
});

type Client = { id: string; name: string; phone: string | null; visit_count: number; total_spent: number; last_visit: string | null; birthday: string | null; notes: string | null; allergens: string | null; tags: string[] | null; created_at: string };

function CrmPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [q, setQ] = useState("");
  const [active, setActive] = useState<Client | null>(null);

  useEffect(() => {
    supabase.from("clients").select("*").order("visit_count", { ascending: false }).then(({ data }) => setClients((data || []) as Client[]));
  }, []);

  const filtered = q ? clients.filter((c) => c.name.toLowerCase().includes(q.toLowerCase()) || c.phone?.includes(q)) : clients;

  return (
    <div className="mx-auto max-w-5xl px-5 py-7">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl">Clienti</h1>
          <p className="text-sm text-muted-foreground">{clients.length} clienti · €{clients.reduce((s, c) => s + Number(c.total_spent || 0), 0).toFixed(0)} fatturato totale</p>
        </div>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cerca nome o telefono..." className="rounded-lg border border-border bg-card px-3 py-2 text-sm" />
      </header>

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
