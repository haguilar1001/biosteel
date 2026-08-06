"use client";
import { useActionState } from "react";
import { cambiarRolUsuarioAction, type AdminState } from "../actions";

const init: AdminState = {};

export function SelectorRolUsuario({
  userId,
  rolActualId,
  roles,
  esSelf,
}: {
  userId: number;
  rolActualId: number;
  roles: { id: number; nombre: string }[];
  esSelf: boolean;
}) {
  const [state, action, pending] = useActionState(cambiarRolUsuarioAction, init);

  return (
    <form action={action} style={{ display: "flex", gap: 6, alignItems: "center", margin: 0 }}>
      <input type="hidden" name="userId" value={userId} />
      <select
        name="rolId"
        defaultValue={rolActualId}
        disabled={esSelf || pending}
        title={esSelf ? "No puedes cambiar tu propio perfil" : "Cambiar perfil (guarda al elegir)"}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="select-inline"
      >
        {roles.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
      </select>
      {pending && <span className="flag">⏳</span>}
      {!pending && state.error && <span title={state.error} style={{ cursor: "help" }}>⚠️</span>}
      {!pending && state.ok && <span style={{ color: "var(--ok)" }}>✅</span>}
    </form>
  );
}
