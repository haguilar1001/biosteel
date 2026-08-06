# 🛡️ BioSteel de Colombia S.A.S — Análisis de Seguridad y PRD de Mejoras

> **Documento:** Evaluación de vulnerabilidades y plan de aseguramiento
> **Aplicación:** BioSteel — Sistema de Flujo de Caja (Cartera, CxP, Recaudos, Pagos)
> **Stack evaluado:** Next.js (TypeScript) · Prisma · PostgreSQL · Railway · GitHub
> **Fase:** Diseño (pre-implementación) — *evaluación proactiva / seguridad desde el diseño*
> **Autor:** Análisis en rol de Ingeniería de Seguridad Senior
> **Versión:** 1.0 · **Fecha:** 2026-08-06
> **Clasificación del documento:** Confidencial — Interno

---

## 0. Resumen ejecutivo

BioSteel administrará información **financiera sensible** (saldos, cartera, cuentas por pagar) y **datos personales** de terceros (NIT, contactos de clínicas, EPS, cirujanos), lo que la convierte en un objetivo atractivo para fraude interno, robo de datos y manipulación de registros. Al estar en fase de diseño, tenemos la **oportunidad de construir la seguridad desde el origen**, que es entre 10 y 100 veces más barato que remediar después.

Este documento identifica **15 hallazgos/brechas de control** que deben cerrarse durante la construcción, y define un **PRD priorizado (P0/P1/P2)** para encaminarlos.

### Panorama de riesgo (brechas a cerrar en la construcción)

| Severidad | Cantidad | IDs |
|---|---|---|
| 🔴 **Crítica** | 3 | BIO-SEC-003, BIO-SEC-014, BIO-SEC-008 |
| 🟠 **Alta** | 5 | BIO-SEC-001, BIO-SEC-002, BIO-SEC-012, BIO-SEC-015, BIO-SEC-004 |
| 🟡 **Media** | 6 | BIO-SEC-005, BIO-SEC-006, BIO-SEC-007, BIO-SEC-010, BIO-SEC-011, BIO-SEC-009 |
| 🔵 **Baja** | 1 | BIO-SEC-013 |

> ⚠️ **Nota metodológica honesta:** la aplicación aún no existe, por lo que **no se ejecutó un pentest sobre un sistema en ejecución**. Los hallazgos representan **requisitos de control y riesgos de diseño** que, de no implementarse, se convertirían en vulnerabilidades reales. Una vez desplegado el MVP, se recomienda un pentest de verificación (ver §9).

---

## 1. Alcance y activos a proteger

### 1.1 Activos de información

| Activo | Sensibilidad | Impacto si se compromete |
|---|---|---|
| Saldos de cartera y CxP | Alta | Fraude, decisiones erróneas, fuga a competencia |
| Registros de recaudos/pagos | Crítica | Fraude financiero, lavado, desvío de fondos |
| Datos de terceros (NIT, contactos, cupos) | Alta (PII) | Incumplimiento Ley 1581, extorsión, phishing dirigido |
| Credenciales de usuarios | Crítica | Toma de cuentas, escalada de privilegios |
| Secretos de la app (DB, JWT, API SIESA) | Crítica | Compromiso total del sistema |
| Log de auditoría | Alta (integridad) | Encubrimiento de fraude |

### 1.2 Marco de referencia
- **OWASP Top 10 (2021)** — riesgos de aplicaciones web.
- **OWASP ASVS 4.0** — requisitos de verificación (nivel objetivo: **L2**).
- **STRIDE** — modelado de amenazas.
- **Ley 1581 de 2012** y **Decreto 1074 de 2015** (Colombia) — protección de datos personales / Habeas Data.
- **CIS Benchmarks** — endurecimiento de infraestructura.

### 1.3 Superficie de ataque
Internet (app pública en Railway) → Next.js (frontend + API routes/Server Actions) → Prisma → PostgreSQL. Vectores adicionales: importación de archivos Excel/CSV, futura integración con SIESA, dependencias npm, cuenta de Railway y repositorio GitHub.

