// ==========================================================
// Importadores del INVENTARIO DE MATERIAL DE OSTEOSÍNTESIS (SIESA).
// Tres archivos independientes, cada uno con su parser y su persistidor:
//   · Tablas Auxiliares → InvBodega     (catálogo con la instalación)
//   · Balance mensual   → InvBalance    (saldo valorizado por instalación)
//   · Movimientos       → InvMovimiento (cada línea de documento)
//
// La instalación es la llave de la conciliación: el balance viene por
// instalación (101 propio · 102 consignación · 106 aprovechamiento) y los
// movimientos por bodega, así que sin el catálogo completo no cuadran.
// ==========================================================
import "server-only";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/db";

const BATCH = 5000;

/** Instalaciones válidas del balance. En la 106 el costo es SIEMPRE 0. */
export const INSTALACIONES: Record<number, string> = {
  101: "Material propio",
  102: "Material en consignación",
  106: "Aprovechamiento",
};

// Bodegas que aparecen en los movimientos pero NO están en la hoja
// "CÓDIGOS DE BODEGA". Sin ellas, sus $5.667M de entradas caen en propio y
// descuadran la conciliación (feb y mar se iban en ±3.100 millones).
// Asignación confirmada por el usuario el 2026-08-19.
export const BODEGAS_INFERIDAS: Record<string, { instalacion: number; descripcion: string }> = {
  "905": { instalacion: 102, descripcion: "FALTANTE CONSIGNACION GENERAL" },
  "904": { instalacion: 102, descripcion: "FALTANTE CONSIGNACIÓN TODO ORTOPEDICO" },
  "122": { instalacion: 102, descripcion: "CONSIGNACION CM VALLESALUD PRINCIPAL" },
  "113": { instalacion: 102, descripcion: "CONSIGNACION TODO ORTOPÉDICO" },
  "412": { instalacion: 102, descripcion: "CONSIGNACION ORTOPSALUD" },
  "116": { instalacion: 101, descripcion: "ORTOSINTESE" },
  "114": { instalacion: 101, descripcion: "PRINCIPAL TODO ORTÓPEDICO" },
  "903": { instalacion: 101, descripcion: "AJUSTE FALTANTES CM VALLE SALUD PRINCIPAL" },
  "906": { instalacion: 101, descripcion: "FALTANTE PRINCIPAL TODO ORTOPEDICO" },
  "117": { instalacion: 101, descripcion: "SELSALUD PRINCIPAL YOPAL" },
  "950": { instalacion: 101, descripcion: "HOSPITAL FRAY LUIS DE LEON DE PLATO" },
};

const MESES = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO",
  "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"];

// ---------- utilidades ----------

const txt = (v: unknown): string => (v == null ? "" : String(v).trim());

const num = (v: unknown): number => {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const s = String(v ?? "").replace(/[^\d.,-]/g, "");
  const n = Number(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s);
  return Number.isFinite(n) ? n : 0;
};

/** Índice de columnas por nombre exacto de encabezado. */
function encabezados(fila: unknown[]): Map<string, number> {
  const m = new Map<string, number>();
  fila.forEach((c, i) => { const k = txt(c); if (k && !m.has(k)) m.set(k, i); });
  return m;
}

function exigir(h: Map<string, number>, ...nombres: string[]): number {
  for (const n of nombres) { const i = h.get(n); if (i != null) return i; }
  throw new Error(`No se encontró la columna "${nombres[0]}" en el archivo.`);
}

async function porLotes<T>(rows: T[], escribir: (lote: T[]) => Promise<unknown>): Promise<void> {
  for (let i = 0; i < rows.length; i += BATCH) await escribir(rows.slice(i, i + BATCH));
}

// ---------- 1) Tablas Auxiliares → InvBodega ----------

export interface BodegaParsed {
  codigo: string; descripcion: string; ciudad: string;
  tipoCompra: string; modeloCompra: string; instalacion: number; inferida: boolean;
}

