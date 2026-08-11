// Layout del módulo Flujo de Caja: sub-navegación. Cada página valida su permiso.
import { requireUsuario } from "@/server/auth-context";
import { puede } from "@/lib/rbac/authorize";
import { SubNav } from "../_components/SubNav";

const ITEMS = [
  { href: "/flujo", label: "Resumen" },
  { href: "/flujo/ingresos", label: "Ingresos" },
  { href: "/flujo/egresos", label: "Egresos" },
  { href: "/flujo/presupuesto", label: "Presupuesto vs Real" },
];

export default async function FlujoLayout({ children }: { children: React.ReactNode }) {
  const usuario = await requireUsuario();
  // La pestaña de importación solo se muestra a quien puede gestionar el flujo.
  const items = (await puede(usuario, "flujo.manage"))
    ? [...ITEMS, { href: "/flujo/importar", label: "⬆️ Importar SIESA" }]
    : ITEMS;
  return (
    <>
      <div className="page-head" style={{ marginBottom: 8 }}>
        <div>
          <div className="eyebrow">Tesorería</div>
          <h1>Flujo de Caja</h1>
        </div>
      </div>
      <SubNav items={items} />
      {children}
    </>
  );
}
