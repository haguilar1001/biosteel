# Mapeo SIESA → Flujo de Efectivo (importador)

> Estado: **borrador para validar con Héctor / oficina.** Basado en el análisis de las
> muestras 2026 en `muestras-siesa/` (gitignored). Ver memoria `biosteel-siesa-reportes`.

## 1. Destino: `MovimientoFlujo`

Cada fila de detalle de cada reporte se convierte en **un registro** de `MovimientoFlujo`
(ledger de caja denormalizado). Campos del modelo:

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `fecha` | Date | sí | Fecha del movimiento |
| `anio`, `mes` | Int | sí | Derivados de `fecha` |
| `tipo` | ingreso \| egreso | sí | **Constante por reporte** (ver §3) |
| `categoriaId` | FK CategoriaFlujo | no | Clasificación (ver §4, pendiente) |
| `terceroNombre` | String | sí | Nombre del tercero |
| `nit` | String | no | Solo disponible en Recaudos |
| `beneficiario` | String | no | Solo PEL |
| `detalle` | String | no | "Notas" del ERP |
| `observacion` | String | no | Documento / cuenta (trazabilidad) |
| `valor` | Decimal | sí | Valor del movimiento |
| `saldo` | Decimal | no | No viene en estos reportes → null |

## 2. Reglas de limpieza comunes

1. **Montos**: llegan como `"$1,716,357.00"` (símbolo `$`, coma de miles, punto decimal
   estilo US) o crudos `32891057.75`. Regla: quitar `$` y espacios, quitar comas, `Number()`.
2. **Fechas de datos**: la columna `Fecha` es **día primero** `DD/MM/AAAA` (`17/04/2026`,
   `6/01/2026` = 6-ene). ⚠️ NO confundir con las fechas de *creación/auditoría*
   (`1/14/26` = mes primero) — esas NO se importan.
3. **Layout pivote (NBA/NGC/OCC)**: no son tablas planas. Estructura por tercero:
   - Fila "Gran total" (col A = `Gran total`) → ignorar.
   - Fila encabezado de tercero (col A = nombre, cols B/C vacías, D/E = subtotal) →
     fija el `terceroNombre` actual; NO es un movimiento.
   - Filas de detalle (col A = `001` = C.O., col B = `XXX-#####`) → **un movimiento**;
     hereda el `terceroNombre` del último encabezado.
4. **Filtro de estado**: importar solo `Estado = Aprobado`. Excluir anulados
   (col `Usuario anulacion` / `Fecha anulacion` no vacías). En las muestras: 100% aprobados, 0 anulados.
5. **Valor = Crédito = Débito** en NBA/NGC/OCC (idénticos en toda fila) → usar `Credito PCGA`.
6. **C.O.** `001` = Oficina Principal (sede). `MovimientoFlujo` no tiene sede; se guarda en `observacion`.

## 3. Mapeo por reporte

### 3.1 OCC 2026 (INGRESOS) — `tipo = ingreso`
| Columna SIESA | → Campo | Regla |
|---|---|---|
| (encabezado de grupo) | `terceroNombre` | nombre del tercero del bloque |
| `Fecha` (C) | `fecha` → `anio`,`mes` | día primero |
| `Credito PCGA` (E) | `valor` | limpiar montos |
| `Notas` (P) | `detalle` | |
| `Documento` (B) + `C.O.` (A) | `observacion` | p.ej. `OCC-00002917 · C.O. 001` |
| — | `nit`, `beneficiario` | null |

### 3.2 Recaudos cxc (RDC) — `tipo = ingreso`
| Columna SIESA | → Campo | Regla |
|---|---|---|
| `Cliente` (E) = `NIT - Nombre` | `nit` + `terceroNombre` | **separar** por ` - ` (primer guion) |
| `Fecha` (C) | `fecha` | día primero |
| `Valor` (K) | `valor` | limpiar montos |
| `Documento` (A) + medio de pago (encabezado) | `detalle` | p.ej. `RDC-00003777 · CONSIGNACIONES BANCOLOMBIA` |
| `Cobrador` (G), `Cta Bancaria` (H), `F. Cons.` (I) | `observacion` | trazabilidad |

