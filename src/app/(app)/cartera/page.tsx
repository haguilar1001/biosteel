// ==========================================================
// Cartera (Cuentas por Cobrar) — en NETO, como CxP.
// KPIs + aging por edades (clicable) + detalle con buscador.
// ==========================================================
import { requirePermiso } from "@/server/auth-context";
import { formatCOP, formatNumero } from "@/lib/format";
import { resumenCartera, listarFacturas } from "@/lib/negocio/cartera";
import { CUBETAS, type CubetaAging } from "@/lib/negocio/aging";
import { Buscador } from "../_components/Buscador";
import { Donut } from "../_components/charts/Donut";

const CUBETA_TAG: Record<CubetaAging, string> = {
  d1_30: "t-ok", d31_60: "t-w1", d61_90: "t-w2", d91_120: "t-bad", mas120: "t-bad",
};
const CUBETA_LABEL: Record<CubetaAging, string> = {
  d1_30: "1–30", d31_60: "31–60", d61_90: "61–90", d91_120: "91–120", mas120: "+120",
};
const fmtFecha = (d: Date) => new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "short", year: "2-digit" }).format(d);

export default async function CarteraPage({
  searchParams,
}: {
  searchParams: Promise<{ edad?: string; q?: string }>;
}) {
  const { usuario, alcance } = await requirePermiso("cartera.view");
  const { edad, q } = await searchParams;
  const cubetaFiltro = CUBETAS.some((c) => c.clave === edad) ? (edad as CubetaAging) : undefined;

  const resumen = await resumenCartera(usuario, alcance);
  const { filas, total, suma } = await listarFacturas(usuario, alcance, { cubeta: cubetaFiltro, q });
  const maxCubeta = Math.max(1, ...CUBETAS.map((c) => resumen.porCubeta[c.clave].monto));
  const carteraPositiva = CUBETAS.reduce((s, c) => s + resumen.porCubeta[c.clave].monto, 0);

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Cartera</div>
          <h1>Cuentas por Cobrar</h1>
          <p>Saldo neto · corte 30 jun 2026 · alcance <code>{alcance}</code></p>
        </div>
        <div className="toolbar">
          <a href="/cartera/ciudades" className="btn primary">Por ciudad</a>
          <a href="/cartera/clientes" className="btn">Por cliente</a>
          <a href="/cartera/ventas-recaudos" className="btn">Ventas vs Recaudos</a>
        </div>
      </div>

      <div className="kpis">
        <div className="kpi">
          <div className="klabel">CxC neta</div>
          <div className="kval num">{formatCOP(resumen.total)}</div>
          <div className="ksub"><span className="flag">{resumen.cantidadFacturas} facturas</span></div>
        </div>
        <div className="kpi k-bad">
          <div className="klabel">Vencida</div>
          <div className="kval num">{formatCOP(resumen.vencido)}</div>
          <div className="ksub"><span className="flag">facturas con mora</span></div>
        </div>
        <div className="kpi k-ok">
          <div className="klabel">Al día / por vencer</div>
          <div className="kval num">{formatCOP(resumen.alDia)}</div>
        </div>
        <div className="kpi k-w">
          <div className="klabel">Notas / a favor</div>
          <div className="kval num">{formatCOP(resumen.anticipos)}</div>
          <div className="ksub"><span className="flag">{resumen.anticiposCantidad} documentos</span></div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <div className="chart-head">Cartera por edades (aging) <span className="hact">clic para filtrar</span></div>
        <div className="card-body">
          <div className="grid aging-grid" style={{ gridTemplateColumns: "210px 1fr", gap: 20, alignItems: "center" }}>
            <div style={{ display: "grid", placeItems: "center" }}>
              <Donut legend={false} size={200}
                data={CUBETAS.filter((c) => resumen.porCubeta[c.clave].monto > 0).map((c) => ({ label: c.etiqueta, valor: resumen.porCubeta[c.clave].monto, color: c.color }))}
                centro={{ valor: (carteraPositiva / 1e9).toFixed(1).replace(".", ",") + " MM", etiqueta: "por cobrar" }} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {CUBETAS.map((c) => {
              const celda = resumen.porCubeta[c.clave];
              const activo = cubetaFiltro === c.clave;
              return (
                <a key={c.clave} href={activo ? "/cartera" : `/cartera?edad=${c.clave}`} style={{ textDecoration: "none", color: "inherit" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
                    <span style={{ color: activo ? "var(--brand)" : "var(--muted)", fontWeight: activo ? 700 : 400 }}>{c.etiqueta} · {formatNumero(celda.cantidad)}</span>
                    <span style={{ fontWeight: 700 }}>{formatCOP(celda.monto)}</span>
                  </div>
                  <div style={{ height: 10, borderRadius: 6, background: "var(--brand-tint)", overflow: "hidden", outline: activo ? "2px solid var(--brand)" : "none" }}>
                    <div style={{ width: `${Math.round((celda.monto / maxCubeta) * 100)}%`, height: "100%", background: c.color }} />
                  </div>
                </a>
              );
            })}
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="chart-head">
          Detalle de facturas
          <span className="hact">
            {q ? `${formatNumero(total)} coincidencias` : `${formatNumero(resumen.cantidadFacturas)} facturas`}
            {cubetaFiltro ? ` · edad ${CUBETA_LABEL[cubetaFiltro]}` : ""}
            {filas.length < total && !cubetaFiltro ? ` · mostrando ${formatNumero(filas.length)}` : ""}
          </span>
        </div>
        <div className="card-body" style={{ paddingBottom: 0 }}>
          <Buscador action="/cartera" q={q} placeholder="Cliente, NIT, N.º de factura o concepto…" />
        </div>
        <div className="tbl-wrap">
          <table className="tabla-fit">
            <colgroup>
              <col style={{ width: "13%" }} /><col style={{ width: "20%" }} /><col style={{ width: "9%" }} />
              <col style={{ width: "26%" }} /><col style={{ width: "12%" }} /><col style={{ width: "12%" }} /><col style={{ width: "8%" }} />
            </colgroup>
            <thead>
              <tr>
                <th>Factura</th><th>Cliente</th><th>NIT</th><th>Concepto</th>
                <th className="r">Saldo</th><th>Vence</th><th>Edad</th>
              </tr>
            </thead>
            <tbody>
              {filas.length > 0 && (
                <tr className="fila-total">
                  <td colSpan={4} style={{ fontWeight: 800 }}>Total neto · {formatNumero(total)} factura{total === 1 ? "" : "s"}</td>
                  <td className="r num" style={{ fontWeight: 800 }}>{formatCOP(suma)}</td>
                  <td colSpan={2}></td>
                </tr>
              )}
              {filas.length === 0 ? (
                <tr><td colSpan={7} className="empty">Sin resultados{q ? ` para "${q}"` : ""}.</td></tr>
              ) : (
                filas.map((f) => (
                  <tr key={f.id}>
                    <td style={{ fontWeight: 600 }} title={f.numero}>{f.numero}</td>
                    <td title={f.cliente}>{f.cliente}</td>
                    <td className="num flag">{f.nit}</td>
                    <td className="flag" title={f.concepto ?? ""}>{f.concepto}</td>
                    <td className="r num" style={{ fontWeight: 700, color: f.saldo < 0 ? "var(--ok)" : undefined }}>{formatCOP(f.saldo)}</td>
                    <td>{fmtFecha(f.fechaVencimiento)}</td>
                    <td>{f.saldo > 0 ? <span className={`tag ${CUBETA_TAG[f.cubeta]}`}>{CUBETA_LABEL[f.cubeta]}{f.dias > 0 ? ` · ${formatNumero(f.dias)}d` : ""}</span> : <span className="flag">—</span>}</td>
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
