// Ingresos: movimientos de entrada (recaudos, préstamos, ventas de contado…).
import { requirePermiso } from "@/server/auth-context";
import { formatCOP } from "@/lib/format";
import { listarMovimientos, MESES_LABEL } from "@/lib/negocio/flujo";

const ANIO = 2026;
const fmtFecha = (d: Date) => new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "short" }).format(d);

export default async function IngresosPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; q?: string }>;
}) {
  await requirePermiso("cxp.view");
  const sp = await searchParams;
  const mes = sp.mes && /^\d+$/.test(sp.mes) ? Number(sp.mes) : undefined;
  const q = sp.q;

  const { filas, total, suma } = await listarMovimientos("ingreso", { anio: ANIO, mes, q });

  return (
    <div className="card">
      <div className="chart-head">Ingresos {ANIO}</div>
      <div className="card-body" style={{ paddingBottom: 0 }}>
        <form method="get" className="toolbar">
          <select name="mes" defaultValue={mes ?? ""} className="select">
            <option value="">Todos los meses</option>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>{MESES_LABEL[m]}</option>
            ))}
          </select>
          <input type="search" name="q" defaultValue={q ?? ""} placeholder="Tercero, NIT, observación…" className="select" style={{ minWidth: 220 }} />
          <button type="submit" className="btn primary">Filtrar</button>
          <a href="/flujo/ingresos" className="btn">Limpiar</a>
        </form>
      </div>
      <div className="tbl-wrap">
        <table>
          <thead>
            <tr><th>Fecha</th><th>Tercero</th><th>Detalle</th><th>Observación</th><th className="r">Valor</th></tr>
          </thead>
          <tbody>
            <tr className="fila-total">
              <td colSpan={4} style={{ fontWeight: 800 }}>Total · {total} movimiento{total === 1 ? "" : "s"}{filas.length < total ? ` (mostrando ${filas.length})` : ""}</td>
              <td className="r num" style={{ fontWeight: 800 }}>{formatCOP(suma)}</td>
            </tr>
            {filas.length === 0 ? (
              <tr><td colSpan={5} className="empty">Sin movimientos.</td></tr>
            ) : (
              filas.map((m) => (
                <tr key={m.id}>
                  <td className="flag">{fmtFecha(m.fecha)}</td>
                  <td style={{ fontWeight: 600 }}>{m.terceroNombre}</td>
                  <td className="flag">{m.detalle}</td>
                  <td className="flag" style={{ maxWidth: 320, overflow: "hidden", textOverflow: "ellipsis" }} title={m.observacion ?? ""}>{m.observacion}</td>
                  <td className="r num" style={{ fontWeight: 700, color: "var(--ok)" }}>{formatCOP(m.valor)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
