// ==========================================================
// Cuentas por Pagar (CxP)
// Totales NETOS (concilian con el ERP). Buscador por proveedor/documento/
// concepto y acceso al informe por proveedor.
// ==========================================================
import { requirePermiso } from "@/server/auth-context";
import { formatCOP } from "@/lib/format";
import { resumenCxp, listarDocumentosCxp, diasParaVencer } from "@/lib/negocio/cxp";
import { Buscador } from "../_components/Buscador";

const fmtFecha = (d: Date) => new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "short", year: "2-digit" }).format(d);

function tagVencimiento(dias: number): { clase: string; texto: string } {
  if (dias < 0) return { clase: "t-bad", texto: `Vencido ${Math.abs(dias)}d` };
  if (dias <= 7) return { clase: "t-w1", texto: `≤ ${dias}d` };
  return { clase: "t-blue", texto: `${dias}d` };
}

export default async function CxpPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requirePermiso("cxp.view");
  const { q } = await searchParams;

  const resumen = await resumenCxp();
  const { filas, total, suma } = await listarDocumentosCxp(q);

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Cuentas por Pagar</div>
          <h1>Obligaciones con Proveedores</h1>
          <p>Saldo neto (lo que realmente se debe · incluye anticipos)</p>
        </div>
        <div className="toolbar">
          <a href="/cxp/proveedores" className="btn primary">Informe por proveedor</a>
          <a href="/cxp/anticipos" className="btn">Anticipos</a>
        </div>
      </div>

      <div className="kpis">
        <div className="kpi">
          <div className="klabel">CxP neta</div>
          <div className="kval num">{formatCOP(resumen.total)}</div>
          <div className="ksub"><span className="flag">{resumen.cantidad} documentos</span></div>
        </div>
        <div className="kpi k-bad">
          <div className="klabel">Vencida</div>
          <div className="kval num">{formatCOP(resumen.vencido)}</div>
          <div className="ksub"><span className="flag">documentos con mora</span></div>
        </div>
        <div className="kpi k-ok">
          <div className="klabel">Al día / por vencer</div>
          <div className="kval num">{formatCOP(resumen.alDia)}</div>
          <div className="ksub"><span className="flag">sin mora</span></div>
        </div>
        <a href="/cxp/anticipos" className="kpi k-w" style={{ textDecoration: "none" }}>
          <div className="klabel">Anticipos (incluidos)</div>
          <div className="kval num">{formatCOP(resumen.anticipos)}</div>
          <div className="ksub"><span className="flag">{resumen.anticiposCantidad} docs · ver detalle →</span></div>
        </a>
      </div>

      <div className="card">
        <div className="chart-head">
          Documentos por pagar
          <span className="hact">
            {q ? `${total} coincidencias` : `${resumen.cantidad} documentos`}
            {filas.length < total ? ` · mostrando ${filas.length}` : ""}
          </span>
        </div>
        <div className="card-body" style={{ paddingBottom: 0 }}>
          <Buscador action="/cxp" q={q} placeholder="Proveedor, N.º de documento o concepto…" />
        </div>
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th>Documento</th><th>Proveedor</th><th>NIT</th><th>Concepto</th>
                <th className="r">Saldo</th><th>Vence</th><th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {filas.length > 0 && (
                <tr className="fila-total">
                  <td colSpan={4} style={{ fontWeight: 800 }}>Total neto · {total} documento{total === 1 ? "" : "s"}</td>
                  <td className="r num" style={{ fontWeight: 800 }}>{formatCOP(suma)}</td>
                  <td colSpan={2}></td>
                </tr>
              )}
              {filas.length === 0 ? (
                <tr><td colSpan={7} className="empty">Sin resultados{q ? ` para "${q}"` : ""}.</td></tr>
              ) : (
                filas.map((d) => {
                  const t = tagVencimiento(diasParaVencer(d.fechaVencimiento));
                  return (
                    <tr key={d.id}>
                      <td style={{ fontWeight: 600 }}>{d.numero}</td>
                      <td>{d.proveedor}</td>
                      <td className="num flag">{d.nit}</td>
                      <td className="flag" style={{ maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis" }} title={d.concepto ?? ""}>{d.concepto}</td>
                      <td className="r num" style={{ fontWeight: 700, color: d.saldo < 0 ? "var(--ok)" : undefined }}>{formatCOP(d.saldo)}</td>
                      <td>{fmtFecha(d.fechaVencimiento)} <span className={`tag ${t.clase}`}>{t.texto}</span></td>
                      <td>{d.estado}</td>
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
