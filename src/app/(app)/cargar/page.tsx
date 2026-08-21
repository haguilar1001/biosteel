// ==========================================================
// Carga de archivos IN-APP (autenticada). Muestra solo los datasets para los
// que el usuario tiene permiso (uno por archivo). Reemplaza el formulario
// público con token. Se llega desde el botón "Cargar archivos" del Inicio.
// ==========================================================
import { requireUsuario } from "@/server/auth-context";
import { puede } from "@/lib/rbac/authorize";
import { CARGAS } from "@/lib/negocio/cargas";
import { ultimaCargaPorDataset } from "@/lib/negocio/historial-cargas";
import { formatFechaHora } from "@/lib/format";
import { Uploader, type DatasetPermitido } from "./Uploader";

export const metadata = { title: "Cargar archivos · BioSteel" };

export default async function CargarPage() {
  const usuario = await requireUsuario();

  const [flags, ultimas] = await Promise.all([
    Promise.all(CARGAS.map((c) => puede(usuario, c.permiso))),
    ultimaCargaPorDataset(),
  ]);

  // La fecha se formatea aquí (servidor) para que no dependa de la
  // configuración regional del navegador de cada usuario.
  const permitidos: DatasetPermitido[] = CARGAS
    .filter((_, i) => flags[i])
    .map((c) => {
      const u = ultimas.get(c.clave);
      return {
        clave: c.clave, titulo: c.titulo, grupo: c.grupo, archivoSugerido: c.archivoSugerido,
        ultima: u ? { fecha: formatFechaHora(u.fecha), usuario: u.usuario } : null,
      };
    });

  return (
    <>
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="card-body" style={{ paddingBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <div>
            <div className="eyebrow" style={{ fontSize: 15 }}>⬆️ Cargar archivos</div>
            <p className="flag" style={{ margin: "6px 0 0" }}>
              Sube los archivos exportados en <strong>.xlsx</strong>. Cada archivo reemplaza o agrega sus datos según su tipo.
              Solo ves los archivos que tienes permitido cargar.
            </p>
          </div>
          <a href="/cargar/historial" className="btn">🕑 Historial</a>
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
