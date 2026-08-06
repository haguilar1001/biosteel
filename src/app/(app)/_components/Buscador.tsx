// Buscador reutilizable: formulario GET que navega a la misma ruta con ?q=.
// Server component (no requiere JS de cliente).
export function Buscador({
  action,
  q,
  placeholder = "Buscar…",
}: {
  action: string;
  q?: string;
  placeholder?: string;
}) {
  return (
    <form action={action} method="get" className="toolbar" role="search">
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
      {q ? <a href={action} className="btn">Limpiar</a> : null}
    </form>
  );
}
