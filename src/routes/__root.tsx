import { Outlet, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-7xl text-foreground">404</h1>
        <p className="mt-4 text-muted-foreground">Pagina non trovata.</p>
        <a href="/" className="mt-6 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Torna alla home</a>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "Unobuono — Gestione ristorante" },
      { name: "description", content: "Gestionale ristorante con AI: prenotazioni, menu live, sala, CRM e social." },
      { name: "theme-color", content: "#c4592a" },
      { property: "og:title", content: "Unobuono — Gestione ristorante" },
      { property: "og:description", content: "Gestionale ristorante con AI: prenotazioni, menu live, sala, CRM e social." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "Unobuono — Gestione ristorante" },
      { name: "twitter:description", content: "Gestionale ristorante con AI: prenotazioni, menu live, sala, CRM e social." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/c4012b78-d938-4d0f-a5d5-b5fe68956f31/id-preview-c27dd672--fb68cda5-5b80-4347-a8c8-9eecc42469b7.lovable.app-1776950896021.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/c4012b78-d938-4d0f-a5d5-b5fe68956f31/id-preview-c27dd672--fb68cda5-5b80-4347-a8c8-9eecc42469b7.lovable.app-1776950896021.png" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400;1,600&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: () => (
    <>
      <Outlet />
      <Toaster position="top-center" richColors />
    </>
  ),
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
