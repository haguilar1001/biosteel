// ==========================================================
// Consultas del inventario de material de osteosíntesis.
//
// Conciliar significa cruzar dos reportes de SIESA que miran lo mismo desde
// ángulos distintos: el BALANCE viene por instalación (101 propio · 102
// consignación · 106 aprovechamiento) y los MOVIMIENTOS por bodega. El puente
// es InvBodega.instalacion; sin él las cifras no se pueden comparar.
//
// Que un mes no cuadre casi siempre significa una de dos cosas:
//   · el export de movimientos es anterior al del balance (aparecen
//     documentos contabilizados en el intervalo) → el movimiento queda por
//     debajo del balance, y se arregla reexportando;
//   · una bodega quedó sin catalogar → su plata se va a la instalación
//     equivocada y las diferencias de 101 y 102 se compensan entre sí.
// ==========================================================
import "server-only";
import { prisma } from "@/lib/db";

/** Bajo este umbral (en pesos) se considera que el mes cuadra. */
export const UMBRAL = 1;

export const NOMBRE_INSTALACION: Record<number, string> = {
  101: "Propio",
  102: "Consignación",
  106: "Aprovechamiento",
};

export const MES_CORTO = ["", "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

const n = (v: unknown): number => (v == null ? 0 : Number(v));

export interface FilaConciliacion {
  mes: number;
  instalacion: number;
  balEntradas: number; movEntradas: number; difEntradas: number;
  balSalidas: number; movSalidas: number; difSalidas: number;
  cuadra: boolean;
  /** Hay movimientos pero el balance del mes todavía no se ha cargado. */
  sinBalance: boolean;
}

/** Años con balance cargado, del más viejo al más nuevo. */
export async function aniosConBalance(): Promise<number[]> {
  const filas = await prisma.invBalance.groupBy({ by: ["anio"], orderBy: { anio: "asc" } });
  return filas.map((f) => f.anio);
}

/** Conciliación mes × instalación de un año. */
export async function conciliacion(anio: number): Promise<FilaConciliacion[]> {
  const filas = await prisma.$queryRaw<Record<string, unknown>[]>`
    WITH bal AS (
      SELECT mes, instalacion,
             SUM("valorEntradas") AS ent, SUM("valorSalidas") AS sal
      FROM "InvBalance" WHERE anio = ${anio} GROUP BY mes, instalacion
    ), mov AS (
      SELECT m.mes, COALESCE(m.instalacion, b.instalacion) AS instalacion,
             SUM(m."costoEntradas") AS ent, SUM(m."costoSalidas") AS sal
      FROM "InvMovimiento" m JOIN "InvBodega" b ON b.codigo = m."bodegaCodigo"
      WHERE m.anio = ${anio} GROUP BY m.mes, COALESCE(m.instalacion, b.instalacion)
    )
    SELECT COALESCE(bal.mes, mov.mes) AS mes,
           COALESCE(bal.instalacion, mov.instalacion) AS instalacion,
           COALESCE(bal.ent, 0) AS bal_ent, COALESCE(bal.sal, 0) AS bal_sal,
           COALESCE(mov.ent, 0) AS mov_ent, COALESCE(mov.sal, 0) AS mov_sal
    FROM bal FULL OUTER JOIN mov
      ON bal.mes = mov.mes AND bal.instalacion = mov.instalacion
    ORDER BY 1, 2`;

  // Un mes con movimientos pero sin balance (el mes en curso) no es un
  // descuadre: todavía no hay contra qué compararlo.
  const conBalance = new Set(await mesesConBalance(anio));

  return filas.map((f) => {
    const balEntradas = n(f.bal_ent), movEntradas = n(f.mov_ent);
    const balSalidas = n(f.bal_sal), movSalidas = n(f.mov_sal);
    const difEntradas = movEntradas - balEntradas, difSalidas = movSalidas - balSalidas;
    const mes = n(f.mes);
    const sinBalance = !conBalance.has(mes);
    return {
      mes, instalacion: n(f.instalacion),
      balEntradas, movEntradas, difEntradas,
      balSalidas, movSalidas, difSalidas,
      cuadra: sinBalance || (Math.abs(difEntradas) < UMBRAL && Math.abs(difSalidas) < UMBRAL),
      sinBalance,
    };
  });
}

export interface FilaCadena {
  anio: number; mes: number;
  inicial: number; entradas: number; salidas: number; final: number;
  /** Saldo final del periodo anterior; null en el primero cargado. */
  finalAnterior: number | null;
  /** inicial − finalAnterior: si no da 0, se perdió un mes o el corte cambió. */
  saltoEnlace: number | null;
  /** (inicial + entradas − salidas) − final: si no da 0, el mes no es consistente. */
  saltoInterno: number;
}

/**
 * Cadena de saldos de todo lo cargado. Dos validaciones distintas:
 * que cada mes cierre solo, y que enlace con el mes anterior.
 */
export async function cadenaDeSaldos(): Promise<FilaCadena[]> {
  const filas = await prisma.$queryRaw<Record<string, unknown>[]>`
    SELECT anio, mes,
           SUM("valorInicial") AS ini, SUM("valorEntradas") AS ent,
           SUM("valorSalidas") AS sal, SUM("valorFinal") AS fin
    FROM "InvBalance" GROUP BY anio, mes ORDER BY anio, mes`;

  let anterior: number | null = null;
  return filas.map((f) => {
    const inicial = n(f.ini), entradas = n(f.ent), salidas = n(f.sal), final = n(f.fin);
    const fila: FilaCadena = {
      anio: n(f.anio), mes: n(f.mes), inicial, entradas, salidas, final,
      finalAnterior: anterior,
      saltoEnlace: anterior == null ? null : inicial - anterior,
      saltoInterno: inicial + entradas - salidas - final,
    };
    anterior = final;
    return fila;
  });
}

export interface FilaBodega {
  codigo: string; descripcion: string; ciudad: string;
  instalacion: number; modeloCompra: string; inferida: boolean;
  movimientos: number; entradas: number; salidas: number;
}

/** Movimientos de un mes agrupados por bodega (para ubicar una diferencia). */
export async function movimientosPorBodega(anio: number, mes: number): Promise<FilaBodega[]> {
  const filas = await prisma.$queryRaw<Record<string, unknown>[]>`
    SELECT m."bodegaCodigo" AS codigo, b.descripcion, b.ciudad,
           COALESCE(m.instalacion, b.instalacion) AS instalacion,
           b."modeloCompra", b.inferida, COUNT(*) AS movs,
           SUM(m."costoEntradas") AS ent, SUM(m."costoSalidas") AS sal
    FROM "InvMovimiento" m JOIN "InvBodega" b ON b.codigo = m."bodegaCodigo"
    WHERE m.anio = ${anio} AND m.mes = ${mes}
    GROUP BY 1, 2, 3, 4, 5, 6
    ORDER BY (SUM(m."costoEntradas") + SUM(m."costoSalidas")) DESC`;

  return filas.map((f) => ({
    codigo: String(f.codigo), descripcion: String(f.descripcion ?? ""),
    ciudad: String(f.ciudad ?? ""), instalacion: n(f.instalacion),
    modeloCompra: String(f.modeloCompra ?? ""), inferida: Boolean(f.inferida),
    movimientos: n(f.movs), entradas: n(f.ent), salidas: n(f.sal),
  }));
}

export interface FilaReferencia {
  instalacion: number; referencia: string; descripcion: string;
  difEntradas: number; difSalidas: number; peso: number;
}

/**
 * Ítems donde el balance y los movimientos no coinciden, de mayor a menor.
 * Es el detalle accionable: con la referencia en mano se busca el documento
 * en SIESA.
 */
export async function diferenciasPorReferencia(anio: number, mes: number, limite = 50): Promise<FilaReferencia[]> {
  const filas = await prisma.$queryRaw<Record<string, unknown>[]>`
    WITH bal AS (
      SELECT instalacion, referencia, MAX(descripcion) AS descripcion,
             SUM("valorEntradas") AS ent, SUM("valorSalidas") AS sal
      FROM "InvBalance" WHERE anio = ${anio} AND mes = ${mes}
      GROUP BY instalacion, referencia
    ), mov AS (
      SELECT COALESCE(m.instalacion, b.instalacion) AS instalacion, m.referencia, MAX(m.descripcion) AS descripcion,
             SUM(m."costoEntradas") AS ent, SUM(m."costoSalidas") AS sal
      FROM "InvMovimiento" m JOIN "InvBodega" b ON b.codigo = m."bodegaCodigo"
      WHERE m.anio = ${anio} AND m.mes = ${mes}
      GROUP BY COALESCE(m.instalacion, b.instalacion), m.referencia
    ), j AS (
      SELECT COALESCE(bal.instalacion, mov.instalacion) AS instalacion,
             COALESCE(bal.referencia, mov.referencia) AS referencia,
             COALESCE(bal.descripcion, mov.descripcion) AS descripcion,
             COALESCE(mov.ent, 0) - COALESCE(bal.ent, 0) AS dif_ent,
             COALESCE(mov.sal, 0) - COALESCE(bal.sal, 0) AS dif_sal
      FROM bal FULL OUTER JOIN mov
        ON bal.instalacion = mov.instalacion AND bal.referencia = mov.referencia
    )
    SELECT * FROM j
    WHERE ABS(dif_ent) + ABS(dif_sal) >= ${UMBRAL}
    ORDER BY ABS(dif_ent) + ABS(dif_sal) DESC
    LIMIT ${limite}`;

  return filas.map((f) => {
    const difEntradas = n(f.dif_ent), difSalidas = n(f.dif_sal);
    return {
      instalacion: n(f.instalacion), referencia: String(f.referencia ?? ""),
      descripcion: String(f.descripcion ?? ""), difEntradas, difSalidas,
      peso: Math.abs(difEntradas) + Math.abs(difSalidas),
    };
  });
}

/** Cuántos ítems difieren en el mes (el detalle sale recortado por `limite`). */
export async function totalDiferencias(anio: number, mes: number): Promise<{ items: number; peso: number }> {
  const filas = await prisma.$queryRaw<Record<string, unknown>[]>`
    WITH bal AS (
      SELECT instalacion, referencia,
             SUM("valorEntradas") AS ent, SUM("valorSalidas") AS sal
      FROM "InvBalance" WHERE anio = ${anio} AND mes = ${mes}
      GROUP BY instalacion, referencia
    ), mov AS (
      SELECT COALESCE(m.instalacion, b.instalacion) AS instalacion, m.referencia,
             SUM(m."costoEntradas") AS ent, SUM(m."costoSalidas") AS sal
      FROM "InvMovimiento" m JOIN "InvBodega" b ON b.codigo = m."bodegaCodigo"
      WHERE m.anio = ${anio} AND m.mes = ${mes}
      GROUP BY COALESCE(m.instalacion, b.instalacion), m.referencia
    ), j AS (
      SELECT ABS(COALESCE(mov.ent, 0) - COALESCE(bal.ent, 0))
           + ABS(COALESCE(mov.sal, 0) - COALESCE(bal.sal, 0)) AS peso
      FROM bal FULL OUTER JOIN mov
        ON bal.instalacion = mov.instalacion AND bal.referencia = mov.referencia
    )
    SELECT COUNT(*) AS items, COALESCE(SUM(peso), 0) AS peso FROM j WHERE peso >= ${UMBRAL}`;
  const f = filas[0] ?? {};
  return { items: n(f.items), peso: n(f.peso) };
}

/** Meses de un año que tienen balance cargado. */
export async function mesesConBalance(anio: number): Promise<number[]> {
  const filas = await prisma.invBalance.groupBy({
    by: ["mes"], where: { anio }, orderBy: { mes: "asc" },
  });
  return filas.map((f) => f.mes);
}
