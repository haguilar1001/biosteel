// Administración · Auditoría (registro inmutable · BIO-SEC-007).
import { requirePermiso } from "@/server/auth-context";
import { prisma } from "@/lib/db";

const fmtFechaHora = (d: Date) =>
  new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(d);

// Etiquetas y color por tipo de acción.
function tagAccion(accion: string): { clase: string } {
  if (accion.includes("fallido") || accion.includes("anular")) return { clase: "t-bad" };
  if (accion.includes("login")) return { clase: "t-blue" };
  return { clase: "t-ok" };
}

export default async function AuditoriaPage() {
  await requirePermiso("auditoria.view");

  const eventos = await prisma.logAuditoria.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { usuario: { select: { nombre: true } } },
  });

  return (
    <div className="card">
      <div className="chart-head">
        Registro de auditoría <span className="hact">últimos {eventos.length} eventos</span>
      </div>
      <div className="tbl-wrap">
        <table>
          <thead>
            <tr>
              <th>Fecha y hora</th><th>Usuario</th><th>Acción</th><th>Entidad</th><th>IP</th>
            </tr>
          </thead>
          <tbody>
            {eventos.length === 0 ? (
              <tr><td colSpan={5} className="empty">Aún no hay eventos registrados.</td></tr>
            ) : (
              eventos.map((e) => (
                <tr key={String(e.id)}>
                  <td className="flag">{fmtFechaHora(e.createdAt)}</td>
                  <td>{e.usuario?.nombre ?? "—"}</td>
                  <td><span className={`tag ${tagAccion(e.accion).clase}`}>{e.accion}</span></td>
                  <td className="flag">{e.entidad ?? "—"}{e.entidadId ? ` #${e.entidadId}` : ""}</td>
                  <td className="flag">{e.ip ?? "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
