// ==========================================================
// Utilidades compartidas por las intenciones del motor de consultas.
// (Código de servidor: puede importar format.ts y las funciones de negocio.)
// ==========================================================
import { formatCOP, formatNumero, formatPorcentaje } from "@/lib/format";
import { MESES_LABEL } from "@/lib/negocio/flujo";
import type { Celda, Tabla, RankItem, Metrica } from "./tipos";

export const MES_FULL = [
  "", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export function mesLabel(mes: number): string {
  return MES_FULL[mes] ?? MESES_LABEL[mes] ?? String(mes);
}

/** Etiqueta del período: "año 2026", "Junio 2026" o "Ene–May 2026". */
export function etiquetaPeriodo(anio: number, meses?: number[]): string {
  if (!meses || meses.length === 0) return `${anio}`;
  if (meses.length === 1) return `${mesLabel(meses[0]!)} ${anio}`;
  const ord = [...meses].sort((a, b) => a - b);
  return `${MESES_LABEL[ord[0]!]}–${MESES_LABEL[ord[ord.length - 1]!]} ${anio}`;
}

/**
 * Elige el año objetivo: el mencionado (último si hay varios); si no,
 * el mayor disponible; si tampoco, el año actual.
 */
export function elegirAnio(mencionados: number[], disponibles: number[], anioActual: number): number {
  if (mencionados.length) {
    // Prefiere uno que exista en los datos; si ninguno, usa el último mencionado.
    const valido = mencionados.filter((a) => disponibles.includes(a));
    return (valido.length ? valido[valido.length - 1] : mencionados[mencionados.length - 1])!;
  }
  if (disponibles.length) return Math.max(...disponibles);
  return anioActual;
}

// ---- Constructores de celdas / tablas ----

export const cMonto = (v: number, tono?: Celda["tono"]): Celda => ({ valor: v, tipo: "monto", tono });
export const cNum = (v: number): Celda => ({ valor: v, tipo: "numero" });
export const cPct = (v: number): Celda => ({ valor: v, tipo: "porcentaje" });
export const cTxt = (v: string | number): Celda => ({ valor: v, tipo: "texto" });

/** Formatea un número según su tipo (para textos de resumen). */
export function fmt(v: number, tipo: "monto" | "numero" | "porcentaje"): string {
  if (tipo === "monto") return formatCOP(v);
  if (tipo === "porcentaje") return formatPorcentaje(v);
  return formatNumero(v);
}

/** Valor de una fila según la métrica pedida (venta/utilidad/costo/margen). */
export function valorMetrica(fila: { valor: number; costo: number }, metrica: Metrica): number {
  switch (metrica) {
    case "utilidad": return fila.valor - fila.costo;
    case "costo": return fila.costo;
    case "margen": return fila.valor > 0 ? ((fila.valor - fila.costo) / fila.valor) * 100 : 0;
    default: return fila.valor;
  }
}

export const LABEL_METRICA: Record<Metrica, string> = {
  venta: "venta neta",
  utilidad: "utilidad",
  costo: "costo",
  margen: "margen",
};

/** Construye RankItems desde filas {label, valor, costo} según métrica. */
export function rankDesde<T extends { valor: number; costo: number }>(
  filas: T[],
  label: (f: T) => string,
  metrica: Metrica,
): RankItem[] {
  return filas
    .map((f) => {
      const util = f.valor - f.costo;
      const margen = f.valor > 0 ? (util / f.valor) * 100 : 0;
      const v = valorMetrica(f, metrica);
      const sub = metrica === "margen"
        ? formatCOP(f.valor)
        : metrica === "venta"
          ? `util. ${formatPorcentaje(margen)}`
          : undefined;
      return { label: label(f), valor: v, sub };
    })
    .sort((a, b) => b.valor - a.valor);
}

export const N_DEFECTO = 10;

/** Construye una Tabla simple a partir de columnas y filas de celdas. */
export function tabla(columnas: Tabla["columnas"], filas: Celda[][], total?: Celda[]): Tabla {
  return { columnas, filas, total };
}
