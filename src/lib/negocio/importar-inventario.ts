// ==========================================================
// Importadores del INVENTARIO DE MATERIAL DE OSTEOSÍNTESIS (SIESA).
// Tres archivos independientes, cada uno con su parser y su persistidor:
//   · Tablas Auxiliares → InvBodega     (catálogo con la instalación)
//   · Balance mensual   → InvBalance    (saldo valorizado)
//   · Movimientos       → InvMovimiento (cada línea de documento)
//
// La instalación es la llave de la conciliación: el balance viene por
// instalación (101 propio · 102 consignación · 106 aprovechamiento) y los
// movimientos por bodega, así que sin el catálogo completo no cuadran.
//
// Desde el export de agosto de 2026 el balance TAMBIÉN trae bodega, saldo
// inicial en cantidad y consumo promedio diario — pero dejó de traer
// "Desc. item", que hay que rellenar con lo ya cargado. Los dos formatos
// conviven: sin columna Bodega el mes queda con bodegaCodigo = "".
// ==========================================================
import "server-only";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/db";

const BATCH = 5000;

/**
 * Instalaciones válidas. En la 106 el costo es SIEMPRE 0.
 * La 104 (préstamo, bodegas terminadas en "4P") se agregó al catálogo el
 * 2026-09-02: hasta entonces sus bodegas no estaban clasificadas y quedaban
 * fuera de los filtros por instalación.
 */
