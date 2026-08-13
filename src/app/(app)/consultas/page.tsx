// ==========================================================
// Asistente de consultas en lenguaje natural (IA local, sin API externa).
// Pregunta libre → el motor interpreta y responde con KPIs, ranking y tablas.
// ==========================================================
import { requirePermiso } from "@/server/auth-context";
import { preguntasEjemplo } from "@/lib/negocio/consultas/motor";
import { Chat } from "./Chat";

export const metadata = { title: "Asistente · BioSteel" };

export default async function ConsultasPage() {
  await requirePermiso("cxp.view");
  return (
    <>
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="card-body" style={{ paddingBottom: 12 }}>
          <div className="eyebrow" style={{ fontSize: 15 }}>🤖 Asistente · pregúntale a tus datos</div>
          <p className="flag" style={{ margin: "6px 0 0" }}>
            Escribe tu pregunta en lenguaje natural. Ejemplo: <em>&ldquo;Dame el top 5 de clientes del año&rdquo;</em> o
            <em> &ldquo;¿cuál es el mes que más se ha vendido en 2026?&rdquo;</em>. Los datos no salen de la app.
          </p>
        </div>
      </div>
      <Chat ejemplos={preguntasEjemplo()} />
    </>
  );
}
