// ==========================================================
// Inventario · Novedades (bitácora)
// Historial de compras, bajas, daños, reparaciones, retornos y
// traslados. Las novedades se registran desde la tabla de inventario.
// ==========================================================
import { requirePermiso } from "@/server/auth-context";
import { formatNumero, formatFecha } from "@/lib/format";
import {
  listarNovedades, novedadLabel, novedadIcono, estadoLabel, estadoClase,
} from "@/lib/negocio/inventario";
import type { TipoNovedad } from "@prisma/client";

const TIPO_TAG: Record<TipoNovedad, string> = {
  compra: "t-ok", baja: "t-bad", dano: "t-w1", reparacion: "t-w1", retorno_reparacion: "t-ok", traslado: "t-blue",
};

export default async function NovedadesPage() {
  await requirePermiso("inventario.view");
  const novedades = await listarNovedades();

  const conteo = novedades.reduce<Record<string, number>>((acc, n) => {
    acc[n.tipo] = (acc[n.tipo] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Inventarios</div>
          <h1>Novedades</h1>
          <p>Bitácora de movimientos · {formatNumero(novedades.length)} registros · se registran desde la tabla de inventario</p>
        </div>
      </div>

      <div className="kpis">
        <div className="kpi k-ok">
          <div className="klabel">🆕 Compras</div>
          <div className="kval num">{formatNumero(conteo.compra ?? 0)}</div>
          <div className="ksub"><span className="flag">altas de equipos</span></div>
        </div>
        <div className="kpi k-w">
          <div className="klabel">🔧 Reparaciones</div>
          <div className="kval num">{formatNumero((conteo.reparacion ?? 0) + (conteo.dano ?? 0))}</div>
          <div className="ksub"><span className="flag">daños y envíos</span></div>
        </div>
        <div className="kpi k-ingreso">
          <div className="klabel">🚚 Traslados</div>
          <div className="kval num">{formatNumero(conteo.traslado ?? 0)}</div>
          <div className="ksub"><span className="flag">entre sedes</span></div>
        </div>
        <div className="kpi k-bad">
          <div className="klabel">🚫 Bajas</div>
          <div className="kval num">{formatNumero(conteo.baja ?? 0)}</div>
          <div className="ksub"><span className="flag">fuera de servicio</span></div>
        </div>
      </div>

      <div className="card">
        <div className="chart-head">Historial de novedades</div>
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th>Fecha</th><th>Novedad</th><th>Equipo</th><th>Ítem</th>
                <th>Detalle</th><th>Estado</th><th>Usuario</th>
              </tr>
            </thead>
            <tbody>
              {novedades.map((n) => (
                <tr key={n.id}>
                  <td className="num flag">{formatFecha(n.fecha)}</td>
                  <td><span className={`tag ${TIPO_TAG[n.tipo]}`}>{novedadIcono(n.tipo)} {novedadLabel(n.tipo)}</span></td>
                  <td style={{ fontWeight: 600 }}>{n.equipo}<div className="flag">📍 {n.ciudad}</div></td>
                  <td className="flag">{n.itemDescripcion ?? "Todo el equipo"}</td>
                  <td className="flag">
                    {n.tipo === "traslado" && n.sedeOrigen && n.sedeDestino
                      ? <>{n.sedeOrigen} → <strong>{n.sedeDestino}</strong></>
                      : (n.descripcion ?? "—")}
                  </td>
                  <td>
                    {n.estadoNuevo
                      ? <span className={`tag ${estadoClase(n.estadoNuevo)}`}>{estadoLabel(n.estadoNuevo)}</span>
                      : <span className="flag">—</span>}
                  </td>
                  <td className="flag">{n.usuario ?? "—"}</td>
                </tr>
              ))}
              {novedades.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign: "center", padding: 24, color: "var(--muted)" }}>
                  Aún no hay novedades registradas.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