export const INSTALACIONES: Record<number, string> = {
  101: "Material propio",
  102: "Material en consignación",
  104: "Préstamo",
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
      throw new Error(
        `La bodega ${codigo} tiene instalación "${txt(r[iInst])}"; solo se admiten ${Object.keys(INSTALACIONES).join(", ")}.`,
      );
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
  /** El export trae la columna "Bodega" (los viejos solo llegan a instalación). */
  porBodega: boolean;
  /** Bodegas del balance que el catálogo no tiene; se dan de alta al persistir. */
  bodegasNuevas: Map<string, { descripcion: string; instalacion: number }>;
  /** Bodegas donde el catálogo y el balance discrepan (manda el balance). */
  choques: Map<string, { catalogo: number; archivo: number }>;
  /** Filas cuya descripción hubo que rellenar (el export nuevo no la trae). */
  descRellenadas: number;
  /** Filas que quedaron sin descripción ni siquiera tras rellenar. */
  descFaltantes: number;
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

export async function parseBalance(buffer: Buffer, nombreArchivo: string, anioPorDefecto = new Date().getFullYear()): Promise<BalanceParsed> {
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
  // Columnas del export nuevo. Sin "Bodega" el mes queda a nivel instalación,
  // igual que antes, y se marca con bodegaCodigo = "".
  const iBod = h.get("Bodega"), iBodDesc = h.get("Desc. bodega");
  const iCI = h.get("Saldo inicial (cant.)"), iCPD = h.get("Consumo promedio diario");
  const porBodega = iBod != null;

  // El export nuevo (el que trae bodega) dejó de traer "Desc. item": sin esto
  // los ítems saldrían sin nombre en toda la pantalla. Se rellena con lo que
  // ya está cargado — primero por ítem desde otros balances y, si no, por
  // referencia desde los movimientos, que sí traen descripción.
  const descPorItem = new Map<string, string>(), descPorRef = new Map<string, string>();
  if (iDesc == null) {
    const [items, refs] = await Promise.all([
      prisma.$queryRaw<Record<string, unknown>[]>`
        SELECT item, MAX(descripcion) AS d FROM "InvBalance" WHERE descripcion <> '' GROUP BY item`,
      prisma.$queryRaw<Record<string, unknown>[]>`
        SELECT referencia, MAX(descripcion) AS d FROM "InvMovimiento" WHERE descripcion <> '' GROUP BY referencia`,
    ]);
    for (const r of items) descPorItem.set(String(r.item), String(r.d ?? ""));
    for (const r of refs) descPorRef.set(String(r.referencia), String(r.d ?? ""));
  }

  const datos: Record<string, unknown>[] = [];
  const vistas = new Set<string>();
  const bodegasNuevas = new Map<string, { descripcion: string; instalacion: number }>();
  const bodegasVistas = new Map<string, { descripcion: string; instalacion: number }>();
  let leidas = 0, descRellenadas = 0, descFaltantes = 0;
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i]; if (!r) continue;
    const item = txt(r[iItem]);
    // "Gran total" es la fila de totales del reporte, no un ítem.
    if (!item || item.toUpperCase().startsWith("GRAN TOTAL")) continue;
    leidas++;
    const cantInicial = iCI != null ? num(r[iCI]) : 0;
    const cantEntradas = num(r[iCE]), cantSalidas = num(r[iCS]), cantFinal = num(r[iCF]);
    const valorInicial = num(r[iVI]), valorEntradas = num(r[iVE]);
    const valorSalidas = num(r[iVS]), valorFinal = num(r[iVF]);
    // El archivo trae ~89.7k filas por mes y la mayoría está toda en cero.
    if (!cantInicial && !cantEntradas && !cantSalidas && !cantFinal
      && !valorInicial && !valorEntradas && !valorSalidas && !valorFinal) continue;
    const instalacion = Math.trunc(num(r[iInst]));
    const bodegaCodigo = porBodega ? txt(r[iBod]) : "";
    if (bodegaCodigo) {
      bodegasVistas.set(bodegaCodigo, {
        descripcion: iBodDesc != null ? txt(r[iBodDesc]) : "", instalacion,
      });
    }
    const llave = `${instalacion}|${bodegaCodigo}|${item}`;
    if (vistas.has(llave)) continue; // el reporte no debería repetir Ítem × Bodega × Instalación
    vistas.add(llave);
    const referencia = txt(r[iRef]);
    let descripcion = iDesc != null ? txt(r[iDesc]) : "";
    if (iDesc == null) {
      descripcion = descPorItem.get(item) ?? descPorRef.get(referencia) ?? "";
      if (descripcion) descRellenadas++; else descFaltantes++;
    }
    datos.push({
      anio: periodo.anio, mes: periodo.mes, instalacion, bodegaCodigo,
      item, referencia, descripcion,
      tipoInv: iTipo != null ? txt(r[iTipo]) : "",
      marca: iMar != null ? txt(r[iMar]) : "", linea: iLin != null ? txt(r[iLin]) : "",
      anatomia: iAna != null ? txt(r[iAna]) : "", sistema: iSis != null ? txt(r[iSis]) : "",
      categoria: iCat != null ? txt(r[iCat]) : "",
      cantInicial, cantEntradas, cantSalidas, cantFinal,
      valorInicial, valorEntradas, valorSalidas, valorFinal,
      consumoDiario: iCPD != null ? num(r[iCPD]) : 0,
    });
  }

  // El balance es la fuente más confiable de la instalación de una bodega:
  // es el mismo reporte del que sale el saldo. Manda sobre el catálogo.
  const catalogo = new Map(
    (await prisma.invBodega.findMany({ select: { codigo: true, instalacion: true } }))
      .map((b) => [b.codigo, b.instalacion] as const),
  );
  const choques = new Map<string, { catalogo: number; archivo: number }>();
  for (const [codigo, def] of bodegasVistas) {
    const enCatalogo = catalogo.get(codigo);
    if (enCatalogo == null) bodegasNuevas.set(codigo, def);
    else if (enCatalogo !== def.instalacion) choques.set(codigo, { catalogo: enCatalogo, archivo: def.instalacion });
  }
  return { ...periodo, hoja, filas: leidas, datos, porBodega, bodegasNuevas, choques, descRellenadas, descFaltantes };
}

/**
 * Malla de seguridad del balance. El balance es una foto mensual, no diaria,
 * así que aquí lo que se puede perder es DETALLE:
 *   · un export viejo (sin columna Bodega) encima de un mes que ya la tiene;
 *   · un archivo con bastantes menos filas que las guardadas (recortado,
 *     filtrado o de una sola bodega).
 * Devuelve null cuando el mes no está cargado o el archivo lo cubre.
 */
