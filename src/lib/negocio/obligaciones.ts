// ==========================================================
// Lógica: obligaciones financieras (créditos, leasing, tarjetas).
// Calcula la próxima fecha de pago (día del mes) y el nivel de alerta.
// ==========================================================
import "server-only";
import { prisma } from "@/lib/db";

export type NivelAlerta = "vencido" | "urgente" | "pronto" | "ok" | "sin_fecha";

export interface FilaObligacion {
  id: number;
  entidad: string;
  tipo: string;
  numero: string;
  saldoCapital: number;
  tasaEA: number | null;
  cuotaMensual: number | null;
  diaPago: number | null;
  fechaVencimiento: Date | null;
  estado: string;
  notas: string | null;
  proximaFecha: Date | null;
  diasHasta: number | null;
  alerta: NivelAlerta;
}

const MS_DIA = 1000 * 60 * 60 * 24;

// ---------- Plan de amortización (saldo vigente según fecha de pago) ----------
// Para créditos con plan de pagos, el saldo mostrado no es un valor fijo sino
// el "saldo de capital" de la próxima cuota por vencer (la primera cuya fecha
// de pago es hoy o posterior). Así el saldo baja solo mes a mes, siguiendo el
// plan, en vez de quedarse en el monto reestructurado inicial.
// Clave = número de la obligación · saldoCapital = saldo al inicio de esa cuota.
interface CuotaPlan { fechaPago: string; saldoCapital: number }
const PLANES_AMORTIZACION: Record<string, CuotaPlan[]> = {
  // Bancolombia — FNG (plan de pago FNG, 12 cuotas · día 13 · vence 13/04/2027).
  "FNG-206829": [
    { fechaPago: "2026-05-13", saldoCapital: 88336493 },
    { fechaPago: "2026-06-13", saldoCapital: 81403497 },
    { fechaPago: "2026-07-13", saldoCapital: 74395393 },
    { fechaPago: "2026-08-13", saldoCapital: 67311368 },
    { fechaPago: "2026-09-13", saldoCapital: 60150600 },
    { fechaPago: "2026-10-13", saldoCapital: 52912256 },
    { fechaPago: "2026-11-13", saldoCapital: 45595498 },
    { fechaPago: "2026-12-13", saldoCapital: 38199474 },
    { fechaPago: "2027-01-13", saldoCapital: 30723327 },
    { fechaPago: "2027-02-13", saldoCapital: 23166188 },
    { fechaPago: "2027-03-13", saldoCapital: 15527180 },
    { fechaPago: "2027-04-13", saldoCapital: 7805416 },
  ],
};

/**
 * Saldo de capital vigente a la fecha según el plan:
 *  - hay cuota por vencer → su saldo de capital;
 *  - plan completo y ya pagado → 0 (obligación cancelada);
 *  - sin plan → null (se usa el saldo almacenado).
 */
function saldoSegunPlan(numero: string, hoy0: Date): number | null {
  const plan = PLANES_AMORTIZACION[numero];
  if (!plan) return null;
  const t = hoy0.getTime();
  const sig = plan.find((c) => new Date(c.fechaPago + "T00:00:00").getTime() >= t);
  return sig ? sig.saldoCapital : 0;
}

const TIPO_LABEL: Record<string, string> = {
  credito: "Crédito",
  credito_fng: "Crédito FNG",
  leasing: "Leasing",
  tarjeta: "Tarjeta",
};
export function tipoLabel(t: string): string {
  return TIPO_LABEL[t] ?? t;
}

function proximaFecha(diaPago: number | null, hoy: Date): Date | null {
  if (!diaPago) return null;
  let f = new Date(hoy.getFullYear(), hoy.getMonth(), diaPago);
  if (f.getTime() < hoy.getTime()) f = new Date(hoy.getFullYear(), hoy.getMonth() + 1, diaPago);
  return f;
}

function nivel(dias: number | null): NivelAlerta {
  if (dias == null) return "sin_fecha";
  if (dias < 0) return "vencido";
  if (dias <= 3) return "urgente";
  if (dias <= 7) return "pronto";
  return "ok";
}

export async function listarObligaciones(hoy: Date = new Date()): Promise<FilaObligacion[]> {
  const hoy0 = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const obligaciones = await prisma.obligacionFinanciera.findMany({ orderBy: { saldoCapital: "desc" } });

  return obligaciones
    .map((o): FilaObligacion => {
      const vencida = o.fechaVencimiento != null && o.fechaVencimiento.getTime() < hoy0.getTime();
      const prox = vencida ? null : proximaFecha(o.diaPago, hoy0);
      const dias = prox ? Math.round((prox.getTime() - hoy0.getTime()) / MS_DIA) : null;
      // Si la obligación tiene plan de pagos, el saldo sigue el plan por fecha.
      const saldoCapital = saldoSegunPlan(o.numero, hoy0) ?? o.saldoCapital.toNumber();
      return {
        id: o.id, entidad: o.entidad, tipo: o.tipo, numero: o.numero,
        saldoCapital,
        tasaEA: o.tasaEA ? o.tasaEA.toNumber() : null,
        cuotaMensual: o.cuotaMensual ? o.cuotaMensual.toNumber() : null,
        diaPago: o.diaPago, fechaVencimiento: o.fechaVencimiento, estado: o.estado, notas: o.notas,
        proximaFecha: prox, diasHasta: dias, alerta: nivel(dias),
      };
    })
    // Reordenar por el saldo efectivo (el orden de la BD usa el saldo almacenado).
    .sort((a, b) => b.saldoCapital - a.saldoCapital);
}

export interface ResumenObligaciones {
  totalSaldo: number;
  totalCuotaMensual: number;
  cantidad: number;
  proximo: { fecha: Date; entidad: string; valor: number | null } | null;
}

export async function resumenObligaciones(hoy: Date = new Date()): Promise<ResumenObligaciones> {
  const filas = await listarObligaciones(hoy);
  const totalSaldo = filas.reduce((s, f) => s + f.saldoCapital, 0);
  const totalCuotaMensual = filas.reduce((s, f) => s + (f.cuotaMensual ?? 0), 0);
  const conFecha = filas.filter((f) => f.proximaFecha).sort((a, b) => a.proximaFecha!.getTime() - b.proximaFecha!.getTime());
  const p = conFecha[0];
  return {
    totalSaldo, totalCuotaMensual, cantidad: filas.length,
    proximo: p ? { fecha: p.proximaFecha!, entidad: p.entidad, valor: p.cuotaMensual } : null,
  };
}
