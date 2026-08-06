// ==========================================================
// Formato numérico institucional (Colombia)
// Requisito: pesos con separador de miles SIN decimales ($ 1.234.567)
//            porcentajes con DOS decimales (45,50 %)
// ==========================================================
import { Prisma } from "@prisma/client";

type Numerico = number | string | Prisma.Decimal;

function aNumero(v: Numerico): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") return Number(v);
  return v.toNumber();
}

const nfPesos = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });
const nfMiles = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });
const nfPorc = new Intl.NumberFormat("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** $ 1.234.567 (sin decimales). */
export function formatCOP(v: Numerico): string {
  return `$ ${nfPesos.format(Math.round(aNumero(v)))}`;
}

/** 1.234.567 (entero con separador de miles). */
export function formatNumero(v: Numerico): string {
  return nfMiles.format(Math.round(aNumero(v)));
}

/**
 * 45,50 % (dos decimales).
 * @param valor  porcentaje ya en escala 0–100 (por defecto) o proporción 0–1 si `esProporcion`.
 */
export function formatPorcentaje(valor: Numerico, esProporcion = false): string {
  const n = aNumero(valor) * (esProporcion ? 100 : 1);
  return `${nfPorc.format(n)} %`;
}

/** Moneda extranjera con su símbolo (US$, €). */
export function formatMoneda(v: Numerico, simbolo: string): string {
  return `${simbolo} ${nfPesos.format(Math.round(aNumero(v)))}`;
}
