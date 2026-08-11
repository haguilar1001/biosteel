"use client";
// Mapa real (Leaflet + OpenStreetMap) con burbujas por sede, dimensionadas
// por cantidad de ítems y con desglose por tipo y estado en el tooltip.
import "leaflet/dist/leaflet.css";
import { latLngBounds } from "leaflet";
import { MapContainer, TileLayer, CircleMarker, Tooltip } from "react-leaflet";

const COORD: Record<string, [number, number]> = {
  "Barranquilla": [10.9685, -74.7813],
  "Santa Marta": [11.2408, -74.199],
  "Cartagena": [10.391, -75.4794],
  "Sincelejo": [9.3047, -75.3978],
  "Montería": [8.7479, -75.8814],
  "Cali": [3.4516, -76.532],
  "Medellín": [6.2442, -75.5812],
  "Bogotá": [4.711, -74.0721],
  "Bucaramanga": [7.1193, -73.1227],
  "Cúcuta": [7.8939, -72.5078],
  "Yopal": [5.3378, -72.3959],
};

const ESTADO = [
  { k: "activo", label: "Activo", color: "var(--ok)" },
  { k: "en_reparacion", label: "En reparación", color: "var(--w1)" },
  { k: "de_baja", label: "De baja", color: "var(--bad)" },
  { k: "pendiente", label: "Pendiente", color: "var(--brand)" },
] as const;

const nf = new Intl.NumberFormat("es-CO");

export interface BurbujaSede {
  ciudad: string;
  sede: string;
  total: number;
  estados: Record<string, number>;
  tipos: { equipo: number; accesorio: number };
}

// Límite de Colombia para que el mapa no se aleje del país.
const COLOMBIA: [[number, number], [number, number]] = [[-4.5, -82], [13.5, -66]];

export default function MapaInventarioInner({ data }: { data: BurbujaSede[] }) {
  const conCoord = data.filter((d) => COORD[d.ciudad] && d.total > 0);
  const max = Math.max(1, ...conCoord.map((d) => d.total));
  const radio = (v: number) => 10 + Math.sqrt(v / max) * 34;

  // Encuadra a las sedes con datos (así se ve solo Colombia, no toda la región).
  const bounds = conCoord.length
    ? latLngBounds(conCoord.map((d) => COORD[d.ciudad]!)).pad(0.35)
    : latLngBounds(COLOMBIA);

  return (
    <MapContainer
      bounds={bounds}
      maxBounds={COLOMBIA}
      maxBoundsViscosity={0.9}
      minZoom={5}
      scrollWheelZoom={false}
      style={{ height: 500, width: "100%", borderRadius: 10 }}
    >
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" />
      {conCoord
        .slice()
        .sort((a, b) => b.total - a.total)
        .map((d) => (
          <CircleMarker
            key={d.ciudad}
            center={COORD[d.ciudad]!}
            radius={radio(d.total)}
            pathOptions={{ color: "var(--brand)", fillColor: "var(--brand)", fillOpacity: 0.5, weight: 1.6 }}
          >
            <Tooltip direction="auto" opacity={1}>
              <div style={{ minWidth: 200 }}>
                <div style={{ fontWeight: 800, borderBottom: "1px solid #ddd", paddingBottom: 3, marginBottom: 4 }}>
                  📍 {d.ciudad} · {nf.format(d.total)} ítems
                </div>
                <div className="flag" style={{ fontSize: 11, marginBottom: 5 }}>{d.sede}</div>

                <div style={{ fontWeight: 700, fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".4px", opacity: .7, margin: "2px 0" }}>Por tipo</div>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 14, fontSize: 11.5, padding: "1px 0" }}>
                  <span>🔩 Equipos</span><span style={{ fontWeight: 700 }}>{nf.format(d.tipos.equipo)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 14, fontSize: 11.5, padding: "1px 0" }}>
                  <span>🧩 Accesorios</span><span style={{ fontWeight: 700 }}>{nf.format(d.tipos.accesorio)}</span>
                </div>

                <div style={{ fontWeight: 700, fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".4px", opacity: .7, margin: "5px 0 2px" }}>Por estado</div>
                {ESTADO.filter((e) => (d.estados[e.k] ?? 0) > 0).map((e) => (
                  <div key={e.k} style={{ display: "flex", justifyContent: "space-between", gap: 14, fontSize: 11.5, padding: "1px 0" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <i style={{ width: 9, height: 9, borderRadius: 2, background: e.color }} /> {e.label}
                    </span>
                    <span style={{ fontWeight: 700 }}>{nf.format(d.estados[e.k] ?? 0)}</span>
                  </div>
                ))}
              </div>
            </Tooltip>
          </CircleMarker>
        ))}
    </MapContainer>
  );
}
