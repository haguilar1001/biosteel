-- Consumo por ítem: referencia/cantidad en VentaDoc + agregado VentaItem.

-- AlterTable
ALTER TABLE "VentaDoc" ADD COLUMN     "referencia" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "cantidad" DECIMAL(18,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "VentaItem" (
    "id" SERIAL NOT NULL,
    "anio" INTEGER NOT NULL,
    "mes" INTEGER NOT NULL,
    "marca" TEXT NOT NULL,
    "referencia" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "cantidad" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "valor" DECIMAL(18,2) NOT NULL,
    "costo" DECIMAL(18,2) NOT NULL DEFAULT 0,

    CONSTRAINT "VentaItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VentaItem_anio_mes_marca_referencia_key" ON "VentaItem"("anio", "mes", "marca", "referencia");

-- CreateIndex
CREATE INDEX "VentaItem_anio_mes_idx" ON "VentaItem"("anio", "mes");

-- CreateIndex
CREATE INDEX "VentaItem_marca_idx" ON "VentaItem"("marca");
