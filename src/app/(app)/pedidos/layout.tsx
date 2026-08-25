// Módulo Pedidos: sub-navegación. Cada página valida su permiso.
import { requireUsuario } from "@/server/auth-context";
import { SubNav } from "../_components/SubNav";

const ITEMS = [
  { href: "/pedidos", label: "Informe" },
  { href: "/pedidos/sugerencias", label: "Sugerencias de Compra" },
  { href: "/pedidos/detalle", label: "Detalle" },
];

export default async function PedidosLayout({ children }: { children: React.ReactNode }) {
  await requireUsuario();
  return (
    <>
      <div className="page-head" style={{ marginBottom: 8 }}>
        <div>
          <div className="eyebrow">Abastecimiento</div>
          <h1>Pedidos</h1>
        </div>
      </div>
      <SubNav items={ITEMS} />
      {children}
    </>
  );
}
