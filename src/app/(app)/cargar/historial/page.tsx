// ==========================================================
// Historial de cargas: muestra las últimas cargas (manuales del formulario y la
// sincronización automática del flujo) con fecha/hora (COT), quién la subió,
// filas cargadas y estado. Pensada para compartir/mostrar al grupo.
// ==========================================================
import { requireUsuario } from "@/server/auth-context";
import { puede } from "@/lib/rbac/authorize";
import { formatNumero } from "@/lib/format";
import { CARGAS } from "@/lib/negocio/cargas";
import { listarHistorialCargas } from "@/lib/negocio/historial-cargas";

export const metadata = { title: "Historial de cargas · BioSteel" };
export const dynamic = "force-dynamic";

const fmtCOT = new Intl.DateTimeFormat("es-CO", {
  timeZone: "America/Bogota", day: "2-digit", month: "2-digit", year: "numeric",
  hour: "2-digit", minute: "2-digit", hour12: true,
});

export default async function HistorialCargasPage() {
  const usuario = await requireUsuario();
  const permitido = (await Promise.all(CARGAS.map((c) => puede(usuario, c.permiso)))).some(Boolean);
  if (!permitido) {
    return <div className="card"><div className="card-body"><div className="empty">No tienes permisos de carga.</div></div></div>;
  }

  const items = await listarHistorialCargas(40);

  return (
    <>
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="card-body" style={{ paddingBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <div>
            <div className="eyebrow" style={{ fontSize: 15 }}>🕑 Historial de cargas</div>
            <p className="flag" style={{ margin: "6px 0 0" }}>Últimas cargas de archivos y sincronizaciones. Horario Colombia (COT).</p>
          </div>
          <a href="/cargar" className="btn">⬆️ Cargar archivos</a>
        </div>
      </div>

      <div className="card">
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th>Archivo</th>
                <th className="r">Filas cargadas</th>
                <th>Subido por</th>
                <th>Fecha y hora</th>
                <th className="r">Estado</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan={5} className="empty">Aún no hay cargas registradas.</td></tr>
              ) : (
                items.map((it) => {
                  const titulos = it.datasets.map((d) => d.titulo).join(", ") || "—";
                  const archivo = it.datasets.find((d) => d.archivo)?.archivo;
                  const cargadas = it.datasets.reduce((s, d) => s + d.cargadas, 0);
                  return (
                    <tr key={it.id}>
                      <td style={{ fontWeight: 600 }}>
                        {titulos}
                        {archivo && <><br /><span className="flag">{archivo}</span></>}
                      </td>
                      <td className="r num" style={{ fontWeight: 700 }}>{it.ok ? formatNumero(cargadas) : "—"}</td>
                      <td>{it.automatico ? <span className="flag">🤖 Automático</span> : it.usuario}</td>
                      <td className="num flag">{fmtCOT.format(it.fecha)}</td>
                      <td className="r">
                        {it.ok
                          ? <span className="tag t-ok">✓ Cargado</span>
                          : <span className="tag t-bad" title={it.mensaje ?? undefined}>✗ Error</span>}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
