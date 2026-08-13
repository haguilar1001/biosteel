// ==========================================================
// Parseo puro (sin BD) de los 4 archivos de S1ESA del módulo PENDIENTES.
// Resuelve columnas por NOMBRE (tolerante a reordenamientos) y normaliza
// montos con formato "$ 5.960.759,00" y fechas. Lo usan tanto la carga por
// formulario (src/lib/negocio/carga-siesa) como el importador CLI
// (prisma/set-pendientes).
// ==========================================================
import * as XLSX from "xlsx";

export type DatasetKey = "facturacion" | "gastos" | "anuladas" | "pendientes" | "ventas";

export const DATASETS: { clave: DatasetKey; titulo: string }[] = [
  { clave: "pendientes", titulo: "Pedidos pendientes acumulados" },
  { clave: "ventas", titulo: "Ventas (facturas por ítem)" },
  { clave: "facturacion", titulo: "Datos facturación" },
  { clave: "gastos", titulo: "Gastos" },
  { clave: "anuladas", titulo: "Motivo facturas anuladas" },
];

export interface Parseado { hoja: string; rows: Record<string, unknown>[]; omitidas: number; }

// ---------- Helpers ----------

const norm = (s: unknown) =>
  String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

/** Monto: número o texto tipo "$ 5.960.759,00" (miles ".", decimal ","). */
export function money(v: unknown): number {
  if (v == null || v === "") return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  let s = String(v).replace(/\s/g, "").replace(/\$/g, "");
  const neg = /^-/.test(s) || /^\(/.test(s);
  s = s.replace(/[()]/g, "").replace(/-/g, "").replace(/\./g, "").replace(/,/g, ".");
  const n = Number(s);
  return Number.isFinite(n) ? (neg ? -n : n) : 0;
}

/** Fecha → Date UTC (solo Y-M-D) o null. Acepta Date, "YYYY-MM-DD", "d/m/Y" y serial. */
export function fecha(v: unknown): Date | null {
  if (v instanceof Date && !isNaN(v.getTime())) return new Date(Date.UTC(v.getFullYear(), v.getMonth(), v.getDate()));
  if (typeof v === "number" && Number.isFinite(v)) {
    const p = XLSX.SSF?.parse_date_code?.(v);
    if (p && p.y) return new Date(Date.UTC(p.y, p.m - 1, p.d));
  }
  if (typeof v === "string") {
    const s = v.trim();
    let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) return new Date(Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!));
    m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (m) return new Date(Date.UTC(+m[3]!, +m[2]! - 1, +m[1]!));
    const d = new Date(s);
    if (!isNaN(d.getTime())) return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  }
  return null;
}

function texto(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

function diasEntre(a: Date | null, b: Date | null): number | null {
  if (!a || !b) return null;
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

function anioMes(f: Date) { return { anio: f.getUTCFullYear(), mes: f.getUTCMonth() + 1 }; }

// ---------- Lectura de hoja + resolución de columnas ----------

interface Hoja { nombre: string; headers: string[]; filas: unknown[][]; }

/** Elige la primera hoja cuyo encabezado contenga TODAS las columnas requeridas. */
function leerHoja(buffer: Buffer, requeridas: string[]): Hoja {
  const wb = XLSX.read(buffer, { cellDates: true, dense: true });
  const req = requeridas.map(norm);
  for (const nombre of wb.SheetNames) {
    const ws = wb.Sheets[nombre];
    if (!ws) continue;
    const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: null, blankrows: false });
    for (let i = 0; i < Math.min(aoa.length, 5); i++) {
      const fila = (aoa[i] ?? []).map(norm);
      if (req.every((r) => fila.includes(r))) {
        return { nombre, headers: (aoa[i] as unknown[]).map((c) => norm(c)), filas: aoa.slice(i + 1) };
      }
    }
  }
  throw new Error(`No se encontró una hoja con las columnas requeridas (${requeridas.join(", ")}).`);
}

/** Lector de celdas por nombre de columna (con alias). */
function lector(h: Hoja) {
  const idx = new Map<string, number>();
  h.headers.forEach((name, i) => { if (!idx.has(name)) idx.set(name, i); });
  return (fila: unknown[]) => (...alias: string[]): unknown => {
    for (const a of alias) {
      const i = idx.get(norm(a));
      if (i != null) return fila[i];
    }
    return null;
  };
}

// ---------- Parsers por dataset ----------

export function parseFacturacion(buffer: Buffer): Parseado {
  const h = leerHoja(buffer, ["Nro documento", "Fecha", "Valor subtotal local"]);
  const get = lector(h);
  const rows: Record<string, unknown>[] = [];
  let omitidas = 0;
  for (const fila of h.filas) {
    const c = get(fila);
    const nro = texto(c("Nro documento"));
    const f = fecha(c("Fecha"));
    if (!nro || !f) { omitidas++; continue; }
    const { anio, mes } = anioMes(f);
    rows.push({
      nroDocumento: nro, fecha: f, anio, mes,
      estado: texto(c("Estado")) ?? "",
      clienteRazon: texto(c("Razon social cliente factura")) ?? "",
      costoPromedio: money(c("Costo promedio")),
      subtotal: money(c("Valor subtotal local")),
      impuestos: money(c("Valor impuestos local")),
      neto: money(c("Valor neto local")),
      utilidadPromedio: money(c("Utilidad promedio")),
      sucursal: texto(c("Desc. sucursal factura")),
      notasCredito: texto(c("Notas credito condicionadas")),
      pedidos: texto(c("Pedidos")),
      usuarioAprobacion: texto(c("Usuario aprobacion")),
      convenio: texto(c("Convenio")),
      fechaCx: fecha(c("Fecha cx")),
    });
  }
  return { hoja: h.nombre, rows, omitidas };
}

