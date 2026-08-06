// ==========================================================
// Centro de Reportes — análisis de cartera y recaudo.
// Respeta el alcance del usuario (vendedor ve solo lo propio).
// ==========================================================
import { requirePermiso } from "@/server/auth-context";
import { formatCOP, formatPorcentaje, formatNumero } from "@/lib/format";
import { recaudoPorVendedor, diasPromedioPorCategoria, recaudoMensual } from "@/lib/negocio/reportes";

export default async function ReportesPage() {
  const { usuario, alcance } = await requirePermiso("reporte.view");

  const inicioMes = new Date();
  inicioMes.setDate(1);
  inicioMes.setHours(0, 0, 0, 0);

  const [vendedores, categorias, meses] = await Promise.all([
    recaudoPorVendedor(usuario, alcance, inicioMes),
    diasPromedioPorCategoria(usuario, alcance),
    recaudoMensual(6),
  ]);

  const maxDias = Math.max(1, ...categorias.map((c) => c.diasPromedio));
  const maxMes = Math.max(1, ...meses.map((m) => m.monto));

  const totCartera = vendedores.reduce((s, v) => s + v.carteraAsignada, 0);
  const totRecaudo = vendedores.reduce((s, v) => s + v.recaudado, 0);
  const efecTotal = totCartera + totRecaudo > 0 ? (totRecaudo / (totCartera + totRecaudo)) * 100 : 0;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Reportes</div>
          <h1>Centro de Reportes</h1>
          <p>Análisis de cartera y recaudo · alcance <code>{alcance}</code></p>
        </div>
      </div>

      <div className="grid two" style={{ marginBottom: 12 }}>
        <div className="card">
          <div className="chart-head">Antigüedad promedio por tipo de cliente</div>
          <div className="card-body">
            {categorias.length === 0 ? (
              <div className="empty">Sin cartera en tu alcance.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {categorias.map((c) => (
                  <div key={c.categoria}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                      <span style={{ color: "var(--muted)" }}>{c.categoria}</span>
                      <span style={{ fontWeight: 700 }}>{formatNumero(c.diasPromedio)} días · {formatCOP(c.saldo)}</span>
                    </div>
                    <div style={{ height: 10, borderRadius: 6, background: "var(--brand-tint)", overflow: "hidden" }}>
                      <div style={{ width: `${Math.round((c.diasPromedio / maxDias) * 100)}%`, height: "100%", background: "var(--brand-2)" }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="chart-head">Recaudo mensual <span className="hact">últimos 6 meses</span></div>
          <div className="card-body">
            <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: 160 }}>
              {meses.map((m) => (
                <div key={m.etiqueta} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, height: "100%", justifyContent: "flex-end" }}>
                  <span className="flag" style={{ fontSize: 10 }}>{m.monto > 0 ? formatCOP(m.monto).replace("$ ", "$") : ""}</span>
                  <div title={formatCOP(m.monto)} style={{ width: "70%", height: `${Math.max(2, Math.round((m.monto / maxMes) * 100))}%`, background: "var(--brand)", borderRadius: "4px 4px 0 0" }} />
                  <span className="flag">{m.etiqueta}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="chart-head">Recaudo por vendedor <span className="hact">mes en curso</span></div>
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th>Vendedor</th><th className="r">Cartera asignada</th>
                <th className="r">Recaudado (mes)</th><th>Efectividad</th>
              </tr>
            </thead>
            <tbody>
              {vendedores.length > 0 && (
                <tr className="fila-total">
                  <td style={{ fontWeight: 800 }}>Total · {formatNumero(vendedores.length)} vendedores</td>
                  <td className="r num" style={{ fontWeight: 800 }}>{formatCOP(totCartera)}</td>
                  <td className="r num" style={{ fontWeight: 800 }}>{formatCOP(totRecaudo)}</td>
                  <td className="num" style={{ fontWeight: 800 }}>{formatPorcentaje(efecTotal)}</td>
                </tr>
              )}
              {vendedores.length === 0 ? (
                <tr><td colSpan={4} className="empty">Sin datos de vendedores en tu alcance.</td></tr>
              ) : (
                vendedores.map((v) => (
                  <tr key={v.vendedor}>
                    <td style={{ fontWeight: 600 }}>{v.vendedor}</td>
                    <td className="r num">{formatCOP(v.carteraAsignada)}</td>
                    <td className="r num" style={{ color: "var(--ok)" }}>{formatCOP(v.recaudado)}</td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 90, height: 8, borderRadius: 4, background: "var(--brand-tint)", overflow: "hidden" }}>
                          <div style={{ width: `${Math.round(v.efectividad)}%`, height: "100%", background: "var(--brand-2)" }} />
                        </div>
                        <span className="flag">{formatPorcentaje(v.efectividad)}</span>
                      </div>
                    </td>
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