export function parseTablasAuxiliares(buffer: Buffer): BodegaParsed[] {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const hoja = wb.SheetNames.find((n) => n.toUpperCase().includes("BODEGA"));
  if (!hoja) throw new Error('El archivo no tiene la hoja "CÓDIGOS DE BODEGA".');
  const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[hoja]!, { header: 1, defval: null });
  const h = encabezados(rows[0] ?? []);
  const iCod = exigir(h, "CODIGO BODEGA");
  const iDesc = exigir(h, "Desc. bodega");
  const iInst = exigir(h, "INSTALACIÓN", "INSTALACION");
  const iCiu = h.get("CIUDAD"), iTipo = h.get("TIPO DE COMPRA"), iMod = h.get("MODELO DE COMPRAS");

  const out = new Map<string, BodegaParsed>();
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i]; if (!r) continue;
    const codigo = txt(r[iCod]); if (!codigo) continue;
    const instalacion = Math.trunc(num(r[iInst]));
    if (!INSTALACIONES[instalacion]) {
      throw new Error(`La bodega ${codigo} tiene instalación "${txt(r[iInst])}"; solo se admiten 101, 102 o 106.`);
    }
    out.set(codigo, {
      codigo, descripcion: txt(r[iDesc]), ciudad: iCiu != null ? txt(r[iCiu]) : "",
      tipoCompra: iTipo != null ? txt(r[iTipo]) : "", modeloCompra: iMod != null ? txt(r[iMod]) : "",
      instalacion, inferida: false,
    });
  }
  // Completar las bodegas que el catálogo no trae (ver BODEGAS_INFERIDAS).
  for (const [codigo, def] of Object.entries(BODEGAS_INFERIDAS)) {
    if (out.has(codigo)) continue;
    out.set(codigo, {
      codigo, descripcion: def.descripcion, ciudad: "", tipoCompra: "",
      modeloCompra: "", instalacion: def.instalacion, inferida: true,
    });
  }
  return [...out.values()];
}

export async function persistirBodegas(bodegas: BodegaParsed[]): Promise<number> {
  for (const b of bodegas) {
    await prisma.invBodega.upsert({ where: { codigo: b.codigo }, update: b, create: b });
  }
  return bodegas.length;
}

// ---------- 2) Balance mensual → InvBalance ----------

export interface BalanceParsed {
  anio: number; mes: number; hoja: string; filas: number; datos: Record<string, unknown>[];
}

/**
 * Deduce el periodo del nombre de la hoja o del archivo ("BALANCE ENERO",
 * "BALANCE DICIEMBRE 25"). Si no trae año, asume el año en curso.
 */
export function periodoDeNombre(nombre: string, anioPorDefecto: number): { anio: number; mes: number } | null {
  const N = nombre.toUpperCase();
  const mes = MESES.findIndex((m) => N.includes(m)) + 1;
  if (!mes) return null;
  const m4 = N.match(/\b(20\d{2})\b/);
  if (m4) return { anio: Number(m4[1]), mes };
  const m2 = (N.match(/\b\d{2}\b/g) ?? []).map(Number).find((n) => n >= 20 && n <= 99);
  return { anio: m2 ? 2000 + m2 : anioPorDefecto, mes };
}

