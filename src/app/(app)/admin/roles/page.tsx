// Administración · Roles y permisos — matriz EDITABLE por clic + crear perfil.
import { requirePermiso } from "@/server/auth-context";
import { prisma } from "@/lib/db";
import { PERMISOS } from "@/lib/rbac/permissions";
import { MatrizRoles, type RolCol, type PermisoRow } from "../_components/MatrizRoles";
import { CrearRolForm } from "../_components/CrearRolForm";

type Alc = "todos" | "propio" | "ninguno";

export default async function RolesPage() {
  await requirePermiso("rol.manage");

  const roles = await prisma.rol.findMany({
    orderBy: { id: "asc" },
    include: { permisos: { include: { permiso: { select: { clave: true } } } } },
  });

  const inicial: Record<string, Alc> = {};
  for (const r of roles) {
    for (const p of r.permisos) inicial[`${r.id}|${p.permiso.clave}`] = p.alcance;
  }

  const rolesCol: RolCol[] = roles.map((r) => ({ id: r.id, nombre: r.nombre, sistema: r.sistema }));
  const permisos: PermisoRow[] = PERMISOS.map((p) => ({ clave: p.clave, modulo: p.modulo, descripcion: p.descripcion }));

  return (
    <>
      <div className="toolbar" style={{ marginBottom: 12, justifyContent: "flex-end" }}>
        <CrearRolForm />
      </div>
      <MatrizRoles permisos={permisos} roles={rolesCol} inicial={inicial} />
    </>
  );
}
