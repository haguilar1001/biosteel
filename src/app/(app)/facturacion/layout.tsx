// Módulo Facturación (S1ESA): sub-navegación. Cada página valida su permiso.
import { requireUsuario } from "@/server/auth-context";
import { SubNav } from "../_components/SubNav";

const ITEMS = [
  { href: "/facturacion", label: "Pendientes" },
  { href: "/facturacion/usuarios", label: "Por Usuario" },
  { href: "/facturacion/anuladas", label: "Anuladas" },
  { href: "/facturacion/gastos", label: "Gastos" },
];

export default async function FacturacionLayout({ children }: { children: React.ReactNode }) {
  await requireUsuario();
  return (
    <>
      <div className="page-head" style={{ marginBottom: 8 }}>
        <div>
          <div className="eyebrow">Comercial</div>
          <h1>Facturación</h1>
        </div>
      </div>
      <SubNav items={ITEMS} />
      {children}
    </>
  );
}
