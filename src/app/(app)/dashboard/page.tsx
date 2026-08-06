// ==========================================================
// Dashboard — Panel de Flujo de Caja
// Lee cartera respetando el alcance del usuario (anti-IDOR) y
// muestra KPIs, aging y top de clientes con datos reales de la BD.
// ==========================================================
import { requirePermiso } from "@/server/auth-context";
import { prisma } from "@/lib/db";
import { formatCOP, formatPorcentaje } from "@/lib/format";
import { resumenCartera, topClientes } from "@/lib/negocio/cartera";
import { resumenCxp } from "@/lib/negocio/cxp";
import { CUBETAS } from "@/lib/negocio/aging";

const CAT_LABEL: Record<string, string> = {
  clinica_ips: "Clínica / IPS",
  eps_aseguradora: "EPS / Aseguradora",
  distribuidor: "Distribuidor",
  cirujano_particular: "Cirujano",
};

export default async function DashboardPage() {
  const { usuario, alcance } = await requirePermiso("dashboard.view");

  // Alcance de cartera (puede diferir de dashboard). Si no tiene, no consulta.
  const { alcanceDe } = await import("@/lib/rbac/authorize");
  const alcanceCartera = await alcanceDe(usuario, "cartera.view");

  const cartera = alcanceCartera !== "ninguno"
    ? await resumenCartera(usuario, alcanceCartera)
    : null;
  const top = alcanceCartera !== "ninguno"
    ? await topClientes(usuario, alcanceCartera, 10)
    : [];

  const cxp = (await alcanceDe(usuario, "cxp.view")) !== "ninguno" ? await resumenCxp() : null;

  // Recaudo del mes en curso (global, Fase 1)
  const inicioMes = new Date();
  inicioMes.setDate(1);
  inicioMes.setHours(0, 0, 0, 0);
  const recMes = await prisma.recaudo.aggregate({
    _sum: { valorRecibido: true },
    where: { fecha: { gte: inicioMes } },
  });
  const recaudoMes = recMes._sum.valorRecibido?.toNumber() ?? 0;

  const pctVencida = cartera && cartera.total > 0 ? (cartera.vencido / cartera.total) * 100 : 0;
  const maxCubeta = cartera ? Math.max(1, ...CUBETAS.map((c) => cartera.porCubeta[c.clave].monto)) : 1;

  const hoy = new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "short", year: "numeric" }).format(new Date());

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Inicio</div>
          <h1>Panel de Flujo de Caja</h1>
          <p>Corte a {hoy} · Alcance: <code>{alcanceCartera}</code> · {usuario.rol.nombre}</p>
        </div>
      </div>

      <div className="kpis">
        <div className="kpi k-bad">
          <div className="klabel">Saldo cartera</div>
          <div className="kval num">{cartera ? formatCOP(cartera.total) : "—"}</div>
          <div className="ksub"><span className="flag">{cartera ? `${cartera.cantidadFacturas} facturas abiertas` : "Sin acceso"}</span></div>
        </div>
        <div className="kpi k-w">
          <div className="klabel">Cartera vencida</div>
          <div className="kval num">{cartera ? formatPorcentaje(pctVencida) : "—"}</div>
          <div className="ksub"><span className="flag">{cartera ? formatCOP(cartera.vencido) : ""}</span></div>
        </div>
        <div className="kpi">
          <div className="klabel">Cuentas por pagar</div>
          <div className="kval num">{cxp ? formatCOP(cxp.porPagar) : "—"}</div>
          <div className="ksub"><span className="flag">{cxp ? `${cxp.cantidad} documentos · vencido ${formatCOP(cxp.vencido)}` : "Sin acceso"}</span></div>
        </div>
        <div className="kpi k-ok">
          <div className="klabel">Recaudo del mes</div>
          <div className="kval num">{formatCOP(recaudoMes)}</div>
          <div className="ksub"><span className="flag">Mes en curso</span></div>
        </div>
      </div>

      <div className="grid two" style={{ marginBottom: 12 }}>
        <div className="card">
          <div className="chart-head">
            Cartera por edades (Aging)
            <span className="hact">Total {cartera ? formatCOP(cartera.total) : "—"}</span>
          </div>
          <div className="card-body">
            {cartera ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {CUBETAS.map((c) => {
                  const celda = cartera.porCubeta[c.clave];
                  const pct = Math.round((celda.monto / maxCubeta) * 100);
                  return (
                    <div key={c.clave}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                        <span style={{ color: "var(--muted)" }}>{c.etiqueta} · {celda.cantidad}</span>
                        <span className="num" style={{ fontWeight: 700 }}>{formatCOP(celda.monto)}</span>
                      </div>
                      <div style={{ height: 10, borderRadius: 6, background: "var(--brand-tint)", overflow: "hidden" }}>
                        <div style={{ width: `${pct}%`, height: "100%", background: c.color }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="empty">Tu rol no tiene acceso a la cartera.</div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="chart-head">Composición de cartera vencida</div>
          <div className="card-body">
            {cartera && cartera.total > 0 ? (
              <>
                <div style={{ fontSize: 40, fontWeight: 800, letterSpacing: "-1px" }} className="num">
                  {formatPorcentaje(pctVencida)}
                </div>
                <p style={{ color: "var(--muted)", marginTop: 4 }}>
                  {formatCOP(cartera.vencido)} vencidos de {formatCOP(cartera.total)} totales.
                </p>
                <div className="legend">
                  {CUBETAS.map((c) => (
                    <span key={c.clave}><i style={{ background: c.color }} />{c.etiqueta}</span>
                  ))}
                </div>
              </>
            ) : (
              <div className="empty">Sin datos de cartera.</div>
            )}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="chart-head">
          Top clientes con mayor cartera
          <span className="hact">{top.length} clientes</span>
        </div>
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th>Cliente</th><th>Tipo</th><th className="r">Saldo total</th>
                <th className="r">Vencido</th><th className="r">Días prom.</th>
              </tr>
            </thead>
            <tbody>
              {top.length === 0 ? (
                <tr><td colSpan={5} className="empty">Sin cartera en tu alcance.</td></tr>
              ) : (
                top.map((c) => (
                  <tr key={c.cliente}>
                    <td>{c.cliente}</td>
                    <td>{c.categoria ? CAT_LABEL[c.categoria] ?? c.categoria : "—"}</td>
                    <td className="r num">{formatCOP(c.saldo)}</td>
                    <td className="r num" style={{ color: c.vencido > 0 ? "var(--bad)" : "var(--muted)" }}>{formatCOP(c.vencido)}</td>
                    <td className="r num">{c.diasPromedio}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
