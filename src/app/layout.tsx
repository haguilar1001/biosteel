import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BioSteel — Flujo de Caja",
  description: "Sistema de flujo de caja de BioSteel de Colombia S.A.S",
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
      <body>{children}</body>
    </html>
  );
}
