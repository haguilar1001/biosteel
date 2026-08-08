"use server";
import { z } from "zod";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { env } from "@/lib/env";
import { requireUsuario } from "@/server/auth-context";
import { exigirPermiso } from "@/lib/rbac/authorize";
import { ejecutarRecordatorios, type ResultadoRecordatorios } from "@/lib/notificaciones/recordatorios";
import { guardarConfig, obtenerConfig, normalizarDestinatarios } from "@/lib/notificaciones/config";
import { enviarAnuncio } from "@/lib/notificaciones/anuncio";

// --- Ejecutar recordatorios ahora -------------------------------------------
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

// --- Guardar configuración (días de anticipación + destinatarios) -----------
export interface ConfigState {
  ok?: boolean;
  error?: string;
}

const emailSchema = z.string().email();
const configSchema = z.object({
  diasAntes: z.coerce.number().int("Debe ser un número entero.").min(1, "Mínimo 1 día.").max(120, "Máximo 120 días."),
  destinatarios: z
    .string()
    .transform((s) => normalizarDestinatarios(s))
    .refine((s) => s.length > 0, "Indica al menos un correo.")
    .refine(
      (s) => s.split(",").every((e) => emailSchema.safeParse(e).success),
      "Hay un correo con formato inválido.",
    ),
});

export async function guardarConfigAction(_prev: ConfigState, formData: FormData): Promise<ConfigState> {
  const usuario = await requireUsuario();
  try {
    await exigirPermiso(usuario, "parametro.manage");
  } catch {
    return { error: "No tienes permiso para cambiar la configuración." };
  }
  const parsed = configSchema.safeParse({
    diasAntes: formData.get("diasAntes"),
    destinatarios: formData.get("destinatarios"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }
  await guardarConfig(
    { diasAntes: parsed.data.diasAntes, destinatariosRaw: parsed.data.destinatarios },
    usuario.email,
  );
  revalidatePath("/notificaciones");
  return { ok: true };
}

// --- Enviar correo de anuncio (prueba) --------------------------------------
export interface AnuncioState {
  enviado?: boolean;
  destinatarios?: string[];
  error?: string;
}

export async function enviarAnuncioAction(_prev: AnuncioState): Promise<AnuncioState> {
  const usuario = await requireUsuario();
  try {
    await exigirPermiso(usuario, "cxp.view");
  } catch {
    return { error: "No tienes permiso para enviar notificaciones." };
  }
  const cfg = await obtenerConfig();
  // A los destinatarios configurados + tu propio correo de sesión (para que
  // quien dispara la prueba también lo reciba). Sin duplicados.
  const to = Array.from(new Set([...cfg.destinatarios, usuario.email]));
  // URL base real de la petición (para el logo del correo), no APP_URL.
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  const baseUrl = host ? `${proto}://${host}` : env.APP_URL;
  try {
    await enviarAnuncio(to, cfg.diasAntes, baseUrl);
    return { enviado: true, destinatarios: to };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo enviar el anuncio." };
  }
}
