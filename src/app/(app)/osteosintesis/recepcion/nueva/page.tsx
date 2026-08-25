// Formulario de nueva Recepción Técnica (FOR-ALM-005).
import { requirePermiso } from "@/server/auth-context";
import { proveedoresSugeridos, siguienteConsecutivo, CRITERIOS_IMPORTACION, DOCS_IMPORTACION, tipoRecepcionLabel } from "@/lib/negocio/recepcion";
import type { TipoRecepcion } from "@prisma/client";
import RecepcionForm from "./RecepcionForm";

export const metadata = { title: "Nueva Recepción Técnica · BioSteel" };

export default async function NuevaRecepcionPage({
  searchParams,
}: { searchParams: Promise<{ tipo?: string }> }) {
  await requirePermiso("recepcion.manage");
  const sp = await searchParams;
  const tipo: TipoRecepcion = sp.tipo === "nacional" ? "nacional" : "importacion";
  const [proveedores, consecutivo] = await Promise.all([proveedoresSugeridos(), siguienteConsecutivo(tipo)]);

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Inventarios · Recepción Técnica</div>
          <h1>Nueva recepción · {tipoRecepcionLabel(tipo)}</h1>
          <p>Recibo a satisfacción de dispositivos médicos (FOR-ALM-005) · consecutivo {consecutivo}</p>
        </div>
        <div className="toolbar"><a href="/osteosintesis/recepcion" className="btn">← Volver</a></div>
      </div>
      <RecepcionForm
        tipo={tipo}
        consecutivo={consecutivo}
        proveedores={proveedores}
        criterios={CRITERIOS_IMPORTACION.map((c) => ({ nombre: c.nombre, especificacion: c.especificacion, opciones: c.opciones }))}
        docs={DOCS_IMPORTACION.map((d) => ({ campo: d.campo, label: d.label }))}
      />
    </>
  );
}
