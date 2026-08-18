// ==========================================================
// Cartera por Ciudad — una sola vista: mapa de Colombia + tabla jerárquica
// (cada ciudad se expande y muestra el saldo por IPS con % sobre la ciudad).
// ==========================================================
import { requirePermiso } from "@/server/auth-context";
import { Monto } from "../../_components/Monto";
import { carteraPorCiudad, aniosCartera } from "@/lib/negocio/cartera";
import { leerPeriodo, etiquetaPeriodo } from "@/lib/periodo";
import { MapaCartera } from "../../_components/charts/MapaCartera";
import { BotonImprimir } from "../../_components/BotonImprimir";
import { FiltroPeriodo } from "../../_components/FiltroPeriodo";
import { CiudadesTabla, type CiudadItem } from "./CiudadesTabla";

const CATS = ["var(--cat-1)", "var(--cat-2)", "var(--cat-3)", "var(--cat-4)", "var(--cat-5)", "var(--cat-6)", "var(--cat-7)", "var(--cat-8)"];

export default async function CarteraPorCiudadPage({
  searchParams,
}: {
  searchParams: Promise<{ anio?: string; mes?: string }>;
}) {
  const { usuario, alcance } = await requirePermiso("cartera.view");
  const sp = await searchParams;

  // Periodo por fecha de VENCIMIENTO, igual que en las demás vistas de cartera.
  const { anio, mes } = leerPeriodo(sp);
  const periodo = etiquetaPeriodo({ anio, mes });
  const qs = new URLSearchParams();
  if (anio) qs.set("anio", String(anio));
  if (mes) qs.set("mes", String(mes));
  const sufijo = qs.toString() ? `?${qs}` : "";

  const anios = await aniosCartera(usuario, alcance);
  const ciudades = await carteraPorCiudad(usuario, alcance, { anio, mes });
  const total = ciudades.reduce((s, c) => s + c.saldo, 0);
  const totalDocs = ciudades.reduce((s, c) => s + c.documentos, 0);

  // Color por ciudad (categórico); "Sin ciudad" en gris.
  let idx = 0;
  const color = new Map<string, string>();
  for (const c of ciudades) color.set(c.ciudad, c.ciudad === "Sin ciudad" ? "var(--muted)" : CATS[idx++ % CATS.length]!);

  const mapaData = ciudades.map((c) => ({
    ciudad: c.ciudad, valor: c.saldo, color: color.get(c.ciudad)!,
    ips: c.ips.map((i) => ({ cliente: i.cliente, saldo: i.saldo })),
  }));
  const items: CiudadItem[] = ciudades.map((c) => ({
    ciudad: c.ciudad, saldo: c.saldo, documentos: c.documentos, clientes: c.clientes,
    color: color.get(c.ciudad)!, ips: c.ips.map((i) => ({ cliente: i.cliente, saldo: i.saldo, documentos: i.documentos })),
  }));

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Cartera</div>
          <h1>Cartera por ciudad</h1>
          <p>Vence: {periodo} · clic en una ciudad para desplegar sus IPS (% sobre el total de la ciudad)</p>
        </div>
        <div className="toolbar">
          <a href={`/cartera/ciudades/export${sufijo}`} className="btn" title="Descargar en Excel">⬇️ Excel</a>
          <BotonImprimir />
          <a href="/cartera" className="btn">← Facturas</a>
        </div>
      </div>

      <FiltroPeriodo
        anios={anios}
        periodo={{ anio, mes }}
        hrefTodo="/cartera/ciudades"
        textoTodo="Toda la cartera"
      />

      <div className="card no-print" style={{ marginBottom: 12 }}>
        <div className="chart-head">Mapa de cartera <span className="hact">{ciudades.length} ciudades · <Monto value={total} /></span></div>
        <div className="card-body"><MapaCartera data={mapaData} /></div>
      </div>

      <div className="card">
        <div className="chart-head">Saldo neto por ciudad <span className="hact">clic para expandir IPS</span></div>
        <CiudadesTabla ciudades={items} total={total} totalDocs={totalDocs} />
      </div>
    </>
  );
}
