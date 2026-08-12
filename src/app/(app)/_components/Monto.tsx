// Monto que muestra el valor completo o resumido según la preferencia global
// (atributo data-montos en <html>, alternado por MontosToggle). Server component:
// renderiza ambas variantes y el CSS decide cuál se ve (toggle instantáneo).
import { formatCOP } from "@/lib/format";

function abreviar(v: number): string {
  const a = Math.abs(v);
  if (a >= 1e6) return `$ ${(v / 1e6).toLocaleString("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} M`;
  if (a >= 1e3) return `$ ${(v / 1e3).toLocaleString("es-CO", { maximumFractionDigits: 0 })} K`;
  return formatCOP(v);
}

export function Monto({ value }: { value: number | string }) {
  const v = typeof value === "string" ? Number(value) : value;
  return (
    <span className="monto">
      <span className="monto-full">{formatCOP(v)}</span>
      <span className="monto-short">{abreviar(v)}</span>
    </span>
  );
}
