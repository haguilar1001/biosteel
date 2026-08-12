// Módulo Ventas: sub-navegación. Cada página valida su permiso.
import { requireUsuario } from "@/server/auth-context";
import { puede } from "@/lib/rbac/authorize";
import { SubNav } from "../_components/SubNav";

const BASE = [
  { href: "/ventas", label: "Ventas x Mes" },
  { href: "/ventas/historico", label: "Históricas" },
  { href: "/ventas/consumos", label: "Consumos" },
  { href: "/ventas/clientes", label: "Por Cliente" },
  { href: "/ventas/compras", label: "Compras x Proveedor" },
];
const GESTION = [
  { href: "/ventas/importar", label: "Importar" },
  { href: "/ventas/exclusiones", label: "Exclusiones" },
  { href: "/ventas/parametros", label: "Parámetros" },
  { href: "/ventas/ajustes", label: "Ajustes" },
];

export default async function VentasLayout({ children }: { children: React.ReactNode }) {
  const usuario = await requireUsuario();
  const items = (await puede(usuario, "ventas.manage")) ? [...BASE, ...GESTION] : BASE;
  return (
    <>
      <div className="page-head" style={{ marginBottom: 8 }}>
        <div>
          <div className="eyebrow">Comercial</div>
          <h1>Ventas</h1>
        </div>
      </div>
      <SubNav items={items} />
      {children}
    </>
  );
}
