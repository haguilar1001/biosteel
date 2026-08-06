// ==========================================================
// Layout del área de Administración: sub-navegación filtrada por permiso.
// Cada página además valida su propio permiso (defensa en capas).
// ==========================================================
import { requireUsuario } from "@/server/auth-context";
import { puede } from "@/lib/rbac/authorize";
import type { PermisoClave } from "@/lib/rbac/permissions";
import { AdminNav, type ItemSub } from "./_components/AdminNav";

const SUB: { href: string; label: string; permiso: PermisoClave }[] = [
  { href: "/admin/usuarios", label: "👥 Usuarios", permiso: "usuario.manage" },
  { href: "/admin/roles", label: "🔐 Roles y permisos", permiso: "rol.manage" },
  { href: "/admin/terceros", label: "🧑‍💼 Terceros", permiso: "tercero.manage" },
  { href: "/admin/auditoria", label: "📜 Auditoría", permiso: "auditoria.view" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const usuario = await requireUsuario();

  const items: ItemSub[] = [];
  for (const s of SUB) {
    if (await puede(usuario, s.permiso)) items.push({ href: s.href, label: s.label });
  }

  return (
    <>
      <div className="page-head" style={{ marginBottom: 8 }}>
        <div>
          <div className="eyebrow">Administración</div>
          <h1>Configuración del sistema</h1>
        </div>
      </div>
      <AdminNav items={items} />
      {children}
    </>
  );
}
