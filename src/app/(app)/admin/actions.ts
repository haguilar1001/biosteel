"use server";
// ==========================================================
// Server Actions de Administración (usuario.manage / rol.manage).
// Guardrail transversal: el sistema NUNCA queda sin un usuario activo
// que pueda gestionar usuarios Y roles (evita auto-bloqueo · BIO-SEC-001).
// ==========================================================
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import type { AlcancePermiso } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireUsuario } from "@/server/auth-context";
import { exigirPermiso } from "@/lib/rbac/authorize";
import { hashPassword } from "@/lib/auth/password";
import { auditar } from "@/lib/audit/log";
import { crearUsuarioSchema, crearRolSchema } from "@/lib/validation/admin";

export interface AdminState {
  ok?: boolean;
  error?: string;
  msg?: string;
}

const CLAVES_GESTION = ["usuario.manage", "rol.manage"] as const;

async function ipActual(): Promise<string | null> {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? null)?.trim() ?? null;
}

/** IDs de roles que hoy tienen gestión TOTAL de usuarios y roles. */
async function rolesConGestionTotal(): Promise<Set<number>> {
  const filas = await prisma.rolPermiso.findMany({
    where: { alcance: "todos", permiso: { clave: { in: [...CLAVES_GESTION] } } },
    select: { rolId: true, permiso: { select: { clave: true } } },
  });
  const porRol = new Map<number, Set<string>>();
  for (const f of filas) {
    const s = porRol.get(f.rolId) ?? new Set<string>();
    s.add(f.permiso.clave);
    porRol.set(f.rolId, s);
  }
  const ok = new Set<number>();
  for (const [rolId, s] of porRol) {
    if (CLAVES_GESTION.every((c) => s.has(c))) ok.add(rolId);
  }
  return ok;
}

