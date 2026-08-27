// ==========================================================
// Carga de los dos Excel del FOR-GC-011 (indicadores de calidad de Compras):
//
//   · "indicador de compra.xlsx"      → IndicadorCompraMes
//     Una fila por mes con órdenes recibidas completas y órdenes totales.
//     El % NO se guarda: es completas/totales y se calcula al mostrarlo, así
//     nunca puede quedar peleado con sus propios dos números.
//
//   · "RELACION PROVEEDORES.xlsx"     → ProveedorActivo + EvaluacionProveedor
//     Hoja "PROVEEDORES ACTIVOS" = catálogo. Una hoja por mes (ENERO…) con
//     los proveedores EN COLUMNAS y los seis criterios en filas.
//
// Dos cosas que el archivo trae mal y aquí se corrigen a propósito:
//
//   1. El "% DE CALIFICACIÓN OBTENIDO" del Excel no siempre es total/5: hay
//      celdas con 10 en vez de 1,0 (siete en ene–jul 2026) y algún porcentaje
//      que quedó viejo frente a su total. Se recalcula siempre y el resultado
//      del import reporta cuántas no cuadraban, para que Calidad lo corrija en
//      la fuente en vez de que la app arrastre el error en silencio.
//
//   2. Los nombres de proveedor cambian de mes a mes: hasta junio se usan
//      nombres cortos ("SAMPEDRO", "GRUPO GALENO") y en julio los legales
//      completos. Sin unificar, el mismo proveedor sale como dos filas
//      distintas y su tendencia queda partida por la mitad. Se unifican con
//      una tabla EXPLÍCITA (abajo), no con una regla automática de parecido:
//      unir proveedores por heurística es exactamente el tipo de error que
//      nadie revisa después.
// ==========================================================
import "server-only";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/db";

const MESES: Record<string, number> = {
  ENERO: 1, FEBRERO: 2, MARZO: 3, ABRIL: 4, MAYO: 5, JUNIO: 6,
  JULIO: 7, AGOSTO: 8, SEPTIEMBRE: 9, OCTUBRE: 10, NOVIEMBRE: 11, DICIEMBRE: 12,
};

/** Puntaje máximo del formato: los seis criterios suman 5,0. */
export const PUNTAJE_MAXIMO = 5;

const txt = (v: unknown): string => (v == null ? "" : String(v).replace(/\s+/g, " ").trim());

const num = (v: unknown): number => {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const s = String(v ?? "").replace(/[^\d.,-]/g, "");
  const n = Number(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s);
  return Number.isFinite(n) ? n : 0;
};

/** Clave de comparación de un nombre: mayúsculas, sin puntos ni espacios de más. */
const clave = (s: unknown): string =>
  txt(s).toUpperCase().replace(/[.,]/g, "").replace(/\s+/g, " ").trim();

/**
 * Nombre corto → razón social. Revisado uno por uno contra la hoja
 * "PROVEEDORES ACTIVOS"; la llave está normalizada con `clave()`.
 *
 * NO está aquí "SERVICIOS LOGISTICOS E INTEGRALES EN SALUD SAS" (solo julio)
 * apuntando a "SERVILOGISTICA MAG S.A.S." (enero–junio): el patrón sugiere que
 * son la misma empresa, pero los nombres no se parecen lo suficiente como para
 * afirmarlo, y unir dos proveedores distintos por error es peor que dejarlos
 * separados. Queda pendiente de confirmar con Compras.
 */
const ALIAS: Record<string, string> = {
  "ALEX BARRAZA SAS": "CENTRO ORTOPEDICO ALEX BARRAZA S.A.S.",
  "CENTRO ORTOPEDICO ALEX BARRAZA SAS": "CENTRO ORTOPEDICO ALEX BARRAZA S.A.S.",
  "GLOBAL LINK": "GLOBAL LINK C&C S.A.S.",
  "GRUPO GALENO": "GRUPO GALENO INSTITUTO PRESTADOR DE SALUD (IPS) S.A.S.",
  "IMEQ S A": "IMPLANTES MEDICO QUIRURGICOS S A IMEQ S A",
  "SAMPEDRO": "INDUSTRIAS MEDICAS SAMPEDRO S A S",
  "JC DISTRIBUCIONES": "JC DISTRIBUCIONES MEDICAS LTDA",
  // "OROTPEDICO" es un error de dedo del archivo, no otro proveedor.
  "MACLO OROTPEDICO": "MACLO ORTOPEDICOS LIMITADA",
  "OSTEOBIOMED": "OSTEOBIOMED S.A.S",
  "OSTEOMEDICAL S A S": "OSTEOMEDICAL S A S",
  "OSTEOMEDICAL SAS": "OSTEOMEDICAL S A S",
  "TOCAMEDIC": "TOCAMEDIC COLOMBIA S.A.S.",
  "TODO ORTOPEDICO": "TODO ORTOPEDICO S.A.S.",
  "TRAUMA STORE": "TRAUMA STORE S.A.S.",
};

