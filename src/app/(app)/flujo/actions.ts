"use server";
// Reclasificación manual de un movimiento de flujo (cambiar su categoría).
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUsuario } from "@/server/auth-context";
import { exigirPermiso } from "@/lib/rbac/authorize";
import { auditar } from "@/lib/audit/log";

export interface ReclasState {
  ok?: boolean;
  error?: string;
}

/** Cambia la categoría de un movimiento. categoriaId null = sin categoría. */
export async function reclasificarAction(movimientoId: number, categoriaId: number | null): Promise<ReclasState> {
  const usuario = await requireUsuario();
  try {
    await exigirPermiso(usuario, "flujo.manage");
  } catch {
    return { error: "Sin permiso para reclasificar." };
  }

  if (!Number.isInteger(movimientoId) || movimientoId <= 0) return { error: "Movimiento inválido." };

  const mov = await prisma.movimientoFlujo.findUnique({ where: { id: movimientoId }, select: { tipo: true, categoriaId: true } });
  if (!mov) return { error: "El movimiento no existe." };

  // La categoría debe existir y ser de la misma dirección (ingreso/egreso).
  if (categoriaId != null) {
    const cat = await prisma.categoriaFlujo.findUnique({ where: { id: categoriaId }, select: { tipo: true } });
    if (!cat) return { error: "La categoría no existe." };
    if (cat.tipo !== mov.tipo) return { error: "La categoría no corresponde al tipo del movimiento." };
  }

  await prisma.movimientoFlujo.update({ where: { id: movimientoId }, data: { categoriaId } });

  await auditar({
    usuarioId: usuario.id,
    accion: "flujo.reclasificar",
    entidad: "MovimientoFlujo",
    entidadId: movimientoId,
    valorAnterior: { categoriaId: mov.categoriaId },
    valorNuevo: { categoriaId },
  });

  revalidatePath("/flujo/ingresos");
  revalidatePath("/flujo/egresos");
  revalidatePath("/flujo/presupuesto");
  return { ok: true };
}
