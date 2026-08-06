// ==========================================================
// Envío de correo. Dos transportes, en este orden:
//   1) API HTTP de Brevo (HTTPS) — recomendado en Railway, no depende de
//      puertos SMTP (que el hosting suele bloquear). Se usa si hay BREVO_API_KEY.
//   2) SMTP (nodemailer) — respaldo si no hay API key.
// Si no hay ninguna configuración, las notificaciones no se envían (no rompe la app).
// Los secretos viven solo en variables de entorno (BIO-SEC-003).
// ==========================================================
import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { env } from "@/lib/env";

export interface Adjunto {
  filename: string;
  content: Buffer;
  cid?: string; // solo aplica al transporte SMTP (imágenes en línea con src="cid:...")
}

export function correoConfigurado(): boolean {
  return Boolean(env.BREVO_API_KEY) || Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS);
}

/** Separa "Nombre <correo@dominio>" en { name, email }. */
function remitente(): { name?: string; email: string } {
  const raw = (env.SMTP_FROM ?? env.SMTP_USER ?? "").trim();
  const m = raw.match(/^(.*?)\s*<\s*(.+?)\s*>\s*$/);
  if (m && m[2]) return { name: m[1]?.trim() || undefined, email: m[2].trim() };
  return { email: raw };
}

// ---------- Transporte 1: API HTTP de Brevo ----------
async function enviarPorBrevoApi(to: string[], asunto: string, html: string, adjuntos?: Adjunto[]): Promise<void> {
  const de = remitente();
  const body: Record<string, unknown> = {
    sender: de.name ? { name: de.name, email: de.email } : { email: de.email },
    to: to.map((email) => ({ email })),
    subject: asunto,
    htmlContent: html,
  };
  if (adjuntos?.length) {
    body.attachment = adjuntos.map((a) => ({ name: a.filename, content: a.content.toString("base64") }));
  }
  const resp = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": env.BREVO_API_KEY as string,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const detalle = await resp.text().catch(() => "");
    throw new Error(`Brevo API respondió ${resp.status}: ${detalle.slice(0, 300)}`);
  }
}

// ---------- Transporte 2: SMTP (nodemailer) ----------
let transporter: Transporter | null = null;

function getTransport(): Transporter | null {
  if (!(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS)) return null;
  if (!transporter) {
    const port = env.SMTP_PORT ?? 587;
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
      // Fallar rápido si no se puede conectar (evita cuelgues indefinidos
      // cuando el puerto SMTP está bloqueado o lento).
      connectionTimeout: 12_000,
      greetingTimeout: 8_000,
      socketTimeout: 20_000,
    });
  }
  return transporter;
}

async function enviarPorSmtp(to: string[], asunto: string, html: string, adjuntos?: Adjunto[]): Promise<void> {
  const t = getTransport();
  if (!t) throw new Error("Correo no configurado (define BREVO_API_KEY o SMTP_HOST/USER/PASS).");
  await t.sendMail({
    from: env.SMTP_FROM ?? env.SMTP_USER,
    to: to.join(", "),
    subject: asunto,
    html,
    attachments: adjuntos,
  });
}

export async function enviarCorreo(
  to: string[],
  asunto: string,
  html: string,
  adjuntos?: Adjunto[],
): Promise<void> {
  if (env.BREVO_API_KEY) return enviarPorBrevoApi(to, asunto, html, adjuntos);
  return enviarPorSmtp(to, asunto, html, adjuntos);
}
