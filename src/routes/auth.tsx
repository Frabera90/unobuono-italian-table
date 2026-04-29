import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { toast } from "sonner";
import { BrandMark } from "@/components/brand";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Accedi — Unobuono" }] }),
  component: AuthPage,
});

function AuthPage() {
  const nav = useNavigate();
  const [mode, setMode] = useState<"login" | "signup" | "reset">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  // If already logged in → go to owner area
  useEffect(() => {
    let redirected = false;
    function goOwner() {
      if (redirected) return;
      redirected = true;
      nav({ to: "/owner/dashboard" });
    }
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) goOwner();
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === "SIGNED_IN" || event === "INITIAL_SESSION") && session) goOwner();
    });
    return () => sub.subscription.unsubscribe();
  }, [nav]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin + "/callback",
            data: { full_name: name },
          },
        });
        if (error) throw error;
        toast.success("Account creato! Controlla la tua email per confermare la registrazione.");
      } else if (mode === "reset") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin + "/callback?type=recovery",
        });
        if (error) throw error;
        setResetSent(true);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Bentornato!");
      }
    } catch (err: any) {
      toast.error(err.message || "Errore");
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    setBusy(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin + "/callback",
      });
      if (result.error) {
        toast.error("Errore Google login: " + (result.error.message || "riprova"));
        setBusy(false);
        return;
      }
      if (result.redirected) {
        // Browser sta reindirizzando a Google, niente da fare
        return;
      }
      // Sessione già impostata: il listener onAuthStateChange farà il redirect
    } catch (e: any) {
      toast.error(e.message || "Errore Google login");
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-cream px-5 py-10">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-6 flex flex-col items-center gap-2 text-center">
          <BrandMark variant="dark" className="h-12 w-12" />
          <span className="font-display text-2xl text-ink">UNOBUONO</span>
        </Link>

        <div className="rounded-2xl border-2 border-ink bg-paper p-6 shadow-[8px_8px_0_0_hsl(var(--ink))]">
          {mode === "reset" ? (
            <>
              <h2 className="mb-1 font-display text-xl text-ink">Recupera password</h2>
              <p className="mb-4 text-sm text-ink/60">Inserisci la tua email e ti mandiamo un link per reimpostare la password.</p>
              {resetSent ? (
                <div className="rounded-lg border border-green-400/40 bg-green-50 p-4 text-sm text-green-800">
                  ✓ Email inviata! Controlla la tua casella di posta.
                </div>
              ) : (
                <form onSubmit={submit} className="space-y-3">
                  <Field label="Email">
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="auth-in" placeholder="mario@ristorante.it" />
                  </Field>
                  <button type="submit" disabled={busy} className="w-full rounded-lg border-2 border-ink bg-yellow py-2.5 text-sm font-bold uppercase tracking-wider text-ink transition hover:bg-yellow/80 disabled:opacity-50">
                    {busy ? "Invio..." : "Invia link di recupero"}
                  </button>
                </form>
              )}
              <button onClick={() => { setMode("login"); setResetSent(false); }} className="mt-4 block w-full text-center text-xs text-muted-foreground hover:text-ink">
                ← Torna al login
              </button>
            </>
          ) : (
            <>
              <div className="mb-5 flex gap-2 rounded-lg bg-cream-dark p-1">
                <button type="button" onClick={() => setMode("login")} className={`flex-1 rounded-md py-2 text-sm font-bold uppercase tracking-wider transition ${mode === "login" ? "bg-paper text-ink shadow-sm" : "text-ink/60"}`}>Accedi</button>
                <button type="button" onClick={() => setMode("signup")} className={`flex-1 rounded-md py-2 text-sm font-bold uppercase tracking-wider transition ${mode === "signup" ? "bg-paper text-ink shadow-sm" : "text-ink/60"}`}>Registrati</button>
              </div>

              <button type="button" onClick={google} disabled={busy} className="mb-4 flex w-full items-center justify-center gap-3 rounded-lg border-2 border-ink bg-paper py-2.5 text-sm font-bold uppercase tracking-wider text-ink transition hover:bg-cream-dark disabled:opacity-50">
                <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 16.1 19 13 24 13c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.4 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2 1.5-4.5 2.4-7.2 2.4-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.1 5.6l6.2 5.2C40.9 35.7 44 30.3 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>
                Continua con Google
              </button>

              <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="h-px flex-1 bg-border" /> oppure <span className="h-px flex-1 bg-border" />
              </div>

              <form onSubmit={submit} className="space-y-3">
                {mode === "signup" && (
                  <Field label="Nome">
                    <input value={name} onChange={(e) => setName(e.target.value)} required className="auth-in" placeholder="Mario Rossi" />
                  </Field>
                )}
                <Field label="Email">
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="auth-in" placeholder="mario@ristorante.it" />
                </Field>
                <Field label="Password">
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} className="auth-in" placeholder="Min. 6 caratteri" />
                </Field>
                <button type="submit" disabled={busy} className="w-full rounded-lg border-2 border-ink bg-yellow py-2.5 text-sm font-bold uppercase tracking-wider text-ink transition hover:bg-yellow/80 disabled:opacity-50">
                  {busy ? "Attendi..." : mode === "login" ? "Accedi" : "Crea account"}
                </button>
              </form>

              {mode === "login" && (
                <button onClick={() => setMode("reset")} className="mt-3 block w-full text-center text-xs text-muted-foreground hover:text-ink">
                  Password dimenticata?
                </button>
              )}

              <p className="mt-4 text-center text-[11px] text-muted-foreground">
                Registrandoti accetti i <Link to="/terms" className="underline">Termini di servizio</Link> e la <Link to="/privacy" className="underline">Privacy Policy</Link>.
              </p>
            </>
          )}
        </div>

        <Link to="/" className="mt-6 block text-center text-xs uppercase tracking-wider text-muted-foreground hover:text-ink">
          ← Torna alla home
        </Link>
      </div>

      <style>{`.auth-in{width:100%;border:2px solid hsl(var(--ink));background:hsl(var(--paper));border-radius:8px;padding:8px 12px;font-size:14px}`}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-ink/70">{label}</span>
      {children}
    </label>
  );
}