/** Aplica la tabla de alias; si no está, devuelve el nombre limpio del archivo. */
export function nombreCanonico(bruto: unknown): string {
  const limpio = txt(bruto);
  return ALIAS[clave(limpio)] ?? limpio;
}

/** Los seis criterios del formato, en el orden en que van en la hoja. */
export const CRITERIOS = [
  { campo: "calidad", label: "Calidad del producto", peso: 20 },
  { campo: "tiempos", label: "Tiempos de entrega", peso: 20 },
  { campo: "cantidad", label: "Cumplimiento en cantidad", peso: 15 },
  { campo: "precio", label: "Precio", peso: 15 },
  { campo: "postventa", label: "Atención post-venta", peso: 10 },
  { campo: "seguimiento", label: "Seguimiento", peso: 20 },
] as const;

// ---------- 1) Indicador de órdenes recibidas completas ----------

export interface IndicadorParsed {
  hoja: string;
  anio: number;
  filas: number;
  omitidas: number;
  datos: { anio: number; mes: number; ordenesCompletas: number; ordenesTotales: number }[];
}

/**
 * El año no viene en la hoja (el formato solo dice "Enero", "Febrero"…), así
 * que se recibe de afuera. Por defecto, el año en curso.
 */
export function parseIndicadorCompras(buffer: Buffer, anio = new Date().getFullYear()): IndicadorParsed {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true, dense: true });
  const nombre = wb.SheetNames[0];
  if (!nombre) throw new Error("El archivo no tiene hojas.");
  const filas = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[nombre]!, {
    header: 1, raw: true, defval: null, blankrows: false,
  });

  const datos: IndicadorParsed["datos"] = [];
  let leidas = 0, omitidas = 0;
  for (const r of filas) {
    if (!r) continue;
    const mes = MESES[txt(r[0]).toUpperCase()];
    if (!mes) continue; // encabezados, objetivos, totales y el pie del formato
    leidas++;
    const ordenesTotales = Math.round(num(r[2]));
    // Un mes sin diligenciar viene en blanco: no es un cero, es que todavía no
    // ha pasado. Guardarlo como 0/0 pintaría un 0 % de cumplimiento.
    if (ordenesTotales <= 0) { omitidas++; continue; }
    datos.push({ anio, mes, ordenesCompletas: Math.round(num(r[1])), ordenesTotales });
  }
  return { hoja: nombre, anio, filas: leidas, omitidas, datos };
}

/** Upsert por (año, mes): recargar el archivo actualiza los meses que trae. */
export async function persistirIndicadorCompras(p: IndicadorParsed): Promise<number> {
  for (const d of p.datos) {
    await prisma.indicadorCompraMes.upsert({
      where: { anio_mes: { anio: d.anio, mes: d.mes } },
      create: d,
      update: { ordenesCompletas: d.ordenesCompletas, ordenesTotales: d.ordenesTotales },
    });
  }
  return p.datos.length;
}

// ---------- 2) Evaluación de proveedores ----------

export interface EvaluacionParsed {
  anio: number;
  meses: number[];
  /** Proveedores del catálogo (hoja PROVEEDORES ACTIVOS). */
  activos: { razonSocial: string; fichaTecnica: boolean; evaluacionInicial: boolean; seguimiento: boolean }[];
  evaluaciones: {
    anio: number; mes: number; proveedor: string;
    calidad: number; tiempos: number; cantidad: number; precio: number;
    postventa: number; seguimiento: number; total: number; pct: number;
  }[];
  /** Celdas donde el % del Excel no era total/5 (se recalculó). */
  pctCorregidos: string[];
  /** Filas donde el TOTAL del Excel no es la suma de sus seis criterios. */
  totalesRaros: string[];
  /** Proveedores evaluados que no están en la hoja de activos. */
  fueraDeCatalogo: string[];
}

