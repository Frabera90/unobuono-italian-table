import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/owner/stats")({
  head: () => ({ meta: [{ title: "Statistiche — Unobuono" }] }),
  component: StatsPage,
});

type Period = 7 | 30 | 90;

function StatsPage() {
  const [period, setPeriod] = useState<Period>(30);
  const [resv, setResv] = useState<any[]>([]);
  const [pre, setPre] = useState<any[]>([]);

  useEffect(() => {
    const since = new Date(Date.now() - period * 86400e3).toISOString().slice(0, 10);
    Promise.all([
      supabase.from("reservations").select("date, party_size, arrived").gte("date", since),
      supabase.from("preorders").select("total, created_at").gte("created_at", since),
    ]).then(([r, p]) => {
      setResv(r.data || []);
      setPre(p.data || []);
    });
  }, [period]);

  const stats = useMemo(() => {
    const covers = resv.reduce((s, r) => s + r.party_size, 0);
    const arrived = resv.filter((r) => r.arrived).length;
    const noShowRate = resv.length ? Math.round(((resv.length - arrived) / resv.length) * 100) : 0;
    const revenue = pre.reduce((s, p) => s + Number(p.total || 0), 0);
    const avgTicket = pre.length ? revenue / pre.length : 0;
    return { covers, resvCount: resv.length, noShowRate, revenue, avgTicket };
  }, [resv, pre]);

  const byDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of resv) map.set(r.date, (map.get(r.date) || 0) + r.party_size);
    return Array.from(map.entries()).sort().slice(-period);
  }, [resv, period]);

  const revenueByDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of pre) {
      const day = (p.created_at as string).slice(0, 10);
      map.set(day, (map.get(day) || 0) + Number(p.total || 0));
    }
    return Array.from(map.entries()).sort().slice(-period);
  }, [pre, period]);

  const maxCovers = Math.max(1, ...byDay.map(([, v]) => v));
  const maxRevenue = Math.max(1, ...revenueByDay.map(([, v]) => v));

  return (
    <div className="mx-auto max-w-5xl px-5 py-7">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl">Statistiche</h1>
          <p className="text-sm text-muted-foreground">Ultimi {period} giorni.</p>
        </div>
        <div className="flex gap-1 rounded-xl border border-border bg-card p-1">
          {([7, 30, 90] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${period === p ? "bg-terracotta text-white" : "text-muted-foreground hover:bg-cream-dark"}`}
            >
              {p}g
            </button>
          ))}
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Card label="Coperti totali" value={stats.covers} />
        <Card label="Prenotazioni" value={stats.resvCount} />
        <Card label="No-show" value={`${stats.noShowRate}%`} />
        <Card label="Pre-ordini €" value={`€${stats.revenue.toFixed(0)}`} />
        <Card label="Scontrino medio" value={stats.avgTicket ? `€${stats.avgTicket.toFixed(0)}` : "—"} />
      </div>

      <p className="mt-2 text-[11px] text-muted-foreground/60">
        ℹ️ Gli importi mostrati si riferiscono ai soli <strong>pre-ordini digitali</strong> ricevuti tramite app — non includono i conti pagati al tavolo.
      </p>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-4 font-display text-xl">Coperti per giorno</h2>
          {byDay.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Nessun dato.</p>
          ) : (
            <div className="flex h-48 items-end gap-1">
              {byDay.map(([d, v]) => (
                <div key={d} className="group flex flex-1 flex-col items-center gap-1">
                  <div
                    className="w-full rounded-t bg-terracotta transition group-hover:bg-terracotta-dark"
                    style={{ height: `${(v / maxCovers) * 100}%`, minHeight: 2 }}
                    title={`${d}: ${v} coperti`}
                  />
                  <span className="text-[8px] text-muted-foreground">{d.slice(8)}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-4 font-display text-xl">Incasso pre-ordini</h2>
          {revenueByDay.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Nessun dato.</p>
          ) : (
            <div className="flex h-48 items-end gap-1">
              {revenueByDay.map(([d, v]) => (
                <div key={d} className="group flex flex-1 flex-col items-center gap-1">
                  <div
                    className="w-full rounded-t bg-amber-400 transition group-hover:bg-amber-500"
                    style={{ height: `${(v / maxRevenue) * 100}%`, minHeight: 2 }}
                    title={`${d}: €${v.toFixed(0)}`}
                  />
                  <span className="text-[8px] text-muted-foreground">{d.slice(8)}</span>
                </div>
              ))}
            </div>
          )}
        </section>

      </div>
    </div>
  );
}

function Card({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="font-display text-3xl">{value}</div>
      <div className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}
