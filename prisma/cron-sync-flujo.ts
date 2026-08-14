// ==========================================================
// Cron de sincronización del Flujo de Caja (para Railway Cron).
// Corre la sincronización directo contra la BD (sin HTTP ni CRON_SECRET):
// descarga el archivo de OneDrive (Microsoft Graph) y actualiza los
// movimientos del año. Deja bitácora en CargaSiesa (igual que el endpoint).
//
// En Railway: crea un servicio Cron con
//   Start Command:  npm run sync:flujo
//   Cron Schedule:  0 8 * * *      (08:00 UTC = 3:00 a. m. COT)
// Railway lo ejecuta a esa hora, imprime el resultado en Deploy Logs y
// termina (Completed). Requiere las mismas variables del servicio web
// (DATABASE_URL, FLUJO_ONEDRIVE_URL, FLUJO_GRAPH_*).
//
// Local:  npm run sync:flujo
// ==========================================================
import "./_env";
import { sincronizarFlujo } from "../src/lib/negocio/sync-flujo";

async function main() {
  const inicio = new Date();
  console.log(`[sync:flujo] Inicio ${inicio.toISOString()}`);
  const res = await sincronizarFlujo("cron");
  if (!res.ok) {
    console.error(`[sync:flujo] ❌ FALLÓ: ${res.error ?? "error desconocido"}`);
    process.exit(1);
  }
  console.log(`[sync:flujo] ✅ OK · ${res.movimientos} movimientos · año(s) ${res.anios.join(", ")} · ingresos ${res.ingresos} · egresos ${res.egresos}`);
  if (res.categoriasCreadas.length) console.log(`[sync:flujo] categorías nuevas: ${res.categoriasCreadas.join(", ")}`);
}

main()
  .catch((e) => { console.error("[sync:flujo] error:", e); process.exit(1); })
  .finally(() => process.exit());
