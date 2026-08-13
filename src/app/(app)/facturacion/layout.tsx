// Módulo Facturación (S1ESA): sub-navegación. Cada página valida su permiso.
import { requireUsuario } from "@/server/auth-context";
import { puede } from "@/lib/rbac/authorize";
import { env } from "@/lib/env";
import { SubNav } from "../_components/SubNav";

const ITEMS = [
  { href: "/facturacion", label: "Pendientes" },
  { href: "/facturacion/usuarios", label: "Por Usuario" },
  { href: "/facturacion/anuladas", label: "Anuladas" },
  { href: "/facturacion/gastos", label: "Gastos" },
];

export default async function FacturacionLayout({ children }: { children: React.ReactNode }) {
  const usuario = await requireUsuario();
  // El botón de carga expone el token, así que solo se muestra a quien gestiona.
  const puedeCargar = (await puede(usuario, "ventas.manage")) && !!env.CARGA_TOKEN;
  const cargaUrl = `/cargar?token=${encodeURIComponent(env.CARGA_TOKEN ?? "")}`;

  return (
    <>
      <div className="page-head" style={{ marginBottom: 8 }}>
        <div>
          <div className="eyebrow">Comercial</div>
          <h1>Facturación</h1>
        </div>
        {puedeCargar && (
          <div className="toolbar">
            <a href={cargaUrl} target="_blank" rel="noopener noreferrer" className="btn primary" title="Abrir el formulario de carga de archivos de S1ESA">
              ⬆️ Cargar archivos
            </a>
          </div>
        )}
      </div>
      <SubNav items={ITEMS} />
      {children}
    </>
  );
}
