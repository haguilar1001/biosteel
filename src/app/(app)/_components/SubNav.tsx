"use client";
// Sub-navegación genérica (pestañas dentro de un módulo).
import Link from "next/link";
import { usePathname } from "next/navigation";

export interface ItemSub { href: string; label: string; }

export function SubNav({ items }: { items: ItemSub[] }) {
  const pathname = usePathname();
  return (
    <div className="subnav">
      {items.map((it) => {
        const activo = pathname === it.href;
        return (
          <Link key={it.href} href={it.href} className={activo ? "active" : undefined}>
            {it.label}
          </Link>
        );
      })}
    </div>
  );
}
