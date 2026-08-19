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

// ---------- Inventario valorizado ----------

/** Dimensiones por las que se puede abrir el saldo (columnas del balance). */
export const DIMENSIONES = {
  marca: "Marca",
  linea: "Línea",
  anatomia: "Anatomía",
  sistema: "Sistema",
  categoria: "Categoría",
} as const;
export type Dimension = keyof typeof DIMENSIONES;

export interface ResumenValorizado {
  valor: number; unidades: number; items: number;
  /** Saldo del mes anterior (0 si no hay). */
  valorAnterior: number;
  entradas: number; salidas: number;
  /** Ítems con existencia pero valorizados en $0. */
  itemsSinCosto: number; unidadesSinCosto: number;
}

/** KPIs del mes: saldo, movimiento y lo que no tiene costo. */
export async function resumenValorizado(anio: number, mes: number): Promise<ResumenValorizado> {
  const anterior = mes === 1 ? { anio: anio - 1, mes: 12 } : { anio, mes: mes - 1 };
  const filas = await prisma.$queryRaw<Record<string, unknown>[]>`
    SELECT
      SUM("valorFinal") AS valor,
      SUM("cantFinal") AS unidades,
      COUNT(*) FILTER (WHERE "cantFinal" <> 0) AS items,
      SUM("valorEntradas") AS entradas,
      SUM("valorSalidas") AS salidas,
      COUNT(*) FILTER (WHERE "cantFinal" > 0 AND "valorFinal" = 0) AS items_sc,
      COALESCE(SUM("cantFinal") FILTER (WHERE "cantFinal" > 0 AND "valorFinal" = 0), 0) AS und_sc
    FROM "InvBalance" WHERE anio = ${anio} AND mes = ${mes}`;
  const prev = await prisma.$queryRaw<Record<string, unknown>[]>`
    SELECT SUM("valorFinal") AS valor FROM "InvBalance"
    WHERE anio = ${anterior.anio} AND mes = ${anterior.mes}`;
  const f = filas[0] ?? {};
  return {
    valor: n(f.valor), unidades: n(f.unidades), items: n(f.items),
    valorAnterior: n(prev[0]?.valor),
    entradas: n(f.entradas), salidas: n(f.salidas),
    itemsSinCosto: n(f.items_sc), unidadesSinCosto: n(f.und_sc),
  };
}

export interface SaldoInstalacion { instalacion: number; valor: number; unidades: number; items: number }

export async function saldoPorInstalacion(anio: number, mes: number): Promise<SaldoInstalacion[]> {
  const filas = await prisma.$queryRaw<Record<string, unknown>[]>`
    SELECT instalacion, SUM("valorFinal") AS valor, SUM("cantFinal") AS unidades,
           COUNT(*) FILTER (WHERE "cantFinal" <> 0) AS items
    FROM "InvBalance" WHERE anio = ${anio} AND mes = ${mes}
    GROUP BY instalacion ORDER BY instalacion`;
  return filas.map((f) => ({
    instalacion: n(f.instalacion), valor: n(f.valor),
    unidades: n(f.unidades), items: n(f.items),
  }));
}

export interface SaldoDimension {
  label: string; valor: number; unidades: number; items: number;
  entradas: number; salidas: number;
  /** Meses de inventario: saldo ÷ salida mensual promedio del año. null si no rota. */
  mesesInventario: number | null;
}

/**
 * Saldo del mes abierto por una dimensión, con la rotación calculada sobre las
 * salidas del año corrido: un ítem con mucho saldo y poca salida es plata
 * quieta, y eso es lo que hay que poder ver.
 */
