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

// ==========================================================
// Fechas — formato corto institucional AA/MM/DD (Short Date).
// Un único helper para toda la app; usa la zona horaria del entorno,
// igual que el formato anterior (coherente en el servidor de Railway).
// ==========================================================
const p2 = (n: number) => String(n).padStart(2, "0");

/** Fecha corta AA/MM/DD (p. ej. 26/08/08). */
export function formatFecha(d: Date): string {
  return `${p2(d.getFullYear() % 100)}/${p2(d.getMonth() + 1)}/${p2(d.getDate())}`;
}

/** Fecha y hora AA/MM/DD HH:mm. */
export function formatFechaHora(d: Date): string {
  return `${formatFecha(d)} ${p2(d.getHours())}:${p2(d.getMinutes())}`;
}

/** Fecha y hora con segundos AA/MM/DD HH:mm:ss (auditoría). */
export function formatFechaHoraSeg(d: Date): string {
  return `${formatFechaHora(d)}:${p2(d.getSeconds())}`;
}
