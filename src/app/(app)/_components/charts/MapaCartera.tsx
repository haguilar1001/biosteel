"use client";
// Carga el mapa Leaflet solo en el cliente (ssr:false) porque usa `window`.
import dynamic from "next/dynamic";
import type { BurbujaCiudad } from "./MapaLeafletInner";

const Inner = dynamic(() => import("./MapaLeafletInner"), {
  ssr: false,
  loading: () => <div className="empty" style={{ height: 440, display: "grid", placeItems: "center" }}>Cargando mapa…</div>,
});

export function MapaCartera({ data }: { data: BurbujaCiudad[] }) {
  return <Inner data={data} />;
}
