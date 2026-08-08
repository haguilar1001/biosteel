// ==========================================================
// Layout del área de Administración.
// - La barra azul muestra el grupo "Administración" y el submenú sus secciones
//   (Manejo de usuarios, Terceros, Configuración): eso vive en el layout raíz.
// - Aquí se renderizan las pestañas internas (nivel 3) de la sección activa,
//   filtradas por permiso. Cada página además valida su propio permiso.
// ==========================================================
import { requireUsuario } from "@/server/auth-context";
import { puede } from "@/lib/rbac/authorize";
import { ADMIN_SECCIONES } from "./_nav";
import { AdminTabs, type Seccion } from "./_components/AdminTabs";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const usuario = await requireUsuario();

  // Deja en cada sección solo las páginas que el usuario puede ver.
  const secciones: Seccion[] = [];
  for (const s of ADMIN_SECCIONES) {
    const tabs: { href: string; label: string }[] = [];
    for (const t of s.tabs) {
      if (await puede(usuario, t.permiso)) tabs.push({ href: t.href, label: t.label });
    }
    if (tabs.length) secciones.push({ id: s.id, tabs });
  }

  return (
    <>
      <AdminTabs secciones={secciones} />
      {children}
    </>
  );
}
