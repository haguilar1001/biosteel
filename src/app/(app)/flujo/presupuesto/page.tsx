// Presupuesto vs Real: cumplimiento por mes y ejecución por grupo.
import { requirePermiso } from "@/server/auth-context";
import { formatPorcentaje } from "@/lib/format";
import { Monto } from "../../_components/Monto";
import { presupuestoVsReal, flujoMensual, MESES_LABEL } from "@/lib/negocio/flujo";
import { FiltroAuto } from "../../_components/FiltroAuto";

const ANIO = 2026;
// Presupuesto de ingresos: meta fija de $2.000 millones por mes (2026).
const PRESUPUESTO_INGRESO_MES = 2_000_000_000;

// Semáforo de cumplimiento de INGRESOS (más es mejor):
//  ≥100% cumplió/superó (verde) · 85–100% cerca (ámbar) · <85% por debajo (rojo).
function CeldaIngreso({ presupuesto, real }: { presupuesto: number; real: number }) {
  if (presupuesto <= 0) return <span className="flag">—</span>;
  const pct = (real / presupuesto) * 100;
  const { clase, icon } = pct >= 100
    ? { clase: "t-ok", icon: "✓" }
    : pct >= 85
      ? { clase: "t-w1", icon: "▲" }
      : { clase: "t-bad", icon: "✗" };
  return <span className={`tag ${clase}`}>{icon} {formatPorcentaje(pct)}</span>;
}

// Semáforo de cumplimiento (egresos vs presupuesto):
//  ≤100% dentro/por debajo (verde) · 100–110% leve sobre (ámbar) · 110–150% sobreejecutado (rojo)
//  ≥150% sobreejecución grave (⚠️) · egreso sin presupuesto asignado (⚠️).
function CeldaCumplimiento({ presupuesto, real }: { presupuesto: number; real: number }) {
  // Egreso ejecutado sin presupuesto asignado.
  if (presupuesto <= 0) {
    if (real > 0) return <span className="tag t-bad" title="Egreso ejecutado sin presupuesto asignado">⚠️ Sin presup.</span>;
    return <span className="flag">—</span>;
  }
  const pct = (real / presupuesto) * 100;
  const { clase, icon, alerta } = pct >= 150
    ? { clase: "t-bad", icon: "⚠️", alerta: true }
    : pct > 110
      ? { clase: "t-bad", icon: "✗", alerta: false }
      : pct > 100
        ? { clase: "t-w1", icon: "▲", alerta: false }
        : { clase: "t-ok", icon: "✓", alerta: false };
  return <span className={`tag ${clase}`} title={alerta ? "Sobreejecución ≥150% del presupuesto" : undefined}>{icon} {formatPorcentaje(pct)}</span>;
}

