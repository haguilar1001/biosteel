// ==========================================================
// Consultas del módulo PENDIENTES (pedidos por facturar) — foto del día
// cargada desde S1ESA (modelo PedidoPendiente). "Días corridos" = hoy − fecha.
// Alimenta la pantalla /pendientes (equivalente al tablero "REPORTE DIARIO").
// ==========================================================
import "server-only";
import { prisma } from "@/lib/db";

export interface PendienteRow {
  nroDocumento: string;
  fecha: Date;
  anio: number;
  mes: number;
  ips: string;
  sucursal: string | null;
  subtotal: number;
  convenio: string | null;
  usuario: string | null;
  motivo: string;
  responsable: string | null;
  diasCorridos: number;
}

const MS_DIA = 86_400_000;

/** Todos los pendientes con días corridos calculados a `hoy`. */
export async function listarPendientes(hoy: Date = new Date()): Promise<PendienteRow[]> {
  const rows = await prisma.pedidoPendiente.findMany({ orderBy: { fecha: "asc" } });
  const hoyUTC = Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate());
  return rows.map((r) => ({
    nroDocumento: r.nroDocumento,
    fecha: r.fecha,
    anio: r.anio,
    mes: r.mes,
    ips: r.clienteRazon || "(sin IPS)",
    sucursal: r.sucursal,
    subtotal: r.subtotal.toNumber(),
    convenio: r.convenio,
    usuario: r.usuarioAprobacion,
    motivo: r.motivoPendiente?.trim() || "(sin motivo)",
    responsable: r.responsable,
    diasCorridos: Math.max(0, Math.round((hoyUTC - r.fecha.getTime()) / MS_DIA)),
  }));
}

export interface ResumenPendientes {
  total: number;      // Σ subtotal (total por facturar)
  pedidos: number;    // # de pedidos
  diasProm: number;   // promedio de días corridos
  diasMax: number;    // antigüedad máxima
  ips: number;        // # de IPS distintas
}

export function resumenPendientes(rows: PendienteRow[]): ResumenPendientes {
  const total = rows.reduce((s, r) => s + r.subtotal, 0);
  const dias = rows.reduce((s, r) => s + r.diasCorridos, 0);
  return {
    total,
    pedidos: rows.length,
    diasProm: rows.length ? Math.round(dias / rows.length) : 0,
    diasMax: rows.reduce((m, r) => Math.max(m, r.diasCorridos), 0),
    ips: new Set(rows.map((r) => r.ips)).size,
  };
}

export interface GrupoIps {
  ips: string;
  pedidos: number;
  valor: number;
  diasProm: number;
  diasMax: number;
  detalle: { nroDocumento: string; fecha: Date; subtotal: number; motivo: string; diasCorridos: number }[];
}

/** Pendientes agrupados por IPS (desc por valor), con desglose de pedidos. */
export function pendientesPorIps(rows: PendienteRow[]): GrupoIps[] {
  const map = new Map<string, GrupoIps>();
  for (const r of rows) {
    const g = map.get(r.ips) ?? { ips: r.ips, pedidos: 0, valor: 0, diasProm: 0, diasMax: 0, detalle: [] };
    g.pedidos += 1;
    g.valor += r.subtotal;
    g.diasMax = Math.max(g.diasMax, r.diasCorridos);
    g.detalle.push({ nroDocumento: r.nroDocumento, fecha: r.fecha, subtotal: r.subtotal, motivo: r.motivo, diasCorridos: r.diasCorridos });
    map.set(r.ips, g);
  }
  const arr = [...map.values()];
  for (const g of arr) {
    g.diasProm = g.pedidos ? Math.round(g.detalle.reduce((s, d) => s + d.diasCorridos, 0) / g.pedidos) : 0;
    g.detalle.sort((a, b) => b.diasCorridos - a.diasCorridos);
  }
  return arr.sort((a, b) => b.valor - a.valor);
}

export interface GrupoMotivo { motivo: string; pedidos: number; valor: number; }

/** Pendientes agrupados por motivo (desc por # pedidos, como el tablero). */
export function pendientesPorMotivo(rows: PendienteRow[]): GrupoMotivo[] {
  const map = new Map<string, GrupoMotivo>();
  for (const r of rows) {
    const g = map.get(r.motivo) ?? { motivo: r.motivo, pedidos: 0, valor: 0 };
    g.pedidos += 1;
    g.valor += r.subtotal;
    map.set(r.motivo, g);
  }
  return [...map.values()].sort((a, b) => b.pedidos - a.pedidos);
}

export interface MatrizMes {
  meses: { anio: number; mes: number }[];
  filas: { ips: string; total: number; porMes: Map<string, number> }[]; // clave = `${anio}-${mes}`
  totalPorMes: Map<string, number>;
  totalGeneral: number;
}

/** Matriz IPS × mes (conteo de pedidos), como "Acumulado x mes" del tablero. */
export function pendientesPorMes(rows: PendienteRow[]): MatrizMes {
  const clave = (a: number, m: number) => `${a}-${m}`;
  const mesesSet = new Map<string, { anio: number; mes: number }>();
  const filasMap = new Map<string, { ips: string; total: number; porMes: Map<string, number> }>();
  const totalPorMes = new Map<string, number>();

  for (const r of rows) {
    const k = clave(r.anio, r.mes);
    if (!mesesSet.has(k)) mesesSet.set(k, { anio: r.anio, mes: r.mes });
    const f = filasMap.get(r.ips) ?? { ips: r.ips, total: 0, porMes: new Map() };
    f.total += 1;
    f.porMes.set(k, (f.porMes.get(k) ?? 0) + 1);
    filasMap.set(r.ips, f);
    totalPorMes.set(k, (totalPorMes.get(k) ?? 0) + 1);
  }

  const meses = [...mesesSet.values()].sort((a, b) => a.anio - b.anio || a.mes - b.mes);
  const filas = [...filasMap.values()].sort((a, b) => b.total - a.total);
  return { meses, filas, totalPorMes, totalGeneral: rows.length };
}
