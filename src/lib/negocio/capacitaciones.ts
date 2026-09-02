// ==========================================================
// CAPACITACIONES (Gestión Humana) — consolidado del plan de formación y los
// dos indicadores del proceso.
//
// METODOLOGÍA (formato de Gestión Humana):
//   · Cada colaborador presenta una evaluación ANTES de la capacitación y
//     otra DESPUÉS, ambas sobre 100.
//   · El % final de la fila es el promedio de las dos. Se guarda el valor del
//     consolidado, no uno recalculado: la app tiene que decir lo mismo que el
//     documento firmado.
//   · Indicador A · Ejecución = ejecutadas / planeadas, meta > 70 %.
//   · Indicador B · Eficacia  = (post − pre) / pre, meta > 10 %. Mide cuánto
//     aprendieron, no cuánto sabían: por eso se divide entre el pre.
//
// Los agregados se hacen en memoria a propósito: son ~100 registros por
// semestre y así las cuatro fórmulas viven en un solo lugar.
// ==========================================================
import "server-only";
import { prisma } from "@/lib/db";

/** Meta del indicador de ejecución del plan de formación (%). */
export const META_EJECUCION = 70;
/** Meta del indicador de eficacia: cuánto sube el puntaje pre → post (%). */
export const META_EFICACIA = 10;

