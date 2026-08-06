// ==========================================================
// Registro de pagos a proveedores (operación financiera sensible).
// - Transacción atómica: pago + aplicaciones + saldos de documentos.
// - Moneda extranjera: los saldos de CxP están en COP; el valor origen
//   se deriva con la TRM del pago.
// - Auditoría del evento (BIO-SEC-007).
// ==========================================================
import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { UsuarioConRol } from "@/lib/auth/session";
import { auditar } from "@/lib/audit/log";
import type { PagoInput } from "@/lib/validation/tesoreria";

export interface ResultadoPago {
  ok: boolean;
  error?: string;
  pagoId?: number;
}

export async function registrarPago(
  usuario: UsuarioConRol,
  input: PagoInput,
  ip?: string | null,
): Promise<ResultadoPago> {
  const idsDoc = input.aplicaciones.map((a) => a.documentoId);

  try {
    const pago = await prisma.$transaction(async (tx) => {
      const docs = await tx.documentoCxp.findMany({
        where: { id: { in: idsDoc }, proveedorId: input.proveedorId, estado: { not: "pagado" } },
        select: { id: true, saldo: true, moneda: true },
      });

      if (docs.length !== idsDoc.length) {
        throw new Error("Algún documento no existe, no pertenece al proveedor o ya está pagado.");
      }

      const docPorId = new Map(docs.map((d) => [d.id, d]));
      for (const ap of input.aplicaciones) {
        const d = docPorId.get(ap.documentoId)!;
        if (ap.valor > d.saldo.toNumber() + 0.5) {
          throw new Error(`El valor aplicado supera el saldo del documento #${ap.documentoId}.`);
        }
      }

      const valorCop = input.aplicaciones.reduce((s, a) => s + a.valor, 0);
      const valorOrigen = input.moneda === "COP" ? valorCop : valorCop / input.trmPago;

      const pg = await tx.pago.create({
        data: {
          proveedorId: input.proveedorId,
          cuentaId: input.cuentaId ?? null,
          moneda: input.moneda,
          trmPago: new Prisma.Decimal(input.trmPago),
          valorOrigen: new Prisma.Decimal(valorOrigen),
          valorCop: new Prisma.Decimal(valorCop),
          fecha: new Date(input.fecha),
          createdById: usuario.id,
        },
      });

      for (const ap of input.aplicaciones) {
        const d = docPorId.get(ap.documentoId)!;
        await tx.pagoAplicacion.create({
          data: { pagoId: pg.id, documentoId: ap.documentoId, valorAplicado: new Prisma.Decimal(ap.valor) },
        });
        const nuevoSaldo = d.saldo.toNumber() - ap.valor;
        await tx.documentoCxp.update({
          where: { id: ap.documentoId },
          data: {
            saldo: new Prisma.Decimal(Math.max(0, nuevoSaldo)),
            estado: nuevoSaldo <= 0.5 ? "pagado" : "pagado_parcial",
          },
        });
      }

      return pg;
    });

    await auditar({
      usuarioId: usuario.id,
      accion: "pago.crear",
      entidad: "Pago",
      entidadId: pago.id,
      ip,
      valorNuevo: { proveedorId: input.proveedorId, moneda: input.moneda, documentos: idsDoc },
    });

    return { ok: true, pagoId: pago.id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "No se pudo registrar el pago.";
    return { ok: false, error: msg };
  }
}
