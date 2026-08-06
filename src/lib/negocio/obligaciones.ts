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

  return obligaciones.map((o): FilaObligacion => {
    const vencida = o.fechaVencimiento != null && o.fechaVencimiento.getTime() < hoy0.getTime();
    const prox = vencida ? null : proximaFecha(o.diaPago, hoy0);
    const dias = prox ? Math.round((prox.getTime() - hoy0.getTime()) / MS_DIA) : null;
    return {
      id: o.id, entidad: o.entidad, tipo: o.tipo, numero: o.numero,
      saldoCapital: o.saldoCapital.toNumber(),
      tasaEA: o.tasaEA ? o.tasaEA.toNumber() : null,
      cuotaMensual: o.cuotaMensual ? o.cuotaMensual.toNumber() : null,
      diaPago: o.diaPago, fechaVencimiento: o.fechaVencimiento, estado: o.estado, notas: o.notas,
      proximaFecha: prox, diasHasta: dias, alerta: nivel(dias),
    };
  });
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
