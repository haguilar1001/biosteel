// ==========================================================
// Anticipos / saldos a favor (aparte de CxP), por tercero.
// ==========================================================
import { requirePermiso } from "@/server/auth-context";
import { formatNumero } from "@/lib/format";
import { Monto } from "../../_components/Monto";
import { resumenAnticipos, anticiposPorTercero, type TipoProveedorFiltro } from "@/lib/negocio/cxp";
import { Buscador } from "../../_components/Buscador";
import { BotonImprimir } from "../../_components/BotonImprimir";

export default async function AnticiposPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tipo?: string }>;
}) {
  await requirePermiso("cxp.view");
  const { q, tipo: tipoRaw } = await searchParams;
  const tipo: TipoProveedorFiltro | undefined =
    tipoRaw === "interno" || tipoRaw === "externo" ? tipoRaw : undefined;

  const [resumen, filas] = await Promise.all([resumenAnticipos(), anticiposPorTercero(q, tipo)]);
  const totFiltrado = filas.reduce((a, f) => ({ docs: a.docs + f.documentos, ant: a.ant + f.anticipo }), { docs: 0, ant: 0 });

  const qs = q ? `&q=${encodeURIComponent(q)}` : "";
  const filtro = (t?: TipoProveedorFiltro) => (t ? `/cxp/anticipos?tipo=${t}${qs}` : `/cxp/anticipos${q ? `?q=${encodeURIComponent(q)}` : ""}`);

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Cuentas por Pagar</div>
          <h1>Anticipos / saldos a favor</h1>
          <p>Se manejan aparte y no afectan el saldo de CxP</p>
        </div>
        <div className="toolbar">
          <a href={filtro(undefined)} className={`btn${!tipo ? " primary" : ""}`}>Todos</a>
          <a href={filtro("externo")} className={`btn${tipo === "externo" ? " primary" : ""}`}>Externos</a>
          <a href={filtro("interno")} className={`btn${tipo === "interno" ? " primary" : ""}`}>Internos</a>
          <a href={`/cxp/anticipos/export?${new URLSearchParams({ ...(tipo ? { tipo } : {}), ...(q ? { q } : {}) }).toString()}`} className="btn" title="Descargar en Excel">⬇️ Excel</a>
          <BotonImprimir />
          <a href="/cxp" className="btn">← Documentos</a>
        </div>
      </div>

      <div className="kpis">
        <div className="kpi k-ok">
          <div className="klabel">Total anticipos</div>
          <div className="kval num"><Monto value={resumen.total} /></div>
          <div className="ksub"><span className="flag">{formatNumero(resumen.cantidad)} documentos</span></div>
        </div>
        <div className="kpi">
          <div className="klabel">A internos</div>
          <div className="kval num"><Monto value={resumen.internos} /></div>
        </div>
        <div className="kpi">
          <div className="klabel">A externos</div>
          <div className="kval num"><Monto value={resumen.externos} /></div>
        </div>
      </div>

      <div className="card">
        <div className="card-body" style={{ paddingBottom: 0 }}>
          <Buscador action="/cxp/anticipos" q={q} placeholder="Buscar tercero o NIT…" />
        </div>
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th>Tercero</th><th>NIT</th><th>Tipo</th><th className="r">Docs</th><th className="r">Anticipo</th>
              </tr>
            </thead>
            <tbody>
              {filas.length > 0 && (
                <tr className="fila-total">
                  <td style={{ fontWeight: 800 }}>Total · {formatNumero(filas.length)} terceros</td>
                  <td></td><td></td>
                  <td className="r num" style={{ fontWeight: 800 }}>{totFiltrado.docs}</td>
                  <td className="r num" style={{ fontWeight: 800 }}><Monto value={totFiltrado.ant} /></td>
                </tr>
              )}
              {filas.length === 0 ? (
                <tr><td colSpan={5} className="empty">Sin anticipos{q ? ` para "${q}"` : ""}.</td></tr>
              ) : (
                filas.map((f) => (
                  <tr key={f.terceroId}>
                    <td style={{ fontWeight: 600 }}>{f.tercero}</td>
                    <td className="num flag">{f.nit}</td>
                    <td><span className={`tag ${f.interno ? "t-w1" : "t-blue"}`}>{f.interno ? "Interno" : "Externo"}</span></td>
                    <td className="r num">{formatNumero(f.documentos)}</td>
                    <td className="r num" style={{ fontWeight: 700, color: "var(--ok)" }}><Monto value={f.anticipo} /></td>
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