export function parseEvaluacionProveedores(buffer: Buffer, anio = new Date().getFullYear()): EvaluacionParsed {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true, dense: true });

  // --- Catálogo de proveedores activos ---
  const activos: EvaluacionParsed["activos"] = [];
  const hojaActivos = wb.SheetNames.find((n) => clave(n).includes("PROVEEDORES ACTIVOS"));
  if (hojaActivos) {
    const filas = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[hojaActivos]!, {
      header: 1, raw: true, defval: null, blankrows: false,
    });
    for (const r of filas.slice(1)) {
      const razonSocial = txt(r?.[0]);
      if (!razonSocial || clave(razonSocial).startsWith("RAZON")) continue;
      // Las tres columnas se marcan con "*" cuando el documento está al día.
      activos.push({
        razonSocial,
        fichaTecnica: txt(r?.[1]) !== "",
        evaluacionInicial: txt(r?.[2]) !== "",
        seguimiento: txt(r?.[3]) !== "",
      });
    }
  }

  // --- Una hoja por mes ---
  const evaluaciones: EvaluacionParsed["evaluaciones"] = [];
  const meses: number[] = [];
  const pctCorregidos: string[] = [];
  const totalesRaros: string[] = [];
  const catalogo = new Set(activos.map((a) => clave(a.razonSocial)));
  const fuera = new Set<string>();

  for (const nombre of wb.SheetNames) {
    const mes = MESES[clave(nombre)];
    if (!mes) continue;
    const filas = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[nombre]!, {
      header: 1, raw: true, defval: null, blankrows: false,
    });
    // Fila 0: proveedores en columnas desde la F (índice 5).
    // Filas 1–6: los seis criterios · fila 7: TOTAL · fila 8: % del Excel.
    const cabecera = filas[0] ?? [];
    const totalRow = filas[7] ?? [];
    const pctRow = filas[8] ?? [];
    let hubo = false;

    for (let c = 5; c < cabecera.length; c++) {
      const proveedor = nombreCanonico(cabecera[c]);
      if (!proveedor) continue;

      const valores = CRITERIOS.map((_, k) => num((filas[k + 1] ?? [])[c]));
      const total = num(totalRow[c]);
      // Sin total no hay evaluación: es una columna vacía del formato.
      if (total <= 0) continue;
      hubo = true;

      const suma = valores.reduce((a, b) => a + b, 0);
      if (Math.abs(suma - total) > 0.005) {
        totalesRaros.push(`${nombre.trim()} · ${proveedor}: TOTAL ${total} vs suma ${suma.toFixed(2)}`);
      }

      const pct = (total / PUNTAJE_MAXIMO) * 100;
      const pctExcel = num(pctRow[c]) * 100;
      if (Number.isFinite(pctExcel) && Math.abs(pctExcel - pct) > 0.5) {
        pctCorregidos.push(`${nombre.trim()} · ${proveedor}: ${pctExcel.toFixed(0)} % → ${pct.toFixed(0)} %`);
      }
      if (catalogo.size && !catalogo.has(clave(proveedor))) fuera.add(proveedor);

      evaluaciones.push({
        anio, mes, proveedor,
        calidad: valores[0]!, tiempos: valores[1]!, cantidad: valores[2]!,
        precio: valores[3]!, postventa: valores[4]!, seguimiento: valores[5]!,
        total, pct,
      });
    }
    if (hubo) meses.push(mes);
  }

  return {
    anio, meses: [...new Set(meses)].sort((a, b) => a - b), activos, evaluaciones,
    pctCorregidos, totalesRaros, fueraDeCatalogo: [...fuera].sort(),
  };
}

/**
 * Reemplaza los meses presentes en el archivo y hace upsert del catálogo.
 * Los meses se reemplazan porque un proveedor puede salir de la evaluación de
 * un mes al recargarlo, y acumular dejaría su calificación vieja colgada.
 */
export async function persistirEvaluacionProveedores(p: EvaluacionParsed): Promise<number> {
  for (const a of p.activos) {
    await prisma.proveedorActivo.upsert({
      where: { razonSocial: a.razonSocial },
      create: a,
      update: { fichaTecnica: a.fichaTecnica, evaluacionInicial: a.evaluacionInicial, seguimiento: a.seguimiento },
    });
  }
  for (const mes of p.meses) {
    await prisma.evaluacionProveedor.deleteMany({ where: { anio: p.anio, mes } });
  }
  if (p.evaluaciones.length) {
    await prisma.evaluacionProveedor.createMany({ data: p.evaluaciones });
  }
  return p.evaluaciones.length;
}
