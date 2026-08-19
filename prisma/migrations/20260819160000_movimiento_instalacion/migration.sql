-- Los export de movimientos por mes traen su propia columna "Instalación".
-- Es más confiable que deducirla de la bodega: ya reveló que la bodega 106
-- (Selsalud Yopal) está catalogada como 101 pero SIESA la reporta en 102.
-- Nullable porque el export consolidado viejo no trae la columna.

-- AlterTable
ALTER TABLE "InvMovimiento" ADD COLUMN     "instalacion" INTEGER;

-- CreateIndex
CREATE INDEX "InvMovimiento_instalacion_idx" ON "InvMovimiento"("instalacion");
