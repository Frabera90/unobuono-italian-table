import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/owner/")({
  head: () => ({ meta: [{ title: "Accesso titolare" }] }),
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
    <main className="grid min-h-screen place-items-center bg-background px-5">
      <div className={`w-full max-w-xs text-center ${shake ? "shake" : ""}`}>
        <p className="font-display text-sm uppercase tracking-[0.3em] text-terracotta">Carpediem</p>
        <h1 className="mt-3 font-display text-3xl">Inserisci il PIN</h1>
        <div className="my-7 flex justify-center gap-3">
          {[0,1,2,3].map((i) => (
            <span key={i} className={`h-4 w-4 rounded-full border-2 transition ${pin.length > i ? "border-terracotta bg-terracotta" : "border-border"}`} />
          ))}
        </div>
        <div className="grid grid-cols-3 gap-3">
          {["1","2","3","4","5","6","7","8","9"].map((d) => (
            <button key={d} onClick={() => press(d)} className="rounded-2xl bg-card py-5 font-display text-2xl shadow-sm hover:bg-cream-dark">{d}</button>
          ))}
          <span />
          <button onClick={() => press("0")} className="rounded-2xl bg-card py-5 font-display text-2xl shadow-sm hover:bg-cream-dark">0</button>
          <button onClick={back} className="rounded-2xl bg-cream-dark py-5 text-xl">←</button>
        </div>
        <p className="mt-6 text-xs text-muted-foreground">Demo · PIN 1234</p>
      </div>
    </main>
  );
}
