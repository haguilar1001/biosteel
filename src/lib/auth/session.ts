// ==========================================================
// Gestión de sesiones (BIO-SEC-015)
// - Token opaco de 256 bits entregado al cliente en cookie HttpOnly.
// - En la BD solo se guarda el hash SHA-256 del token (si se filtra la
//   tabla, los tokens no son reutilizables).
// - Expiración deslizante con rotación del identificador.
// ==========================================================
import "server-only";
import { randomBytes, createHash } from "node:crypto";
import type { Usuario, Rol } from "@prisma/client";
import { prisma } from "@/lib/db";

export const SESSION_COOKIE = "biosteel_session";
const DURACION_MS = 1000 * 60 * 60 * 8; // 8 horas
const RENOVAR_SI_QUEDA_MENOS_DE = DURACION_MS / 2; // renueva pasada la mitad

export type UsuarioConRol = Usuario & { rol: Rol };

export interface SesionValida {
  usuario: UsuarioConRol;
  expiresAt: Date;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Crea una sesión y devuelve el token en claro (va a la cookie). */
export async function crearSesion(
  usuarioId: number,
  meta: { ip?: string; userAgent?: string } = {},
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("base64url");
  const id = hashToken(token);
  const expiresAt = new Date(Date.now() + DURACION_MS);

  await prisma.sesion.create({
    data: { id, usuarioId, expiresAt, ip: meta.ip, userAgent: meta.userAgent },
  });

  return { token, expiresAt };
}

/**
 * Valida el token de una petición. Aplica expiración deslizante:
 * si a la sesión le queda menos de la mitad de vida, se renueva.
 */
export async function validarSesion(token: string | undefined): Promise<SesionValida | null> {
  if (!token) return null;
  const id = hashToken(token);

  const sesion = await prisma.sesion.findUnique({
    where: { id },
    include: { usuario: { include: { rol: true } } },
  });
  if (!sesion) return null;

  // Expirada → eliminar
  if (sesion.expiresAt.getTime() <= Date.now()) {
    await prisma.sesion.delete({ where: { id } }).catch(() => {});
    return null;
  }

  // Usuario inactivo → invalidar
  if (!sesion.usuario.activo) {
    await prisma.sesion.delete({ where: { id } }).catch(() => {});
    return null;
  }

  // Renovación deslizante
  let expiresAt = sesion.expiresAt;
  if (expiresAt.getTime() - Date.now() < RENOVAR_SI_QUEDA_MENOS_DE) {
    expiresAt = new Date(Date.now() + DURACION_MS);
    await prisma.sesion.update({ where: { id }, data: { expiresAt } });
  }

  return { usuario: sesion.usuario, expiresAt };
}

/** Invalida una sesión (logout). */
export async function invalidarSesion(token: string | undefined): Promise<void> {
  if (!token) return;
  await prisma.sesion.delete({ where: { id: hashToken(token) } }).catch(() => {});
}

/** Invalida TODAS las sesiones de un usuario (p. ej. al cambiar contraseña). */
export async function invalidarSesionesUsuario(usuarioId: number): Promise<void> {
  await prisma.sesion.deleteMany({ where: { usuarioId } });
}
