// Presupuesto vs Real: cumplimiento por mes y ejecución por grupo.
import { requirePermiso } from "@/server/auth-context";
import { formatCOP, formatPorcentaje } from "@/lib/format";
import { presupuestoVsReal, flujoMensual, MESES_LABEL } from "@/lib/negocio/flujo";

const ANIO = 2026;

// Semáforo de cumplimiento (egresos vs presupuesto):
//  ≤100% dentro/por debajo (verde) · 100–110% leve sobre (ámbar) · >110% sobreejecutado (rojo).
function SemaforoCumpl({ pct }: { pct: number }) {
  if (pct <= 0) return <span className="flag">—</span>;
  const { clase, icon } = pct > 110
    ? { clase: "t-bad", icon: "✗" }
    : pct > 100
      ? { clase: "t-w1", icon: "▲" }
      : { clase: "t-ok", icon: "✓" };
  return <span className={`tag ${clase}`}>{icon} {formatPorcentaje(pct)}</span>;
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

  const totGrupo = filas.reduce((a, f) => ({ pres: a.pres + f.presupuesto, real: a.real + f.real }), { pres: 0, real: 0 });
  const cumplGrupoTot = totGrupo.pres > 0 ? (totGrupo.real / totGrupo.pres) * 100 : 0;

  return (
    <>
      {/* --- Cumplimiento por mes --- */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="chart-head">Cumplimiento presupuestal por mes <span className="hact">egresos vs presupuesto {ANIO}</span></div>
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
                <td className="r num" style={{ fontWeight: 800 }}>{formatCOP(totMes.pres)}</td>
                <td className="r num" style={{ fontWeight: 800 }}>{formatCOP(totMes.real)}</td>
                <td className="r num" style={{ fontWeight: 800, color: totMes.real > totMes.pres ? "var(--bad)" : "var(--ok)" }}>{formatCOP(totMes.real - totMes.pres)}</td>
                <td className="r num" style={{ fontWeight: 800 }}>{formatPorcentaje(cumplMesTot)}</td>
              </tr>
              {meses.map((m) => {
                const desv = m.egresos - m.presupuesto;
                const cumpl = m.presupuesto > 0 ? (m.egresos / m.presupuesto) * 100 : 0;
                return (
                  <tr key={m.mes}>
                    <td style={{ fontWeight: 600, textTransform: "uppercase" }}>{MESES_LABEL[m.mes]}</td>
                    <td className="r num">{formatCOP(m.presupuesto)}</td>
                    <td className="r num">{formatCOP(m.egresos)}</td>
                    <td className="r num" style={{ color: desv > 0 ? "var(--bad)" : desv < 0 ? "var(--ok)" : undefined }}>{formatCOP(desv)}</td>
                    <td className="r"><SemaforoCumpl pct={cumpl} /></td>
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
          <form method="get" className="toolbar">
            <select name="mes" defaultValue={mes ?? ""} className="select">
              <option value="">Año corrido</option>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>{MESES_LABEL[m]}</option>
              ))}
            </select>
            <button type="submit" className="btn primary">Ver</button>
            <a href="/flujo/presupuesto" className="btn">Año corrido</a>
          </form>
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
                <td className="r num" style={{ fontWeight: 800 }}>{formatCOP(totGrupo.pres)}</td>
                <td className="r num" style={{ fontWeight: 800 }}>{formatCOP(totGrupo.real)}</td>
                <td className="r num" style={{ fontWeight: 800, color: totGrupo.real > totGrupo.pres ? "var(--bad)" : "var(--ok)" }}>{formatCOP(totGrupo.real - totGrupo.pres)}</td>
                <td className="r num" style={{ fontWeight: 800 }}>{formatPorcentaje(cumplGrupoTot)}</td>
              </tr>
              {filas.length === 0 ? (
                <tr><td colSpan={5} className="empty">Sin datos de presupuesto.</td></tr>
              ) : (
                filas.map((f) => (
                  <tr key={f.categoria}>
                    <td style={{ fontWeight: 600 }}>{f.categoria}</td>
                    <td className="r num">{formatCOP(f.presupuesto)}</td>
                    <td className="r num">{formatCOP(f.real)}</td>
                    <td className="r num" style={{ color: f.desviacion > 0 ? "var(--bad)" : f.desviacion < 0 ? "var(--ok)" : undefined }}>{formatCOP(f.desviacion)}</td>
                    <td className="r"><SemaforoCumpl pct={f.ejecucion} /></td>
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
