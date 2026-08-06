"use client";
// Mapa real (Leaflet + OpenStreetMap) con burbujas por ciudad.
import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, CircleMarker, Tooltip } from "react-leaflet";

// Coordenadas reales (lat, lng) de las ciudades.
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
};

const cop = (n: number) => "$ " + Math.round(n).toLocaleString("es-CO");

export interface BurbujaCiudad {
  ciudad: string;
  valor: number;
  color: string;
  ips?: { cliente: string; saldo: number }[];
}

export default function MapaLeafletInner({ data }: { data: BurbujaCiudad[] }) {
  const conCoord = data.filter((d) => COORD[d.ciudad] && d.valor > 0);
  const max = Math.max(1, ...conCoord.map((d) => Math.abs(d.valor)));
  const radio = (v: number) => 10 + Math.sqrt(Math.abs(v) / max) * 38;

  return (
    <MapContainer center={[8.2, -74.4]} zoom={6} scrollWheelZoom={false} style={{ height: 460, width: "100%", borderRadius: 10 }}>
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; OpenStreetMap'
      />
      {conCoord
        .slice()
        .sort((a, b) => Math.abs(b.valor) - Math.abs(a.valor))
        .map((d) => (
          <CircleMarker
            key={d.ciudad}
            center={COORD[d.ciudad]!}
            radius={radio(d.valor)}
            pathOptions={{ color: d.color, fillColor: d.color, fillOpacity: 0.55, weight: 1.6 }}
          >
            <Tooltip direction="auto" opacity={1}>
              <div style={{ minWidth: 190 }}>
                <div style={{ fontWeight: 800, borderBottom: "1px solid #ddd", paddingBottom: 3, marginBottom: 4 }}>
                  📍 {d.ciudad} · {cop(d.valor)}
                </div>
                {d.ips?.map((x) => (
                  <div key={x.cliente} style={{ display: "flex", justifyContent: "space-between", gap: 14, fontSize: 11.5, padding: "1px 0" }}>
                    <span style={{ maxWidth: 210, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{x.cliente}</span>
                    <span style={{ fontWeight: 700, whiteSpace: "nowrap" }}>{cop(x.saldo)}</span>
                  </div>
                ))}
              </div>
            </Tooltip>
          </CircleMarker>
        ))}
    </MapContainer>
  );
}
