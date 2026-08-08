// ==========================================================
// Lógica de negocio: cuentas por pagar (CxP)
// La pantalla trabaja en NETO (suma de todos los saldos, positivos y
// negativos). Neto = lo que realmente se debe = $ 9.434.160.623.
// Los anticipos (saldo < 0) están incluidos en el neto; además tienen
// su propia vista de desglose (/cxp/anticipos).
// ==========================================================
import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { diasVencido } from "./aging";

const MS_DIA = 1000 * 60 * 60 * 24;

const whereConSaldo: Prisma.DocumentoCxpWhereInput = { saldo: { not: 0 } };
const whereAnticipo: Prisma.DocumentoCxpWhereInput = { saldo: { lt: 0 } };

// ---------- Resumen CxP (neto) ----------
export interface ResumenCxp {
  total: number;            // NETO
  cantidad: number;
  vencido: number;          // neto de documentos vencidos
  alDia: number;            // neto al día / por vencer
  anticipos: number;        // componente de saldos a favor (negativo, informativo)
  anticiposCantidad: number;
}

export async function resumenCxp(corte: Date = new Date()): Promise<ResumenCxp> {
  const [docs, ant] = await Promise.all([
    prisma.documentoCxp.findMany({ where: whereConSaldo, select: { saldo: true, fechaVencimiento: true } }),
    prisma.documentoCxp.aggregate({ where: whereAnticipo, _sum: { saldo: true }, _count: true }),
  ]);

  const r: ResumenCxp = {
    total: 0, cantidad: docs.length, vencido: 0, alDia: 0,
    anticipos: ant._sum.saldo?.toNumber() ?? 0, anticiposCantidad: ant._count,
  };
  for (const d of docs) {
    const s = d.saldo.toNumber();
    r.total += s;
    if (diasVencido(d.fechaVencimiento, corte) > 0) r.vencido += s; else r.alDia += s;
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

// ---------- Detalle de documentos (neto) ----------
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
  const where: Prisma.DocumentoCxpWhereInput = { ...whereConSaldo, ...filtroBusqueda(q) };
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

// ---------- Informe por proveedor (neto) ----------
export interface FilaProveedorCxp {
  proveedorId: number;
  proveedor: string;
  nit: string | null;
  interno: boolean;
  documentos: number;
  saldoNeto: number;
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
    where: { ...whereConSaldo, ...filtroBusqueda(q), ...filtroTipo(tipo) },
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
      interno: d.proveedor.esInterno, documentos: 0, saldoNeto: 0, vencido: 0, diasMax: 0,
    };
    e.documentos += 1;
    e.saldoNeto += s;
    if (dias > 0) { e.vencido += s; e.diasMax = Math.max(e.diasMax, dias); }
    mapa.set(d.proveedorId, e);
  }
  return [...mapa.values()].sort((a, b) => b.saldoNeto - a.saldoNeto);
}

// ---------- Facturado vs Pagado por proveedor (por mes) ----------
// Facturado = documentos de CxP emitidos en el mes (valor COP).
// Pagado    = egresos del Flujo de Caja al proveedor en el mes.
// Se cruzan por nombre normalizado (misma fuente ERP).
export interface FilaFactPago {
  proveedor: string;
  nit: string | null;
  interno: boolean;
  facturado: number;
  pagado: number;
}

function normNombre(s: string): string {
  return s.trim().toUpperCase().replace(/\s+/g, " ");
}

export async function facturadoVsPagado(anio: number, mes: number): Promise<FilaFactPago[]> {
  const desde = new Date(Date.UTC(anio, mes - 1, 1));
  const hasta = new Date(Date.UTC(anio, mes, 1));

  const [docs, egresos] = await Promise.all([
    prisma.documentoCxp.findMany({
      where: { fechaEmision: { gte: desde, lt: hasta } },
      select: { valorCop: true, proveedor: { select: { nombre: true, nit: true, esInterno: true } } },
    }),
    prisma.movimientoFlujo.groupBy({
      by: ["terceroNombre"],
      where: { anio, mes, tipo: "egreso" },
      _sum: { valor: true },
    }),
  ]);

  const mapa = new Map<string, FilaFactPago>();
  const get = (nombre: string): FilaFactPago => {
    const k = normNombre(nombre);
    let e = mapa.get(k);
    if (!e) { e = { proveedor: nombre, nit: null, interno: false, facturado: 0, pagado: 0 }; mapa.set(k, e); }
    return e;
  };

  for (const d of docs) {
    const e = get(d.proveedor.nombre);
    e.facturado += d.valorCop.toNumber();
    e.nit = e.nit ?? d.proveedor.nit;
    e.interno = e.interno || d.proveedor.esInterno;
  }
  for (const g of egresos) {
    const e = get(g.terceroNombre);
    e.pagado += g._sum.valor?.toNumber() ?? 0;
  }

  return [...mapa.values()].sort((a, b) => Math.max(b.facturado, b.pagado) - Math.max(a.facturado, a.pagado));
}

// ---------- Anticipos (desglose informativo) ----------
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
  anticipo: number;
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
  return [...mapa.values()].sort((a, b) => a.anticipo - b.anticipo);
}

export function diasParaVencer(fechaVencimiento: Date, corte: Date = new Date()): number {
  return Math.floor((fechaVencimiento.getTime() - corte.getTime()) / MS_DIA);
}
