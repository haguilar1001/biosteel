// Administración · Terceros (clientes y proveedores · solo lectura en esta fase).
// Buscador por nombre/NIT y ordenamiento por cualquier columna (query params).
import { requirePermiso } from "@/server/auth-context";
import { prisma } from "@/lib/db";
import { formatCOP, formatNumero } from "@/lib/format";
import { Buscador } from "../../_components/Buscador";

const CAT_LABEL: Record<string, string> = {
  clinica_ips: "Clínica / IPS",
  eps_aseguradora: "EPS / Aseguradora",
  distribuidor: "Distribuidor",
  cirujano_particular: "Cirujano",
};

type SortKey = "nit" | "nombre" | "clase" | "categoria" | "ciudad" | "cupo" | "dias";
const SORT_KEYS: SortKey[] = ["nit", "nombre", "clase", "categoria", "ciudad", "cupo", "dias"];

export default async function TercerosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sort?: string; dir?: string }>;
}) {
  await requirePermiso("tercero.manage");
  const sp = await searchParams;

  const q = sp.q?.trim() ?? "";
  const sort: SortKey = SORT_KEYS.includes(sp.sort as SortKey) ? (sp.sort as SortKey) : "nombre";
  const dir: "asc" | "desc" = sp.dir === "desc" ? "desc" : "asc";

  const terceros = await prisma.tercero.findMany({
    include: { clientePerfil: true, proveedorPerfil: true },
  });

  // Aplana a filas comparables (algunas columnas son derivadas del perfil).
  const filas = terceros.map((t) => {
    const clases: string[] = [];
    if (t.esCliente) clases.push("Cliente");
    if (t.esProveedor) clases.push("Proveedor");
    const categoria = t.clientePerfil
      ? CAT_LABEL[t.clientePerfil.categoria] ?? t.clientePerfil.categoria
      : t.proveedorPerfil
        ? t.proveedorPerfil.tipo === "importado" ? "Importado" : "Nacional"
        : "—";
    return {
      id: t.id,
      nit: t.nit ?? "",
      nombre: t.nombre,
      clase: clases.join(" / ") || "—",
      clases,
      categoria,
      ciudad: t.ciudad ?? "",
      cupo: t.clientePerfil?.cupoCredito.toNumber() ?? null,
      dias: t.clientePerfil?.diasCredito ?? t.proveedorPerfil?.diasCredito ?? null,
    };
  });

  // Filtro por texto (nombre o NIT).
  const norm = (s: string) => s.toLowerCase();
  const filtradas = q
    ? filas.filter((f) => norm(f.nombre).includes(norm(q)) || norm(f.nit).includes(norm(q)))
    : filas;

  // Ordenamiento. Numérico para cupo/días; texto (es-CO) para el resto.
  const factor = dir === "asc" ? 1 : -1;
  const ordenadas = [...filtradas].sort((a, b) => {
    if (sort === "cupo" || sort === "dias") {
      const va = a[sort] ?? -Infinity;
      const vb = b[sort] ?? -Infinity;
      return (va - vb) * factor;
    }
    return String(a[sort]).localeCompare(String(b[sort]), "es-CO", { numeric: true }) * factor;
  });

  // Enlace de encabezado: mantiene la búsqueda y alterna asc/desc.
  const thHref = (k: SortKey) => {
    const nextDir = sort === k && dir === "asc" ? "desc" : "asc";
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    p.set("sort", k);
    p.set("dir", nextDir);
    return `/admin/terceros?${p.toString()}`;
  };
  const Th = ({ k, label, r }: { k: SortKey; label: string; r?: boolean }) => {
    const on = sort === k;
    return (
      <th className={r ? "r" : undefined}>
        <a href={thHref(k)} className={`th-sort${on ? " on" : ""}`}>
          {label}
          <span className="ord" aria-hidden>{on ? (dir === "asc" ? "▲" : "▼") : "↕"}</span>
        </a>
      </th>
    );
  };

  return (
    <div className="card">
      <div className="chart-head">
        Terceros <span className="hact">{formatNumero(ordenadas.length)}{q ? ` de ${formatNumero(filas.length)}` : ""} registros</span>
      </div>
      <div className="card-body" style={{ paddingBottom: 0 }}>
        <Buscador action="/admin/terceros" q={q} placeholder="Buscar por nombre o NIT…" />
      </div>
      <div className="tbl-wrap">
        <table>
          <thead>
            <tr>
              <Th k="nit" label="NIT" />
              <Th k="nombre" label="Nombre" />
              <Th k="clase" label="Clase" />
              <Th k="categoria" label="Tipo / Categoría" />
              <Th k="ciudad" label="Ciudad" />
              <Th k="cupo" label="Cupo crédito" r />
              <Th k="dias" label="Días" r />
            </tr>
          </thead>
          <tbody>
            {ordenadas.length === 0 ? (
              <tr><td colSpan={7} className="empty">Sin resultados{q ? ` para "${q}"` : ""}.</td></tr>
            ) : (
              ordenadas.map((f) => (
                <tr key={f.id}>
                  <td className="num">{f.nit || "—"}</td>
                  <td style={{ fontWeight: 600 }}>{f.nombre}</td>
                  <td>
                    {f.clases.length === 0 ? "—" : f.clases.map((c) => (
                      <span key={c} className={`tag ${c === "Cliente" ? "t-blue" : "t-ok"}`} style={{ marginRight: 4 }}>{c}</span>
                    ))}
                  </td>
                  <td>{f.categoria}</td>
                  <td>{f.ciudad || "—"}</td>
                  <td className="r num">{f.cupo != null ? formatCOP(f.cupo) : "—"}</td>
                  <td className="r num">{f.dias != null ? f.dias : "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
