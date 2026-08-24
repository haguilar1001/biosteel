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
 * $ 223,46 M · $ 223 K — la versión corta de formatCOP, que es la que se ve
 * cuando el usuario elige "cifras resumidas" (data-montos en <html>).
 * Regla única para toda la app: la usan el componente Monto y el centro de
 * los anillos, para que no queden dos abreviaturas distintas conviviendo.
 */
export function formatCOPCorto(v: Numerico): string {
  const n = aNumero(v);
  const a = Math.abs(n);
  if (a >= 1e6) return `$ ${(n / 1e6).toLocaleString("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} M`;
  if (a >= 1e3) return `$ ${(n / 1e3).toLocaleString("es-CO", { maximumFractionDigits: 0 })} K`;
  return formatCOP(n);
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
// Fechas — formato institucional DD/MM/AAAA (Día/Mes/Año).
// SIEMPRE en hora de Colombia (America/Bogota), sin importar la zona del
// servidor. En Railway el proceso corre en UTC; usar getHours()/getDate()
// mostraba la hora en UTC (+5 h), por eso los sellos salían adelantados.
// ==========================================================
const TZ = "America/Bogota";

function partesBogota(d: Date): { d: string; m: string; y: string; H: string; Min: string; S: string } {
  const p = new Intl.DateTimeFormat("es-CO", {
    timeZone: TZ, hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(d);
  const g = (t: Intl.DateTimeFormatPartTypes) => p.find((x) => x.type === t)?.value ?? "";
  return { d: g("day"), m: g("month"), y: g("year"), H: g("hour"), Min: g("minute"), S: g("second") };
}

/** Fecha DD/MM/AAAA (p. ej. 13/08/2026) en hora de Colombia. */
export function formatFecha(d: Date): string {
  const { d: dd, m, y } = partesBogota(d);
  return `${dd}/${m}/${y}`;
}

/** Fecha y hora DD/MM/AAAA HH:mm (hora de Colombia). */
export function formatFechaHora(d: Date): string {
  const { d: dd, m, y, H, Min } = partesBogota(d);
  return `${dd}/${m}/${y} ${H}:${Min}`;
}

/** Fecha y hora con segundos DD/MM/AAAA HH:mm:ss (auditoría, hora de Colombia). */
export function formatFechaHoraSeg(d: Date): string {
  const { d: dd, m, y, H, Min, S } = partesBogota(d);
  return `${dd}/${m}/${y} ${H}:${Min}:${S}`;
}