// ---------------------- Crear usuario ----------------------
export async function crearUsuarioAction(_prev: AdminState, fd: FormData): Promise<AdminState> {
  const actor = await requireUsuario();
  try { await exigirPermiso(actor, "usuario.manage"); } catch { return { error: "No tienes permiso para gestionar usuarios." }; }

  const parsed = crearUsuarioSchema.safeParse({
    nombre: fd.get("nombre"), email: fd.get("email"), clave: fd.get("clave"),
    rolId: fd.get("rolId"), sedeId: fd.get("sedeId"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  const { nombre, email, clave, rolId, sedeId } = parsed.data;

  if (await prisma.usuario.findUnique({ where: { email } })) return { error: "Ya existe un usuario con ese correo." };
  const rol = await prisma.rol.findUnique({ where: { id: rolId } });
  if (!rol) return { error: "Rol inválido." };
  if (sedeId != null && !(await prisma.sede.findUnique({ where: { id: sedeId } }))) return { error: "Sede inválida." };

  const passwordHash = await hashPassword(clave);
  const u = await prisma.usuario.create({
    data: { nombre, email, passwordHash, rolId, sedeId: sedeId ?? null, activo: true },
  });
  await auditar({ usuarioId: actor.id, accion: "usuario.crear", entidad: "Usuario", entidadId: u.id, valorNuevo: { nombre, email, rol: rol.nombre }, ip: await ipActual() });
  revalidatePath("/admin/usuarios");
  return { ok: true, msg: `Usuario "${nombre}" creado con perfil ${rol.nombre}.` };
}

// ---------------- Cambiar el rol de un usuario (inline) ----------------
export async function cambiarRolUsuarioAction(_prev: AdminState, fd: FormData): Promise<AdminState> {
  const actor = await requireUsuario();
  try { await exigirPermiso(actor, "usuario.manage"); } catch { return { error: "No tienes permiso para gestionar usuarios." }; }

  const userId = Number(fd.get("userId"));
  const rolId = Number(fd.get("rolId"));
  if (!Number.isInteger(userId) || !Number.isInteger(rolId)) return { error: "Datos inválidos." };
  if (userId === actor.id) return { error: "No puedes cambiar tu propio perfil (evita bloquearte)." };

  const [target, rol] = await Promise.all([
    prisma.usuario.findUnique({ where: { id: userId }, include: { rol: true } }),
    prisma.rol.findUnique({ where: { id: rolId } }),
  ]);
  if (!target || !rol) return { error: "Usuario o perfil inválido." };
  if (target.rolId === rolId) return { ok: true, msg: "Sin cambios." };

  // Guardrail: que quede alguien activo con gestión total tras el cambio.
  const gestion = await rolesConGestionTotal();
  const activos = await prisma.usuario.findMany({ where: { activo: true }, select: { id: true, rolId: true } });
  const quedan = activos.filter((u) => gestion.has(u.id === userId ? rolId : u.rolId)).length;
  if (quedan < 1) return { error: "Debe quedar al menos un usuario activo que gestione usuarios y roles." };

  await prisma.usuario.update({ where: { id: userId }, data: { rolId } });
  await auditar({ usuarioId: actor.id, accion: "usuario.cambiarRol", entidad: "Usuario", entidadId: userId, valorAnterior: { rol: target.rol.nombre }, valorNuevo: { rol: rol.nombre }, ip: await ipActual() });
  revalidatePath("/admin/usuarios");
  return { ok: true, msg: `Perfil de ${target.nombre}: ${target.rol.nombre} → ${rol.nombre}.` };
}

// ---------------------- Crear perfil / rol ----------------------
export async function crearRolAction(_prev: AdminState, fd: FormData): Promise<AdminState> {
  const actor = await requireUsuario();
  try { await exigirPermiso(actor, "rol.manage"); } catch { return { error: "No tienes permiso para gestionar roles." }; }

  const parsed = crearRolSchema.safeParse({ nombre: fd.get("nombre") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  const { nombre } = parsed.data;

  if (await prisma.rol.findUnique({ where: { nombre } })) return { error: "Ya existe un perfil con ese nombre." };
  const rol = await prisma.rol.create({ data: { nombre, sistema: false } });
  await auditar({ usuarioId: actor.id, accion: "rol.crear", entidad: "Rol", entidadId: rol.id, valorNuevo: { nombre }, ip: await ipActual() });
  revalidatePath("/admin/roles");
  revalidatePath("/admin/usuarios");
  return { ok: true, msg: `Perfil "${nombre}" creado. Configura sus permisos en la matriz y guarda.` };
}

// ---------------- Guardar la matriz de permisos ----------------
interface CambioMatriz { rolId: number; clave: string; alcance: string }

export async function guardarMatrizAction(_prev: AdminState, fd: FormData): Promise<AdminState> {
  const actor = await requireUsuario();
  try { await exigirPermiso(actor, "rol.manage"); } catch { return { error: "No tienes permiso para gestionar roles." }; }

  let cambios: CambioMatriz[];
  try { cambios = JSON.parse(String(fd.get("cambios") ?? "[]")); } catch { return { error: "Datos inválidos." }; }
  if (!Array.isArray(cambios) || cambios.length === 0) return { error: "No hay cambios para guardar." };

  const validos: AlcancePermiso[] = ["todos", "propio", "ninguno"];
  const permisos = await prisma.permiso.findMany({ select: { id: true, clave: true } });
  const idPorClave = new Map(permisos.map((p) => [p.clave, p.id]));
  for (const c of cambios) {
    if (!Number.isInteger(c.rolId) || !idPorClave.has(c.clave) || !validos.includes(c.alcance as AlcancePermiso)) {
      return { error: "Cambio inválido." };
    }
  }

  // Simular resultado para el guardrail (actual + cambios).
  const actuales = await prisma.rolPermiso.findMany({ include: { permiso: { select: { clave: true } } } });
  const resultante = new Map<string, string>();
  for (const rp of actuales) resultante.set(`${rp.rolId}|${rp.permiso.clave}`, rp.alcance);
  for (const c of cambios) resultante.set(`${c.rolId}|${c.clave}`, c.alcance);

  const rolesIds = new Set<number>([...actuales.map((a) => a.rolId), ...cambios.map((c) => c.rolId)]);
  const gestion = new Set<number>();
  for (const rid of rolesIds) {
    if (CLAVES_GESTION.every((c) => resultante.get(`${rid}|${c}`) === "todos")) gestion.add(rid);
  }
  const admins = await prisma.usuario.count({ where: { activo: true, rolId: { in: [...gestion] } } });
  if (admins < 1) {
    return { error: "El cambio dejaría al sistema sin ningún usuario que gestione usuarios y roles. Ajústalo antes de guardar." };
  }

  for (const c of cambios) {
    const permisoId = idPorClave.get(c.clave)!;
    await prisma.rolPermiso.upsert({
      where: { rolId_permisoId: { rolId: c.rolId, permisoId } },
      update: { alcance: c.alcance as AlcancePermiso },
      create: { rolId: c.rolId, permisoId, alcance: c.alcance as AlcancePermiso },
    });
  }
  await auditar({ usuarioId: actor.id, accion: "rol.matriz.guardar", entidad: "RolPermiso", valorNuevo: { cambios: cambios.length }, ip: await ipActual() });
  revalidatePath("/admin/roles");
  revalidatePath("/admin/usuarios");
  return { ok: true, msg: `${cambios.length} cambio(s) guardado(s).` };
}
