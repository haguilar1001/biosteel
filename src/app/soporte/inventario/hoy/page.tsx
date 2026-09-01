// ==========================================================
// Soportes de TODAS las novedades registradas hoy, una hoja por
// novedad (cada una salta de página al exportar a PDF).
// Ruta: /soporte/inventario/hoy  (?auto=1 abre el diálogo de PDF)
// ==========================================================
import { requirePermiso } from "@/server/auth-context";
import { soportesDeHoy } from "@/lib/negocio/inventario";
import { formatFechaSello } from "@/lib/format";
import PrintButton from "../../PrintButton";
import SoporteDoc from "../SoporteDoc";

export const metadata = { title: "Soportes del día · BioSteel" };

export default async function SoportesHoyPage({
  searchParams,
}: {
  searchParams: Promise<{ auto?: string }>;
}) {
  await requirePermiso("inventario.view");
  const { auto } = await searchParams;
  const soportes = await soportesDeHoy();

  return (
    <>
      <PrintButton auto={auto === "1" && soportes.length > 0} />
      {soportes.length === 0 ? (
        <div className="sop-vacio no-print">
          No hay novedades registradas hoy ({formatFechaSello(new Date())}).
        </div>
      ) : (
        soportes.map((s) => <SoporteDoc key={s.id} s={s} />)
      )}
    </>
  );
}
