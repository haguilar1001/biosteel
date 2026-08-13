// ==========================================================
// Persistencia de la carga de S1ESA (módulo PENDIENTES) para el formulario.
// Cada dataset se REEMPLAZA por completo (la descarga es histórica completa).
// El parseo vive en importar-siesa.ts (puro, compartido con el CLI db:pendientes).
// Ver la ruta pública: src/app/api/cargar/route.ts
// ==========================================================
import "server-only";
import { prisma } from "@/lib/db";
import { DATASETS, parseDataset, type DatasetKey } from "./importar-siesa-pendientes";

export { DATASETS, type DatasetKey };

export interface ResultadoDataset { titulo: string; archivo: string; hoja: string; filas: number; omitidas: number; }
export interface ResultadoCarga { ok: boolean; datasets: Partial<Record<DatasetKey, ResultadoDataset>>; errores: string[]; }

const BATCH = 5000;

async function reemplazar(clave: DatasetKey, rows: Record<string, unknown>[]) {
  if (clave === "facturacion") {
    await prisma.facturacionDoc.deleteMany({});
    for (let i = 0; i < rows.length; i += BATCH) await prisma.facturacionDoc.createMany({ data: rows.slice(i, i + BATCH) as never });
  } else if (clave === "gastos") {
    await prisma.gastoDoc.deleteMany({});
    for (let i = 0; i < rows.length; i += BATCH) await prisma.gastoDoc.createMany({ data: rows.slice(i, i + BATCH) as never });
  } else if (clave === "anuladas") {
    await prisma.facturaAnulada.deleteMany({});
    for (let i = 0; i < rows.length; i += BATCH) await prisma.facturaAnulada.createMany({ data: rows.slice(i, i + BATCH) as never });
  } else {
    await prisma.pedidoPendiente.deleteMany({});
    for (let i = 0; i < rows.length; i += BATCH) await prisma.pedidoPendiente.createMany({ data: rows.slice(i, i + BATCH) as never });
  }
}

export interface ArchivoEntrada { clave: DatasetKey; nombre: string; buffer: Buffer; }

/** Procesa los archivos recibidos, reemplaza cada dataset y deja bitácora. */
export async function procesarCarga(archivos: ArchivoEntrada[], origenIp?: string): Promise<ResultadoCarga> {
  const res: ResultadoCarga = { ok: true, datasets: {}, errores: [] };
  const titulo = (k: DatasetKey) => DATASETS.find((d) => d.clave === k)!.titulo;

  for (const a of archivos) {
    try {
      const parsed = parseDataset(a.clave, a.buffer);
      await reemplazar(a.clave, parsed.rows);
      res.datasets[a.clave] = { titulo: titulo(a.clave), archivo: a.nombre, hoja: parsed.hoja, filas: parsed.rows.length, omitidas: parsed.omitidas };
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