export const MES_CORTO = ["", "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
export const MES_LARGO = ["", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

/**
 * Niveles de desempeño. Son los del informe de Gestión Humana; el corte de
 * 60 no es arbitrario: por debajo de ahí la capacitación se repite.
 */
export const NIVELES = [
  { clave: "excelente", label: "Excelente", desde: 90, clase: "t-ok" },
  { clave: "bueno", label: "Bueno", desde: 75, clase: "t-blue" },
  { clave: "aceptable", label: "Aceptable", desde: 60, clase: "t-w1" },
  { clave: "critico", label: "Crítico", desde: 0, clase: "t-bad" },
] as const;

export type NivelClave = (typeof NIVELES)[number]["clave"];

export function nivelDe(pct: number): (typeof NIVELES)[number] {
  return NIVELES.find((n) => pct >= n.desde) ?? NIVELES[NIVELES.length - 1]!;
}

export interface Registro {
  id: number; anio: number; mes: number;
  capacitacion: string; colaborador: string;
  pre: number; post: number; final: number;
  observaciones: string;
}

const prom = (ns: number[]): number => (ns.length ? ns.reduce((s, n) => s + n, 0) / ns.length : 0);

/** Años con capacitaciones cargadas, ascendente. */
export async function aniosConCapacitaciones(): Promise<number[]> {
  const filas = await prisma.capacitacion.groupBy({ by: ["anio"], orderBy: { anio: "asc" } });
  return filas.map((f) => f.anio);
}

/** Todos los registros del año (o de un mes), ya en números. */
export async function registros(anio: number, mes?: number): Promise<Registro[]> {
  const filas = await prisma.capacitacion.findMany({
    where: { anio, ...(mes ? { mes } : {}) },
    orderBy: [{ mes: "asc" }, { capacitacion: "asc" }, { colaborador: "asc" }],
  });
  return filas.map((f) => ({
    id: f.id, anio: f.anio, mes: f.mes,
    capacitacion: f.capacitacion, colaborador: f.colaborador,
    pre: f.pre.toNumber(), post: f.post.toNumber(), final: f.final.toNumber(),
    observaciones: f.observaciones,
  }));
}

export interface ResumenCapacitaciones {
  registros: number;
  capacitaciones: number;
  colaboradores: number;
  promedioFinal: number;
  promedioPre: number;
  promedioPost: number;
  /** Puntos que sube el promedio de pre a post. */
  mejora: number;
}

export function resumen(rs: Registro[]): ResumenCapacitaciones {
  return {
    registros: rs.length,
    capacitaciones: new Set(rs.map((r) => r.capacitacion)).size,
    colaboradores: new Set(rs.map((r) => r.colaborador)).size,
    promedioFinal: prom(rs.map((r) => r.final)),
    promedioPre: prom(rs.map((r) => r.pre)),
    promedioPost: prom(rs.map((r) => r.post)),
    mejora: prom(rs.map((r) => r.post)) - prom(rs.map((r) => r.pre)),
  };
}

export interface FilaMes {
  mes: number;
  capacitaciones: number;
  participantes: number;
  promedio: number;
  pre: number;
  post: number;
  /** (post − pre) / pre × 100. El indicador B. */
  eficacia: number;
}

/** Una fila por mes con datos, ascendente. */
export function porMes(rs: Registro[]): FilaMes[] {
  const meses = [...new Set(rs.map((r) => r.mes))].sort((a, b) => a - b);
  return meses.map((mes) => {
    const del = rs.filter((r) => r.mes === mes);
    const pre = prom(del.map((r) => r.pre));
    const post = prom(del.map((r) => r.post));
    return {
      mes,
      capacitaciones: new Set(del.map((r) => r.capacitacion)).size,
      participantes: del.length,
      promedio: prom(del.map((r) => r.final)),
      pre, post,
      eficacia: pre > 0 ? ((post - pre) / pre) * 100 : 0,
    };
  });
}

export interface FilaCapacitacion {
  capacitacion: string;
  mes: number;
  participantes: number;
  promedio: number;
  pre: number;
  post: number;
}

/** Una fila por capacitación, de menor a mayor promedio (lo flojo arriba). */
export function porCapacitacion(rs: Registro[]): FilaCapacitacion[] {
  const nombres = [...new Set(rs.map((r) => r.capacitacion))];
  return nombres
    .map((capacitacion) => {
      const del = rs.filter((r) => r.capacitacion === capacitacion);
      return {
        capacitacion,
        mes: Math.min(...del.map((r) => r.mes)),
        participantes: del.length,
        promedio: prom(del.map((r) => r.final)),
        pre: prom(del.map((r) => r.pre)),
        post: prom(del.map((r) => r.post)),
      };
    })
    .sort((a, b) => a.promedio - b.promedio);
}

export interface FilaColaborador {
  colaborador: string;
  capacitaciones: number;
  promedio: number;
}

/** Una fila por colaborador, de menor a mayor promedio. */
export function porColaborador(rs: Registro[]): FilaColaborador[] {
  const nombres = [...new Set(rs.map((r) => r.colaborador))];
  return nombres
    .map((colaborador) => {
      const del = rs.filter((r) => r.colaborador === colaborador);
      return { colaborador, capacitaciones: del.length, promedio: prom(del.map((r) => r.final)) };
    })
    .sort((a, b) => a.promedio - b.promedio);
}

export interface FilaNivel { nivel: (typeof NIVELES)[number]; cantidad: number }

/** Cuántos registros cayeron en cada nivel de desempeño. */
export function distribucion(rs: Registro[]): FilaNivel[] {
  return NIVELES.map((nivel) => ({
    nivel,
    cantidad: rs.filter((r) => nivelDe(r.final).clave === nivel.clave).length,
  }));
}

export interface FilaEjecucion {
  mes: number;
  ejecutadas: number;
  /** null = el mes no tiene plan cargado, así que no hay contra qué medir. */
  planeadas: number | null;
  resultado: number | null;
  cumple: boolean | null;
}

/**
 * Indicador A. Las ejecutadas salen del consolidado (capacitaciones distintas
 * del mes); las planeadas, del plan de formación, que se lleva aparte.
 */
export async function ejecucion(anio: number, rs: Registro[]): Promise<FilaEjecucion[]> {
  const plan = await prisma.capacitacionPlan.findMany({ where: { anio } });
  const planPorMes = new Map(plan.map((p) => [p.mes, p.planeadas]));
  return porMes(rs).map((m) => {
    const planeadas = planPorMes.get(m.mes) ?? null;
    const resultado = planeadas && planeadas > 0 ? (m.capacitaciones / planeadas) * 100 : null;
    return {
      mes: m.mes,
      ejecutadas: m.capacitaciones,
      planeadas,
      resultado,
      cumple: resultado == null ? null : resultado > META_EJECUCION,
    };
  });
}

// ---------- Plan de formación (el denominador del indicador A) ----------

export interface FilaPlan {
  mes: number;
  /** null = el mes no tiene plan cargado. Distinto de 0 (se planeó nada). */
  planeadas: number | null;
  /** Capacitaciones distintas que sí se dictaron ese mes, según el consolidado. */
  ejecutadas: number;
}

/** Los doce meses del año con su plan y lo que ya se ejecutó. */
export async function planDelAnio(anio: number): Promise<FilaPlan[]> {
  const [plan, rs] = await Promise.all([
    prisma.capacitacionPlan.findMany({ where: { anio } }),
    registros(anio),
  ]);
  const planeadasPorMes = new Map(plan.map((f) => [f.mes, f.planeadas]));
  const ejecutadasPorMes = new Map(porMes(rs).map((m) => [m.mes, m.capacitaciones]));
  return Array.from({ length: 12 }, (_, i) => ({
    mes: i + 1,
    planeadas: planeadasPorMes.get(i + 1) ?? null,
    ejecutadas: ejecutadasPorMes.get(i + 1) ?? 0,
  }));
}

/**
 * Reemplaza el plan del año. Un mes en null se BORRA en vez de guardarse como
 * cero: no es lo mismo "no se planeó nada" que "todavía no hay plan", y el
 * indicador de ejecución muestra cosas distintas en cada caso.
 */
export async function guardarPlan(anio: number, planeadas: Record<number, number | null>): Promise<{ guardados: number; borrados: number }> {
  let guardados = 0, borrados = 0;
  for (let mes = 1; mes <= 12; mes++) {
    const valor = planeadas[mes];
    if (valor == null) {
      const { count } = await prisma.capacitacionPlan.deleteMany({ where: { anio, mes } });
      borrados += count;
      continue;
    }
    await prisma.capacitacionPlan.upsert({
      where: { anio_mes: { anio, mes } },
      update: { planeadas: valor },
      create: { anio, mes, planeadas: valor },
    });
    guardados++;
  }
  return { guardados, borrados };
}
