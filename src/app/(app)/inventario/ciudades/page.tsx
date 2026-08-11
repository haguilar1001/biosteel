// ==========================================================
// Inventario · Informe por Ciudad
// Tarjeta por sede con desglose de estados y sus equipos
// (equivale a las hojas por ciudad del Excel, mejorado).
// ==========================================================
import { requirePermiso } from "@/server/auth-context";
import { formatNumero } from "@/lib/format";
import {
  inventarioPorCiudad, resumenInventario, composicionInventario, estadoLabel, estadoClase, estadoIcono, ESTADOS,
} from "@/lib/negocio/inventario";
import { DonutConteo, BarrasApiladas, ESTADO_COLOR, colorPaleta, type Segmento, type FilaBarra } from "../_viz";
import { MapaInventario } from "../MapaInventario";

export default async function InventarioCiudadesPage() {
  await requirePermiso("inventario.view");
  const [grupos, resumen, comp] = await Promise.all([inventarioPorCiudad(), resumenInventario(), composicionInventario()]);

  const donutCategorias: Segmento[] = comp.porCategoria.map((c, i) => ({ label: c.label, valor: c.valor, color: colorPaleta(i) }));
  const leyendaEstados: Segmento[] = ESTADOS.map((e) => ({ label: estadoLabel(e), valor: 0, color: ESTADO_COLOR[e]! }));
  const barrasCiudad: FilaBarra[] = comp.porCiudadEstado.map((c) => ({
    label: c.ciudad,
    total: c.total,
    partes: ESTADOS.map((e) => ({ label: estadoLabel(e), valor: c.estados[e], color: ESTADO_COLOR[e]! })),
  }));
  const burbujas = grupos.map((g) => ({ ciudad: g.ciudad, sede: g.sede, total: g.totalItems, estados: g.porEstado }));

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Inventarios</div>
          <h1>Informe por Ciudad</h1>
          <p>Inventario distribuido en {formatNumero(resumen.ciudades)} sedes</p>
        </div>
      </div>

      <div className="kpis">
        <div className="kpi">
          <div className="klabel">📍 Sedes</div>
          <div className="kval num">{formatNumero(resumen.ciudades)}</div>
          <div className="ksub"><span className="flag">con inventario</span></div>
        </div>
        <div className="kpi k-ingreso">
          <div className="klabel">📦 Equipos</div>
          <div className="kval num">{formatNumero(resumen.totalEquipos)}</div>
          <div className="ksub"><span className="flag">conjuntos registrados</span></div>
        </div>
        <div className="kpi k-ok">
          <div className="klabel">🧩 Ítems</div>
          <div className="kval num">{formatNumero(resumen.totalItems)}</div>
          <div className="ksub"><span className="flag">piezas y accesorios</span></div>
        </div>
        <div className="kpi k-w">
          <div className="klabel">🔧 En reparación</div>
          <div className="kval num">{formatNumero(resumen.porEstado.en_reparacion)}</div>
          <div className="ksub"><span className="flag">requieren atención</span></div>
        </div>
      </div>

      <div className="grid" style={{ display: "grid", gridTemplateColumns: "minmax(260px, 340px) 1fr", gap: 12, alignItems: "start", marginBottom: 12 }}>
        <div className="card">
          <div className="chart-head">Composición por categoría</div>
          <DonutConteo data={donutCategorias} centro={{ valor: formatNumero(resumen.totalItems), etiqueta: "ítems" }} />
        </div>
        <div className="card">
          <div className="chart-head">Ítems por ciudad · desglose por estado</div>
          <BarrasApiladas filas={barrasCiudad} leyenda={leyendaEstados} />
        </div>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <div className="chart-head">🗺️ Mapa de inventario por sede</div>
        <MapaInventario data={burbujas} />
      </div>

      <div className="subhead">Detalle por sede</div>
      <div className="grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 12 }}>
        {grupos.map((g) => (
          <div key={g.ciudad} className="card">
            <div className="chart-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>📍 {g.ciudad}</span>
              <span className="tag t-blue">{formatNumero(g.totalItems)} ítems</span>
            </div>

            {/* Barra de estados */}
            <div style={{ display: "flex", height: 8, borderRadius: 6, overflow: "hidden", margin: "4px 0 10px" }}>
              {ESTADOS.map((e) => {
                const v = g.porEstado[e];
                if (!v) return null;
                const pct = (v / g.totalItems) * 100;
                const color = { activo: "var(--ok)", en_reparacion: "var(--w1)", de_baja: "var(--bad)", pendiente: "var(--brand)" }[e];
                return <div key={e} title={`${estadoLabel(e)}: ${v}`} style={{ width: `${pct}%`, background: color }} />;
              })}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
              {ESTADOS.filter((e) => g.porEstado[e] > 0).map((e) => (
                <span key={e} className={`tag ${estadoClase(e)}`}>{estadoIcono(e)} {estadoLabel(e)} · {formatNumero(g.porEstado[e])}</span>
              ))}
            </div>

            {/* Equipos de la sede */}
            <div className="tbl-wrap">
              <table>
                <thead>
                  <tr><th>Categoría</th><th>Marca</th><th className="r">Ítems</th></tr>
                </thead>
                <tbody>
                  {g.equipos.map((eq) => (
                    <tr key={eq.id}>
                      <td style={{ fontWeight: 600 }}>{eq.categoria}</td>
                      <td className="flag">{eq.marca}</td>
                      <td className="r num">{formatNumero(eq.totalItems)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
