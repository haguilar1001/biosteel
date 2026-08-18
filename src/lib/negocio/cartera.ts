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
  periodo: { anio?: number; mes?: number } = {},
): Promise<ResumenCartera> {
  const todas = await prisma.facturaVenta.findMany({
    where: { ...whereConSaldo(usuario, alcance), ...filtroPeriodo(periodo.anio, periodo.mes) },
    select: { saldo: true, fechaVencimiento: true },
  });
  const facturas = enMes(todas, periodo.anio, periodo.mes);

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
  anio?: number;
  mes?: number;
}

/**
 * Rango por fecha de VENCIMIENTO de la factura. Sin año ni mes no filtra nada
 * (cartera completa: el comportamiento por defecto de la vista).
 * Con mes y sin año el filtro se aplica en memoria (ver enMes).
 */
function filtroPeriodo(anio?: number, mes?: number): Prisma.FacturaVentaWhereInput {
  if (!anio) return {};
  const desde = mes ? new Date(Date.UTC(anio, mes - 1, 1)) : new Date(Date.UTC(anio, 0, 1));
  const hasta = mes ? new Date(Date.UTC(anio, mes, 1)) : new Date(Date.UTC(anio + 1, 0, 1));
  return { fechaVencimiento: { gte: desde, lt: hasta } };
}

/** Mes suelto (sin año): Prisma no filtra por parte de fecha, se hace aquí. */
function enMes<T extends { fechaVencimiento: Date }>(filas: T[], anio?: number, mes?: number): T[] {
  if (!mes || anio) return filas;
  return filas.filter((f) => f.fechaVencimiento.getUTCMonth() + 1 === mes);
}

/** Años de vencimiento presentes en cartera (para el selector de la vista). */
export async function aniosCartera(usuario: UsuarioConRol, alcance: Alcance): Promise<number[]> {
  const facturas = await prisma.facturaVenta.findMany({
    where: whereConSaldo(usuario, alcance),
    select: { fechaVencimiento: true },
  });
  return [...new Set(facturas.map((f) => f.fechaVencimiento.getUTCFullYear()))].sort((a, b) => b - a);
}

export async function listarFacturas(
  usuario: UsuarioConRol,
  alcance: Alcance,
  filtros: FiltrosCartera = {},
  corte: Date = new Date(),
): Promise<{ filas: FilaCartera[]; total: number; suma: number }> {
  const where: Prisma.FacturaVentaWhereInput = {
    ...whereConSaldo(usuario, alcance),
    ...filtroBusqueda(filtros.q),
    ...filtroPeriodo(filtros.anio, filtros.mes),
  };
  // Con mes suelto (sin año) el corte no se puede delegar a la BD: se traen las
  // facturas del filtro y el total/suma se recalculan sobre las que quedan.
  const mesSuelto = !!filtros.mes && !filtros.anio;
  const [total, agg, facturas] = await Promise.all([
    mesSuelto ? Promise.resolve(0) : prisma.facturaVenta.count({ where }),
    mesSuelto ? Promise.resolve(null) : prisma.facturaVenta.aggregate({ where, _sum: { saldo: true } }),
    prisma.facturaVenta.findMany({
      where,
      select: {
        id: true, numero: true, valorTotal: true, saldo: true, fechaEmision: true,
        fechaVencimiento: true, estado: true, concepto: true,
        tercero: { select: { nombre: true, nit: true } },
      },
      orderBy: { saldo: "desc" },
      ...(mesSuelto ? {} : { take: 300 }),
    }),
  ]);

  let filas = enMes(facturas, filtros.anio, filtros.mes).map((f): FilaCartera => {
    const dias = diasVencido(f.fechaVencimiento, corte);
    return {
      id: f.id, numero: f.numero, cliente: f.tercero.nombre, nit: f.tercero.nit,
      concepto: f.concepto, fechaEmision: f.fechaEmision, fechaVencimiento: f.fechaVencimiento,
      valorTotal: f.valorTotal.toNumber(), saldo: f.saldo.toNumber(), dias, cubeta: cubetaDe(dias),
      estado: f.estado,
    };
  });
  if (filtros.cubeta) filas = filas.filter((f) => f.cubeta === filtros.cubeta && f.saldo > 0);
  if (mesSuelto) {
    const suma = filas.reduce((s, f) => s + f.saldo, 0);
    return { filas: filas.slice(0, 300), total: filas.length, suma };
  }
  return { filas, total, suma: agg!._sum.saldo?.toNumber() ?? 0 };
}

