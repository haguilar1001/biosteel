// ==========================================================
// Registro de recaudos (operación financiera sensible).
// - Transacción atómica: recaudo + aplicaciones + retenciones + saldos.
// - Anti-IDOR: solo se aplican facturas dentro del alcance del usuario.
// - Auditoría del evento (BIO-SEC-007).
// ==========================================================
import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { UsuarioConRol } from "@/lib/auth/session";
import type { Alcance } from "@/lib/rbac/permissions";
import { filtroFacturas } from "@/lib/rbac/authorize";
import { auditar } from "@/lib/audit/log";
import type { RecaudoInput } from "@/lib/validation/tesoreria";

export interface ResultadoRecaudo {
  ok: boolean;
  error?: string;
  recaudoId?: number;
}

/**
 * Registra un recaudo aplicándolo a facturas y descontando su saldo.
 * `alcance` es el alcance del usuario sobre la cartera (filtra las facturas).
 */
export async function registrarRecaudo(
  usuario: UsuarioConRol,
  alcance: Alcance,
  input: RecaudoInput,
  ip?: string | null,
): Promise<ResultadoRecaudo> {
  const idsFactura = input.aplicaciones.map((a) => a.facturaId);

  try {
    const recaudo = await prisma.$transaction(async (tx) => {
      // 1) Traer las facturas objetivo DENTRO del alcance y del tercero.
      const facturas = await tx.facturaVenta.findMany({
        where: {
          id: { in: idsFactura },
          terceroId: input.terceroId,
          estado: { not: "cancelada" },
          ...filtroFacturas(usuario, alcance), // anti-IDOR (BIO-SEC-001)
        },
        select: { id: true, saldo: true, valorTotal: true },
      });

      if (facturas.length !== idsFactura.length) {
        throw new Error("Alguna factura no existe, no pertenece al cliente o está fuera de tu alcance.");
      }

      const saldoPorId = new Map(facturas.map((f) => [f.id, f]));
      for (const ap of input.aplicaciones) {
        const f = saldoPorId.get(ap.facturaId)!;
        if (ap.valor > f.saldo.toNumber() + 0.5) {
          throw new Error(`El valor aplicado supera el saldo de la factura #${ap.facturaId}.`);
        }
      }

      const totalRetenciones = input.retenciones.reduce((s, r) => s + r.valor, 0);

      // 2) Crear el recaudo.
      const rec = await tx.recaudo.create({
        data: {
          terceroId: input.terceroId,
          cuentaId: input.cuentaId ?? null,
          fecha: new Date(input.fecha),
          medio: input.medio,
          valorRecibido: new Prisma.Decimal(input.valorRecibido),
          totalRetenciones: new Prisma.Decimal(totalRetenciones),
          referencia: input.referencia,
          createdById: usuario.id,
        },
      });

      // 3) Retenciones del recaudo.
      if (input.retenciones.length > 0) {
        await tx.recaudoRetencion.createMany({
          data: input.retenciones.map((r) => ({
            recaudoId: rec.id,
            conceptoId: r.conceptoId,
            base: new Prisma.Decimal(r.base),
            valor: new Prisma.Decimal(r.valor),
          })),
        });
      }

      // 4) Aplicaciones + descuento de saldo y nuevo estado.
      for (const ap of input.aplicaciones) {
        const f = saldoPorId.get(ap.facturaId)!;
        await tx.recaudoAplicacion.create({
          data: { recaudoId: rec.id, facturaId: ap.facturaId, valorAplicado: new Prisma.Decimal(ap.valor) },
        });
        const nuevoSaldo = f.saldo.toNumber() - ap.valor;
        await tx.facturaVenta.update({
          where: { id: ap.facturaId },
          data: {
            saldo: new Prisma.Decimal(Math.max(0, nuevoSaldo)),
            estado: nuevoSaldo <= 0.5 ? "cancelada" : "abonada_parcial",
          },
        });
      }

      return rec;
    });

    await auditar({
      usuarioId: usuario.id,
      accion: "recaudo.crear",
      entidad: "Recaudo",
      entidadId: recaudo.id,
      ip,
      valorNuevo: {
        terceroId: input.terceroId,
        valorRecibido: input.valorRecibido,
        facturas: idsFactura,
      },
    });

    return { ok: true, recaudoId: recaudo.id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "No se pudo registrar el recaudo.";
    return { ok: false, error: msg };
  }
}
