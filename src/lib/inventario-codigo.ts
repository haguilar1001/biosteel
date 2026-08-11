// ==========================================================
// Códigos de inventario (correlativos por categoría). Util PURO,
// sin "server-only", reutilizable en acciones, negocio y scripts.
// ==========================================================

/** Prefijo de 3 caracteres derivado de la categoría: MOTOR→MOT, MOTOR SISTEM 8→MS8. */
export function prefijoCodigo(categoria: string): string {
  const palabras = categoria.trim().toUpperCase().split(/\s+/).filter(Boolean);
  const base = palabras.length <= 1
    ? (palabras[0] ?? "INV").slice(0, 3)
    : palabras.map((w) => w[0]).join("").slice(0, 3);
  return base.padEnd(3, "X");
}

export function formatCodigo(prefijo: string, n: number): string {
  return `${prefijo}-${String(n).padStart(3, "0")}`;
}

/** Siguiente número libre para un prefijo, dado el listado de códigos existentes. */
export function siguienteNumero(prefijo: string, existentes: (string | null)[]): number {
  const re = new RegExp(`^${prefijo}-(\\d+)$`);
  let max = 0;
  for (const c of existentes) {
    const m = c ? re.exec(c) : null;
    if (m) max = Math.max(max, Number(m[1]));
  }
  return max + 1;
}
