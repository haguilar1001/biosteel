// ==========================================================
// Notificaciones: recordatorios de pago de obligaciones (correo N días
// antes). Configuración editable desde la app, próximos recordatorios,
// bitácora y correo de anuncio.
// ==========================================================
import { requirePermiso } from "@/server/auth-context";
import { puede } from "@/lib/rbac/authorize";
import { prisma } from "@/lib/db";
import { formatCOP, formatNumero, formatFecha, formatFechaHora } from "@/lib/format";
import { listarObligaciones, tipoLabel } from "@/lib/negocio/obligaciones";
import { obtenerConfig } from "@/lib/notificaciones/config";
import { correoConfigurado } from "@/lib/notificaciones/mailer";
import { EjecutarBtn } from "./EjecutarBtn";
import { AnuncioBtn } from "./AnuncioBtn";
import { ConfigForm } from "./ConfigForm";

export default async function NotificacionesPage() {
  const { usuario } = await requirePermiso("cxp.view");
  const puedeEditar = await puede(usuario, "parametro.manage");

  const cfg = await obtenerConfig();
  const diasAntes = cfg.diasAntes;
  const smtpOk = correoConfigurado();

  const obligaciones = await listarObligaciones();
  const proximos = obligaciones
    .filter((o) => o.proximaFecha && o.diasHasta != null && o.cuotaMensual)
    .sort((a, b) => a.proximaFecha!.getTime() - b.proximaFecha!.getTime());

  const historial = await prisma.notificacionEnviada.findMany({ orderBy: { enviadaEn: "desc" }, take: 20 });

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Tesorería</div>
          <h1>Notificaciones</h1>
          <p>Recordatorios de pago por correo: {diasAntes} días antes, 1 día antes y el día del vencimiento</p>
        </div>
        <div className="toolbar" style={{ gap: 8 }}>
          <AnuncioBtn />
          <EjecutarBtn />
        </div>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <div className="chart-head">Configuración</div>
        <div className="card-body">
          <p style={{ margin: 0 }}>
            <strong>Correo:</strong>{" "}
            {smtpOk
              ? <span className="tag t-ok">Configurado</span>
              : <span className="tag t-w1">Sin configurar — falta SMTP en variables de entorno</span>}
            {cfg.origen === "entorno" && (
              <span className="flag" style={{ marginLeft: 10 }}>Usando valores por defecto (aún no se ha guardado config)</span>
            )}
            {cfg.origen === "bd" && cfg.actualizadoEn && (
              <span className="flag" style={{ marginLeft: 10 }}>
                Últ. cambio {formatFechaHora(cfg.actualizadoEn)}{cfg.actualizadoPor ? ` · ${cfg.actualizadoPor}` : ""}
              </span>
            )}
          </p>

          <ConfigForm diasAntes={diasAntes} destinatariosRaw={cfg.destinatariosRaw} puedeEditar={puedeEditar} />

          {!smtpOk && (
            <p style={{ margin: "12px 0 0", color: "var(--muted)", fontSize: 13 }}>
              Para activar el envío en Railway, configura <code>BREVO_API_KEY</code> (API HTTP de Brevo, recomendada),
              <code>SMTP_FROM</code> (remitente verificado) y <code>CRON_SECRET</code>. Luego programa un cron diario que
              llame a <code>/api/notificaciones/run?secret=…</code>.
            </p>
          )}
        </div>
      </div>

      <div className="grid two">
        <div className="card">
          <div className="chart-head">Próximos recordatorios</div>
          <div className="tbl-wrap">
            <table>
              <thead><tr><th>Entidad</th><th>Pago</th><th className="r">Cuota</th><th>Recordatorio</th></tr></thead>
              <tbody>
                {proximos.length === 0 ? (
                  <tr><td colSpan={4} className="empty">Sin próximos pagos.</td></tr>
                ) : (
                  proximos.map((o) => {
                    const enVentana = (o.diasHasta ?? 99) <= diasAntes;
                    return (
                      <tr key={o.id}>
                        <td style={{ fontWeight: 600 }}><span style={{ textTransform: "uppercase" }}>{o.entidad}</span> <span className="flag">· {tipoLabel(o.tipo)}</span></td>
                        <td>{formatFecha(o.proximaFecha!)} <span className="flag">({o.diasHasta}d)</span></td>
                        <td className="r num">{o.cuotaMensual != null ? formatCOP(o.cuotaMensual) : "—"}</td>
                        <td>{enVentana ? <span className="tag t-w1">Se enviará</span> : <span className="flag">en {(o.diasHasta ?? 0) - diasAntes}d</span>}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="chart-head">Bitácora de envíos <span className="hact">últimos {formatNumero(historial.length)}</span></div>
          <div className="tbl-wrap">
            <table>
              <thead><tr><th>Enviado</th><th>Asunto</th><th>Estado</th></tr></thead>
              <tbody>
                {historial.length === 0 ? (
                  <tr><td colSpan={3} className="empty">Aún no se ha enviado ningún recordatorio.</td></tr>
                ) : (
                  historial.map((h) => (
                    <tr key={h.id}>
                      <td className="flag">{formatFechaHora(h.enviadaEn)}</td>
                      <td title={h.destinatarios}>{h.asunto}</td>
                      <td>{h.estado === "enviada" ? <span className="tag t-ok">Enviada</span> : <span className="tag t-bad">Error</span>}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
