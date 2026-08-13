// ==========================================================
// Escribe los agregados de venta neta a la BD desde renglones (FilaVenta):
// VentaLinea / VentaCliente / VentaMarca / VentaMarcaIps (mensuales, con
// ajustes manuales) + VentaDia (venta neta por día, sin ajustes).
// Módulo PURO (acepta el PrismaClient): lo usan el CLI (prisma/set-ventas) y la
// carga por formulario (carga-siesa), para que VentaLinea salga IDÉNTICO en
// ambos caminos (misma agregarVentas).
// ==========================================================
import type { PrismaClient } from "@prisma/client";
import { agregarVentas, type FilaVenta } from "./importar-ventas";
import { nroClave, type ParamNC } from "./nota-credito";

const BATCH = 5000;
const r2 = (v: number) => Math.round(v * 100) / 100;

async function crearEnLotes<T>(rows: T[], fn: (chunk: T[]) => Promise<unknown>) {
  for (let i = 0; i < rows.length; i += BATCH) await fn(rows.slice(i, i + BATCH));
}

export interface ResultadoRecalculo { netoPorAnio: Map<number, number>; totalNC: number; anios: number[]; }

/** Recalcula y escribe todos los agregados de venta desde los renglones dados. */
export async function escribirAgregados(prisma: PrismaClient, filas: FilaVenta[]): Promise<ResultadoRecalculo> {
  const [pRows, xRows, ajustes] = await Promise.all([
    prisma.parametroNotaCredito.findMany(),
    prisma.exclusionNC.findMany({ where: { concepto: "TODOS" } }),
    prisma.ajusteVenta.findMany(),
  ]);
  const params: ParamNC[] = pRows.map((p) => ({ ips: p.ips, concepto: p.concepto, pct: p.pct.toNumber(), ini: p.fechaInicio.getTime(), fin: p.fechaFin.getTime() }));
  const excluidos = new Set(xRows.map((x) => nroClave(x.nroDocumento)));

  const agg = agregarVentas(filas, params, excluidos);

  // Ajustes manuales (mensuales) como línea sintética por concepto (igual que el CLI).
  const lineas = [...agg.porLinea];
  const clientes = [...agg.porCliente];
  const marcas = [...agg.porMarca];
  const marcaIps = [...agg.porMarcaIps];
  const anios = [...agg.anios];
  for (const aj of ajustes) {
    const v = aj.valor.toNumber(); const c = aj.concepto;
    agg.netoPorAnio.set(aj.anio, (agg.netoPorAnio.get(aj.anio) ?? 0) + v);
    lineas.push({ anio: aj.anio, mes: aj.mes, linea: c, valor: v, costo: 0 });
    clientes.push({ anio: aj.anio, mes: aj.mes, clienteNombre: c, nit: null, valor: v, costo: 0 });
    marcas.push({ anio: aj.anio, mes: aj.mes, marca: c, valor: v, costo: 0 });
    marcaIps.push({ anio: aj.anio, mes: aj.mes, marca: c, ips: c, valor: v, costo: 0 });
    if (!anios.includes(aj.anio)) anios.push(aj.anio);
  }

  // Mensuales: delete+recreate por año.
  for (const anio of anios.sort((a, b) => a - b)) {
    const L = lineas.filter((e) => e.anio === anio);
    const C = clientes.filter((e) => e.anio === anio);
    const M = marcas.filter((e) => e.anio === anio);
    const MI = marcaIps.filter((e) => e.anio === anio);
    await prisma.$transaction([
      prisma.ventaLinea.deleteMany({ where: { anio } }),
      prisma.ventaCliente.deleteMany({ where: { anio } }),
      prisma.ventaMarca.deleteMany({ where: { anio } }),
      prisma.ventaMarcaIps.deleteMany({ where: { anio } }),
    ]);
    await crearEnLotes(L, (c) => prisma.ventaLinea.createMany({ data: c.map((e) => ({ anio: e.anio, mes: e.mes, linea: e.linea, valor: r2(e.valor), costo: r2(e.costo) })) }));
    await crearEnLotes(C, (c) => prisma.ventaCliente.createMany({ data: c.map((e) => ({ anio: e.anio, mes: e.mes, clienteNombre: e.clienteNombre, nit: e.nit, valor: r2(e.valor), costo: r2(e.costo) })) }));
    await crearEnLotes(M, (c) => prisma.ventaMarca.createMany({ data: c.map((e) => ({ anio: e.anio, mes: e.mes, marca: e.marca, valor: r2(e.valor), costo: r2(e.costo) })) }));
    await crearEnLotes(MI, (c) => prisma.ventaMarcaIps.createMany({ data: c.map((e) => ({ anio: e.anio, mes: e.mes, marca: e.marca, ips: e.ips, valor: r2(e.valor), costo: r2(e.costo) })) }));
  }

  // Venta neta por día: reemplazo total (sin ajustes mensuales).
  await prisma.ventaDia.deleteMany({});
  await crearEnLotes(agg.porDia, (c) => prisma.ventaDia.createMany({ data: c.map((e) => ({ anio: e.anio, mes: e.mes, dia: e.dia, valor: r2(e.valor), costo: r2(e.costo) })) }));

  return { netoPorAnio: agg.netoPorAnio, totalNC: agg.totalNC, anios };
}

/** Convierte una fila de VentaDoc (BD) a FilaVenta para recalcular. */
export function docABitVenta(d: {
  nro: string; tipo: string; aprobada: boolean; fecha: Date; anio: number; mes: number;
  ips: string | null; suc: string; bod: string; notas: string; conv: string; proc: string;
  linea: string; subtotal: { toNumber(): number }; fbd: string | null; costo: { toNumber(): number };
  cliente: string; nit: string | null; marca: string;
}): FilaVenta {
  return {
    nro: d.nro, tipo: d.tipo, aprobada: d.aprobada, ms: d.fecha.getTime(), anio: d.anio, mes: d.mes,
    ips: d.ips, suc: d.suc, bod: d.bod, notas: d.notas, conv: d.conv, proc: d.proc, linea: d.linea,
    subtotal: d.subtotal.toNumber(), fbd: d.fbd ?? undefined, costo: d.costo.toNumber(),
    cliente: d.cliente, nit: d.nit, marca: d.marca,
  };
}
