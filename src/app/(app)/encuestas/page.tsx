// ==========================================================
// Análisis · Encuestas de Satisfacción
// Informe consolidado (clientes institucionales + ortopedistas). El contenido
// es un informe HTML autónomo servido desde /public y embebido en un iframe.
// ==========================================================
import { requirePermiso } from "@/server/auth-context";
import { ReporteEmbed } from "./ReporteEmbed";

export default async function EncuestasPage() {
  await requirePermiso("cxp.view");
  return <ReporteEmbed src="/encuestas/reporte" title="Encuestas de Satisfacción" />;
}
