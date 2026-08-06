// ==========================================================
// Cartera (Cuentas por Cobrar)
// Listado de facturas abiertas con aging. Filtro por cubeta vía query
// (?edad=corriente|d31_60|d61_90|mas90). Alcance aplicado en el servidor.
// ==========================================================
import { requirePermiso } from "@/server/auth-context";
import { formatCOP } from "@/lib/format";
import { resumenCartera, listarFacturas } from "@/lib/negocio/cartera";
import { CUBETAS, type CubetaAging } from "@/lib/negocio/aging";

const CUBETA_TAG: Record<CubetaAging, string> = {
  d1_30: "t-ok",
  d31_60: "t-w1",
  d61_90: "t-w2",
  d91_120: "t-bad",
  mas120: "t-bad",
};
const CUBETA_LABEL: Record<CubetaAging, string> = {
  d1_30: "1–30",
  d31_60: "31–60",
  d61_90: "61–90",
  d91_120: "91–120",
  mas120: "+120",
};
const ESTADO_LABEL: Record<string, string> = {
  corriente: "Corriente",
  abonada_parcial: "Abono parcial",
  en_mora: "En mora",
  vencida: "Vencida",
  en_glosa: "En glosa",
  cancelada: "Cancelada",
};

const fmtFecha = (d: Date) => new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "short", year: "2-digit" }).format(d);

export default async function CarteraPage({
  searchParams,
}: {
  searchParams: Promise<{ edad?: string }>;
}) {
  const { usuario, alcance } = await requirePermiso("cartera.view");
  const { edad } = await searchParams;
  const cubetaFiltro = CUBETAS.some((c) => c.clave === edad) ? (edad as CubetaAging) : undefined;

  const resumen = await resumenCartera(usuario, alcance);
  const filas = await listarFacturas(usuario, alcance, { cubeta: cubetaFiltro });

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Cartera</div>
          <h1>Cuentas por Cobrar</h1>
          <p>Facturas abiertas · alcance <code>{alcance}</code></p>
        </div>
      </div>

      <div className="kpis">
        {CUBETAS.map((c) => {
          const celda = resumen.porCubeta[c.clave];
          const activo = cubetaFiltro === c.clave;
          return (
            <a
              key={c.clave}
              href={activo ? "/cartera" : `/cartera?edad=${c.clave}`}
              className="kpi"
              style={{ textDecoration: "none", outline: activo ? "2px solid var(--brand)" : undefined }}
            >
              <div className="klabel">{c.etiqueta}</div>
              <div className="kval num" style={{ color: c.color }}>{formatCOP(celda.monto)}</div>
              <div className="ksub"><span className="flag">{celda.cantidad} facturas</span></div>
            </a>
          );
        })}
      </div>

      <div className="card">
        <div className="chart-head">
          Detalle de facturas
          <span className="hact">
            {filas.length} facturas{cubetaFiltro ? ` · filtro: ${CUBETA_LABEL[cubetaFiltro]}` : ""}
          </span>
        </div>
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th>Factura</th><th>Cliente</th><th>Sede</th><th>Emisión</th><th>Vence</th>
                <th className="r">Valor</th><th className="r">Saldo</th><th>Edad</th><th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {filas.length === 0 ? (
                <tr><td colSpan={9} className="empty">No hay facturas en tu alcance{cubetaFiltro ? " para este filtro" : ""}.</td></tr>
              ) : (
                filas.map((f) => (
                  <tr key={f.id}>
                    <td style={{ fontWeight: 600 }}>{f.numero}</td>
                    <td>{f.cliente}</td>
                    <td>{f.sede}</td>
                    <td>{fmtFecha(f.fechaEmision)}</td>
                    <td>{fmtFecha(f.fechaVencimiento)}</td>
                    <td className="r num">{formatCOP(f.valorTotal)}</td>
                    <td className="r num" style={{ fontWeight: 700 }}>{formatCOP(f.saldo)}</td>
                    <td><span className={`tag ${CUBETA_TAG[f.cubeta]}`}>{CUBETA_LABEL[f.cubeta]}{f.dias > 0 ? ` · ${f.dias}d` : ""}</span></td>
                    <td>{ESTADO_LABEL[f.estado] ?? f.estado}</td>
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
