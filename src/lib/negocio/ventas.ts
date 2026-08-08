// ==========================================================
// Ventas (fuente: reporte de ventas pre-agregado — ver set-ventas.ts).
//   VentaLinea   = venta neta + costo por línea × mes
//   VentaCliente = venta neta + costo por cliente × mes
// Venta neta = Σ(Valor subtotal local) − Σ(NOTA_CREDITO). Costo = Σ(Costo prom. total).
// (Coincide con el Power BI.)
// ==========================================================
import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export interface FilaLinea {
  linea: string;
  valor: number; // venta neta
  costo: number;
}

/** Venta por línea (opcionalmente filtrada a un conjunto de meses), desc. */
export async function ventaPorLinea(anio: number, meses?: number[]): Promise<FilaLinea[]> {
  const where: Prisma.VentaLineaWhereInput = { anio, ...(meses && meses.length ? { mes: { in: meses } } : {}) };
  const grupos = await prisma.ventaLinea.groupBy({ by: ["linea"], where, _sum: { valor: true, costo: true } });
  return grupos
    .map((g) => ({ linea: g.linea, valor: g._sum.valor?.toNumber() ?? 0, costo: g._sum.costo?.toNumber() ?? 0 }))
    .sort((a, b) => b.valor - a.valor);
}

/** Venta neta total del período. */
export async function ventaTotal(anio: number, meses?: number[]): Promise<number> {
  const where: Prisma.VentaLineaWhereInput = { anio, ...(meses && meses.length ? { mes: { in: meses } } : {}) };
  const agg = await prisma.ventaLinea.aggregate({ where, _sum: { valor: true } });
  return agg._sum.valor?.toNumber() ?? 0;
}

/** Venta neta total por mes (para tendencias / sparkline). Devuelve [mes]=valor. */
export async function ventaMensual(anio: number): Promise<Map<number, number>> {
  const grupos = await prisma.ventaLinea.groupBy({ by: ["mes"], where: { anio }, _sum: { valor: true } });
  const m = new Map<number, number>();
  for (const g of grupos) m.set(g.mes, g._sum.valor?.toNumber() ?? 0);
  return m;
}

export interface MesVenta { mes: number; venta: number; costo: number }

/** Venta neta y costo por mes (1–12) del año. Rellena meses sin datos con 0. */
export async function ventaMensualDetalle(anio: number): Promise<MesVenta[]> {
  const grupos = await prisma.ventaLinea.groupBy({ by: ["mes"], where: { anio }, _sum: { valor: true, costo: true } });
  const map = new Map(grupos.map((g) => [g.mes, { venta: g._sum.valor?.toNumber() ?? 0, costo: g._sum.costo?.toNumber() ?? 0 }]));
  return Array.from({ length: 12 }, (_, i) => {
    const mes = i + 1;
    const e = map.get(mes) ?? { venta: 0, costo: 0 };
    return { mes, venta: e.venta, costo: e.costo };
  });
}

export interface ResumenAnual { venta: number; costo: number; utilidad: number; margen: number }

/** KPIs del año: venta neta, costo, utilidad y % utilidad. */
export async function resumenAnual(anio: number): Promise<ResumenAnual> {
  const agg = await prisma.ventaLinea.aggregate({ where: { anio }, _sum: { valor: true, costo: true } });
  const venta = agg._sum.valor?.toNumber() ?? 0;
  const costo = agg._sum.costo?.toNumber() ?? 0;
  const utilidad = venta - costo;
  return { venta, costo, utilidad, margen: venta > 0 ? (utilidad / venta) * 100 : 0 };
}

/** Años con ventas cargadas, ascendente. */
export async function aniosConVenta(): Promise<number[]> {
  const grupos = await prisma.ventaLinea.groupBy({ by: ["anio"], _sum: { valor: true } });
  return grupos.map((g) => g.anio).sort((a, b) => a - b);
}

/** Meses (1–12) que tienen ventas cargadas. */
export async function mesesConVenta(anio: number): Promise<number[]> {
  const grupos = await prisma.ventaLinea.groupBy({ by: ["mes"], where: { anio }, _sum: { valor: true } });
  return grupos.map((g) => g.mes).sort((a, b) => a - b);
}

export interface FilaClienteVenta {
  clienteNombre: string;
  nit: string | null;
  valor: number; // venta neta
  costo: number;
}

/** Venta por cliente para el/los mes(es) dados, desc. */
export async function ventaPorCliente(anio: number, meses?: number[]): Promise<FilaClienteVenta[]> {
  const where: Prisma.VentaClienteWhereInput = { anio, ...(meses && meses.length ? { mes: { in: meses } } : {}) };
  const grupos = await prisma.ventaCliente.groupBy({ by: ["clienteNombre"], where, _sum: { valor: true, costo: true } });
  const conNit = await prisma.ventaCliente.groupBy({ by: ["clienteNombre", "nit"], where, _sum: { valor: true } });
  const nitPorNombre = new Map<string, string>();
  for (const g of conNit) if (g.nit && !nitPorNombre.has(g.clienteNombre)) nitPorNombre.set(g.clienteNombre, g.nit);

  return grupos
    .map((g) => ({ clienteNombre: g.clienteNombre, nit: nitPorNombre.get(g.clienteNombre) ?? null, valor: g._sum.valor?.toNumber() ?? 0, costo: g._sum.costo?.toNumber() ?? 0 }))
    .sort((a, b) => b.valor - a.valor);
}
