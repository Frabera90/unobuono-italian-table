import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";

const STORAGE_KEY = "cookie_consent_v1";

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setVisible(true);
    } catch {}
  }, []);

  function accept() {
    try { localStorage.setItem(STORAGE_KEY, "accepted"); } catch {}
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookie banner"
      className="fixed inset-x-0 bottom-0 z-50 border-t-2 border-ink bg-ink px-4 py-4 text-paper md:flex md:items-center md:gap-6 md:px-8"
      style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
    >
      <p className="flex-1 text-xs leading-relaxed text-paper/80">
        Usiamo cookie tecnici necessari al funzionamento del servizio (sessione, autenticazione).
        Nessun cookie di profilazione o pubblicità.{" "}
        <Link to="/privacy" className="underline hover:text-yellow">Privacy Policy</Link>
      </p>
      <button
        onClick={accept}
        className="mt-3 shrink-0 rounded-lg border-2 border-yellow bg-yellow px-5 py-2 text-xs font-bold uppercase tracking-wider text-ink hover:bg-yellow/80 md:mt-0"
      >
        Ho capito
      </button>
    </div>
  );
}