---

## 2. Modelo de amenazas (STRIDE)

| Amenaza (STRIDE) | Escenario en BioSteel | Control principal |
|---|---|---|
| **S**poofing (suplantación) | Un atacante usa credenciales robadas de Tesorería | MFA, políticas de contraseña, bloqueo por intentos |
| **T**ampering (manipulación) | Alterar un saldo o una aplicación de recaudo | Autorización server-side, validación, auditoría inmutable, transacciones |
| **R**epudiation (repudio) | Un usuario niega haber anulado una factura | Log de auditoría con usuario, IP, antes/después |
| **I**nformation disclosure (fuga) | Exponer cartera de todos vía IDOR o API sin filtrar por sede | Control de acceso a nivel de objeto, filtrado por alcance |
| **D**enial of Service | Fuerza bruta al login, subida masiva de archivos | Rate limiting, límites de tamaño, WAF de Railway |
| **E**levation of privilege | Un vendedor accede a funciones de Administrador | RBAC deny-by-default verificado en el backend |

---

## 3. Evaluación contra OWASP Top 10 (2021)

| # | Riesgo OWASP | Relevancia BioSteel | Estado (diseño) | Prioridad |
|---|---|---|---|---|
| A01 | Broken Access Control | **Muy alta** — multi-rol, multi-sede, alcance "propio" para vendedor | A implementar | 🔴 P0 |
| A02 | Cryptographic Failures | Alta — contraseñas, secretos, PII, TLS | A implementar | 🔴 P0 |
| A03 | Injection (SQLi/XSS) | Media — Prisma parametriza; React escapa; falta validar entrada e importaciones | Parcialmente mitigado por stack | 🟠 P1 |
| A04 | Insecure Design | Alta — flujos financieros requieren controles de negocio | En curso (este documento) | 🟠 P1 |
| A05 | Security Misconfiguration | **Alta** — Railway, DB, cabeceras, CORS | A implementar | 🔴 P0 |
| A06 | Vulnerable & Outdated Components | Media — dependencias npm | A implementar | 🟡 P1 |
| A07 | Identification & Auth Failures | Alta — login, sesiones, MFA | A implementar | 🟠 P0 |
| A08 | Software & Data Integrity Failures | Media — CI/CD, dependencias, importación de datos | A implementar | 🟡 P1 |
| A09 | Security Logging & Monitoring | Alta — detección de fraude | A implementar | 🟠 P1 |
| A10 | SSRF | Baja — se eleva con conector SIESA (Fase 2) | Vigilar en Fase 2 | 🔵 P2 |

---

## 4. Registro de hallazgos priorizados

> Formato: **ID · Severidad · Riesgo → Impacto → Recomendación**. Cada control se traduce en requisitos del PRD (§7).

### 🔴 BIO-SEC-003 — Gestión insegura de secretos *(Crítica · A02/A05)*
- **Riesgo:** cadenas de conexión a PostgreSQL, secreto JWT y credenciales del ERP filtradas en el repositorio, en el bundle del cliente o en logs.
- **Impacto:** compromiso total de la base de datos y del sistema.
- **Recomendación:**
  - Todos los secretos en **variables de entorno de Railway** (nunca en el repo). `.env` en `.gitignore`; usar `.env.example` sin valores.
  - **Nunca** exponer secretos con el prefijo `NEXT_PUBLIC_`. Acceder a secretos solo en código de servidor.
  - Habilitar **escaneo de secretos** en GitHub (push protection) + **git-secrets**/gitleaks en pre-commit.
  - Rotación de secretos documentada; secreto JWT ≥ 256 bits aleatorio.

