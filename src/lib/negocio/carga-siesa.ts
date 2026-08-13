// ==========================================================
// Persistencia de la carga de S1ESA (módulo PENDIENTES) para el formulario.
// Estrategia por dataset (según cómo la auxiliar descarga de S1ESA):
//   · pendientes  → REEMPLAZO TOTAL (foto del día).
//   · gastos      → REEMPLAZA solo los MESES que trae el archivo (mes actual).
//   · facturacion → AGREGA solo documentos NUEVOS (no toca el histórico).
//   · anuladas    → AGREGA solo documentos NUEVOS.
// El parseo vive en importar-siesa-pendientes.ts (compartido con el CLI).
// El CLI db:pendientes hace reemplazo total (carga inicial / reseteo).
// Ver la ruta pública: src/app/api/cargar/route.ts
// ==========================================================
import "server-only";
import { prisma } from "@/lib/db";
import { DATASETS, parseDataset, type DatasetKey } from "./importar-siesa-pendientes";

export { DATASETS, type DatasetKey };

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

export interface ArchivoEntrada { clave: DatasetKey; nombre: string; buffer: Buffer; }

/** Procesa los archivos recibidos según su estrategia y deja bitácora. */
export async function procesarCarga(archivos: ArchivoEntrada[], origenIp?: string): Promise<ResultadoCarga> {
  const res: ResultadoCarga = { ok: true, datasets: {}, errores: [] };
  const titulo = (k: DatasetKey) => DATASETS.find((d) => d.clave === k)!.titulo;

  for (const a of archivos) {
    try {
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
