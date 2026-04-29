import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Sparkles, X, Send, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { askAssistant, getAssistantInsights } from "@/server/assistant";
import { parseAction, needsConfirm, describeAction, executeAction } from "@/lib/assistant-actions";

type Msg = {
  role: "user" | "assistant";
  content: string; // text shown
  pendingAction?: any; // azione in attesa di conferma
};

type Insights = { alerts: { level: "red" | "yellow" | "green"; text: string }[]; chips: string[] };

async function getAuthHeaders(): Promise<HeadersInit | null> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : null;
}

export function FloatingAssistant() {
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [insights, setInsights] = useState<Insights>({ alerts: [], chips: [] });
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Insights ad ogni apertura + ogni 2 minuti
  useEffect(() => {
    let mounted = true;
    let timer: ReturnType<typeof setInterval> | null = null;
    async function load() {
      try {
        const headers = await getAuthHeaders();
        if (!headers) return;
        const r = await getAssistantInsights({ headers });
        if (mounted) setInsights({ alerts: r.alerts || [], chips: r.chips || [] });
      } catch {}
    }
    void load();
    timer = setInterval(load, 120_000);
    return () => { mounted = false; if (timer) clearInterval(timer); };
  }, []);

  // Reset welcome quando apre la prima volta
  useEffect(() => {
    if (open && msgs.length === 0) {
      const intro = insights.alerts.length > 0
        ? `Ciao! 👋 Ho notato:\n${insights.alerts.map((a) => `• ${a.text}`).join("\n")}\n\nVuoi che ti aiuti?`
        : "Ciao! Sono il tuo assistente. Conosco prenotazioni, menu, recensioni e clienti del ristorante in tempo reale. Come posso aiutarti?";
      setMsgs([{ role: "assistant", content: intro }]);
    }
  }, [open, insights.alerts, msgs.length]);

  useEffect(() => { scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight); }, [msgs, busy]);
  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 100); }, [open]);

  async function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content || busy) return;
    setInput("");
    const newMsgs = [...msgs, { role: "user" as const, content }];
    setMsgs(newMsgs);
    setBusy(true);
    try {
      const history = newMsgs
        .filter((m) => !m.pendingAction)
        .map((m) => ({ role: m.role, content: m.content }));
      const headers = await getAuthHeaders();
      if (!headers) { toast.error("Sessione scaduta, accedi di nuovo."); return; }
      const r = await askAssistant({ data: { messages: history }, headers });
      if (r.error === "rate_limit") { toast.error("Troppe richieste, riprova tra poco."); return; }
      if (r.error === "credits") { toast.error("Crediti AI esauriti."); return; }
      if (r.error === "no_restaurant") { toast.error("Ristorante non trovato."); return; }
      if (r.error || !r.content) { toast.error("Errore AI"); return; }

      const action = parseAction(r.content);
      if (!action) {
        setMsgs((m) => [...m, { role: "assistant", content: r.content }]);
        return;
      }

      if (needsConfirm(action)) {
        setMsgs((m) => [...m, {
          role: "assistant",
          content: describeAction(action),
          pendingAction: action,
        }]);
      } else {
        const result = await executeAction(action);
        setMsgs((m) => [...m, { role: "assistant", content: result.message }]);
        if (result.navigate) {
          setTimeout(() => { setOpen(false); nav({ to: result.navigate as string }); }, 800);
        }
      }
    } finally {
      setBusy(false);
    }
  }

  async function confirmAction(idx: number) {
    const msg = msgs[idx];
    if (!msg?.pendingAction) return;
    setBusy(true);
    try {
      const result = await executeAction(msg.pendingAction);
      // Rimuovi pendingAction e aggiungi esito
      setMsgs((m) => {
        const next = [...m];
        next[idx] = { ...next[idx], pendingAction: undefined };
        return [...next, { role: "assistant", content: result.message }];
      });
      if (result.navigate) {
        setTimeout(() => { setOpen(false); nav({ to: result.navigate as string }); }, 800);
      }
    } finally {
      setBusy(false);
    }
  }

  function cancelAction(idx: number) {
    setMsgs((m) => {
      const next = [...m];
      next[idx] = { ...next[idx], pendingAction: undefined, content: next[idx].content + "\n\n_Annullato._" };
      return next;
    });
  }

  const hasAlerts = insights.alerts.length > 0;
  const alertLevel = insights.alerts.find((a) => a.level === "red") ? "red" : insights.alerts.find((a) => a.level === "yellow") ? "yellow" : null;

  return (
    <>
      {/* FAB */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-24 right-4 z-40 grid h-14 w-14 place-items-center rounded-full bg-ink text-yellow shadow-2xl ring-2 ring-yellow transition hover:scale-105 md:bottom-6 md:right-6 md:h-16 md:w-16"
          aria-label="Apri assistente AI"
        >
          <Sparkles className="h-6 w-6 md:h-7 md:w-7" strokeWidth={2.5} />
          {hasAlerts && (
            <span
              className={`absolute -top-1 -right-1 grid h-6 w-6 place-items-center rounded-full text-[10px] font-bold text-paper ring-2 ring-cream ${
                alertLevel === "red" ? "bg-terracotta" : "bg-yellow text-ink"
              }`}
            >
              {insights.alerts.length}
            </span>
          )}
        </button>
      )}

      {/* Drawer */}
      {open && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l-2 border-ink bg-cream shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b-2 border-ink bg-ink px-4 py-3 text-paper">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-yellow" strokeWidth={2.5} />
                <div>
                  <div className="text-sm font-bold uppercase tracking-wider">Assistente AI</div>
                  <div className="text-[10px] text-paper/60">Conosce i tuoi dati in tempo reale</div>
                </div>
              </div>
              <button onClick={() => setOpen(false)} className="grid h-9 w-9 place-items-center rounded-lg border border-paper/20" aria-label="Chiudi">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Alerts */}
            {hasAlerts && (
              <div className="border-b border-ink/10 bg-yellow/20 px-4 py-2">
                {insights.alerts.map((a, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-ink">
                    <AlertCircle className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${a.level === "red" ? "text-terracotta" : "text-ink/60"}`} />
                    <span>{a.text}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-3">
              {msgs.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[88%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2.5 text-sm ${
                    m.role === "user" ? "bg-terracotta text-paper" : "bg-paper border border-ink/10 text-foreground"
                  }`}>
                    {m.content}
                    {m.pendingAction && (
                      <div className="mt-3 flex gap-2 border-t border-ink/10 pt-2">
                        <button
                          onClick={() => confirmAction(i)}
                          disabled={busy}
                          className="flex-1 rounded-lg bg-ink px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-yellow disabled:opacity-50"
                        >
                          Conferma
                        </button>
                        <button
                          onClick={() => cancelAction(i)}
                          disabled={busy}
                          className="rounded-lg border border-ink/20 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-ink/70"
                        >
                          Annulla
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {busy && <div className="text-xs italic text-muted-foreground">Sto pensando...</div>}
            </div>

            {/* Suggested chips */}
            {insights.chips.length > 0 && msgs.length <= 2 && (
              <div className="border-t border-ink/10 bg-cream-dark/30 p-2">
                <div className="mb-1 px-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Suggeriti</div>
                <div className="flex flex-wrap gap-1.5">
                  {insights.chips.map((c) => (
                    <button
                      key={c}
                      onClick={() => send(c)}
                      disabled={busy}
                      className="rounded-full border border-ink/20 bg-paper px-2.5 py-1 text-[11px] hover:border-ink disabled:opacity-50"
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Input */}
            <div className="flex gap-2 border-t-2 border-ink bg-paper p-3 relative">
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                placeholder="Chiedi quello che vuoi..."
                disabled={busy}
                className="min-w-0 flex-1 rounded-lg border border-ink/20 bg-cream px-3 py-2.5 text-sm focus:border-ink focus:outline-none"
              />
              <button
                onClick={() => send()}
                disabled={busy || !input.trim()}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-ink text-yellow disabled:opacity-40"
                aria-label="Invia"
              >
                <Send className="h-4 w-4" strokeWidth={2.5} />
              </button>
            </div>
            <div className="border-t border-ink/10 bg-cream px-3 py-1.5 text-center text-[10px] text-muted-foreground/60">
              Powered by Google Gemini · crediti limitati (1.500 req/giorno)
            </div>
          </div>
        </div>
      )}
    </>
  );
}
