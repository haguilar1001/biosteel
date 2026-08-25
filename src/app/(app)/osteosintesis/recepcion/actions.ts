"use server";
// ==========================================================
// Registro de una Recepción Técnica (FOR-ALM-005).
// ==========================================================
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUsuario } from "@/server/auth-context";
import { exigirPermiso } from "@/lib/rbac/authorize";
import { auditar } from "@/lib/audit/log";
import { siguienteConsecutivo, CRITERIOS_IMPORTACION } from "@/lib/negocio/recepcion";

export interface RecepcionState { ok?: boolean; error?: string; id?: number; consecutivo?: string }

const VERIF = ["si", "no", "na"] as const;

/** "YYYY-MM-DD" → Date (mediodía local para evitar corrimiento de zona). */
function aFecha(s?: string): Date | null {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  return new Date(`${s}T12:00:00`);
}

const itemSchema = z.object({
  codigo: z.string().trim().default(""),
  descripcion: z.string().trim().min(1, "Cada ítem necesita descripción."),
  especificacion: z.string().trim().default(""),
  cantPedida: z.coerce.number().min(0).default(0),
  cantRecibida: z.coerce.number().min(0).default(0),
  lote: z.string().trim().default(""),
  fechaCaducidad: z.string().trim().optional(),
  observaciones: z.string().trim().default(""),
  criterios: z.array(z.string().trim().min(1)).length(CRITERIOS_IMPORTACION.length),
});

const schema = z.object({
  tipo: z.enum(["importacion", "nacional"]),
  fechaInspeccion: z.string().min(1, "Indica la fecha de inspección."),
  horaRecepcion: z.string().trim().default(""),
  odcPedido: z.string().trim().default(""),
  proveedorNombre: z.string().trim().min(1, "Indica el proveedor."),
  registroInvima: z.string().trim().default(""),
  facturaRemision: z.string().trim().default(""),
  valorFactura: z.coerce.number().min(0).default(0),
  guiaTransporte: z.string().trim().default(""),
  transportador: z.string().trim().default(""),
  loteDespacho: z.string().trim().default(""),
  fechaCaducidad: z.string().trim().optional(),
  cantOdc: z.coerce.number().int().optional(),
  // Documental
  docFacturaComercial: z.enum(VERIF).default("na"),
  docPackingList: z.enum(VERIF).default("na"),
  docImportacion: z.enum(VERIF).default("na"),
  docRsInvima: z.enum(VERIF).default("na"),
  docCertCalidad: z.enum(VERIF).default("na"),
  docInstruccionesEsp: z.enum(VERIF).default("na"),
  docCertEsterilidad: z.enum(VERIF).default("na"),
  transSinDanos: z.boolean().default(false),
  transConDanos: z.boolean().default(false),
  transSelloViolado: z.boolean().default(false),
  transTempAdecuada: z.boolean().default(false),
  transTempNoAdecuada: z.boolean().default(false),
  transObservacion: z.string().trim().default(""),
  // Disposición
  resultado: z.string().trim().default(""),
  areaDestino: z.string().trim().default(""),
  decision: z.string().trim().default(""),
  accionTomar: z.string().trim().default(""),
  validacionFactura: z.string().trim().default(""),
  recibidoPor: z.string().trim().default(""),
  revisadoPor: z.string().trim().default(""),
  aprobadoPor: z.string().trim().default(""),
  notas: z.string().trim().default(""),
  items: z.array(itemSchema).min(1, "Agrega al menos un ítem inspeccionado."),
});

