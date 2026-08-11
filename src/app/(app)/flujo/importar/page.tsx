// Importar movimientos desde los reportes de SIESA (OCC/NGC/NBA/PEL/RDC).
import { requirePermiso } from "@/server/auth-context";
import ImportadorForm from "./ImportadorForm";

export const metadata = { title: "Importar SIESA · Flujo de Caja" };

export default async function ImportarPage() {
  await requirePermiso("flujo.manage");
  return <ImportadorForm />;
}
