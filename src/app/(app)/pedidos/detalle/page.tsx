// ==========================================================
// Detalle de Pedidos — el renglón crudo, con los mismos filtros del informe.
// Es la pantalla a la que se baja cuando una cifra del tablero no cuadra y
// hay que ver de qué documentos está hecha.
// ==========================================================
import { requirePermiso } from "@/server/auth-context";
import { formatNumero, formatFecha } from "@/lib/format";
import { Monto } from "../../_components/Monto";
import { detallePedidos, contarDetalle, resumenPedidos } from "@/lib/negocio/pedidos";
import { resolverFiltro, resumenFiltros, type ParamsPedidos } from "../_filtro";
import { BarraFiltros } from "../_BarraFiltros";

/** Renglones que se pintan; el Excel los trae todos. */
const TOPE = 400;

export default async function DetallePedidosPage({ searchParams }: { searchParams: Promise<ParamsPedidos> }) {
  await requirePermiso("pedidos.view");
  const c = await resolverFiltro(await searchParams);

  if (!c) {
    return (
      <div className="card"><div className="card-body">
        <div className="empty">
          Sin pedidos cargados. Súbelos desde <a href="/cargar">Cargar archivos</a> o
          corre <code>npm run db:pedidos</code>.
        </div>
      </div></div>
    );
  }

  const [filas, total, kpi] = await Promise.all([
    detallePedidos(c.filtro, TOPE), contarDetalle(c.filtro), resumenPedidos(c.filtro),
  ]);

  return (
    <>
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="card-body" style={{ paddingBottom: 12 }}>
          <div style={{ marginBottom: 10 }}>
            <div className="eyebrow" style={{ fontSize: 15 }}>Detalle de Pedidos · {c.etiqueta}</div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 3 }}>
              {resumenFiltros(c)} · {formatNumero(total)} renglones
            </div>
          </div>
          <BarraFiltros
            c={c}
            extra={<a href={`/pedidos/detalle/export?${c.query}`} className="btn">⬇️ Excel</a>}
          />
        </div>
      </div>

      <div className="card">
        <div className="chart-head">
          Renglones de pedido
          <span className="hact">
            {filas.length < total ? `${formatNumero(filas.length)} de ${formatNumero(total)} · los más recientes` : `${formatNumero(total)} renglones`}
            {" · clic en las columnas para ordenar"}
          </span>
        </div>
        <div className="tbl-wrap">
          <table className="tabla-fit">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Documento</th>
                <th>Estado</th>
                <th>Bodega</th>
                <th>Referencia</th>
                <th>Descripción</th>
                <th className="r">Cant.</th>
                <th className="r">Costo prom.</th>
                <th className="r">Venta</th>
                <th className="r">Utilidad</th>
                <th>Marca</th>
                <th>Cliente</th>
                <th>Ciudad</th>
                <th>Proveedor</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((r, i) => (
                <tr key={`${r.nroDocumento}-${r.referencia}-${i}`}>
                  <td style={{ whiteSpace: "nowrap" }} data-orden={r.fecha.getTime()}>{formatFecha(r.fecha)}</td>
                  <td style={{ fontWeight: 600, whiteSpace: "nowrap" }}>{r.nroDocumento}</td>
                  <td className="flag">{r.estado}</td>
                  <td className="flag" style={{ maxWidth: 180 }}>{r.bodegaDesc}</td>
                  <td style={{ whiteSpace: "nowrap" }}>{r.referencia}</td>
                  <td style={{ maxWidth: 280 }} title={r.descItem}>{r.descItem}</td>
                  <td className="r num">{formatNumero(r.cantPedida)}</td>
                  <td className="r num"><Monto value={r.costoProm} /></td>
                  <td className="r num flag"><Monto value={r.valorBruto} /></td>
                  <td className="r num flag"><Monto value={r.utilidad} /></td>
                  <td className="flag" style={{ maxWidth: 180 }}>{r.marca}</td>
                  <td className="flag" style={{ maxWidth: 200 }}>{r.cliente}</td>
                  <td className="flag">{r.ciudad}</td>
                  <td className="flag" style={{ maxWidth: 200 }}>{r.proveedor}</td>
                </tr>
              ))}
              {filas.length === 0 ? (
                <tr><td colSpan={14}><div className="empty">Sin pedidos con estos filtros.</div></td></tr>
              ) : (
                <tr className="fila-total">
                  <td style={{ fontWeight: 800 }}>Total del filtro</td>
                  <td colSpan={5} className="flag">{formatNumero(kpi.documentos)} pedidos · {formatNumero(kpi.pacientes)} pacientes</td>
                  <td className="r num" style={{ fontWeight: 800 }}>{formatNumero(kpi.cantidad)}</td>
                  <td className="r num" style={{ fontWeight: 800 }}><Monto value={kpi.costo} /></td>
                  <td className="r num" style={{ fontWeight: 800 }}><Monto value={kpi.venta} /></td>
                  <td className="r num" style={{ fontWeight: 800 }}><Monto value={kpi.utilidad} /></td>
                  <td colSpan={4} />
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="card-body" style={{ padding: "8px 14px", fontSize: 12, color: "var(--muted)" }}>
          La fila de total corresponde a <b>todo el filtro</b>, no solo a los renglones visibles.
          El paciente y el médico no se muestran en la tabla por ser dato sensible; sí van en el
          Excel, que queda bajo el control de quien lo descarga.
        </div>
      </div>
    </>
  );
}
