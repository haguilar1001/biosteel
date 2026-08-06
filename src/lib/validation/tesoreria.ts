// ==========================================================
// Esquemas de validación (Zod) para tesorería — BIO-SEC-005
// Recaudos (aplicados a varias facturas + retenciones) y pagos
// a proveedores (con moneda extranjera).
// ==========================================================
import { z } from "zod";

const idPositivo = z.coerce.number().int().positive();
const montoPositivo = z.coerce.number().positive("Debe ser mayor a 0");
const montoNoNeg = z.coerce.number().nonnegative("No puede ser negativo");
const fechaISO = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida");

// ---------- Recaudo ----------
export const aplicacionSchema = z.object({
  facturaId: idPositivo,
  valor: montoPositivo,
});

export const retencionInputSchema = z.object({
  conceptoId: idPositivo,
  base: montoNoNeg,
  valor: montoPositivo,
});

export const recaudoSchema = z
  .object({
    terceroId: idPositivo,
    fecha: fechaISO,
    medio: z.enum(["transferencia", "cheque", "efectivo", "consignacion"]),
    cuentaId: idPositivo.optional(),
    valorRecibido: montoPositivo,
    referencia: z.string().trim().max(120).optional(),
    aplicaciones: z.array(aplicacionSchema).min(1, "Aplica el recaudo a al menos una factura"),
    retenciones: z.array(retencionInputSchema).default([]),
  })
  .refine(
    (d) => {
      const aplicado = d.aplicaciones.reduce((s, a) => s + a.valor, 0);
      const ret = d.retenciones.reduce((s, r) => s + r.valor, 0);
      // El saldo cubierto en facturas = efectivo recibido + retenciones.
      return Math.abs(aplicado - (d.valorRecibido + ret)) < 1;
    },
    { message: "El total aplicado debe igualar el valor recibido más las retenciones", path: ["aplicaciones"] },
  );

export type RecaudoInput = z.infer<typeof recaudoSchema>;

// ---------- Pago a proveedor ----------
export const pagoAplicacionSchema = z.object({
  documentoId: idPositivo,
  valor: montoPositivo,
});

export const pagoSchema = z
  .object({
    proveedorId: idPositivo,
    fecha: fechaISO,
    cuentaId: idPositivo.optional(),
    moneda: z.enum(["COP", "USD", "EUR"]),
    trmPago: z.coerce.number().positive("La TRM debe ser mayor a 0"),
    aplicaciones: z.array(pagoAplicacionSchema).min(1, "Aplica el pago a al menos un documento"),
  })
  .refine((d) => d.moneda === "COP" || d.trmPago > 1, {
    message: "Para moneda extranjera indica la TRM del día",
    path: ["trmPago"],
  });

export type PagoInput = z.infer<typeof pagoSchema>;
