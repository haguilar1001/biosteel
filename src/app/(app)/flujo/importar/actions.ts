"use server";
// ==========================================================
// Importador de reportes SIESA → MovimientoFlujo.
// Dos modos: "preview" (dry-run: no escribe) y "commit" (inserta).
// Idempotente por `documento` (los ya existentes se omiten).
// ==========================================================
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUsuario } from "@/server/auth-context";
import { exigirPermiso } from "@/lib/rbac/authorize";
import { auditar } from "@/lib/audit/log";
import { formatFecha } from "@/lib/format";
import {
  parsearArchivo, ETIQUETA_REPORTE, type TipoReporte, type FilaError,
} from "@/lib/negocio/importar-siesa";
import { CATEGORIAS_FLUJO, clasificar } from "@/lib/negocio/categorias-flujo";
import type { TipoMovimiento } from "@prisma/client";

const TIPOS: TipoReporte[] = ["OCC", "NGC", "NBA", "PEL", "RDC"];
const LIMITE_MUESTRA = 50;

export interface FilaMuestra {
  documento: string;
  fecha: string;
  terceroNombre: string;
  nit: string | null;
  detalle: string | null;
  categoria: string;
  valor: number;
  nuevo: boolean;
}

export interface ConteoCategoria {
  categoria: string;
  cantidad: number;
  suma: number;
}

export interface ImportState {
  ok?: boolean;
  error?: string;
  modo?: "preview" | "commit";
  tipo?: TipoReporte;
  etiqueta?: string;
  direccion?: TipoMovimiento;
  resumen?: {
    totalDetalle: number;
    nuevos: number;
    duplicados: number;
    errores: number;
    omitidos: number;
    hojasIgnoradas: number;
    sumaNuevos: number;
    rango: { min: string; max: string } | null;
  };
  muestra?: FilaMuestra[];
  porCategoria?: ConteoCategoria[];
  erroresLista?: FilaError[];
  duplicados?: string[];
  insertados?: number;
}

/** Asegura el catálogo de categorías en BD y devuelve nombre → id. */
async function sincronizarCategorias(): Promise<Map<string, number>> {
  const mapa = new Map<string, number>();
  for (const c of CATEGORIAS_FLUJO) {
    const row = await prisma.categoriaFlujo.upsert({
      where: { nombre: c.nombre },
      update: { tipo: c.tipo, orden: c.orden },
      create: { nombre: c.nombre, tipo: c.tipo, orden: c.orden },
      select: { id: true, nombre: true },
    });
    mapa.set(row.nombre, row.id);
  }
  return mapa;
}

async function guard(): Promise<{ usuarioId: number } | { error: string }> {
  const usuario = await requireUsuario();
  try {
    await exigirPermiso(usuario, "flujo.manage");
  } catch {
    return { error: "No tienes permiso para importar movimientos de flujo." };
  }
  return { usuarioId: usuario.id };
}

export async function importarSiesaAction(_prev: ImportState, fd: FormData): Promise<ImportState> {
  const g = await guard();
  if ("error" in g) return { error: g.error };

  const modo = fd.get("intent") === "commit" ? "commit" : "preview";
  const tipoSel = String(fd.get("tipo") ?? "auto");
  const tipoForzado = TIPOS.includes(tipoSel as TipoReporte) ? (tipoSel as TipoReporte) : undefined;

  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Selecciona un archivo Excel." };
  if (file.size > 15 * 1024 * 1024) return { error: "El archivo supera 15 MB." };

  let parsed;
  try {
    const buf = Buffer.from(await file.arrayBuffer());
    parsed = parsearArchivo(buf, tipoForzado);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo leer el archivo." };
  }

  // Duplicados: documentos que ya existen en la BD.
  const docs = parsed.movimientos.map((m) => m.documento);
  const existentesRows = docs.length
    ? await prisma.movimientoFlujo.findMany({ where: { documento: { in: docs } }, select: { documento: true } })
    : [];
  const existentes = new Set(existentesRows.map((r) => r.documento));

  const nuevos = parsed.movimientos.filter((m) => !existentes.has(m.documento));
  const duplicados = parsed.movimientos.filter((m) => existentes.has(m.documento));
  const sumaNuevos = nuevos.reduce((s, m) => s + m.valor, 0);

  // Clasificación automática por categoría (sobre los nuevos).
  const catDe = (m: (typeof nuevos)[number]) => clasificar(m.detalle, m.tipo);
  const catAgg = new Map<string, { cantidad: number; suma: number }>();
  for (const m of nuevos) {
    const cat = catDe(m);
    const e = catAgg.get(cat) ?? { cantidad: 0, suma: 0 };
    e.cantidad += 1; e.suma += m.valor;
    catAgg.set(cat, e);
  }
  const porCategoria: ConteoCategoria[] = [...catAgg.entries()]
    .map(([categoria, v]) => ({ categoria, ...v }))
    .sort((a, b) => b.suma - a.suma);

  const fechas = nuevos.map((m) => m.fecha.getTime());
  const rango = fechas.length
    ? { min: formatFecha(new Date(Math.min(...fechas))), max: formatFecha(new Date(Math.max(...fechas))) }
    : null;

  const resumen: NonNullable<ImportState["resumen"]> = {
    totalDetalle: parsed.totalDetalle,
    nuevos: nuevos.length,
    duplicados: duplicados.length,
    errores: parsed.errores.length,
    omitidos: parsed.omitidos,
    hojasIgnoradas: parsed.hojasIgnoradas,
    sumaNuevos,
    rango,
  };

  const muestra: FilaMuestra[] = nuevos.slice(0, LIMITE_MUESTRA).map((m) => ({
    documento: m.documento, fecha: formatFecha(m.fecha), terceroNombre: m.terceroNombre,
    nit: m.nit, detalle: m.detalle, categoria: catDe(m), valor: m.valor, nuevo: true,
  }));

  const salidaBase: ImportState = {
    modo, tipo: parsed.tipo, etiqueta: ETIQUETA_REPORTE[parsed.tipo], direccion: parsed.direccion,
    resumen, muestra, porCategoria, erroresLista: parsed.errores.slice(0, LIMITE_MUESTRA),
    duplicados: duplicados.slice(0, LIMITE_MUESTRA).map((m) => m.documento),
  };

  if (modo === "preview") return { ...salidaBase, ok: true };

  // --- Commit: inserta solo los nuevos ---
  if (nuevos.length === 0) return { ...salidaBase, ok: true, insertados: 0 };

  const cats = await sincronizarCategorias();
  const res = await prisma.movimientoFlujo.createMany({
    data: nuevos.map((m) => ({
      documento: m.documento, fecha: m.fecha, anio: m.anio, mes: m.mes, tipo: m.tipo,
      terceroNombre: m.terceroNombre, nit: m.nit, beneficiario: m.beneficiario,
      detalle: m.detalle, observacion: m.observacion, valor: m.valor,
      categoriaId: cats.get(catDe(m)) ?? null,
    })),
    skipDuplicates: true,
  });

  await auditar({
    usuarioId: g.usuarioId,
    accion: "flujo.importar",
    entidad: "MovimientoFlujo",
    valorNuevo: { tipo: parsed.tipo, insertados: res.count, sumaNuevos, archivo: file.name },
  });

  revalidatePath("/flujo");
  revalidatePath("/flujo/ingresos");
  revalidatePath("/flujo/egresos");

  return { ...salidaBase, ok: true, insertados: res.count };
}
