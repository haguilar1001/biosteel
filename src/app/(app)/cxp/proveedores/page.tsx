// ==========================================================
// Informe de CxP por Proveedor (neto), con buscador.
// ==========================================================
import { requirePermiso } from "@/server/auth-context";
import { formatCOP, formatPorcentaje } from "@/lib/format";
import { cxpPorProveedor } from "@/lib/negocio/cxp";
import { Buscador } from "../../_components/Buscador";

export default async function CxpPorProveedorPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requirePermiso("cxp.view");
  const { q } = await searchParams;

  const filas = await cxpPorProveedor(q);
  const tot = filas.reduce(
    (a, f) => ({
      docs: a.docs + f.documentos,
      neto: a.neto + f.saldoNeto,
      porPagar: a.porPagar + f.porPagar,
      anticipos: a.anticipos + f.anticipos,
      vencido: a.vencido + f.vencido,
    }),
    { docs: 0, neto: 0, porPagar: 0, anticipos: 0, vencido: 0 },
  );

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Cuentas por Pagar</div>
          <h1>Informe por proveedor</h1>
          <p>{filas.length} proveedores · saldo neto {formatCOP(tot.neto)}</p>
        </div>
        <div className="toolbar">
          <a href="/cxp" className="btn">← Ver documentos</a>
        </div>
      </div>

      <div className="card">
        <div className="card-body" style={{ paddingBottom: 0 }}>
          <Buscador action="/cxp/proveedores" q={q} placeholder="Buscar proveedor o NIT…" />
        </div>
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th>Proveedor</th><th>NIT</th><th className="r">Docs</th>
                <th className="r">Saldo neto</th><th className="r">% Part.</th><th className="r">Por pagar</th>
                <th className="r">Anticipos</th><th className="r">Vencido</th><th className="r">Mora máx.</th>
              </tr>
            </thead>
            <tbody>
              {filas.length > 0 && (
                <tr className="fila-total">
                  <td style={{ fontWeight: 800 }}>Total · {filas.length} proveedores</td>
                  <td></td>
                  <td className="r num" style={{ fontWeight: 800 }}>{tot.docs}</td>
                  <td className="r num" style={{ fontWeight: 800 }}>{formatCOP(tot.neto)}</td>
                  <td className="r num" style={{ fontWeight: 800 }}>{formatPorcentaje(100)}</td>
                  <td className="r num">{formatCOP(tot.porPagar)}</td>
                  <td className="r num">{formatCOP(tot.anticipos)}</td>
                  <td className="r num">{formatCOP(tot.vencido)}</td>
                  <td></td>
                </tr>
              )}
              {filas.length === 0 ? (
                <tr><td colSpan={9} className="empty">Sin resultados{q ? ` para "${q}"` : ""}.</td></tr>
              ) : (
                filas.map((f) => (
                  <tr key={f.proveedorId}>
                    <td style={{ fontWeight: 600 }}>{f.proveedor}</td>
                    <td className="num flag">{f.nit}</td>
                    <td className="r num">{f.documentos}</td>
                    <td className="r num" style={{ fontWeight: 700 }}>{formatCOP(f.saldoNeto)}</td>
                    <td className="r num">{tot.neto !== 0 ? formatPorcentaje((f.saldoNeto / tot.neto) * 100) : "—"}</td>
                    <td className="r num">{formatCOP(f.porPagar)}</td>
                    <td className="r num" style={{ color: f.anticipos < 0 ? "var(--ok)" : undefined }}>{f.anticipos < 0 ? formatCOP(f.anticipos) : "—"}</td>
                    <td className="r num" style={{ color: f.vencido > 0 ? "var(--bad)" : undefined }}>{f.vencido !== 0 ? formatCOP(f.vencido) : "—"}</td>
                    <td className="r num">{f.diasMax > 0 ? `${f.diasMax}d` : "—"}</td>
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
