import { requireUsuario } from "@/server/auth-context";
import { alcanceDe, filtroFacturas } from "@/lib/rbac/authorize";
import { prisma } from "@/lib/db";
import { formatCOP } from "@/lib/format";
import { logoutAction } from "../login/actions";

export default async function DashboardPage() {
  const usuario = await requireUsuario();

  // Demostración del patrón anti-IDOR: la suma respeta el alcance del usuario.
  const alcanceCartera = await alcanceDe(usuario, "cartera.view");
  let saldoCartera: string | null = null;
  if (alcanceCartera !== "ninguno") {
    const agg = await prisma.facturaVenta.aggregate({
      _sum: { saldo: true },
      where: filtroFacturas(usuario, alcanceCartera),
    });
    saldoCartera = formatCOP(agg._sum.saldo ?? 0);
  }

  return (
    <>
      <header className="topbar">
        <span className="brand">🦴 BioSteel</span>
        <span className="sep" />
        <span style={{ fontSize: 13, opacity: 0.9 }}>
          {usuario.nombre} · {usuario.rol.nombre}
        </span>
        <form action={logoutAction}>
          <button type="submit" className="logout">Cerrar sesión</button>
        </form>
      </header>

      <main className="container">
        <div className="eyebrow">Inicio</div>
        <h1 style={{ fontSize: 26, margin: "4px 0 16px" }}>Panel de Flujo de Caja</h1>

        <div className="card">
          <p style={{ marginTop: 0 }}>
            Bienvenido, <strong>{usuario.nombre}</strong>. Tu rol es{" "}
            <span className="badge">{usuario.rol.nombre}</span>.
          </p>

          {saldoCartera !== null ? (
            <p>
              Saldo de cartera en tu alcance (<code>{alcanceCartera}</code>):{" "}
              <strong>{saldoCartera}</strong>
            </p>
          ) : (
            <p style={{ color: "var(--muted)" }}>Tu rol no tiene acceso a la cartera.</p>
          )}

          <hr style={{ border: 0, borderTop: "1px solid var(--line)", margin: "16px 0" }} />
          <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 0 }}>
            ✅ Baseline de seguridad P0 activo: sesión segura, RBAC deny-by-default,
            rate limiting, auditoría y cabeceras/CSP. Las pantallas del prototipo se
            conectarán aquí una vez carguemos los datos reales.
          </p>
        </div>
      </main>
    </>
  );
}
