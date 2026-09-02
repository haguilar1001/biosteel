// ==========================================================
// Importador del CONSOLIDADO DE CAPACITACIONES (Gestión Humana).
//
// El libro trae una hoja por capacitación con el cuestionario crudo y una
// hoja GENERAL que las resume: mes, capacitación, colaborador, evaluación
// pre, evaluación post y % final. La app lee GENERAL, que es el consolidado
// que Gestión Humana revisa y firma; las hojas de detalle son el soporte.
//
// El semestre no trae año en ninguna columna (la hoja habla de "Enero",
// "Febrero"…), así que se toma del nombre del archivo ("… I SEMESTRE 2026")
// y, si no aparece, del año en curso.
//
// El % final llega como fracción (0,938) o como porcentaje (93,8) según cómo
// se haya guardado el Excel; se normaliza a 0–100 sin recalcularlo, para que
// la app muestre exactamente lo que dice el consolidado.
// ==========================================================
import "server-only";
import * as XLSX from "xlsx";

const MESES = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO",
  "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"];

export interface FilaCapacitacion {
  anio: number; mes: number;
  capacitacion: string; colaborador: string;
  pre: number; post: number; final: number;
  observaciones: string;
}

export interface CapacitacionesParsed {
  hoja: string;
  /** Filas leídas del archivo, incluidas las que se descartan. */
  filas: number;
  datos: FilaCapacitacion[];
  /** Periodos "aaaa-mm" presentes, ordenados. */
  periodos: string[];
  /** Filas sin mes reconocible o sin colaborador. */
  omitidas: number;
  /** Capacitaciones distintas del archivo. */
  capacitaciones: number;
}

const txt = (v: unknown): string => (v == null ? "" : String(v).trim());

/** Número tolerante a "87,5", "87.5%" y a los espacios del export. */
function num(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const s = txt(v).replace(/\s/g, "");
  if (!s) return 0;
  const limpio = s.replace(/[^0-9.,-]/g, "");
  // "1.234,5" (es-CO) vs "1234.5": manda la última coma si la hay.
  const n = Number(limpio.includes(",") ? limpio.replace(/\./g, "").replace(",", ".") : limpio);
  return Number.isFinite(n) ? n : 0;
}

/**
 * El % final se guarda unas veces como 0,938 y otras como 93,8. Se decide por
 * el valor: nadie saca 0,9 % en una evaluación, y nadie saca 938 %.
 */
function aPorcentaje(v: unknown): number {
  const n = num(v);
  return n > 0 && n <= 1.0001 ? n * 100 : n;
}

/** Nombre propio prolijo: "MARIA ANGELICA" → "Maria Angelica". */
function titulo(s: string): string {
  return s.toLowerCase().replace(/(^|[\s\-.])([\p{L}])/gu, (_, sep, c) => sep + c.toUpperCase()).trim();
}

/** Año del nombre del archivo ("… I SEMESTRE 2026.xlsx"). */
export function anioDeNombre(nombre: string, porDefecto: number): number {
  const m = nombre.match(/(20\d{2})/);
  return m ? Number(m[1]) : porDefecto;
}

export function parseCapacitaciones(buffer: Buffer, nombre: string, anioPorDefecto = new Date().getUTCFullYear()): CapacitacionesParsed {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const hoja = wb.SheetNames.find((n) => n.trim().toUpperCase() === "GENERAL");
  if (!hoja) {
    throw new Error('El archivo no tiene la hoja "GENERAL", que es la que trae el consolidado (mes, capacitación, colaborador, pre, post y % final).');
  }
  const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[hoja]!, { header: 1, raw: true, blankrows: false });
  const H = (rows[0] ?? []).map((h) => txt(h).toUpperCase());
  const col = (...alias: string[]) => H.findIndex((h) => alias.some((a) => h.includes(a)));

  const iMes = col("MES");
  const iCap = col("CAPACITACI");
  const iCol = col("COLABORADOR");
  const iPre = col("PRE-EVALUACI", "PRE EVALUACI");
  const iPost = col("POST-EVALUACI", "POST EVALUACI");
  const iFinal = col("PORCENTAJE FINAL", "% FINAL");
  const iObs = col("OBSERVACI");
  if (iMes < 0 || iCap < 0 || iCol < 0) {
    throw new Error('La hoja "GENERAL" no tiene las columnas MES, CAPACITACIÓN y COLABORADOR.');
  }

  const anio = anioDeNombre(nombre, anioPorDefecto);
  const datos: FilaCapacitacion[] = [];
  const periodos = new Set<string>();
  const capacitaciones = new Set<string>();
  let leidas = 0, omitidas = 0;

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i]; if (!r) continue;
    const colaborador = txt(r[iCol]);
    const capacitacion = txt(r[iCap]);
    if (!colaborador && !capacitacion) continue; // fila en blanco, no cuenta
    leidas++;
    const mes = MESES.indexOf(txt(r[iMes]).toUpperCase()) + 1;
    if (!mes || !colaborador || !capacitacion) { omitidas++; continue; }

    const pre = aPorcentaje(r[iPre]);
    const post = aPorcentaje(r[iPost]);
    const final = iFinal >= 0 ? aPorcentaje(r[iFinal]) : (pre + post) / 2;

    datos.push({
      anio, mes,
      capacitacion: titulo(capacitacion),
      colaborador: titulo(colaborador),
      pre, post, final,
      observaciones: iObs >= 0 ? txt(r[iObs]) : "",
    });
    periodos.add(`${anio}-${String(mes).padStart(2, "0")}`);
    capacitaciones.add(titulo(capacitacion));
  }

  if (!datos.length) throw new Error('La hoja "GENERAL" no trae ninguna fila con mes, capacitación y colaborador.');

  return {
    hoja, filas: leidas, datos, omitidas,
    periodos: [...periodos].sort(),
    capacitaciones: capacitaciones.size,
  };
}

/**
 * Reemplaza los periodos que trae el archivo. El consolidado se vuelve a
 * exportar cada vez que se cierra una capacitación, así que el mismo mes
 * llega varias veces y hay que sobrescribirlo entero, no acumular.
 */
export async function persistirCapacitaciones(p: CapacitacionesParsed): Promise<number> {
  const { prisma } = await import("@/lib/db");
  for (const periodo of p.periodos) {
    const [anio, mes] = periodo.split("-").map(Number) as [number, number];
    await prisma.capacitacion.deleteMany({ where: { anio, mes } });
  }
  // skipDuplicates: el consolidado repite al mismo colaborador en la misma
  // capacitación cuando presentó la evaluación dos veces; manda la primera.
  const res = await prisma.capacitacion.createMany({ data: p.datos, skipDuplicates: true });
  return res.count;
}