export default async function PresupuestoPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  await requirePermiso("cxp.view");
  const sp = await searchParams;
  const mes = sp.mes && /^\d+$/.test(sp.mes) ? Number(sp.mes) : undefined;

  const [meses, filas] = await Promise.all([flujoMensual(ANIO), presupuestoVsReal(ANIO, mes)]);

  const totMes = meses.reduce((a, m) => ({ pres: a.pres + m.presupuesto, real: a.real + m.egresos }), { pres: 0, real: 0 });
  const cumplMesTot = totMes.pres > 0 ? (totMes.real / totMes.pres) * 100 : 0;

  // Ingresos: presupuesto fijo por mes (2.000M) vs ingresos reales.
  const totIng = meses.reduce((a, m) => ({ pres: a.pres + PRESUPUESTO_INGRESO_MES, real: a.real + m.ingresos }), { pres: 0, real: 0 });
  const cumplIngTot = totIng.pres > 0 ? (totIng.real / totIng.pres) * 100 : 0;

  const totGrupo = filas.reduce((a, f) => ({ pres: a.pres + f.presupuesto, real: a.real + f.real }), { pres: 0, real: 0 });
  const cumplGrupoTot = totGrupo.pres > 0 ? (totGrupo.real / totGrupo.pres) * 100 : 0;

  return (
    <>
      {/* --- Ingresos: presupuesto vs real --- */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="chart-head">Ingresos · presupuesto vs real <span className="hact">meta $2.000 M/mes · {ANIO}</span></div>
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th>Mes</th><th className="r">Presupuesto</th><th className="r">Real (ingresos)</th>
                <th className="r">Cumplimiento</th><th className="r">% Cumplimiento</th>
              </tr>
            </thead>
            <tbody>
              <tr className="fila-total">
                <td style={{ fontWeight: 800 }}>Total {ANIO}</td>
                <td className="r num" style={{ fontWeight: 800 }}><Monto value={totIng.pres} /></td>
                <td className="r num" style={{ fontWeight: 800 }}><Monto value={totIng.real} /></td>
                <td className="r num" style={{ fontWeight: 800, color: totIng.real >= totIng.pres ? "var(--ok)" : "var(--bad)" }}><Monto value={totIng.real - totIng.pres} /></td>
                <td className="r num" style={{ fontWeight: 800 }}>{formatPorcentaje(cumplIngTot)}</td>
              </tr>
              {meses.map((m) => {
                const dif = m.ingresos - PRESUPUESTO_INGRESO_MES;
                return (
                  <tr key={m.mes}>
                    <td style={{ fontWeight: 600, textTransform: "uppercase" }}>{MESES_LABEL[m.mes]}</td>
                    <td className="r num"><Monto value={PRESUPUESTO_INGRESO_MES} /></td>
                    <td className="r num"><Monto value={m.ingresos} /></td>
                    <td className="r num" style={{ color: dif >= 0 ? "var(--ok)" : "var(--bad)" }}><Monto value={dif} /></td>
                    <td className="r"><CeldaIngreso presupuesto={PRESUPUESTO_INGRESO_MES} real={m.ingresos} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- Egresos: cumplimiento por mes --- */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="chart-head">Egresos · presupuesto vs real <span className="hact">cumplimiento por mes · {ANIO}</span></div>
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th>Mes</th><th className="r">Presupuesto</th><th className="r">Real (egresos)</th>
                <th className="r">Desviación</th><th className="r">Cumplimiento</th>
              </tr>
            </thead>
            <tbody>
              <tr className="fila-total">
                <td style={{ fontWeight: 800 }}>Total {ANIO}</td>
                <td className="r num" style={{ fontWeight: 800 }}><Monto value={totMes.pres} /></td>
                <td className="r num" style={{ fontWeight: 800 }}><Monto value={totMes.real} /></td>
                <td className="r num" style={{ fontWeight: 800, color: totMes.real > totMes.pres ? "var(--bad)" : "var(--ok)" }}><Monto value={totMes.real - totMes.pres} /></td>
                <td className="r num" style={{ fontWeight: 800 }}>{formatPorcentaje(cumplMesTot)}</td>
              </tr>
              {meses.map((m) => {
                const desv = m.egresos - m.presupuesto;
                return (
                  <tr key={m.mes}>
                    <td style={{ fontWeight: 600, textTransform: "uppercase" }}>{MESES_LABEL[m.mes]}</td>
                    <td className="r num"><Monto value={m.presupuesto} /></td>
                    <td className="r num"><Monto value={m.egresos} /></td>
                    <td className="r num" style={{ color: desv > 0 ? "var(--bad)" : desv < 0 ? "var(--ok)" : undefined }}><Monto value={desv} /></td>
                    <td className="r"><CeldaCumplimiento presupuesto={m.presupuesto} real={m.egresos} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- Ejecución por grupo --- */}
      <div className="card">
        <div className="chart-head">
          Ejecución por grupo <span className="hact">{mes ? MESES_LABEL[mes] : "año corrido"}</span>
        </div>
        <div className="card-body" style={{ paddingBottom: 0 }}>
          <FiltroAuto className="toolbar">
            <select name="mes" defaultValue={mes ?? ""} className="select">
              <option value="">Año corrido</option>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>{MESES_LABEL[m]}</option>
              ))}
            </select>
            <a href="/flujo/presupuesto" className="btn">Año corrido</a>
          </FiltroAuto>
        </div>
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th>Grupo</th><th className="r">Presupuesto</th><th className="r">Real (egresos)</th>
                <th className="r">Desviación</th><th className="r">Cumplimiento</th>
              </tr>
            </thead>
            <tbody>
              <tr className="fila-total">
                <td style={{ fontWeight: 800 }}>Total</td>
                <td className="r num" style={{ fontWeight: 800 }}><Monto value={totGrupo.pres} /></td>
                <td className="r num" style={{ fontWeight: 800 }}><Monto value={totGrupo.real} /></td>
                <td className="r num" style={{ fontWeight: 800, color: totGrupo.real > totGrupo.pres ? "var(--bad)" : "var(--ok)" }}><Monto value={totGrupo.real - totGrupo.pres} /></td>
                <td className="r num" style={{ fontWeight: 800 }}>{formatPorcentaje(cumplGrupoTot)}</td>
              </tr>
              {filas.length === 0 ? (
                <tr><td colSpan={5} className="empty">Sin datos de presupuesto.</td></tr>
              ) : (
                filas.map((f) => (
                  <tr key={f.categoria}>
                    <td style={{ fontWeight: 600 }}>{f.categoria}</td>
                    <td className="r num"><Monto value={f.presupuesto} /></td>
                    <td className="r num"><Monto value={f.real} /></td>
                    <td className="r num" style={{ color: f.desviacion > 0 ? "var(--bad)" : f.desviacion < 0 ? "var(--ok)" : undefined }}><Monto value={f.desviacion} /></td>
                    <td className="r"><CeldaCumplimiento presupuesto={f.presupuesto} real={f.real} /></td>
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
