// ==========================================================
// Lógica de negocio: antigüedad de cartera (aging)
// Cubetas estándar de cartera: Corriente 0–30, 31–60, 61–90, +90
// (calculadas por días transcurridos desde el vencimiento).
// ==========================================================

export type CubetaAging = "corriente" | "d31_60" | "d61_90" | "mas90";

export interface DefCubeta {
  clave: CubetaAging;
  etiqueta: string;
  /** Variable CSS del color semántico asociado. */
  color: string;
}

/** Orden y metadatos de las cubetas (para KPIs y gráficas). */
export const CUBETAS: readonly DefCubeta[] = [
  { clave: "corriente", etiqueta: "Corriente 0–30", color: "var(--ok)" },
  { clave: "d31_60", etiqueta: "31–60 días", color: "var(--w1)" },
  { clave: "d61_90", etiqueta: "61–90 días", color: "var(--w2)" },
  { clave: "mas90", etiqueta: "+90 días", color: "var(--bad)" },
] as const;

const MS_DIA = 1000 * 60 * 60 * 24;

/** Días vencidos respecto a la fecha de corte (negativo = aún no vence). */
export function diasVencido(fechaVencimiento: Date, corte: Date = new Date()): number {
  return Math.floor((corte.getTime() - fechaVencimiento.getTime()) / MS_DIA);
}

/** Cubeta de aging a partir de los días vencidos. */
export function cubetaDe(dias: number): CubetaAging {
  if (dias <= 30) return "corriente";
  if (dias <= 60) return "d31_60";
  if (dias <= 90) return "d61_90";
  return "mas90";
}

/** Cubeta de aging de una factura según su fecha de vencimiento. */
export function cubetaFactura(fechaVencimiento: Date, corte: Date = new Date()): CubetaAging {
  return cubetaDe(diasVencido(fechaVencimiento, corte));
}

/** ¿La factura está vencida a la fecha de corte? */
export function estaVencida(fechaVencimiento: Date, corte: Date = new Date()): boolean {
  return diasVencido(fechaVencimiento, corte) > 0;
}
