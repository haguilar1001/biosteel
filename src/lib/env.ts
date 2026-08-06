// ==========================================================
// Validación de variables de entorno al arrancar (BIO-SEC-003)
// Falla rápido si falta un secreto crítico.
// ==========================================================
import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().url("DATABASE_URL debe ser una URL válida de PostgreSQL"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.string().url().default("http://localhost:3000"),

  // --- Correo (opcional; si falta, las notificaciones no se envían) ---
  // Método recomendado en Railway: API HTTP de Brevo (viaja por HTTPS, no
  // depende de puertos SMTP que el hosting suele bloquear). Si BREVO_API_KEY
  // está definida, se usa la API; si no, se cae a SMTP (nodemailer).
  BREVO_API_KEY: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(), // "BioSteel <no-reply@biosteeldecolombia.com>"

  // --- Notificaciones ---
  CRON_SECRET: z.string().optional(), // protege el endpoint /api/notificaciones/run
  // Destinatarios de los recordatorios de vencimientos financieros:
  //   Alejandro Aguilar        -> alejandro.aguilar@biosteeldecolombia.com
  //   María Angélica Parejo     -> cooradministrativa@biosteeldecolombia.com (coordinación administrativa)
  NOTIF_EMAILS: z.string().default("alejandro.aguilar@biosteeldecolombia.com,cooradministrativa@biosteeldecolombia.com"),
  NOTIF_DIAS_ANTES: z.coerce.number().default(5),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Variables de entorno inválidas:", parsed.error.flatten().fieldErrors);
  throw new Error("Configuración de entorno inválida. Revisa tu archivo .env");
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === "production";
