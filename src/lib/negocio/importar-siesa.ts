// ==========================================================
// Parser de los reportes de SIESA para alimentar el flujo de efectivo.
// Convierte cada fila de detalle en un movimiento normalizado.
// Ver el mapeo en diseno/mapeo-siesa-flujo.md.
//
//   Ingresos = OCC + Recaudos (RDC)   ·   Egresos = NGC + NBA + PEL
//
// No toca la base de datos: solo lee el Excel y valida. La carga la hace
// la acción del servidor (flujo/importar/actions.ts).
// ==========================================================
import "server-only";
import * as XLSX from "xlsx";
import type { TipoMovimiento } from "@prisma/client";

export type TipoReporte = "OCC" | "NGC" | "NBA" | "PEL" | "RDC";

/** Dirección de caja de cada tipo de comprobante (decisión Héctor 2026-08-11). */
export const DIRECCION: Record<TipoReporte, TipoMovimiento> = {
  OCC: "ingreso",
  RDC: "ingreso",
  NGC: "egreso",
  NBA: "egreso",
  PEL: "egreso",
};

export const ETIQUETA_REPORTE: Record<TipoReporte, string> = {
  OCC: "OCC · Ingresos (comprobante de ingreso)",
  RDC: "RDC · Recaudos de cartera",
  NGC: "NGC · Egresos (pagos)",
  NBA: "NBA · Egresos bancarios",
  PEL: "PEL · Pagos electrónicos",
};

export interface MovimientoParseado {
  documento: string;
  fecha: Date;
  anio: number;
  mes: number;
  tipo: TipoMovimiento;
  terceroNombre: string;
  nit: string | null;
  beneficiario: string | null;
  detalle: string | null;
  observacion: string | null;
  valor: number;
}

export interface FilaError {
  fila: number;      // nº de fila en el Excel (1-based)
  documento: string | null;
  motivo: string;
}

export interface ResultadoParse {
  tipo: TipoReporte;
  direccion: TipoMovimiento;
  movimientos: MovimientoParseado[];
  errores: FilaError[];
  totalDetalle: number;   // filas de detalle encontradas
  omitidos: number;       // anulados / no aprobados
  hojasIgnoradas: number; // hojas extra del libro no procesadas
}

type Matriz = (string | number)[][];

// ---------- Helpers de limpieza ----------

