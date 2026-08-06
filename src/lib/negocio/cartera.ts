// ==========================================================
// Lógica de negocio: cartera (cuentas por cobrar)
// Todas las consultas reciben el filtro anti-IDOR (BIO-SEC-001):
// nunca se consulta cartera sin el `where` del alcance del usuario.
// ==========================================================
import "server-only";
import { prisma } from "@/lib/db";
import type { UsuarioConRol } from "@/lib/auth/session";
import type { Alcance } from "@/lib/rbac/permissions";
import { filtroFacturas } from "@/lib/rbac/authorize";
import { cubetaDe, cubetaFactura, diasVencido, estaVencida, type CubetaAging } from "./aging";

export interface CeldaCubeta {
  monto: number;
  cantidad: number;
}

export interface ResumenCartera {
  total: number;
  vencido: number;
  cantidadFacturas: number;
  /** Cartera por cubeta de antigüedad, en el orden de CUBETAS. */
  porCubeta: Record<CubetaAging, CeldaCubeta>;
}

export interface FilaCartera {
  id: number;
  numero: string;
  cliente: string;
  sede: string;
  fechaEmision: Date;
  fechaVencimiento: Date;
  moneda: string;
  valorTotal: number;
  saldo: number;
  dias: number;
  cubeta: CubetaAging;
  estado: string;
}

/** Facturas "abiertas": con saldo pendiente y no canceladas. */
function whereAbiertas(usuario: UsuarioConRol, alcance: Alcance) {
  return {
    ...filtroFacturas(usuario, alcance),
    estado: { not: "cancelada" as const },
    saldo: { gt: 0 },
  };
}

function celdasVacias(): Record<CubetaAging, CeldaCubeta> {
  return {
    d1_30: { monto: 0, cantidad: 0 },
    d31_60: { monto: 0, cantidad: 0 },
    d61_90: { monto: 0, cantidad: 0 },
    d91_120: { monto: 0, cantidad: 0 },
    mas120: { monto: 0, cantidad: 0 },
  };
}

/**
 * Resumen de cartera (totales + aging) respetando el alcance.
 * El aging se calcula en la app porque depende de la fecha de corte.
 */
export async function resumenCartera(
  usuario: UsuarioConRol,
  alcance: Alcance,
  corte: Date = new Date(),
): Promise<ResumenCartera> {
  const facturas = await prisma.facturaVenta.findMany({
    where: whereAbiertas(usuario, alcance),
    select: { saldo: true, fechaVencimiento: true },
  });

  const porCubeta = celdasVacias();
  let total = 0;
  let vencido = 0;

  for (const f of facturas) {
    const saldo = f.saldo.toNumber();
    total += saldo;
    if (estaVencida(f.fechaVencimiento, corte)) vencido += saldo;
    const cubeta = cubetaFactura(f.fechaVencimiento, corte);
    porCubeta[cubeta].monto += saldo;
    porCubeta[cubeta].cantidad += 1;
  }

  return { total, vencido, cantidadFacturas: facturas.length, porCubeta };
}

export interface FiltrosCartera {
  cubeta?: CubetaAging;
  categoria?: string;
  q?: string;
  limite?: number;
}

/** Listado detallado de facturas abiertas (para la pantalla de cartera). */
export async function listarFacturas(
  usuario: UsuarioConRol,
  alcance: Alcance,
  filtros: FiltrosCartera = {},
  corte: Date = new Date(),
): Promise<FilaCartera[]> {
  const busqueda = filtros.q?.trim();
  const facturas = await prisma.facturaVenta.findMany({
    where: {
      ...whereAbiertas(usuario, alcance),
      ...(busqueda
        ? {
            OR: [
              { numero: { contains: busqueda, mode: "insensitive" } },
              { tercero: { is: { nombre: { contains: busqueda, mode: "insensitive" } } } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      numero: true,
      moneda: true,
      valorTotal: true,
      saldo: true,
      fechaEmision: true,
      fechaVencimiento: true,
      estado: true,
      tercero: { select: { nombre: true } },
      sede: { select: { nombre: true } },
    },
    orderBy: { fechaVencimiento: "asc" },
    take: filtros.limite ?? 500,
  });

  const filas = facturas.map((f): FilaCartera => {
    const dias = diasVencido(f.fechaVencimiento, corte);
    return {
      id: f.id,
      numero: f.numero,
      cliente: f.tercero.nombre,
      sede: f.sede.nombre,
      fechaEmision: f.fechaEmision,
      fechaVencimiento: f.fechaVencimiento,
      moneda: f.moneda,
      valorTotal: f.valorTotal.toNumber(),
      saldo: f.saldo.toNumber(),
      dias,
      cubeta: cubetaDe(dias),
      estado: f.estado,
    };
  });

  return filtros.cubeta ? filas.filter((f) => f.cubeta === filtros.cubeta) : filas;
}

/** Top clientes por saldo de cartera (para el dashboard). */
export interface FilaTopCliente {
  cliente: string;
  categoria: string | null;
  saldo: number;
  vencido: number;
  diasPromedio: number;
}

export async function topClientes(
  usuario: UsuarioConRol,
  alcance: Alcance,
  limite = 10,
  corte: Date = new Date(),
): Promise<FilaTopCliente[]> {
  const facturas = await prisma.facturaVenta.findMany({
    where: whereAbiertas(usuario, alcance),
    select: {
      saldo: true,
      fechaVencimiento: true,
      terceroId: true,
      tercero: {
        select: { nombre: true, clientePerfil: { select: { categoria: true } } },
      },
    },
  });

  const mapa = new Map<
    number,
    { cliente: string; categoria: string | null; saldo: number; vencido: number; diasPonderados: number }
  >();

  for (const f of facturas) {
    const saldo = f.saldo.toNumber();
    const dias = Math.max(0, diasVencido(f.fechaVencimiento, corte));
    const actual = mapa.get(f.terceroId) ?? {
      cliente: f.tercero.nombre,
      categoria: f.tercero.clientePerfil?.categoria ?? null,
      saldo: 0,
      vencido: 0,
      diasPonderados: 0,
    };
    actual.saldo += saldo;
    if (estaVencida(f.fechaVencimiento, corte)) actual.vencido += saldo;
    actual.diasPonderados += dias * saldo;
    mapa.set(f.terceroId, actual);
  }

  return [...mapa.values()]
    .map((c) => ({
      cliente: c.cliente,
      categoria: c.categoria,
      saldo: c.saldo,
      vencido: c.vencido,
      diasPromedio: c.saldo > 0 ? Math.round(c.diasPonderados / c.saldo) : 0,
    }))
    .sort((a, b) => b.saldo - a.saldo)
    .slice(0, limite);
}