### 🔴 BIO-SEC-014 — Exposición/config. insegura de la base de datos *(Crítica · A05)*
- **Riesgo:** PostgreSQL de Railway accesible públicamente o con credenciales por defecto; usuario de app con privilegios de superusuario.
- **Impacto:** exfiltración o borrado de toda la información financiera.
- **Recomendación:**
  - Preferir **red privada de Railway** entre el servicio web y la DB; no exponer puerto público salvo necesidad puntual.
  - Usuario de aplicación con **privilegios mínimos** (sin `SUPERUSER`, sin DDL en runtime).
  - **TLS obligatorio** en la conexión (`sslmode=require`).
  - **Backups automáticos** verificados (ver BIO-SEC-012).

### 🔴 BIO-SEC-008 — Protección de datos personales (Ley 1581) *(Crítica-Legal · A02)*
- **Riesgo:** tratamiento de datos personales de terceros sin las medidas legales/técnicas exigidas en Colombia.
- **Impacto:** sanciones de la SIC (hasta 2.000 SMLMV), daño reputacional.
- **Recomendación:**
  - **Política de Tratamiento de Datos** y autorización del titular; registro en el **RNBD** de la SIC si aplica.
  - Minimización de datos (no almacenar más de lo necesario), cifrado y control de acceso.
  - Procedimiento de **derechos del titular** (consulta/reclamo) y retención/eliminación.

### 🟠 BIO-SEC-001 — Control de acceso a nivel de objeto (IDOR) *(Alta · A01)*
- **Riesgo:** que la API devuelva/edite un recurso (factura, recaudo) solo por su ID sin verificar que pertenece a la sede/alcance del usuario. Ej.: un vendedor cambia `?facturaId=123` y ve cartera ajena.
- **Impacto:** fuga de datos entre sedes/vendedores, manipulación de registros.
- **Recomendación:**
  - **Verificar propiedad/alcance en cada consulta del servidor** (filtro `WHERE sede_id IN (alcance_usuario)` / `vendedor_id = usuario`), no en el cliente.
  - Patrón: toda query de Prisma en API routes/Server Actions incluye el contexto de autorización. Deny-by-default.

### 🟠 BIO-SEC-002 — Autenticación débil / sin MFA *(Alta · A07)*
- **Riesgo:** solo usuario+contraseña, sin segundo factor ni políticas → toma de cuentas.
- **Impacto:** acceso no autorizado a funciones financieras.
- **Recomendación:**
  - **Argon2id** para hash de contraseñas (o bcrypt coste ≥ 12); nunca MD5/SHA sin sal.
  - **MFA (TOTP)** obligatorio para roles Administrador y Tesorería (el modelo ya contempla `doble_factor`).
  - Política de contraseñas (longitud ≥ 12, verificación contra listas filtradas), expiración de sesión, cierre de sesión.

### 🟠 BIO-SEC-004 — Ausencia de rate limiting / anti fuerza bruta *(Alta · A07/DoS)*
- **Riesgo:** login y endpoints sensibles sin límite de intentos.
- **Impacto:** fuerza bruta de credenciales, abuso, DoS.
- **Recomendación:** límite de intentos por IP/usuario con backoff, **bloqueo temporal** tras N fallos, CAPTCHA en el login tras umbral, rate limiting en API (middleware Next.js).

### 🟠 BIO-SEC-012 — Backups y recuperación no definidos *(Alta)*
- **Riesgo:** pérdida de datos por error, ransomware o fallo de Railway sin respaldo probado.
- **Impacto:** pérdida irreversible de cartera/tesorería.
- **Recomendación:** **backups automáticos diarios** cifrados, retención definida, **pruebas de restauración** periódicas, RPO/RTO documentados. Considerar respaldo externo fuera de Railway.

### 🟠 BIO-SEC-015 — Gestión de sesiones *(Alta · A07)*
- **Riesgo:** tokens de sesión mal manejados (JWT sin expiración, sin rotación, en `localStorage`).
- **Impacto:** secuestro de sesión, persistencia del atacante.
- **Recomendación:** sesiones en **cookies `HttpOnly` + `Secure` + `SameSite=Lax/Strict`**; expiración corta + refresh con rotación; invalidación en logout y en cambio de contraseña. Usar librería probada (Auth.js/NextAuth o Lucia).

