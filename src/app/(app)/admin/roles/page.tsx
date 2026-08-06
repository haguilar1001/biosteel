// Administración · Roles y permisos (matriz). Edición inline en fase siguiente.
import { requirePermiso } from "@/server/auth-context";
import { prisma } from "@/lib/db";
import { PERMISOS } from "@/lib/rbac/permissions";

function celda(alcance: string | undefined) {
  if (alcance === "todos") return <span style={{ color: "var(--ok)", fontWeight: 800 }}>✔</span>;
  if (alcance === "propio") return <span className="tag t-w1">Propia</span>;
  return <span style={{ color: "var(--line)" }}>—</span>;
}

export default async function RolesPage() {
  await requirePermiso("rol.manage");

  const roles = await prisma.rol.findMany({
    orderBy: { id: "asc" },
    include: { permisos: { include: { permiso: { select: { clave: true } } } } },
  });

  // roleId -> (clave -> alcance)
  const matriz = new Map<number, Map<string, string>>();
  for (const r of roles) {
    matriz.set(r.id, new Map(r.permisos.map((p) => [p.permiso.clave, p.alcance])));
  }

  return (
    <div className="card">
      <div className="chart-head">
        Matriz de permisos por módulo
        <span className="hact">✔ Todos · Propia · — Ninguno</span>
      </div>
      <div className="tbl-wrap">
        <table>
          <thead>
            <tr>
              <th>Módulo / Acción</th>
              {roles.map((r) => <th key={r.id} style={{ textAlign: "center" }}>{r.nombre}</th>)}
            </tr>
          </thead>
          <tbody>
            {PERMISOS.map((p) => (
              <tr key={p.clave}>
                <td>
                  <div style={{ fontWeight: 600 }}>{p.descripcion}</div>
                  <div className="flag">{p.modulo}</div>
                </td>
                {roles.map((r) => (
                  <td key={r.id} style={{ textAlign: "center" }}>{celda(matriz.get(r.id)?.get(p.clave))}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
