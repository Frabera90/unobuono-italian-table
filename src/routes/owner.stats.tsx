import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/owner/stats")({
  head: () => ({ meta: [{ title: "Statistiche — Unobuono" }] }),
  component: StatsPage,
});

function StatsPage() {
  const [resv, setResv] = useState<any[]>([]);
  const [pre, setPre] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);

  useEffect(() => {
    const since = new Date(Date.now() - 30 * 86400e3).toISOString().slice(0, 10);
    Promise.all([
      supabase.from("reservations").select("date, party_size, arrived").gte("date", since),
      supabase.from("preorders").select("total, created_at").gte("created_at", since),
      supabase.from("reviews").select("rating, date"),
    ]).then(([r, p, rv]) => {
      setResv(r.data || []);
      setPre(p.data || []);
      setReviews(rv.data || []);
    });
  }, []);

  const stats = useMemo(() => {
    const covers = resv.reduce((s, r) => s + r.party_size, 0);
    const arrived = resv.filter((r) => r.arrived).length;
    const noShowRate = resv.length ? Math.round(((resv.length - arrived) / resv.length) * 100) : 0;
    const revenue = pre.reduce((s, p) => s + Number(p.total || 0), 0);
    const avgRating = reviews.length ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1) : "—";
    return { covers, resvCount: resv.length, noShowRate, revenue, avgRating, reviewCount: reviews.length };
  }, [resv, pre, reviews]);

  const byDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of resv) map.set(r.date, (map.get(r.date) || 0) + r.party_size);
    return Array.from(map.entries()).sort().slice(-14);
  }, [resv]);

  const max = Math.max(1, ...byDay.map(([, v]) => v));

  return (
    <div className="mx-auto max-w-5xl px-5 py-7">
      <header className="mb-5">
        <h1 className="font-display text-3xl">Statistiche</h1>
        <p className="text-sm text-muted-foreground">Ultimi 30 giorni.</p>
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card label="Coperti totali" value={stats.covers} />
        <Card label="Prenotazioni" value={stats.resvCount} />
        <Card label="No-show" value={`${stats.noShowRate}%`} />
        <Card label="Pre-ordini €" value={`€${stats.revenue.toFixed(0)}`} />
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-4 font-display text-xl">Coperti per giorno</h2>
          {byDay.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Nessun dato.</p>
          ) : (
            <div className="flex h-48 items-end gap-1.5">
              {byDay.map(([d, v]) => (
                <div key={d} className="group flex flex-1 flex-col items-center gap-1">
                  <div className="w-full rounded-t bg-terracotta transition group-hover:bg-terracotta-dark" style={{ height: `${(v / max) * 100}%`, minHeight: 2 }} title={`${d}: ${v}`} />
                  <span className="text-[9px] text-muted-foreground">{d.slice(8)}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-4 font-display text-xl">Recensioni</h2>
          <div className="text-center">
            <div className="font-display text-6xl text-terracotta">{stats.avgRating}</div>
            <div className="mt-1 text-amber-500">★★★★★</div>
            <div className="mt-1 text-sm text-muted-foreground">{stats.reviewCount} recensioni</div>
          </div>
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
