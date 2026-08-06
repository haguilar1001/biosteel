// ==========================================================
// Lógica de negocio: cuentas por pagar (CxP)
// REGLA: los ANTICIPOS (saldo < 0) se manejan APARTE y NO afectan el
// saldo de CxP. CxP = solo documentos por pagar (saldo > 0).
// Los anticipos tienen su propia vista (/cxp/anticipos).
// ==========================================================
import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { diasVencido } from "./aging";

const MS_DIA = 1000 * 60 * 60 * 24;

const wherePorPagar: Prisma.DocumentoCxpWhereInput = { saldo: { gt: 0 } };
const whereAnticipo: Prisma.DocumentoCxpWhereInput = { saldo: { lt: 0 } };

// ---------- Resumen CxP (solo por pagar) ----------
export interface ResumenCxp {
  porPagar: number;
  cantidad: number;
  vencido: number;
  proximoVencer: number;
  proximoVencerCantidad: number;
  anticipos: number;        // total de saldos a favor (aparte, informativo)
  anticiposCantidad: number;
}

export async function resumenCxp(corte: Date = new Date()): Promise<ResumenCxp> {
  const [porPagar, anticipo] = await Promise.all([
    prisma.documentoCxp.findMany({ where: wherePorPagar, select: { saldo: true, fechaVencimiento: true } }),
    prisma.documentoCxp.aggregate({ where: whereAnticipo, _sum: { saldo: true }, _count: true }),
  ]);

  const r: ResumenCxp = {
    porPagar: 0, cantidad: porPagar.length, vencido: 0, proximoVencer: 0, proximoVencerCantidad: 0,
    anticipos: anticipo._sum.saldo?.toNumber() ?? 0, anticiposCantidad: anticipo._count,
  };
  for (const d of porPagar) {
    const s = d.saldo.toNumber();
    r.porPagar += s;
    const dias = diasVencido(d.fechaVencimiento, corte);
    if (dias > 0) r.vencido += s;
    if (dias <= 0 && dias >= -7) { r.proximoVencer += s; r.proximoVencerCantidad += 1; }
  }
  return r;
}

// ---------- Búsqueda ----------
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

// ---------- Detalle de documentos por pagar ----------
export interface FilaCxp {
  id: number;
  numero: string;
  proveedor: string;
  nit: string | null;
  concepto: string | null;
  saldo: number;
  fechaVencimiento: Date;
  dias: number;
  estado: string;
}

export async function listarDocumentosCxp(
  q?: string,
  corte: Date = new Date(),
): Promise<{ filas: FilaCxp[]; total: number; suma: number }> {
  const where: Prisma.DocumentoCxpWhereInput = { ...wherePorPagar, ...filtroBusqueda(q) };
  const [total, agg, docs] = await Promise.all([
    prisma.documentoCxp.count({ where }),
    prisma.documentoCxp.aggregate({ where, _sum: { saldo: true } }),
    prisma.documentoCxp.findMany({
      where,
      select: {
        id: true, numero: true, saldo: true, fechaVencimiento: true, estado: true, concepto: true,
        proveedor: { select: { nombre: true, nit: true } },
      },
      orderBy: { saldo: "desc" },
      take: 300,
    }),
  ]);

  const filas = docs.map((d) => ({
    id: d.id, numero: d.numero, proveedor: d.proveedor.nombre, nit: d.proveedor.nit,
    concepto: d.concepto, saldo: d.saldo.toNumber(), fechaVencimiento: d.fechaVencimiento,
    dias: diasVencido(d.fechaVencimiento, corte), estado: d.estado,
  }));
  return { filas, total, suma: agg._sum.saldo?.toNumber() ?? 0 };
}

// ---------- Informe por proveedor (solo por pagar) ----------
export interface FilaProveedorCxp {
  proveedorId: number;
  proveedor: string;
  nit: string | null;
  interno: boolean;
  documentos: number;
  saldo: number;   // por pagar
  vencido: number;
  diasMax: number;
}

