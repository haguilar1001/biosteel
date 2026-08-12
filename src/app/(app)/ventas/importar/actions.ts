"use server";
// Importa un reporte SIESA "FACTURAS POR ITEM", calcula la Nota Crédito con
// los parámetros/exclusiones de la BD y reliquida (delete+recreate por año).
// Flujo de dos pasos: preview (no escribe) → commit.
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireUsuario } from "@/server/auth-context";
import { exigirPermiso } from "@/lib/rbac/authorize";
import { auditar } from "@/lib/audit/log";
import { leerRenglones, agregarVentas } from "@/lib/negocio/importar-ventas";
import type { ParamNC } from "@/lib/negocio/nota-credito";

export interface ImportVentasState {
  error?: string;
  preview?: boolean;
  committed?: boolean;
  renglones?: number;
  sinFecha?: number;
  totalNC?: number;
  anios?: { anio: number; neto: number; lineas: number; clientes: number }[];
}

const MAX_MB = 30;
const dec = (v: number) => new Prisma.Decimal(Math.round(v * 100) / 100);

export async function importarVentasAction(_prev: ImportVentasState, fd: FormData): Promise<ImportVentasState> {
  const usuario = await requireUsuario();
  try { await exigirPermiso(usuario, "ventas.manage"); } catch { return { error: "No autorizado." }; }

  const file = fd.get("file");
  const intent = String(fd.get("intent") ?? "preview");
  if (!(file instanceof File) || file.size === 0) return { error: "Sube un archivo Excel (.xlsx)." };
  if (file.size > MAX_MB * 1024 * 1024) return { error: `El archivo supera ${MAX_MB} MB. Sube un archivo por mes o usa la recarga por lote.` };

  let filas, sinFecha;
  try {
    ({ filas, sinFecha } = leerRenglones(Buffer.from(await file.arrayBuffer())));
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo leer el archivo." };
  }

  const [pRows, xRows] = await Promise.all([
    prisma.parametroNotaCredito.findMany(),
    prisma.exclusionNC.findMany({ where: { concepto: "TODOS" } }),
  ]);
  if (pRows.length === 0) return { error: "No hay parámetros NC cargados. Corre db:params-nc primero." };
  const params: ParamNC[] = pRows.map((p) => ({ ips: p.ips, concepto: p.concepto, pct: p.pct.toNumber(), ini: p.fechaInicio.getTime(), fin: p.fechaFin.getTime() }));
  const excluidos = new Set(xRows.map((x) => x.nroDocumento));

  const agg = agregarVentas(filas, params, excluidos);
  const anios = agg.anios.map((a) => ({
    anio: a,
    neto: agg.netoPorAnio.get(a) ?? 0,
    lineas: agg.porLinea.filter((e) => e.anio === a).length,
    clientes: agg.porCliente.filter((e) => e.anio === a).length,
  }));

  if (intent !== "commit") {
    return { preview: true, renglones: agg.renglones, sinFecha, totalNC: agg.totalNC, anios };
  }

  // Commit: reemplaza los años presentes en el archivo.
  for (const a of agg.anios) {
    const lineas = agg.porLinea.filter((e) => e.anio === a);
    const clientes = agg.porCliente.filter((e) => e.anio === a);
    const marcas = agg.porMarca.filter((e) => e.anio === a);
    const marcaIps = agg.porMarcaIps.filter((e) => e.anio === a);
    await prisma.$transaction([
      prisma.ventaLinea.deleteMany({ where: { anio: a } }),
      prisma.ventaCliente.deleteMany({ where: { anio: a } }),
      prisma.ventaMarca.deleteMany({ where: { anio: a } }),
      prisma.ventaMarcaIps.deleteMany({ where: { anio: a } }),
    ]);
    for (let i = 0; i < lineas.length; i += 1000) {
      await prisma.ventaLinea.createMany({ data: lineas.slice(i, i + 1000).map((e) => ({ anio: e.anio, mes: e.mes, linea: e.linea, valor: dec(e.valor), costo: dec(e.costo) })) });
    }
    for (let i = 0; i < clientes.length; i += 1000) {
      await prisma.ventaCliente.createMany({ data: clientes.slice(i, i + 1000).map((e) => ({ anio: e.anio, mes: e.mes, clienteNombre: e.clienteNombre, nit: e.nit, valor: dec(e.valor), costo: dec(e.costo) })) });
    }
    for (let i = 0; i < marcas.length; i += 1000) {
      await prisma.ventaMarca.createMany({ data: marcas.slice(i, i + 1000).map((e) => ({ anio: e.anio, mes: e.mes, marca: e.marca, valor: dec(e.valor), costo: dec(e.costo) })) });
    }
    for (let i = 0; i < marcaIps.length; i += 1000) {
      await prisma.ventaMarcaIps.createMany({ data: marcaIps.slice(i, i + 1000).map((e) => ({ anio: e.anio, mes: e.mes, marca: e.marca, ips: e.ips, valor: dec(e.valor), costo: dec(e.costo) })) });
    }
  }
  await auditar({ usuarioId: usuario.id, accion: "ventas.importar", entidad: "VentaLinea", entidadId: agg.anios.join(",") });
  revalidatePath("/ventas");
  revalidatePath("/ventas/historico");
  revalidatePath("/ventas/clientes");
  return { committed: true, renglones: agg.renglones, sinFecha, totalNC: agg.totalNC, anios };
}
