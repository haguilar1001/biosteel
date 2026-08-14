// ==========================================================
// Carga de archivos IN-APP (autenticada). Muestra solo los datasets para los
// que el usuario tiene permiso (uno por archivo). Reemplaza el formulario
// público con token. Se llega desde el botón "Cargar archivos" del Inicio.
// ==========================================================
import { requireUsuario } from "@/server/auth-context";
import { puede } from "@/lib/rbac/authorize";
import { CARGAS } from "@/lib/negocio/cargas";
import { Uploader, type DatasetPermitido } from "./Uploader";

export const metadata = { title: "Cargar archivos · BioSteel" };

export default async function CargarPage() {
  const usuario = await requireUsuario();

  const flags = await Promise.all(CARGAS.map((c) => puede(usuario, c.permiso)));
  const permitidos: DatasetPermitido[] = CARGAS
    .filter((_, i) => flags[i])
    .map((c) => ({ clave: c.clave, titulo: c.titulo, archivoSugerido: c.archivoSugerido }));

  return (
    <>
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="card-body" style={{ paddingBottom: 12 }}>
          <div className="eyebrow" style={{ fontSize: 15 }}>⬆️ Cargar archivos</div>
          <p className="flag" style={{ margin: "6px 0 0" }}>
            Sube los archivos exportados en <strong>.xlsx</strong>. Cada archivo reemplaza o agrega sus datos según su tipo.
            Solo ves los archivos que tienes permitido cargar.
          </p>
        </div>
      </div>

      {permitidos.length === 0 ? (
        <div className="card"><div className="card-body"><div className="empty">No tienes permisos de carga asignados. Pídele al administrador que te habilite los archivos que debes subir.</div></div></div>
      ) : (
        <Uploader datasets={permitidos} />
      )}
    </>
  );
}
