// ==========================================================
// Correo de bienvenida al software: se envía al crear un usuario (y bajo
// demanda a los existentes). Incluye nombre, usuario (correo), perfil y el
// enlace de acceso. No incluye contraseñas (se comparten aparte).
// ==========================================================
import "server-only";
import { env } from "@/lib/env";
import { enviarCorreo } from "./mailer";

const LINK = env.APP_URL && !/localhost/i.test(env.APP_URL) ? env.APP_URL : "https://biosteel.up.railway.app";

export interface DatosBienvenida { nombre: string; email: string; rol: string; }

/** Cuerpo HTML del correo de bienvenida (inline styles, apto para correo). */
export function plantillaBienvenida({ nombre, email, rol }: DatosBienvenida): string {
  const primer = nombre.trim().split(/\s+/)[0] || nombre;
  const fila = (label: string, valor: string) =>
    `<tr>
       <td style="padding:11px 14px;border-bottom:1px solid #EEF2F7;color:#5B6B82;font-size:13px;white-space:nowrap">${label}</td>
       <td style="padding:11px 14px;border-bottom:1px solid #EEF2F7;text-align:right;font-weight:700;color:#1B2434;font-size:14px">${valor}</td>
     </tr>`;
  return `
  <div style="background:#EFF3F8;padding:24px 12px">
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:auto;background:#FFFFFF;border:1px solid #E3E9F1;border-radius:14px;overflow:hidden">
      <!-- Encabezado -->
      <div style="background:linear-gradient(135deg,#2A4F98,#1E3A70);padding:30px 24px;text-align:center;color:#ffffff">
        <div style="font-size:40px;line-height:1">🦴</div>
        <div style="font-size:22px;font-weight:800;margin-top:8px;letter-spacing:.2px">¡Te damos la bienvenida!</div>
        <div style="font-size:13px;opacity:.85;margin-top:4px;text-transform:uppercase;letter-spacing:1.5px">APP Bio Steel</div>
      </div>

      <!-- Cuerpo -->
      <div style="padding:26px 24px;color:#1B2434">
        <p style="margin:0 0 6px;font-size:16px">Hola <strong>${primer}</strong>,</p>
        <p style="margin:0 0 20px;font-size:14.5px;line-height:1.55;color:#3a4657">
          Tu acceso a la <strong>APP Bio Steel</strong> de BioSteel de Colombia S.A.S. ya está activo.
          Estos son tus datos de ingreso:
        </p>

        <!-- Datos -->
        <table style="width:100%;border-collapse:collapse;border:1px solid #EEF2F7;border-radius:10px;overflow:hidden;margin-bottom:24px">
          ${fila("👤 Nombre", nombre)}
          ${fila("✉️ Usuario (correo)", email)}
          ${fila("🏷️ Perfil", rol)}
        </table>

        <!-- Botón -->
        <div style="text-align:center;margin-bottom:22px">
          <a href="${LINK}" style="display:inline-block;background:#2A4F98;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:14px 34px;border-radius:10px">
            Ingresar al sistema →
          </a>
        </div>

        <p style="margin:0 0 4px;font-size:13px;color:#5B6B82;line-height:1.55">
          Ingresa con tu <strong>correo</strong> y la <strong>contraseña</strong> que te compartió el administrador.
          Por seguridad, cámbiala en tu primer ingreso desde <em>Cambiar contraseña</em>.
        </p>
      </div>

      <!-- Pie -->
      <div style="background:#F7F9FC;padding:14px 24px;border-top:1px solid #EEF2F7">
        <p style="margin:0;color:#8794a8;font-size:11.5px;line-height:1.5">
          Enlace de acceso: <a href="${LINK}" style="color:#2A4F98">${LINK}</a><br>
          Mensaje automático · BioSteel de Colombia S.A.S. Si no esperabas este correo, ignóralo.
        </p>
      </div>
    </div>
  </div>`;
}

/** Envía el correo de bienvenida a un usuario (automático al crearlo). */
export async function enviarBienvenida(d: DatosBienvenida): Promise<void> {
  await enviarCorreo([d.email], "🦴 Bienvenido a la APP Bio Steel · tu acceso está listo", plantillaBienvenida(d));
}
