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
import { Nav, type ItemNav } from "./_components/Nav";

const MODULOS: { href: string; label: string; permiso: PermisoClave }[] = [
  { href: "/dashboard", label: "Inicio", permiso: "dashboard.view" },
  { href: "/cartera", label: "Cartera", permiso: "cartera.view" },
  { href: "/recaudos", label: "Recaudos", permiso: "recaudo.create" },
  { href: "/cxp", label: "Cuentas por Pagar", permiso: "cxp.view" },
  { href: "/pagos", label: "Pagos", permiso: "pago.create" },
  { href: "/terceros", label: "Terceros", permiso: "tercero.manage" },
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

  const items: ItemNav[] = [];
  for (const m of MODULOS) {
    if (await puede(usuario, m.permiso)) items.push({ href: m.href, label: m.label });
  }

  const sedeLabel = usuario.sedeId == null ? "Todas las sedes" : `Sede #${usuario.sedeId}`;

  return (
    <>
      <header className="appbar">
        <div className="logo">
          🦴 <div>BioSteel<small>DE COLOMBIA S.A.S</small></div>
        </div>
        <div className="sep" />
        <div className="ctx">
          <span className="chip-ctx">🏢 {sedeLabel}</span>
          <span className="chip-ctx" title={usuario.rol.nombre}>{usuario.rol.nombre}</span>
          <div className="avatar" title={usuario.nombre}>{iniciales(usuario.nombre)}</div>
          <form action={logoutAction} style={{ margin: 0 }}>
            <button type="submit" className="logout">Salir</button>
          </form>
        </div>
      </header>

      <Nav items={items} />

      <main className="wrap">{children}</main>
    </>
  );
}