/** Facturas del filtro SIN límite (para exportar a Excel). Respeta el alcance RBAC. */
export async function exportarFacturas(
  usuario: UsuarioConRol,
  alcance: Alcance,
  filtros: FiltrosCartera = {},
  corte: Date = new Date(),
): Promise<FilaCartera[]> {
  const where: Prisma.FacturaVentaWhereInput = {
    ...whereConSaldo(usuario, alcance),
    ...filtroBusqueda(filtros.q),
    ...filtroPeriodo(filtros.anio, filtros.mes),
  };
  const facturas = await prisma.facturaVenta.findMany({
    where,
    select: {
      id: true, numero: true, valorTotal: true, saldo: true, fechaEmision: true,
      fechaVencimiento: true, estado: true, concepto: true,
      tercero: { select: { nombre: true, nit: true } },
    },
    orderBy: { saldo: "desc" },
  });
  let filas = enMes(facturas, filtros.anio, filtros.mes).map((f): FilaCartera => {
    const dias = diasVencido(f.fechaVencimiento, corte);
    return {
      id: f.id, numero: f.numero, cliente: f.tercero.nombre, nit: f.tercero.nit,
      concepto: f.concepto, fechaEmision: f.fechaEmision, fechaVencimiento: f.fechaVencimiento,
      valorTotal: f.valorTotal.toNumber(), saldo: f.saldo.toNumber(), dias, cubeta: cubetaDe(dias),
      estado: f.estado,
    };
  });
  if (filtros.cubeta) filas = filas.filter((f) => f.cubeta === filtros.cubeta && f.saldo > 0);
  return filas;
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

// ---------- Cartera por Ciudad (con desglose por IPS) ----------
export interface IpsEnCiudad {
  cliente: string;
  saldo: number;
  documentos: number;
}
export interface FilaCiudad {
  ciudad: string;
  saldo: number;
  documentos: number;
  clientes: number;
  ips: IpsEnCiudad[];
}

export async function carteraPorCiudad(
  usuario: UsuarioConRol,
  alcance: Alcance,
): Promise<FilaCiudad[]> {
  const facturas = await prisma.facturaVenta.findMany({
    where: whereConSaldo(usuario, alcance),
    select: { saldo: true, terceroId: true, tercero: { select: { nombre: true, ciudad: true } } },
  });

  const ciudades = new Map<string, { saldo: number; documentos: number; porCliente: Map<number, IpsEnCiudad> }>();
  for (const f of facturas) {
    const ciudad = f.tercero.ciudad?.trim() || "Sin ciudad";
    const s = f.saldo.toNumber();
    const c = ciudades.get(ciudad) ?? { saldo: 0, documentos: 0, porCliente: new Map() };
    c.saldo += s;
    c.documentos += 1;
    const ips = c.porCliente.get(f.terceroId) ?? { cliente: f.tercero.nombre, saldo: 0, documentos: 0 };
    ips.saldo += s;
    ips.documentos += 1;
    c.porCliente.set(f.terceroId, ips);
    ciudades.set(ciudad, c);
  }

  return [...ciudades.entries()]
    .map(([ciudad, c]) => ({
      ciudad,
      saldo: c.saldo,
      documentos: c.documentos,
      clientes: c.porCliente.size,
      ips: [...c.porCliente.values()].sort((a, b) => b.saldo - a.saldo),
    }))
    .sort((a, b) => b.saldo - a.saldo);
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
