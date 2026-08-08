"use client";
// Pestañas internas (nivel 3) de la sección de Administración activa.
// Recibe las secciones ya filtradas por permiso; solo dibuja pestañas cuando
// la sección activa tiene más de una página visible.
import Link from "next/link";
import { usePathname } from "next/navigation";

export interface Tab { href: string; label: string; }
export interface Seccion { id: string; tabs: Tab[]; }

export function AdminTabs({ secciones }: { secciones: Seccion[] }) {
  const pathname = usePathname();
  const activa = secciones.find((s) =>
    s.tabs.some((t) => pathname === t.href || pathname.startsWith(t.href + "/")),
  );
  if (!activa || activa.tabs.length < 2) return null;

  return (
    <div className="subnav" style={{ marginBottom: 16 }}>
      {activa.tabs.map((t) => {
        const on = pathname === t.href || pathname.startsWith(t.href + "/");
        return (
          <Link key={t.href} href={t.href} className={on ? "active" : undefined}>
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
