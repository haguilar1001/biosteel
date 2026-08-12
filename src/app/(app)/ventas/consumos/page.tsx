// ==========================================================
// Informe de Consumos — indicadores de venta neta, costo, utilidad y
// % Utilidad del período, y ese mismo % desglosado por proveedor (MARCA).
// Filtros de año y mes (auto-envío).
// ==========================================================
import { requirePermiso } from "@/server/auth-context";
import { formatCOP, formatPorcentaje } from "@/lib/format";
import { aniosConVenta, mesesConVenta, ventaPorMarcaConIps } from "@/lib/negocio/ventas";
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

  const marcas = await ventaPorMarcaConIps(anio, mesSel ? [mesSel] : undefined);
  const venta = marcas.reduce((s, m) => s + m.valor, 0);
  const costo = marcas.reduce((s, m) => s + m.costo, 0);
  const utilidad = venta - costo;
  const maxVenta = marcas.length ? Math.max(...marcas.map((m) => m.valor)) : 1;
  const periodo = mesSel ? `${MESES[mesSel]} ${anio}` : `${anio}`;
  const GRID = "minmax(160px, 2fr) 150px 150px 150px 90px 90px";

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

      {/* % Utilidad por proveedor (MARCA), desplegable por IPS */}
      <div className="card">
        <div className="chart-head">Utilidad por Proveedor <span className="hact">{periodo} · clic para ver por IPS</span></div>
        <div style={{ overflowX: "auto" }}>
          {/* Encabezado */}
          <div style={{ display: "grid", gridTemplateColumns: GRID, gap: 8, alignItems: "center", padding: "8px 12px", fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: ".5px", color: "var(--muted)", borderBottom: "1px solid var(--line)" }}>
            <span>Proveedor (marca)</span>
            <span style={{ textAlign: "right" }}>Venta neta</span>
            <span style={{ textAlign: "right" }}>Costo</span>
            <span style={{ textAlign: "right" }}>Utilidad</span>
            <span style={{ textAlign: "right" }}>% Utilidad</span>
            <span />
          </div>
          {marcas.length === 0 ? (
            <div className="empty">Sin datos por proveedor{mesSel ? ` en ${MESES[mesSel]}` : ""}.</div>
          ) : (
            marcas.map((m) => {
              const pct = margen(m.valor, m.costo);
              return (
                <details key={m.marca} className="cons-det">
                  <summary>
                    <div style={{ display: "grid", gridTemplateColumns: GRID, gap: 8, alignItems: "center", padding: "9px 12px" }}>
                      <span style={{ fontWeight: 600 }}><span className="cons-chev">▸</span> {m.marca} <span className="flag">({m.ips.length} IPS)</span></span>
                      <span className="num" style={{ textAlign: "right" }}>{formatCOP(m.valor)}</span>
                      <span className="num flag" style={{ textAlign: "right" }}>{formatCOP(m.costo)}</span>
                      <span className="num" style={{ textAlign: "right" }}>{formatCOP(m.valor - m.costo)}</span>
                      <span className="num" style={{ textAlign: "right", fontWeight: 700, color: pct < 0 ? "var(--bad)" : undefined }}>{formatPorcentaje(pct)}</span>
                      <span><div className="rank-bar"><div style={{ width: `${Math.max(2, (m.valor / maxVenta) * 100)}%`, background: "var(--az-2)" }} /></div></span>
                    </div>
                  </summary>
                  <div style={{ background: "var(--surface-2, #f6f8fc)", paddingBottom: 4 }}>
                    {m.ips.map((x) => {
                      const p = margen(x.valor, x.costo);
                      return (
                        <div key={x.ips} style={{ display: "grid", gridTemplateColumns: GRID, gap: 8, alignItems: "center", padding: "5px 12px", fontSize: 12.5 }}>
                          <span style={{ paddingLeft: 26 }}>{x.ips}</span>
                          <span className="num" style={{ textAlign: "right" }}>{formatCOP(x.valor)}</span>
                          <span className="num flag" style={{ textAlign: "right" }}>{formatCOP(x.costo)}</span>
                          <span className="num" style={{ textAlign: "right" }}>{formatCOP(x.valor - x.costo)}</span>
                          <span className="num" style={{ textAlign: "right", fontWeight: 600, color: p < 0 ? "var(--bad)" : undefined }}>{formatPorcentaje(p)}</span>
                          <span />
                        </div>
                      );
                    })}
                  </div>
                </details>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}
