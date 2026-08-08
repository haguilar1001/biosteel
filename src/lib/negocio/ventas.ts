// ==========================================================
// Ventas (fuente: reporte "Venta por línea" pre-agregado — ver set-ventas.ts).
// VentaLinea = venta neta por línea × mes ; VentaCliente = por cliente × mes.
// "Venta neta" = subtotal local (ya descuenta notas crédito del período).
// ==========================================================
import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export interface FilaLinea {
  linea: string;
  valor: number;
}

/** Venta por línea (opcionalmente filtrada a un conjunto de meses), desc. */
export async function ventaPorLinea(anio: number, meses?: number[]): Promise<FilaLinea[]> {
  const where: Prisma.VentaLineaWhereInput = { anio, ...(meses && meses.length ? { mes: { in: meses } } : {}) };
  const grupos = await prisma.ventaLinea.groupBy({ by: ["linea"], where, _sum: { valor: true } });
  return grupos
    .map((g) => ({ linea: g.linea, valor: g._sum.valor?.toNumber() ?? 0 }))
    .sort((a, b) => b.valor - a.valor);
}

/** Venta total del período (suma de todas las líneas). */
export async function ventaTotal(anio: number, meses?: number[]): Promise<number> {
  const where: Prisma.VentaLineaWhereInput = { anio, ...(meses && meses.length ? { mes: { in: meses } } : {}) };
  const agg = await prisma.ventaLinea.aggregate({ where, _sum: { valor: true } });
  return agg._sum.valor?.toNumber() ?? 0;
}

/** Venta total por mes (para tendencias / sparkline). Devuelve [mes]=valor. */
export async function ventaMensual(anio: number): Promise<Map<number, number>> {
  const grupos = await prisma.ventaLinea.groupBy({ by: ["mes"], where: { anio }, _sum: { valor: true } });
  const m = new Map<number, number>();
  for (const g of grupos) m.set(g.mes, g._sum.valor?.toNumber() ?? 0);
  return m;
}

/** Meses (1–12) que tienen ventas cargadas. */
export async function mesesConVenta(anio: number): Promise<number[]> {
  const grupos = await prisma.ventaLinea.groupBy({ by: ["mes"], where: { anio }, _sum: { valor: true } });
  return grupos.map((g) => g.mes).sort((a, b) => a - b);
}

export interface FilaClienteVenta {
  clienteNombre: string;
  nit: string | null;
  valor: number;
}

/** Venta por cliente para el/los mes(es) dados, desc. */
export async function ventaPorCliente(anio: number, meses?: number[]): Promise<FilaClienteVenta[]> {
  const where: Prisma.VentaClienteWhereInput = { anio, ...(meses && meses.length ? { mes: { in: meses } } : {}) };
  const grupos = await prisma.ventaCliente.groupBy({
    by: ["clienteNombre"],
    where,
    _sum: { valor: true },
  });
  // NIT representativo por nombre.
  const conNit = await prisma.ventaCliente.groupBy({ by: ["clienteNombre", "nit"], where, _sum: { valor: true } });
  const nitPorNombre = new Map<string, string>();
  for (const g of conNit) if (g.nit && !nitPorNombre.has(g.clienteNombre)) nitPorNombre.set(g.clienteNombre, g.nit);

  return grupos
    .map((g) => ({ clienteNombre: g.clienteNombre, nit: nitPorNombre.get(g.clienteNombre) ?? null, valor: g._sum.valor?.toNumber() ?? 0 }))
    .sort((a, b) => b.valor - a.valor);
}
