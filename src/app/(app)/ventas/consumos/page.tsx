// ==========================================================
// Informe de Consumos — indicadores de venta neta, costo, utilidad y
// % Utilidad del período, y ese mismo % desglosado por proveedor (MARCA).
// Filtros de año y mes (auto-envío).
// ==========================================================
import { requirePermiso } from "@/server/auth-context";
import { formatCOP, formatPorcentaje } from "@/lib/format";
import { aniosConVenta, mesesConVenta, ventaPorMarca } from "@/lib/negocio/ventas";
import { FiltroAuto } from "../../_components/FiltroAuto";

const MESES = ["", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const mill = (v: number) => `${new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(Math.round(v / 1e6))} MM`;
const margen = (venta: number, costo: number) => (venta > 0 ? ((venta - costo) / venta) * 100 : 0);

export default async function ConsumosPage({ searchParams }: { searchParams: Promise<{ anio?: string; mes?: string }> }) {
  await requirePermiso("cxp.view");
  const sp = await searchParams;

  const anios = await aniosConVenta();
  if (anios.length === 0) {
    return <div className="card"><div className="card-body"><div className="empty">Sin ventas cargadas. Corre <code>npm run db:ventas</code>.</div></div></div>;
  }
  const anio = sp.anio && anios.includes(Number(sp.anio)) ? Number(sp.anio) : anios[anios.length - 1]!;
  const mesesDisp = await mesesConVenta(anio);
  const mesSel = sp.mes && mesesDisp.includes(Number(sp.mes)) ? Number(sp.mes) : undefined;

  const marcas = await ventaPorMarca(anio, mesSel ? [mesSel] : undefined);
  const venta = marcas.reduce((s, m) => s + m.valor, 0);
  const costo = marcas.reduce((s, m) => s + m.costo, 0);
  const utilidad = venta - costo;
  const maxVenta = marcas.length ? Math.max(...marcas.map((m) => m.valor)) : 1;
  const periodo = mesSel ? `${MESES[mesSel]} ${anio}` : `${anio}`;

  return (
    <>
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="card-body" style={{ paddingBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <div className="eyebrow" style={{ fontSize: 15 }}>Informe de Consumos · {periodo} · {marcas.length} proveedores</div>
          <FiltroAuto className="toolbar">
            <label className="flag" style={{ alignSelf: "center" }}>Año:</label>
            <select name="anio" defaultValue={anio} className="select">
              {anios.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
            <label className="flag" style={{ alignSelf: "center" }}>Mes:</label>
            <select name="mes" defaultValue={mesSel ?? ""} className="select">
              <option value="">Todos los meses</option>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>{MESES[m]}</option>
              ))}
            </select>
            {mesSel ? <a href={`/ventas/consumos?anio=${anio}`} className="btn">Todos</a> : null}
          </FiltroAuto>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", marginBottom: 12 }}>
        <div className="card">
          <div className="chart-head">Venta Neta</div>
          <div className="card-body kpi-body"><div className="num kpi-val">{mill(venta)}</div><div className="ksub" style={{ justifyContent: "center" }}><span className="flag">{formatCOP(venta)}</span></div></div>
        </div>
        <div className="card">
          <div className="chart-head">Costo</div>
          <div className="card-body kpi-body"><div className="num kpi-val">{mill(costo)}</div><div className="ksub" style={{ justifyContent: "center" }}><span className="flag">{formatCOP(costo)}</span></div></div>
        </div>
        <div className="card">
          <div className="chart-head">Utilidad Bruta</div>
          <div className="card-body kpi-body"><div className="num kpi-val">{mill(utilidad)}</div><div className="ksub" style={{ justifyContent: "center" }}><span className="flag">{formatCOP(utilidad)}</span></div></div>
        </div>
        <div className="card">
          <div className="chart-head">% Utilidad</div>
          <div className="card-body kpi-body"><div className="num kpi-val">{formatPorcentaje(margen(venta, costo))}</div></div>
        </div>
      </div>

      {/* % Utilidad por proveedor (MARCA) */}
      <div className="card">
        <div className="chart-head">Utilidad por Proveedor <span className="hact">{periodo}</span></div>
        <div className="tbl-wrap">
          <table className="tabla-fit">
            <thead>
              <tr><th>Proveedor (marca)</th><th className="r">Venta neta</th><th className="r">Costo</th><th className="r">Utilidad</th><th className="r">% Utilidad</th><th></th></tr>
            </thead>
            <tbody>
              {marcas.length === 0 ? (
                <tr><td colSpan={6}><div className="empty">Sin datos por proveedor{mesSel ? ` en ${MESES[mesSel]}` : ""}.</div></td></tr>
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
