// ==========================================================
// Cartera (Cuentas por Cobrar) — en NETO, como CxP.
// KPIs + aging por edades (clicable) + detalle con buscador.
// ==========================================================
import { requirePermiso } from "@/server/auth-context";
import { formatNumero, formatFecha, formatPorcentaje } from "@/lib/format";
import { Monto } from "../_components/Monto";
import { resumenCartera, listarFacturas, aniosCartera } from "@/lib/negocio/cartera";
import { CUBETAS, type CubetaAging } from "@/lib/negocio/aging";
import { MESES_LABEL } from "@/lib/negocio/flujo";
import { Buscador } from "../_components/Buscador";
import { BotonImprimir } from "../_components/BotonImprimir";
import { FiltroAuto } from "../_components/FiltroAuto";

const CUBETA_TAG: Record<CubetaAging, string> = {
  d1_30: "t-ok", d31_60: "t-w1", d61_90: "t-w2", d91_120: "t-bad", mas120: "t-bad",
};
const CUBETA_LABEL: Record<CubetaAging, string> = {
  d1_30: "1–30", d31_60: "31–60", d61_90: "61–90", d91_120: "91–120", mas120: "+120",
};

const SORTS = ["numero", "cliente", "nit", "saldo", "vence", "edad"] as const;
type SortK = (typeof SORTS)[number];
const DEF_DIR: Record<SortK, "asc" | "desc"> = { numero: "asc", cliente: "asc", nit: "asc", saldo: "desc", vence: "desc", edad: "desc" };

