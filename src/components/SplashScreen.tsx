import { useEffect, useState } from "react";
import logoWordmark from "@/assets/logo-wordmark.png";

/**
 * Splash di caricamento per l'app installata su desktop/PWA.
 * Mostra il wordmark Unobuono nero su sfondo giallo.
 * Si nasconde dopo il primo paint o entro 900ms.
 */
export function SplashScreen() {
  const [show, setShow] = useState(() => {
    if (typeof window === "undefined") return false;
    // Mostra solo in modalità standalone (PWA installata)
    const isStandalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      // @ts-expect-error iOS Safari
      window.navigator.standalone === true;
    return isStandalone;
  });

  useEffect(() => {
    if (!show) return;
    const t = setTimeout(() => setShow(false), 900);
    return () => clearTimeout(t);
  }, [show]);

  if (!show) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] grid place-items-center"
      style={{ backgroundColor: "#FFD60A", animation: "splashFade 0.4s ease 0.6s forwards" }}
    >
      <style>{`
        @keyframes splashFade {
          to { opacity: 0; visibility: hidden; }
        }
        @keyframes splashPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.04); }
        }
      `}</style>
      <img
        src={logoWordmark}
        alt="Unobuono"
        className="w-[60%] max-w-xs object-contain"
        style={{ animation: "splashPulse 1.2s ease-in-out infinite" }}
        draggable={false}
      />
    </div>
  );
}
