// ==========================================================
// Impuestos pendientes (histórico mensual, BioSteel).
// ==========================================================
import { requirePermiso } from "@/server/auth-context";
import { formatCOP, formatNumero } from "@/lib/format";
import { listarImpuestos, resumenImpuestos, type AlertaImpuesto } from "@/lib/negocio/impuestos";

const MES = ["", "Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const fmtFecha = (d: Date) => new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "short", year: "2-digit" }).format(d);

function badge(a: AlertaImpuesto, dias: number | null): { clase: string; texto: string } | null {
  switch (a) {
    case "vencido": return { clase: "t-bad", texto: `Vencido ${Math.abs(dias ?? 0)}d` };
    case "urgente": return { clase: "t-bad", texto: dias === 0 ? "Hoy" : `En ${dias}d` };
    case "pronto": return { clase: "t-w1", texto: `En ${dias}d` };
    case "ok": return { clase: "t-ok", texto: `En ${dias}d` };
    default: return null;
  }
}

export default async function ImpuestosPage() {
  await requirePermiso("cxp.view");
  const [filas, resumen] = await Promise.all([listarImpuestos(), resumenImpuestos()]);
  const pendientes = filas.filter((f) => f.total > 0);

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Tesorería</div>
          <h1>Impuestos pendientes</h1>
          <p>BioSteel · histórico mensual (Retención, IVA, ICA, Renta)</p>
        </div>
      </div>

      <div className="kpis">
        <div className="kpi">
          <div className="klabel">Total pendiente</div>
          <div className="kval num">{formatCOP(resumen.totalPendiente)}</div>
          <div className="ksub"><span className="flag">{resumen.mesesConSaldo} meses con saldo</span></div>
        </div>
        <div className="kpi k-bad">
          <div className="klabel">Vencido</div>
          <div className="kval num">{formatCOP(resumen.vencido)}</div>
          <div className="ksub"><span className="flag">vencimiento pasado</span></div>
        </div>
        <div className="kpi">
          <div className="klabel">Renta</div>
          <div className="kval num">{formatCOP(resumen.renta)}</div>
          <div className="ksub"><span className="flag">del total pendiente</span></div>
        </div>
        <div className="kpi k-w">
          <div className="klabel">Próximo vencimiento</div>
          <div className="kval num" style={{ fontSize: 22 }}>{resumen.proximo ? fmtFecha(resumen.proximo.fecha) : "—"}</div>
          <div className="ksub"><span className="flag">{resumen.proximo ? formatCOP(resumen.proximo.total) : "sin futuros"}</span></div>
        </div>
      </div>

      <div className="card">
        <div className="chart-head">
          Detalle por período <span className="hact">{formatNumero(pendientes.length)} meses con saldo</span>
        </div>
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th>Período</th><th className="r">Retención</th><th className="r">IVA</th><th className="r">ICA</th>
                <th className="r">Renta</th><th className="r">Total</th><th>Vencimiento</th>
              </tr>
            </thead>
            <tbody>
              <tr className="fila-total">
                <td style={{ fontWeight: 800 }}>Total pendiente</td>
                <td className="r num" style={{ fontWeight: 800 }}>{formatCOP(resumen.retencion)}</td>
                <td className="r num" style={{ fontWeight: 800 }}>{formatCOP(resumen.iva)}</td>
                <td className="r num" style={{ fontWeight: 800 }}>{formatCOP(resumen.ica)}</td>
                <td className="r num" style={{ fontWeight: 800 }}>{formatCOP(resumen.renta)}</td>
                <td className="r num" style={{ fontWeight: 800 }}>{formatCOP(resumen.totalPendiente)}</td>
                <td></td>
              </tr>
              {pendientes.map((f) => {
                const b = badge(f.alerta, f.dias);
                return (
                  <tr key={f.id}>
                    <td style={{ fontWeight: 600 }}>{MES[f.mes]} {f.anio}</td>
                    <td className="r num">{f.retencion ? formatCOP(f.retencion) : "—"}</td>
                    <td className="r num">{f.iva ? formatCOP(f.iva) : "—"}</td>
                    <td className="r num">{f.ica ? formatCOP(f.ica) : "—"}</td>
                    <td className="r num">{f.renta ? formatCOP(f.renta) : "—"}</td>
                    <td className="r num" style={{ fontWeight: 700 }}>{formatCOP(f.total)}</td>
                    <td>{f.vencimiento ? <>{fmtFecha(f.vencimiento)} {b && <span className={`tag ${b.clase}`}>{b.texto}</span>}</> : <span className="flag">—</span>}</td>
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
