// ==========================================================
// Autorización RBAC deny-by-default con alcance (BIO-SEC-001)
// - Todo permiso no otorgado explícitamente = "ninguno".
// - El alcance ("todos" | "propio") + la sede del usuario definen
//   qué filas puede ver (previene IDOR entre sedes/vendedores).
// ==========================================================
import "server-only";
import { cache } from "react";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { UsuarioConRol } from "@/lib/auth/session";
import type { Alcance, PermisoClave } from "./permissions";

/** Mapa {clave -> alcance} del rol, memoizado por petición. */
const permisosDeRol = cache(async (rolId: number): Promise<Map<string, Alcance>> => {
  const filas = await prisma.rolPermiso.findMany({
    where: { rolId },
    include: { permiso: { select: { clave: true } } },
  });
  return new Map(filas.map((f) => [f.permiso.clave, f.alcance as Alcance]));
});

/** Alcance de un usuario sobre un permiso (deny-by-default). */
export async function alcanceDe(usuario: UsuarioConRol, permiso: PermisoClave): Promise<Alcance> {
  const mapa = await permisosDeRol(usuario.rolId);
  return mapa.get(permiso) ?? "ninguno";
}

/** ¿El usuario puede ejecutar la acción? */
export async function puede(usuario: UsuarioConRol, permiso: PermisoClave): Promise<boolean> {
  return (await alcanceDe(usuario, permiso)) !== "ninguno";
}

/** Lanza si no tiene el permiso (usar en Server Actions / rutas). */
export async function exigirPermiso(usuario: UsuarioConRol, permiso: PermisoClave): Promise<Alcance> {
  const alcance = await alcanceDe(usuario, permiso);
  if (alcance === "ninguno") {
    throw new Error(`Acceso denegado: falta el permiso "${permiso}"`);
  }
  return alcance;
}

/**
 * Construye el filtro de cartera según el alcance del usuario.
 * - Sede: si el usuario está asignado a una sede, solo ve esa sede.
 * - "propio": además, solo las facturas de su vendedor.
 * Devolver este `where` en TODA consulta de facturas evita IDOR.
 */
export function filtroFacturas(usuario: UsuarioConRol, alcance: Alcance): Prisma.FacturaVentaWhereInput {
  const where: Prisma.FacturaVentaWhereInput = {};
  if (usuario.sedeId != null) where.sedeId = usuario.sedeId;
  if (alcance === "propio") where.vendedor = { usuarioId: usuario.id };
  return where;
}
