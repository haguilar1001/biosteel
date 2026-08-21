// ==========================================================
// Historial de cargas: normaliza los registros de CargaSiesa (cargas manuales
// del formulario in-app y la sincronización automática del flujo) en un
// formato uniforme para mostrar en pantalla.
// ==========================================================
import "server-only";
import { prisma } from "@/lib/db";

export interface DatasetHistorial {
  titulo: string;
  archivo?: string;
  filas: number;
  cargadas: number;
  estrategia?: string;
}

export interface ItemHistorial {
  id: number;
  fecha: Date;
  ok: boolean;
  automatico: boolean;      // true = cron (sin usuario)
  usuario: string | null;   // quién la subió (null si automática)
  datasets: DatasetHistorial[];
  mensaje: string | null;
}

interface DatasetRaw { titulo?: string; archivo?: string; filas?: number; cargadas?: number; estrategia?: string }

function normalizar(id: number, fecha: Date, ok: boolean, mensaje: string | null, resumen: unknown): ItemHistorial {
  const r = (resumen ?? {}) as Record<string, unknown>;
  const usuario = typeof r.usuario === "string" ? r.usuario : null;

  // Caso 1: sincronización de flujo (cron) → { flujo: {...} }
  if (r.flujo && typeof r.flujo === "object") {
    const f = r.flujo as { movimientos?: number; anios?: number[] };
    return {
      id, fecha, ok, automatico: !usuario, usuario, mensaje,
      datasets: [{
        titulo: "Ingresos y Egresos",
        filas: f.movimientos ?? 0,
        cargadas: f.movimientos ?? 0,
        estrategia: f.anios?.length ? `año(s) ${f.anios.join(", ")}` : undefined,
      }],
    };
  }

  // Caso 2: carga(s) con { datasets: { clave: {...} } }
  const dsObj = (r.datasets ?? {}) as Record<string, DatasetRaw>;
  const datasets: DatasetHistorial[] = Object.values(dsObj).map((d) => ({
    titulo: d.titulo ?? "Archivo",
    archivo: d.archivo,
    filas: d.filas ?? 0,
    cargadas: d.cargadas ?? 0,
    estrategia: d.estrategia,
  }));
  // Carga fallida: no hay datasets pero sí un título/archivo en el resumen.
  if (datasets.length === 0 && typeof r.dataset === "string") {
    datasets.push({ titulo: r.dataset, archivo: typeof r.archivo === "string" ? r.archivo : undefined, filas: 0, cargadas: 0 });
  }
  return { id, fecha, ok, automatico: !usuario, usuario, datasets, mensaje };
}

/** Últimas N cargas (manuales + automáticas), más recientes primero. */
export async function listarHistorialCargas(limite = 40): Promise<ItemHistorial[]> {
  const rows = await prisma.cargaSiesa.findMany({ orderBy: { cargadaEn: "desc" }, take: limite });
  return rows.map((r) => normalizar(r.id, r.cargadaEn, r.ok, r.mensaje, r.resumen));
}

// ---------- Última carga por dataset ----------

export interface UltimaCarga {
  /** Cuándo se cargó por última vez con éxito. */
  fecha: Date;
  /** Quién la subió; null = la hizo el cron (sincronización automática). */
  usuario: string | null;
}

/**
 * Fecha y autor de la última carga EXITOSA de cada dataset, para mostrarlo
 * junto a su casilla en /cargar. Sin esto no hay forma de saber si un archivo
 * está al día o lleva meses sin actualizarse.
 *
 * Las cargas manuales guardan `{ datasets: { clave: … }, usuario }` y el cron
 * del flujo guarda `{ flujo: … }` sin usuario, así que hay que mirar las dos
 * formas: si no, "Ingresos y Egresos" saldría como nunca cargado aunque el
 * cron lo actualice dos veces al día.
 */
export async function ultimaCargaPorDataset(): Promise<Map<string, UltimaCarga>> {
  const filas = await prisma.$queryRaw<{ clave: string; fecha: Date; usuario: string | null }[]>`
    WITH expandidas AS (
      SELECT "cargadaEn" AS fecha, "resumen"->>'usuario' AS usuario,
             jsonb_object_keys("resumen"->'datasets') AS clave
      FROM "CargaSiesa"
      WHERE "ok" = true AND jsonb_typeof("resumen"->'datasets') = 'object'
      UNION ALL
      SELECT "cargadaEn", "resumen"->>'usuario', 'flujo'
      FROM "CargaSiesa"
      WHERE "ok" = true AND jsonb_typeof("resumen"->'flujo') = 'object'
    )
    SELECT DISTINCT ON (clave) clave, fecha, usuario
    FROM expandidas ORDER BY clave, fecha DESC`;
  return new Map(filas.map((f) => [f.clave, { fecha: f.fecha, usuario: f.usuario }]));
}
