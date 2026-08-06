// ==========================================================
// Informe de CxP por Proveedor (por pagar), con tipo Interno/Externo,
// búsqueda, filtro, % de participación y total arriba.
// Los anticipos NO entran aquí (van en /cxp/anticipos).
// ==========================================================
import { requirePermiso } from "@/server/auth-context";
import { formatCOP, formatPorcentaje } from "@/lib/format";
import { cxpPorProveedor, type TipoProveedorFiltro } from "@/lib/negocio/cxp";
import { Buscador } from "../../_components/Buscador";

export default async function CxpPorProveedorPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tipo?: string }>;
}) {
  await requirePermiso("cxp.view");
  const { q, tipo: tipoRaw } = await searchParams;
  const tipo: TipoProveedorFiltro | undefined =
    tipoRaw === "interno" || tipoRaw === "externo" ? tipoRaw : undefined;

  const filas = await cxpPorProveedor(q, tipo);
  const tot = filas.reduce(
    (a, f) => ({ docs: a.docs + f.documentos, saldo: a.saldo + f.saldo, vencido: a.vencido + f.vencido }),
    { docs: 0, saldo: 0, vencido: 0 },
  );

  const qs = q ? `&q=${encodeURIComponent(q)}` : "";
  const filtro = (t?: TipoProveedorFiltro) => (t ? `/cxp/proveedores?tipo=${t}${qs}` : `/cxp/proveedores${q ? `?q=${encodeURIComponent(q)}` : ""}`);

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Cuentas por Pagar</div>
          <h1>Informe por proveedor</h1>
          <p>{filas.length} proveedores · por pagar {formatCOP(tot.saldo)}</p>
        </div>
        <div className="toolbar">
          <a href={filtro(undefined)} className={`btn${!tipo ? " primary" : ""}`}>Todos</a>
          <a href={filtro("externo")} className={`btn${tipo === "externo" ? " primary" : ""}`}>Externos</a>
          <a href={filtro("interno")} className={`btn${tipo === "interno" ? " primary" : ""}`}>Internos</a>
          <a href="/cxp" className="btn">← Documentos</a>
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
                <th>Proveedor</th><th>NIT</th><th>Tipo</th><th className="r">Docs</th>
                <th className="r">Por pagar</th><th className="r">% Part.</th>
                <th className="r">Vencido</th><th className="r">Mora máx.</th>
              </tr>
            </thead>
            <tbody>
              {filas.length > 0 && (
                <tr className="fila-total">
                  <td style={{ fontWeight: 800 }}>Total · {filas.length} proveedores</td>
                  <td></td><td></td>
                  <td className="r num" style={{ fontWeight: 800 }}>{tot.docs}</td>
                  <td className="r num" style={{ fontWeight: 800 }}>{formatCOP(tot.saldo)}</td>
                  <td className="r num" style={{ fontWeight: 800 }}>{formatPorcentaje(100)}</td>
                  <td className="r num">{formatCOP(tot.vencido)}</td>
                  <td></td>
                </tr>
              )}
              {filas.length === 0 ? (
                <tr><td colSpan={8} className="empty">Sin resultados{q ? ` para "${q}"` : ""}.</td></tr>
              ) : (
                filas.map((f) => (
                  <tr key={f.proveedorId}>
                    <td style={{ fontWeight: 600 }}>{f.proveedor}</td>
                    <td className="num flag">{f.nit}</td>
                    <td><span className={`tag ${f.interno ? "t-w1" : "t-blue"}`}>{f.interno ? "Interno" : "Externo"}</span></td>
                    <td className="r num">{f.documentos}</td>
                    <td className="r num" style={{ fontWeight: 700 }}>{formatCOP(f.saldo)}</td>
                    <td className="r num">{tot.saldo !== 0 ? formatPorcentaje((f.saldo / tot.saldo) * 100) : "—"}</td>
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
