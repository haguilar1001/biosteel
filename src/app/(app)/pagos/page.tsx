// ==========================================================
// Registrar Pago a Proveedor (Tesorería)
// Carga proveedores, cuentas, TRM sugerida y —si hay proveedor
// seleccionado— sus documentos por pagar abiertos.
// ==========================================================
import { requirePermiso } from "@/server/auth-context";
import { prisma } from "@/lib/db";
import { PagoForm } from "./PagoForm";

export default async function PagosPage({
  searchParams,
}: {
  searchParams: Promise<{ proveedorId?: string }>;
}) {
  await requirePermiso("pago.create");
  const { proveedorId: raw } = await searchParams;
  const proveedorId = raw && /^\d+$/.test(raw) ? Number(raw) : null;

  const [proveedores, cuentas, trmRow, proveedorSel] = await Promise.all([
    prisma.tercero.findMany({
      where: { esProveedor: true },
      select: { id: true, nombre: true, proveedorPerfil: { select: { monedaDefault: true } } },
      orderBy: { nombre: "asc" },
    }),
    prisma.cuentaBancaria.findMany({
      where: { activo: true },
      select: { id: true, banco: true, numero: true },
      orderBy: { banco: "asc" },
    }),
    prisma.tasaCambio.findFirst({ where: { monedaCodigo: "USD" }, orderBy: { fecha: "desc" } }),
    proveedorId != null
      ? prisma.tercero.findUnique({ where: { id: proveedorId }, select: { proveedorPerfil: { select: { monedaDefault: true } } } })
      : null,
  ]);

  const documentos =
    proveedorId != null
      ? await prisma.documentoCxp.findMany({
          where: { proveedorId, estado: { not: "pagado" }, saldo: { gt: 0 } },
          select: { id: true, numero: true, moneda: true, saldo: true },
          orderBy: { fechaVencimiento: "asc" },
        })
      : [];

  const trmSugerida = trmRow?.valorCop.toNumber() ?? 4000;
  const monedaDefault = proveedorSel?.proveedorPerfil?.monedaDefault ?? "COP";
  const hoy = new Date().toISOString().slice(0, 10);

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Tesorería</div>
          <h1>Registrar Pago a Proveedor</h1>
          <p>Aplica a documentos por pagar, con manejo de moneda extranjera</p>
        </div>
      </div>

      <PagoForm
        key={proveedorId ?? "none"}
        proveedores={proveedores.map((p) => ({ id: p.id, nombre: p.nombre, moneda: p.proveedorPerfil?.monedaDefault ?? "COP" }))}
        proveedorId={proveedorId}
        monedaDefault={monedaDefault}
        documentos={documentos.map((d) => ({ id: d.id, numero: d.numero, moneda: d.moneda, saldo: d.saldo.toNumber() }))}
        cuentas={cuentas.map((c) => ({ id: c.id, etiqueta: `${c.banco} · ${c.numero}` }))}
        hoy={hoy}
        trmSugerida={trmSugerida}
      />
    </>
  );
}
