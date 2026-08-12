// ==========================================================
// Informe de CxP por Proveedor (por pagar), con tipo Interno/Externo,
// búsqueda, filtro, % de participación y total arriba.
// Los anticipos NO entran aquí (van en /cxp/anticipos).
// ==========================================================
import { requirePermiso } from "@/server/auth-context";
import { formatCOP, formatPorcentaje, formatNumero } from "@/lib/format";
import { Monto } from "../../_components/Monto";
import { cxpPorProveedor, type TipoProveedorFiltro } from "@/lib/negocio/cxp";
import { Buscador } from "../../_components/Buscador";
import { BotonImprimir } from "../../_components/BotonImprimir";
import { Donut } from "../../_components/charts/Donut";
import { TopRanking, type RankItem } from "../../_components/charts/TopRanking";

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
    (a, f) => ({ docs: a.docs + f.documentos, saldo: a.saldo + f.saldoNeto, vencido: a.vencido + f.vencido }),
    { docs: 0, saldo: 0, vencido: 0 },
  );

  // Para los visuales usamos SIEMPRE ambos tipos (respeta la búsqueda, ignora el filtro tipo).
  // Composición sobre el POR-PAGAR (saldos positivos): los internos netean negativo (anticipos),
  // así que un neto por tipo no representa "a quién le debemos". Usamos exposición positiva.
  const paraViz = tipo ? await cxpPorProveedor(q) : filas;
  const internoT = paraViz.filter((f) => f.interno).reduce((s, f) => s + Math.max(0, f.saldoNeto), 0);
  const externoT = paraViz.filter((f) => !f.interno).reduce((s, f) => s + Math.max(0, f.saldoNeto), 0);
  const totalViz = internoT + externoT;
  const donutTipo = [
    { label: "Externos", valor: externoT, color: "var(--cat-1)" },
    { label: "Internos", valor: internoT, color: "var(--cat-3)" },
  ];
  const rankProv: RankItem[] = [...paraViz]
    .sort((a, b) => b.saldoNeto - a.saldoNeto)
    .map((f) => ({ label: f.proveedor, valor: f.saldoNeto, sub: `${formatNumero(f.documentos)} docs · ${f.interno ? "Interno" : "Externo"}` }));

  const qs = q ? `&q=${encodeURIComponent(q)}` : "";
  const filtro = (t?: TipoProveedorFiltro) => (t ? `/cxp/proveedores?tipo=${t}${qs}` : `/cxp/proveedores${q ? `?q=${encodeURIComponent(q)}` : ""}`);

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Cuentas por Pagar</div>
          <h1>Informe por proveedor</h1>
          <p>{formatNumero(filas.length)} proveedores · saldo neto <Monto value={tot.saldo} /></p>
        </div>
        <div className="toolbar">
          <a href={filtro(undefined)} className={`btn${!tipo ? " primary" : ""}`}>Todos</a>
          <a href={filtro("externo")} className={`btn${tipo === "externo" ? " primary" : ""}`}>Externos</a>
          <a href={filtro("interno")} className={`btn${tipo === "interno" ? " primary" : ""}`}>Internos</a>
          <a href={`/cxp/proveedores/export?${new URLSearchParams({ ...(tipo ? { tipo } : {}), ...(q ? { q } : {}) }).toString()}`} className="btn" title="Descargar en Excel">⬇️ Excel</a>
          <BotonImprimir />
          <a href="/cxp" className="btn">← Documentos</a>
        </div>
      </div>

      <div className="grid two no-print" style={{ marginBottom: 12 }}>
        <div className="card">
          <div className="chart-head">Composición Interno vs Externo <span className="hact">por pagar (saldos positivos)</span></div>
          <div className="card-body">
            {totalViz === 0 ? <div className="empty">Sin saldos por pagar.</div> : (
              <Donut data={donutTipo} centro={{ valor: (totalViz / 1e9).toFixed(1).replace(".", ",") + " MM", etiqueta: "por pagar" }} />
            )}
          </div>
        </div>
        <TopRanking titulo="Mayores proveedores por pagar" items={rankProv} color="var(--cat-1)" inicial={10} step={5} />
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
                <th className="r">Saldo neto</th><th className="r">% Part.</th>
                <th className="r">Vencido</th><th className="r">Mora máx.</th>
              </tr>
            </thead>
            <tbody>
              {filas.length > 0 && (
                <tr className="fila-total">
                  <td style={{ fontWeight: 800 }}>Total · {formatNumero(filas.length)} proveedores</td>
                  <td></td><td></td>
                  <td className="r num" style={{ fontWeight: 800 }}>{formatNumero(tot.docs)}</td>
                  <td className="r num" style={{ fontWeight: 800 }}><Monto value={tot.saldo} /></td>
                  <td className="r num" style={{ fontWeight: 800 }}>{formatPorcentaje(100)}</td>
                  <td className="r num"><Monto value={tot.vencido} /></td>
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
                    <td className="r num">{formatNumero(f.documentos)}</td>
                    <td className="r num" style={{ fontWeight: 700 }}><Monto value={f.saldoNeto} /></td>
                    <td className="r num">{tot.saldo !== 0 ? formatPorcentaje((f.saldoNeto / tot.saldo) * 100) : "—"}</td>
                    <td className="r num" style={{ color: f.vencido > 0 ? "var(--bad)" : undefined }}>{f.vencido !== 0 ? formatCOP(f.vencido) : "—"}</td>
                    <td className="r num">{f.diasMax > 0 ? `${formatNumero(f.diasMax)}d` : "—"}</td>
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
