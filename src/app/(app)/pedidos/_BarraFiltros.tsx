// Barra de segmentadores del módulo Pedidos. La lógica de resolución vive en
// _filtro.ts, para que las rutas de exportación puedan reutilizarla sin
// arrastrar JSX.
import { MES_LARGO } from "@/lib/negocio/pedidos";
import { FiltroAuto } from "../_components/FiltroAuto";
import { hayFiltros, type ContextoFiltro } from "./_filtro";

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

      <label className="flag" style={{ alignSelf: "center" }}>Ciudad:</label>
      <select name="ciudad" defaultValue={f.ciudad ?? ""} className="select" style={{ maxWidth: 180 }}>
        <option value="">Todas</option>
        {c.ciudades.map((x) => <option key={x} value={x}>{x}</option>)}
      </select>

      <label className="flag" style={{ alignSelf: "center" }}>Cliente:</label>
      <select name="cliente" defaultValue={f.cliente ?? ""} className="select" style={{ maxWidth: 240 }}>
        <option value="">Todos</option>
        {c.clientes.map((x) => <option key={x} value={x}>{x}</option>)}
      </select>

      <label className="flag" style={{ alignSelf: "center" }}>Marca:</label>
      <select name="marca" defaultValue={f.marca ?? ""} className="select" style={{ maxWidth: 220 }}>
        <option value="">Todas</option>
        {c.marcas.map((x) => <option key={x} value={x}>{x}</option>)}
      </select>

      <label className="flag" style={{ alignSelf: "center" }}>Línea:</label>
      <select name="linea" defaultValue={f.linea ?? ""} className="select" style={{ maxWidth: 220 }}>
        <option value="">Todas</option>
        {c.lineas.map((x) => <option key={x} value={x}>{x}</option>)}
      </select>

      <label className="flag" style={{ alignSelf: "center" }}>Anatomía:</label>
      <select name="anatomia" defaultValue={f.anatomia ?? ""} className="select" style={{ maxWidth: 200 }}>
        <option value="">Todas</option>
        {c.anatomias.map((x) => <option key={x} value={x}>{x}</option>)}
      </select>

      <label className="flag" style={{ alignSelf: "center" }}>Estado:</label>
      <select name="estado" defaultValue={f.estado ?? ""} className="select" style={{ maxWidth: 180 }}>
        <option value="">Todos</option>
        {c.estados.map((x) => <option key={x} value={x}>{x}</option>)}
      </select>

      {hayFiltros(c) ? <a href={`?anio=${f.anio}`} className="btn">Limpiar filtros</a> : null}
      {extra}
    </FiltroAuto>
  );
}
