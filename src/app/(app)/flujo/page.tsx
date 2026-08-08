// Resumen del Flujo de Caja: ingresos vs egresos vs presupuesto por mes.
import { requirePermiso } from "@/server/auth-context";
import { formatCOP, formatPorcentaje } from "@/lib/format";
import { flujoMensual, totalesFlujo, MESES_LABEL } from "@/lib/negocio/flujo";

const ANIO = 2026;

export default async function FlujoResumenPage() {
  await requirePermiso("cxp.view");

  const [meses, tot] = await Promise.all([flujoMensual(ANIO), totalesFlujo(ANIO)]);
  const maxBar = Math.max(1, ...meses.map((m) => Math.max(m.ingresos, m.egresos)));

  return (
    <>
      <div className="kpis">
        <div className="kpi k-ingreso">
          <div className="klabel">Ingresos {ANIO}</div>
          <div className="kval num">{formatCOP(tot.ingresos)}</div>
        </div>
        <div className="kpi k-egreso">
          <div className="klabel">Egresos {ANIO}</div>
          <div className="kval num">{formatCOP(tot.egresos)}</div>
        </div>
        <div className="kpi">
          <div className="klabel">Flujo neto</div>
          <div className="kval num" style={{ color: tot.neto >= 0 ? "var(--ok)" : "var(--bad)" }}>{formatCOP(tot.neto)}</div>
          <div className="ksub"><span className="flag">ingresos − egresos</span></div>
        </div>
        <div className="kpi k-w">
          <div className="klabel">Ejecución presupuestal</div>
          <div className="kval num">{formatPorcentaje(tot.ejecucion)}</div>
          <div className="ksub"><span className="flag">egresos vs presupuesto</span></div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <div className="chart-head">Ingresos vs Egresos por mes <span className="hact">{ANIO}</span></div>
        <div className="card-body">
          <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 180 }}>
            {meses.map((m) => (
              <div key={m.mes} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, height: "100%", justifyContent: "flex-end" }}>
                <div style={{ display: "flex", gap: 3, alignItems: "flex-end", height: "100%", width: "100%", justifyContent: "center" }}>
                  <div title={`Ingresos ${formatCOP(m.ingresos)}`} style={{ width: "38%", height: `${Math.max(1, (m.ingresos / maxBar) * 100)}%`, background: "var(--ingreso)", borderRadius: "3px 3px 0 0" }} />
                  <div title={`Egresos ${formatCOP(m.egresos)}`} style={{ width: "38%", height: `${Math.max(1, (m.egresos / maxBar) * 100)}%`, background: "var(--egreso)", borderRadius: "3px 3px 0 0" }} />
                </div>
                <span className="flag">{MESES_LABEL[m.mes]}</span>
              </div>
            ))}
          </div>
          <div className="legend"><span><i style={{ background: "var(--ingreso)" }} />Ingresos</span><span><i style={{ background: "var(--egreso)" }} />Egresos</span></div>
        </div>
      </div>

      <div className="card">
        <div className="chart-head">Detalle mensual</div>
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th>Mes</th><th className="r">Ingresos</th><th className="r">Egresos</th>
                <th className="r">Flujo neto</th><th className="r">Presupuesto</th><th className="r">Ejecución</th>
              </tr>
            </thead>
            <tbody>
              <tr className="fila-total">
                <td style={{ fontWeight: 800 }}>Total {ANIO}</td>
                <td className="r num" style={{ fontWeight: 800 }}>{formatCOP(tot.ingresos)}</td>
                <td className="r num" style={{ fontWeight: 800 }}>{formatCOP(tot.egresos)}</td>
                <td className="r num" style={{ fontWeight: 800 }}>{formatCOP(tot.neto)}</td>
                <td className="r num" style={{ fontWeight: 800 }}>{formatCOP(tot.presupuesto)}</td>
                <td className="r num" style={{ fontWeight: 800 }}>{formatPorcentaje(tot.ejecucion)}</td>
              </tr>
              {meses.map((m) => (
                <tr key={m.mes}>
                  <td style={{ fontWeight: 600, textTransform: "uppercase" }}>{MESES_LABEL[m.mes]}</td>
                  <td className="r num" style={{ color: "var(--ingreso)" }}>{formatCOP(m.ingresos)}</td>
                  <td className="r num" style={{ color: "var(--egreso)" }}>{formatCOP(m.egresos)}</td>
                  <td className="r num" style={{ color: m.neto >= 0 ? undefined : "var(--bad)" }}>{formatCOP(m.neto)}</td>
                  <td className="r num">{formatCOP(m.presupuesto)}</td>
                  <td className="r num">{m.presupuesto > 0 ? formatPorcentaje((m.egresos / m.presupuesto) * 100) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
