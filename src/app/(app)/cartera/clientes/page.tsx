// Informe de Cartera por Cliente (neto), con buscador, % participación y total arriba.
import { requirePermiso } from "@/server/auth-context";
import { formatCOP, formatPorcentaje, formatNumero } from "@/lib/format";
import { carteraPorCliente } from "@/lib/negocio/cartera";
import { Buscador } from "../../_components/Buscador";

export default async function CarteraPorClientePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { usuario, alcance } = await requirePermiso("cartera.view");
  const { q } = await searchParams;

  const filas = await carteraPorCliente(usuario, alcance, q);
  const tot = filas.reduce(
    (a, f) => ({ docs: a.docs + f.documentos, saldo: a.saldo + f.saldoNeto, vencido: a.vencido + f.vencido }),
    { docs: 0, saldo: 0, vencido: 0 },
  );

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Cartera</div>
          <h1>Informe por cliente</h1>
          <p>{formatNumero(filas.length)} clientes · saldo neto {formatCOP(tot.saldo)}</p>
        </div>
        <div className="toolbar"><a href="/cartera" className="btn">← Facturas</a></div>
      </div>

      <div className="card">
        <div className="card-body" style={{ paddingBottom: 0 }}>
          <Buscador action="/cartera/clientes" q={q} placeholder="Buscar cliente o NIT…" />
        </div>
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th>Cliente</th><th>NIT</th><th className="r">Facturas</th>
                <th className="r">Saldo neto</th><th className="r">% Part.</th>
                <th className="r">Vencido</th><th className="r">Mora máx.</th>
              </tr>
            </thead>
            <tbody>
              {filas.length > 0 && (
                <tr className="fila-total">
                  <td style={{ fontWeight: 800 }}>Total · {formatNumero(filas.length)} clientes</td>
                  <td></td>
                  <td className="r num" style={{ fontWeight: 800 }}>{tot.docs}</td>
                  <td className="r num" style={{ fontWeight: 800 }}>{formatCOP(tot.saldo)}</td>
                  <td className="r num" style={{ fontWeight: 800 }}>{formatPorcentaje(100)}</td>
                  <td className="r num">{formatCOP(tot.vencido)}</td>
                  <td></td>
                </tr>
              )}
              {filas.length === 0 ? (
                <tr><td colSpan={7} className="empty">Sin resultados{q ? ` para "${q}"` : ""}.</td></tr>
              ) : (
                filas.map((f) => (
                  <tr key={f.clienteId}>
                    <td style={{ fontWeight: 600 }}>{f.cliente}</td>
                    <td className="num flag">{f.nit}</td>
                    <td className="r num">{formatNumero(f.documentos)}</td>
                    <td className="r num" style={{ fontWeight: 700 }}>{formatCOP(f.saldoNeto)}</td>
                    <td className="r num">{tot.saldo !== 0 ? formatPorcentaje((f.saldoNeto / tot.saldo) * 100) : "—"}</td>
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
