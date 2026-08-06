// ==========================================================
// Esquemas de validación de entrada (Zod) — BIO-SEC-005
// ==========================================================
import { z } from "zod";

/** Política de contraseñas (BIO-SEC-002). */
export const passwordPolicy = z
  .string()
  .min(12, "La contraseña debe tener al menos 12 caracteres")
  .max(128, "La contraseña es demasiado larga")
  .regex(/[a-z]/, "Debe incluir una letra minúscula")
  .regex(/[A-Z]/, "Debe incluir una letra mayúscula")
  .regex(/[0-9]/, "Debe incluir un número")
  .regex(/[^A-Za-z0-9]/, "Debe incluir un carácter especial");

/** Datos del formulario de inicio de sesión. */
export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Correo inválido"),
  password: z.string().min(1, "Ingresa tu contraseña").max(128),
  // Código TOTP opcional (segundo paso — BIO-SEC-002 / P1)
  totp: z.string().trim().regex(/^\d{6}$/, "Código de 6 dígitos").optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;

/** Cambio de contraseña con política aplicada. */
export const cambioPasswordSchema = z
  .object({
    actual: z.string().min(1),
    nueva: passwordPolicy,
    confirmar: z.string(),
  })
  .refine((d) => d.nueva === d.confirmar, {
    message: "Las contraseñas no coinciden",
    path: ["confirmar"],
  });
