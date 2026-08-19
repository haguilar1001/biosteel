import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "APP Bio Steel",
  description: "APP Bio Steel · BioSteel de Colombia S.A.S.",
  robots: { index: false, follow: false }, // app interna, no indexar
  // Favicon = logo BioSteel (lo usan también los lanzadores de apps).
  icons: {
    icon: [{ url: "/BIOSTEEL.png", type: "image/png" }],
    shortcut: "/BIOSTEEL.png",
    apple: "/BIOSTEEL.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#2A4F98",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        {/* Aplica fuente, tamaño, formato de montos y tema guardados ANTES del
            primer pintado (evita el parpadeo). La fuente y el tamaño se
            configuran en Admin ▸ Parametrización; el tema, con el botón de la
            barra superior. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var f=localStorage.getItem('ui.font');var z=localStorage.getItem('ui.zoom');var r=document.documentElement;if(f)r.style.setProperty('--app-font',f);if(z)r.style.setProperty('--app-zoom',z);var m=localStorage.getItem('montos');if(m)r.setAttribute('data-montos',m);var t=localStorage.getItem('tema');if(t&&t!=='auto')r.setAttribute('data-tema',t);}catch(e){}`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
