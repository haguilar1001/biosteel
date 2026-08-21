// ==========================================================
// Carga de los archivos SIESA del MÓDULO DE COMPRAS:
//   · ORDENES DE COMPRA.xlsx       → CompraOrden      (renglón de ODC)
//   · PENDIENTES POR DESPACHO.xlsx → CompraPendiente  (foto del día)
//   · FACTURAS PROVEEDORES.xlsx    → CompraFactura    (documentos CCP)
//   · ENTRADAS POR COMPRAS.xlsx    → EntradaProveedor (documento → proveedor)
//
// El VALOR de las entradas no se carga: ya vive en InvMovimiento con tipoDoc
// EPC (ver inventario de osteosíntesis), y es el que cuadra con Power BI. Del
// reporte de entradas solo se guarda a quién se le compró cada documento,
// que es lo único que el movimiento de inventario no sabe.
//
// Estrategias de escritura, distintas a propósito:
//   · Órdenes  → reemplaza los MESES presentes en el archivo. No hay llave
//     natural (una orden repite referencia+bodega en 98 de 46k renglones) y
//     SIESA reexporta el mismo mes varias veces mientras se cumple.
//   · Pendientes → reemplaza TODO. Es una foto: lo que ya no está pendiente
//     desaparece del archivo, así que acumular dejaría fantasmas.
//   · Facturas → upsert por nro de documento, que sí es único.
// ==========================================================
import "server-only";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/db";

const BATCH = 5000;

const txt = (v: unknown): string => (v == null ? "" : String(v).trim());

/** Monto/cantidad: número o texto tipo "$ 5.960.759,00" (miles ".", decimal ","). */
const num = (v: unknown): number => {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const s = String(v ?? "").replace(/[^\d.,-]/g, "");
  const n = Number(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s);
  return Number.isFinite(n) ? n : 0;
};

/** Excel serial, Date o texto → Date UTC (solo Y-M-D) o null. */
function fecha(v: unknown): Date | null {
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return new Date(Date.UTC(v.getUTCFullYear(), v.getUTCMonth(), v.getUTCDate()));
  }
  if (typeof v === "number" && v > 0) {
    const d = XLSX.SSF.parse_date_code(v);
    if (d?.y) return new Date(Date.UTC(d.y, d.m - 1, d.d));
  }
  const s = txt(v);
  if (!s) return null;
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return new Date(Date.UTC(+m[3]!, +m[2]! - 1, +m[1]!));
  const d = new Date(s);
  return Number.isNaN(d.getTime())
    ? null
    : new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** Índice de columnas por nombre de encabezado, tolerante a tildes y mayúsculas. */
function encabezados(fila: unknown[]): Map<string, number> {
  const m = new Map<string, number>();
  fila.forEach((c, i) => {
    const k = norm(c);
    if (k && !m.has(k)) m.set(k, i);
  });
  return m;
}

const norm = (s: unknown) =>
  String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/\s+/g, " ").trim();

function col(h: Map<string, number>, ...nombres: string[]): number | undefined {
  for (const n of nombres) {
    const i = h.get(norm(n));
    if (i != null) return i;
  }
  return undefined;
}

function exigir(h: Map<string, number>, ...nombres: string[]): number {
  const i = col(h, ...nombres);
  if (i == null) throw new Error(`No se encontró la columna "${nombres[0]}" en el archivo.`);
  return i;
}

/**
 * Primera hoja cuyo encabezado (en las primeras 5 filas) traiga todas las
 * columnas requeridas. SIESA cambia el nombre de la hoja cada año
 * ("FACTURADO PROVEEDOR 2025") y a veces deja hojas sueltas de trabajo.
 */
function leerHoja(buffer: Buffer, requeridas: string[]): { hoja: string; h: Map<string, number>; filas: unknown[][] } {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true, dense: true });
  const req = requeridas.map(norm);
  for (const nombre of wb.SheetNames) {
    const ws = wb.Sheets[nombre];
    if (!ws) continue;
    const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: null, blankrows: false });
    for (let i = 0; i < Math.min(aoa.length, 5); i++) {
      const fila = (aoa[i] ?? []).map(norm);
      if (req.every((r) => fila.includes(r))) {
        return { hoja: nombre, h: encabezados(aoa[i] ?? []), filas: aoa.slice(i + 1) };
      }
    }
  }
  throw new Error(`No se encontró una hoja con las columnas requeridas (${requeridas.join(", ")}).`);
}

