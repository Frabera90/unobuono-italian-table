import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { relTime } from "@/lib/restaurant";
import { toast } from "sonner";

export type StaffTask = {
  id: string;
  restaurant_id: string;
  table_number: string | null;
  reservation_id: string | null;
  call_id: string | null;
  menu_item_id: string | null;
  menu_item_qty: number;
  description: string;
  status: "open" | "done";
  created_by: string | null;
  created_at: string;
  completed_at: string | null;
};

type MenuLite = { id: string; name: string; price: number | null; category: string | null };
type ResvLite = { id: string; customer_name: string; time: string };

export function TodoTab({
  restaurantId,
  pin,
  staffName,
}: {
  restaurantId: string;
  pin: string;
  staffName: string;
}) {
  const [tasks, setTasks] = useState<StaffTask[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [filter, setFilter] = useState<"open" | "done">("open");

  useEffect(() => {
    void supabase
      .from("staff_tasks")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .order("created_at", { ascending: false })
      .limit(100)
      .then(({ data }) => setTasks((data || []) as StaffTask[]));

    const ch = supabase
      .channel(`w-tasks-${restaurantId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "staff_tasks", filter: `restaurant_id=eq.${restaurantId}` },
        (p) => {
          if (p.eventType === "DELETE") {
            setTasks((prev) => prev.filter((t) => t.id !== (p.old as StaffTask).id));
          } else if (p.eventType === "INSERT") {
            setTasks((prev) => [p.new as StaffTask, ...prev]);
          } else {
            setTasks((prev) => prev.map((t) => (t.id === (p.new as StaffTask).id ? (p.new as StaffTask) : t)));
          }
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [restaurantId]);

  async function complete(t: StaffTask) {
    const { data, error } = await supabase.rpc("staff_complete_task", { _pin: pin, _task_id: t.id });
    if (error || !data) {
      toast.error("Errore");
      return;
    }
    if (t.menu_item_id && t.reservation_id) {
      toast.success(`✓ Fatto · piatto aggiunto all'ordine`);
    } else {
      toast.success("✓ Fatto");
    }
  }
  async function reopen(t: StaffTask) {
    const { data, error } = await supabase.rpc("staff_reopen_task", { _pin: pin, _task_id: t.id });
    if (error || !data) toast.error("Errore");
  }
  async function remove(t: StaffTask) {
    if (!confirm("Eliminare questo task?")) return;
    const { data, error } = await supabase.rpc("staff_delete_task", { _pin: pin, _task_id: t.id });
    if (error || !data) toast.error("Errore");
  }

  const visible = tasks.filter((t) => t.status === filter);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setFilter("open")}
          className={`flex-1 rounded-lg border px-3 py-2 text-xs font-bold uppercase tracking-wider ${filter === "open" ? "border-yellow bg-yellow text-ink" : "border-white/15 text-paper/70"}`}
        >
          Da fare ({tasks.filter((t) => t.status === "open").length})
        </button>
        <button
          onClick={() => setFilter("done")}
          className={`flex-1 rounded-lg border px-3 py-2 text-xs font-bold uppercase tracking-wider ${filter === "done" ? "border-yellow bg-yellow text-ink" : "border-white/15 text-paper/70"}`}
        >
          Fatti
        </button>
        <button
          onClick={() => setShowAdd(true)}
          className="rounded-lg border-2 border-yellow bg-yellow px-3 py-2 text-xs font-bold uppercase tracking-wider text-ink hover:bg-yellow/90"
        >
          + Nuovo
        </button>
      </div>

      {visible.length === 0 && (
        <p className="rounded-2xl border border-white/10 p-8 text-center text-paper/60">
          {filter === "open" ? "Nessun task aperto." : "Nessun task completato."}
        </p>
      )}

      <ul className="space-y-2">
        {visible.map((t) => (
          <li
            key={t.id}
            className={`rounded-xl border p-3 text-sm ${t.status === "done" ? "border-white/5 bg-white/[0.02] text-paper/50" : "border-white/10 bg-white/5"}`}
          >
            <div className="flex items-start gap-3">
              <button
                onClick={() => (t.status === "open" ? complete(t) : reopen(t))}
                className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md border-2 ${t.status === "done" ? "border-emerald-500 bg-emerald-500 text-ink" : "border-white/30 hover:border-yellow"}`}
                aria-label="Completa"
              >
                {t.status === "done" ? "✓" : ""}
              </button>
              <div className="min-w-0 flex-1">
                <div className={`break-words ${t.status === "done" ? "line-through" : ""}`}>{t.description}</div>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-paper/50">
                  {t.table_number && (
                    <span className="rounded-full bg-yellow/15 px-2 py-0.5 font-bold text-yellow">
                      Tav. {t.table_number}
                    </span>
                  )}
                  {t.menu_item_id && (
                    <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 font-bold text-emerald-300">
                      🍽️ {t.menu_item_qty}× piatto → ordine
                    </span>
                  )}
                  {t.created_by && <span>👤 {t.created_by}</span>}
                  <span>· {relTime(t.created_at)}</span>
                </div>
              </div>
              <button
                onClick={() => remove(t)}
                className="shrink-0 rounded-md px-2 py-1 text-paper/40 hover:bg-white/5 hover:text-paper/80"
                aria-label="Elimina"
              >
                ×
              </button>
            </div>
          </li>
        ))}
      </ul>

      {showAdd && (
        <AddTaskModal
          restaurantId={restaurantId}
          pin={pin}
          staffName={staffName}
          onClose={() => setShowAdd(false)}
        />
      )}
    </div>
  );
}

export function AddTaskModal({
  restaurantId,
  pin,
  staffName,
  defaultTableNumber,
  defaultDescription,
  callId,
  onClose,
}: {
  restaurantId: string;
  pin: string;
  staffName: string;
  defaultTableNumber?: string;
  defaultDescription?: string;
  callId?: string;
  onClose: () => void;
}) {
  const [description, setDescription] = useState(defaultDescription || "");
  const [tableNumber, setTableNumber] = useState(defaultTableNumber || "");
  const [linkMenu, setLinkMenu] = useState(false);
  const [menu, setMenu] = useState<MenuLite[]>([]);
  const [todayResv, setTodayResv] = useState<ResvLite[]>([]);
  const [menuQuery, setMenuQuery] = useState("");
  const [selectedMenuId, setSelectedMenuId] = useState<string | null>(null);
  const [selectedQty, setSelectedQty] = useState(1);
  const [reservationId, setReservationId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    void supabase
      .from("menu_items")
      .select("id,name,price,category")
      .eq("restaurant_id", restaurantId)
      .eq("available", true)
      .order("category")
      .order("sort_order")
      .then(({ data }) => setMenu((data || []) as MenuLite[]));
    void supabase
      .from("reservations")
      .select("id,customer_name,time")
      .eq("restaurant_id", restaurantId)
      .eq("date", today)
      .order("time")
      .then(({ data }) => setTodayResv((data || []) as ResvLite[]));
  }, [restaurantId]);

  const filteredMenu = useMemo(() => {
    const q = menuQuery.trim().toLowerCase();
    if (!q) return menu.slice(0, 30);
    return menu.filter((m) => m.name.toLowerCase().includes(q)).slice(0, 30);
  }, [menu, menuQuery]);

  async function save() {
    if (!description.trim()) {
      toast.error("Scrivi cosa devi fare");
      return;
    }
    setSaving(true);
    const payload = {
      _pin: pin,
      _description: description.trim(),
      _table_number: tableNumber.trim() || undefined,
      _reservation_id: reservationId || undefined,
      _call_id: callId || undefined,
      _menu_item_id: linkMenu && selectedMenuId ? selectedMenuId : undefined,
      _menu_item_qty: linkMenu ? selectedQty : 1,
      _created_by: staffName || undefined,
    };
    const { data, error } = await supabase.rpc("staff_create_task", payload);
    setSaving(false);
    if (error || !data) {
      toast.error("Errore nella creazione");
      return;
    }
    toast.success("Task aggiunto");
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-end bg-black/60 sm:place-items-center"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full overflow-y-auto rounded-t-3xl bg-ink p-5 sm:max-w-lg sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-xl uppercase tracking-tight">Nuovo task</h3>
          <button onClick={onClose} className="text-2xl text-paper/50">
            ×
          </button>
        </div>

        <label className="text-xs font-bold uppercase tracking-wider text-paper/60">Cosa devi fare?</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          autoFocus
          placeholder="Es. Portare 2 bottiglie d'acqua naturale al tav. 5"
          className="mt-1 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-paper placeholder:text-paper/40"
        />

        <label className="mt-3 block text-xs font-bold uppercase tracking-wider text-paper/60">Tavolo (opz.)</label>
        <input
          value={tableNumber}
          onChange={(e) => setTableNumber(e.target.value)}
          placeholder="es. 5"
          className="mt-1 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-paper placeholder:text-paper/40"
        />

        <div className="mt-4 rounded-xl border border-white/10 p-3">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={linkMenu}
              onChange={(e) => setLinkMenu(e.target.checked)}
              className="h-4 w-4 accent-yellow"
            />
            <span className="font-medium">È un piatto/bevanda da aggiungere all'ordine</span>
          </label>
          <p className="mt-1 text-[10px] text-paper/50">
            Quando spunti "fatto", il piatto verrà aggiunto in automatico al pre-ordine della prenotazione collegata.
          </p>

          {linkMenu && (
            <div className="mt-3 space-y-2">
              <input
                value={menuQuery}
                onChange={(e) => setMenuQuery(e.target.value)}
                placeholder="Cerca piatto..."
                className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm"
              />
              <div className="max-h-40 overflow-y-auto rounded-lg border border-white/10">
                {filteredMenu.length === 0 && (
                  <p className="p-3 text-center text-xs text-paper/50">Nessun piatto.</p>
                )}
                {filteredMenu.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setSelectedMenuId(m.id)}
                    className={`flex w-full items-center justify-between border-b border-white/5 px-3 py-2 text-left text-sm last:border-0 ${selectedMenuId === m.id ? "bg-yellow/20 text-yellow" : "hover:bg-white/5"}`}
                  >
                    <span className="truncate">{m.name}</span>
                    <span className="ml-2 shrink-0 text-xs text-paper/50">€ {Number(m.price || 0).toFixed(2)}</span>
                  </button>
                ))}
              </div>

              {selectedMenuId && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-paper/60">Quantità:</span>
                  <button
                    onClick={() => setSelectedQty((q) => Math.max(1, q - 1))}
                    className="grid h-8 w-8 place-items-center rounded-md border border-white/15"
                  >
                    −
                  </button>
                  <span className="w-8 text-center font-bold">{selectedQty}</span>
                  <button
                    onClick={() => setSelectedQty((q) => q + 1)}
                    className="grid h-8 w-8 place-items-center rounded-md border border-white/15"
                  >
                    +
                  </button>
                </div>
              )}

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-paper/60">
                  Aggiungi all'ordine di:
                </label>
                <select
                  value={reservationId || ""}
                  onChange={(e) => setReservationId(e.target.value || null)}
                  className="mt-1 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm"
                >
                  <option value="">— Seleziona prenotazione —</option>
                  {todayResv.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.time} · {r.customer_name}
                    </option>
                  ))}
                </select>
                {linkMenu && selectedMenuId && !reservationId && (
                  <p className="mt-1 text-[10px] text-amber-400">
                    ⚠️ Seleziona una prenotazione, altrimenti il piatto non si aggiungerà a nessun ordine.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="mt-5 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-white/15 px-4 py-3 text-sm font-medium text-paper/70"
          >
            Annulla
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="flex-1 rounded-lg border-2 border-yellow bg-yellow px-4 py-3 text-sm font-bold uppercase tracking-wider text-ink disabled:opacity-50"
          >
            {saving ? "Salvo..." : "Salva task"}
          </button>
        </div>
      </div>
    </div>
  );
}
