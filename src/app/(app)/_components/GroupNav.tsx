"use client";
// ==========================================================
// Navegación en dos niveles:
//  - GruposBar: grupos en la barra azul (junto al logo).
//  - SubMenu:   opciones del grupo activo, en la línea de menú.
// El grupo activo se deduce de la ruta actual (el ítem más específico gana).
// ==========================================================
import Link from "next/link";
import { usePathname } from "next/navigation";

// `match`: rutas extra que también marcan activo este ítem/grupo (p. ej. una
// sección cuyo enlace apunta a una página pero abarca varias sub-rutas).
export interface ItemNav { href: string; label: string; match?: string[]; }
export interface Grupo { id: string; label: string; icon?: string; items: ItemNav[]; }

function itemActivo(it: ItemNav, pathname: string): boolean {
  const bases = [it.href, ...(it.match ?? [])];
  return bases.some((b) => pathname === b || pathname.startsWith(b + "/"));
}

function grupoActivo(grupos: Grupo[], pathname: string): Grupo | undefined {
  let best: { g: Grupo; len: number } | undefined;
  for (const g of grupos) {
    for (const it of g.items) {
      for (const b of [it.href, ...(it.match ?? [])]) {
        if (pathname === b || pathname.startsWith(b + "/")) {
          if (!best || b.length > best.len) best = { g, len: b.length };
        }
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
          const on = itemActivo(it, pathname);
          return (
            <Link key={it.href} href={it.href} className={on ? "active" : undefined}>{it.label}</Link>
          );
        })}
      </div>
    </nav>
  );
}
