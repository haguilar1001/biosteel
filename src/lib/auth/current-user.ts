// ==========================================================
// Contexto de usuario de la petición actual (Server Components / Actions)
// Memoizado por petición con React cache().
// ==========================================================
import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { SESSION_COOKIE, validarSesion, type UsuarioConRol } from "./session";

/** Devuelve el usuario autenticado o null. No redirige. */
export const getUsuarioActual = cache(async (): Promise<UsuarioConRol | null> => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  const sesion = await validarSesion(token);
  return sesion?.usuario ?? null;
});
