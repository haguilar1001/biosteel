// ==========================================================
// Rate limiting por IP (BIO-SEC-004) — ventana deslizante en memoria.
// NOTA: es best-effort por instancia. Para multi-instancia en Railway,
// migrar a un almacén compartido (Redis) — ver PRD P1.
// ==========================================================
import "server-only";

interface Registro {
  count: number;
  resetAt: number;
}

const almacen = new Map<string, Registro>();

export interface ResultadoLimite {
  permitido: boolean;
  restantes: number;
  reintentarEnSeg: number;
}

/**
 * Consume un intento para `clave` (p. ej. `login:<ip>`).
 * @param limite  intentos permitidos por ventana
 * @param ventanaMs  duración de la ventana en ms
 */
export function consumir(clave: string, limite = 10, ventanaMs = 60_000): ResultadoLimite {
  const ahora = Date.now();
  const reg = almacen.get(clave);

  if (!reg || reg.resetAt <= ahora) {
    almacen.set(clave, { count: 1, resetAt: ahora + ventanaMs });
    return { permitido: true, restantes: limite - 1, reintentarEnSeg: 0 };
  }

  reg.count += 1;
  if (reg.count > limite) {
    return { permitido: false, restantes: 0, reintentarEnSeg: Math.ceil((reg.resetAt - ahora) / 1000) };
  }
  return { permitido: true, restantes: limite - reg.count, reintentarEnSeg: 0 };
}

// Limpieza periódica de entradas vencidas (evita fuga de memoria).
if (typeof setInterval !== "undefined") {
  const t = setInterval(() => {
    const ahora = Date.now();
    for (const [clave, reg] of almacen) if (reg.resetAt <= ahora) almacen.delete(clave);
  }, 5 * 60_000);
  // No mantener vivo el proceso solo por este timer.
  (t as unknown as { unref?: () => void }).unref?.();
}
