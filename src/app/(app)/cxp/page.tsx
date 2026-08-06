// ==========================================================
// Cuentas por Pagar (CxP)
// Documentos por pagar con manejo de moneda extranjera (valor origen
// + equivalente COP). Filtro opcional por moneda (?moneda=USD).
// ==========================================================
import { requirePermiso } from "@/server/auth-context";
import { formatCOP, formatMoneda } from "@/lib/format";
import { resumenCxp, listarDocumentosCxp, diasParaVencer } from "@/lib/negocio/cxp";

const SIMBOLO: Record<string, string> = { COP: "$", USD: "US$", EUR: "€" };

const fmtFecha = (d: Date) => new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "short", year: "2-digit" }).format(d);

function tagVencimiento(dias: number): { clase: string; texto: string } {
  if (dias < 0) return { clase: "t-bad", texto: `Vencido ${Math.abs(dias)}d` };
  if (dias <= 7) return { clase: "t-w1", texto: `≤ ${dias}d` };
  return { clase: "t-blue", texto: `${dias}d` };
}

export default async function CxpPage({
  searchParams,
}: {
  searchParams: Promise<{ moneda?: string }>;
}) {
  await requirePermiso("cxp.view");
  const { moneda } = await searchParams;
  const filtroMoneda = moneda && ["COP", "USD", "EUR"].includes(moneda) ? moneda : undefined;

  const resumen = await resumenCxp();
  const docs = await listarDocumentosCxp(filtroMoneda);

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Cuentas por Pagar</div>
          <h1>Obligaciones con Proveedores</h1>
          <p>Incluye importaciones en moneda extranjera</p>
        </div>
        <div className="toolbar">
          <a href="/cxp" className={`btn${!filtroMoneda ? " primary" : ""}`}>Todas</a>
          <a href="/cxp?moneda=COP" className={`btn${filtroMoneda === "COP" ? " primary" : ""}`}>COP</a>
          <a href="/cxp?moneda=USD" className={`btn${filtroMoneda === "USD" ? " primary" : ""}`}>USD</a>
        </div>
      </div>

      <div className="kpis">
        <div className="kpi">
          <div className="klabel">CxP total (COP)</div>
          <div className="kval num">{formatCOP(resumen.totalCop)}</div>
          <div className="ksub"><span className="flag">{resumen.cantidad} documentos</span></div>
        </div>
        <div className="kpi k-bad">
          <div className="klabel">Vencidas</div>
          <div className="kval num">{formatCOP(resumen.vencidoCop)}</div>
          <div className="ksub"><span className="flag">del total por pagar</span></div>
        </div>
        <div className="kpi">
          <div className="klabel">En USD</div>
          <div className="kval num">{formatMoneda(resumen.saldoUsd, "US$")}</div>
          <div className="ksub"><span className="flag">≈ {formatCOP(resumen.saldoUsdEnCop)}</span></div>
        </div>
        <div className="kpi k-w">
          <div className="klabel">Vence ≤ 7 días</div>
          <div className="kval num">{formatCOP(resumen.proximoVencerCop)}</div>
          <div className="ksub"><span className="flag">{resumen.proximoVencerCantidad} documentos</span></div>
        </div>
      </div>

      <div className="card">
        <div className="chart-head">
          Documentos por pagar
          <span className="hact">{docs.length} documentos{filtroMoneda ? ` · ${filtroMoneda}` : ""}</span>
        </div>
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th>Documento</th><th>Proveedor</th><th>Moneda</th>
                <th className="r">Valor orig.</th><th className="r">Saldo COP</th><th>Vence</th><th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {docs.length === 0 ? (
                <tr><td colSpan={7} className="empty">No hay documentos por pagar{filtroMoneda ? ` en ${filtroMoneda}` : ""}.</td></tr>
              ) : (
                docs.map((d) => {
                  const t = tagVencimiento(diasParaVencer(d.fechaVencimiento));
                  return (
                    <tr key={d.id}>
                      <td style={{ fontWeight: 600 }}>{d.numero}</td>
                      <td>{d.proveedor}</td>
                      <td>{d.moneda}</td>
                      <td className="r num">{formatMoneda(d.valorOrigen, SIMBOLO[d.moneda] ?? d.moneda)}</td>
                      <td className="r num" style={{ fontWeight: 700 }}>{formatCOP(d.saldo)}</td>
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