export async function saldoPorDimension(anio: number, mes: number, dim: Dimension): Promise<SaldoDimension[]> {
  // `dim` está acotado por el tipo Dimension; el nombre de columna nunca viene del usuario.
  const col = `"${dim}"`;
  const filas = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(`
    WITH saldo AS (
      SELECT ${col} AS label, SUM("valorFinal") AS valor, SUM("cantFinal") AS unidades,
             COUNT(*) FILTER (WHERE "cantFinal" <> 0) AS items,
             SUM("valorEntradas") AS entradas, SUM("valorSalidas") AS salidas
      FROM "InvBalance" WHERE anio = $1 AND mes = $2 GROUP BY 1
    ), anual AS (
      SELECT ${col} AS label, SUM("valorSalidas") AS salidas_anio, COUNT(DISTINCT mes) AS meses
      FROM "InvBalance" WHERE anio = $1 AND mes <= $2 GROUP BY 1
    )
    SELECT s.label, s.valor, s.unidades, s.items, s.entradas, s.salidas,
           a.salidas_anio, a.meses
    FROM saldo s LEFT JOIN anual a ON a.label = s.label
    ORDER BY s.valor DESC`, anio, mes);

  return filas.map((f) => {
    const valor = n(f.valor);
    const salidaMensual = n(f.meses) > 0 ? n(f.salidas_anio) / n(f.meses) : 0;
    return {
      label: String(f.label || "(sin clasificar)"),
      valor, unidades: n(f.unidades), items: n(f.items),
      entradas: n(f.entradas), salidas: n(f.salidas),
      mesesInventario: salidaMensual > 0 ? valor / salidaMensual : null,
    };
  });
}

export interface PuntoMes { anio: number; mes: number; valor: number; unidades: number }

/** Serie del saldo final mes a mes, para ver la tendencia. */
export async function evolucionSaldo(): Promise<PuntoMes[]> {
  const filas = await prisma.$queryRaw<Record<string, unknown>[]>`
    SELECT anio, mes, SUM("valorFinal") AS valor, SUM("cantFinal") AS unidades
    FROM "InvBalance" GROUP BY anio, mes ORDER BY anio, mes`;
  return filas.map((f) => ({
    anio: n(f.anio), mes: n(f.mes), valor: n(f.valor), unidades: n(f.unidades),
  }));
}

export interface ItemSaldo {
  item: string; referencia: string; descripcion: string;
  instalacion: number; marca: string;
  unidades: number; valor: number; costoUnit: number;
  /** Meses sin una sola salida (hasta el mes consultado, dentro del año). */
  mesesSinSalida: number;
}

/**
 * Ítems de mayor saldo, con cuántos meses llevan sin salir. Es la lista para
 * atacar inventario quieto.
 */
export async function itemsConSaldo(anio: number, mes: number, limite = 100): Promise<ItemSaldo[]> {
  const filas = await prisma.$queryRaw<Record<string, unknown>[]>`
    WITH ult AS (
      SELECT item, instalacion, MAX(mes) AS ultimo_mov
      FROM "InvBalance"
      WHERE anio = ${anio} AND mes <= ${mes} AND "cantSalidas" > 0
      GROUP BY item, instalacion
    )
    SELECT b.item, b.referencia, b.descripcion, b.instalacion, b.marca,
           b."cantFinal" AS unidades, b."valorFinal" AS valor,
           ${mes} - COALESCE(u.ultimo_mov, 0) AS sin_salida
    FROM "InvBalance" b LEFT JOIN ult u ON u.item = b.item AND u.instalacion = b.instalacion
    WHERE b.anio = ${anio} AND b.mes = ${mes} AND b."cantFinal" > 0
    ORDER BY b."valorFinal" DESC
    LIMIT ${limite}`;

  return filas.map((f) => {
    const unidades = n(f.unidades), valor = n(f.valor);
    return {
      item: String(f.item), referencia: String(f.referencia ?? ""),
      descripcion: String(f.descripcion ?? ""), instalacion: n(f.instalacion),
      marca: String(f.marca ?? ""), unidades, valor,
      costoUnit: unidades > 0 ? valor / unidades : 0,
      mesesSinSalida: n(f.sin_salida),
    };
  });
}
