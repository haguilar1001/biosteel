// ==========================================================
// Configuración editable de los recordatorios (días de anticipación
// y destinatarios). Se guarda en BD (fila única id=1); si aún no existe,
// se usan los valores de entorno (NOTIF_DIAS_ANTES / NOTIF_EMAILS) como
// respaldo, de modo que nada se rompe antes de guardar por primera vez.
// ==========================================================
import "server-only";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";

const CONFIG_ID = 1;

export interface ConfigNotif {
  diasAntes: number;
  destinatarios: string[]; // ya separados y limpios
  destinatariosRaw: string; // tal cual, separados por coma
  actualizadoEn: Date | null;
  actualizadoPor: string | null;
  origen: "bd" | "entorno"; // de dónde salió la config vigente
}

function separar(raw: string): string[] {
  return raw
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function normalizarDestinatarios(raw: string): string {
  return separar(raw).join(",");
}

/** Config vigente: la fila de BD si existe, si no los valores de entorno. */
export async function obtenerConfig(): Promise<ConfigNotif> {
  const row = await prisma.configNotificaciones.findUnique({ where: { id: CONFIG_ID } });
  const raw = row?.destinatarios ?? env.NOTIF_EMAILS;
  const diasAntes = row?.diasAntes ?? env.NOTIF_DIAS_ANTES;
  return {
    diasAntes,
    destinatariosRaw: raw,
    destinatarios: separar(raw),
    actualizadoEn: row?.actualizadoEn ?? null,
    actualizadoPor: row?.actualizadoPor ?? null,
    origen: row ? "bd" : "entorno",
  };
}

/** Crea o actualiza la fila única de configuración. */
export async function guardarConfig(
  input: { diasAntes: number; destinatariosRaw: string },
  actualizadoPor?: string,
): Promise<void> {
  const destinatarios = normalizarDestinatarios(input.destinatariosRaw);
  await prisma.configNotificaciones.upsert({
    where: { id: CONFIG_ID },
    update: { diasAntes: input.diasAntes, destinatarios, actualizadoPor },
    create: { id: CONFIG_ID, diasAntes: input.diasAntes, destinatarios, actualizadoPor },
  });
}
