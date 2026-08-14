// ==========================================================
// Parseo + persistencia del PRESUPUESTO DE EGRESOS mes a mes desde el Excel
// (hoja "Presupuesto_Terceros"): columnas GRUPO | TERCERO | ENE..DIC.
// Cada celda de mes con valor > 0 es un renglón de PresupuestoMensual.
// El GRUPO se mapea a una CategoriaFlujo de egreso con `clasificar` (para el
// desglose por categoría; el total mensual no depende del mapeo).
// Compartido por el CLI (db:presupuesto) y la carga web (cargas.ts).
//
// Estrategia: REEMPLAZA los meses presentes en el archivo (como gastos), para
// poder reenviar el Excel con más meses sin duplicar.
// ==========================================================
import * as XLSX from "xlsx";
import type { PrismaClient } from "@prisma/client";
import { clasificar } from "./categorias-flujo";

const MESES_COL: Record<string, number> = {
  ENE: 1, FEB: 2, MAR: 3, ABR: 4, MAY: 5, JUN: 6,
  JUL: 7, AGO: 8, SEP: 9, OCT: 10, NOV: 11, DIC: 12,
};

const HOJA = "Presupuesto_Terceros";

const norm = (s: unknown) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().trim();
const num = (v: unknown): number => {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const s = String(v ?? "").trim();
  if (!s) return 0;
  const limpio = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s;
  return Number(limpio.replace(/[^\d.-]/g, "")) || 0;
};

export interface FilaPresupuesto { mes: number; grupo: string; terceroNombre: string; valor: number; }
export interface PresupuestoParseado { hoja: string; filas: FilaPresupuesto[]; meses: number[]; omitidas: number; }

/** Parsea la hoja de presupuesto. Devuelve una fila por (tercero, mes con valor). */
export function parsePresupuesto(buffer: Buffer): PresupuestoParseado {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const ws = wb.Sheets[HOJA] ?? wb.Sheets[wb.SheetNames[0]!];
  if (!ws) throw new Error(`No se encontró la hoja "${HOJA}" en el archivo.`);

  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null });
  if (!rows.length) throw new Error("La hoja de presupuesto está vacía.");

  // Encabezados: ubica GRUPO, TERCERO y las columnas de mes.
  const cab = (rows[0] as unknown[]).map((c) => norm(c));
  const iGrupo = cab.findIndex((c) => c === "GRUPO");
  const iTercero = cab.findIndex((c) => c === "TERCERO");
  const colMes: { idx: number; mes: number }[] = [];
  cab.forEach((c, idx) => { if (MESES_COL[c]) colMes.push({ idx, mes: MESES_COL[c]! }); });
  if (iGrupo < 0 || !colMes.length) throw new Error("El archivo no tiene el formato esperado (columnas GRUPO y ENE..DIC).");

  const filas: FilaPresupuesto[] = [];
  const mesesSet = new Set<number>();
  let omitidas = 0;
  for (let r = 1; r < rows.length; r++) {
    const fila = rows[r] as unknown[];
    const grupo = String(fila[iGrupo] ?? "").trim();
    const tercero = iTercero >= 0 ? String(fila[iTercero] ?? "").trim() : "";
    if (!grupo && !tercero) { continue; }
    for (const { idx, mes } of colMes) {
      const valor = num(fila[idx]);
      if (valor > 0) { filas.push({ mes, grupo, terceroNombre: tercero, valor }); mesesSet.add(mes); }
      else if (fila[idx] != null && String(fila[idx]).trim() !== "" && valor === 0) omitidas++;
    }
  }
  return { hoja: HOJA, filas, meses: [...mesesSet].sort((a, b) => a - b), omitidas };
}

export interface ResultadoPresupuesto { filas: number; cargadas: number; meses: number[]; }

/** Persiste el presupuesto: reemplaza los meses presentes en el archivo. */
export async function persistirPresupuesto(prisma: PrismaClient, anio: number, parse: PresupuestoParseado): Promise<ResultadoPresupuesto> {
  // Mapa nombre de categoría (egreso) → id. Crea las faltantes por si acaso.
  const cats = await prisma.categoriaFlujo.findMany({ where: { tipo: "egreso" } });
  const catId = new Map(cats.map((c) => [c.nombre, c.id]));
  async function idDeCategoria(grupo: string): Promise<number> {
    const nombre = clasificar(grupo, "egreso");
    let id = catId.get(nombre);
    if (id == null) {
      const creada = await prisma.categoriaFlujo.create({ data: { nombre, tipo: "egreso", orden: 900 } });
      id = creada.id; catId.set(nombre, id);
    }
    return id;
  }

  const data: { anio: number; mes: number; categoriaId: number; terceroNombre: string | null; valor: number }[] = [];
  for (const f of parse.filas) {
    data.push({ anio, mes: f.mes, categoriaId: await idDeCategoria(f.grupo), terceroNombre: f.terceroNombre || null, valor: Math.round(f.valor * 100) / 100 });
  }

  // Reemplaza solo los meses presentes en el archivo.
  if (parse.meses.length) {
    await prisma.presupuestoMensual.deleteMany({ where: { anio, mes: { in: parse.meses } } });
  }
  const BATCH = 2000;
  for (let i = 0; i < data.length; i += BATCH) {
    await prisma.presupuestoMensual.createMany({ data: data.slice(i, i + BATCH) as never });
  }
  return { filas: parse.filas.length, cargadas: data.length, meses: parse.meses };
}
