"use server";
// Clasificación de proveedores/marcas: estado + motivo (editable).
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUsuario } from "@/server/auth-context";
import { exigirPermiso } from "@/lib/rbac/authorize";
import { auditar } from "@/lib/audit/log";

export async function guardarEstadoProveedor(fd: FormData): Promise<void> {
  const u = await requireUsuario();
  await exigirPermiso(u, "ventas.manage");
  const marca = String(fd.get("marca") ?? "").trim();
  const estado = String(fd.get("estado") ?? "").trim() || "ACTIVO";
  const motivo = String(fd.get("motivo") ?? "").trim();
  if (!marca) return;
  await prisma.proveedorEstado.upsert({
    where: { marca },
    update: { estado, motivo },
    create: { marca, estado, motivo },
  });
  await auditar({ usuarioId: u.id, accion: "ventas.proveedor.estado", entidad: "ProveedorEstado", entidadId: marca });
  revalidatePath("/ventas/proveedores");
}
