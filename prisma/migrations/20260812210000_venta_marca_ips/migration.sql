-- CreateTable
CREATE TABLE "VentaMarcaIps" (
    "id" SERIAL NOT NULL,
    "anio" INTEGER NOT NULL,
    "mes" INTEGER NOT NULL,
    "marca" TEXT NOT NULL,
    "ips" TEXT NOT NULL,
    "valor" DECIMAL(18,2) NOT NULL,
    "costo" DECIMAL(18,2) NOT NULL DEFAULT 0,

    CONSTRAINT "VentaMarcaIps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VentaMarcaIps_anio_mes_idx" ON "VentaMarcaIps"("anio", "mes");

-- CreateIndex
CREATE INDEX "VentaMarcaIps_marca_idx" ON "VentaMarcaIps"("marca");

-- CreateIndex
CREATE UNIQUE INDEX "VentaMarcaIps_anio_mes_marca_ips_key" ON "VentaMarcaIps"("anio", "mes", "marca", "ips");
