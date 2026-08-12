"use server";
// Alta/baja de Exclusiones NC (facturas excluidas del descuento).
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUsuario } from "@/server/auth-context";
import { exigirPermiso } from "@/lib/rbac/authorize";
import { auditar } from "@/lib/audit/log";

export async function agregarExclusion(fd: FormData): Promise<void> {
  const usuario = await requireUsuario();
  await exigirPermiso(usuario, "ventas.manage");
  const nroDocumento = String(fd.get("nroDocumento") ?? "").trim().toUpperCase();
  const motivo = String(fd.get("motivo") ?? "").trim() || null;
  if (!nroDocumento) return;
  await prisma.exclusionNC.upsert({
    where: { nroDocumento_concepto: { nroDocumento, concepto: "TODOS" } },
    update: { motivo },
    create: { nroDocumento, concepto: "TODOS", motivo },
  });
  await auditar({ usuarioId: usuario.id, accion: "ventas.exclusion.crear", entidad: "ExclusionNC", entidadId: nroDocumento });
  revalidatePath("/ventas/exclusiones");
}

export async function quitarExclusion(fd: FormData): Promise<void> {
  const usuario = await requireUsuario();
  await exigirPermiso(usuario, "ventas.manage");
  const id = Number(fd.get("id"));
  if (!Number.isFinite(id)) return;
  await prisma.exclusionNC.delete({ where: { id } });
  await auditar({ usuarioId: usuario.id, accion: "ventas.exclusion.quitar", entidad: "ExclusionNC", entidadId: String(id) });
  revalidatePath("/ventas/exclusiones");
}
