import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { relTime, isoDate } from "@/lib/restaurant";
import { playDing } from "@/lib/sounds";
import { toast } from "sonner";
import { TodoTab, AddTaskModal } from "@/components/waiter/TodoTab";

export const Route = createFileRoute("/waiter")({
  head: () => ({
    meta: [
      { title: "Sala — Unobuono" },
      { name: "theme-color", content: "#0a0a0a" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "Sala" },
    ],
    links: [
      { rel: "manifest", href: "/staff.webmanifest" },
    ],
  }),
  component: WaiterPage,
});

type Tab = "calls" | "todo" | "reservations" | "preorders";

type Call = { id: string; table_number: string; customer_name: string | null; message: string | null; status: string; created_at: string; restaurant_id: string };
type Resv = {
  id: string; customer_name: string; party_size: number; date: string; time: string; zone_name: string | null;
  occasion: string | null; allergies: string | null; arrived: boolean; restaurant_id: string;
};
type Preo = { id: string; reservation_id: string | null; customer_name: string | null; items: any; total: number | null; status: string; created_at: string; restaurant_id: string };

function WaiterPage() {
  const nav = useNavigate();
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [pin, setPin] = useState<string | null>(null);
  const [staffName, setStaffName] = useState<string>("");
  const [tab, setTab] = useState<Tab>("calls");
  const [calls, setCalls] = useState<Call[]>([]);
  const [reservations, setReservations] = useState<Resv[]>([]);
  const [preorders, setPreorders] = useState<Preo[]>([]);
  const [readCalls, setReadCalls] = useState(0);
  const [readPre, setReadPre] = useState(0);
  const [showInstall, setShowInstall] = useState(false);
  const [taskFromCall, setTaskFromCall] = useState<Call | null>(null);

  const today = isoDate(new Date());

  // gate: must have PIN/restaurant in localStorage, else redirect to /staff
  useEffect(() => {
    if (typeof window === "undefined") return;
    const rid = localStorage.getItem("staff.restaurant_id");
    const p = localStorage.getItem("staff.pin");
    const n = localStorage.getItem("staff.name") || "";
    if (!rid || !p) { nav({ to: "/staff" }); return; }
    setRestaurantId(rid);
    setPin(p);
    setStaffName(n);
    if (!localStorage.getItem("waiter-install-dismissed")) setShowInstall(true);
  }, [nav]);

  useEffect(() => {
    if (!restaurantId) return;
    void supabase.from("waiter_calls").select("*").eq("restaurant_id", restaurantId).eq("status", "pending").order("created_at", { ascending: false }).then(({ data }) => {
      setCalls((data || []) as Call[]);
      setReadCalls((data || []).length);
    });
    void supabase.from("reservations").select("*").eq("restaurant_id", restaurantId).eq("date", today).order("time").then(({ data }) => setReservations((data || []) as Resv[]));
    void supabase.from("preorders").select("*").eq("restaurant_id", restaurantId).order("created_at", { ascending: false }).then(({ data }) => {
      setPreorders((data || []) as Preo[]);
      setReadPre((data || []).length);
    });

    const c1 = supabase.channel(`w-calls-${restaurantId}`).on("postgres_changes", { event: "*", schema: "public", table: "waiter_calls", filter: `restaurant_id=eq.${restaurantId}` }, (p) => {
      if (p.eventType === "INSERT") {
        setCalls((prev) => [p.new as Call, ...prev]);
        try { playDing(); } catch {}
        toast.success(`🔔 Tavolo ${(p.new as Call).table_number}`);
      } else if (p.eventType === "UPDATE") {
        setCalls((prev) => prev.map((x) => x.id === (p.new as Call).id ? (p.new as Call) : x).filter((x) => x.status === "pending"));
      }
    }).subscribe();

    const c2 = supabase.channel(`w-resv-${restaurantId}`).on("postgres_changes", { event: "*", schema: "public", table: "reservations", filter: `restaurant_id=eq.${restaurantId}` }, (p) => {
      const row = (p.new || p.old) as Resv;
      if (row.date !== today) return;
      if (p.eventType === "DELETE") setReservations((prev) => prev.filter((r) => r.id !== row.id));
      else setReservations((prev) => {
        const i = prev.findIndex((r) => r.id === row.id);
        if (i === -1) return [...prev, row].sort((a, b) => a.time.localeCompare(b.time));
        const copy = [...prev]; copy[i] = row; return copy;
      });
    }).subscribe();

    const c3 = supabase.channel(`w-pre-${restaurantId}`).on("postgres_changes", { event: "*", schema: "public", table: "preorders", filter: `restaurant_id=eq.${restaurantId}` }, (p) => {
      const row = (p.new || p.old) as Preo;
      if (p.eventType === "DELETE") setPreorders((prev) => prev.filter((r) => r.id !== row.id));
      else setPreorders((prev) => {
        const i = prev.findIndex((r) => r.id === row.id);
        if (i === -1) return [row, ...prev];
        const copy = [...prev]; copy[i] = row; return copy;
      });
    }).subscribe();

    return () => { void supabase.removeChannel(c1); void supabase.removeChannel(c2); void supabase.removeChannel(c3); };
  }, [restaurantId, today]);

  async function markCallSeen(id: string) {
    if (!pin) return;
    const { data, error } = await supabase.rpc("staff_mark_call_seen", { _call_id: id, _pin: pin });
    if (error || !data) toast.error("Errore");
    else setCalls((prev) => prev.filter((x) => x.id !== id));
  }
  async function toggleArrived(r: Resv) {
    if (!pin) return;
    const { data, error } = await supabase.rpc("staff_toggle_arrived", { _reservation_id: r.id, _pin: pin });
    if (error || !data) toast.error("Errore");
  }
  async function setPreoStatus(p: Preo, status: string) {
    if (!pin) return;
    // Toggle: se è già attivo lo stato cliccato, torna a "pending"
    const next = p.status === status ? "pending" : status;
    const { data, error } = await supabase.rpc("staff_set_preorder_status", { _preorder_id: p.id, _status: next, _pin: pin });
    if (error || !data) toast.error("Errore");
  }
  function logout() {
    localStorage.removeItem("staff.restaurant_id");
    localStorage.removeItem("staff.pin");
    localStorage.removeItem("staff.name");
    nav({ to: "/staff" });
  }

  if (!restaurantId) return <div className="grid min-h-screen place-items-center bg-ink text-paper/60 text-sm">Caricamento...</div>;

  const callsBadge = calls.length;
  const preBadge = Math.max(0, preorders.filter((p) => p.status !== "served").length - readPre);

  return (
    <main className="min-h-screen bg-ink text-paper">
      {showInstall && (
        <div className="border-b-2 border-yellow bg-yellow px-4 py-2 text-center text-xs font-bold uppercase tracking-wider text-ink">
          💡 Aggiungi alla home per le notifiche
          <button className="ml-3 text-ink/60" onClick={() => { localStorage.setItem("waiter-install-dismissed", "1"); setShowInstall(false); }}>×</button>
        </div>
      )}
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2 text-xs">
        <span className="text-paper/60">👤 {staffName || "Staff"}</span>
        <button onClick={logout} className="text-paper/50 underline hover:text-paper">Esci</button>
      </div>
      <div className="sticky top-0 z-10 grid grid-cols-4 border-b-2 border-yellow bg-ink">
        <TabBtn active={tab === "calls"} onClick={() => { setTab("calls"); setReadCalls(calls.length); }} badge={callsBadge}>🔔 Call</TabBtn>
        <TabBtn active={tab === "todo"} onClick={() => setTab("todo")}>✅ To-do</TabBtn>
        <TabBtn active={tab === "reservations"} onClick={() => setTab("reservations")}>📋 Oggi</TabBtn>
        <TabBtn active={tab === "preorders"} onClick={() => { setTab("preorders"); setReadPre(preorders.length); }} badge={preBadge}>📦 Pre</TabBtn>
      </div>

      <div className="mx-auto max-w-2xl px-4 py-5">
        {tab === "calls" && (
          <ul className="space-y-3">
            {calls.length === 0 && <li className="rounded-2xl border border-white/10 p-8 text-center text-paper/60">Nessuna chiamata in attesa.</li>}
            {calls.map((c) => (
              <li key={c.id} className="slide-in-right rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="font-display text-4xl text-yellow sm:text-5xl">Tav. {c.table_number}</div>
                    {c.customer_name && <div className="mt-1 text-sm text-paper/70">{c.customer_name}</div>}
                    <div className="mt-2 text-base">{c.message}</div>
                    <div className="mt-1 text-xs text-paper/50">{relTime(c.created_at)}</div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button onClick={() => setTaskFromCall(c)} className="rounded-lg border-2 border-yellow bg-transparent px-3 py-2 text-xs font-bold uppercase tracking-wider text-yellow hover:bg-yellow/10">+ Task</button>
                    <button onClick={() => markCallSeen(c.id)} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold uppercase tracking-wider text-paper hover:bg-emerald-500">✓ Visto</button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        {tab === "todo" && (
          <TodoTab restaurantId={restaurantId} pin={pin || ""} staffName={staffName} />
        )}

        {tab === "reservations" && (
          <ResvList reservations={reservations} preorders={preorders} onToggle={toggleArrived} />
        )}

        {tab === "preorders" && (() => {
          const todayResvIds = new Set(reservations.map((r) => r.id));
          const todayPre = preorders.filter((p) => !p.reservation_id || todayResvIds.has(p.reservation_id));
          return (
          <ul className="space-y-3">
            {todayPre.length === 0 && <li className="rounded-2xl border border-white/10 p-8 text-center text-paper/60">Nessun pre-ordine per oggi.</li>}
            {todayPre.map((p) => {
              const linked = reservations.find((r) => r.id === p.reservation_id);
              return (
                <li key={p.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-baseline justify-between">
                    <div className="font-display text-xl">{p.customer_name}</div>
                    {linked && <div className="font-display text-xl text-yellow">{linked.time}</div>}
                  </div>
                  <ul className="mt-3 space-y-1 text-sm">
                    {(Array.isArray(p.items) ? p.items : []).map((it: any, i: number) => (
                      <li key={i} className="flex justify-between"><span>{it.qty}× {it.name}</span><span className="text-paper/60">€ {(it.qty * it.price).toFixed(2)}</span></li>
                    ))}
                  </ul>
                  <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3">
                    <div className="font-display text-lg">€ {Number(p.total).toFixed(2)}</div>
                    <div className="flex gap-2">
                      <StatusBtn active={p.status === "preparing"} onClick={() => setPreoStatus(p, "preparing")}>In preparazione</StatusBtn>
                      <StatusBtn active={p.status === "ready"} onClick={() => setPreoStatus(p, "ready")}>Pronto</StatusBtn>
                    </div>
                  </div>
                  <p className="mt-2 text-[10px] text-paper/40">Tocca di nuovo lo stato per annullare</p>
                </li>
              );
            })}
          </ul>
          );
        })()}
      </div>

      {taskFromCall && pin && (
        <AddTaskModal
          restaurantId={restaurantId}
          pin={pin}
          staffName={staffName}
          defaultTableNumber={taskFromCall.table_number}
          defaultDescription={taskFromCall.message ? `Tav. ${taskFromCall.table_number}: ${taskFromCall.message}` : `Tav. ${taskFromCall.table_number}`}
          callId={taskFromCall.id}
          onClose={() => setTaskFromCall(null)}
        />
      )}
    </main>
  );
}

function TabBtn({ active, onClick, children, badge }: { active: boolean; onClick: () => void; children: React.ReactNode; badge?: number }) {
  return (
    <button onClick={onClick} className={`relative px-2 py-4 text-sm font-medium transition ${active ? "text-yellow" : "text-paper/60"}`}>
      {children}
      {badge ? <span className="absolute right-2 top-2 inline-flex min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-paper">{badge}</span> : null}
      {active && <span className="absolute inset-x-2 bottom-0 h-0.5 bg-yellow" />}
    </button>
  );
}

function StatusBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`rounded-md px-3 py-1.5 text-xs ${active ? "bg-yellow text-ink" : "border border-white/15 text-paper/80"}`}>{children}</button>
  );
}

function ResvList({ reservations, preorders, onToggle }: { reservations: Resv[]; preorders: Preo[]; onToggle: (r: Resv) => void }) {
  const [open, setOpen] = useState<string | null>(null);
  const preMap = useMemo(() => {
    const m = new Map<string, Preo>();
    for (const p of preorders) if (p.reservation_id) m.set(p.reservation_id, p);
    return m;
  }, [preorders]);

  if (reservations.length === 0) return <p className="rounded-2xl border border-white/10 p-8 text-center text-paper/60">Nessuna prenotazione oggi.</p>;

  return (
    <ul className="space-y-3">
      {reservations.map((r) => {
        const exp = open === r.id;
        const pre = preMap.get(r.id);
        return (
          <li key={r.id} className="rounded-2xl border border-white/10 bg-white/5">
            <button onClick={() => setOpen(exp ? null : r.id)} className="flex w-full items-center gap-4 p-4 text-left">
              <div className="font-display text-3xl text-yellow">{r.time}</div>
              <div className="min-w-0 flex-1">
                <div className="font-display text-base">{r.customer_name} · {r.party_size} pers</div>
                <div className="truncate text-xs text-paper/60">{r.zone_name}</div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {r.occasion && <Badge>🎂 {r.occasion}</Badge>}
                  {pre && <Badge>🛵 Pre-ordinato</Badge>}
                  {r.allergies && <Badge tone="warn">⚠️ Allergie</Badge>}
                </div>
              </div>
              <label onClick={(e) => e.stopPropagation()} className="flex items-center gap-2">
                <span className={`relative h-6 w-11 rounded-full transition ${r.arrived ? "bg-emerald-500" : "bg-white/15"}`}>
                  <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-paper transition ${r.arrived ? "left-[22px]" : "left-0.5"}`} />
                  <input type="checkbox" checked={r.arrived} onChange={() => onToggle(r)} className="sr-only" />
                </span>
              </label>
            </button>
            {exp && (
              <div className="border-t border-white/10 p-4 text-sm">
                {r.allergies && <p>⚠️ <span className="text-paper/70">Allergie:</span> {r.allergies}</p>}
                {r.occasion && <p>🎉 <span className="text-paper/70">Occasione:</span> {r.occasion}</p>}
                {pre && (
                  <div className="mt-2">
                    <p className="text-paper/70">Pre-ordine (€ {Number(pre.total).toFixed(2)}):</p>
                    <ul className="mt-1 space-y-0.5">
                      {(Array.isArray(pre.items) ? pre.items : []).map((it: any, i: number) => <li key={i}>· {it.qty}× {it.name}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function Badge({ children, tone }: { children: React.ReactNode; tone?: "warn" }) {
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${tone === "warn" ? "bg-amber-500/20 text-amber-300" : "bg-yellow/20 text-yellow"}`}>{children}</span>;
}
