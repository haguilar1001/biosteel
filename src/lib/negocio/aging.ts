// ==========================================================
// Lógica de negocio: antigüedad de cartera (aging)
// Cubetas estándar de cartera: Corriente 0–30, 31–60, 61–90, +90
// (calculadas por días transcurridos desde el vencimiento).
// ==========================================================

export type CubetaAging = "d1_30" | "d31_60" | "d61_90" | "d91_120" | "mas120";

export interface DefCubeta {
  clave: CubetaAging;
  etiqueta: string;
  /** Variable CSS del color semántico asociado. */
  color: string;
}

/** Orden y metadatos de las cubetas (para KPIs y gráficas). */
export const CUBETAS: readonly DefCubeta[] = [
  { clave: "d1_30", etiqueta: "1–30 días", color: "var(--ok)" },
  { clave: "d31_60", etiqueta: "31–60 días", color: "var(--w1)" },
  { clave: "d61_90", etiqueta: "61–90 días", color: "var(--w2)" },
  { clave: "d91_120", etiqueta: "91–120 días", color: "var(--bad)" },
  { clave: "mas120", etiqueta: "+120 días", color: "var(--brand-700)" },
] as const;

const MS_DIA = 1000 * 60 * 60 * 24;

/** Días vencidos respecto a la fecha de corte (negativo = aún no vence). */
export function diasVencido(fechaVencimiento: Date, corte: Date = new Date()): number {
  return Math.floor((corte.getTime() - fechaVencimiento.getTime()) / MS_DIA);
}

/**
 * Cubeta de aging a partir de los días vencidos.
 * Nota: lo aún no vencido (días ≤ 0) cae en la primera cubeta "1–30".
 */
export function cubetaDe(dias: number): CubetaAging {
  if (dias <= 30) return "d1_30";
  if (dias <= 60) return "d31_60";
  if (dias <= 90) return "d61_90";
  if (dias <= 120) return "d91_120";
  return "mas120";
}

/** Cubeta de aging de una factura según su fecha de vencimiento. */
export function cubetaFactura(fechaVencimiento: Date, corte: Date = new Date()): CubetaAging {
  return cubetaDe(diasVencido(fechaVencimiento, corte));
}

/** ¿La factura está vencida a la fecha de corte? */
export function estaVencida(fechaVencimiento: Date, corte: Date = new Date()): boolean {
  return diasVencido(fechaVencimiento, corte) > 0;
}
