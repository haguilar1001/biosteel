// ==========================================================
// Shell de la aplicación autenticada.
// - Exige sesión (requireUsuario redirige a /login si no hay).
// - La navegación se filtra por permisos (deny-by-default): cada
//   módulo solo aparece si el rol tiene el permiso correspondiente.
// ==========================================================
import { requireUsuario } from "@/server/auth-context";
import { puede } from "@/lib/rbac/authorize";
import type { PermisoClave } from "@/lib/rbac/permissions";
import { logoutAction } from "../login/actions";
import { GruposBar, SubMenu, type Grupo } from "./_components/GroupNav";
import { ADMIN_SECCIONES } from "./admin/_nav";

// Menú en dos niveles: grupo → módulos. Cada módulo se filtra por permiso;
// un grupo sin módulos visibles no se muestra.
// (Reportes, Recaudos y Pagos quedan ocultos hasta que tengan datos.)
const GRUPOS_DEF: { id: string; label: string; icon: string; items: { href: string; label: string; permiso: PermisoClave }[] }[] = [
  { id: "inicio", label: "Inicio", icon: "🏠", items: [
    { href: "/dashboard", label: "🏠 Inicio", permiso: "dashboard.view" },
  ] },
  { id: "tesoreria", label: "Tesorería", icon: "💰", items: [
    { href: "/flujo", label: "💵 Flujo de Caja", permiso: "cxp.view" },
    { href: "/cxp", label: "📤 Cuentas por Pagar", permiso: "cxp.view" },
    { href: "/obligaciones", label: "🏦 Obligaciones", permiso: "cxp.view" },
    { href: "/impuestos", label: "🧾 Impuestos", permiso: "cxp.view" },
  ] },
  { id: "comercial", label: "Comercial", icon: "🛒", items: [
    { href: "/ventas", label: "💹 Ventas", permiso: "cxp.view" },
    { href: "/cartera", label: "📥 Cartera", permiso: "cartera.view" },
  ] },
  { id: "analisis", label: "Análisis", icon: "📊", items: [
    { href: "/indicadores", label: "📈 Indicadores", permiso: "cxp.view" },
    { href: "/pyg", label: "📄 PyG", permiso: "cxp.view" },
  ] },
  { id: "inventarios", label: "Inventarios", icon: "📦", items: [
    { href: "/inventario", label: "📦 Inventario", permiso: "inventario.view" },
    { href: "/inventario/ciudades", label: "📍 Por Ciudad", permiso: "inventario.view" },
    { href: "/inventario/estados", label: "🔍 Por Estado", permiso: "inventario.view" },
    { href: "/inventario/novedades", label: "🔔 Novedades", permiso: "inventario.view" },
  ] },
];

function iniciales(nombre: string): string {
  return nombre
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const usuario = await requireUsuario();

  // Filtra módulos por permiso y descarta grupos vacíos.
  const grupos: Grupo[] = [];
  for (const g of GRUPOS_DEF) {
    const items: { href: string; label: string }[] = [];
    for (const m of g.items) {
      if (await puede(usuario, m.permiso)) items.push({ href: m.href, label: m.label });
    }
    if (items.length) grupos.push({ id: g.id, label: g.label, icon: g.icon, items });
  }

  // Grupo "Administración" (barra azul). El submenú muestra las secciones;
  // cada una aparece si el usuario puede ver al menos una de sus páginas, y
  // enlaza a la primera página permitida. `match` abarca todas sus rutas para
  // que el submenú se resalte también en las sub-páginas (roles, auditoría…).
  const itemsAdmin: { href: string; label: string; match: string[] }[] = [];
  for (const s of ADMIN_SECCIONES) {
    let primera: string | undefined;
    for (const t of s.tabs) {
      if (await puede(usuario, t.permiso)) { primera = t.href; break; }
    }
    if (primera) itemsAdmin.push({ href: primera, label: s.label, match: s.tabs.map((t) => t.href) });
  }
  if (itemsAdmin.length) grupos.push({ id: "admin", label: "Administración", icon: "⚙️", items: itemsAdmin });

  return (
    <>
      <header className="appbar">
        <div className="logo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/BIOSTEEL.png" alt="BioSteel de Colombia S.A.S" className="logo-img" />
        </div>
        <GruposBar grupos={grupos} />
        <div className="sep" />
        <div className="ctx">
          <span className="chip-ctx" title={usuario.rol.nombre}>{usuario.rol.nombre}</span>
          {(await puede(usuario, "cxp.view")) && (
            <a href="/notificaciones" className="bell" title="Notificaciones" aria-label="Notificaciones">🔔</a>
          )}
          <a href="/cambiar-clave" className="avatar" title={`${usuario.nombre} · Cambiar contraseña`} style={{ textDecoration: "none" }}>{iniciales(usuario.nombre)}</a>
          <form action={logoutAction} style={{ margin: 0 }}>
            <button type="submit" className="logout">Salir</button>
          </form>
        </div>
      </header>

      <SubMenu grupos={grupos} />

      <main className="wrap">{children}</main>
    </>
  );
}
