// ==========================================================
// Registro de auditoría de operaciones sensibles (BIO-SEC-007)
// Nunca registra secretos ni contraseñas.
// ==========================================================
import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export interface EventoAuditoria {
  usuarioId?: number | null;
  accion: string; // "recaudo.crear", "usuario.login", "factura.anular"...
  entidad?: string;
  entidadId?: string | number;
  valorAnterior?: unknown;
  valorNuevo?: unknown;
  ip?: string | null;
}

export async function auditar(e: EventoAuditoria): Promise<void> {
  try {
    await prisma.logAuditoria.create({
      data: {
        usuarioId: e.usuarioId ?? null,
        accion: e.accion,
        entidad: e.entidad,
        entidadId: e.entidadId != null ? String(e.entidadId) : undefined,
        valorAnterior: (e.valorAnterior ?? undefined) as Prisma.InputJsonValue | undefined,
        valorNuevo: (e.valorNuevo ?? undefined) as Prisma.InputJsonValue | undefined,
        ip: e.ip ?? undefined,
      },
    });
  } catch (err) {
    // La auditoría nunca debe romper la operación principal.
    console.error("⚠️ No se pudo registrar auditoría:", err);
  }
}
