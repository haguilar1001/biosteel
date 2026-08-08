// Redirige a la primera sección de administración permitida.
import { redirect } from "next/navigation";
import { requireUsuario } from "@/server/auth-context";
import { puede } from "@/lib/rbac/authorize";
import type { PermisoClave } from "@/lib/rbac/permissions";

const ORDEN: { href: string; permiso: PermisoClave }[] = [
  { href: "/admin/usuarios", permiso: "usuario.manage" },
  { href: "/admin/roles", permiso: "rol.manage" },
  { href: "/admin/terceros", permiso: "tercero.manage" },
  { href: "/admin/parametrizacion", permiso: "parametro.manage" },
  { href: "/admin/auditoria", permiso: "auditoria.view" },
];

export default async function AdminIndex() {
  const usuario = await requireUsuario();
  for (const o of ORDEN) {
    if (await puede(usuario, o.permiso)) redirect(o.href);
  }
  redirect("/dashboard");
}
