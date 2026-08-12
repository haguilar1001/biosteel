// Módulo Nómina: sub-navegación. Cada página valida su permiso.
import { requireUsuario } from "@/server/auth-context";
import { SubNav } from "../_components/SubNav";

const ITEMS = [
  { href: "/nomina", label: "Resumen" },
  { href: "/nomina/empleados", label: "Empleados" },
];

export default async function NominaLayout({ children }: { children: React.ReactNode }) {
  await requireUsuario();
  return (
    <>
      <div className="page-head" style={{ marginBottom: 8 }}>
        <div>
          <div className="eyebrow">Nómina</div>
          <h1>Costo de Personal</h1>
        </div>
      </div>
      <SubNav items={ITEMS} />
      {children}
    </>
  );
}
