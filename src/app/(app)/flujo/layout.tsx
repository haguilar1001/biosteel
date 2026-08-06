// Layout del módulo Flujo de Caja: sub-navegación. Cada página valida su permiso.
import { requireUsuario } from "@/server/auth-context";
import { SubNav } from "../_components/SubNav";

const ITEMS = [
  { href: "/flujo", label: "Resumen" },
  { href: "/flujo/ingresos", label: "Ingresos" },
  { href: "/flujo/egresos", label: "Egresos" },
  { href: "/flujo/presupuesto", label: "Presupuesto vs Real" },
];

export default async function FlujoLayout({ children }: { children: React.ReactNode }) {
  await requireUsuario();
  return (
    <>
      <div className="page-head" style={{ marginBottom: 8 }}>
        <div>
          <div className="eyebrow">Tesorería</div>
          <h1>Flujo de Caja</h1>
        </div>
      </div>
      <SubNav items={ITEMS} />
      {children}
    </>
  );
}
