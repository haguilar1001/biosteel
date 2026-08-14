// La vista de presupuesto se dividió en dos: Ppto vs Real Ingresos / Egresos.
// Esta ruta redirige a la de ingresos (compatibilidad con enlaces antiguos).
import { redirect } from "next/navigation";

export default function PresupuestoIndex() {
  redirect("/flujo/presupuesto/ingresos");
}