### 🟡 BIO-SEC-005 — Validación de entrada / Injection *(Media · A03)*
- **Riesgo:** aunque Prisma parametriza (mitiga SQLi) y React escapa (mitiga XSS), entrada sin validar puede causar errores lógicos, XSS en campos libres o inyección si se usa `$queryRaw`.
- **Recomendación:** **validación con Zod** en todos los límites (API, Server Actions); evitar `dangerouslySetInnerHTML`; usar `$queryRaw` solo parametrizado; sanitizar campos de texto libre.

### 🟡 BIO-SEC-006 — CSRF *(Media · A01)*
- **Riesgo:** peticiones de cambio de estado (registrar pago, anular) forjadas desde otro sitio.
- **Recomendación:** tokens anti-CSRF / `SameSite` en cookies; Server Actions de Next.js con verificación de origen; no aceptar cambios de estado por GET.

### 🟡 BIO-SEC-007 — Logging y monitoreo insuficientes *(Media · A09)*
- **Riesgo:** no detectar accesos anómalos, fraude o intrusiones.
- **Recomendación:** **log de auditoría inmutable** (usuario, acción, entidad, valor anterior/nuevo, IP, timestamp) para toda operación financiera; alertas ante eventos críticos (múltiples fallos de login, cambios de rol, anulaciones); **no registrar** secretos ni contraseñas.

### 🟡 BIO-SEC-010 — Cabeceras de seguridad / CSP ausentes *(Media · A05)*
- **Riesgo:** clickjacking, XSS, sniffing.
- **Recomendación:** configurar en `next.config.js`/middleware: **CSP**, `Strict-Transport-Security` (HSTS), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`.

### 🟡 BIO-SEC-011 — Importación de archivos Excel/CSV *(Media · A03/A08)*
- **Riesgo:** **CSV/Formula Injection** (celdas que empiezan por `=,+,-,@` ejecutan fórmulas al abrir en Excel), archivos malformados que causan DoS, o datos maliciosos.
- **Recomendación:** validar tipo/tamaño; parsear en servidor con librería robusta; **neutralizar fórmulas** al exportar (prefijar `'`); límites de filas; previsualización antes de confirmar; no ejecutar contenido del archivo.

### 🟡 BIO-SEC-009 — Dependencias y cadena de suministro *(Media · A06/A08)*
- **Riesgo:** paquetes npm vulnerables o maliciosos.
- **Recomendación:** **Dependabot** + `npm audit` en CI; fijar versiones (`package-lock.json`); revisar dependencias nuevas; evitar paquetes sin mantenimiento; considerar SBOM.

### 🔵 BIO-SEC-013 — Cifrado en reposo de campos sensibles *(Baja)*
- **Riesgo:** datos sensibles legibles a nivel de DB si se compromete un backup.
- **Recomendación:** cifrado en reposo del volumen (Railway) + cifrado a nivel de aplicación para campos muy sensibles si se añaden (p. ej. datos bancarios de terceros).

---

## 5. Controles recomendados por capa (arquitectura de defensa en profundidad)

```
Internet
  │
  ├─ [TLS/HTTPS obligatorio · HSTS]                 ← A02
  ▼
Next.js (Edge/Middleware)
  ├─ Rate limiting · anti fuerza bruta              ← BIO-SEC-004
  ├─ Cabeceras de seguridad · CSP                   ← BIO-SEC-010
  ├─ Autenticación (Auth.js/Lucia · MFA)            ← BIO-SEC-002/015
  ▼
API Routes / Server Actions
  ├─ Validación de entrada (Zod)                    ← BIO-SEC-005
  ├─ Autorización RBAC deny-by-default + alcance    ← BIO-SEC-001
  ├─ Protección CSRF                                ← BIO-SEC-006
  ├─ Log de auditoría inmutable                     ← BIO-SEC-007
  ▼
Prisma (ORM · queries parametrizadas)              ← A03
  ▼
PostgreSQL (Railway)
  ├─ Red privada · TLS · usuario mínimo             ← BIO-SEC-014
  ├─ Backups cifrados + pruebas de restore          ← BIO-SEC-012
  └─ Cifrado en reposo                              ← BIO-SEC-013

Transversal: gestión de secretos (BIO-SEC-003) · Dependabot/CI (BIO-SEC-009) · Ley 1581 (BIO-SEC-008)
```

