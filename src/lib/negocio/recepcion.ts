// ==========================================================
// Recepción Técnica (FOR-ALM-005 · Recibo a Satisfacción de Dispositivos
// Médicos). Solo registro + soporte PDF; no toca inventario.
// ==========================================================
import "server-only";
import { prisma } from "@/lib/db";
import type { TipoRecepcion, VerifDoc, ResultadoInspeccion } from "@prisma/client";

// --- Constantes del formato (importación) ---

/** Los 9 criterios de inspección física por ítem (sección 3). */
export const CRITERIOS_IMPORTACION = [
  "Integridad embalaje externo",
  "Integridad empaque primario/secundario",
  "Etiquetado (idioma, datos mínimos)",
  "Fecha de vencimiento (mín. 6 meses)",
  "Número de lote legible / coincide con documentos",
  "Referencia/modelo = ODC y RS INVIMA",
  "Condiciones especiales almacenamiento",
  "Esterilidad (indicadores externos, si aplica)",
  "Especificación técnica del producto",
] as const;

/** Documentos de la verificación documental previa (sección 2). */
export const DOCS_IMPORTACION = [
  { campo: "docFacturaComercial", label: "Factura comercial" },
  { campo: "docPackingList", label: "Packing list" },
  { campo: "docImportacion", label: "Documentos importación (DIM/DEX/BL)" },
  { campo: "docRsInvima", label: "RS INVIMA vigente" },
  { campo: "docCertCalidad", label: "Certificado calidad / conformidad fabricante" },
  { campo: "docInstruccionesEsp", label: "Instrucciones de uso en español" },
  { campo: "docCertEsterilidad", label: "Certificado esterilidad (si aplica)" },
] as const;
export type CampoDoc = (typeof DOCS_IMPORTACION)[number]["campo"];

// --- Etiquetas ---
export function tipoRecepcionLabel(t: TipoRecepcion): string {
  return { importacion: "Importación", nacional: "Compras Nacionales" }[t];
}
export function verifDocLabel(v: VerifDoc): string {
  return { si: "Sí", no: "No", na: "N/A" }[v];
}
export function resultadoInspLabel(r: ResultadoInspeccion): string {
  return { conforme: "Conforme", no_conforme: "No conforme", cuarentena: "Cuarentena" }[r];
}
export function resultadoInspClase(r: ResultadoInspeccion): string {
  return { conforme: "t-ok", no_conforme: "t-bad", cuarentena: "t-w1" }[r];
}

/** Siguiente consecutivo por tipo (RT-IMP-000001 / RT-NAC-000001). */
export async function siguienteConsecutivo(tipo: TipoRecepcion): Promise<string> {
  const pref = tipo === "importacion" ? "RT-IMP-" : "RT-NAC-";
  const ult = await prisma.recepcionTecnica.findFirst({
    where: { consecutivo: { startsWith: pref } },
    orderBy: { consecutivo: "desc" },
    select: { consecutivo: true },
  });
  const n = ult ? parseInt(ult.consecutivo.slice(pref.length), 10) + 1 : 1;
  return pref + String(n).padStart(6, "0");
}

/** Nombres de proveedores para el datalist del formulario. */
export async function proveedoresSugeridos(): Promise<string[]> {
  const t = await prisma.tercero.findMany({
    where: { esProveedor: true }, select: { nombre: true }, orderBy: { nombre: "asc" },
  });
  return t.map((x) => x.nombre);
}

// --- Listado ---
export interface FiltroRecepcion { tipo?: TipoRecepcion; q?: string }
export interface FilaRecepcion {
  id: number;
  consecutivo: string;
  tipo: TipoRecepcion;
  fechaInspeccion: Date;
  proveedorNombre: string;
  facturaRemision: string;
  odcPedido: string;
  resultado: string;
  valorFactura: number;
  items: number;
}

export async function listarRecepciones(f: FiltroRecepcion = {}): Promise<FilaRecepcion[]> {
  const q = f.q?.trim();
  const filas = await prisma.recepcionTecnica.findMany({
    where: {
      ...(f.tipo ? { tipo: f.tipo } : {}),
      ...(q
        ? { OR: [
            { consecutivo: { contains: q, mode: "insensitive" } },
            { proveedorNombre: { contains: q, mode: "insensitive" } },
            { facturaRemision: { contains: q, mode: "insensitive" } },
            { odcPedido: { contains: q, mode: "insensitive" } },
          ] }
        : {}),
    },
    orderBy: [{ fechaInspeccion: "desc" }, { id: "desc" }],
    take: 300,
    select: {
      id: true, consecutivo: true, tipo: true, fechaInspeccion: true, proveedorNombre: true,
      facturaRemision: true, odcPedido: true, resultado: true, valorFactura: true,
      _count: { select: { items: true } },
    },
  });
  return filas.map((r) => ({
    id: r.id, consecutivo: r.consecutivo, tipo: r.tipo, fechaInspeccion: r.fechaInspeccion,
    proveedorNombre: r.proveedorNombre, facturaRemision: r.facturaRemision, odcPedido: r.odcPedido,
    resultado: r.resultado, valorFactura: r.valorFactura.toNumber(), items: r._count.items,
  }));
}

// --- Detalle (para el soporte PDF) ---
export type RecepcionDetalle = Awaited<ReturnType<typeof obtenerRecepcion>>;

export async function obtenerRecepcion(id: number) {
  const r = await prisma.recepcionTecnica.findUnique({
    where: { id },
    include: { items: { orderBy: { orden: "asc" }, include: { criterios: { orderBy: { orden: "asc" } } } } },
  });
  if (!r) return null;
  return {
    ...r,
    valorFactura: r.valorFactura.toNumber(),
    items: r.items.map((it) => ({
      ...it,
      cantPedida: it.cantPedida.toNumber(),
      cantRecibida: it.cantRecibida.toNumber(),
    })),
  };
}
