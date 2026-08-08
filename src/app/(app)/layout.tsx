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
const GRUPOS_DEF: { id: string; label: string; items: { href: string; label: string; permiso: PermisoClave }[] }[] = [
  { id: "inicio", label: "Inicio", items: [
    { href: "/dashboard", label: "🏠 Inicio", permiso: "dashboard.view" },
  ] },
  { id: "tesoreria", label: "Tesorería", items: [
    { href: "/flujo", label: "💵 Flujo de Caja", permiso: "cxp.view" },
    { href: "/cxp", label: "📤 Cuentas por Pagar", permiso: "cxp.view" },
    { href: "/obligaciones", label: "🏦 Obligaciones", permiso: "cxp.view" },
    { href: "/impuestos", label: "🧾 Impuestos", permiso: "cxp.view" },
  ] },
  { id: "comercial", label: "Comercial", items: [
    { href: "/ventas", label: "💹 Ventas", permiso: "cxp.view" },
    { href: "/cartera", label: "📥 Cartera", permiso: "cartera.view" },
  ] },
  { id: "analisis", label: "Análisis", items: [
    { href: "/indicadores", label: "📈 Indicadores", permiso: "cxp.view" },
    { href: "/pyg", label: "📄 PyG", permiso: "cxp.view" },
  ] },
];

// El grupo Administración aparece si el usuario tiene CUALQUIER permiso de admin.
const PERMISOS_ADMIN: PermisoClave[] = ["usuario.manage", "rol.manage", "tercero.manage", "auditoria.view"];

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
    if (items.length) grupos.push({ id: g.id, label: g.label, items });
  }
  // Grupo Administración: visible con cualquier permiso de admin.
  for (const p of PERMISOS_ADMIN) {
    if (await puede(usuario, p)) {
      grupos.push({ id: "admin", label: "Administración", items: [{ href: "/admin", label: "⚙️ Administración" }] });
      break;
    }
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
