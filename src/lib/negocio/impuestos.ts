// ==========================================================
// Impuestos pendientes (histórico mensual, entidad BioSteel).
// El total del mes se calcula de los componentes (ret+iva+ica+renta),
// porque la columna "GRAN TOTAL" del Excel es inconsistente.
// ==========================================================
import "server-only";
import { prisma } from "@/lib/db";

const MS_DIA = 1000 * 60 * 60 * 24;
export type AlertaImpuesto = "vencido" | "urgente" | "pronto" | "ok" | "sin_fecha";

export interface FilaImpuesto {
  id: number;
  anio: number;
  mes: number;
  fecha: Date;
  retencion: number;
  iva: number;
  ica: number;
  renta: number;
  total: number;
  granTotal: number | null;
  vencimiento: Date | null;
  dias: number | null;
  alerta: AlertaImpuesto;
}

function nivel(dias: number | null): AlertaImpuesto {
  if (dias == null) return "sin_fecha";
  if (dias < 0) return "vencido";
  if (dias <= 3) return "urgente";
  if (dias <= 7) return "pronto";
  return "ok";
}

export async function listarImpuestos(hoy: Date = new Date()): Promise<FilaImpuesto[]> {
  const hoy0 = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const filas = await prisma.impuestoMensual.findMany({ where: { entidad: "BioSteel" }, orderBy: [{ anio: "desc" }, { mes: "desc" }] });
  return filas.map((f): FilaImpuesto => {
    const total = f.retencion.toNumber() + f.iva.toNumber() + f.ica.toNumber() + f.renta.toNumber();
    const dias = f.vencimiento ? Math.round((f.vencimiento.getTime() - hoy0.getTime()) / MS_DIA) : null;
    return {
      id: f.id, anio: f.anio, mes: f.mes, fecha: f.fecha,
      retencion: f.retencion.toNumber(), iva: f.iva.toNumber(), ica: f.ica.toNumber(), renta: f.renta.toNumber(),
      total, granTotal: f.granTotal ? f.granTotal.toNumber() : null, vencimiento: f.vencimiento,
      dias, alerta: total > 0 ? nivel(dias) : "sin_fecha",
    };
  });
}

export interface ResumenImpuestos {
  totalPendiente: number;
  retencion: number;
  iva: number;
  ica: number;
  renta: number;
  mesesConSaldo: number;
  vencido: number;      // total con vencimiento pasado
  proximo: { fecha: Date; total: number } | null;
}

export async function resumenImpuestos(hoy: Date = new Date()): Promise<ResumenImpuestos> {
  const filas = await listarImpuestos(hoy);
  const r: ResumenImpuestos = { totalPendiente: 0, retencion: 0, iva: 0, ica: 0, renta: 0, mesesConSaldo: 0, vencido: 0, proximo: null };
  const futuros: FilaImpuesto[] = [];
  for (const f of filas) {
    r.totalPendiente += f.total;
    r.retencion += f.retencion; r.iva += f.iva; r.ica += f.ica; r.renta += f.renta;
    if (f.total > 0) r.mesesConSaldo += 1;
    if (f.total > 0 && f.dias != null && f.dias < 0) r.vencido += f.total;
    if (f.total > 0 && f.dias != null && f.dias >= 0) futuros.push(f);
  }
  futuros.sort((a, b) => a.vencimiento!.getTime() - b.vencimiento!.getTime());
  if (futuros[0]) r.proximo = { fecha: futuros[0].vencimiento!, total: futuros[0].total };
  return r;
}
