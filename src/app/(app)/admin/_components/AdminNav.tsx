"use client";
// Sub-navegación del área de Administración, organizada en grupos
// (p. ej. "Manejo de usuarios" y "Configuración"). Recibe solo los grupos
// e ítems permitidos (filtrados por permiso en el servidor).
import Link from "next/link";
import { usePathname } from "next/navigation";

export interface ItemSub { href: string; label: string; }
export interface GrupoSub { label: string; icon: string; items: ItemSub[]; }

export function AdminNav({ grupos }: { grupos: GrupoSub[] }) {
  const pathname = usePathname();
  return (
    <div className="admin-nav2">
      {grupos.map((g) => (
        <div key={g.label} className="admin-grp">
          <div className="admin-grp-lbl">{g.icon} {g.label}</div>
          <div className="subnav">
            {g.items.map((it) => {
              const activo = pathname === it.href || pathname.startsWith(it.href + "/");
              return (
                <Link key={it.href} href={it.href} className={activo ? "active" : undefined}>
                  {it.label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
