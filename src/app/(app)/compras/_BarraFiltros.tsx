// Barra de segmentadores del modulo Compras (Año · Mes · Dia · Proveedor ·
// Linea · Tipo de compra). La logica de resolucion vive en _filtro.ts, para
// que las rutas de exportacion puedan reutilizarla sin arrastrar JSX.
import { MES_LARGO } from "@/lib/negocio/compras";
import { FiltroAuto } from "../_components/FiltroAuto";
import type { ContextoFiltro } from "./_filtro";

export function BarraFiltros({ c, extra }: { c: ContextoFiltro; extra?: React.ReactNode }) {
  const f = c.filtro;
  return (
    <FiltroAuto className="toolbar">
      <label className="flag" style={{ alignSelf: "center" }}>Año:</label>
      <select name="anio" defaultValue={f.anio} className="select">
        {c.anios.map((a) => <option key={a} value={a}>{a}</option>)}
      </select>

      <label className="flag" style={{ alignSelf: "center" }}>Mes:</label>
      <select name="mes" defaultValue={f.mes ?? ""} className="select">
        <option value="">Todos</option>
        {c.meses.map((m) => <option key={m} value={m}>{MES_LARGO[m]}</option>)}
      </select>

      {/* El día solo tiene sentido dentro de un mes; sin mes ni se ofrece. */}
      {f.mes ? (
        <>
          <label className="flag" style={{ alignSelf: "center" }}>Día:</label>
          <select name="dia" defaultValue={f.dia ?? ""} className="select" style={{ maxWidth: 90 }}>
            <option value="">Todos</option>
            {c.dias.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </>
      ) : null}

      <label className="flag" style={{ alignSelf: "center" }}>Proveedor:</label>
      <select name="prov" defaultValue={f.proveedor ?? ""} className="select" style={{ maxWidth: 260 }}>
        <option value="">Todos</option>
        {c.proveedores.map((p) => <option key={p} value={p}>{p}</option>)}
      </select>

      <label className="flag" style={{ alignSelf: "center" }}>Línea:</label>
      <select name="linea" defaultValue={f.linea ?? ""} className="select" style={{ maxWidth: 220 }}>
        <option value="">Todas</option>
        {c.lineas.map((l) => <option key={l} value={l}>{l}</option>)}
      </select>

      {/* El tipo de compra depende del catálogo de proveedores: si no está
          cargado, el selector se oculta en vez de ofrecer una lista vacía. */}
      {c.tipos.length ? (
        <>
          <label className="flag" style={{ alignSelf: "center" }}>Tipo:</label>
          <select name="tipo" defaultValue={f.tipoCompra ?? ""} className="select" style={{ maxWidth: 200 }}>
            <option value="">Todos</option>
            {c.tipos.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </>
      ) : null}

      {extra}
    </FiltroAuto>
  );
}