export async function loQuePerderiaElBalance(b: BalanceParsed): Promise<string | null> {
  const nfl = new Intl.NumberFormat("es-CO");
  const donde = { anio: b.anio, mes: b.mes };
  const guardadas = await prisma.invBalance.count({ where: donde });
  if (!guardadas) return null; // mes nuevo: no hay nada que perder

  if (!b.porBodega) {
    const conBodega = await prisma.invBalance.count({ where: { ...donde, bodegaCodigo: { not: "" } } });
    if (conBodega) {
      return `${MESES[b.mes - 1]} ${b.anio} ya está cargado con detalle por bodega (${nfl.format(conBodega)} fila(s)) ` +
        "y este archivo es del export viejo, que solo llega hasta instalación: se perdería el detalle por bodega.";
    }
  }

  // 5 % de tolerancia: dentro del mismo mes un reexport legítimo se mueve
  // poco, y los ítems que quedan en cero se descartan al cargar.
  if (b.datos.length < guardadas * 0.95) {
    return `${MESES[b.mes - 1]} ${b.anio} tiene ${nfl.format(guardadas)} fila(s) cargadas y el archivo solo trae ` +
      `${nfl.format(b.datos.length)}: quedarían ${nfl.format(guardadas - b.datos.length)} menos.`;
  }

  return null;
}

/** Reemplaza el balance del mes (idempotente: se puede recargar el archivo). */
export async function persistirBalance(b: BalanceParsed): Promise<number> {
  // Las bodegas que el balance ubica y el catálogo no tiene se dan de alta
  // (marcadas como inferidas), para que la pantalla les sepa el nombre.
  for (const [codigo, def] of b.bodegasNuevas) {
    await prisma.invBodega.upsert({
      where: { codigo },
      update: {},
      create: { codigo, descripcion: def.descripcion, instalacion: def.instalacion, inferida: true },
    });
  }
  await prisma.invBalance.deleteMany({ where: { anio: b.anio, mes: b.mes } });
  // El balance trae ~20 columnas por fila: lotes de 5.000 tumban la conexión.
  await porLotes(b.datos, (lote) => prisma.invBalance.createMany({ data: lote as never, skipDuplicates: true }), 1500);
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
 * Malla de seguridad del reemplazo: días que YA están cargados y el archivo
 * no trae, es decir, lo que se perdería al subirlo. Devuelve null cuando el
 * archivo cubre todo lo guardado (el caso normal: se exporta el mes completo).
 *
 * Es la contracara de reemplazar por mes: subir el export de un solo día
 * borraría el resto del mes en silencio. Ver carga-confirmacion.ts.
 */
export async function diasQueBorrariaMovimientos(m: MovimientosParsed): Promise<string | null> {
  const nfl = new Intl.NumberFormat("es-CO");
  const avisos: string[] = [];

  for (const periodo of m.periodos) {
    const [anio, mes] = periodo.split("-").map(Number) as [number, number];
    const enArchivo = new Set(
      m.datos
        .filter((d) => d.anio === anio && d.mes === mes)
        .map((d) => (d.fecha as Date).getUTCDate()),
    );
    const guardados = await prisma.$queryRaw<{ dia: number; filas: bigint }[]>`
      SELECT EXTRACT(DAY FROM "fecha")::int AS dia, COUNT(*) AS filas
        FROM "InvMovimiento" WHERE "anio" = ${anio} AND "mes" = ${mes}
       GROUP BY 1 ORDER BY 1`;

    const perdidos = guardados.filter((g) => !enArchivo.has(g.dia));
    if (!perdidos.length) continue;

    const movs = perdidos.reduce((t, g) => t + Number(g.filas), 0);
    const dias = perdidos.map((g) => g.dia);
    const lista = dias.length > 8
      ? `${dias.slice(0, 8).join(", ")}… y ${dias.length - 8} más`
      : dias.join(", ");
    avisos.push(
      `${MESES[mes - 1]} ${anio}: el archivo no trae ${dias.length} día(s) que ya están cargados (${lista}), ` +
      `así que se borrarían ${nfl.format(movs)} movimiento(s) de esos días.`,
    );
  }

  return avisos.length ? avisos.join(" ") : null;
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
