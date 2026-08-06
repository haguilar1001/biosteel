// ==========================================================
// Lógica de negocio: cuentas por pagar (CxP)
// Incluye documentos en moneda extranjera (valor origen + valor COP).
// La CxP es global por empresa; el filtro por sede no aplica aquí
// (los proveedores no están segmentados por sede en Fase 1).
// ==========================================================
import "server-only";
import { prisma } from "@/lib/db";
import { diasVencido } from "./aging";

const MS_DIA = 1000 * 60 * 60 * 24;

export interface ResumenCxp {
  totalCop: number;
  vencidoCop: number;
  cantidad: number;
  /** Saldo en USD (documentos cuya moneda es USD). */
  saldoUsd: number;
  saldoUsdEnCop: number;
  /** Vence en los próximos 7 días. */
  proximoVencerCop: number;
  proximoVencerCantidad: number;
}

export interface FilaCxp {
  id: number;
  numero: string;
  proveedor: string;
  moneda: string;
  valorOrigen: number;
  valorCop: number;
  saldo: number;
  fechaVencimiento: Date;
  dias: number;
  estado: string;
}

function whereAbiertos() {
  return { estado: { not: "pagado" as const }, saldo: { gt: 0 } };
}

export async function resumenCxp(corte: Date = new Date()): Promise<ResumenCxp> {
  const docs = await prisma.documentoCxp.findMany({
    where: whereAbiertos(),
    select: { moneda: true, saldo: true, valorOrigen: true, valorCop: true, fechaVencimiento: true },
  });

  let totalCop = 0;
  let vencidoCop = 0;
  let saldoUsd = 0;
  let saldoUsdEnCop = 0;
  let proximoVencerCop = 0;
  let proximoVencerCantidad = 0;

  for (const d of docs) {
    const saldoCop = d.saldo.toNumber();
    totalCop += saldoCop;
    const dias = diasVencido(d.fechaVencimiento, corte);
    if (dias > 0) vencidoCop += saldoCop;
    if (dias <= 0 && dias >= -7) {
      proximoVencerCop += saldoCop;
      proximoVencerCantidad += 1;
    }
    if (d.moneda === "USD") {
      // proporción del saldo respecto al valor COP para estimar el USD pendiente
      const factor = d.valorCop.toNumber() > 0 ? saldoCop / d.valorCop.toNumber() : 0;
      saldoUsd += d.valorOrigen.toNumber() * factor;
      saldoUsdEnCop += saldoCop;
    }
  }

  return {
    totalCop,
    vencidoCop,
    cantidad: docs.length,
    saldoUsd,
    saldoUsdEnCop,
    proximoVencerCop,
    proximoVencerCantidad,
  };
}

export async function listarDocumentosCxp(
  moneda?: string,
  corte: Date = new Date(),
): Promise<FilaCxp[]> {
  const docs = await prisma.documentoCxp.findMany({
    where: { ...whereAbiertos(), ...(moneda ? { moneda } : {}) },
    select: {
      id: true,
      numero: true,
      moneda: true,
      valorOrigen: true,
      valorCop: true,
      saldo: true,
      fechaVencimiento: true,
      estado: true,
      proveedor: { select: { nombre: true } },
    },
    orderBy: { fechaVencimiento: "asc" },
    take: 500,
  });

  return docs.map((d) => ({
    id: d.id,
    numero: d.numero,
    proveedor: d.proveedor.nombre,
    moneda: d.moneda,
    valorOrigen: d.valorOrigen.toNumber(),
    valorCop: d.valorCop.toNumber(),
    saldo: d.saldo.toNumber(),
    fechaVencimiento: d.fechaVencimiento,
    dias: diasVencido(d.fechaVencimiento, corte),
    estado: d.estado,
  }));
}

/** Días hasta el vencimiento (positivo = faltan; negativo = vencido). */
export function diasParaVencer(fechaVencimiento: Date, corte: Date = new Date()): number {
  return Math.floor((fechaVencimiento.getTime() - corte.getTime()) / MS_DIA);
}
