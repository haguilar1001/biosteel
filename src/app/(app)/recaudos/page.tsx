// ==========================================================
// Registrar Recaudo (Tesorería)
// Carga clientes, conceptos de retención, cuentas y —si hay cliente
// seleccionado— sus facturas abiertas DENTRO del alcance (anti-IDOR).
// ==========================================================
import { requirePermiso } from "@/server/auth-context";
import { prisma } from "@/lib/db";
import { alcanceDe, filtroFacturas } from "@/lib/rbac/authorize";
import { RecaudoForm } from "./RecaudoForm";

export default async function RecaudosPage({
  searchParams,
}: {
  searchParams: Promise<{ clienteId?: string }>;
}) {
  const { usuario } = await requirePermiso("recaudo.create");
  const { clienteId: clienteIdRaw } = await searchParams;
  const clienteId = clienteIdRaw && /^\d+$/.test(clienteIdRaw) ? Number(clienteIdRaw) : null;

  const alcanceCartera = await alcanceDe(usuario, "cartera.view");

  const [clientes, conceptos, cuentas] = await Promise.all([
    prisma.tercero.findMany({
      where: { esCliente: true },
      select: { id: true, nombre: true },
      orderBy: { nombre: "asc" },
    }),
    prisma.conceptoRetencion.findMany({
      where: { activo: true },
      select: { id: true, nombre: true, porcentaje: true },
      orderBy: { nombre: "asc" },
    }),
    prisma.cuentaBancaria.findMany({
      where: { activo: true },
      select: { id: true, banco: true, numero: true },
      orderBy: { banco: "asc" },
    }),
  ]);

  // Facturas abiertas del cliente seleccionado, respetando el alcance.
  const facturas =
    clienteId != null && alcanceCartera !== "ninguno"
      ? await prisma.facturaVenta.findMany({
          where: {
            terceroId: clienteId,
            estado: { not: "cancelada" },
            saldo: { gt: 0 },
            ...filtroFacturas(usuario, alcanceCartera),
          },
          select: { id: true, numero: true, saldo: true },
          orderBy: { fechaVencimiento: "asc" },
        })
      : [];

  const hoy = new Date().toISOString().slice(0, 10);

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Tesorería</div>
          <h1>Registrar Recaudo</h1>
          <p>Un recaudo puede aplicarse a varias facturas, con retenciones y abonos parciales</p>
        </div>
      </div>

      <RecaudoForm
        clientes={clientes}
        clienteId={clienteId}
        facturas={facturas.map((f) => ({ id: f.id, numero: f.numero, saldo: f.saldo.toNumber() }))}
        conceptos={conceptos.map((c) => ({ id: c.id, nombre: c.nombre, porcentaje: c.porcentaje.toNumber() }))}
        cuentas={cuentas.map((c) => ({ id: c.id, etiqueta: `${c.banco} · ${c.numero}` }))}
        hoy={hoy}
      />
    </>
  );
}
