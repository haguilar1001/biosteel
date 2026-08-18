// Buscador reutilizable: formulario GET que navega a la misma ruta con ?q=.
// Server component (no requiere JS de cliente).
export function Buscador({
  action,
  q,
  placeholder = "Buscar…",
  extra,
  limpiarHref,
}: {
  action: string;
  q?: string;
  placeholder?: string;
  /** Filtros de la vista que deben viajar con la búsqueda (mes, edad, …). */
  extra?: Record<string, string>;
  /** Destino del botón "Limpiar" (por defecto, la ruta sin filtros). */
  limpiarHref?: string;
}) {
  return (
    <form action={action} method="get" className="toolbar" role="search">
      {extra ? Object.entries(extra).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />) : null}
      <input
        type="search"
        name="q"
        defaultValue={q ?? ""}
        placeholder={placeholder}
        className="select"
        style={{ minWidth: 260 }}
        aria-label="Buscar"
      />
      <button type="submit" className="btn primary">Buscar</button>
      {q ? <a href={limpiarHref ?? action} className="btn">Limpiar</a> : null}
    </form>
  );
}
