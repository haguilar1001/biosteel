"use server";
// ==========================================================
// Plan de formación: guardar las capacitaciones planeadas de un año.
// Es el denominador del indicador de ejecución, así que cambiarlo mueve un
// indicador de calidad — por eso pide permiso propio y queda auditado.
// ==========================================================
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireUsuario } from "@/server/auth-context";
import { exigirPermiso } from "@/lib/rbac/authorize";
import { auditar } from "@/lib/audit/log";
import { guardarPlan } from "@/lib/negocio/capacitaciones";

export interface PlanState { ok?: boolean; error?: string; mensaje?: string }

const anioSchema = z.coerce.number().int().min(2000).max(2100);
/** Un mes: vacío = sin plan (se borra); un número 0–99 = plan del mes. */
const mesSchema = z.union([
  z.literal("").transform(() => null),
  z.coerce.number().int().min(0, "El plan no puede ser negativo.").max(99, "¿99 capacitaciones en un mes?"),
]);

export async function guardarPlanAction(_prev: PlanState, fd: FormData): Promise<PlanState> {
  const usuario = await requireUsuario();
  try {
    await exigirPermiso(usuario, "capacitaciones.manage");
  } catch {
    return { error: "No tienes permiso para editar el plan de formación." };
  }

  const anioP = anioSchema.safeParse(fd.get("anio"));
  if (!anioP.success) return { error: "Año inválido." };
  const anio = anioP.data;

  const planeadas: Record<number, number | null> = {};
  for (let mes = 1; mes <= 12; mes++) {
    const crudo = String(fd.get(`mes-${mes}`) ?? "").trim();
    const p = mesSchema.safeParse(crudo);
    if (!p.success) return { error: `Mes ${mes}: ${p.error.issues[0]?.message ?? "valor inválido"}.` };
    planeadas[mes] = p.data;
  }

  const { guardados, borrados } = await guardarPlan(anio, planeadas);

  await auditar({
    usuarioId: usuario.id, accion: "capacitaciones.plan", entidad: "CapacitacionPlan",
    entidadId: anio, valorNuevo: { anio, planeadas },
  });

  revalidatePath("/nomina/capacitaciones");
  revalidatePath("/nomina/capacitaciones/plan");
  return {
    ok: true,
    mensaje: `Plan de ${anio} guardado: ${guardados} mes(es) con plan${borrados ? ` · ${borrados} mes(es) quedaron sin plan` : ""}.`,
  };
}