---

## 6. Cumplimiento legal (Colombia)

| Requisito | Acción |
|---|---|
| **Ley 1581 de 2012** (Habeas Data) | Política de tratamiento de datos, autorización del titular, finalidad definida |
| **Decreto 1074 de 2015** | Medidas técnicas y organizativas de seguridad de la información |
| **Registro RNBD (SIC)** | Evaluar si aplica por volumen/activos; registrar bases de datos personales |
| **Derechos del titular** | Procedimiento de consulta, actualización, rectificación y supresión |
| **Facturación electrónica (DIAN)** | La emite el ERP (SIESA); BioSteel solo consume — sin obligación directa, pero conservar integridad de datos importados |

---

## 7. PRD — Plan de aseguramiento

### 7.1 Objetivo
Construir BioSteel cumpliendo **OWASP ASVS Nivel 2** y la Ley 1581, incorporando los controles de seguridad como **requisitos funcionales del producto** desde el primer sprint, no como un añadido posterior.

### 7.2 Métricas de éxito (KPIs de seguridad)
- **100 %** de endpoints con autorización server-side verificada.
- **0** secretos en el repositorio (validado por escaneo en CI).
- **100 %** de operaciones financieras con registro en auditoría.
- **MFA activo** en el 100 % de cuentas Administrador/Tesorería.
- **0** dependencias con vulnerabilidad crítica/alta sin remediar en `main`.
- Backup restaurado con éxito en simulacro **trimestral**.

### 7.3 Requisitos por prioridad

#### 🔴 P0 — Fundacionales (Sprint 0–1, previos a manejar datos reales)

| Req | Historia de usuario | Criterios de aceptación | Hallazgo |
|---|---|---|---|
| P0-1 | Como sistema, gestiono secretos de forma segura | Secretos solo en env de Railway; `.env` ignorado; escaneo de secretos en CI bloquea el push | BIO-SEC-003 |
| P0-2 | Como sistema, protejo la base de datos | DB en red privada; TLS `require`; usuario app sin superusuario | BIO-SEC-014 |
| P0-3 | Como usuario, inicio sesión de forma segura | Argon2id; política de contraseña; rate limiting + bloqueo por intentos | BIO-SEC-002/004 |
| P0-4 | Como sistema, autorizo cada acción por rol y alcance | RBAC deny-by-default; toda query filtra por sede/alcance; pruebas de IDOR pasan | BIO-SEC-001 |
| P0-5 | Como sistema, manejo sesiones seguras | Cookies HttpOnly/Secure/SameSite; expiración + rotación; logout invalida | BIO-SEC-015 |
| P0-6 | Como responsable, cumplo Ley 1581 | Política de tratamiento publicada; autorización capturada; minimización aplicada | BIO-SEC-008 |

**Definition of Done P0:** ningún dato real de BioSteel entra al sistema hasta que P0-1…P0-6 estén verificados.

#### 🟠 P1 — Endurecimiento (Sprint 2–3)

