"use server";
// Alta/baja de Ajustes manuales de venta neta (para cuadrar con Power BI).
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireUsuario } from "@/server/auth-context";
import { exigirPermiso } from "@/lib/rbac/authorize";
import { auditar } from "@/lib/audit/log";

export async function agregarAjuste(fd: FormData): Promise<void> {
  const u = await requireUsuario();
  await exigirPermiso(u, "ventas.manage");
  const anio = Number(fd.get("anio"));
  const mes = Number(fd.get("mes"));
  const concepto = String(fd.get("concepto") ?? "").trim() || "AJUSTE";
  const valor = Number(String(fd.get("valor") ?? "").replace(/\./g, "").replace(",", ".").replace(/[^0-9.\-]/g, ""));
  if (!Number.isFinite(anio) || !Number.isInteger(mes) || mes < 1 || mes > 12 || !Number.isFinite(valor) || valor === 0) return;
  await prisma.ajusteVenta.create({ data: { anio, mes, concepto, valor: new Prisma.Decimal(valor) } });
  await auditar({ usuarioId: u.id, accion: "ventas.ajuste.crear", entidad: "AjusteVenta", entidadId: `${anio}-${mes}` });
  revalidatePath("/admin/varios/ajustes");
}

export async function quitarAjuste(fd: FormData): Promise<void> {
  const u = await requireUsuario();
  await exigirPermiso(u, "ventas.manage");
  const id = Number(fd.get("id"));
  if (!Number.isFinite(id)) return;
  await prisma.ajusteVenta.delete({ where: { id } });
  await auditar({ usuarioId: u.id, accion: "ventas.ajuste.quitar", entidad: "AjusteVenta", entidadId: String(id) });
  revalidatePath("/admin/varios/ajustes");
}
