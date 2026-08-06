"use client";
import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { loginAction, type LoginState } from "./actions";

const estadoInicial: LoginState = {};

function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, estadoInicial);
  const next = useSearchParams().get("next") ?? "/dashboard";

  return (
    <form action={formAction} className="auth-body">
      {state.error && <div className="alert" role="alert">{state.error}</div>}

      <input type="hidden" name="next" value={next} />

      <div className="field">
        <label htmlFor="email">Correo</label>
        <input id="email" name="email" type="email" autoComplete="username" required autoFocus />
      </div>

      <div className="field">
        <label htmlFor="password">Contraseña</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required />
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