export function parseGastos(buffer: Buffer): Parseado {
  const h = leerHoja(buffer, ["Nro documento", "Fecha", "Valor subtotal local"]);
  const get = lector(h);
  const rows: Record<string, unknown>[] = [];
  let omitidas = 0;
  for (const fila of h.filas) {
    const c = get(fila);
    const nro = texto(c("Nro documento"));
    const f = fecha(c("Fecha"));
    if (!nro || !f) { omitidas++; continue; }
    const { anio, mes } = anioMes(f);
    const fAprob = fecha(c("Fecha aprobación", "Fecha aprobacion"));
    const fCumpl = fecha(c("Fecha cumplido"));
    // TimpoFacturado2 (DAX): Fecha cumplido − Fecha (0 si son iguales). null si no cumplido.
    const tiempoFact = fCumpl && f ? (fCumpl.getTime() === f.getTime() ? 0 : diasEntre(f, fCumpl)) : null;
    rows.push({
      nroDocumento: nro, fecha: f, anio, mes,
      estado: texto(c("Estado")) ?? "",
      clienteRazon: texto(c("Razón social cliente factura", "Razon social cliente factura")) ?? "",
      sucursal: texto(c("Desc. sucursal factura")),
      subtotal: money(c("Valor subtotal local")),
      valorBruto: money(c("Valor bruto")),
      impuestos: money(c("Valor impuestos")),
      fechaAprobacion: fAprob,
      fechaCumplido: fCumpl,
      diasFacturacion: tiempoFact,
      usuarioAprobacion: texto(c("Usuario aprobación", "Usuario aprobacion")),
      fechaCx: fecha(c("Fecha cx")),
      convenio: texto(c("Convenio")),
      numeroCaso: texto(c("Numero de Caso", "Numero de caso")),
      estadoPedidos: texto(c("Estado de pedidos")),
    });
  }
  return { hoja: h.nombre, rows, omitidas };
}

export function parseAnuladas(buffer: Buffer): Parseado {
  const h = leerHoja(buffer, ["Nro documento", "Fecha", "Motivo"]);
  const get = lector(h);
  const rows: Record<string, unknown>[] = [];
  let omitidas = 0;
  for (const fila of h.filas) {
    const c = get(fila);
    const nro = texto(c("Nro documento"));
    const f = fecha(c("Fecha"));
    if (!nro || !f) { omitidas++; continue; }
    const { anio, mes } = anioMes(f);
    rows.push({
      nroDocumento: nro, fecha: f, anio, mes,
      clienteRazon: texto(c("Razon social cliente factura", "Razón social cliente factura")) ?? "",
      subtotal: money(c("Valor subtotal local")),
      numeroCaso: texto(c("Numero de Caso", "Numero de caso")),
      paciente: texto(c("Paciente")),
      sucursal: texto(c("Desc. sucursal factura")),
      doc: texto(c("Doc")),
      nFactura: texto(c("N° Factura", "N Factura")),
      usuarioAprobacion: texto(c("Usuario aprobación", "Usuario aprobacion")),
      fechaFacturaBase: fecha(c("Fecha factura Base")),
      motivo: texto(c("Motivo")),
      descripcion: texto(c("Descripción", "Descripcion")),
      responsable: texto(c("Responsable")),
    });
  }
  return { hoja: h.nombre, rows, omitidas };
}

export function parsePendientes(buffer: Buffer): Parseado {
  const h = leerHoja(buffer, ["Nro documento", "Fecha", "Motivo pendiente"]);
  const get = lector(h);
  const rows: Record<string, unknown>[] = [];
  let omitidas = 0;
  for (const fila of h.filas) {
    const c = get(fila);
    const nro = texto(c("Nro documento"));
    const f = fecha(c("Fecha"));
    if (!nro || !f) { omitidas++; continue; }
    const { anio, mes } = anioMes(f);
    rows.push({
      nroDocumento: nro, fecha: f, anio, mes,
      estado: texto(c("Estado")) ?? "",
      clienteRazon: texto(c("Razón social cliente factura", "Razon social cliente factura")) ?? "",
      sucursal: texto(c("Desc. sucursal factura")),
      subtotal: money(c("Valor subtotal local")),
      valorBruto: money(c("Valor bruto")),
      impuestos: money(c("Valor impuestos")),
      fechaAprobacion: fecha(c("Fecha aprobación", "Fecha aprobacion")),
      fechaCumplido: fecha(c("Fecha cumplido")),
      usuarioAprobacion: texto(c("Usuario aprobación", "Usuario aprobacion")),
      fechaCx: fecha(c("Fecha cx")),
      convenio: texto(c("Convenio")),
      numeroCaso: texto(c("Numero de caso", "Numero de Caso")),
      motivoPendiente: texto(c("Motivo pendiente")),
      responsable: texto(c("Responsable")),
    });
  }
  return { hoja: h.nombre, rows, omitidas };
}

export function parseDataset(clave: DatasetKey, buffer: Buffer): Parseado {
  switch (clave) {
    case "facturacion": return parseFacturacion(buffer);
    case "gastos": return parseGastos(buffer);
    case "anuladas": return parseAnuladas(buffer);
    case "pendientes": return parsePendientes(buffer);
    case "ventas": throw new Error("El dataset 'ventas' se procesa aparte (renglón + recálculo de venta neta).");
  }
}