export function parseBalance(buffer: Buffer, nombreArchivo: string, anioPorDefecto = new Date().getFullYear()): BalanceParsed {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const hoja = wb.SheetNames[0]!;
  const periodo = periodoDeNombre(hoja, anioPorDefecto) ?? periodoDeNombre(nombreArchivo, anioPorDefecto);
  if (!periodo) throw new Error(`No pude deducir el mes: ni la hoja ("${hoja}") ni el archivo ("${nombreArchivo}") nombran un mes.`);

  const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[hoja]!, { header: 1, defval: null });
  const h = encabezados(rows[0] ?? []);
  const iItem = exigir(h, "Item"), iRef = exigir(h, "Referencia"), iInst = exigir(h, "Instalación");
  const iDesc = h.get("Desc. item"), iTipo = h.get("Tipo inventario");
  const iCE = exigir(h, "Entradas (cant.)"), iCS = exigir(h, "Salidas (cant.)"), iCF = exigir(h, "Saldo final (cant.)");
  const iVI = exigir(h, "Saldo inicial (prom.)"), iVE = exigir(h, "Entradas (prom.)");
  const iVS = exigir(h, "Salidas (prom.)"), iVF = exigir(h, "Saldo final (prom.)");
  const iMar = h.get("MARCA"), iLin = h.get("LÍNEA"), iAna = h.get("ANATOMIA");
  const iSis = h.get("SISTEMA"), iCat = h.get("CATEGORIA");

  const datos: Record<string, unknown>[] = [];
  const vistas = new Set<string>();
  let leidas = 0;
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i]; if (!r) continue;
    const item = txt(r[iItem]);
    // "Gran total" es la fila de totales del reporte, no un ítem.
    if (!item || item.toUpperCase().startsWith("GRAN TOTAL")) continue;
    leidas++;
    const cantEntradas = num(r[iCE]), cantSalidas = num(r[iCS]), cantFinal = num(r[iCF]);
    const valorInicial = num(r[iVI]), valorEntradas = num(r[iVE]);
    const valorSalidas = num(r[iVS]), valorFinal = num(r[iVF]);
    // El archivo trae ~30.8k filas por mes y la mayoría está toda en cero.
    if (!cantEntradas && !cantSalidas && !cantFinal && !valorInicial && !valorEntradas && !valorSalidas && !valorFinal) continue;
    const instalacion = Math.trunc(num(r[iInst]));
    const llave = `${instalacion}|${item}`;
    if (vistas.has(llave)) continue; // el reporte no debería repetir Ítem × Instalación
    vistas.add(llave);
    datos.push({
      anio: periodo.anio, mes: periodo.mes, instalacion,
      item, referencia: txt(r[iRef]),
      descripcion: iDesc != null ? txt(r[iDesc]) : "", tipoInv: iTipo != null ? txt(r[iTipo]) : "",
      marca: iMar != null ? txt(r[iMar]) : "", linea: iLin != null ? txt(r[iLin]) : "",
      anatomia: iAna != null ? txt(r[iAna]) : "", sistema: iSis != null ? txt(r[iSis]) : "",
      categoria: iCat != null ? txt(r[iCat]) : "",
      cantEntradas, cantSalidas, cantFinal, valorInicial, valorEntradas, valorSalidas, valorFinal,
    });
  }
  return { ...periodo, hoja, filas: leidas, datos };
}

/** Reemplaza el balance del mes (idempotente: se puede recargar el archivo). */
export async function persistirBalance(b: BalanceParsed): Promise<number> {
  await prisma.invBalance.deleteMany({ where: { anio: b.anio, mes: b.mes } });
  await porLotes(b.datos, (lote) => prisma.invBalance.createMany({ data: lote as never, skipDuplicates: true }));
  return b.datos.length;
}

// ---------- 3) Movimientos → InvMovimiento ----------

export interface MovimientosParsed {
  hoja: string; filas: number; periodos: string[];
  /** Bodegas ausentes del catálogo que el propio archivo ubica (se dan de alta). */
  bodegasNuevas: Map<string, { descripcion: string; instalacion: number }>;
  /** Bodegas ausentes y sin instalación en el archivo: no se pueden cargar. */
  bodegasDesconocidas: Map<string, string>;
  /** Bodegas donde el catálogo y el archivo no coinciden (manda el archivo). */
  choques: Map<string, { catalogo: number; archivo: number; movs: number }>;
  datos: Record<string, unknown>[];
}

