// Administración · Usuarios — listado + crear usuario + cambiar perfil inline.
import { requirePermiso } from "@/server/auth-context";
import { prisma } from "@/lib/db";
import { formatNumero, formatFechaHora } from "@/lib/format";
import { CrearUsuarioForm } from "../_components/CrearUsuarioForm";
import { SelectorRolUsuario } from "../_components/SelectorRolUsuario";

const fmtFechaHora = (d: Date | null) => (d ? formatFechaHora(d) : "Nunca");

export default async function UsuariosPage() {
  const { usuario: actor } = await requirePermiso("usuario.manage");

  const [usuarios, roles, sedes] = await Promise.all([
    prisma.usuario.findMany({
      orderBy: { nombre: "asc" },
      include: { rol: { select: { id: true, nombre: true } }, sede: { select: { nombre: true } } },
    }),
    prisma.rol.findMany({ orderBy: { id: "asc" }, select: { id: true, nombre: true } }),
    prisma.sede.findMany({ where: { activo: true }, orderBy: { nombre: "asc" }, select: { id: true, nombre: true } }),
  ]);

  return (
    <>
      <div className="toolbar" style={{ marginBottom: 12, justifyContent: "flex-end" }}>
        <CrearUsuarioForm roles={roles} sedes={sedes} />
      </div>

      <div className="card">
        <div className="chart-head">
          👥 Usuarios <span className="hact">{formatNumero(usuarios.length)} registrados</span>
        </div>
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th>Usuario</th><th>Correo</th><th>Perfil (clic para cambiar)</th><th>Sede</th>
                <th>Último acceso</th><th>2FA</th><th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => (
                <tr key={u.id}>
                  <td style={{ fontWeight: 600, textTransform: "uppercase" }}>
                    👤 {u.nombre}
                    {u.id === actor.id && <span className="tag t-blue" style={{ marginLeft: 6, textTransform: "none" }}>tú</span>}
                  </td>
                  <td className="flag">{u.email}</td>
                  <td>
                    <SelectorRolUsuario userId={u.id} rolActualId={u.rol.id} roles={roles} esSelf={u.id === actor.id} />
                  </td>
                  <td>{u.sede?.nombre ?? "Todas"}</td>
                  <td className="flag">{fmtFechaHora(u.ultimoAcceso)}</td>
                  <td>
                    {u.dobleFactor
                      ? <span className="tag t-ok">✅ Activo</span>
                      : <span className="tag t-w1">⏳ Pendiente</span>}
                  </td>
                  <td>
                    {u.activo
                      ? <span className="tag t-ok">🟢 Activo</span>
                      : <span className="tag t-bad">🔴 Inactivo</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
