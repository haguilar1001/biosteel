"use server";
// ==========================================================
// Server Action: registrar pago a proveedor.
// Origen verificado por next.config (allowedOrigins · BIO-SEC-006).
// ==========================================================
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireUsuario } from "@/server/auth-context";
import { exigirPermiso } from "@/lib/rbac/authorize";
import { pagoSchema } from "@/lib/validation/tesoreria";
import { registrarPago } from "@/lib/negocio/pago";

export interface PagoState {
  ok?: boolean;
  error?: string;
  pagoId?: number;
}

function parseJson(v: FormDataEntryValue | null): unknown {
  if (typeof v !== "string" || v.trim() === "") return [];
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
}

export async function registrarPagoAction(_prev: PagoState, formData: FormData): Promise<PagoState> {
  const usuario = await requireUsuario();

  try {
    await exigirPermiso(usuario, "pago.create");
  } catch {
    return { error: "No tienes permiso para registrar pagos." };
  }

  const cuentaRaw = formData.get("cuentaId");
  const parsed = pagoSchema.safeParse({
    proveedorId: formData.get("proveedorId"),
    fecha: formData.get("fecha"),
    cuentaId: cuentaRaw && cuentaRaw !== "" ? cuentaRaw : undefined,
    moneda: formData.get("moneda"),
    trmPago: formData.get("trmPago"),
    aplicaciones: parseJson(formData.get("aplicaciones")),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const h = await headers();
  const ip = (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? null)?.trim() ?? null;

  const res = await registrarPago(usuario, parsed.data, ip);
  if (!res.ok) return { error: res.error };

  revalidatePath("/cxp");
  revalidatePath("/dashboard");
  revalidatePath("/pagos");
  return { ok: true, pagoId: res.pagoId };
}
