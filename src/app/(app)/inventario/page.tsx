// ==========================================================
// Inventario · Tabla maestra (equivale a "INGRESO DE DATOS")
// KPIs + tabla editable con filtros, alta de equipos, edición de
// ítems y registro de novedades.
// ==========================================================
import { requirePermiso } from "@/server/auth-context";
import { requireUsuario } from "@/server/auth-context";
import { puede } from "@/lib/rbac/authorize";
import { formatNumero } from "@/lib/format";
import { listarEquipos, resumenInventario, composicionInventario, catalogos, estadoLabel, ESTADOS } from "@/lib/negocio/inventario";
import { DonutConteo, ESTADO_COLOR, colorPaleta, type Segmento } from "./_viz";
import InventarioCliente from "./InventarioCliente";

export default async function InventarioPage() {
  await requirePermiso("inventario.view");
  const usuario = await requireUsuario();
  const puedeGestionar = await puede(usuario, "inventario.manage");

  const [equipos, resumen, comp, cat] = await Promise.all([
    listarEquipos(), resumenInventario(), composicionInventario(), catalogos(),
  ]);

  const donutEstado: Segmento[] = ESTADOS.map((e) => ({ label: estadoLabel(e), valor: resumen.porEstado[e], color: ESTADO_COLOR[e]! }));
  const donutCategoria: Segmento[] = comp.porCategoria.map((c, i) => ({ label: c.label, valor: c.valor, color: colorPaleta(i) }));

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Inventarios</div>
          <h1>Inventario de Equipos</h1>
          <p>Motores, craneótomos y accesorios · {formatNumero(resumen.totalEquipos)} equipos en {formatNumero(resumen.ciudades)} sedes</p>
        </div>
      </div>

      <div className="kpis">
        <div className="kpi k-ingreso">
          <div className="klabel">📦 Equipos</div>
          <div className="kval num">{formatNumero(resumen.totalEquipos)}</div>
          <div className="ksub"><span className="flag">conjuntos registrados</span></div>
        </div>
        <div className="kpi k-ok">
          <div className="klabel">✅ Activos</div>
          <div className="kval num">{formatNumero(resumen.porEstado.activo)}</div>
          <div className="ksub"><span className="flag">🔩 {formatNumero(resumen.porEstadoTipo.activo.equipo)} equipos · 🧩 {formatNumero(resumen.porEstadoTipo.activo.accesorio)} accesorios</span></div>
        </div>
        <div className="kpi k-w">
          <div className="klabel">🔧 En reparación</div>
          <div className="kval num">{formatNumero(resumen.porEstado.en_reparacion)}</div>
          <div className="ksub"><span className="flag">🔩 {formatNumero(resumen.porEstadoTipo.en_reparacion.equipo)} equipos · 🧩 {formatNumero(resumen.porEstadoTipo.en_reparacion.accesorio)} accesorios</span></div>
        </div>
        <div className="kpi k-bad">
          <div className="klabel">🚫 De baja</div>
          <div className="kval num">{formatNumero(resumen.porEstado.de_baja)}</div>
          <div className="ksub"><span className="flag">🔩 {formatNumero(resumen.porEstadoTipo.de_baja.equipo)} equipos · 🧩 {formatNumero(resumen.porEstadoTipo.de_baja.accesorio)} accesorios</span></div>
        </div>
      </div>

      <div className="grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12, alignItems: "stretch" }}>
        <div className="card" style={{ display: "flex", flexDirection: "column" }}>
          <div className="chart-head">Composición por estado</div>
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <DonutConteo data={donutEstado} centro={{ valor: formatNumero(resumen.totalItems), etiqueta: "ítems" }} size={280} />
          </div>
        </div>
        <div className="card" style={{ display: "flex", flexDirection: "column" }}>
          <div className="chart-head">Composición por categoría</div>
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <DonutConteo data={donutCategoria} centro={{ valor: formatNumero(resumen.totalEquipos), etiqueta: "equipos" }} size={280} />
          </div>
        </div>
      </div>

      <InventarioCliente
        equipos={equipos}
        sedes={cat.sedes}
        categorias={cat.categorias}
        marcas={cat.marcas}
        puedeGestionar={puedeGestionar}
      />
    </>
  );
}
