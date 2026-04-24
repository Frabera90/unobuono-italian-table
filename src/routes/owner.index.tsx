import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/owner/")({
  head: () => ({ meta: [{ title: "Accesso titolare — Unobuono" }] }),
  component: PinPage,
});

function PinPage() {
  const navigate = useNavigate();
  const [pin, setPin] = useState("");
  const [shake, setShake] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && sessionStorage.getItem("owner-ok") === "1") {
      navigate({ to: "/owner/dashboard" });
    }
  }, [navigate]);

  function press(d: string) {
    if (pin.length >= 4) return;
    const next = pin + d;
    setPin(next);
    if (next.length === 4) {
      if (next === "1234") {
        sessionStorage.setItem("owner-ok", "1");
        setTimeout(() => navigate({ to: "/owner/dashboard" }), 150);
      } else {
        setShake(true);
        setTimeout(() => { setShake(false); setPin(""); }, 500);
      }
    }
  }
  function back() { setPin(pin.slice(0, -1)); }

  return (
    <main className="grid min-h-screen place-items-center bg-yellow px-5">
      <div className={`w-full max-w-xs text-center ${shake ? "shake" : ""}`}>
        <div className="mb-8 inline-flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-ink font-display text-yellow">U</span>
          <span className="font-display text-2xl uppercase tracking-tight">UNOBUONO</span>
        </div>
        <h1 className="font-display text-4xl uppercase leading-none">Inserisci<br />il PIN</h1>
        <div className="my-8 flex justify-center gap-3">
          {[0,1,2,3].map((i) => (
            <span key={i} className={`h-4 w-4 rounded-full border-2 border-ink transition ${pin.length > i ? "bg-ink" : "bg-paper"}`} />
          ))}
        </div>
        <div className="grid grid-cols-3 gap-3">
          {["1","2","3","4","5","6","7","8","9"].map((d) => (
            <button key={d} onClick={() => press(d)} className="rounded-2xl border-2 border-ink bg-paper py-5 font-display text-2xl shadow-brut-sm transition hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-brut active:translate-x-[2px] active:translate-y-[2px] active:shadow-none">{d}</button>
          ))}
          <span />
          <button onClick={() => press("0")} className="rounded-2xl border-2 border-ink bg-paper py-5 font-display text-2xl shadow-brut-sm transition hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-brut">0</button>
          <button onClick={back} className="rounded-2xl border-2 border-ink bg-ink py-5 text-xl text-yellow shadow-brut-sm">←</button>
        </div>
        <p className="mt-7 font-mono text-[10px] uppercase tracking-widest text-ink/70">Demo · PIN 1234</p>
      </div>
    </main>
  );
}
