"use server";
// Personalización del menú: nombre, orden, grupo, visibilidad.
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUsuario } from "@/server/auth-context";
import { exigirPermiso } from "@/lib/rbac/authorize";
import { auditar } from "@/lib/audit/log";

const numOrNull = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").trim();
  return s === "" ? null : (Number.isFinite(Number(s)) ? Number(s) : null);
};

export async function guardarGrupo(fd: FormData): Promise<void> {
  const u = await requireUsuario();
  await exigirPermiso(u, "parametro.manage");
  const clave = String(fd.get("clave") ?? "").trim();
  if (!clave) return;
  const label = String(fd.get("label") ?? "").trim() || null;
  const icon = String(fd.get("icon") ?? "").trim() || null;
  const orden = numOrNull(fd.get("orden"));
  const visible = fd.get("visible") === "on";
  await prisma.menuGrupoCfg.upsert({ where: { clave }, update: { label, icon, orden, visible }, create: { clave, label, icon, orden, visible } });
  await auditar({ usuarioId: u.id, accion: "menu.grupo", entidad: "MenuGrupoCfg", entidadId: clave });
  revalidatePath("/admin/menu");
}

export async function guardarItem(fd: FormData): Promise<void> {
  const u = await requireUsuario();
  await exigirPermiso(u, "parametro.manage");
  const href = String(fd.get("href") ?? "").trim();
  if (!href) return;
  const label = String(fd.get("label") ?? "").trim() || null;
  const grupoClave = String(fd.get("grupoClave") ?? "").trim() || null;
  const orden = numOrNull(fd.get("orden"));
  const visible = fd.get("visible") === "on";
  await prisma.menuItemCfg.upsert({ where: { href }, update: { label, grupoClave, orden, visible }, create: { href, label, grupoClave, orden, visible } });
  await auditar({ usuarioId: u.id, accion: "menu.item", entidad: "MenuItemCfg", entidadId: href });
  revalidatePath("/admin/menu");
}

export async function restablecerMenu(): Promise<void> {
  const u = await requireUsuario();
  await exigirPermiso(u, "parametro.manage");
  await prisma.$transaction([prisma.menuItemCfg.deleteMany({}), prisma.menuGrupoCfg.deleteMany({})]);
  await auditar({ usuarioId: u.id, accion: "menu.restablecer", entidad: "Menu" });
  revalidatePath("/admin/menu");
}
