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
  // Administración dividida en dos grupos de primer nivel (barra azul).
  { id: "usuarios", label: "Manejo de usuarios", icon: "👥", items: [
    { href: "/admin/usuarios", label: "👤 Usuarios", permiso: "usuario.manage" },
    { href: "/admin/roles", label: "🔐 Roles y permisos", permiso: "rol.manage" },
    { href: "/admin/auditoria", label: "📜 Auditoría", permiso: "auditoria.view" },
  ] },
  // "Administración" agrupa la parametrización de la app y los catálogos
  // (terceros y los que se vayan sumando).
  { id: "admin", label: "Administración", icon: "⚙️", items: [
    { href: "/admin/parametrizacion", label: "🎨 Fuente y tamaño", permiso: "parametro.manage" },
    { href: "/admin/terceros", label: "🧑‍💼 Terceros", permiso: "tercero.manage" },
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
