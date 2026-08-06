// ==========================================================
// Lógica de negocio: cuentas por pagar (CxP)
// Los totales son NETOS (incluyen anticipos/notas con saldo negativo),
// para conciliar con el reporte del ERP. Los anticipos se muestran aparte.
// ==========================================================
import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { diasVencido } from "./aging";

const MS_DIA = 1000 * 60 * 60 * 24;

export interface ResumenCxp {
  totalNeto: number;        // neto = por pagar − anticipos (concilia con el ERP)
  cantidad: number;
  porPagar: number;         // suma de saldos positivos
  porPagarCantidad: number;
  anticipos: number;        // suma de saldos negativos (número negativo)
  anticiposCantidad: number;
  vencidoNeto: number;      // neto de documentos vencidos (días > 0)
  proximoVencer: number;    // vence en ≤ 7 días
  proximoVencerCantidad: number;
}

export interface FilaCxp {
  id: number;
  numero: string;
  proveedor: string;
  nit: string | null;
  concepto: string | null;
  moneda: string;
  saldo: number;
  fechaVencimiento: Date;
  dias: number;
  estado: string;
}

/** Documentos con saldo (positivo o negativo); excluye los saldados en 0. */
function whereConSaldo(): Prisma.DocumentoCxpWhereInput {
  return { saldo: { not: 0 } };
}

export async function resumenCxp(corte: Date = new Date()): Promise<ResumenCxp> {
  const docs = await prisma.documentoCxp.findMany({
    where: whereConSaldo(),
    select: { saldo: true, fechaVencimiento: true },
  });

  const r: ResumenCxp = {
    totalNeto: 0, cantidad: docs.length, porPagar: 0, porPagarCantidad: 0,
    anticipos: 0, anticiposCantidad: 0, vencidoNeto: 0, proximoVencer: 0, proximoVencerCantidad: 0,
  };

  for (const d of docs) {
    const s = d.saldo.toNumber();
    r.totalNeto += s;
    if (s > 0) { r.porPagar += s; r.porPagarCantidad += 1; }
    else { r.anticipos += s; r.anticiposCantidad += 1; }
    const dias = diasVencido(d.fechaVencimiento, corte);
    if (dias > 0) r.vencidoNeto += s;
    if (dias <= 0 && dias >= -7) { r.proximoVencer += s; r.proximoVencerCantidad += 1; }
  }
  return r;
}

/** Búsqueda por proveedor, número de documento o concepto. */
function filtroBusqueda(q?: string): Prisma.DocumentoCxpWhereInput {
  if (!q || !q.trim()) return {};
  const t = q.trim();
  return {
    OR: [
      { numero: { contains: t, mode: "insensitive" } },
      { concepto: { contains: t, mode: "insensitive" } },
      { proveedor: { is: { nombre: { contains: t, mode: "insensitive" } } } },
      { proveedor: { is: { nit: { contains: t, mode: "insensitive" } } } },
    ],
  };
}

export async function listarDocumentosCxp(
  q?: string,
  corte: Date = new Date(),
): Promise<{ filas: FilaCxp[]; total: number }> {
  const where: Prisma.DocumentoCxpWhereInput = { ...whereConSaldo(), ...filtroBusqueda(q) };
  const total = await prisma.documentoCxp.count({ where });
  const docs = await prisma.documentoCxp.findMany({
    where,
    select: {
      id: true, numero: true, moneda: true, saldo: true, fechaVencimiento: true,
      estado: true, concepto: true,
      proveedor: { select: { nombre: true, nit: true } },
    },
    orderBy: { saldo: "desc" },
    take: 300,
  });

  const filas = docs.map((d) => ({
    id: d.id,
    numero: d.numero,
    proveedor: d.proveedor.nombre,
    nit: d.proveedor.nit,
    concepto: d.concepto,
    moneda: d.moneda,
    saldo: d.saldo.toNumber(),
    fechaVencimiento: d.fechaVencimiento,
    dias: diasVencido(d.fechaVencimiento, corte),
    estado: d.estado,
  }));
  return { filas, total };
}

export interface FilaProveedorCxp {
  proveedorId: number;
  proveedor: string;
  nit: string | null;
  documentos: number;
  saldoNeto: number;
  porPagar: number;
  anticipos: number;
  vencido: number;
  diasMax: number;
}

/** Informe de CxP agrupado por proveedor (neto), con búsqueda opcional. */
export async function cxpPorProveedor(q?: string, corte: Date = new Date()): Promise<FilaProveedorCxp[]> {
  const docs = await prisma.documentoCxp.findMany({
    where: { ...whereConSaldo(), ...filtroBusqueda(q) },
    select: {
      saldo: true, fechaVencimiento: true, proveedorId: true,
      proveedor: { select: { nombre: true, nit: true } },
    },
  });

  const mapa = new Map<number, FilaProveedorCxp>();
  for (const d of docs) {
    const s = d.saldo.toNumber();
    const dias = diasVencido(d.fechaVencimiento, corte);
    const e = mapa.get(d.proveedorId) ?? {
      proveedorId: d.proveedorId, proveedor: d.proveedor.nombre, nit: d.proveedor.nit,
      documentos: 0, saldoNeto: 0, porPagar: 0, anticipos: 0, vencido: 0, diasMax: 0,
    };
    e.documentos += 1;
    e.saldoNeto += s;
    if (s > 0) e.porPagar += s; else e.anticipos += s;
    if (dias > 0) { e.vencido += s; e.diasMax = Math.max(e.diasMax, dias); }
    mapa.set(d.proveedorId, e);
  }

  return [...mapa.values()].sort((a, b) => b.saldoNeto - a.saldoNeto);
}

export function diasParaVencer(fechaVencimiento: Date, corte: Date = new Date()): number {
  return Math.floor((fechaVencimiento.getTime() - corte.getTime()) / MS_DIA);
}
