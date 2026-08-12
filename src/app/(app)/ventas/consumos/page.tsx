// ==========================================================
// Informe de Consumos — indicadores de venta neta, costo, utilidad y
// % Utilidad del año, y ese mismo % desglosado por proveedor (MARCA).
// ==========================================================
import { requirePermiso } from "@/server/auth-context";
import { formatCOP, formatPorcentaje } from "@/lib/format";
import { aniosConVenta, resumenAnual, ventaPorMarca } from "@/lib/negocio/ventas";
import { FiltroAuto } from "../../_components/FiltroAuto";

const mill = (v: number) => `${new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(Math.round(v / 1e6))} MM`;
const margen = (venta: number, costo: number) => (venta > 0 ? ((venta - costo) / venta) * 100 : 0);

export default async function ConsumosPage({ searchParams }: { searchParams: Promise<{ anio?: string }> }) {
  await requirePermiso("cxp.view");
  const sp = await searchParams;

  const anios = await aniosConVenta();
  if (anios.length === 0) {
    return <div className="card"><div className="card-body"><div className="empty">Sin ventas cargadas. Corre <code>npm run db:ventas</code>.</div></div></div>;
  }
  const anio = sp.anio && anios.includes(Number(sp.anio)) ? Number(sp.anio) : anios[anios.length - 1]!;

  const [kpi, marcas] = await Promise.all([resumenAnual(anio), ventaPorMarca(anio)]);
  const maxVenta = marcas.length ? marcas[0]!.valor : 1;

  return (
    <>
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="card-body" style={{ paddingBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <div className="eyebrow" style={{ fontSize: 15 }}>Informe de Consumos · {anio} · {marcas.length} proveedores</div>
          <FiltroAuto className="toolbar">
            <label className="flag" style={{ alignSelf: "center" }}>Año:</label>
            <select name="anio" defaultValue={anio} className="select">
              {anios.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </FiltroAuto>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", marginBottom: 12 }}>
        <div className="card">
          <div className="chart-head">Venta Neta</div>
          <div className="card-body kpi-body"><div className="num kpi-val">{mill(kpi.venta)}</div><div className="ksub" style={{ justifyContent: "center" }}><span className="flag">{formatCOP(kpi.venta)}</span></div></div>
        </div>
        <div className="card">
          <div className="chart-head">Costo</div>
          <div className="card-body kpi-body"><div className="num kpi-val">{mill(kpi.costo)}</div><div className="ksub" style={{ justifyContent: "center" }}><span className="flag">{formatCOP(kpi.costo)}</span></div></div>
        </div>
        <div className="card">
          <div className="chart-head">Utilidad Bruta</div>
          <div className="card-body kpi-body"><div className="num kpi-val">{mill(kpi.utilidad)}</div><div className="ksub" style={{ justifyContent: "center" }}><span className="flag">{formatCOP(kpi.utilidad)}</span></div></div>
        </div>
        <div className="card">
          <div className="chart-head">% Utilidad</div>
          <div className="card-body kpi-body"><div className="num kpi-val">{formatPorcentaje(kpi.margen)}</div></div>
        </div>
      </div>

      {/* % Utilidad por proveedor (MARCA) */}
      <div className="card">
        <div className="chart-head">Utilidad por Proveedor <span className="hact">{anio}</span></div>
        <div className="tbl-wrap">
          <table className="tabla-fit">
            <thead>
              <tr><th>Proveedor (marca)</th><th className="r">Venta neta</th><th className="r">Costo</th><th className="r">Utilidad</th><th className="r">% Utilidad</th><th></th></tr>
            </thead>
            <tbody>
              {marcas.length === 0 ? (
                <tr><td colSpan={6}><div className="empty">Sin datos por proveedor.</div></td></tr>
              ) : (
                marcas.map((m) => {
                  const util = m.valor - m.costo;
                  const pct = margen(m.valor, m.costo);
                  return (
                    <tr key={m.marca}>
                      <td style={{ fontWeight: 600 }}>{m.marca}</td>
                      <td className="r num">{formatCOP(m.valor)}</td>
                      <td className="r num flag">{formatCOP(m.costo)}</td>
                      <td className="r num">{formatCOP(util)}</td>
                      <td className="r num" style={{ fontWeight: 700, color: pct < 0 ? "var(--bad)" : undefined }}>{formatPorcentaje(pct)}</td>
                      <td style={{ width: 120 }}>
                        <div className="rank-bar"><div style={{ width: `${Math.max(2, (m.valor / maxVenta) * 100)}%`, background: "var(--az-2)" }} /></div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
