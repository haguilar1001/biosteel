// ==========================================================
// Soporte imprimible de UNA novedad de inventario.
// Ruta: /soporte/inventario/novedad/[id]  (?auto=1 abre el diálogo de PDF)
// ==========================================================
import { notFound } from "next/navigation";
import { requirePermiso } from "@/server/auth-context";
import { soporteNovedad } from "@/lib/negocio/inventario";
import PrintButton from "../../../PrintButton";
import SoporteDoc from "../../SoporteDoc";

export const metadata = { title: "Soporte de novedad · BioSteel" };

export default async function SoporteNovedadPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ auto?: string }>;
}) {
  await requirePermiso("inventario.view");
  const { id } = await params;
  const { auto } = await searchParams;
  const nId = Number(id);
  if (!Number.isInteger(nId) || nId <= 0) notFound();

  const s = await soporteNovedad(nId);
  if (!s) notFound();

  return (
    <>
      <PrintButton auto={auto === "1"} />
      <SoporteDoc s={s} />
    </>
  );
}
