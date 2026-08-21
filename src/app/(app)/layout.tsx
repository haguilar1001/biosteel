// ==========================================================
// Shell de la aplicación autenticada.
// - Exige sesión (requireUsuario redirige a /login si no hay).
// - La navegación se filtra por permisos (deny-by-default): cada
//   módulo solo aparece si el rol tiene el permiso correspondiente.
//
// La barra azul lleva a la izquierda la identidad (logo + quién eres), en el
// centro los grupos del menú y a la derecha solo dos iconos: configuración y
// salir. Antes había cinco controles sueltos a la derecha y el menú se partía
// en dos líneas.
// ==========================================================
import { requireUsuario } from "@/server/auth-context";
import { puede } from "@/lib/rbac/authorize";
import { logoutAction } from "../login/actions";
import { GruposBar } from "./_components/GroupNav";
import { ConfigMenu } from "./_components/ConfigMenu";
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
  const verNotificaciones = await puede(usuario, "cxp.view");

  return (
    <>
      <header className="appbar">
        <div className="identidad">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/BIOSTEEL.png" alt="BioSteel de Colombia S.A.S" className="logo-img" />
          <div className="quien">
            <span className="avatar-mini" aria-hidden>{iniciales(usuario.nombre)}</span>
            <span className="quien-txt">
              <span className="quien-nombre">{usuario.nombre}</span>
              <span className="quien-rol">{usuario.rol.nombre}</span>
            </span>
          </div>
        </div>

        <GruposBar grupos={grupos} />
        <div className="sep" />

        <div className="ctx">
          <ConfigMenu verNotificaciones={verNotificaciones} />
          <form action={logoutAction} style={{ margin: 0 }}>
            {/* Emoji en vez del símbolo ⏻ (U+23FB): ese no lo pinta bien
                Windows en todas las fuentes y salía como cuadro vacío. */}
            <button type="submit" className="icon-btn" title="Salir" aria-label="Salir">🚪</button>
          </form>
        </div>
      </header>

      <main className="wrap">{children}</main>
      <EnhanceTablas />
    </>
  );
}
