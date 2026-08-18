// ==========================================================
// Periodo (año/mes) de las vistas de saldos — cartera y CxP.
// Corta por fecha de VENCIMIENTO del documento. Sin año ni mes = todo.
// ==========================================================
import { MESES_LABEL } from "@/lib/negocio/flujo";

export interface Periodo {
  anio?: number;
  mes?: number;
}

/** Lee y valida ?anio=&mes= de la URL. */
export function leerPeriodo(sp: { anio?: string; mes?: string }): Periodo {
  const anio = sp.anio && /^\d{4}$/.test(sp.anio) ? Number(sp.anio) : undefined;
  const m = sp.mes && /^\d{1,2}$/.test(sp.mes) ? Number(sp.mes) : undefined;
  const mes = m && m >= 1 && m <= 12 ? m : undefined;
  return { anio, mes };
}

/** Texto del periodo para encabezados: "Ago 2026", "año 2026", "todos los meses". */
export function etiquetaPeriodo({ anio, mes }: Periodo): string {
  if (anio && mes) return `${MESES_LABEL[mes]} ${anio}`;
  if (anio) return `año ${anio}`;
  if (mes) return `${MESES_LABEL[mes]} · todos los años`;
  return "todos los meses";
}
