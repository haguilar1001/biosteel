// Módulo Nómina: sub-navegación. Cada página valida su permiso.
import { requireUsuario } from "@/server/auth-context";
import { SubNav } from "../_components/SubNav";

const ITEMS = [
  { href: "/nomina", label: "Resumen" },
  { href: "/nomina/empleados", label: "Empleados" },
  { href: "/nomina/capacitaciones", label: "Capacitaciones" },
];

export default async function NominaLayout({ children }: { children: React.ReactNode }) {
  await requireUsuario();
  return (
    <>
      <div className="page-head" style={{ marginBottom: 8 }}>
        <div>
          <div className="eyebrow">Gestión Humana</div>
          <h1>Nómina</h1>
        </div>
      </div>
      <SubNav items={ITEMS} />
      {children}
    </>
  );
}
