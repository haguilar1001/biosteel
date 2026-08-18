// Barra de filtro por periodo de VENCIMIENTO (Año + Mes, ambos con "Todos").
// La usan las vistas de saldos: cartera (facturas, cliente, ciudad) y CxP.
import { MESES_LABEL } from "@/lib/negocio/flujo";
import type { Periodo } from "@/lib/periodo";
import { FiltroAuto } from "./FiltroAuto";

export function FiltroPeriodo({
  anios,
  periodo,
  hrefTodo,
  ocultos,
  textoTodo = "Todo",
}: {
  /** Años disponibles (recientes primero). */
  anios: number[];
  periodo: Periodo;
  /** Destino del botón que quita el periodo. */
  hrefTodo: string;
  /** Otros filtros de la vista que deben viajar con el formulario. */
  ocultos?: Record<string, string>;
  textoTodo?: string;
}) {
  const { anio, mes } = periodo;
  return (
    <div className="card no-print" style={{ marginBottom: 12 }}>
      <div className="card-body" style={{ paddingBottom: 12 }}>
        <FiltroAuto className="toolbar">
          {ocultos
            ? Object.entries(ocultos).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)
            : null}
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
          {anio || mes ? <a href={hrefTodo} className="btn">{textoTodo}</a> : null}
        </FiltroAuto>
      </div>
    </div>
  );
}
