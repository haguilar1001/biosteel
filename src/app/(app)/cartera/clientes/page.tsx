// Informe de Cartera por Cliente (neto), con buscador, % participación y total arriba.
import { requirePermiso } from "@/server/auth-context";
import { formatCOP, formatPorcentaje, formatNumero } from "@/lib/format";
import { Monto } from "../../_components/Monto";
import { carteraPorCliente, aniosCartera } from "@/lib/negocio/cartera";
import { MESES_LABEL } from "@/lib/negocio/flujo";
import { Buscador } from "../../_components/Buscador";
import { BotonImprimir } from "../../_components/BotonImprimir";
import { FiltroAuto } from "../../_components/FiltroAuto";

export default async function CarteraPorClientePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; anio?: string; mes?: string }>;
}) {
  const { usuario, alcance } = await requirePermiso("cartera.view");
  const sp = await searchParams;
  const { q } = sp;

  // Periodo por fecha de VENCIMIENTO, igual que en la vista de facturas.
  const anio = sp.anio && /^\d{4}$/.test(sp.anio) ? Number(sp.anio) : undefined;
  const mesNum = sp.mes && /^\d{1,2}$/.test(sp.mes) ? Number(sp.mes) : undefined;
  const mes = mesNum && mesNum >= 1 && mesNum <= 12 ? mesNum : undefined;
  const periodo = anio && mes ? `${MESES_LABEL[mes]} ${anio}`
    : anio ? `año ${anio}`
    : mes ? `${MESES_LABEL[mes]} · todos los años`
    : "todos los meses";

  const params = (over: Record<string, string | undefined> = {}) => {
    const base: Record<string, string | undefined> = {
      q: q || undefined,
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
    return `/cartera/clientes${s ? `?${s}` : ""}`;
  };
  const ocultos: Record<string, string> = {};
  if (anio) ocultos.anio = String(anio);
  if (mes) ocultos.mes = String(mes);

  const anios = await aniosCartera(usuario, alcance);
  const filas = await carteraPorCliente(usuario, alcance, q, new Date(), { anio, mes });
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
          <p>{formatNumero(filas.length)} clientes · vence: {periodo} · saldo neto <Monto value={tot.saldo} /></p>
        </div>
        <div className="toolbar">
          <a href={`/cartera/clientes/export${params().toString() ? `?${params()}` : ""}`} className="btn" title="Descargar en Excel">⬇️ Excel</a>
          <BotonImprimir />
          <a href="/cartera" className="btn">← Facturas</a>
        </div>
      </div>

      <div className="card no-print" style={{ marginBottom: 12 }}>
        <div className="card-body" style={{ paddingBottom: 12 }}>
          <FiltroAuto className="toolbar">
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

      <div className="card">
        <div className="card-body" style={{ paddingBottom: 0 }}>
          <Buscador
            action="/cartera/clientes"
            q={q}
            extra={ocultos}
            limpiarHref={href({ q: undefined })}
            placeholder="Buscar cliente o NIT…"
          />
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
                  <td className="r num" style={{ fontWeight: 800 }}><Monto value={tot.saldo} /></td>
                  <td className="r num" style={{ fontWeight: 800 }}>{formatPorcentaje(100)}</td>
                  <td className="r num"><Monto value={tot.vencido} /></td>
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
                    <td className="r num" style={{ fontWeight: 700 }}><Monto value={f.saldoNeto} /></td>
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