export type TipoProveedorFiltro = "interno" | "externo";

function filtroTipo(tipo?: TipoProveedorFiltro): Prisma.DocumentoCxpWhereInput {
  if (tipo === "interno") return { proveedor: { is: { esInterno: true } } };
  if (tipo === "externo") return { proveedor: { is: { esInterno: false } } };
  return {};
}

export async function cxpPorProveedor(
  q?: string,
  tipo?: TipoProveedorFiltro,
  corte: Date = new Date(),
): Promise<FilaProveedorCxp[]> {
  const docs = await prisma.documentoCxp.findMany({
    where: { ...wherePorPagar, ...filtroBusqueda(q), ...filtroTipo(tipo) },
    select: {
      saldo: true, fechaVencimiento: true, proveedorId: true,
      proveedor: { select: { nombre: true, nit: true, esInterno: true } },
    },
  });

  const mapa = new Map<number, FilaProveedorCxp>();
  for (const d of docs) {
    const s = d.saldo.toNumber();
    const dias = diasVencido(d.fechaVencimiento, corte);
    const e = mapa.get(d.proveedorId) ?? {
      proveedorId: d.proveedorId, proveedor: d.proveedor.nombre, nit: d.proveedor.nit,
      interno: d.proveedor.esInterno, documentos: 0, saldo: 0, vencido: 0, diasMax: 0,
    };
    e.documentos += 1;
    e.saldo += s;
    if (dias > 0) { e.vencido += s; e.diasMax = Math.max(e.diasMax, dias); }
    mapa.set(d.proveedorId, e);
  }
  return [...mapa.values()].sort((a, b) => b.saldo - a.saldo);
}

// ---------- Anticipos (saldos a favor), APARTE ----------
export interface ResumenAnticipos {
  total: number;
  cantidad: number;
  internos: number;
  externos: number;
}

export interface FilaAnticipo {
  terceroId: number;
  tercero: string;
  nit: string | null;
  interno: boolean;
  documentos: number;
  anticipo: number; // negativo
}

export async function resumenAnticipos(): Promise<ResumenAnticipos> {
  const docs = await prisma.documentoCxp.findMany({
    where: whereAnticipo,
    select: { saldo: true, proveedor: { select: { esInterno: true } } },
  });
  const r: ResumenAnticipos = { total: 0, cantidad: docs.length, internos: 0, externos: 0 };
  for (const d of docs) {
    const s = d.saldo.toNumber();
    r.total += s;
    if (d.proveedor.esInterno) r.internos += s; else r.externos += s;
  }
  return r;
}

export async function anticiposPorTercero(q?: string, tipo?: TipoProveedorFiltro): Promise<FilaAnticipo[]> {
  const docs = await prisma.documentoCxp.findMany({
    where: { ...whereAnticipo, ...filtroBusqueda(q), ...filtroTipo(tipo) },
    select: {
      saldo: true, proveedorId: true,
      proveedor: { select: { nombre: true, nit: true, esInterno: true } },
    },
  });
  const mapa = new Map<number, FilaAnticipo>();
  for (const d of docs) {
    const e = mapa.get(d.proveedorId) ?? {
      terceroId: d.proveedorId, tercero: d.proveedor.nombre, nit: d.proveedor.nit,
      interno: d.proveedor.esInterno, documentos: 0, anticipo: 0,
    };
    e.documentos += 1;
    e.anticipo += d.saldo.toNumber();
    mapa.set(d.proveedorId, e);
  }
  return [...mapa.values()].sort((a, b) => a.anticipo - b.anticipo); // más negativo primero
}

export function diasParaVencer(fechaVencimiento: Date, corte: Date = new Date()): number {
  return Math.floor((fechaVencimiento.getTime() - corte.getTime()) / MS_DIA);
}
