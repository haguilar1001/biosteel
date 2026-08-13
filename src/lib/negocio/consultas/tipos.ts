// ==========================================================
// Tipos del motor de consultas en lenguaje natural.
// La Respuesta es una estructura serializable (solo números y strings) que
// viaja del server action al cliente; el cliente la renderiza (montos con
// Monto, ranking, tabla). Nada de JSX ni Decimals aquí.
// ==========================================================

/** Tipo de una celda/valor numérico para que el cliente sepa cómo formatearlo. */
export type TipoValor = "monto" | "numero" | "porcentaje" | "texto";

/** Métrica pedida en una consulta de ventas. */
export type Metrica = "venta" | "utilidad" | "costo" | "margen";

export interface Kpi {
  label: string;
  valor: number | string;
  tipo: TipoValor;
  /** Tono opcional para colorear (ok = verde, bad = rojo). */
  tono?: "ok" | "bad" | "neutro";
}

export interface RankItem {
  label: string;
  valor: number;
  sub?: string;
}

export interface Ranking {
  titulo: string;
  items: RankItem[];
  /** Variable CSS de color de la barra (p. ej. "var(--brand)"). */
  color?: string;
  /** Cuántos mostrar inicialmente. */
  inicial?: number;
}

export interface Celda {
  valor: number | string;
  tipo: TipoValor;
  tono?: "ok" | "bad" | "neutro";
}

export interface Tabla {
  columnas: { titulo: string; align?: "l" | "r" }[];
  filas: Celda[][];
  /** Fila de totales opcional (se pinta destacada). */
  total?: Celda[];
}

export interface Respuesta {
  ok: boolean;
  /** Título corto de la respuesta (p. ej. "Top 5 clientes · 2026"). */
  titulo: string;
  /** Frase de resumen en lenguaje natural (montos ya formateados en texto). */
  resumen?: string;
  kpis?: Kpi[];
  ranking?: Ranking;
  tabla?: Tabla;
  /** Nota al pie (aclaraciones, fuente, filtros aplicados). */
  nota?: string;
  /** Preguntas de seguimiento sugeridas. */
  sugerencias?: string[];
}

/** Respuesta cuando no se entendió o no hubo datos. */
export function respuestaVacia(titulo: string, resumen: string, sugerencias?: string[]): Respuesta {
  return { ok: false, titulo, resumen, sugerencias };
}
