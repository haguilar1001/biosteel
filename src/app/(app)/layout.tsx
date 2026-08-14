// ==========================================================
// Shell de la aplicación autenticada.
// - Exige sesión (requireUsuario redirige a /login si no hay).
// - La navegación se filtra por permisos (deny-by-default): cada
//   módulo solo aparece si el rol tiene el permiso correspondiente.
// ==========================================================
import { requireUsuario } from "@/server/auth-context";
import { puede } from "@/lib/rbac/authorize";
import { logoutAction } from "../login/actions";
import { GruposBar, SubMenu } from "./_components/GroupNav";
import { MontosToggle } from "./_components/MontosToggle";
import { EnhanceTablas } from "./_components/EnhanceTablas";
import { construirMenu } from "./_menu";

function iniciales(nombre: string): string {
  return nombre
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const usuario = await requireUsuario();

  // Menú efectivo: catálogo del código + personalización de BD + permisos.
  const grupos = await construirMenu(usuario);

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
          <MontosToggle />
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
      <EnhanceTablas />
    </>
  );
}