async function porLotes<T>(rows: T[], escribir: (lote: T[]) => Promise<unknown>, tam = BATCH): Promise<void> {
  for (let i = 0; i < rows.length; i += tam) {
    const lote = rows.slice(i, i + tam);
    // El proxy de Railway corta la conexión con lotes grandes; reintentar el
    // lote en trozos más chicos evita rehacer el archivo entero.
    try {
      await escribir(lote);
    } catch (e) {
      if (tam <= 250) throw e;
      await porLotes(lote, escribir, Math.floor(tam / 4));
    }
  }
}

export interface ComprasParsed {
  hoja: string;
  /** Renglones leídos del archivo (antes de descartar). */
  filas: number;
  omitidas: number;
  periodos: string[];
  datos: Record<string, unknown>[];
}

// ---------- 1) Órdenes de compra generadas ----------

export function parseOrdenes(buffer: Buffer): ComprasParsed {
  const { hoja, h, filas } = leerHoja(buffer, ["Nro orden", "Referencia", "Valor neto"]);
  const iFec = exigir(h, "FECHA ORDEN", "Fecha orden");
  const iNro = exigir(h, "Nro orden");
  const iRef = exigir(h, "Referencia");
  const iBod = col(h, "Bodega"), iBodD = col(h, "Desc. bodega");
  const iItem = col(h, "Desc. item");
  const iCant = col(h, "Cant. ordenada");
  const iBruto = col(h, "Valor bruto local", "Valor bruto");
  const iNeto = exigir(h, "Valor neto");
  const iProv = col(h, "Razón social proveedor");
  const iEst = col(h, "Estado");
  const iTipo = col(h, "Desc. tipo docto.");
  const iNotas = col(h, "Notas documento");
  const iMarca = col(h, "MARCA DEL PRODUCTO", "MARCA");
  const iLinea = col(h, "LÍNEA (GRUPO)", "LÍNEA", "LINEA");
  const iAnat = col(h, "ANATOMIA ( SUBGRUPO 1)", "ANATOMIA");

  const datos: Record<string, unknown>[] = [];
  const periodos = new Set<string>();
  let leidas = 0, omitidas = 0;

  for (const r of filas) {
    if (!r) continue;
    const nroOrden = txt(r[iNro]);
    if (!nroOrden) continue;
    leidas++;
    const f = fecha(r[iFec]);
    // Sin fecha no entra a ningún periodo: no se puede reemplazar ni filtrar.
    if (!f) { omitidas++; continue; }
    const anio = f.getUTCFullYear(), mes = f.getUTCMonth() + 1;
    periodos.add(`${anio}-${String(mes).padStart(2, "0")}`);
    datos.push({
      fechaOrden: f, anio, mes, dia: f.getUTCDate(),
      nroOrden, prefijo: nroOrden.slice(0, 3).toUpperCase(),
      bodegaCodigo: iBod != null ? txt(r[iBod]) : "",
      bodegaDesc: iBodD != null ? txt(r[iBodD]) : "",
      // SIESA rellena la referencia con espacios a 50 caracteres.
      referencia: txt(r[iRef]),
      descItem: iItem != null ? txt(r[iItem]) : "",
      cantOrdenada: iCant != null ? num(r[iCant]) : 0,
      valorBruto: iBruto != null ? num(r[iBruto]) : 0,
      valorNeto: num(r[iNeto]),
      proveedor: iProv != null ? txt(r[iProv]) : "",
      estado: iEst != null ? txt(r[iEst]) : "",
      tipoDocto: iTipo != null ? txt(r[iTipo]) : "",
      notas: iNotas != null ? txt(r[iNotas]) : "",
      marca: iMarca != null ? txt(r[iMarca]) : "",
      linea: iLinea != null ? txt(r[iLinea]) : "",
      anatomia: iAnat != null ? txt(r[iAnat]) : "",
    });
  }
  return { hoja, filas: leidas, omitidas, periodos: [...periodos].sort(), datos };
}

/** Reemplaza los meses presentes en el archivo (ver nota de cabecera). */
export async function persistirOrdenes(p: ComprasParsed): Promise<number> {
  for (const per of p.periodos) {
    const [anio, mes] = per.split("-").map(Number);
    await prisma.compraOrden.deleteMany({ where: { anio, mes } });
  }
  await porLotes(p.datos, (lote) => prisma.compraOrden.createMany({ data: lote as never }));
  return p.datos.length;
}

// ---------- 2) Pendientes por despacho ----------

