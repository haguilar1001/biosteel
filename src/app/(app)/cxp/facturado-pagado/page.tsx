// ==========================================================
// Facturado vs Pagado por proveedor (por mes).
//   Facturado = documentos de CxP emitidos en el mes.
//   Pagado    = egresos del Flujo de Caja al proveedor en el mes.
// ==========================================================
import { requirePermiso } from "@/server/auth-context";
import { formatCOP, formatNumero } from "@/lib/format";
import { facturadoVsPagado } from "@/lib/negocio/cxp";
import { mesesConMovimiento, MESES_LABEL } from "@/lib/negocio/flujo";
import { BarrasComparativas, type BarraItem } from "../../_components/charts/BarrasComparativas";

const ANIO = 2026;

// Semáforo de cobertura = pagado / facturado.
function pctTag(facturado: number, pagado: number) {
  if (facturado <= 0) return <span className="tag t-blue">{pagado > 0 ? "s/fact" : "—"}</span>;
  const p = (pagado / facturado) * 100;
  const clase = p >= 90 ? "t-ok" : p >= 50 ? "t-w1" : "t-bad";
  return <span className={`tag ${clase}`}>{Math.round(p)}%</span>;
}

export default async function FacturadoPagadoPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  await requirePermiso("cxp.view");
  const sp = await searchParams;

  const mesesData = await mesesConMovimiento(ANIO, "egreso");
  const ultimo = mesesData.length ? mesesData[mesesData.length - 1]! : new Date().getMonth() + 1;
  const mes = sp.mes && /^\d+$/.test(sp.mes) ? Number(sp.mes) : ultimo;

  const filas = await facturadoVsPagado(ANIO, mes);
  const totFact = filas.reduce((s, f) => s + f.facturado, 0);
  const totPag = filas.reduce((s, f) => s + f.pagado, 0);

  const items: BarraItem[] = filas
    .filter((f) => f.facturado > 0 || f.pagado > 0)
    .map((f) => ({ label: f.proveedor, a: f.facturado, b: f.pagado }));

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Cuentas por Pagar</div>
          <h1>Facturado vs Pagado</h1>
          <p>Por proveedor · {MESES_LABEL[mes]} {ANIO} · facturado (CxP) contra pagado (flujo)</p>
        </div>
        <div className="toolbar">
          <a href="/cxp/proveedores" className="btn">Por proveedor (saldo)</a>
          <a href="/cxp" className="btn">← Documentos</a>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <div className="card-body" style={{ paddingBottom: 12 }}>
          <form method="get" className="toolbar">
            <label className="flag" style={{ alignSelf: "center" }}>Mes:</label>
            <select name="mes" defaultValue={mes} className="select">
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>{MESES_LABEL[m]}{mesesData.includes(m) ? "" : " (sin pagos)"}</option>
              ))}
            </select>
            <button type="submit" className="btn primary">Ver</button>
          </form>
        </div>
      </div>

      <div className="kpis" style={{ marginBottom: 12 }}>
        <div className="kpi">
          <div className="klabel">Facturado en el mes</div>
          <div className="kval num" style={{ color: "var(--cat-1)" }}>{formatCOP(totFact)}</div>
          <div className="ksub"><span className="flag">documentos emitidos (CxP)</span></div>
        </div>
        <div className="kpi">
          <div className="klabel">Pagado en el mes</div>
          <div className="kval num" style={{ color: "var(--cat-3)" }}>{formatCOP(totPag)}</div>
          <div className="ksub"><span className="flag">egresos a proveedores</span></div>
        </div>
        <div className={`kpi ${totPag - totFact >= 0 ? "k-ok" : "k-bad"}`}>
          <div className="klabel">Pagado − Facturado</div>
          <div className="kval num">{formatCOP(totPag - totFact)}</div>
          <div className="ksub"><span className="flag">{totPag >= totFact ? "se pagó más de lo facturado" : "se facturó más de lo pagado"}</span></div>
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <BarrasComparativas
          titulo={`Facturado vs Pagado · ${MESES_LABEL[mes]}`}
          items={items}
          labelA="Facturado" labelB="Pagado"
          colorA="var(--cat-1)" colorB="var(--cat-3)"
          inicial={12} step={6}
        />
      </div>

      <div className="card">
        <div className="chart-head">Detalle por proveedor <span className="hact">{formatNumero(items.length)} proveedores</span></div>
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th>Proveedor</th><th>NIT</th>
                <th className="r">Facturado</th><th className="r">Pagado</th><th className="r">Diferencia</th><th className="r">% Pagado</th>
              </tr>
            </thead>
            <tbody>
              {items.length > 0 && (
                <tr className="fila-total">
                  <td style={{ fontWeight: 800 }}>Total · {formatNumero(items.length)} proveedores</td>
                  <td></td>
                  <td className="r num" style={{ fontWeight: 800 }}>{formatCOP(totFact)}</td>
                  <td className="r num" style={{ fontWeight: 800 }}>{formatCOP(totPag)}</td>
                  <td className="r num" style={{ fontWeight: 800 }}>{formatCOP(totPag - totFact)}</td>
                  <td className="r">{pctTag(totFact, totPag)}</td>
                </tr>
              )}
              {filas.length === 0 ? (
                <tr><td colSpan={6} className="empty">Sin datos para {MESES_LABEL[mes]}.</td></tr>
              ) : (
                filas.map((f) => (
                  <tr key={f.proveedor}>
                    <td style={{ fontWeight: 600 }} title={f.proveedor}>{f.proveedor}</td>
                    <td className="num flag">{f.nit}</td>
                    <td className="r num" style={{ color: "var(--cat-1)" }}>{formatCOP(f.facturado)}</td>
                    <td className="r num" style={{ color: "var(--cat-3)" }}>{formatCOP(f.pagado)}</td>
                    <td className="r num" style={{ fontWeight: 700, color: f.pagado - f.facturado < 0 ? "var(--bad)" : "var(--ok)" }}>{formatCOP(f.pagado - f.facturado)}</td>
                    <td className="r">{pctTag(f.facturado, f.pagado)}</td>
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
