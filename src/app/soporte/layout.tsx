// ==========================================================
// Layout de los documentos soporte (imprimibles).
// Deliberadamente FUERA del grupo (app): sin ribbon ni menús,
// para que la impresión / "Guardar como PDF" quede limpia.
// La sesión sigue exigida por el middleware + requirePermiso en cada página.
// ==========================================================
import "./soporte.css";

export default function SoporteLayout({ children }: { children: React.ReactNode }) {
  return <div className="sop-root">{children}</div>;
}
