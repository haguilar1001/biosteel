// ==========================================================
// Persistencia de la carga de S1ESA (módulo PENDIENTES) para el formulario.
// Estrategia por dataset (según cómo la auxiliar descarga de S1ESA):
//   · pendientes  → REEMPLAZO TOTAL (foto del día).
//   · gastos      → REEMPLAZA solo los MESES que trae el archivo (mes actual).
//   · facturacion → AGREGA solo documentos NUEVOS (no toca el histórico).
//   · anuladas    → AGREGA solo documentos NUEVOS.
//   · ventas      → AGREGA las fechas nuevas del archivo "2026" (reemplazo por
//                   fecha) y RECALCULA la venta neta sobre todo VentaDoc.
// El parseo vive en importar-siesa-pendientes.ts (compartido con el CLI).
// El CLI db:pendientes hace reemplazo total (carga inicial / reseteo).
// Ver la ruta pública: src/app/api/cargar/route.ts
// ==========================================================
import "server-only";
import { prisma } from "@/lib/db";
import { DATASETS, parseDataset, type DatasetKey } from "./importar-siesa-pendientes";
import { leerRenglones, type FilaVenta } from "./importar-ventas";
import { escribirAgregados, docABitVenta } from "./escribir-ventas";

export { DATASETS, type DatasetKey };

const r2 = (v: number) => Math.round(v * 100) / 100;

export interface ResultadoDataset {
  titulo: string;
  archivo: string;
  hoja: string;
  filas: number;      // filas leídas del archivo
  cargadas: number;   // filas realmente escritas (nuevas o reemplazadas)
  omitidas: number;
  estrategia: string; // texto para el usuario
}
export interface ResultadoCarga { ok: boolean; datasets: Partial<Record<DatasetKey, ResultadoDataset>>; errores: string[]; }

const BATCH = 5000;

async function insertar(createMany: (data: unknown[]) => Promise<unknown>, rows: Record<string, unknown>[]) {
  for (let i = 0; i < rows.length; i += BATCH) await createMany(rows.slice(i, i + BATCH));
}

interface Persistencia { cargadas: number; estrategia: string; }

async function persistir(clave: DatasetKey, rows: Record<string, unknown>[]): Promise<Persistencia> {
  if (clave === "pendientes") {
    await prisma.pedidoPendiente.deleteMany({});
    await insertar((d) => prisma.pedidoPendiente.createMany({ data: d as never }), rows);
    return { cargadas: rows.length, estrategia: "reemplazo total (foto del día)" };
  }

  if (clave === "gastos") {
    // Reemplaza solo los (año, mes) presentes en el archivo.
    const pares = new Map<string, { anio: number; mes: number }>();
    for (const r of rows) pares.set(`${r.anio}-${r.mes}`, { anio: r.anio as number, mes: r.mes as number });
    const meses = [...pares.values()];
    if (meses.length) await prisma.gastoDoc.deleteMany({ where: { OR: meses } });
    await insertar((d) => prisma.gastoDoc.createMany({ data: d as never }), rows);
    const etiqueta = meses.length <= 3 ? meses.map((m) => `${m.mes}/${m.anio}`).join(", ") : `${meses.length} meses`;
    return { cargadas: rows.length, estrategia: `reemplaza mes(es): ${etiqueta}` };
  }

  // facturacion / anuladas → agregar solo documentos nuevos (por Nro documento).
  if (clave === "facturacion") {
    const existentes = new Set((await prisma.facturacionDoc.findMany({ select: { nroDocumento: true } })).map((x) => x.nroDocumento));
    const nuevos = rows.filter((r) => !existentes.has(r.nroDocumento as string));
    await insertar((d) => prisma.facturacionDoc.createMany({ data: d as never }), nuevos);
    return { cargadas: nuevos.length, estrategia: `${nuevos.length} documento(s) nuevo(s)` };
  }
  const existentes = new Set((await prisma.facturaAnulada.findMany({ select: { nroDocumento: true } })).map((x) => x.nroDocumento));
  const nuevos = rows.filter((r) => !existentes.has(r.nroDocumento as string));
  await insertar((d) => prisma.facturaAnulada.createMany({ data: d as never }), nuevos);
  return { cargadas: nuevos.length, estrategia: `${nuevos.length} documento(s) nuevo(s)` };
}

// ventas → reemplaza los renglones de las FECHAS presentes en el archivo y
// recalcula la venta neta (VentaLinea/Cliente/Marca/Dia) desde TODO VentaDoc.
async function persistirVentas(filas: FilaVenta[]): Promise<Persistencia> {
  const fechas = [...new Map(filas.map((f) => [f.ms, new Date(f.ms)])).values()];
  if (fechas.length) await prisma.ventaDoc.deleteMany({ where: { fecha: { in: fechas } } });
  const docs = filas.map((f) => ({
    nro: f.nro, tipo: f.tipo, aprobada: f.aprobada, fecha: new Date(f.ms), anio: f.anio, mes: f.mes, dia: new Date(f.ms).getUTCDate(),
    ips: f.ips, suc: f.suc, bod: f.bod, notas: f.notas, conv: f.conv, proc: f.proc, linea: f.linea,
    subtotal: r2(f.subtotal), fbd: f.fbd ?? null, costo: r2(f.costo), cliente: f.cliente, nit: f.nit, marca: f.marca,
  }));
  await insertar((d) => prisma.ventaDoc.createMany({ data: d as never }), docs);
  const todos = await prisma.ventaDoc.findMany();
  await escribirAgregados(prisma, todos.map(docABitVenta));
  return { cargadas: filas.length, estrategia: `${fechas.length} fecha(s) nueva(s)/actualizada(s); venta neta recalculada sobre ${todos.length} renglones` };
}

export interface ArchivoEntrada { clave: DatasetKey; nombre: string; buffer: Buffer; }

/** Procesa los archivos recibidos según su estrategia y deja bitácora. */
export async function procesarCarga(archivos: ArchivoEntrada[], origenIp?: string): Promise<ResultadoCarga> {
  const res: ResultadoCarga = { ok: true, datasets: {}, errores: [] };
  const titulo = (k: DatasetKey) => DATASETS.find((d) => d.clave === k)!.titulo;

  for (const a of archivos) {
    try {
      if (a.clave === "ventas") {
        const { filas, sinFecha, hoja } = leerRenglones(a.buffer);
        const { cargadas, estrategia } = await persistirVentas(filas);
        res.datasets[a.clave] = { titulo: titulo(a.clave), archivo: a.nombre, hoja, filas: filas.length, cargadas, omitidas: sinFecha, estrategia };
        continue;
      }
      const parsed = parseDataset(a.clave, a.buffer);
      const { cargadas, estrategia } = await persistir(a.clave, parsed.rows);
      res.datasets[a.clave] = { titulo: titulo(a.clave), archivo: a.nombre, hoja: parsed.hoja, filas: parsed.rows.length, cargadas, omitidas: parsed.omitidas, estrategia };
    } catch (e) {
      res.ok = false;
      const msg = e instanceof Error ? e.message : "error";
      res.errores.push(`${titulo(a.clave)} (${a.nombre}): ${msg}`);
    }
  }

  await prisma.cargaSiesa.create({
    data: { ok: res.ok, resumen: res as unknown as object, mensaje: res.errores.join(" · ") || null, origenIp: origenIp ?? null },
  });
  return res;
}
