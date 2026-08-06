"use client";
import { Fragment, useActionState, useMemo, useState } from "react";
import { guardarMatrizAction, type AdminState } from "../actions";

type Alc = "todos" | "propio" | "ninguno";
const CICLO: Record<Alc, Alc> = { todos: "propio", propio: "ninguno", ninguno: "todos" };
const init: AdminState = {};

export interface PermisoRow { clave: string; modulo: string; descripcion: string }
export interface RolCol { id: number; nombre: string; sistema: boolean }

export function MatrizRoles({
  permisos,
  roles,
  inicial,
}: {
  permisos: PermisoRow[];
  roles: RolCol[];
  inicial: Record<string, Alc>; // clave `${rolId}|${permisoClave}`
}) {
  const [state, action, pending] = useActionState(guardarMatrizAction, init);
  const [m, setM] = useState<Record<string, Alc>>(inicial);

  const val = (rolId: number, clave: string): Alc => m[`${rolId}|${clave}`] ?? "ninguno";

  const cambios = useMemo(() => {
    const out: { rolId: number; clave: string; alcance: Alc }[] = [];
    for (const r of roles) for (const p of permisos) {
      const k = `${r.id}|${p.clave}`;
      const cur = m[k] ?? "ninguno";
      const ini = inicial[k] ?? "ninguno";
      if (cur !== ini) out.push({ rolId: r.id, clave: p.clave, alcance: cur });
    }
    return out;
  }, [m, roles, permisos, inicial]);

  const toggle = (rolId: number, clave: string) =>
    setM((prev) => ({ ...prev, [`${rolId}|${clave}`]: CICLO[prev[`${rolId}|${clave}`] ?? "ninguno"] }));

  const grupos = useMemo(() => {
    // Agrupa TODOS los permisos del mismo módulo juntos (aunque no sean contiguos),
    // preservando el orden de primera aparición. Módulo = clave única de grupo.
    const map = new Map<string, PermisoRow[]>();
    for (const p of permisos) {
      const arr = map.get(p.modulo) ?? [];
      arr.push(p);
      map.set(p.modulo, arr);
    }
    return [...map.entries()].map(([modulo, items]) => ({ modulo, items }));
  }, [permisos]);

  const marca = (a: Alc) =>
    a === "todos" ? <span style={{ color: "var(--ok)", fontWeight: 800 }}>✔</span>
      : a === "propio" ? <span className="tag t-w1">Propia</span>
        : <span style={{ color: "var(--muted)" }}>—</span>;

  return (
    <div className="card">
      <div className="chart-head">
        🔐 Matriz de permisos por perfil
        <span className="hact">✔ Todos · Propia · — Ninguno</span>
      </div>
      <div className="card-body" style={{ paddingTop: 12, paddingBottom: 0 }}>
        <div className="alert" style={{ background: "var(--brand-tint)", border: "1px solid var(--line)", color: "var(--ink)" }}>
          👉 Haz clic en cada casilla para alternar <b>✔ Todos → Propia → — Ninguno</b>, y guarda. No se permite dejar
          al sistema sin ningún usuario que gestione <b>usuarios y roles</b>.
        </div>
      </div>
      <div className="tbl-wrap">
        <table>
          <thead>
            <tr>
              <th>Opción</th>
              {roles.map((r) => (
                <th key={r.id} style={{ textAlign: "center" }}>{r.nombre}{r.sistema ? "" : " ✦"}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grupos.map((g) => (
              <Fragment key={g.modulo}>
                <tr className="fila-modulo">
                  <td colSpan={roles.length + 1} style={{ fontWeight: 800, textTransform: "uppercase", fontSize: 11, letterSpacing: 0.5, color: "var(--brand)" }}>
                    {g.modulo}
                  </td>
                </tr>
                {g.items.map((p) => (
                  <tr key={p.clave}>
                    <td><div style={{ fontWeight: 600 }}>{p.descripcion}</div><div className="flag">{p.clave}</div></td>
                    {roles.map((r) => {
                      const a = val(r.id, p.clave);
                      const cambiada = a !== (inicial[`${r.id}|${p.clave}`] ?? "ninguno");
                      return (
                        <td key={r.id} style={{ textAlign: "center" }}>
                          <button
                            type="button"
                            className={`cel-perm${cambiada ? " dirty" : ""}`}
                            onClick={() => toggle(r.id, p.clave)}
                            title={`${r.nombre} · ${p.descripcion}: ${a}`}
                          >
                            {marca(a)}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card-body" style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <form action={action} style={{ margin: 0 }}>
          <input type="hidden" name="cambios" value={JSON.stringify(cambios)} />
          <button type="submit" className="btn primary" disabled={pending || cambios.length === 0}>
            {pending ? "Guardando…" : `💾 Guardar cambios${cambios.length ? ` (${cambios.length})` : ""}`}
          </button>
        </form>
        {!pending && state.error && <span className="alert" role="alert" style={{ margin: 0 }}>⚠️ {state.error}</span>}
        {!pending && state.ok && <span className="alert ok" role="status" style={{ margin: 0 }}>✅ {state.msg}</span>}
        {cambios.length > 0 && !pending && !state.error && <span className="flag">✏️ {cambios.length} sin guardar</span>}
      </div>
    </div>
  );
}
