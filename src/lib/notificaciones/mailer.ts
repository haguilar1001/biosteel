// ==========================================================
// Envío de correo (nodemailer/SMTP). Si no hay configuración SMTP,
// las notificaciones no se envían (no rompe la app).
// Los secretos SMTP viven solo en variables de entorno (BIO-SEC-003).
// ==========================================================
import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { env } from "@/lib/env";

export function correoConfigurado(): boolean {
  return Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS);
}

let transporter: Transporter | null = null;

function getTransport(): Transporter | null {
  if (!correoConfigurado()) return null;
  if (!transporter) {
    const port = env.SMTP_PORT ?? 587;
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
    });
  }
  return transporter;
}

export async function enviarCorreo(to: string[], asunto: string, html: string): Promise<void> {
  const t = getTransport();
  if (!t) throw new Error("Correo no configurado (faltan SMTP_HOST/USER/PASS).");
  await t.sendMail({
    from: env.SMTP_FROM ?? env.SMTP_USER,
    to: to.join(", "),
    subject: asunto,
    html,
  });
}