export default async function CarteraPage({
  searchParams,
}: {
  searchParams: Promise<{ edad?: string; q?: string; sort?: string; dir?: string; anio?: string; mes?: string }>;
}) {
  const { usuario, alcance } = await requirePermiso("cartera.view");
  const sp = await searchParams;
  const { edad, q } = sp;
  const cubetaFiltro = CUBETAS.some((c) => c.clave === edad) ? (edad as CubetaAging) : undefined;

  // Periodo por fecha de VENCIMIENTO de la factura. Sin selección = toda la cartera.
  const anio = sp.anio && /^d{4}$/.test(sp.anio) ? Number(sp.anio) : undefined;
  const mesNum = sp.mes && /^d{1,2}$/.test(sp.mes) ? Number(sp.mes) : undefined;
  const mes = mesNum && mesNum >= 1 && mesNum <= 12 ? mesNum : undefined;
  const periodo = anio && mes ? `${MESES_LABEL[mes]} ${anio}`
    : anio ? `año ${anio}`
    : mes ? `${MESES_LABEL[mes]} · todos los años`
    : "todos los meses";

  const anios = await aniosCartera(usuario, alcance);
  const resumen = await resumenCartera(usuario, alcance, new Date(), { anio, mes });
  const { filas: filasRaw, total, suma } = await listarFacturas(usuario, alcance, { cubeta: cubetaFiltro, q, anio, mes });
  const carteraPositiva = CUBETAS.reduce((s, c) => s + resumen.porCubeta[c.clave].monto, 0);
  const facturasAging = CUBETAS.reduce((s, c) => s + resumen.porCubeta[c.clave].cantidad, 0);

  // Ordenamiento del detalle (sobre las filas devueltas; el listado se limita
  // a las 300 de mayor saldo antes de filtrar por edad).
  const sort: SortK = (SORTS as readonly string[]).includes(sp.sort ?? "") ? (sp.sort as SortK) : "saldo";
  const dir: "asc" | "desc" = sp.dir === "asc" || sp.dir === "desc" ? sp.dir : DEF_DIR[sort];
  const factor = dir === "asc" ? 1 : -1;
  const filas = [...filasRaw].sort((a, b) => {
    switch (sort) {
      case "saldo": return (a.saldo - b.saldo) * factor;
      case "edad": return (a.dias - b.dias) * factor;
      case "vence": return (a.fechaVencimiento.getTime() - b.fechaVencimiento.getTime()) * factor;
      case "nit": return String(a.nit ?? "").localeCompare(String(b.nit ?? ""), "es-CO", { numeric: true }) * factor;
      case "cliente": return a.cliente.localeCompare(b.cliente, "es-CO") * factor;
      case "numero": return String(a.numero).localeCompare(String(b.numero), "es-CO", { numeric: true }) * factor;
    }
  });
  // Construye URLs conservando los filtros vigentes (búsqueda, edad, periodo).
  const params = (over: Record<string, string | undefined> = {}) => {
    const base: Record<string, string | undefined> = {
      q: q || undefined,
      edad: cubetaFiltro,
      anio: anio ? String(anio) : undefined,
      mes: mes ? String(mes) : undefined,
      ...over,
    };
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(base)) if (v) p.set(k, v);
    return p;
  };
  const href = (over: Record<string, string | undefined> = {}) => {
    const s = params(over).toString();
    return `/cartera${s ? `?${s}` : ""}`;
  };
  const ocultos: Record<string, string> = {};
  if (cubetaFiltro) ocultos.edad = cubetaFiltro;
  if (anio) ocultos.anio = String(anio);
  if (mes) ocultos.mes = String(mes);

  const thHref = (k: SortK) => {
    const nextDir = sort === k ? (dir === "asc" ? "desc" : "asc") : DEF_DIR[k];
    return href({ sort: k, dir: nextDir });
  };

  const expParams = params();
  const expHref = `/cartera/export${expParams.toString() ? `?${expParams}` : ""}`;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Cartera</div>
          <h1>Cuentas por Cobrar</h1>
          <p>Saldo neto · corte 30 jun 2026 · vence: {periodo} · alcance <code>{alcance}</code></p>
        </div>
        <div className="toolbar">
          <a href="/cartera/ciudades" className="btn primary">Por ciudad</a>
          <a href="/cartera/clientes" className="btn">Por cliente</a>
          <a href="/cartera/ventas-recaudos" className="btn">Ventas vs Recaudos</a>
          <a href={expHref} className="btn" title="Descargar en Excel el detalle filtrado">⬇️ Excel</a>
          <BotonImprimir />
        </div>
      </div>

      <div className="card no-print" style={{ marginBottom: 12 }}>
        <div className="card-body" style={{ paddingBottom: 12 }}>
          <FiltroAuto className="toolbar">
            {Object.entries(ocultos)
              .filter(([k]) => k !== "anio" && k !== "mes")
              .map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
            {q ? <input type="hidden" name="q" value={q} /> : null}
            <label className="flag" style={{ alignSelf: "center" }}>Vencimiento — Año:</label>
            <select name="anio" defaultValue={anio ?? ""} className="select">
              <option value="">Todos los años</option>
              {anios.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
            <label className="flag" style={{ alignSelf: "center" }}>Mes:</label>
            <select name="mes" defaultValue={mes ?? ""} className="select">
              <option value="">Todos los meses</option>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>{MESES_LABEL[m]}</option>
              ))}
            </select>
            {anio || mes ? <a href={href({ anio: undefined, mes: undefined })} className="btn">Toda la cartera</a> : null}
          </FiltroAuto>
        </div>
      </div>

      <div className="kpis">
        <div className="kpi kc">
          <div className="klabel">CxC neta</div>
          <div className="kval num"><Monto value={resumen.total} /></div>
          <div className="ksub"><span className="flag">{resumen.cantidadFacturas} facturas</span></div>
        </div>
        <div className="kpi kc k-bad">
          <div className="klabel">Vencida</div>
          <div className="kval num"><Monto value={resumen.vencido} /></div>
          <div className="ksub"><span className="flag">facturas con mora</span></div>
        </div>
        <div className="kpi kc k-ok">
          <div className="klabel">Al día / por vencer</div>
          <div className="kval num"><Monto value={resumen.alDia} /></div>
        </div>
        <div className="kpi kc k-w">
          <div className="klabel">Notas / a favor</div>
          <div className="kval num"><Monto value={resumen.anticipos} /></div>
          <div className="ksub"><span className="flag">{resumen.anticiposCantidad} documentos</span></div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <div className="chart-head">Cartera por edades (aging) <span className="hact">clic en una edad para filtrar</span></div>
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr><th>Edad</th><th className="r">Facturas</th><th className="r">Saldo</th><th className="r">% Part.</th></tr>
            </thead>
            <tbody>
              <tr className="fila-total">
                <td style={{ fontWeight: 800 }}>Total por cobrar</td>
                <td className="r num" style={{ fontWeight: 800 }}>{formatNumero(facturasAging)}</td>
                <td className="r num" style={{ fontWeight: 800 }}><Monto value={carteraPositiva} /></td>
                <td className="r num" style={{ fontWeight: 800 }}>{formatPorcentaje(100)}</td>
              </tr>
              {CUBETAS.map((c) => {
                const celda = resumen.porCubeta[c.clave];
                const activo = cubetaFiltro === c.clave;
                const pct = carteraPositiva > 0 ? (celda.monto / carteraPositiva) * 100 : 0;
                return (
                  <tr key={c.clave} style={{ background: activo ? "var(--brand-tint)" : undefined }}>
                    <td>
                      <a href={href({ edad: activo ? undefined : c.clave })}
                        style={{ textDecoration: "none", color: activo ? "var(--brand)" : "inherit", display: "inline-flex", alignItems: "center", gap: 8, fontWeight: activo ? 700 : 600 }}>
                        <i style={{ width: 11, height: 11, borderRadius: 3, background: c.color, flex: "0 0 auto" }} />
                        {c.etiqueta}{activo ? " ✕" : ""}
                      </a>
                    </td>
                    <td className="r num">{formatNumero(celda.cantidad)}</td>
                    <td className="r num" style={{ fontWeight: 700 }}><Monto value={celda.monto} /></td>
                    <td className="r num" style={{ color: "var(--muted)" }}>{formatPorcentaje(pct)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="chart-head">
          Detalle de facturas
          <span className="hact">
            {q ? `${formatNumero(total)} coincidencias` : `${formatNumero(resumen.cantidadFacturas)} facturas`}
            {cubetaFiltro ? ` · edad ${CUBETA_LABEL[cubetaFiltro]}` : ""}
            {filas.length < total && !cubetaFiltro ? ` · mostrando ${formatNumero(filas.length)}` : ""}
          </span>
        </div>
        <div className="card-body" style={{ paddingBottom: 0 }}>
          <Buscador
            action="/cartera"
            q={q}
            extra={ocultos}
            limpiarHref={href({ q: undefined })}
            placeholder="Cliente, NIT, N.º de factura o concepto…"
          />
        </div>
        <div className="tbl-wrap">
          <table className="tabla-fit">
            <colgroup>
              <col style={{ width: "13%" }} /><col style={{ width: "20%" }} /><col style={{ width: "9%" }} />
              <col style={{ width: "26%" }} /><col style={{ width: "12%" }} /><col style={{ width: "12%" }} /><col style={{ width: "8%" }} />
            </colgroup>
            <thead>
              <tr>
                <th><a href={thHref("numero")} className={`th-sort${sort === "numero" ? " on" : ""}`}>Factura<span className="ord" aria-hidden>{sort === "numero" ? (dir === "asc" ? "▲" : "▼") : "↕"}</span></a></th>
                <th><a href={thHref("cliente")} className={`th-sort${sort === "cliente" ? " on" : ""}`}>Cliente<span className="ord" aria-hidden>{sort === "cliente" ? (dir === "asc" ? "▲" : "▼") : "↕"}</span></a></th>
                <th><a href={thHref("nit")} className={`th-sort${sort === "nit" ? " on" : ""}`}>NIT<span className="ord" aria-hidden>{sort === "nit" ? (dir === "asc" ? "▲" : "▼") : "↕"}</span></a></th>
                <th>Concepto</th>
                <th className="r"><a href={thHref("saldo")} className={`th-sort${sort === "saldo" ? " on" : ""}`}>Saldo<span className="ord" aria-hidden>{sort === "saldo" ? (dir === "asc" ? "▲" : "▼") : "↕"}</span></a></th>
                <th><a href={thHref("vence")} className={`th-sort${sort === "vence" ? " on" : ""}`}>Vence<span className="ord" aria-hidden>{sort === "vence" ? (dir === "asc" ? "▲" : "▼") : "↕"}</span></a></th>
                <th><a href={thHref("edad")} className={`th-sort${sort === "edad" ? " on" : ""}`}>Edad<span className="ord" aria-hidden>{sort === "edad" ? (dir === "asc" ? "▲" : "▼") : "↕"}</span></a></th>
              </tr>
            </thead>
            <tbody>
              {filas.length > 0 && (
                <tr className="fila-total">
                  <td colSpan={4} style={{ fontWeight: 800 }}>Total neto · {formatNumero(total)} factura{total === 1 ? "" : "s"}</td>
                  <td className="r num" style={{ fontWeight: 800 }}><Monto value={suma} /></td>
                  <td colSpan={2}></td>
                </tr>
              )}
              {filas.length === 0 ? (
                <tr><td colSpan={7} className="empty">Sin resultados{q ? ` para "${q}"` : ""}.</td></tr>
              ) : (
                filas.map((f) => (
                  <tr key={f.id}>
                    <td style={{ fontWeight: 600 }} title={f.numero}>{f.numero}</td>
                    <td title={f.cliente}>{f.cliente}</td>
                    <td className="num flag">{f.nit}</td>
                    <td className="flag" title={f.concepto ?? ""}>{f.concepto}</td>
                    <td className="r num" style={{ fontWeight: 700, color: f.saldo < 0 ? "var(--ok)" : undefined }}><Monto value={f.saldo} /></td>
                    <td>{formatFecha(f.fechaVencimiento)}</td>
                    <td>{f.saldo > 0 ? <span className={`tag ${CUBETA_TAG[f.cubeta]}`}>{CUBETA_LABEL[f.cubeta]}{f.dias > 0 ? ` · ${formatNumero(f.dias)}d` : ""}</span> : <span className="flag">—</span>}</td>
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
