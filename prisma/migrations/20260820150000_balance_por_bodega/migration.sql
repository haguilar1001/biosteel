-- El nuevo export de balance de SIESA abre el saldo por BODEGA (antes solo
-- llegaba hasta instalación) y agrega el saldo inicial en cantidad y el
-- consumo promedio diario. Verificado contra ene/feb/mar 2026: la suma por
-- bodega da exactamente el mismo total que el export viejo, y la llave
-- Bodega × Instalación × Ítem no repite.
--
-- Los meses ya cargados con el export viejo quedan con bodegaCodigo = '',
-- que es como se marca "este mes no tiene detalle por bodega".

-- AlterTable
ALTER TABLE "InvBalance" ADD COLUMN     "bodegaCodigo" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "cantInicial" DECIMAL(18,2) NOT NULL DEFAULT 0,
ADD COLUMN     "consumoDiario" DECIMAL(18,2) NOT NULL DEFAULT 0;

-- DropIndex
DROP INDEX "InvBalance_anio_mes_instalacion_item_key";

-- CreateIndex
CREATE UNIQUE INDEX "InvBalance_anio_mes_instalacion_bodegaCodigo_item_key" ON "InvBalance"("anio", "mes", "instalacion", "bodegaCodigo", "item");

-- CreateIndex
CREATE INDEX "InvBalance_bodegaCodigo_idx" ON "InvBalance"("bodegaCodigo");