> **Único reporte que trae NIT.** Layout: agrupado por *medio de pago* (encabezados
> `[ CONSIGNACIONES … ]`); saltar filas de título/resumen/`Total`.

### 3.3 NGC 2026 — `tipo = egreso`
Mismo mapeo que OCC (§3.1) pero `tipo = egreso`. `terceroNombre` = encabezado de grupo
(proveedor / empleado / entidad). `detalle` = Notas (PAGO FACTURAS, PAGO NOMINA, …).

### 3.4 NBA 2026 — `tipo = egreso`
Mismo mapeo que NGC. `terceroNombre` = encabezado (normalmente el banco).
`detalle` = Notas (INTERESES, GASTOS BANCARIOS, DÉBITO PRÉSTAMO, …).

### 3.5 PEL 2026 — `tipo = egreso` (tabla plana)
| Columna SIESA | → Campo | Regla |
|---|---|---|
| `Razón social tercero` (G) | `terceroNombre` | |
| `Beneficiario` (H) | `beneficiario` | |
| `Fecha docto.` (D) | `fecha` | tomar solo la fecha (viene con `0:00`) |
| `Valor docto.` (E) | `valor` | limpiar montos |
| `Notas` (L) | `detalle` | |
| `Documento` (C) + `Descripción cuenta` (A) | `observacion` | banco pagador + doc |
| `Estado documento` (J) | filtro | solo `Aprobado` |

## 4. Categoría de flujo (`CategoriaFlujo`) — pendiente

Los reportes NO traen la categoría de flujo. Se puede **inferir de `Notas`** con un
diccionario de palabras clave, p.ej.:

| Palabra clave en Notas | Categoría sugerida | Tipo |
|---|---|---|
| PAGO NOMINA / PRIMAS / CESANTÍAS | Nómina y prestaciones | egreso |
| PAGO FACTURAS / COMPRA / ANTICIPO (proveedor) | Proveedores | egreso |
| INTERESES / GASTOS BANCARIOS / DÉBITO PRÉSTAMO | Financieros / bancarios | egreso |
| PAGO SERVICIO(S) | Servicios | egreso |
| APLICACIÓN PAGO / ABONO / RECAUDO | Recaudo de cartera | ingreso |
| PRÉSTAMO RECIBIDO | Financiación recibida | ingreso |

→ Definir el diccionario final con Héctor. V1 puede dejar `categoriaId = null` y clasificar después.

## 5. Decisiones y supuestos

1. ✅ **Solapamiento de INGRESOS** — RESUELTO (Héctor, 2026-08-11): OCC y Recaudos RDC son
   **excluyentes**. **Ingresos = OCC + Recaudos** (se suman, no se duplican).
2. ✅ **Solapamiento de EGRESOS** — RESUELTO: NGC, PEL y NBA son **excluyentes**.
   **Egresos = NGC + NBA + PEL** (se suman los tres).
3. **Supuesto — todo movimiento es caja real**: se importan TODAS las filas aprobadas
   (incl. `APLICACIÓN PAGO`, `CONTABILIZACIÓN PAGO`). Revisable si aparecen reclasificaciones
   que no son efectivo.
4. **Idempotencia**: llave única = `Documento` (`OCC-/NGC-/NBA-/PEL-/RDC-#####`), único por
   tipo de comprobante. Re-importar un archivo actualiza/omite duplicados por `Documento`.

## 6. Plan del importador (una vez resueltas §5)

1. Parser por reporte (detecta tipo por prefijo de `Documento` o por selección del usuario).
2. Normalización (montos, fechas día-primero, split NIT-nombre, flatten pivote).
3. **Vista previa + validación** antes de confirmar (filas OK / con error / duplicadas).
4. Carga a `MovimientoFlujo` con llave de idempotencia (§5.4).
5. Clasificación de `CategoriaFlujo` (§4).
