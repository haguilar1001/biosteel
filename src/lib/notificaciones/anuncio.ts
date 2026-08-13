// ==========================================================
// Correo de anuncio / bienvenida: explica a los destinatarios que, en
// adelante, recibirán un recordatorio por correo N días antes de cada
// vencimiento financiero. El logo se enlaza desde la URL pública de la app
// (<baseUrl>/BIOSTEEL.png), de modo que se ve tanto por SMTP como por la API
// HTTP de Brevo (sin depender de adjuntos CID). El baseUrl se calcula desde el
// dominio real de la petición (ver la Server Action), no de APP_URL.
// ==========================================================
import "server-only";
import { enviarCorreo } from "./mailer";

const AZUL = "#2A4F98";

function plantillaAnuncio(diasAntes: number, baseUrl: string): string {
  const logo = `${baseUrl.replace(/\/$/, "")}/BIOSTEEL.png`;
  return `
  <div style="background:#EEF2F8;padding:24px 0;font-family:Arial,Helvetica,sans-serif">
    <div style="max-width:600px;margin:auto;background:#fff;border:1px solid #E3E9F1;border-radius:14px;overflow:hidden">

      <div style="background:${AZUL};padding:22px 28px;text-align:center">
        <img src="${logo}" alt="BioSteel de Colombia S.A.S" width="180" style="max-width:180px;height:auto;display:inline-block" />
      </div>

      <div style="padding:28px;color:#1B2434;line-height:1.55">
        <h1 style="margin:0 0 6px;font-size:20px;color:${AZUL}">Recordatorios de vencimientos financieros</h1>
        <p style="margin:0 0 16px;color:#5B6B82;font-size:14px">APP Bio Steel · Tesorería</p>

        <p style="margin:0 0 14px;font-size:15px">Hola 👋</p>
        <p style="margin:0 0 14px;font-size:15px">
          A partir de ahora, este sistema les avisará automáticamente por correo
          <strong>${diasAntes} días antes</strong> de cada vencimiento de las obligaciones
          financieras de BioSteel (créditos, leasing y tarjetas), para que ningún pago se pase por alto.
        </p>
        <p style="margin:0 0 20px;font-size:15px">
          Cuando una cuota entre en la ventana de ${diasAntes} días, recibirán un correo como este:
        </p>

        <!-- Vista previa de un recordatorio real -->
        <div style="border:1px solid #E3E9F1;border-radius:12px;overflow:hidden;margin:0 0 22px">
          <div style="background:${AZUL};color:#fff;padding:12px 16px;font-size:15px;font-weight:700">🦴 BioSteel · Recordatorio de pago</div>
          <div style="padding:16px;color:#1B2434">
            <p style="margin:0 0 10px;font-size:14px">La siguiente obligación financiera vence en <strong>${diasAntes} días</strong>:</p>
            <table style="width:100%;border-collapse:collapse;font-size:13px">
              <tr><td style="padding:5px 0;color:#5B6B82">Entidad</td><td style="padding:5px 0;text-align:right;font-weight:700">Bancolombia — Crédito</td></tr>
              <tr><td style="padding:5px 0;color:#5B6B82">Fecha de pago</td><td style="padding:5px 0;text-align:right;font-weight:700">16 de agosto de 2026</td></tr>
              <tr><td style="padding:5px 0;color:#5B6B82">Cuota</td><td style="padding:5px 0;text-align:right;font-weight:700">$ 6.498.620</td></tr>
            </table>
            <p style="margin:10px 0 0;color:#9AA7B8;font-size:11px">(Ejemplo ilustrativo)</p>
          </div>
        </div>

        <p style="margin:0 0 6px;font-size:14px;color:#5B6B82">No hay que hacer nada: los recordatorios llegan solos.</p>
        <p style="margin:16px 0 0;color:#9AA7B8;font-size:12px">
          Mensaje automático de la APP Bio Steel · BioSteel de Colombia S.A.S. · Confidencial.
        </p>
      </div>
    </div>
  </div>`;
}

/** Envía el correo de anuncio a los destinatarios indicados. */
export async function enviarAnuncio(destinatarios: string[], diasAntes: number, baseUrl: string): Promise<void> {
  const asunto = "BioSteel · Empezaremos a enviar recordatorios de vencimientos financieros";
  await enviarCorreo(destinatarios, asunto, plantillaAnuncio(diasAntes, baseUrl));
}