/** Excel serial o Date → Date en UTC (solo la parte de fecha). */
function fecha(v: unknown): Date | null {
  if (v instanceof Date) return new Date(Date.UTC(v.getUTCFullYear(), v.getUTCMonth(), v.getUTCDate()));
  if (typeof v === "number" && v > 0) {
    const d = XLSX.SSF.parse_date_code(v);
    if (d) return new Date(Date.UTC(d.y, d.m - 1, d.d));
  }
  const s = txt(v); if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function parseMovimientos(buffer: Buffer, catalogo: Map<string, number>): MovimientosParsed {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const hoja = wb.SheetNames[0]!;
  const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[hoja]!, { header: 1, defval: null });
  const h = encabezados(rows[0] ?? []);
  const iFec = exigir(h, "Fecha"), iBod = exigir(h, "Bodega");
  const iRef = exigir(h, "Referencia"), iDoc = exigir(h, "Documento");
  const iDesc = h.get("Desc. item"), iLote = h.get("Lote"), iTipo = h.get("Desc. tipo docto.");
  const iBodDesc = h.get("Desc. bodega");
  const iOrd = h.get("Orden interno"), iUsr = h.get("Usuario creación"), iNot = h.get("Notas documento");
  const iCE = exigir(h, "Entradas (inv.)"), iCS = exigir(h, "Salidas (inv.)");
  const iVE = exigir(h, "Costo entradas (prom.)"), iVS = exigir(h, "Costo salidas (prom.)");
  const iVU = h.get("Costo unitario (prom.)");
  const iMar = h.get("MARCA"), iLin = h.get("LÍNEA"), iAna = h.get("ANATOMIA");
  // Los export por mes traen la instalación; el consolidado viejo no.
  const iInst = h.get("Instalación") ?? h.get("Instalacion");

  const datos: Record<string, unknown>[] = [];
  const periodos = new Set<string>();
  const bodegasNuevas = new Map<string, { descripcion: string; instalacion: number }>();
  const bodegasDesconocidas = new Map<string, string>();
  const choques = new Map<string, { catalogo: number; archivo: number; movs: number }>();
  let leidas = 0;

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i]; if (!r) continue;
    const documento = txt(r[iDoc]); if (!documento) continue;
    leidas++;
    const f = fecha(r[iFec]);
    if (!f) continue;
    const bodegaCodigo = txt(r[iBod]);
    const bodegaDesc = iBodDesc != null ? txt(r[iBodDesc]) : "";
    const delCatalogo = catalogo.get(bodegaCodigo);
    const delArchivo = iInst != null && r[iInst] != null ? Math.trunc(num(r[iInst])) : undefined;
    const instalacion = delArchivo ?? delCatalogo;
    // Sin instalación no se puede conciliar: se reporta en vez de cargarse a ciegas.
    if (instalacion == null || !INSTALACIONES[instalacion]) {
      bodegasDesconocidas.set(bodegaCodigo, bodegaDesc);
      continue;
    }
    if (delCatalogo == null) {
      bodegasNuevas.set(bodegaCodigo, { descripcion: bodegaDesc, instalacion });
    } else if (delArchivo != null && delArchivo !== delCatalogo) {
      const c = choques.get(bodegaCodigo) ?? { catalogo: delCatalogo, archivo: delArchivo, movs: 0 };
      c.movs++; choques.set(bodegaCodigo, c);
    }
    const anio = f.getUTCFullYear(), mes = f.getUTCMonth() + 1;
    periodos.add(`${anio}-${String(mes).padStart(2, "0")}`);
    datos.push({
      fecha: f, anio, mes, bodegaCodigo, instalacion: delArchivo ?? null,
      referencia: txt(r[iRef]), descripcion: iDesc != null ? txt(r[iDesc]) : "",
      lote: iLote != null ? txt(r[iLote]) : "",
      documento, tipoDoc: documento.slice(0, 3).toUpperCase(),
      descTipoDoc: iTipo != null ? txt(r[iTipo]) : "",
      ordenInterno: iOrd != null ? txt(r[iOrd]) : "",
      cantEntradas: num(r[iCE]), cantSalidas: num(r[iCS]),
      costoEntradas: num(r[iVE]), costoSalidas: num(r[iVS]),
      costoUnit: iVU != null ? num(r[iVU]) : 0,
      marca: iMar != null ? txt(r[iMar]) : "", linea: iLin != null ? txt(r[iLin]) : "",
      anatomia: iAna != null ? txt(r[iAna]) : "",
      usuario: iUsr != null ? txt(r[iUsr]) : "", notas: iNot != null ? txt(r[iNot]) : "",
    });
  }
  return { hoja, filas: leidas, periodos: [...periodos].sort(), bodegasNuevas, bodegasDesconocidas, choques, datos };
}

/**
 * Reemplaza los movimientos de los meses presentes en el archivo. SIESA tarda
 * en consolidar, así que el mismo mes se vuelve a exportar varias veces y hay
 * que reemplazarlo entero, no acumular.
 */
export async function persistirMovimientos(m: MovimientosParsed): Promise<number> {
  // Las bodegas que el archivo ubica pero el catálogo no tiene se dan de alta
  // (marcadas como inferidas), para no perder sus movimientos.
  for (const [codigo, def] of m.bodegasNuevas) {
    await prisma.invBodega.upsert({
      where: { codigo },
      update: {},
      create: { codigo, descripcion: def.descripcion, instalacion: def.instalacion, inferida: true },
    });
  }
  for (const p of m.periodos) {
    const [anio, mes] = p.split("-").map(Number);
    await prisma.invMovimiento.deleteMany({ where: { anio, mes } });
  }
  await porLotes(m.datos, (lote) => prisma.invMovimiento.createMany({ data: lote as never, skipDuplicates: true }));
  return m.datos.length;
}