export function parsePendientesDespacho(buffer: Buffer): ComprasParsed {
  const { hoja, h, filas } = leerHoja(buffer, ["Nro orden", "Cant. pendiente", "Valor neto pendiente"]);
  const iNro = exigir(h, "Nro orden");
  const iItem = col(h, "Item resumen");
  const iCantP = exigir(h, "Cant. pendiente");
  const iValP = exigir(h, "Valor neto pendiente");
  const iBod = col(h, "Bodega"), iBodD = col(h, "Desc. bodega");
  const iCantO = col(h, "Cant. orden"), iCantE = col(h, "Cant. entrada");
  const iEntRel = col(h, "Entradas relacionadas");
  const iFecUlt = col(h, "Fecha ult. entrada");
  const iValO = col(h, "Valor neto orden");
  const iDoctoRef = col(h, "Docto. Referencia");
  const iFecEnt = col(h, "Fecha entrega orden");
  const iFecOrd = col(h, "Fecha orden");
  const iProv = col(h, "Razón social proveedor");
  const iMarca = col(h, "MARCA DEL PRODUCTO", "MARCA");
  const iLinea = col(h, "LÍNEA (GRUPO)", "LÍNEA", "LINEA");
  const iAnat = col(h, "ANATOMIA");
  const iSist = col(h, "SISTEMA"), iCat = col(h, "CATEGORIA");

  const datos: Record<string, unknown>[] = [];
  const periodos = new Set<string>();
  let leidas = 0, omitidas = 0;

  for (const r of filas) {
    if (!r) continue;
    const nroOrden = txt(r[iNro]);
    if (!nroOrden) continue;
    leidas++;
    const fEnt = iFecEnt != null ? fecha(r[iFecEnt]) : null;
    const fOrd = iFecOrd != null ? fecha(r[iFecOrd]) : null;
    // El informe agrupa el pendiente por FECHA DE ENTREGA; si el documento no
    // la trae se cae a la fecha de la orden para no dejarlo fuera del periodo.
    const ref = fEnt ?? fOrd;
    if (!ref) { omitidas++; continue; }
    const anio = ref.getUTCFullYear(), mes = ref.getUTCMonth() + 1;
    periodos.add(`${anio}-${String(mes).padStart(2, "0")}`);
    datos.push({
      nroOrden,
      itemResumen: iItem != null ? txt(r[iItem]) : "",
      cantPendiente: num(r[iCantP]),
      valorPendiente: num(r[iValP]),
      bodegaCodigo: iBod != null ? txt(r[iBod]) : "",
      bodegaDesc: iBodD != null ? txt(r[iBodD]) : "",
      cantOrden: iCantO != null ? num(r[iCantO]) : 0,
      cantEntrada: iCantE != null ? num(r[iCantE]) : 0,
      entradasRel: iEntRel != null ? txt(r[iEntRel]) : "",
      fechaUltEntrada: iFecUlt != null ? fecha(r[iFecUlt]) : null,
      valorOrden: iValO != null ? num(r[iValO]) : 0,
      doctoReferencia: iDoctoRef != null ? txt(r[iDoctoRef]) : "",
      fechaEntrega: fEnt, anio, mes, fechaOrden: fOrd,
      proveedor: iProv != null ? txt(r[iProv]) : "",
      marca: iMarca != null ? txt(r[iMarca]) : "",
      linea: iLinea != null ? txt(r[iLinea]) : "",
      anatomia: iAnat != null ? txt(r[iAnat]) : "",
      sistema: iSist != null ? txt(r[iSist]) : "",
      categoria: iCat != null ? txt(r[iCat]) : "",
    });
  }
  return { hoja, filas: leidas, omitidas, periodos: [...periodos].sort(), datos };
}

/** Reemplaza TODO: el archivo es la foto completa de lo que sigue pendiente. */
export async function persistirPendientesDespacho(p: ComprasParsed): Promise<number> {
  await prisma.compraPendiente.deleteMany({});
  await porLotes(p.datos, (lote) => prisma.compraPendiente.createMany({ data: lote as never }));
  return p.datos.length;
}

// ---------- 3) Facturado por proveedor ----------

