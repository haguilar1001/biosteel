"use client";
import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { loginAction, type LoginState } from "./actions";
import { PasswordInput } from "@/components/PasswordInput";

const estadoInicial: LoginState = {};

function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, estadoInicial);
  const params = useSearchParams();
  const next = params.get("next") ?? "/dashboard";
  const cambiada = params.get("cambiada");

  return (
    <form action={formAction} className="auth-body">
      {cambiada && (
        <div className="alert" role="status" style={{ background: "#E7F5EE", color: "var(--ok)", border: "1px solid #B8E0CC" }}>
          Contraseña actualizada. Inicia sesión de nuevo.
        </div>
      )}
      {state.error && <div className="alert" role="alert">{state.error}</div>}

      <input type="hidden" name="next" value={next} />

      <div className="field">
        <label htmlFor="email">Correo</label>
        <input id="email" name="email" type="email" autoComplete="username" required autoFocus />
      </div>

      <div className="field">
        <label htmlFor="password">Contraseña</label>
        <PasswordInput id="password" name="password" autoComplete="current-password" required />
      </div>

      {state.needsTotp && (
        <div className="field">
          <label htmlFor="totp">Código de verificación (2FA)</label>
          <input id="totp" name="totp" inputMode="numeric" pattern="\d{6}" maxLength={6} autoComplete="one-time-code" required />
        </div>
      )}

      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? "Ingresando…" : "Iniciar sesión"}
      </button>

      <p className="hint">Acceso restringido · BioSteel de Colombia S.A.S</p>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="auth-wrap">
      <div className="auth-card">
        <div className="auth-head">
          <div className="brand">BioSteel</div>
          <div className="sub">DE COLOMBIA S.A.S</div>
        </div>
        <Suspense fallback={<div className="auth-body">Cargando…</div>}>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
