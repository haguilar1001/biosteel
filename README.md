# 🦴 BioSteel de Colombia S.A.S — Sistema de Flujo de Caja

Aplicación web para el control de **flujo de caja**: Cartera (CxC), Cuentas por Pagar (CxP), recaudos, pagos y retenciones. Se alimenta del ERP (SIESA) mediante importación; BioSteel es la fuente de verdad de recaudos, pagos, aplicaciones, notas, glosas y flujo proyectado.

## Stack

| Capa | Tecnología |
|---|---|
| Framework | Next.js 15 (App Router, TypeScript) |
| ORM / DB | Prisma + PostgreSQL |
| Auth | Sesiones propias + Argon2id + MFA (TOTP) |
| Validación | Zod |
| Despliegue | Railway |
| Repositorio | GitHub |

## 🔐 Baseline de seguridad P0 (implementado en este esqueleto)

Este proyecto nace con los controles **P0** del [análisis de seguridad](seguridad/ANALISIS-SEGURIDAD.md):

- **BIO-SEC-003** — Secretos solo en variables de entorno. `.env` en `.gitignore`; `.env.example` sin valores.
- **BIO-SEC-002/004** — Contraseñas con **Argon2id**, política de complejidad, **rate limiting** por IP y **bloqueo por intentos** fallidos.
- **BIO-SEC-015** — Sesiones en **cookies `HttpOnly` + `Secure` + `SameSite`**, token opaco (hash en BD), expiración deslizante con rotación.
- **BIO-SEC-001** — **RBAC deny-by-default** con alcance (`todos` / `propio` / `ninguno`) y filtro por sede/vendedor para prevenir IDOR.
- **BIO-SEC-010** — Cabeceras de seguridad + CSP en `middleware.ts`.
- **BIO-SEC-006** — Verificación de origen en Server Actions.
- **BIO-SEC-007** — Utilidad de **auditoría** para operaciones sensibles.
- **BIO-SEC-005** — Validación de entrada con **Zod** en los límites.

> ⚠️ **Regla del PRD:** no cargar datos reales de BioSteel hasta completar y verificar el baseline P0.

## Puesta en marcha (local)

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar entorno
cp .env.example .env      # y completar DATABASE_URL, etc.

# 3. Crear la base de datos y las tablas
npm run prisma:migrate

# 4. Cargar datos base (monedas, sedes, roles, permisos, admin)
npm run db:seed

# 5. Levantar en desarrollo
npm run dev
```

App en `http://localhost:3000`. Inicia sesión con el usuario admin definido en `.env` (`SEED_ADMIN_*`) y **cambia la contraseña de inmediato**.

## Estructura

```
prisma/
  schema.prisma      Modelo de datos (Fase 1)
  seed.ts            Datos base + admin inicial
src/
  app/               Rutas (App Router): login, dashboard, api
  lib/
    auth/            Contraseñas, sesiones, rate limit, MFA
    rbac/            Permisos y autorización (deny-by-default)
    validation/      Esquemas Zod
    audit/           Registro de auditoría
    env.ts           Validación de variables de entorno
    db.ts            Cliente Prisma (singleton)
    format.ts        Formato es-CO ($ 1.234.567 · 45,50 %)
  server/            Helpers de contexto de sesión/autorización
middleware.ts        Cabeceras de seguridad, CSP y gating de auth
```

## Despliegue en Railway

Ver checklist completo en [seguridad/ANALISIS-SEGURIDAD.md §8](seguridad/ANALISIS-SEGURIDAD.md). Resumen:

1. Provisionar PostgreSQL (red privada, TLS `require`).
2. Configurar variables de entorno en el panel (no en el repo).
3. `Build`: `npm run build` · `Start`: `npm run start`.
4. Ejecutar `npm run prisma:deploy` en el release.
5. Activar backups, 2FA de la cuenta y secret scanning en GitHub.

## Roadmap

- **Fase 1** (actual): flujo de caja — cartera, CxP, recaudos, pagos.
- **Fase 2**: inventario por sede, lotes y trazabilidad (consignación ya marcada en el modelo).

---
*BioSteel de Colombia S.A.S · Confidencial.*
