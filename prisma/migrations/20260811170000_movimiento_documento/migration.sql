-- Idempotencia del importador SIESA: nº de comprobante único por movimiento.
-- AlterTable
ALTER TABLE "MovimientoFlujo" ADD COLUMN "documento" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "MovimientoFlujo_documento_key" ON "MovimientoFlujo"("documento");
