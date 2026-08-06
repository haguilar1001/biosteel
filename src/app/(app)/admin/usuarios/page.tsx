// Administración · Usuarios (listado). Gestión (crear/editar) en fase siguiente.
import { requirePermiso } from "@/server/auth-context";
import { prisma } from "@/lib/db";

const fmtFechaHora = (d: Date | null) =>
  d ? new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" }).format(d) : "Nunca";

export default async function UsuariosPage() {
  await requirePermiso("usuario.manage");

  const usuarios = await prisma.usuario.findMany({
    orderBy: { nombre: "asc" },
    include: { rol: { select: { nombre: true } }, sede: { select: { nombre: true } } },
  });

  return (
    <div className="card">
      <div className="chart-head">
        Usuarios <span className="hact">{usuarios.length} registrados</span>
      </div>
      <div className="tbl-wrap">
        <table>
          <thead>
            <tr>
              <th>Usuario</th><th>Correo</th><th>Rol</th><th>Sede</th>
              <th>Último acceso</th><th>2FA</th><th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map((u) => (
              <tr key={u.id}>
                <td style={{ fontWeight: 600 }}>{u.nombre}</td>
                <td className="flag">{u.email}</td>
                <td><span className="tag t-blue">{u.rol.nombre}</span></td>
                <td>{u.sede?.nombre ?? "Todas"}</td>
                <td className="flag">{fmtFechaHora(u.ultimoAcceso)}</td>
                <td>
                  {u.dobleFactor
                    ? <span className="tag t-ok">Activo</span>
                    : <span className="tag t-w1">Pendiente</span>}
                </td>
                <td>
                  {u.activo
                    ? <span className="tag t-ok">Activo</span>
                    : <span className="tag t-bad">Inactivo</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
