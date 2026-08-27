// ==========================================================
// Consultas de los INDICADORES DE CALIDAD DE COMPRAS (FOR-GC-011).
//
// Dos indicadores que no salen de SIESA: los lleva a mano el Líder de Compras
// en su formato de calidad, y por eso tienen tabla propia (ver
// importar-indicador-compras.ts).
//
//   1. % de órdenes de compra recibidas completas — meta > 85 %
//      Se calcula SIEMPRE como completas/totales, nunca se lee un porcentaje
//      guardado: así el número y sus dos operandos no pueden contradecirse.
//      Ojo con el % del periodo: es la suma de completas sobre la suma de
//      totales, no el promedio de los porcentajes mensuales. Un mes con 40
//      órdenes no pesa lo mismo que uno con 540.
//
//   2. Calificación de proveedores sobre 5,0 en seis criterios.
//      Aquí sí es un promedio simple entre proveedores: cada proveedor cuenta
//      una vez, porque lo que se está midiendo es al proveedor, no al volumen.
// ==========================================================
import "server-only";
import { prisma } from "@/lib/db";
import { CRITERIOS, PUNTAJE_MAXIMO } from "./importar-indicador-compras";

export { CRITERIOS, PUNTAJE_MAXIMO };

export const MES_LARGO = ["", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
export const MES_CORTO = ["", "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

/** Meta del indicador de órdenes completas, en %. */
export const META_ORDENES = 85;

/**
 * Umbral de "proveedor en verde" para la calificación, en %. El formato no
 * fija una meta explícita; 95 % (4,75 de 5,0) es el corte que separa a los que
 * pierden más de un cuarto de punto. Si Calidad define otro, se cambia aquí.
 */
export const META_PROVEEDOR = 95;

const n = (v: unknown): number => (v == null ? 0 : Number(v));

// ---------- 1) Órdenes recibidas completas ----------

export interface MesIndicador {
  mes: number;
  completas: number;
  totales: number;
  /** completas/totales × 100. null si el mes no está diligenciado. */
  pct: number | null;
  cumple: boolean | null;
}

export interface ResumenIndicador {
  meses: MesIndicador[];
  /** Meses efectivamente diligenciados. */
  conDato: number[];
  completas: number;
  totales: number;
  /** % del periodo: Σ completas / Σ totales (ponderado, no promedio simple). */
  pct: number | null;
  mesesEnMeta: number;
  /** Mes con el peor cumplimiento del periodo. */
  peor: MesIndicador | null;
}

export async function aniosConIndicador(): Promise<number[]> {
  const filas = await prisma.indicadorCompraMes.groupBy({ by: ["anio"], orderBy: { anio: "asc" } });
  return filas.map((f) => f.anio);
}

export async function resumenIndicador(anio: number, meses?: number[]): Promise<ResumenIndicador> {
  const filas = await prisma.indicadorCompraMes.findMany({
    where: { anio, ...(meses && meses.length ? { mes: { in: meses } } : {}) },
    orderBy: { mes: "asc" },
  });
  const mapa = new Map(filas.map((f) => [f.mes, f]));

  const todos: MesIndicador[] = Array.from({ length: 12 }, (_, i) => {
    const f = mapa.get(i + 1);
    if (!f || f.ordenesTotales <= 0) {
      return { mes: i + 1, completas: 0, totales: 0, pct: null, cumple: null };
    }
    const pct = (f.ordenesCompletas / f.ordenesTotales) * 100;
    return {
      mes: i + 1, completas: f.ordenesCompletas, totales: f.ordenesTotales,
      pct, cumple: pct > META_ORDENES,
    };
  });

  const conDato = todos.filter((m) => m.pct != null);
  const completas = conDato.reduce((s, m) => s + m.completas, 0);
  const totales = conDato.reduce((s, m) => s + m.totales, 0);
  const peor = conDato.length
    ? conDato.reduce((min, m) => (m.pct! < min.pct! ? m : min))
    : null;

  return {
    meses: todos,
    conDato: conDato.map((m) => m.mes),
    completas, totales,
    pct: totales > 0 ? (completas / totales) * 100 : null,
    mesesEnMeta: conDato.filter((m) => m.cumple).length,
    peor,
  };
}

// ---------- 2) Evaluación de proveedores ----------

export interface FilaProveedorEval {
  proveedor: string;
  /** Meses evaluados dentro del filtro. */
  evaluaciones: number;
  total: number;
  pct: number;
  criterios: Record<string, number>;
  /** true si el proveedor está en la hoja de PROVEEDORES ACTIVOS. */
  enCatalogo: boolean;
}

export interface MesEvaluacion { mes: number; promedio: number; proveedores: number }

export interface ResumenEvaluacion {
  filas: FilaProveedorEval[];
  porMes: MesEvaluacion[];
  mesesConDato: number[];
  /** Promedio simple del % entre proveedores del filtro. */
  promedio: number | null;
  evaluados: number;
  enMeta: number;
  /** Promedio de cada criterio sobre su puntaje máximo observado. */
  porCriterio: { campo: string; label: string; peso: number; promedio: number; maximo: number }[];
  activos: number;
  /** Evaluados que no están en el catálogo de activos. */
  fueraDeCatalogo: string[];
}

export async function mesesConEvaluacion(anio: number): Promise<number[]> {
  const filas = await prisma.evaluacionProveedor.groupBy({
    by: ["mes"], where: { anio }, orderBy: { mes: "asc" },
  });
  return filas.map((f) => f.mes);
}

export async function resumenEvaluacion(anio: number, meses?: number[]): Promise<ResumenEvaluacion> {
  const acota = meses && meses.length ? { mes: { in: meses } } : {};
  const [evals, activos] = await Promise.all([
    prisma.evaluacionProveedor.findMany({ where: { anio, ...acota }, orderBy: [{ proveedor: "asc" }] }),
    prisma.proveedorActivo.findMany({ select: { razonSocial: true } }),
  ]);

  const catalogo = new Set(activos.map((a) => a.razonSocial));

  // Un proveedor evaluado en varios meses se promedia entre sus meses: la
  // tabla habla del proveedor en el periodo, no de una evaluación suelta.
  const porProveedor = new Map<string, { total: number; pct: number; crit: Record<string, number>; n: number }>();
  for (const e of evals) {
    const acc = porProveedor.get(e.proveedor) ?? { total: 0, pct: 0, crit: {}, n: 0 };
    acc.total += n(e.total);
    acc.pct += n(e.pct);
    acc.n += 1;
    for (const c of CRITERIOS) {
      acc.crit[c.campo] = (acc.crit[c.campo] ?? 0) + n((e as unknown as Record<string, unknown>)[c.campo]);
    }
    porProveedor.set(e.proveedor, acc);
  }

  const filas: FilaProveedorEval[] = [...porProveedor.entries()].map(([proveedor, a]) => ({
    proveedor,
    evaluaciones: a.n,
    total: a.total / a.n,
    pct: a.pct / a.n,
    criterios: Object.fromEntries(CRITERIOS.map((c) => [c.campo, (a.crit[c.campo] ?? 0) / a.n])),
    enCatalogo: catalogo.has(proveedor),
  })).sort((x, y) => y.pct - x.pct || x.proveedor.localeCompare(y.proveedor, "es"));

  // Promedio por mes: cada mes vale por sí mismo, sin importar el filtro.
  const mesMap = new Map<number, { suma: number; n: number }>();
  for (const e of evals) {
    const acc = mesMap.get(e.mes) ?? { suma: 0, n: 0 };
    acc.suma += n(e.pct); acc.n += 1;
    mesMap.set(e.mes, acc);
  }
  const porMes = [...mesMap.entries()]
    .map(([mes, a]) => ({ mes, promedio: a.suma / a.n, proveedores: a.n }))
    .sort((a, b) => a.mes - b.mes);

  // Promedio de cada criterio, con el máximo realmente observado como techo:
  // el formato no publica el tope por criterio y deducirlo de los datos es
  // más honesto que inventarse una escala.
  const porCriterio = CRITERIOS.map((c) => {
    const vals = evals.map((e) => n((e as unknown as Record<string, unknown>)[c.campo]));
    return {
      campo: c.campo, label: c.label, peso: c.peso,
      promedio: vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0,
      maximo: vals.length ? Math.max(...vals) : 0,
    };
  });

  return {
    filas, porMes,
    mesesConDato: porMes.map((m) => m.mes),
    promedio: filas.length ? filas.reduce((s, f) => s + f.pct, 0) / filas.length : null,
    evaluados: filas.length,
    enMeta: filas.filter((f) => f.pct >= META_PROVEEDOR).length,
    porCriterio,
    activos: activos.length,
    fueraDeCatalogo: filas.filter((f) => !f.enCatalogo).map((f) => f.proveedor),
  };
}
