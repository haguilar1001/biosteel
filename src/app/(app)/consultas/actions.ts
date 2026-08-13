"use server";
// ==========================================================
// Server action del asistente de consultas. Exige sesión + permiso y delega
// en el motor local (sin API externa). Devuelve una Respuesta serializable.
// ==========================================================
import { requirePermiso } from "@/server/auth-context";
import { responder } from "@/lib/negocio/consultas/motor";
import type { Respuesta } from "@/lib/negocio/consultas/tipos";

export async function preguntarAction(pregunta: string): Promise<Respuesta> {
  const { usuario, alcance } = await requirePermiso("cxp.view");
  return responder(pregunta, { usuario, alcance });
}