/** "$1,716,357.00" | "32891057.75" | 30000000 → número (o null). */
export function limpiarMonto(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = String(v).replace(/[$\s]/g, "").replace(/,/g, "");
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Fecha DÍA-primero "DD/MM/AAAA" (o "DD/MM/AAAA H:mm") → Date local (o null). */
export function parseFechaDia(v: unknown): Date | null {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  if (v == null) return null;
  const first = String(v).trim().split(/\s+/)[0];
  if (!first) return null;
  const p = first.split(/[/\-.]/).map((x) => parseInt(x, 10));
  if (p.length !== 3 || p.some((n) => Number.isNaN(n))) return null;
  const d = p[0]!, m = p[1]!;
  let y = p[2]!;
  if (y < 100) y += 2000;
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d ? dt : null;
}

/** "900600550 - INVERSIONES MEDICAS BARU SAS" → { nit, nombre }. */
export function splitNitNombre(v: unknown): { nit: string | null; nombre: string } {
  const s = String(v ?? "").trim();
  const i = s.indexOf(" - ");
  if (i === -1) return { nit: null, nombre: s };
  return { nit: s.slice(0, i).trim() || null, nombre: s.slice(i + 3).trim() };
}

const txt = (v: unknown) => String(v ?? "").replace(/\s+/g, " ").trim();

/** Índice de una columna por nombre exacto de encabezado (insensible a may/espacios). */
function idxCol(header: (string | number)[], nombre: string): number {
  const t = txt(nombre).toLowerCase();
  return header.findIndex((h) => txt(h).toLowerCase() === t);
}

/** Primera fila (de las primeras 30) que contiene todos los encabezados dados. */
function buscarEncabezado(rows: Matriz, requeridos: string[]): number {
  const req = requeridos.map((r) => txt(r).toLowerCase());
  for (let i = 0; i < Math.min(rows.length, 30); i++) {
    const celdas = (rows[i] ?? []).map((c) => txt(c).toLowerCase());
    if (req.every((r) => celdas.includes(r))) return i;
  }
  return -1;
}

// ---------- Detección de tipo ----------

export function detectarTipo(rows: Matriz): TipoReporte | null {
  const plano = rows.slice(0, 30).flat().map((c) => txt(c).toLowerCase());
  if (plano.includes("valor docto.")) return "PEL";
  if (plano.some((c) => c.includes("relacion de recaudos") || c.includes("relación de recaudos")) || plano.includes("cta bancaria")) return "RDC";
  if (plano.includes("credito pcga")) {
    for (const row of rows) {
      for (const c of row ?? []) {
        const m = /^(OCC|NGC|NBA)-\d+/.exec(txt(c));
        if (m) return m[1] as TipoReporte;
      }
    }
  }
  return null;
}

// ---------- Parsers por familia ----------

// OCC / NGC / NBA: layout PCGA pivoteado (encabezado de tercero → detalle).
function parsePcga(rows: Matriz, tipo: TipoReporte): Omit<ResultadoParse, "tipo" | "direccion" | "hojasIgnoradas"> {
  const hr = buscarEncabezado(rows, ["Documento", "Credito PCGA"]);
  if (hr === -1) return { movimientos: [], errores: [{ fila: 0, documento: null, motivo: "No se encontró el encabezado (Documento / Credito PCGA)." }], totalDetalle: 0, omitidos: 0 };
  const H = rows[hr] ?? [];
  const iCO = idxCol(H, "C.O.");
  const iDoc = idxCol(H, "Documento");
  const iFecha = idxCol(H, "Fecha");
  const iCred = idxCol(H, "Credito PCGA");
  const iNotas = idxCol(H, "Notas");
  const iEstado = idxCol(H, "Estado");
  const iAnula = idxCol(H, "Usuario anulacion");
  const re = new RegExp(`^${tipo}-\\d+`);

  const movimientos: MovimientoParseado[] = [];
  const errores: FilaError[] = [];
  let tercero = "";
  let totalDetalle = 0;
  let omitidos = 0;

  for (let r = hr + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row) continue;
    const co = txt(row[iCO]);
    const doc = txt(row[iDoc]);

    if (re.test(doc)) {
      totalDetalle++;
      const anulado = iAnula >= 0 && txt(row[iAnula]) !== "";
      const estado = iEstado >= 0 ? txt(row[iEstado]) : "Aprobado";
      if (anulado || (estado && estado.toLowerCase() !== "aprobado")) { omitidos++; continue; }
      if (!tercero) { errores.push({ fila: r + 1, documento: doc, motivo: "Fila de detalle sin encabezado de tercero." }); continue; }
      const fecha = parseFechaDia(row[iFecha]);
      const valor = limpiarMonto(row[iCred]);
      if (!fecha) { errores.push({ fila: r + 1, documento: doc, motivo: "Fecha inválida." }); continue; }
      if (valor == null || valor <= 0) { errores.push({ fila: r + 1, documento: doc, motivo: "Valor inválido o cero." }); continue; }
      const notas = iNotas >= 0 ? txt(row[iNotas]) : "";
      movimientos.push({
        documento: doc, fecha, anio: fecha.getFullYear(), mes: fecha.getMonth() + 1,
        tipo: DIRECCION[tipo], terceroNombre: tercero, nit: null, beneficiario: null,
        detalle: notas || null, observacion: `${doc} · C.O. ${co || "—"}`, valor,
      });
    } else if (co && co.toLowerCase() !== "gran total" && !doc) {
      // Fila de encabezado/subtotal de tercero: fija el tercero actual.
      tercero = co;
    }
  }
  return { movimientos, errores, totalDetalle, omitidos };
}

// PEL: tabla plana de pagos electrónicos.
function parsePel(rows: Matriz): Omit<ResultadoParse, "tipo" | "direccion" | "hojasIgnoradas"> {
  const hr = buscarEncabezado(rows, ["Documento", "Valor docto."]);
  if (hr === -1) return { movimientos: [], errores: [{ fila: 0, documento: null, motivo: "No se encontró el encabezado (Documento / Valor docto.)." }], totalDetalle: 0, omitidos: 0 };
  const H = rows[hr] ?? [];
  const iCuenta = idxCol(H, "Descripción cuenta");
  const iDoc = idxCol(H, "Documento");
  const iFecha = idxCol(H, "Fecha docto.");
  const iValor = idxCol(H, "Valor docto.");
  const iRazon = idxCol(H, "Razón social tercero");
  const iBenef = idxCol(H, "Beneficiario");
  const iNotas = idxCol(H, "Notas");
  const iEstado = idxCol(H, "Estado documento");

  const movimientos: MovimientoParseado[] = [];
  const errores: FilaError[] = [];
  let totalDetalle = 0, omitidos = 0;

  for (let r = hr + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row) continue;
    const doc = txt(row[iDoc]);
    if (!/^PEL-\d+/.test(doc)) continue;
    totalDetalle++;
    const estado = iEstado >= 0 ? txt(row[iEstado]) : "Aprobado";
    if (estado && estado.toLowerCase() !== "aprobado") { omitidos++; continue; }
    const fecha = parseFechaDia(row[iFecha]);
    const valor = limpiarMonto(row[iValor]);
    const tercero = iRazon >= 0 ? txt(row[iRazon]) : "";
    if (!tercero) { errores.push({ fila: r + 1, documento: doc, motivo: "Sin razón social del tercero." }); continue; }
    if (!fecha) { errores.push({ fila: r + 1, documento: doc, motivo: "Fecha inválida." }); continue; }
    if (valor == null || valor <= 0) { errores.push({ fila: r + 1, documento: doc, motivo: "Valor inválido o cero." }); continue; }
    movimientos.push({
      documento: doc, fecha, anio: fecha.getFullYear(), mes: fecha.getMonth() + 1,
      tipo: "egreso", terceroNombre: tercero, nit: null,
      beneficiario: iBenef >= 0 ? txt(row[iBenef]) || null : null,
      detalle: iNotas >= 0 ? txt(row[iNotas]) || null : null,
      observacion: `${doc} · ${iCuenta >= 0 ? txt(row[iCuenta]) : ""}`.trim().replace(/ · $/, ""),
      valor,
    });
  }
  return { movimientos, errores, totalDetalle, omitidos };
}

