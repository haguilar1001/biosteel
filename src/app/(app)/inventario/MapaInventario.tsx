"use client";
// Carga el mapa Leaflet solo en el cliente (ssr:false) porque usa `window`.
import dynamic from "next/dynamic";
import type { BurbujaSede } from "./MapaInventarioInner";

const Inner = dynamic(() => import("./MapaInventarioInner"), {
  ssr: false,
  loading: () => <div className="empty" style={{ height: 460, display: "grid", placeItems: "center" }}>Cargando mapa…</div>,
});

export function MapaInventario({ data }: { data: BurbujaSede[] }) {
  return <Inner data={data} />;
}
