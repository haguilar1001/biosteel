// ==========================================================
// Carga del archivo de PEDIDOS de SIESA (PEDIDOS 2026.xlsx) → tabla Pedido.
//
// Es un renglón por ítem pedido para una cirugía: documento, fecha, bodega,
// referencia, cantidad, costo promedio, precio, paciente, médico y el
// proveedor real del ítem ("Item desc. proveedor"). Ese último es lo que
// permite que la sugerencia de compra diga A QUIÉN comprarle, porque la
// columna MARCA es la línea comercial, no la razón social.
//
// Particularidades del archivo, aprendidas del export de 2026:
//   · La fila 2 es un "Gran total" sin documento: se descarta sola porque no
//     trae "Nro documento" con prefijo.
//   · "Referencia" viene como número cuando el código es todo dígitos
//     (17034250). Se pasa a texto tal cual, igual que en ventas y compras.
//   · La instalación 106 (aprovechamiento) trae costo 0 siempre. No es un
//     error de carga: ese material no tiene valor en libros.
//
// Estrategia: REEMPLAZA LOS MESES presentes en el archivo. No hay llave
// natural —un documento repite referencia cuando el pedido trae varios
// lotes— y SIESA reexporta el mismo mes mientras los pedidos se cumplen.
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

const norm = (s: unknown) =>
  String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/\s+/g, " ").trim();

function encabezados(fila: unknown[]): Map<string, number> {
  const m = new Map<string, number>();
  fila.forEach((c, i) => {
    const k = norm(c);
    if (k && !m.has(k)) m.set(k, i);
  });
  return m;
}

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

/** Primera hoja cuyo encabezado (primeras 5 filas) traiga las columnas pedidas. */
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

export interface PedidosParsed {
  hoja: string;
  /** Renglones con documento leídos del archivo (antes de descartar). */
  filas: number;
  omitidas: number;
  periodos: string[];
  datos: Record<string, unknown>[];
}

export function parsePedidos(buffer: Buffer): PedidosParsed {
  const { hoja, h, filas } = leerHoja(buffer, ["Nro documento", "Referencia", "Cant. pedida"]);
  const iNro = exigir(h, "Nro documento");
  const iFec = exigir(h, "Fecha");
  const iRef = exigir(h, "Referencia");
  const iCant = exigir(h, "Cant. pedida");
  const iEstado = col(h, "Estado movto.", "Estado");
  const iBod = col(h, "Bodega"), iBodD = col(h, "Desc. bodega");
  const iInst = col(h, "Instalacion", "Instalación"), iInstD = col(h, "Desc. instalacion", "Desc. instalación");
  const iNotas = col(h, "Notas ítem", "Notas item", "Desc. item");
  const iExist = col(h, "Cant. existencia");
  const iCosto = col(h, "Costo promedio total");
  const iPrecio = col(h, "Precio unit.");
  const iBruto = col(h, "Valor bruto");
  const iUtil = col(h, "Utilidad promedio");
  const iMarca = col(h, "MARCA");
  const iLinea = col(h, "LÍNEA", "LINEA");
  const iAnat = col(h, "ANATOMIA", "ANATOMÍA");
  const iSist = col(h, "SISTEMA"), iCat = col(h, "CATEGORIA", "CATEGORÍA");
  const iProc = col(h, "Procedimiento");
  const iPac = col(h, "paciente", "Paciente");
  const iMed = col(h, "Medico Cirujano", "Médico Cirujano");
  const iFecCx = col(h, "Fecha cx");
  const iCli = col(h, "Razon social cliente factura", "Razón social cliente factura");
  const iLista = col(h, "Lista de precios"), iListaD = col(h, "Desc. lista de precios");
  const iTipoCli = col(h, "Desc. tipo de cliente");
  const iCiudad = col(h, "Desc. ciudad");
  const iCond = col(h, "Condicion de pago", "Condición de pago");
  const iProv = col(h, "Item desc. proveedor");
  const iNit = col(h, "Item proveedor");

  const datos: Record<string, unknown>[] = [];
  const periodos = new Set<string>();
  let leidas = 0, omitidas = 0;

  for (const r of filas) {
    if (!r) continue;
    const nroDocumento = txt(r[iNro]);
    // La fila "Gran total" del encabezado no trae documento con prefijo.
    if (!nroDocumento || !/^[A-Z]{3}-/i.test(nroDocumento)) continue;
    leidas++;
    const f = fecha(r[iFec]);
    // Sin fecha no entra a ningún periodo: no se puede reemplazar ni filtrar.
    if (!f) { omitidas++; continue; }
    const anio = f.getUTCFullYear(), mes = f.getUTCMonth() + 1;
    periodos.add(`${anio}-${String(mes).padStart(2, "0")}`);
    const inst = iInst != null ? Math.trunc(num(r[iInst])) : 0;
    datos.push({
      nroDocumento, prefijo: nroDocumento.slice(0, 3).toUpperCase(),
      fecha: f, anio, mes, dia: f.getUTCDate(),
      estado: iEstado != null ? txt(r[iEstado]) : "",
      bodegaCodigo: iBod != null ? txt(r[iBod]) : "",
      bodegaDesc: iBodD != null ? txt(r[iBodD]) : "",
      instalacion: inst > 0 ? inst : null,
      instalacionDesc: iInstD != null ? txt(r[iInstD]) : "",
      referencia: txt(r[iRef]),
      descItem: iNotas != null ? txt(r[iNotas]) : "",
      cantPedida: num(r[iCant]),
      cantExist: iExist != null ? num(r[iExist]) : 0,
      costoProm: iCosto != null ? num(r[iCosto]) : 0,
      precioUnit: iPrecio != null ? num(r[iPrecio]) : 0,
      valorBruto: iBruto != null ? num(r[iBruto]) : 0,
      utilidad: iUtil != null ? num(r[iUtil]) : 0,
      marca: iMarca != null ? txt(r[iMarca]) : "",
      linea: iLinea != null ? txt(r[iLinea]) : "",
      anatomia: iAnat != null ? txt(r[iAnat]) : "",
      sistema: iSist != null ? txt(r[iSist]) : "",
      categoria: iCat != null ? txt(r[iCat]) : "",
      procedimiento: iProc != null ? txt(r[iProc]) : "",
      paciente: iPac != null ? txt(r[iPac]) : "",
      medico: iMed != null ? txt(r[iMed]) : "",
      fechaCx: iFecCx != null ? fecha(r[iFecCx]) : null,
      cliente: iCli != null ? txt(r[iCli]) : "",
      lista: iLista != null ? txt(r[iLista]) : "",
      listaDesc: iListaD != null ? txt(r[iListaD]) : "",
      tipoCliente: iTipoCli != null ? txt(r[iTipoCli]) : "",
      ciudad: iCiudad != null ? txt(r[iCiudad]) : "",
      condicionPago: iCond != null ? txt(r[iCond]) : "",
      proveedor: iProv != null ? txt(r[iProv]) : "",
      nitProveedor: iNit != null ? txt(r[iNit]) : "",
    });
  }
  return { hoja, filas: leidas, omitidas, periodos: [...periodos].sort(), datos };
}

/** Reemplaza los meses presentes en el archivo (ver nota de cabecera). */
export async function persistirPedidos(p: PedidosParsed): Promise<number> {
  for (const per of p.periodos) {
    const [anio, mes] = per.split("-").map(Number);
    await prisma.pedido.deleteMany({ where: { anio, mes } });
  }
  await porLotes(p.datos, (lote) => prisma.pedido.createMany({ data: lote as never }));
  return p.datos.length;
}
