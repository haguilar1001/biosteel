"use client";
// Navegación por módulos. Recibe solo los ítems que el usuario puede ver
// (filtrados por permiso en el servidor) y resalta el activo por la ruta.
import Link from "next/link";
import { usePathname } from "next/navigation";

export interface ItemNav {
  href: string;
  label: string;
}

export function Nav({ items }: { items: ItemNav[] }) {
  const pathname = usePathname();
  return (
    <nav className="appnav" aria-label="Módulos">
      <div className="appnav-inner">
        {items.map((it) => {
          const activo = pathname === it.href || pathname.startsWith(it.href + "/");
          return (
            <Link key={it.href} href={it.href} className={activo ? "active" : undefined}>
              {it.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