| Req | Descripción | Criterios de aceptación | Hallazgo |
|---|---|---|---|
| P1-1 | Auditoría inmutable | Toda operación financiera registra usuario/IP/antes-después; log no editable | BIO-SEC-007 |
| P1-2 | Validación de entrada | Esquemas Zod en todos los límites; rechazo de entrada inválida | BIO-SEC-005 |
| P1-3 | Cabeceras + CSP | Escaneo (securityheaders.com) ≥ A; CSP sin `unsafe-inline` innecesario | BIO-SEC-010 |
| P1-4 | Protección CSRF | Cambios de estado protegidos; sin mutaciones por GET | BIO-SEC-006 |
| P1-5 | Importación segura | Validación de archivos; neutralización de fórmulas; límites y previsualización | BIO-SEC-011 |
| P1-6 | MFA obligatorio | TOTP forzado para Admin/Tesorería | BIO-SEC-002 |
| P1-7 | Backups probados | Backup diario cifrado; restauración simulada documentada | BIO-SEC-012 |

#### 🟡 P2 — Madurez continua (post-MVP)

| Req | Descripción | Hallazgo |
|---|---|---|
| P2-1 | Dependabot + `npm audit` en CI; SBOM | BIO-SEC-009 |
| P2-2 | Monitoreo/alertas de eventos de seguridad | BIO-SEC-007 |
| P2-3 | Cifrado a nivel de app para campos muy sensibles | BIO-SEC-013 |
| P2-4 | Revisar SSRF al integrar conector SIESA | A10 |
| P2-5 | Pentest de verificación externo | §9 |

### 7.4 Roadmap

```
Sprint 0  ──▶  Sprint 1  ──▶  Sprint 2-3  ──▶  Post-MVP
Baseline       Auth + RBAC     Auditoría,        Monitoreo,
seguro         + Ley 1581      validación,       dependencias,
(P0-1,2)       (P0-3..6)       MFA, backups,     pentest
                               cabeceras (P1)    (P2)
   │                                                │
   └──────────── "Shift-left": seguridad en cada PR ┘
```

### 7.5 Definition of Done de seguridad (por cada funcionalidad)
- [ ] Autorización server-side verificada (rol + alcance).
- [ ] Entrada validada con Zod.
- [ ] Operación sensible registrada en auditoría.
- [ ] Sin secretos en código; `npm audit` limpio.
- [ ] Revisión de seguridad en el PR (`/security-review`).

---

## 8. Checklist de despliegue seguro (Railway)

- [ ] Variables de entorno configuradas en Railway (no en el repo).
- [ ] PostgreSQL en red privada; puerto público cerrado; TLS `require`.
- [ ] Usuario de DB con privilegios mínimos.
- [ ] Backups automáticos activados y **restauración probada**.
- [ ] 2FA activo en las cuentas de Railway y GitHub del equipo.
- [ ] Push protection / secret scanning activo en GitHub.
- [ ] Dependabot activo.
- [ ] HTTPS forzado; HSTS; cabeceras de seguridad verificadas.
- [ ] Dominio y certificados válidos.
- [ ] Logs sin datos sensibles; retención definida.
- [ ] Rama `main` protegida (PR + revisión obligatoria).

---

## 9. Recomendaciones de verificación (post-MVP)
1. **Pentest de aplicación** una vez desplegado el MVP (validar IDOR, auth, sesiones en ejecución).
2. **Revisión de código de seguridad** en cada PR con `/security-review`.
3. **Escaneo automatizado** (SAST/DAST) en CI.
4. **Simulacro de restauración** de backups trimestral.
5. **Revisión de accesos** (usuarios/roles) trimestral.

---

## 10. Conclusión

La arquitectura elegida (Next.js + Prisma + PostgreSQL) **parte con ventajas**: Prisma mitiga inyección SQL y React mitiga XSS por defecto. El riesgo real se concentra en **control de acceso (multi-sede/rol), autenticación, gestión de secretos, configuración de infraestructura y cumplimiento de la Ley 1581**. Ejecutando el **PRD P0 antes de cargar datos reales**, BioSteel arrancará con una postura de seguridad sólida y madurará de forma continua.

> **Próximo paso recomendado:** implementar el **baseline P0** junto con el scaffolding inicial de Next.js + Prisma, de modo que la seguridad nazca con el código.

---
*Documento vivo — se actualiza a medida que la aplicación evoluciona. BioSteel de Colombia S.A.S · Confidencial.*
