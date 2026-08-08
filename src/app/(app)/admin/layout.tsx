// ==========================================================
// Layout del área de Administración. La navegación ahora vive en el menú
// principal (dos grupos de primer nivel: "Manejo de usuarios" y
// "Administración"), así que aquí solo se valida la sesión (defensa en capas:
// cada página además valida su propio permiso).
// ==========================================================
import { requireUsuario } from "@/server/auth-context";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireUsuario();
  return <>{children}</>;
}
