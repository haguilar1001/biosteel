// Egresos: movimientos de salida con filtros (mes, grupo) y buscador.
import { requirePermiso } from "@/server/auth-context";
import { formatCOP } from "@/lib/format";
import { listarMovimientos, listarCategorias, MESES_LABEL } from "@/lib/negocio/flujo";

const ANIO = 2026;
const fmtFecha = (d: Date) => new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "short" }).format(d);

export default async function EgresosPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; grupo?: string; q?: string }>;
}) {
  await requirePermiso("cxp.view");
  const sp = await searchParams;
  const mes = sp.mes && /^\d+$/.test(sp.mes) ? Number(sp.mes) : undefined;
  const categoriaId = sp.grupo && /^\d+$/.test(sp.grupo) ? Number(sp.grupo) : undefined;
  const q = sp.q;

  const [categorias, { filas, total, suma }] = await Promise.all([
    listarCategorias(),
    listarMovimientos("egreso", { anio: ANIO, mes, categoriaId, q }),
  ]);

  return (
    <div className="card">
      <div className="chart-head">Egresos {ANIO}</div>
      <div className="card-body" style={{ paddingBottom: 0 }}>
        <form method="get" className="toolbar">
          <select name="mes" defaultValue={mes ?? ""} className="select">
            <option value="">Todos los meses</option>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>{MESES_LABEL[m]}</option>
            ))}
          </select>
          <select name="grupo" defaultValue={categoriaId ?? ""} className="select">
            <option value="">Todos los grupos</option>
            {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
          <input type="search" name="q" defaultValue={q ?? ""} placeholder="Tercero, NIT, observación…" className="select" style={{ minWidth: 220 }} />
          <button type="submit" className="btn primary">Filtrar</button>
          <a href="/flujo/egresos" className="btn">Limpiar</a>
        </form>
      </div>
      <div className="tbl-wrap">
        <table className="tabla-fit">
          <colgroup>
            <col style={{ width: "8%" }} /><col style={{ width: "15%" }} /><col style={{ width: "22%" }} />
            <col style={{ width: "13%" }} /><col style={{ width: "28%" }} /><col style={{ width: "14%" }} />
          </colgroup>
          <thead>
            <tr><th>Fecha</th><th>Grupo</th><th>Tercero</th><th>Detalle</th><th>Observación</th><th className="r">Valor</th></tr>
          </thead>
          <tbody>
            <tr className="fila-total">
              <td colSpan={5} style={{ fontWeight: 800 }}>Total · {total} movimiento{total === 1 ? "" : "s"}{filas.length < total ? ` (mostrando ${filas.length})` : ""}</td>
              <td className="r num" style={{ fontWeight: 800 }}>{formatCOP(suma)}</td>
            </tr>
            {filas.length === 0 ? (
              <tr><td colSpan={6} className="empty">Sin movimientos.</td></tr>
            ) : (
              filas.map((m) => (
                <tr key={m.id}>
                  <td className="flag">{fmtFecha(m.fecha)}</td>
                  <td title={m.categoria ?? ""}>{m.categoria ?? "—"}</td>
                  <td style={{ fontWeight: 600 }} title={m.terceroNombre}>{m.terceroNombre}</td>
                  <td className="flag" title={m.detalle ?? ""}>{m.detalle}</td>
                  <td className="flag" title={m.observacion ?? ""}>{m.observacion}</td>
                  <td className="r num" style={{ fontWeight: 700 }}>{formatCOP(m.valor)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
