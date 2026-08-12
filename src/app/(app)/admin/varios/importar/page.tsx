// Importar ventas desde el reporte SIESA (recalcula NC y reliquida por año).
import { requirePermiso } from "@/server/auth-context";
import { ImportadorForm } from "./ImportadorForm";

export default async function ImportarVentasPage() {
  await requirePermiso("ventas.manage");
  return <ImportadorForm />;
}
