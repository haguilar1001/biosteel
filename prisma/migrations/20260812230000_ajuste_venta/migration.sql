-- CreateTable
CREATE TABLE "AjusteVenta" (
    "id" SERIAL NOT NULL,
    "anio" INTEGER NOT NULL,
    "mes" INTEGER NOT NULL,
    "concepto" TEXT NOT NULL DEFAULT 'AJUSTE',
    "valor" DECIMAL(18,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AjusteVenta_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AjusteVenta_anio_idx" ON "AjusteVenta"("anio");
