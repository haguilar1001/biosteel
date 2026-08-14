// Ppto vs Real — INGRESOS: meta fija de $2.000 M/mes vs ingresos reales.
import { requirePermiso } from "@/server/auth-context";
import { formatPorcentaje } from "@/lib/format";
import { Monto } from "../../../_components/Monto";
import { flujoMensual, MESES_LABEL } from "@/lib/negocio/flujo";
import { CeldaIngreso, PRESUPUESTO_INGRESO_MES } from "../_semaforo";

const ANIO = 2026;

export default async function PptoIngresosPage() {
  await requirePermiso("cxp.view");
  const meses = await flujoMensual(ANIO);

  const tot = meses.reduce((a, m) => ({ pres: a.pres + PRESUPUESTO_INGRESO_MES, real: a.real + m.ingresos }), { pres: 0, real: 0 });
  const cumplTot = tot.pres > 0 ? (tot.real / tot.pres) * 100 : 0;

  return (
    <div className="card">
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
              <td className="r num" style={{ fontWeight: 800 }}><Monto value={tot.pres} /></td>
              <td className="r num" style={{ fontWeight: 800 }}><Monto value={tot.real} /></td>
              <td className="r num" style={{ fontWeight: 800, color: tot.real >= tot.pres ? "var(--ok)" : "var(--bad)" }}><Monto value={tot.real - tot.pres} /></td>
              <td className="r num" style={{ fontWeight: 800 }}>{formatPorcentaje(cumplTot)}</td>
            </tr>
            {meses.length === 0 ? (
              <tr><td colSpan={5} className="empty">Sin movimientos de ingresos.</td></tr>
            ) : meses.map((m) => {
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
  );
}
