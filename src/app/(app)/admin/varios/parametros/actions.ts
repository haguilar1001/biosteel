"use server";
// Alta / edición / baja de Parámetros de Notas Crédito (porcentajes y vigencias).
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireUsuario } from "@/server/auth-context";
import { exigirPermiso } from "@/lib/rbac/authorize";
import { auditar } from "@/lib/audit/log";

/** "YYYY-MM-DD" (input date) → Date UTC. */
function parseFecha(v: FormDataEntryValue | null): Date | null {
  const m = String(v ?? "").trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))) : null;
}

/** El usuario ingresa el porcentaje (25 = 25 %); se guarda como proporción 0.25. */
function parsePct(v: FormDataEntryValue | null): Prisma.Decimal | null {
  const n = Number(String(v ?? "").replace(",", "."));
  if (!Number.isFinite(n) || n < 0) return null;
  return new Prisma.Decimal(Math.round((n / 100) * 10000) / 10000);
}

export async function agregarParametro(fd: FormData): Promise<void> {
  const u = await requireUsuario();
  await exigirPermiso(u, "ventas.manage");
  const ips = String(fd.get("ips") ?? "").trim();
  const concepto = String(fd.get("concepto") ?? "").trim();
  const pct = parsePct(fd.get("pct"));
  const fechaInicio = parseFecha(fd.get("fechaInicio"));
  const fechaFin = parseFecha(fd.get("fechaFin"));
  if (!ips || !concepto || !pct || !fechaInicio || !fechaFin) return;
  await prisma.parametroNotaCredito.create({ data: { ips, concepto, pct, fechaInicio, fechaFin } });
  await auditar({ usuarioId: u.id, accion: "ventas.parametro.crear", entidad: "ParametroNotaCredito", entidadId: `${ips}/${concepto}` });
  revalidatePath("/admin/varios/parametros");
}

export async function editarParametro(fd: FormData): Promise<void> {
  const u = await requireUsuario();
  await exigirPermiso(u, "ventas.manage");
  const id = Number(fd.get("id"));
  const pct = parsePct(fd.get("pct"));
  const fechaInicio = parseFecha(fd.get("fechaInicio"));
  const fechaFin = parseFecha(fd.get("fechaFin"));
  if (!Number.isFinite(id) || !pct || !fechaInicio || !fechaFin) return;
  await prisma.parametroNotaCredito.update({ where: { id }, data: { pct, fechaInicio, fechaFin } });
  await auditar({ usuarioId: u.id, accion: "ventas.parametro.editar", entidad: "ParametroNotaCredito", entidadId: String(id) });
  revalidatePath("/admin/varios/parametros");
}

export async function quitarParametro(fd: FormData): Promise<void> {
  const u = await requireUsuario();
  await exigirPermiso(u, "ventas.manage");
  const id = Number(fd.get("id"));
  if (!Number.isFinite(id)) return;
  await prisma.parametroNotaCredito.delete({ where: { id } });
  await auditar({ usuarioId: u.id, accion: "ventas.parametro.quitar", entidad: "ParametroNotaCredito", entidadId: String(id) });
  revalidatePath("/admin/varios/parametros");
}
