// ==========================================================
// Obligaciones Financieras: saldos, cuota mensual, próximos
// vencimientos con alertas.
// ==========================================================
import { requirePermiso } from "@/server/auth-context";
import { formatCOP, formatPorcentaje, formatNumero } from "@/lib/format";
import { listarObligaciones, resumenObligaciones, tipoLabel, type NivelAlerta } from "@/lib/negocio/obligaciones";

const fmtFecha = (d: Date) => new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "short", year: "2-digit" }).format(d);

function badgeAlerta(alerta: NivelAlerta, dias: number | null): { clase: string; texto: string } {
  switch (alerta) {
    case "vencido": return { clase: "t-bad", texto: `Vencido ${Math.abs(dias ?? 0)}d` };
    case "urgente": return { clase: "t-bad", texto: dias === 0 ? "Hoy" : `En ${dias}d` };
    case "pronto": return { clase: "t-w1", texto: `En ${dias}d` };
    case "ok": return { clase: "t-ok", texto: `En ${dias}d` };
    default: return { clase: "t-blue", texto: "—" };
  }
}

export default async function ObligacionesPage() {
  await requirePermiso("cxp.view");
  const [filas, resumen] = await Promise.all([listarObligaciones(), resumenObligaciones()]);
  const porConfirmar = filas.some((f) => f.notas?.includes("CONFIRMAR"));

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Tesorería</div>
          <h1>Obligaciones Financieras</h1>
          <p>Créditos, leasing y tarjetas · saldos y próximos vencimientos</p>
        </div>
      </div>

      <div className="kpis">
        <div className="kpi">
          <div className="klabel">Saldo total</div>
          <div className="kval num">{formatCOP(resumen.totalSaldo)}</div>
          <div className="ksub"><span className="flag">{formatNumero(resumen.cantidad)} obligaciones</span></div>
        </div>
        <div className="kpi k-egreso">
          <div className="klabel">Cuota mensual</div>
          <div className="kval num">{formatCOP(resumen.totalCuotaMensual)}</div>
          <div className="ksub"><span className="flag">suma de cuotas</span></div>
        </div>
        <div className="kpi k-w">
          <div className="klabel">Próximo vencimiento</div>
          <div className="kval num" style={{ fontSize: 22 }}>{resumen.proximo ? fmtFecha(resumen.proximo.fecha) : "—"}</div>
          <div className="ksub"><span className="flag">{resumen.proximo ? resumen.proximo.entidad : "sin fechas"}</span></div>
        </div>
        <div className="kpi k-ok">
          <div className="klabel">Estado</div>
          <div className="kval num" style={{ fontSize: 22 }}>Todas al día</div>
          <div className="ksub"><span className="flag">sin mora</span></div>
        </div>
      </div>

      <div className="card">
        <div className="chart-head">Detalle de obligaciones</div>
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th>Entidad</th><th>Tipo</th><th>Número</th><th className="r">Saldo</th>
                <th className="r">Tasa EA</th><th className="r">Cuota mensual</th><th>Próximo pago</th><th>Vence</th>
              </tr>
            </thead>
            <tbody>
              <tr className="fila-total">
                <td colSpan={3} style={{ fontWeight: 800 }}>Total · {formatNumero(resumen.cantidad)} obligaciones</td>
                <td className="r num" style={{ fontWeight: 800 }}>{formatCOP(resumen.totalSaldo)}</td>
                <td></td>
                <td className="r num" style={{ fontWeight: 800 }}>{formatCOP(resumen.totalCuotaMensual)}</td>
                <td colSpan={2}></td>
              </tr>
              {filas.map((o) => {
                const b = badgeAlerta(o.alerta, o.diasHasta);
                return (
                  <tr key={o.id}>
                    <td style={{ fontWeight: 600 }} title={o.notas ?? ""}>{o.entidad}</td>
                    <td><span className="tag t-blue">{tipoLabel(o.tipo)}</span></td>
                    <td className="num flag">{o.numero}</td>
                    <td className="r num" style={{ fontWeight: 700 }}>{formatCOP(o.saldoCapital)}</td>
                    <td className="r num">{o.tasaEA != null ? formatPorcentaje(o.tasaEA) : "—"}</td>
                    <td className="r num">{o.cuotaMensual != null ? formatCOP(o.cuotaMensual) : "—"}</td>
                    <td>
                      {o.proximaFecha
                        ? <>{fmtFecha(o.proximaFecha)} <span className={`tag ${b.clase}`}>{b.texto}</span></>
                        : <span className="flag">—</span>}
                    </td>
                    <td className="flag">{o.fechaVencimiento ? fmtFecha(o.fechaVencimiento) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {porConfirmar && (
        <div className="card" style={{ marginTop: 12 }}>
          <div className="card-body">
            <p style={{ margin: 0, color: "var(--muted)" }}>
              ⚠️ El <strong>saldo de la tarjeta Serfinanza</strong> quedó por confirmar (el extracto es un formato de formulario y no se pudo leer automáticamente).
              Pásame el saldo y el pago mínimo del corte 15/07/2026 y lo actualizo.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
