-- CreateTable
CREATE TABLE "VentaMarca" (
    "id" SERIAL NOT NULL,
    "anio" INTEGER NOT NULL,
    "mes" INTEGER NOT NULL,
    "marca" TEXT NOT NULL,
    "valor" DECIMAL(18,2) NOT NULL,
    "costo" DECIMAL(18,2) NOT NULL DEFAULT 0,

    CONSTRAINT "VentaMarca_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VentaMarca_anio_mes_idx" ON "VentaMarca"("anio", "mes");

-- CreateIndex
CREATE UNIQUE INDEX "VentaMarca_anio_mes_marca_key" ON "VentaMarca"("anio", "mes", "marca");
