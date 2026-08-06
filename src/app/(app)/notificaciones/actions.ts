"use server";
import { revalidatePath } from "next/cache";
import { requireUsuario } from "@/server/auth-context";
import { exigirPermiso } from "@/lib/rbac/authorize";
import { ejecutarRecordatorios, type ResultadoRecordatorios } from "@/lib/notificaciones/recordatorios";

export interface EjecutarState {
  resultado?: ResultadoRecordatorios;
  error?: string;
}

export async function ejecutarAhoraAction(_prev: EjecutarState): Promise<EjecutarState> {
  const usuario = await requireUsuario();
  try {
    await exigirPermiso(usuario, "cxp.view");
  } catch {
    return { error: "No tienes permiso para ejecutar notificaciones." };
  }
  const resultado = await ejecutarRecordatorios();
  revalidatePath("/notificaciones");
  return { resultado };
}
