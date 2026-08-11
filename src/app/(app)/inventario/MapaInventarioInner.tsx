"use client";
// Mapa real (Leaflet + OpenStreetMap) con burbujas por sede, dimensionadas
// por cantidad de ítems y con desglose por estado en el tooltip.
import "leaflet/dist/leaflet.css";
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
}

export default function MapaInventarioInner({ data }: { data: BurbujaSede[] }) {
  const conCoord = data.filter((d) => COORD[d.ciudad] && d.total > 0);
  const max = Math.max(1, ...conCoord.map((d) => d.total));
  const radio = (v: number) => 10 + Math.sqrt(v / max) * 34;

  return (
    <MapContainer center={[7.5, -74.2]} zoom={5} scrollWheelZoom={false} style={{ height: 460, width: "100%", borderRadius: 10 }}>
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
              <div style={{ minWidth: 190 }}>
                <div style={{ fontWeight: 800, borderBottom: "1px solid #ddd", paddingBottom: 3, marginBottom: 4 }}>
                  📍 {d.ciudad} · {nf.format(d.total)} ítems
                </div>
                <div className="flag" style={{ fontSize: 11, marginBottom: 4 }}>{d.sede}</div>
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
