"use server";
// Registro de PQRS (quejas, reclamos y sugerencias) por mes. Es un dato que
// se lleva aparte: no sale de las evaluaciones de los asesores.
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUsuario } from "@/server/auth-context";
import { exigirPermiso } from "@/lib/rbac/authorize";
import { auditar } from "@/lib/audit/log";

export async function guardarPqrs(fd: FormData): Promise<void> {
  const u = await requireUsuario();
  await exigirPermiso(u, "asistencia.manage");

  const anio = Number(fd.get("anio"));
  const mes = Number(fd.get("mes"));
  if (!Number.isInteger(anio) || anio < 2000 || anio > 2100) return;
  if (!Number.isInteger(mes) || mes < 1 || mes > 12) return;

  const casos = Math.max(0, Math.trunc(Number(fd.get("casos") ?? 0) || 0));
  const observacion = String(fd.get("observacion") ?? "").trim().slice(0, 500);

  await prisma.pqrsMes.upsert({
    where: { anio_mes: { anio, mes } },
    update: { casos, observacion },
    create: { anio, mes, casos, observacion },
  });
  await auditar({ usuarioId: u.id, accion: "pqrs.guardar", entidad: "PqrsMes", entidadId: `${anio}-${mes}` });
  revalidatePath("/asistencia/pqrs");
  revalidatePath("/asistencia");
}
