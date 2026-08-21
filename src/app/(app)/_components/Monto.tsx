// Monto que muestra el valor completo o resumido según la preferencia global
// (atributo data-montos en <html>, alternado desde el menú de configuración).
// Server component: renderiza ambas variantes y el CSS decide cuál se ve
// (toggle instantáneo, sin recargar).
import { formatCOP, formatCOPCorto } from "@/lib/format";

export function Monto({ value }: { value: number | string }) {
  const v = typeof value === "string" ? Number(value) : value;
  return (
    <span className="monto">
      <span className="monto-full">{formatCOP(v)}</span>
      <span className="monto-short">{formatCOPCorto(v)}</span>
    </span>
  );
}
