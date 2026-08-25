// Soporte imprimible del recibo a satisfacción (FOR-ALM-005).
import { notFound } from "next/navigation";
import { requirePermiso } from "@/server/auth-context";
import { obtenerRecepcion } from "@/lib/negocio/recepcion";
import PrintButton from "../../PrintButton";
import RecepcionDoc from "../RecepcionDoc";

export const metadata = { title: "Recibo a satisfacción · BioSteel" };

export default async function SoporteRecepcionPage({
  params, searchParams,
}: { params: Promise<{ id: string }>; searchParams: Promise<{ auto?: string }> }) {
  await requirePermiso("recepcion.view");
  const { id } = await params;
  const { auto } = await searchParams;
  const nId = Number(id);
  if (!Number.isInteger(nId) || nId <= 0) notFound();

  const r = await obtenerRecepcion(nId);
  if (!r) notFound();

  return (
    <>
      <PrintButton auto={auto === "1"} volverHref="/osteosintesis/recepcion" volverLabel="Volver a Recepción Técnica" />
      <RecepcionDoc r={r} />
    </>
  );
}