export function parseFacturasProveedor(buffer: Buffer): ComprasParsed {
  const { hoja, h, filas } = leerHoja(buffer, ["Nro documento", "Razón social proveedor", "Valor neto"]);
  const iNro = exigir(h, "Nro documento");
  const iCO = col(h, "C.O.");
  const iFec = exigir(h, "Fecha");
  const iEst = col(h, "Estado");
  const iDocProv = col(h, "Docto. proveedor");
  const iFecProv = col(h, "Fecha docto. prov.");
  const iClase = col(h, "Clase docto.");
  const iProv = exigir(h, "Razón social proveedor");
  const iMon = col(h, "Mon. local");
  const iBruto = col(h, "Valor bruto");
  const iDesc = col(h, "Valor desctos");
  const iImp = col(h, "Valor imptos");
  const iNeto = exigir(h, "Valor neto");
  const iRet = col(h, "Valor retenciones");
  const iCxp = col(h, "Valor CxP");
  const iNotas = col(h, "Notas");
  const iTipo = col(h, "Tipo docto.");
  const iCiu = col(h, "Ciudad");
  const iUsr = col(h, "Usuario creación");

  // Un mismo nro de documento no debe repetirse; si el archivo lo trae dos
  // veces (reexport solapado), gana la última fila leída.
  const porNro = new Map<string, Record<string, unknown>>();
  const periodos = new Set<string>();
  let leidas = 0, omitidas = 0;

  for (const r of filas) {
    if (!r) continue;
    const nroDocumento = txt(r[iNro]);
    if (!nroDocumento) continue;
    leidas++;
    const f = fecha(r[iFec]);
    if (!f) { omitidas++; continue; }
    const anio = f.getUTCFullYear(), mes = f.getUTCMonth() + 1;
    periodos.add(`${anio}-${String(mes).padStart(2, "0")}`);
    porNro.set(nroDocumento, {
      nroDocumento,
      co: iCO != null ? txt(r[iCO]) : "",
      fecha: f, anio, mes, dia: f.getUTCDate(),
      estado: iEst != null ? txt(r[iEst]) : "",
      doctoProveedor: iDocProv != null ? txt(r[iDocProv]) : "",
      fechaDoctoProv: iFecProv != null ? fecha(r[iFecProv]) : null,
      claseDocto: iClase != null ? txt(r[iClase]) : "",
      proveedor: txt(r[iProv]),
      moneda: iMon != null ? (txt(r[iMon]) || "COP") : "COP",
      valorBruto: iBruto != null ? num(r[iBruto]) : 0,
      valorDesctos: iDesc != null ? num(r[iDesc]) : 0,
      valorImptos: iImp != null ? num(r[iImp]) : 0,
      valorNeto: num(r[iNeto]),
      valorRetenciones: iRet != null ? num(r[iRet]) : 0,
      valorCxp: iCxp != null ? num(r[iCxp]) : 0,
      notas: iNotas != null ? txt(r[iNotas]) : "",
      tipoDocto: iTipo != null ? txt(r[iTipo]) : "",
      ciudad: iCiu != null ? txt(r[iCiu]) : "",
      usuarioCreacion: iUsr != null ? txt(r[iUsr]) : "",
    });
  }
  const omitidasDup = leidas - omitidas - porNro.size;
  return {
    hoja, filas: leidas, omitidas: omitidas + omitidasDup,
    periodos: [...periodos].sort(), datos: [...porNro.values()],
  };
}

/**
 * Reemplaza los meses del archivo y reinserta. El documento puede cambiar de
 * estado (Aprobado → Anulado) o de valor entre exportes, así que no basta con
 * insertar los que faltan.
 */
export async function persistirFacturasProveedor(p: ComprasParsed): Promise<number> {
  for (const per of p.periodos) {
    const [anio, mes] = per.split("-").map(Number);
    await prisma.compraFactura.deleteMany({ where: { anio, mes } });
  }
  // Un documento puede haber quedado guardado en otro mes si SIESA le corrigió
  // la fecha: se borra por número antes de insertar para no chocar con el único.
  const nros = p.datos.map((d) => String(d.nroDocumento));
  await porLotes(nros, (lote) => prisma.compraFactura.deleteMany({ where: { nroDocumento: { in: lote } } }), 1000);
  await porLotes(p.datos, (lote) => prisma.compraFactura.createMany({ data: lote as never }));
  return p.datos.length;
}

// ---------- 4) Catálogo de tipos de proveedor ----------

export interface ProveedorTipoParsed { razonSocial: string; tipoCompra: string; nit: string | null }

/**
 * Hoja "TIPOS DE PROVEEDORES": razón social → TIPO DE COMPRA (ALTO COSTO,
 * BIENES Y SERVICIOS, INSUMOS). Sin este catálogo el informe funciona igual,
 * pero el filtro por tipo de compra deja todo en "SIN CLASIFICAR".
 */
