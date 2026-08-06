// ==========================================================
// Lógica de negocio: cartera (cuentas por cobrar)
// Trabaja en NETO (como CxP). Todas las consultas reciben el filtro
// anti-IDOR (BIO-SEC-001): nunca se consulta cartera sin el alcance.
// ==========================================================
import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { UsuarioConRol } from "@/lib/auth/session";
import type { Alcance } from "@/lib/rbac/permissions";
import { filtroFacturas } from "@/lib/rbac/authorize";
import { cubetaDe, diasVencido, type CubetaAging } from "./aging";

export interface CeldaCubeta {
  monto: number;
  cantidad: number;
}

export interface ResumenCartera {
  total: number;            // NETO
  cantidadFacturas: number;
  vencido: number;          // neto de facturas positivas vencidas
  alDia: number;            // neto de positivas al día / por vencer
  anticipos: number;        // saldos a favor de clientes (negativo)
  anticiposCantidad: number;
  porCubeta: Record<CubetaAging, CeldaCubeta>; // aging de facturas positivas
}

export interface FilaCartera {
  id: number;
  numero: string;
  cliente: string;
  nit: string | null;
  concepto: string | null;
  fechaEmision: Date;
  fechaVencimiento: Date;
  valorTotal: number;
  saldo: number;
  dias: number;
  cubeta: CubetaAging;
  estado: string;
}

/** Facturas con saldo (positivo o negativo); excluye canceladas y saldo 0. */
function whereConSaldo(usuario: UsuarioConRol, alcance: Alcance): Prisma.FacturaVentaWhereInput {
  return { ...filtroFacturas(usuario, alcance), estado: { not: "cancelada" }, saldo: { not: 0 } };
}

function celdasVacias(): Record<CubetaAging, CeldaCubeta> {
  return {
    d1_30: { monto: 0, cantidad: 0 }, d31_60: { monto: 0, cantidad: 0 },
    d61_90: { monto: 0, cantidad: 0 }, d91_120: { monto: 0, cantidad: 0 }, mas120: { monto: 0, cantidad: 0 },
  };
}

export async function resumenCartera(
  usuario: UsuarioConRol,
  alcance: Alcance,
  corte: Date = new Date(),
): Promise<ResumenCartera> {
  const facturas = await prisma.facturaVenta.findMany({
    where: whereConSaldo(usuario, alcance),
    select: { saldo: true, fechaVencimiento: true },
  });

  const porCubeta = celdasVacias();
  const r: ResumenCartera = {
    total: 0, cantidadFacturas: facturas.length, vencido: 0, alDia: 0,
    anticipos: 0, anticiposCantidad: 0, porCubeta,
  };

  for (const f of facturas) {
    const saldo = f.saldo.toNumber();
    const dias = diasVencido(f.fechaVencimiento, corte);
    r.total += saldo;
    // Vencida/al día en NETO (incluye notas), como CxP.
    if (dias > 0) r.vencido += saldo; else r.alDia += saldo;
    if (saldo < 0) {
      r.anticipos += saldo;
      r.anticiposCantidad += 1;
    } else {
      // Aging por edades: solo facturas positivas (por cobrar).
      const cubeta = cubetaDe(dias);
      porCubeta[cubeta].monto += saldo;
      porCubeta[cubeta].cantidad += 1;
    }
  }
  return r;
}

function filtroBusqueda(q?: string): Prisma.FacturaVentaWhereInput {
  const t = q?.trim();
  if (!t) return {};
  return {
    OR: [
      { numero: { contains: t, mode: "insensitive" } },
      { concepto: { contains: t, mode: "insensitive" } },
      { tercero: { is: { nombre: { contains: t, mode: "insensitive" } } } },
      { tercero: { is: { nit: { contains: t, mode: "insensitive" } } } },
    ],
  };
}

export interface FiltrosCartera {
  cubeta?: CubetaAging;
  q?: string;
}

export async function listarFacturas(
  usuario: UsuarioConRol,
  alcance: Alcance,
  filtros: FiltrosCartera = {},
  corte: Date = new Date(),
): Promise<{ filas: FilaCartera[]; total: number; suma: number }> {
  const where: Prisma.FacturaVentaWhereInput = { ...whereConSaldo(usuario, alcance), ...filtroBusqueda(filtros.q) };
  const [total, agg, facturas] = await Promise.all([
    prisma.facturaVenta.count({ where }),
    prisma.facturaVenta.aggregate({ where, _sum: { saldo: true } }),
    prisma.facturaVenta.findMany({
      where,
      select: {
        id: true, numero: true, valorTotal: true, saldo: true, fechaEmision: true,
        fechaVencimiento: true, estado: true, concepto: true,
        tercero: { select: { nombre: true, nit: true } },
      },
      orderBy: { saldo: "desc" },
      take: 300,
    }),
  ]);

  let filas = facturas.map((f): FilaCartera => {
    const dias = diasVencido(f.fechaVencimiento, corte);
    return {
      id: f.id, numero: f.numero, cliente: f.tercero.nombre, nit: f.tercero.nit,
      concepto: f.concepto, fechaEmision: f.fechaEmision, fechaVencimiento: f.fechaVencimiento,
      valorTotal: f.valorTotal.toNumber(), saldo: f.saldo.toNumber(), dias, cubeta: cubetaDe(dias),
      estado: f.estado,
    };
  });
  if (filtros.cubeta) filas = filas.filter((f) => f.cubeta === filtros.cubeta && f.saldo > 0);
  return { filas, total, suma: agg._sum.saldo?.toNumber() ?? 0 };
}

// ---------- Informe por cliente (neto) ----------
export interface FilaClienteCartera {
  clienteId: number;
  cliente: string;
  nit: string | null;
  documentos: number;
  saldoNeto: number;
  vencido: number;
  diasMax: number;
}

export async function carteraPorCliente(
  usuario: UsuarioConRol,
  alcance: Alcance,
  q?: string,
  corte: Date = new Date(),
): Promise<FilaClienteCartera[]> {
  const facturas = await prisma.facturaVenta.findMany({
    where: { ...whereConSaldo(usuario, alcance), ...filtroBusqueda(q) },
    select: { saldo: true, fechaVencimiento: true, terceroId: true, tercero: { select: { nombre: true, nit: true } } },
  });
  const mapa = new Map<number, FilaClienteCartera>();
  for (const f of facturas) {
    const s = f.saldo.toNumber();
    const dias = diasVencido(f.fechaVencimiento, corte);
    const e = mapa.get(f.terceroId) ?? {
      clienteId: f.terceroId, cliente: f.tercero.nombre, nit: f.tercero.nit,
      documentos: 0, saldoNeto: 0, vencido: 0, diasMax: 0,
    };
    e.documentos += 1;
    e.saldoNeto += s;
    if (s > 0 && dias > 0) { e.vencido += s; e.diasMax = Math.max(e.diasMax, dias); }
    mapa.set(f.terceroId, e);
  }
  return [...mapa.values()].sort((a, b) => b.saldoNeto - a.saldoNeto);
}
