"use server";
// ==========================================================
// Server Action de inicio de sesión.
// Reúne el baseline P0: validación, rate limit, lockout, Argon2id,
// sesión segura y auditoría. (BIO-SEC-002/004/005/007/015)
// ==========================================================
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { loginSchema } from "@/lib/validation/auth";
import { verifyPassword } from "@/lib/auth/password";
import { crearSesion, SESSION_COOKIE } from "@/lib/auth/session";
import { estaBloqueado, registrarFallo, reiniciarFallos } from "@/lib/auth/lockout";
import { verificarTotp } from "@/lib/auth/mfa";
import { consumir } from "@/lib/auth/rate-limit";
import { auditar } from "@/lib/audit/log";

export interface LoginState {
  error?: string;
  needsTotp?: boolean;
}

const ERROR_GENERICO = "Credenciales inválidas."; // no revela si el usuario existe

/** Evita open-redirect: solo rutas internas. */
function destinoSeguro(next: FormDataEntryValue | null): string {
  const s = typeof next === "string" ? next : "";
  return s.startsWith("/") && !s.startsWith("//") ? s : "/dashboard";
}

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const h = await headers();
  const ip = (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "desconocida").trim();

  // 1) Rate limit por IP (BIO-SEC-004)
  const limite = consumir(`login:${ip}`, 10, 60_000);
  if (!limite.permitido) {
    return { error: `Demasiados intentos. Reintenta en ${limite.reintentarEnSeg} segundos.` };
  }

  // 2) Validación de entrada (BIO-SEC-005)
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    totp: formData.get("totp") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }
  const { email, password, totp } = parsed.data;

  const usuario = await prisma.usuario.findUnique({ where: { email } });

  // 3) Verificación (respuesta genérica ante cualquier fallo)
  if (!usuario || !usuario.activo) {
    await auditar({ accion: "usuario.login.fallido", entidad: "Usuario", ip, valorNuevo: { email } });
    return { error: ERROR_GENERICO };
  }

  // 4) Bloqueo por intentos (BIO-SEC-004)
  if (estaBloqueado(usuario.bloqueadoHasta)) {
    return { error: "Cuenta bloqueada temporalmente por intentos fallidos. Intenta más tarde." };
  }

  const passwordOk = await verifyPassword(usuario.passwordHash, password);
  if (!passwordOk) {
    await registrarFallo(usuario.id);
    await auditar({ usuarioId: usuario.id, accion: "usuario.login.fallido", entidad: "Usuario", entidadId: usuario.id, ip });
    return { error: ERROR_GENERICO };
  }

  // 5) Segundo factor si está activo (BIO-SEC-002)
  if (usuario.dobleFactor && usuario.totpSecret) {
    if (!totp) return { needsTotp: true };
    if (!verificarTotp(usuario.totpSecret, totp)) {
      await registrarFallo(usuario.id);
      return { error: "Código de verificación inválido.", needsTotp: true };
    }
  }

  // 6) Éxito: sesión segura (BIO-SEC-015)
  await reiniciarFallos(usuario.id);
  const { token, expiresAt } = await crearSesion(usuario.id, { ip, userAgent: h.get("user-agent") ?? undefined });

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });

  await auditar({ usuarioId: usuario.id, accion: "usuario.login.exito", entidad: "Usuario", entidadId: usuario.id, ip });

  redirect(destinoSeguro(formData.get("next")));
}

/** Cierre de sesión. */
export async function logoutAction(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    const { invalidarSesion } = await import("@/lib/auth/session");
    await invalidarSesion(token);
  }
  store.delete(SESSION_COOKIE);
  redirect("/login");
}
