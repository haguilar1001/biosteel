// Administración · Parametrización — preferencias visuales (fuente y tamaño).
// El ajuste se guarda por navegador (localStorage) y se aplica a TODAS las
// pantallas al instante, sobreescribiendo las variables CSS globales.
import { requirePermiso } from "@/server/auth-context";
import { Parametrizador } from "./Parametrizador";

export default async function ParametrizacionPage() {
  await requirePermiso("parametro.manage");
  return <Parametrizador />;
}
