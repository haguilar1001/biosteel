"use client";
// ==========================================================
// Navegación en dos niveles:
//  - GruposBar: grupos en la barra azul (junto al logo).
//  - SubMenu:   opciones del grupo activo, en la línea de menú.
// El grupo activo se deduce de la ruta actual (el ítem más específico gana).
// ==========================================================
import Link from "next/link";
import { usePathname } from "next/navigation";

export interface ItemNav { href: string; label: string; }
export interface Grupo { id: string; label: string; icon?: string; items: ItemNav[]; }

function grupoActivo(grupos: Grupo[], pathname: string): Grupo | undefined {
  let best: { g: Grupo; len: number } | undefined;
  for (const g of grupos) {
    for (const it of g.items) {
      if (pathname === it.href || pathname.startsWith(it.href + "/")) {
        if (!best || it.href.length > best.len) best = { g, len: it.href.length };
      }
    }
  }
  return best?.g;
}

export function GruposBar({ grupos }: { grupos: Grupo[] }) {
  const pathname = usePathname();
  const activo = grupoActivo(grupos, pathname);
  return (
    <nav className="nav-grupos" aria-label="Grupos">
      {grupos.map((g) => (
        <Link key={g.id} href={g.items[0]?.href ?? "#"} className={`nav-grupo${activo?.id === g.id ? " active" : ""}`}>
          {g.icon && <span className="nav-grupo-ico" aria-hidden>{g.icon}</span>}
          <span>{g.label}</span>
        </Link>
      ))}
    </nav>
  );
}

export function SubMenu({ grupos }: { grupos: Grupo[] }) {
  const pathname = usePathname();
  const activo = grupoActivo(grupos, pathname) ?? grupos[0];
  if (!activo) return null;
  return (
    <nav className="appnav" aria-label="Módulos">
      <div className="appnav-inner">
        {activo.items.map((it) => {
          const on = pathname === it.href || pathname.startsWith(it.href + "/");
          return (
            <Link key={it.href} href={it.href} className={on ? "active" : undefined}>{it.label}</Link>
          );
        })}
      </div>
    </nav>
  );
}
