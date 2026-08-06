"use server";
// ==========================================================
// Server Action: registrar recaudo.
// Origen verificado por next.config (allowedOrigins · BIO-SEC-006).
// Permiso + alcance + validación Zod + transacción + auditoría.
// ==========================================================
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireUsuario } from "@/server/auth-context";
import { alcanceDe, exigirPermiso } from "@/lib/rbac/authorize";
import { recaudoSchema } from "@/lib/validation/tesoreria";
import { registrarRecaudo } from "@/lib/negocio/recaudo";

export interface RecaudoState {
  ok?: boolean;
  error?: string;
  recaudoId?: number;
}

function parseJson(v: FormDataEntryValue | null): unknown {
  if (typeof v !== "string" || v.trim() === "") return [];
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
}

export async function registrarRecaudoAction(
  _prev: RecaudoState,
  formData: FormData,
): Promise<RecaudoState> {
  const usuario = await requireUsuario();

  try {
    await exigirPermiso(usuario, "recaudo.create");
  } catch {
    return { error: "No tienes permiso para registrar recaudos." };
  }

  const cuentaRaw = formData.get("cuentaId");
  const parsed = recaudoSchema.safeParse({
    terceroId: formData.get("terceroId"),
    fecha: formData.get("fecha"),
    medio: formData.get("medio"),
    cuentaId: cuentaRaw && cuentaRaw !== "" ? cuentaRaw : undefined,
    valorRecibido: formData.get("valorRecibido"),
    referencia: formData.get("referencia") || undefined,
    aplicaciones: parseJson(formData.get("aplicaciones")),
    retenciones: parseJson(formData.get("retenciones")),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  // El alcance sobre cartera define qué facturas puede tocar (anti-IDOR).
  const alcance = await alcanceDe(usuario, "cartera.view");
  if (alcance === "ninguno") {
    return { error: "Tu rol no tiene alcance sobre la cartera." };
  }

  const h = await headers();
  const ip = (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? null)?.trim() ?? null;

  const res = await registrarRecaudo(usuario, alcance, parsed.data, ip);
  if (!res.ok) return { error: res.error };

  revalidatePath("/cartera");
  revalidatePath("/dashboard");
  revalidatePath("/recaudos");
  return { ok: true, recaudoId: res.recaudoId };
}
