// ==========================================================
// Validación (Zod) para administración: crear usuario y crear perfil/rol.
// ==========================================================
import { z } from "zod";
import { passwordPolicy } from "./auth";

export const crearUsuarioSchema = z.object({
  nombre: z.string().trim().min(2, "Nombre muy corto").max(120),
  email: z.string().trim().toLowerCase().email("Correo inválido"),
  clave: passwordPolicy,
  rolId: z.coerce.number().int().positive("Rol inválido"),
  // "" o ausente = sin sede (alcance global).
  sedeId: z.preprocess(
    (v) => (v === "" || v == null ? null : v),
    z.coerce.number().int().positive().nullable(),
  ),
});

export const crearRolSchema = z.object({
  nombre: z.string().trim().min(2, "Nombre muy corto").max(40),
});
