// ==========================================================
// Nómina (fuente: maestro por empleado y año — ver set-nomina.ts).
//   Nomina = un registro por empleado × año.
//   `total` = costo mensual cargado (salario + aportes patronales + provisiones).
// El "costo anual" se estima como costo mensual × 12 (las provisiones ya vienen
// mensualizadas en el Excel).
// ==========================================================
import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

/** Años con nómina cargada, ascendente. */
export async function aniosConNomina(): Promise<number[]> {
  const grupos = await prisma.nomina.groupBy({ by: ["anio"], _count: true });
  return grupos.map((g) => g.anio).sort((a, b) => a - b);
}

export interface ResumenNomina {
  headcount: number;
  costoMensual: number; // Σ total
  costoAnual: number; // costoMensual × 12
  baseSalarial: number;
  auxTransporte: number;
  seguridadSocial: number;
  prestaciones: number;
  salarioPromedio: number; // baseSalarial / headcount
}

/** KPIs del año. */
export async function resumenAnual(anio: number): Promise<ResumenNomina> {
  const agg = await prisma.nomina.aggregate({
    where: { anio },
    _count: true,
    _sum: { total: true, baseSalarial: true, auxTransporte: true, seguridadSocial: true, prestaciones: true },
  });
  const headcount = agg._count;
  const costoMensual = agg._sum.total?.toNumber() ?? 0;
  const baseSalarial = agg._sum.baseSalarial?.toNumber() ?? 0;
  return {
    headcount,
    costoMensual,
    costoAnual: costoMensual * 12,
    baseSalarial,
    auxTransporte: agg._sum.auxTransporte?.toNumber() ?? 0,
    seguridadSocial: agg._sum.seguridadSocial?.toNumber() ?? 0,
    prestaciones: agg._sum.prestaciones?.toNumber() ?? 0,
    salarioPromedio: headcount > 0 ? baseSalarial / headcount : 0,
  };
}

export interface FilaGrupo {
  label: string;
  costoMensual: number;
  headcount: number;
}

/** Agrupa el costo mensual y el headcount por una dimensión, desc. */
async function porDimension(anio: number, by: "empresa" | "proceso" | "ciudad" | "tipoContrato"): Promise<FilaGrupo[]> {
  const grupos = await prisma.nomina.groupBy({ by: [by], where: { anio }, _count: true, _sum: { total: true } });
  return grupos
    .map((g) => ({ label: (g[by] as string) || "N/D", costoMensual: g._sum.total?.toNumber() ?? 0, headcount: g._count }))
    .sort((a, b) => b.costoMensual - a.costoMensual);
}

export const porEmpresa = (anio: number) => porDimension(anio, "empresa");
export const porProceso = (anio: number) => porDimension(anio, "proceso");
export const porCiudad = (anio: number) => porDimension(anio, "ciudad");
export const porTipoContrato = (anio: number) => porDimension(anio, "tipoContrato");

export interface ComposicionCosto {
  baseSalarial: number;
  auxTransporte: number;
  seguridadSocial: number;
  prestaciones: number;
}

/** Composición del costo total: salario + auxilio + aportes patronales + provisiones. */
export async function composicionCosto(anio: number): Promise<ComposicionCosto> {
  const r = await resumenAnual(anio);
  return {
    baseSalarial: r.baseSalarial,
    auxTransporte: r.auxTransporte,
    seguridadSocial: r.seguridadSocial,
    prestaciones: r.prestaciones,
  };
}

export interface FilaComparativa { label: string; a: number; b: number }

/**
 * Compara el costo mensual por dimensión entre dos años (a = anioA, b = anioB).
 * Une las etiquetas presentes en cualquiera de los dos años.
 */
async function comparativo(anioA: number, anioB: number, by: "empresa" | "proceso"): Promise<FilaComparativa[]> {
  const [ga, gb] = await Promise.all([porDimension(anioA, by), porDimension(anioB, by)]);
  const map = new Map<string, { a: number; b: number }>();
  for (const g of ga) map.set(g.label, { a: g.costoMensual, b: 0 });
  for (const g of gb) map.set(g.label, { a: map.get(g.label)?.a ?? 0, b: g.costoMensual });
  return [...map.entries()]
    .map(([label, v]) => ({ label, a: v.a, b: v.b }))
    .sort((x, y) => Math.max(y.a, y.b) - Math.max(x.a, x.b));
}

export const comparativoEmpresa = (anioA: number, anioB: number) => comparativo(anioA, anioB, "empresa");
export const comparativoProceso = (anioA: number, anioB: number) => comparativo(anioA, anioB, "proceso");

export interface EmpleadoNomina {
  cedula: string;
  nombre: string;
  proceso: string;
  cargo: string;
  empresa: string;
  ciudad: string;
  baseSalarial: number;
  seguridadSocial: number;
  prestaciones: number;
  total: number;
  tipoContrato: string;
}

/** Listado detallado de empleados del año, con filtro opcional por texto. */
export async function empleados(anio: number, q?: string): Promise<EmpleadoNomina[]> {
  const term = q?.trim();
  const where: Prisma.NominaWhereInput = {
    anio,
    ...(term
      ? {
          OR: [
            { nombre: { contains: term, mode: "insensitive" } },
            { cargo: { contains: term, mode: "insensitive" } },
            { proceso: { contains: term, mode: "insensitive" } },
            { empresa: { contains: term, mode: "insensitive" } },
            { ciudad: { contains: term, mode: "insensitive" } },
            { cedula: { contains: term } },
          ],
        }
      : {}),
  };
  const filas = await prisma.nomina.findMany({ where, orderBy: [{ total: "desc" }] });
  return filas.map((f) => ({
    cedula: f.cedula,
    nombre: f.nombre,
    proceso: f.proceso,
    cargo: f.cargo,
    empresa: f.empresa,
    ciudad: f.ciudad,
    baseSalarial: f.baseSalarial.toNumber(),
    seguridadSocial: f.seguridadSocial.toNumber(),
    prestaciones: f.prestaciones.toNumber(),
    total: f.total.toNumber(),
    tipoContrato: f.tipoContrato,
  }));
}
