// ==========================================================
// Layout del área de Administración: sub-navegación filtrada por permiso.
// Cada página además valida su propio permiso (defensa en capas).
// ==========================================================
import { requireUsuario } from "@/server/auth-context";
import { puede } from "@/lib/rbac/authorize";
import type { PermisoClave } from "@/lib/rbac/permissions";
import { AdminNav, type ItemSub, type GrupoSub } from "./_components/AdminNav";

// Administración en dos grupos. "Configuración" agrupa la parametrización de
// la app y todos los catálogos/maestros (terceros y los que se vayan sumando).
const GRUPOS: { label: string; icon: string; items: { href: string; label: string; permiso: PermisoClave }[] }[] = [
  { label: "Manejo de usuarios", icon: "👥", items: [
    { href: "/admin/usuarios", label: "Usuarios", permiso: "usuario.manage" },
    { href: "/admin/roles", label: "Roles y permisos", permiso: "rol.manage" },
    { href: "/admin/auditoria", label: "Auditoría", permiso: "auditoria.view" },
  ] },
  { label: "Configuración", icon: "🎛️", items: [
    { href: "/admin/parametrizacion", label: "Fuente y tamaño", permiso: "parametro.manage" },
    { href: "/admin/terceros", label: "Terceros", permiso: "tercero.manage" },
  ] },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const usuario = await requireUsuario();

  // Filtra ítems por permiso y descarta grupos que queden vacíos.
  const grupos: GrupoSub[] = [];
  for (const g of GRUPOS) {
    const items: ItemSub[] = [];
    for (const s of g.items) {
      if (await puede(usuario, s.permiso)) items.push({ href: s.href, label: s.label });
    }
    if (items.length) grupos.push({ label: g.label, icon: g.icon, items });
  }

  return (
    <>
      <div className="page-head" style={{ marginBottom: 8 }}>
        <div>
          <div className="eyebrow">Administración</div>
          <h1>Configuración del sistema</h1>
        </div>
      </div>
      <AdminNav grupos={grupos} />
      {children}
    </>
  );
}
