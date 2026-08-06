// ==========================================================
// MFA por TOTP (BIO-SEC-002). Scaffold listo para activar en P1.
// El secreto se almacena cifrado a nivel de app (BIO-SEC-013) — pendiente.
// ==========================================================
import "server-only";
import { Secret, TOTP } from "otpauth";

const EMISOR = "BioSteel";

function totpDe(secretBase32: string, label: string): TOTP {
  return new TOTP({
    issuer: EMISOR,
    label,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: Secret.fromBase32(secretBase32),
  });
}

/** Genera un secreto nuevo y su URL para el código QR (app autenticadora). */
export function generarSecretoTotp(label: string): { secret: string; uri: string } {
  const secret = new Secret({ size: 20 });
  const totp = totpDe(secret.base32, label);
  return { secret: secret.base32, uri: totp.toString() };
}

/** Verifica un código de 6 dígitos con tolerancia de ±1 ventana. */
export function verificarTotp(secretBase32: string, codigo: string, label = EMISOR): boolean {
  const totp = totpDe(secretBase32, label);
  return totp.validate({ token: codigo, window: 1 }) !== null;
}