export async function crearRecepcionAction(_prev: RecepcionState, fd: FormData): Promise<RecepcionState> {
  const usuario = await requireUsuario();
  try {
    await exigirPermiso(usuario, "recepcion.manage");
  } catch {
    return { error: "No tienes permiso para registrar recepciones." };
  }

  let itemsRaw: unknown = [];
  try { itemsRaw = JSON.parse(String(fd.get("items") ?? "[]")); } catch { return { error: "Lista de ítems inválida." }; }

  const chk = (n: string) => fd.get(n) === "on" || fd.get(n) === "true";
  const p = schema.safeParse({
    tipo: fd.get("tipo"),
    fechaInspeccion: fd.get("fechaInspeccion"),
    horaRecepcion: fd.get("horaRecepcion") ?? "",
    odcPedido: fd.get("odcPedido") ?? "",
    proveedorNombre: fd.get("proveedorNombre") ?? "",
    registroInvima: fd.get("registroInvima") ?? "",
    facturaRemision: fd.get("facturaRemision") ?? "",
    valorFactura: fd.get("valorFactura") || 0,
    guiaTransporte: fd.get("guiaTransporte") ?? "",
    transportador: fd.get("transportador") ?? "",
    loteDespacho: fd.get("loteDespacho") ?? "",
    fechaCaducidad: fd.get("fechaCaducidad") || undefined,
    cantOdc: fd.get("cantOdc") || undefined,
    docFacturaComercial: fd.get("docFacturaComercial") ?? "na",
    docPackingList: fd.get("docPackingList") ?? "na",
    docImportacion: fd.get("docImportacion") ?? "na",
    docRsInvima: fd.get("docRsInvima") ?? "na",
    docCertCalidad: fd.get("docCertCalidad") ?? "na",
    docInstruccionesEsp: fd.get("docInstruccionesEsp") ?? "na",
    docCertEsterilidad: fd.get("docCertEsterilidad") ?? "na",
    transSinDanos: chk("transSinDanos"), transConDanos: chk("transConDanos"),
    transSelloViolado: chk("transSelloViolado"), transTempAdecuada: chk("transTempAdecuada"),
    transTempNoAdecuada: chk("transTempNoAdecuada"), transObservacion: fd.get("transObservacion") ?? "",
    resultado: fd.get("resultado") ?? "", areaDestino: fd.get("areaDestino") ?? "",
    decision: fd.get("decision") ?? "", accionTomar: fd.get("accionTomar") ?? "",
    validacionFactura: fd.get("validacionFactura") ?? "",
    recibidoPor: fd.get("recibidoPor") ?? "", revisadoPor: fd.get("revisadoPor") ?? "",
    aprobadoPor: fd.get("aprobadoPor") ?? "", notas: fd.get("notas") ?? "",
    items: itemsRaw,
  });
  if (!p.success) return { error: p.error.issues[0]?.message ?? "Datos inválidos." };
  const d = p.data;

  const fecha = aFecha(d.fechaInspeccion);
  if (!fecha) return { error: "Fecha de inspección inválida." };

  const { items, fechaInspeccion: _f, fechaCaducidad: _fc, ...cab } = d;
  const consecutivo = await siguienteConsecutivo(d.tipo);

  const creada = await prisma.recepcionTecnica.create({
    data: {
      ...cab,
      consecutivo,
      fechaInspeccion: fecha,
      fechaCaducidad: aFecha(d.fechaCaducidad),
      usuarioId: usuario.id,
      items: {
        create: items.map((it, i) => ({
          orden: i,
          codigo: it.codigo, descripcion: it.descripcion, especificacion: it.especificacion,
          cantPedida: it.cantPedida, cantRecibida: it.cantRecibida, lote: it.lote,
          fechaCaducidad: aFecha(it.fechaCaducidad), observaciones: it.observaciones,
          criterios: {
            create: it.criterios.map((res, k) => ({
              orden: k,
              criterio: CRITERIOS_IMPORTACION[k]?.nombre ?? `Criterio ${k + 1}`,
              especificacion: CRITERIOS_IMPORTACION[k]?.especificacion ?? "",
              resultado: res,
            })),
          },
        })),
      },
    },
    select: { id: true, consecutivo: true },
  });

  await auditar({
    usuarioId: usuario.id, accion: "recepcion.crear", entidad: "RecepcionTecnica",
    entidadId: creada.id, valorNuevo: { consecutivo, tipo: d.tipo, items: items.length, proveedor: d.proveedorNombre },
  });

  revalidatePath("/osteosintesis/recepcion");
  return { ok: true, id: creada.id, consecutivo: creada.consecutivo };
}
