// ==========================================================
// Helpers de contexto para páginas y acciones protegidas.
// requireUsuario() y requirePermiso() redirigen si no hay acceso.
// ==========================================================
import "server-only";
import { redirect } from "next/navigation";
import { getUsuarioActual } from "@/lib/auth/current-user";
import { exigirPermiso } from "@/lib/rbac/authorize";
import type { UsuarioConRol } from "@/lib/auth/session";
import type { PermisoClave } from "@/lib/rbac/permissions";

/** Exige sesión activa; si no, redirige a /login. */
export async function requireUsuario(): Promise<UsuarioConRol> {
  const usuario = await getUsuarioActual();
  if (!usuario) redirect("/login");
  return usuario;
}

/** Exige sesión + permiso; si no, redirige. Devuelve usuario y alcance. */
export async function requirePermiso(permiso: PermisoClave) {
  const usuario = await requireUsuario();
  try {
    const alcance = await exigirPermiso(usuario, permiso);
    return { usuario, alcance };
  } catch {
    redirect("/dashboard?denegado=1");
  }
}
