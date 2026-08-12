// Resumen del Flujo de Caja: ingresos vs egresos vs presupuesto por mes.
import { requirePermiso } from "@/server/auth-context";
import { formatCOP, formatPorcentaje } from "@/lib/format";
import { Monto } from "../_components/Monto";
import { flujoMensual, MESES_LABEL } from "@/lib/negocio/flujo";
import { FiltroAuto } from "../_components/FiltroAuto";

const ANIO = 2026;

export default async function FlujoResumenPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  await requirePermiso("cxp.view");
  const sp = await searchParams;
  const mes = sp.mes && /^\d+$/.test(sp.mes) ? Number(sp.mes) : undefined;

  const meses = await flujoMensual(ANIO);
  const maxBar = Math.max(1, ...meses.map((m) => Math.max(m.ingresos, m.egresos)));

  // Totales según el filtro (mes seleccionado o año corrido).
  const scope = mes ? meses.filter((m) => m.mes === mes) : meses;
  const acc = scope.reduce(
    (a, m) => ({ ingresos: a.ingresos + m.ingresos, egresos: a.egresos + m.egresos, presupuesto: a.presupuesto + m.presupuesto }),
    { ingresos: 0, egresos: 0, presupuesto: 0 },
  );
  const tot = {
    ...acc,
    neto: acc.ingresos - acc.egresos,
    ejecucion: acc.presupuesto > 0 ? (acc.egresos / acc.presupuesto) * 100 : 0,
  };
  const alcance = mes ? MESES_LABEL[mes]!.toUpperCase() : `${ANIO}`;

  return (
    <>
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="card-body" style={{ paddingBottom: 12 }}>
          <FiltroAuto className="toolbar">
            <label className="flag" style={{ alignSelf: "center" }}>Mes:</label>
            <select name="mes" defaultValue={mes ?? ""} className="select">
              <option value="">Todos los meses</option>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>{MESES_LABEL[m]}</option>
              ))}
            </select>
            {mes ? <a href="/flujo" className="btn">Todos los meses</a> : null}
          </FiltroAuto>
        </div>
      </div>

      <div className="kpis">
        <div className="kpi k-ingreso">
          <div className="klabel">Ingresos {alcance}</div>
          <div className="kval num"><Monto value={tot.ingresos} /></div>
        </div>
        <div className="kpi k-egreso">
          <div className="klabel">Egresos {alcance}</div>
          <div className="kval num"><Monto value={tot.egresos} /></div>
        </div>
        <div className="kpi">
          <div className="klabel">Flujo neto</div>
          <div className="kval num" style={{ color: tot.neto >= 0 ? "var(--ok)" : "var(--bad)" }}><Monto value={tot.neto} /></div>
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
              <div key={m.mes} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, height: "100%", justifyContent: "flex-end", opacity: mes && m.mes !== mes ? 0.35 : 1 }}>
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
        <div className="chart-head">Detalle mensual{mes ? <span className="hact">{MESES_LABEL[mes]!.toUpperCase()}</span> : null}</div>
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
                <td style={{ fontWeight: 800 }}>{mes ? MESES_LABEL[mes]!.toUpperCase() : `Total ${ANIO}`}</td>
                <td className="r num" style={{ fontWeight: 800 }}><Monto value={tot.ingresos} /></td>
                <td className="r num" style={{ fontWeight: 800 }}><Monto value={tot.egresos} /></td>
                <td className="r num" style={{ fontWeight: 800 }}><Monto value={tot.neto} /></td>
                <td className="r num" style={{ fontWeight: 800 }}><Monto value={tot.presupuesto} /></td>
                <td className="r num" style={{ fontWeight: 800 }}>{formatPorcentaje(tot.ejecucion)}</td>
              </tr>
              {!mes && meses.map((m) => (
                <tr key={m.mes}>
                  <td style={{ fontWeight: 600, textTransform: "uppercase" }}>{MESES_LABEL[m.mes]}</td>
                  <td className="r num" style={{ color: "var(--ingreso)" }}><Monto value={m.ingresos} /></td>
                  <td className="r num" style={{ color: "var(--egreso)" }}><Monto value={m.egresos} /></td>
                  <td className="r num" style={{ color: m.neto >= 0 ? undefined : "var(--bad)" }}><Monto value={m.neto} /></td>
                  <td className="r num"><Monto value={m.presupuesto} /></td>
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
