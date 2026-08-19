"use client";
// ==========================================================
// Navegación por grupos con lista desplegable.
// Cada grupo de la barra azul abre un menú con sus opciones; dentro del
// menú los ítems pueden venir separados por sección (p. ej. Inventarios
// se divide en Equipos y Osteosíntesis).
// El grupo activo se deduce de la ruta actual (el ítem más específico gana).
// ==========================================================
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

// `match`: rutas extra que también marcan activo este ítem/grupo (p. ej. una
// sección cuyo enlace apunta a una página pero abarca varias sub-rutas).
export interface ItemNav { href: string; label: string; match?: string[]; seccion?: string; }
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

/** Parte los ítems en secciones conservando el orden de aparición. */
function porSeccion(items: ItemNav[]): { seccion?: string; items: ItemNav[] }[] {
  const out: { seccion?: string; items: ItemNav[] }[] = [];
  for (const it of items) {
    const ultima = out[out.length - 1];
    if (ultima && ultima.seccion === it.seccion) ultima.items.push(it);
    else out.push({ seccion: it.seccion, items: [it] });
  }
  return out;
}

export function GruposBar({ grupos }: { grupos: Grupo[] }) {
  const pathname = usePathname();
  const activo = grupoActivo(grupos, pathname);
  const [abierto, setAbierto] = useState<string | null>(null);
  const navRef = useRef<HTMLElement>(null);

  // Cierra al navegar.
  useEffect(() => { setAbierto(null); }, [pathname]);

  // Cierra al hacer clic fuera o con Escape.
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setAbierto(null);
    };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setAbierto(null); };
    document.addEventListener("mousedown", fuera);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", fuera); document.removeEventListener("keydown", esc); };
  }, [abierto]);

  return (
    <nav className="nav-grupos" aria-label="Grupos" ref={navRef}>
      {grupos.map((g) => {
        const on = abierto === g.id;
        return (
          <div key={g.id} className="nav-grupo-wrap">
            <button
              type="button"
              className={`nav-grupo${activo?.id === g.id ? " active" : ""}${on ? " abierto" : ""}`}
              aria-haspopup="menu"
              aria-expanded={on}
              onClick={() => setAbierto(on ? null : g.id)}
            >
              {g.icon && <span className="nav-grupo-ico" aria-hidden>{g.icon}</span>}
              <span>{g.label}</span>
              <span className="nav-grupo-caret" aria-hidden>▾</span>
            </button>
            {on && (
              <div className="nav-menu" role="menu" aria-label={g.label}>
                {porSeccion(g.items).map((sec, i) => (
                  <div key={sec.seccion ?? i} className="nav-menu-sec">
                    {sec.seccion && <div className="nav-menu-titulo">{sec.seccion}</div>}
                    {sec.items.map((it) => (
                      <Link
                        key={it.href}
                        href={it.href}
                        role="menuitem"
                        className={itemActivo(it, pathname) ? "active" : undefined}
                      >
                        {it.label}
                      </Link>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}
