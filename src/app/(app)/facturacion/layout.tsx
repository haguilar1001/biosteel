// Módulo Facturación (S1ESA): sub-navegación. Cada página valida su permiso.
import { requireUsuario } from "@/server/auth-context";
import { puede } from "@/lib/rbac/authorize";
import { CARGAS } from "@/lib/negocio/cargas";
import { SubNav } from "../_components/SubNav";

const ITEMS = [
  { href: "/facturacion", label: "Pendientes" },
  { href: "/facturacion/usuarios", label: "Por Usuario" },
  { href: "/facturacion/anuladas", label: "Anuladas" },
  { href: "/facturacion/gastos", label: "Gastos" },
];

export default async function FacturacionLayout({ children }: { children: React.ReactNode }) {
  const usuario = await requireUsuario();
  // Botón de carga in-app: visible si tiene permiso sobre algún archivo.
  const puedeCargar = (await Promise.all(CARGAS.map((c) => puede(usuario, c.permiso)))).some(Boolean);

  return (
    <>
      <div className="page-head" style={{ marginBottom: 8 }}>
        <div>
          <div className="eyebrow">Comercial</div>
          <h1>Facturación</h1>
        </div>
        {puedeCargar && (
          <div className="toolbar">
            <a href="/cargar" className="btn primary" title="Cargar archivos">
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
