// ==========================================================
// Parser del archivo "Flujo de Caja Diario" (hoja "Flujo Caja"): ledger manual
// con una fila por movimiento. Columnas: FECHA, MOVIMIENTO (INGRESO/EGRESO),
// GRUPOS (categoría del egreso), TERCERO, Nit, Beneficiario, DETALLE
// MOVIMIENTO, OBSERVACIÓN, VALOR, SALDO, MES. Módulo PURO (sin BD).
// Lo usa la sincronización desde OneDrive (src/lib/negocio/sync-flujo).
// ==========================================================
import * as XLSX from "xlsx";

export type TipoMov = "ingreso" | "egreso";

export interface MovFlujo {
  fecha: Date; anio: number; mes: number;
  tipo: TipoMov;
  grupo: string | null;      // GRUPOS → CategoriaFlujo (null en ingresos)
  terceroNombre: string;
  nit: string | null;
  beneficiario: string | null;
  detalle: string | null;
  observacion: string | null;
  valor: number;
  saldo: number | null;
}

export interface FlujoParseado { hoja: string; movimientos: MovFlujo[]; omitidas: number; }

const norm = (s: unknown) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();

function num(v: unknown): number {
  if (v == null || v === "") return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const s = String(v).replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(/,/g, ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function fecha(v: unknown): Date | null {
  if (v instanceof Date && !isNaN(v.getTime())) return new Date(Date.UTC(v.getFullYear(), v.getMonth(), v.getDate()));
  if (typeof v === "number" && Number.isFinite(v)) { const p = XLSX.SSF?.parse_date_code?.(v); if (p && p.y) return new Date(Date.UTC(p.y, p.m - 1, p.d)); }
  if (typeof v === "string") {
    const m = v.trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})/); if (m) return new Date(Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!));
    const m2 = v.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/); if (m2) return new Date(Date.UTC(+m2[3]!, +m2[2]! - 1, +m2[1]!));
  }
  return null;
}

function texto(v: unknown): string | null { const s = String(v ?? "").trim(); return s === "" ? null : s; }

/** Parsea el buffer del .xlsx y devuelve los movimientos de la hoja "Flujo Caja". */
export function parseFlujoDiario(buffer: Buffer): FlujoParseado {
  const wb = XLSX.read(buffer, { cellDates: true, dense: true });
  // Elige la hoja "Flujo Caja" (o la que tenga MOVIMIENTO + GRUPOS y sea la más nueva).
  const nombre = wb.SheetNames.find((n) => norm(n) === "flujo caja")
    ?? wb.SheetNames.find((n) => { const ws = wb.Sheets[n]; return ws && String(XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true }).slice(0, 6).flat().map(norm).join("|")).includes("movimiento"); });
  if (!nombre) throw new Error('No se encontró la hoja "Flujo Caja" (columna MOVIMIENTO).');
  const ws = wb.Sheets[nombre]!;
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: null, blankrows: false });

  const hr = aoa.findIndex((r) => (r ?? []).some((c) => norm(c) === "movimiento"));
  if (hr < 0) throw new Error('La hoja no tiene encabezado con la columna "MOVIMIENTO".');
  const H = (aoa[hr] as unknown[]).map(norm);
  const ix = (...alias: string[]) => { for (const a of alias) { const i = H.indexOf(norm(a)); if (i >= 0) return i; } return -1; };
  const C = {
    fecha: ix("fecha"), mov: ix("movimiento"), grupo: ix("grupos", "grupo"),
    tercero: ix("tercero"), nit: ix("nit"), benef: ix("beneficiario"),
    detalle: ix("detalle movimiento", "detalle"), obs: ix("observacion", "observación"),
    valor: ix("valor"), saldo: ix("saldo"),
  };
  if (C.fecha < 0 || C.mov < 0 || C.valor < 0) throw new Error("Faltan columnas FECHA / MOVIMIENTO / VALOR.");

  const movimientos: MovFlujo[] = [];
  let omitidas = 0;
  for (const r of aoa.slice(hr + 1)) {
    const f = fecha(r?.[C.fecha]);
    const movRaw = norm(r?.[C.mov]);
    const tipo: TipoMov | null = movRaw === "ingreso" ? "ingreso" : movRaw === "egreso" ? "egreso" : null;
    if (!f || !tipo) { omitidas++; continue; }
    movimientos.push({
      fecha: f, anio: f.getUTCFullYear(), mes: f.getUTCMonth() + 1, tipo,
      grupo: texto(r?.[C.grupo]),
      terceroNombre: texto(r?.[C.tercero]) ?? "(sin tercero)",
      nit: texto(r?.[C.nit]),
      beneficiario: texto(r?.[C.benef]),
      detalle: texto(r?.[C.detalle]),
      observacion: texto(r?.[C.obs]),
      valor: num(r?.[C.valor]),
      saldo: C.saldo >= 0 && r?.[C.saldo] != null ? num(r[C.saldo]) : null,
    });
  }
  return { hoja: nombre, movimientos, omitidas };
}
