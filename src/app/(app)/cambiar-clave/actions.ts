"use server";
// ==========================================================
// Cambio de contraseña propia (BIO-SEC-002/015).
// Verifica la actual, aplica la política, re-hashea con Argon2id y
// cierra todas las sesiones (obliga a re-autenticarse).
// ==========================================================
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireUsuario } from "@/server/auth-context";
import { prisma } from "@/lib/db";
import { verifyPassword, hashPassword } from "@/lib/auth/password";
import { cambioPasswordSchema } from "@/lib/validation/auth";
import { invalidarSesionesUsuario, SESSION_COOKIE } from "@/lib/auth/session";
import { auditar } from "@/lib/audit/log";

export interface CambioState {
  error?: string;
}

export async function cambiarClaveAction(_prev: CambioState, formData: FormData): Promise<CambioState> {
  const usuario = await requireUsuario();

  const parsed = cambioPasswordSchema.safeParse({
    actual: formData.get("actual"),
    nueva: formData.get("nueva"),
    confirmar: formData.get("confirmar"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }
  const { actual, nueva } = parsed.data;

  const full = await prisma.usuario.findUnique({ where: { id: usuario.id } });
  if (!full || !(await verifyPassword(full.passwordHash, actual))) {
    return { error: "La contraseña actual no es correcta." };
  }
  if (await verifyPassword(full.passwordHash, nueva)) {
    return { error: "La nueva contraseña debe ser diferente de la actual." };
  }

  const nuevoHash = await hashPassword(nueva);
  await prisma.usuario.update({ where: { id: usuario.id }, data: { passwordHash: nuevoHash } });

  // Cierra TODAS las sesiones del usuario (incluida la actual).
  await invalidarSesionesUsuario(usuario.id);

  const h = await headers();
  const ip = (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? null)?.trim() ?? null;
  await auditar({ usuarioId: usuario.id, accion: "usuario.cambio_clave", entidad: "Usuario", entidadId: usuario.id, ip });

  const store = await cookies();
  store.delete(SESSION_COOKIE);
  redirect("/login?cambiada=1");
}
