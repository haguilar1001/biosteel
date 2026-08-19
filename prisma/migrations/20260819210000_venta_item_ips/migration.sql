-- Consumo por item abierto por IPS: VentaItem no lleva cliente, asi que sin
-- esta tabla el informe de consumos no se puede filtrar por IPS ni ciudad.

CREATE TABLE "VentaItemIps" (
    "id" SERIAL NOT NULL,
    "anio" INTEGER NOT NULL,
    "mes" INTEGER NOT NULL,
    "marca" TEXT NOT NULL,
    "referencia" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "ips" TEXT NOT NULL,
    "nit" TEXT,
    "cantidad" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "valor" DECIMAL(18,2) NOT NULL,
    "costo" DECIMAL(18,2) NOT NULL DEFAULT 0,

    CONSTRAINT "VentaItemIps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VentaItemIps_anio_mes_marca_referencia_ips_key" ON "VentaItemIps"("anio", "mes", "marca", "referencia", "ips");

-- CreateIndex
CREATE INDEX "VentaItemIps_anio_mes_idx" ON "VentaItemIps"("anio", "mes");

-- CreateIndex
CREATE INDEX "VentaItemIps_ips_idx" ON "VentaItemIps"("ips");

-- CreateIndex
CREATE INDEX "VentaItemIps_marca_idx" ON "VentaItemIps"("marca");

-- CreateIndex
CREATE INDEX "VentaItemIps_nit_idx" ON "VentaItemIps"("nit");
