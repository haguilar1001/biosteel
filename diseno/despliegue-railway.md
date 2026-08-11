# Despliegue en Railway — BioSteel

> Guía práctica alineada con `railway.json` y `.env.example` del repo.
> Complementa el checklist §8 de `seguridad/ANALISIS-SEGURIDAD.md`.

El repo ya trae la automatización lista (`railway.json`):
- **build**: `npm run build` (= `prisma generate && next build`)
- **preDeploy**: `npx prisma migrate deploy` (aplica migraciones)
- **start**: `npm run start`

## 1. Crear el proyecto y la base de datos
1. En [railway.app](https://railway.app): **New Project → Deploy from GitHub repo** → `haguilar1001/biosteel`.
2. En el mismo proyecto: **New → Database → PostgreSQL**.
3. (Recomendado) Deja que la app y Postgres queden en el mismo proyecto para usar la **red privada**.

## 2. Variables de entorno (servicio de la app → Variables)
| Variable | Valor | Nota |
|---|---|---|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` | Referencia a la BD del proyecto (Railway la resuelve) |
| `APP_URL` | `https://<tu-app>.up.railway.app` | ⚠️ **Crítico**: sin esto, los Server Actions fallan por verificación de origen (CSRF) |
| `SEED_ADMIN_EMAIL` | correo del admin | solo lo usa `db:seed` |
| `SEED_ADMIN_PASSWORD` | clave fuerte | cámbiala tras el 1er login |
| `SEED_ADMIN_NOMBRE` | nombre del admin | |
| `CRON_SECRET` | cadena aleatoria larga | protege `/api/notificaciones/run` |
| `BREVO_API_KEY`, `SMTP_FROM`, `NOTIF_EMAILS`, `NOTIF_DIAS_ANTES` | opcional | correo de recordatorios (ver `.env.example`) |

⚠️ **No definas `NODE_ENV`**: `next start` ya usa `production` (así se activan HSTS y la CSP estricta). Ponerlo en `development` debilitaría la seguridad.

## 3. Primer despliegue
1. Asegúrate de que Postgres exista y `DATABASE_URL` esté seteada **antes** del primer build.
2. Railway construye y despliega solo. `preDeploy` aplica las migraciones (incluida la de `MovimientoFlujo.documento`).
3. **Genera el dominio**: servicio → **Settings → Networking → Generate Domain**. Copia esa URL a `APP_URL` y **vuelve a desplegar** (redeploy) para que tome efecto.

## 4. Sembrar los datos base (una sola vez)
Las migraciones crean el **esquema**, pero no los datos. Corre el seed una vez para crear
monedas, sedes, roles, **permisos** (incl. `flujo.manage`), **categorías de flujo** y el
usuario administrador. Es **idempotente** (upsert, no borra nada):

```bash
# En tu equipo, con Railway CLI, contra el entorno del proyecto:
railway login
railway link            # elige el proyecto BioSteel
railway run npm run db:seed
```

⚠️ **Gotcha**: `railway run` inyecta la `DATABASE_URL` **privada** (`postgres.railway.internal`),
que no es alcanzable desde tu equipo. Si la conexión falla, copia la **URL pública** del
servicio Postgres (variable `DATABASE_PUBLIC_URL` en Railway) y corre el seed apuntando a ella:

```bash
DATABASE_URL="postgresql://...proxy.rlwy.net:PUERTO/railway" npm run db:seed
```

## 5. Puesta en marcha
1. Entra a `https://<tu-app>.up.railway.app` con `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`.
2. **Cambia la contraseña** del admin (Perfil → Cambiar contraseña).
3. Crea los usuarios reales y asigna roles (Administración ▸ Usuarios / Roles).
4. Prueba el **importador**: Flujo de Caja ▸ Importar SIESA (el permiso `flujo.manage` ya viene del seed).

## 6. Notificaciones automáticas (opcional)
- Configura correo (`BREVO_API_KEY` recomendado; el SMTP suele bloquearse en hosting).
- Programa un **cron** (Railway → Cron o un servicio externo) que llame:
  `POST https://<tu-app>.up.railway.app/api/notificaciones/run` con el header/secreto `CRON_SECRET`.

## 7. Checklist de seguridad (ref. §8 del análisis)
- [x] HTTPS y dominio (Railway lo da) · HSTS activo en producción.
- [ ] **Backups de Postgres**: habilitar snapshots/backup automático en Railway.
- [ ] Rotar `SEED_ADMIN_PASSWORD` tras el primer ingreso.
- [ ] Revisar que `.env` **nunca** se suba (ya está en `.gitignore`).
- [ ] Completar controles P1 (MFA obligatorio, auditoría en todas las operaciones).

## Problemas comunes
- **Server Action rechazada / “Invalid origin”** → `APP_URL` no coincide con el dominio real. Ajusta y redepliega.
- **Login sin usuarios / “credenciales inválidas”** → falta correr `db:seed` (paso 4).
- **Build falla en `prisma`** → falta `DATABASE_URL` o Postgres no está en el proyecto.
- **No llegan correos** → sin `BREVO_API_KEY`; el SMTP saliente suele estar bloqueado por el hosting.
