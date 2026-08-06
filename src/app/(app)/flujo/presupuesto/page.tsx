// Presupuesto vs Real: ejecución de egresos por grupo (opcional por mes).
import { requirePermiso } from "@/server/auth-context";
import { formatCOP, formatPorcentaje } from "@/lib/format";
import { presupuestoVsReal, MESES_LABEL } from "@/lib/negocio/flujo";

const ANIO = 2026;

export default async function PresupuestoPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  await requirePermiso("cxp.view");
  const sp = await searchParams;
  const mes = sp.mes && /^\d+$/.test(sp.mes) ? Number(sp.mes) : undefined;

  const filas = await presupuestoVsReal(ANIO, mes);
  const tot = filas.reduce(
    (a, f) => ({ presupuesto: a.presupuesto + f.presupuesto, real: a.real + f.real }),
    { presupuesto: 0, real: 0 },
  );
  const totDesv = tot.real - tot.presupuesto;
  const totEjec = tot.presupuesto > 0 ? (tot.real / tot.presupuesto) * 100 : 0;

  return (
    <div className="card">
      <div className="chart-head">
        Presupuesto vs Real · egresos {ANIO}
        <span className="hact">{mes ? MESES_LABEL[mes] : "año corrido"}</span>
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
              <th className="r">Desviación</th><th className="r">Ejecución</th>
            </tr>
          </thead>
          <tbody>
            <tr className="fila-total">
              <td style={{ fontWeight: 800 }}>Total</td>
              <td className="r num" style={{ fontWeight: 800 }}>{formatCOP(tot.presupuesto)}</td>
              <td className="r num" style={{ fontWeight: 800 }}>{formatCOP(tot.real)}</td>
              <td className="r num" style={{ fontWeight: 800, color: totDesv > 0 ? "var(--bad)" : "var(--ok)" }}>{formatCOP(totDesv)}</td>
              <td className="r num" style={{ fontWeight: 800 }}>{formatPorcentaje(totEjec)}</td>
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
                  <td className="r num">
                    <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-end" }}>
                      <div style={{ width: 70, height: 8, borderRadius: 4, background: "var(--brand-tint)", overflow: "hidden" }}>
                        <div style={{ width: `${Math.min(100, Math.round(f.ejecucion))}%`, height: "100%", background: f.ejecucion > 100 ? "var(--bad)" : "var(--brand-2)" }} />
                      </div>
                      <span>{f.presupuesto > 0 ? formatPorcentaje(f.ejecucion) : "—"}</span>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
