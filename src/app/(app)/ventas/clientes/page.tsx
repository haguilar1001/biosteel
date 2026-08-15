// ==========================================================
// Ventas por Cliente (anual). Venta neta, costo, utilidad y % por cliente.
// ==========================================================
import { requirePermiso } from "@/server/auth-context";
import { formatPorcentaje, formatNumero } from "@/lib/format";
import { Monto } from "../../_components/Monto";
import { ventaPorCliente, resumenAnual, aniosConVenta, mesesConVenta } from "@/lib/negocio/ventas";
import { TopRanking, type RankItem } from "../../_components/charts/TopRanking";
import { FiltroAuto } from "../../_components/FiltroAuto";

const MESES = ["", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

export default async function VentasClientesPage({ searchParams }: { searchParams: Promise<{ anio?: string; mes?: string }> }) {
  await requirePermiso("cxp.view");
  const sp = await searchParams;

  const anios = await aniosConVenta();
  if (anios.length === 0) {
    return <div className="card"><div className="card-body"><div className="empty">Sin ventas cargadas. Corre <code>npm run db:ventas</code>.</div></div></div>;
  }
  const anio = sp.anio && anios.includes(Number(sp.anio)) ? Number(sp.anio) : anios[anios.length - 1]!;
  const mesesDisp = await mesesConVenta(anio);
  const mesSel = sp.mes && mesesDisp.includes(Number(sp.mes)) ? Number(sp.mes) : undefined;
  const meses = mesSel ? [mesSel] : undefined;
  const periodo = mesSel ? `${MESES[mesSel]} ${anio}` : `${anio}`;

  const [clientes, kpi] = await Promise.all([ventaPorCliente(anio, meses), resumenAnual(anio, meses)]);
  const rank: RankItem[] = clientes.map((c) => ({ label: c.clienteNombre, valor: c.valor, sub: `util. ${formatPorcentaje(c.valor > 0 ? ((c.valor - c.costo) / c.valor) * 100 : 0)}` }));

  return (
    <>
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="card-body" style={{ paddingBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <div className="eyebrow" style={{ fontSize: 15 }}>Ventas por Cliente · {periodo} · {formatNumero(clientes.length)} clientes</div>
          <FiltroAuto className="toolbar">
            <label className="flag" style={{ alignSelf: "center" }}>Año:</label>
            <select name="anio" defaultValue={anio} className="select">{anios.map((a) => <option key={a} value={a}>{a}</option>)}</select>
            <label className="flag" style={{ alignSelf: "center" }}>Mes:</label>
            <select name="mes" defaultValue={mesSel ?? ""} className="select">
              <option value="">Todos los meses</option>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => <option key={m} value={m}>{MESES[m]}</option>)}
            </select>
            {mesSel ? <a href={`/ventas/clientes?anio=${anio}`} className="btn">Todos los meses</a> : null}
            <a href={`/ventas/clientes/export?anio=${anio}${mesSel ? `&mes=${mesSel}` : ""}`} className="btn" title="Descargar ventas por cliente en Excel">⬇️ Excel</a>
          </FiltroAuto>
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <TopRanking titulo="Mayores clientes por venta neta" items={rank} color="var(--brand)" inicial={10} step={5} />
      </div>

      <div className="card">
        <div className="chart-head">Detalle por cliente</div>
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr><th>Cliente</th><th>NIT</th><th className="r">Venta neta</th><th className="r">% Part.</th><th className="r">Costo</th><th className="r">Utilidad</th><th className="r">% Util.</th></tr>
            </thead>
            <tbody>
              <tr className="fila-total">
                <td style={{ fontWeight: 800 }}>Total · {formatNumero(clientes.length)} clientes</td><td></td>
                <td className="r num" style={{ fontWeight: 800 }}><Monto value={kpi.venta} /></td>
                <td className="r num" style={{ fontWeight: 800 }}>{formatPorcentaje(100)}</td>
                <td className="r num" style={{ fontWeight: 800 }}><Monto value={kpi.costo} /></td>
                <td className="r num" style={{ fontWeight: 800 }}><Monto value={kpi.utilidad} /></td>
                <td className="r num" style={{ fontWeight: 800 }}>{formatPorcentaje(kpi.margen)}</td>
              </tr>
              {clientes.map((c) => {
                const util = c.valor - c.costo;
                return (
                  <tr key={c.clienteNombre}>
                    <td style={{ fontWeight: 600 }} title={c.clienteNombre}>{c.clienteNombre}</td>
                    <td className="num flag">{c.nit}</td>
                    <td className="r num" style={{ fontWeight: 700 }}><Monto value={c.valor} /></td>
                    <td className="r num">{kpi.venta > 0 ? formatPorcentaje((c.valor / kpi.venta) * 100) : "—"}</td>
                    <td className="r num flag"><Monto value={c.costo} /></td>
                    <td className="r num" style={{ color: util >= 0 ? "var(--ok)" : "var(--bad)" }}><Monto value={util} /></td>
                    <td className="r num">{c.valor > 0 ? formatPorcentaje((util / c.valor) * 100) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
