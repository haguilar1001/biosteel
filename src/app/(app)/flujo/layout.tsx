// Layout del módulo Flujo de Caja: sub-navegación. Cada página valida su permiso.
import { requireUsuario } from "@/server/auth-context";
import { SubNav } from "../_components/SubNav";

// La importación se hace desde "Cargar archivos" (menú Inicio), no aquí.
const ITEMS = [
  { href: "/flujo", label: "Resumen" },
  { href: "/flujo/ingresos", label: "Ingresos" },
  { href: "/flujo/presupuesto/ingresos", label: "Ppto vs Real Ingresos" },
  { href: "/flujo/egresos", label: "Egresos" },
  { href: "/flujo/presupuesto/egresos", label: "Ppto vs Real Egresos" },
];

export default async function FlujoLayout({ children }: { children: React.ReactNode }) {
  await requireUsuario();
  const items = ITEMS;
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