export function parseTiposProveedor(buffer: Buffer): ProveedorTipoParsed[] {
  const { h, filas } = leerHoja(buffer, ["Razón social proveedor", "TIPO DE COMPRA"]);
  const iProv = exigir(h, "Razón social proveedor");
  const iTipo = exigir(h, "TIPO DE COMPRA");
  const iNit = col(h, "NIT", "Nit");

  const out = new Map<string, ProveedorTipoParsed>();
  for (const r of filas) {
    if (!r) continue;
    const razonSocial = txt(r[iProv]);
    if (!razonSocial) continue;
    out.set(razonSocial, {
      razonSocial,
      tipoCompra: txt(r[iTipo]).toUpperCase(),
      nit: iNit != null ? (txt(r[iNit]) || null) : null,
    });
  }
  return [...out.values()];
}

export async function persistirTiposProveedor(lista: ProveedorTipoParsed[]): Promise<number> {
  for (const p of lista) {
    await prisma.proveedorCompra.upsert({
      where: { razonSocial: p.razonSocial },
      update: { tipoCompra: p.tipoCompra, nit: p.nit },
      create: p,
    });
  }
  return lista.length;
}

// ---------- 5) Entradas por compra → puente documento/proveedor ----------

export interface EntradaProveedorParsed {
  documento: string; tipoDoc: string; proveedor: string; nit: string | null;
  fecha: Date; anio: number; mes: number;
}

export interface EntradasProveedorParsed {
  hoja: string; filas: number; omitidas: number; periodos: string[];
  /** Documentos que traían más de un proveedor (no debería pasar). */
  ambiguos: string[];
  datos: EntradaProveedorParsed[];
}

/**
 * Reporte "entradas por compra" de SIESA. Se lee a nivel RENGLÓN pero se
 * guarda a nivel DOCUMENTO: lo único que aporta frente a InvMovimiento es la
 * razón social del proveedor, y esa es la misma para todo el documento
 * (verificado: 3.631 documentos de ene–jul 2026, ninguno con dos proveedores).
 *
 * El valor NO se guarda a propósito: este reporte valora al precio del
 * documento de compra y el movimiento de inventario al costo promedio, así
 * que guardar los dos dejaría dos cifras distintas para la misma entrada.
 *
 * La primera fila del archivo es un "Gran total" sin fecha; se descarta sola
 * al exigir fecha válida.
 */
export function parseEntradasProveedor(buffer: Buffer): EntradasProveedorParsed {
  const { hoja, h, filas } = leerHoja(buffer, ["Documento", "Razón social proveedor", "Fecha"]);
  const iFec = exigir(h, "Fecha");
  const iDoc = exigir(h, "Documento");
  const iProv = exigir(h, "Razón social proveedor");
  const iNit = col(h, "Proveedor");

  const porDoc = new Map<string, EntradaProveedorParsed>();
  const ambiguos = new Set<string>();
  const periodos = new Set<string>();
  let leidas = 0, omitidas = 0;

  for (const r of filas) {
    if (!r) continue;
    const documento = txt(r[iDoc]);
    if (!documento) continue;
    leidas++;
    const f = fecha(r[iFec]);
    const proveedor = txt(r[iProv]);
    if (!f || !proveedor) { omitidas++; continue; }

    const previo = porDoc.get(documento);
    if (previo) {
      // Manda el primero y se reporta: cambiarlo en silencio movería plata
      // de un proveedor a otro sin que nadie se entere.
      if (previo.proveedor !== proveedor) ambiguos.add(documento);
      continue;
    }
    const anio = f.getUTCFullYear(), mes = f.getUTCMonth() + 1;
    periodos.add(`${anio}-${String(mes).padStart(2, "0")}`);
    porDoc.set(documento, {
      documento, tipoDoc: documento.slice(0, 3).toUpperCase(), proveedor,
      nit: iNit != null ? (txt(r[iNit]) || null) : null,
      fecha: f, anio, mes,
    });
  }
  return {
    hoja, filas: leidas, omitidas, periodos: [...periodos].sort(),
    ambiguos: [...ambiguos], datos: [...porDoc.values()],
  };
}

/**
 * Reemplaza los meses del archivo. El documento es la llave, pero se borra
 * por periodo para que un documento anulado y desaparecido del reporte no se
 * quede colgado atribuyendo entradas a un proveedor que ya no es.
 */
export async function persistirEntradasProveedor(p: EntradasProveedorParsed): Promise<number> {
  for (const per of p.periodos) {
    const [anio, mes] = per.split("-").map(Number);
    await prisma.entradaProveedor.deleteMany({ where: { anio, mes } });
  }
  const docs = p.datos.map((d) => d.documento);
  await porLotes(docs, (lote) => prisma.entradaProveedor.deleteMany({ where: { documento: { in: lote } } }), 1000);
  await porLotes(p.datos, (lote) => prisma.entradaProveedor.createMany({ data: lote as never }));
  return p.datos.length;
}