// RDC: relación de recaudos, agrupada por medio de pago. Columnas fijas.
function parseRdc(rows: Matriz): Omit<ResultadoParse, "tipo" | "direccion" | "hojasIgnoradas"> {
  const C = { doc: 0, fecha: 2, cliente: 4, cobrador: 6, cta: 7, valor: 10 };
  const movimientos: MovimientoParseado[] = [];
  const errores: FilaError[] = [];
  let medio = "";
  let totalDetalle = 0;

  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    if (!row) continue;
    const celdas = row.map((c) => txt(c));
    // Título de grupo: fila con marcador "[" … "]".
    const br = celdas.indexOf("[");
    if (br >= 0) {
      const nombre = celdas.slice(br + 1).find((x) => x && x !== "]");
      if (nombre) medio = nombre;
      continue;
    }
    const doc = txt(row[C.doc]);
    if (!/^RDC-\d+/.test(doc)) continue;
    totalDetalle++;
    const fecha = parseFechaDia(row[C.fecha]);
    const { nit, nombre } = splitNitNombre(row[C.cliente]);
    const valor = limpiarMonto(row[C.valor]);
    const cobrador = txt(row[C.cobrador]);
    const cta = txt(row[C.cta]);
    if (!nombre) { errores.push({ fila: r + 1, documento: doc, motivo: "Sin cliente." }); continue; }
    if (!fecha) { errores.push({ fila: r + 1, documento: doc, motivo: "Fecha inválida." }); continue; }
    if (valor == null || valor <= 0) { errores.push({ fila: r + 1, documento: doc, motivo: "Valor inválido o cero." }); continue; }
    movimientos.push({
      documento: doc, fecha, anio: fecha.getFullYear(), mes: fecha.getMonth() + 1,
      tipo: "ingreso", terceroNombre: nombre, nit,
      beneficiario: null,
      detalle: medio ? `${doc} · ${medio}` : doc,
      observacion: `Cobrador ${cobrador || "—"} · Cta ${cta || "—"}`,
      valor,
    });
  }
  return { movimientos, errores, totalDetalle, omitidos: 0 };
}

// ---------- Entrada principal ----------

/** Lee un archivo SIESA (buffer del .xls/.xlsx) y devuelve movimientos + errores. */
export function parsearArchivo(buffer: Buffer | ArrayBuffer, tipoForzado?: TipoReporte): ResultadoParse {
  const wb = XLSX.read(buffer, { cellDates: true });
  const name0 = wb.SheetNames[0];
  if (!name0) throw new Error("El archivo no tiene hojas.");
  const ws = wb.Sheets[name0];
  if (!ws) throw new Error("No se pudo leer la primera hoja del archivo.");
  const rows = XLSX.utils.sheet_to_json<(string | number)[]>(ws, { header: 1, raw: false, defval: "" });

  const tipo = tipoForzado ?? detectarTipo(rows);
  if (!tipo) throw new Error("No se pudo reconocer el tipo de reporte (¿OCC/NGC/NBA/PEL/RDC?).");

  const base =
    tipo === "PEL" ? parsePel(rows) :
    tipo === "RDC" ? parseRdc(rows) :
    parsePcga(rows, tipo);

  return { tipo, direccion: DIRECCION[tipo], hojasIgnoradas: wb.SheetNames.length - 1, ...base };
}
