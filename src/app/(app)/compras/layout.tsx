// Módulo Compras: sub-navegación. Cada página valida su permiso.
import { requireUsuario } from "@/server/auth-context";
import { SubNav } from "../_components/SubNav";

const ITEMS = [
  { href: "/compras", label: "Informe" },
  { href: "/compras/ordenes", label: "Órdenes de Compra" },
  { href: "/compras/pendientes", label: "Pendientes por Despacho" },
  { href: "/compras/facturado", label: "Facturado Proveedor" },
];

export default async function ComprasLayout({ children }: { children: React.ReactNode }) {
  await requireUsuario();
  return (
    <>
      <div className="page-head" style={{ marginBottom: 8 }}>
        <div>
          <div className="eyebrow">Abastecimiento</div>
          <h1>Compras</h1>
        </div>
      </div>
      <SubNav items={ITEMS} />
      {children}
    </>
  );
}
