"use client";
// Sub-navegación del área de Administración. Recibe solo los ítems
// permitidos (filtrados por permiso en el servidor).
import Link from "next/link";
import { usePathname } from "next/navigation";

export interface ItemSub { href: string; label: string; }

export function AdminNav({ items }: { items: ItemSub[] }) {
  const pathname = usePathname();
  return (
    <div className="subnav">
      {items.map((it) => {
        const activo = pathname === it.href || pathname.startsWith(it.href + "/");
        return (
          <Link key={it.href} href={it.href} className={activo ? "active" : undefined}>
            {it.label}
          </Link>
        );
      })}
    </div>
  );
}
