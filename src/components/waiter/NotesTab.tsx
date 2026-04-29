import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { relTime } from "@/lib/restaurant";
import { toast } from "sonner";

export type StaffNote = {
  id: string;
  restaurant_id: string;
  body: string;
  author_name: string | null;
  pinned: boolean;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
};

export function NotesTab({
  restaurantId,
  pin,
  staffName,
}: {
  restaurantId: string;
  pin: string;
  staffName: string;
}) {
  const [notes, setNotes] = useState<StaffNote[]>([]);
  const [filter, setFilter] = useState<"active" | "resolved">("active");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void supabase
      .from("staff_notes")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .order("pinned", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(100)
      .then(({ data }) => setNotes((data || []) as StaffNote[]));

    const ch = supabase
      .channel(`w-notes-${restaurantId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "staff_notes", filter: `restaurant_id=eq.${restaurantId}` },
        (p) => {
          if (p.eventType === "DELETE") {
            setNotes((prev) => prev.filter((n) => n.id !== (p.old as StaffNote).id));
          } else if (p.eventType === "INSERT") {
            setNotes((prev) => [p.new as StaffNote, ...prev]);
          } else {
            setNotes((prev) => prev.map((n) => (n.id === (p.new as StaffNote).id ? (p.new as StaffNote) : n)));
          }
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [restaurantId]);

  async function addNote() {
    if (!body.trim()) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("staff_create_note", {
      _pin: pin,
      _body: body.trim(),
      _author_name: staffName || null,
    });
    setBusy(false);
    if (error || !data) {
      toast.error("Errore");
      return;
    }
    setBody("");
    toast.success("Nota condivisa");
  }

  async function togglePinned(n: StaffNote) {
    const { error } = await supabase.rpc("staff_update_note", {
      _pin: pin,
      _note_id: n.id,
      _pinned: !n.pinned,
    });
    if (error) toast.error("Errore");
  }

  async function toggleResolved(n: StaffNote) {
    const { error } = await supabase.rpc("staff_update_note", {
      _pin: pin,
      _note_id: n.id,
      _resolved: !n.resolved_at,
    });
    if (error) toast.error("Errore");
  }

  async function remove(n: StaffNote) {
    if (!confirm("Eliminare questa nota?")) return;
    const { error } = await supabase.rpc("staff_delete_note", { _pin: pin, _note_id: n.id });
    if (error) toast.error("Errore");
  }

  const visible = notes.filter((n) => (filter === "active" ? !n.resolved_at : !!n.resolved_at));

  return (
    <div className="space-y-3">
      {/* Composer */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={2}
          placeholder="Scrivi una nota condivisa con tutto lo staff e l'owner…"
          className="w-full resize-none rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-paper placeholder:text-paper/40 focus:border-yellow focus:outline-none"
        />
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="text-[11px] text-paper/50">
            👤 {staffName || "Staff"} · visibile a tutti
          </span>
          <button
            onClick={addNote}
            disabled={busy || !body.trim()}
            className="rounded-lg border-2 border-yellow bg-yellow px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-ink hover:bg-yellow/90 disabled:opacity-50"
          >
            {busy ? "..." : "Pubblica"}
          </button>
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setFilter("active")}
          className={`flex-1 rounded-lg border px-3 py-2 text-xs font-bold uppercase tracking-wider ${filter === "active" ? "border-yellow bg-yellow text-ink" : "border-white/15 text-paper/70"}`}
        >
          Attive ({notes.filter((n) => !n.resolved_at).length})
        </button>
        <button
          onClick={() => setFilter("resolved")}
          className={`flex-1 rounded-lg border px-3 py-2 text-xs font-bold uppercase tracking-wider ${filter === "resolved" ? "border-yellow bg-yellow text-ink" : "border-white/15 text-paper/70"}`}
        >
          Archiviate
        </button>
      </div>

      {visible.length === 0 && (
        <p className="rounded-2xl border border-white/10 p-8 text-center text-paper/60">
          {filter === "active" ? "Nessuna nota attiva. Scrivi qualcosa che lo staff deve sapere." : "Nessuna nota archiviata."}
        </p>
      )}

      <ul className="space-y-2">
        {visible.map((n) => (
          <li
            key={n.id}
            className={`rounded-xl border p-3 text-sm ${
              n.resolved_at
                ? "border-white/5 bg-white/[0.02] text-paper/50"
                : n.pinned
                  ? "border-yellow/40 bg-yellow/5"
                  : "border-white/10 bg-white/5"
            }`}
          >
            <div className="flex items-start gap-3">
              <button
                onClick={() => toggleResolved(n)}
                className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md border-2 ${n.resolved_at ? "border-emerald-500 bg-emerald-500 text-ink" : "border-white/30 hover:border-yellow"}`}
                aria-label="Archivia"
                title={n.resolved_at ? "Riapri" : "Archivia"}
              >
                {n.resolved_at ? "✓" : ""}
              </button>
              <div className="min-w-0 flex-1">
                <div className={`whitespace-pre-wrap break-words ${n.resolved_at ? "line-through" : ""}`}>
                  {n.pinned && !n.resolved_at && <span className="mr-1.5">📌</span>}
                  {n.body}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-paper/50">
                  <span>👤 {n.author_name || "Staff"}</span>
                  <span>· {relTime(n.created_at)}</span>
                </div>
              </div>
              <div className="flex shrink-0 flex-col gap-1">
                {!n.resolved_at && (
                  <button
                    onClick={() => togglePinned(n)}
                    className={`rounded-md px-2 py-1 text-base ${n.pinned ? "text-yellow" : "text-paper/40 hover:text-paper/80"}`}
                    aria-label="Fissa in alto"
                    title={n.pinned ? "Rimuovi pin" : "Fissa in alto"}
                  >
                    📌
                  </button>
                )}
                <button
                  onClick={() => remove(n)}
                  className="rounded-md px-2 py-1 text-paper/40 hover:bg-white/5 hover:text-paper/80"
                  aria-label="Elimina"
                >
                  ×
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
