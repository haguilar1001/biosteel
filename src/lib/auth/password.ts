// ==========================================================
// Hash y verificación de contraseñas con Argon2id (BIO-SEC-002)
// ==========================================================
import "server-only";
import { hash, verify } from "@node-rs/argon2";

// Parámetros recomendados por OWASP para Argon2id.
const ARGON_OPTS = {
  memoryCost: 19456, // 19 MiB
  timeCost: 2,
  parallelism: 1,
};

export function hashPassword(plain: string): Promise<string> {
  return hash(plain, ARGON_OPTS);
}

export async function verifyPassword(hashStr: string, plain: string): Promise<boolean> {
  try {
    return await verify(hashStr, plain, ARGON_OPTS);
  } catch {
    return false;
  }
}
