// Módulo Ventas: sub-navegación. Cada página valida su permiso.
import { requireUsuario } from "@/server/auth-context";
import { SubNav } from "../_components/SubNav";

const ITEMS = [
  { href: "/ventas", label: "Ventas x Mes" },
  { href: "/ventas/historico", label: "Históricas" },
  { href: "/ventas/clientes", label: "Por Cliente" },
  { href: "/ventas/compras", label: "Compras x Proveedor" },
];

export default async function VentasLayout({ children }: { children: React.ReactNode }) {
  await requireUsuario();
  return (
    <>
      <div className="page-head" style={{ marginBottom: 8 }}>
        <div>
          <div className="eyebrow">Comercial</div>
          <h1>Ventas</h1>
        </div>
      </div>
      <SubNav items={ITEMS} />
      {children}
    </>
  );
}
