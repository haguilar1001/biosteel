// ==========================================================
// Bloqueo de cuenta por intentos fallidos (BIO-SEC-004)
// Persistente en la BD (funciona en multi-instancia).
// ==========================================================
import "server-only";
import { prisma } from "@/lib/db";

const MAX_INTENTOS = 5;
const BLOQUEO_MIN = 15;

export function estaBloqueado(bloqueadoHasta: Date | null): boolean {
  return !!bloqueadoHasta && bloqueadoHasta.getTime() > Date.now();
}

/** Registra un intento fallido y bloquea la cuenta al superar el umbral. */
export async function registrarFallo(usuarioId: number): Promise<void> {
  const usuario = await prisma.usuario.findUnique({ where: { id: usuarioId } });
  if (!usuario) return;

  const intentos = usuario.intentosFallidos + 1;
  const bloqueadoHasta =
    intentos >= MAX_INTENTOS ? new Date(Date.now() + BLOQUEO_MIN * 60_000) : usuario.bloqueadoHasta;

  await prisma.usuario.update({
    where: { id: usuarioId },
    data: { intentosFallidos: intentos, bloqueadoHasta },
  });
}

/** Reinicia el contador tras un inicio de sesión exitoso. */
export async function reiniciarFallos(usuarioId: number): Promise<void> {
  await prisma.usuario.update({
    where: { id: usuarioId },
    data: { intentosFallidos: 0, bloqueadoHasta: null, ultimoAcceso: new Date() },
  });
}
