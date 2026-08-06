// Administración · Terceros (clientes y proveedores · solo lectura en esta fase).
import { requirePermiso } from "@/server/auth-context";
import { prisma } from "@/lib/db";
import { formatCOP, formatNumero } from "@/lib/format";

const CAT_LABEL: Record<string, string> = {
  clinica_ips: "Clínica / IPS",
  eps_aseguradora: "EPS / Aseguradora",
  distribuidor: "Distribuidor",
  cirujano_particular: "Cirujano",
};

export default async function TercerosPage() {
  await requirePermiso("tercero.manage");

  const terceros = await prisma.tercero.findMany({
    orderBy: { nombre: "asc" },
    include: { clientePerfil: true, proveedorPerfil: true },
  });

  return (
    <div className="card">
      <div className="chart-head">
        Terceros <span className="hact">{formatNumero(terceros.length)} registros</span>
      </div>
      <div className="tbl-wrap">
        <table>
          <thead>
            <tr>
              <th>NIT</th><th>Nombre</th><th>Clase</th><th>Tipo / Categoría</th>
              <th>Ciudad</th><th className="r">Cupo crédito</th><th className="r">Días</th>
            </tr>
          </thead>
          <tbody>
            {terceros.length === 0 ? (
              <tr><td colSpan={7} className="empty">No hay terceros registrados.</td></tr>
            ) : (
              terceros.map((t) => {
                const clases: string[] = [];
                if (t.esCliente) clases.push("Cliente");
                if (t.esProveedor) clases.push("Proveedor");
                const categoria = t.clientePerfil
                  ? CAT_LABEL[t.clientePerfil.categoria] ?? t.clientePerfil.categoria
                  : t.proveedorPerfil
                    ? t.proveedorPerfil.tipo === "importado" ? "Importado" : "Nacional"
                    : "—";
                const cupo = t.clientePerfil?.cupoCredito.toNumber() ?? null;
                const dias = t.clientePerfil?.diasCredito ?? t.proveedorPerfil?.diasCredito ?? null;
                return (
                  <tr key={t.id}>
                    <td className="num">{t.nit}</td>
                    <td style={{ fontWeight: 600 }}>{t.nombre}</td>
                    <td>
                      {clases.map((c) => (
                        <span key={c} className={`tag ${c === "Cliente" ? "t-blue" : "t-ok"}`} style={{ marginRight: 4 }}>{c}</span>
                      ))}
                    </td>
                    <td>{categoria}</td>
                    <td>{t.ciudad ?? "—"}</td>
                    <td className="r num">{cupo != null ? formatCOP(cupo) : "—"}</td>
                    <td className="r num">{dias != null ? dias : "—"}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
