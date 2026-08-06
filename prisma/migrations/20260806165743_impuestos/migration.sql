-- CreateTable
CREATE TABLE "ImpuestoMensual" (
    "id" SERIAL NOT NULL,
    "entidad" TEXT NOT NULL DEFAULT 'BioSteel',
    "anio" INTEGER NOT NULL,
    "mes" INTEGER NOT NULL,
    "fecha" DATE NOT NULL,
    "retencion" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "iva" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "ica" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "renta" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "granTotal" DECIMAL(18,2),
    "vencimiento" DATE,

    CONSTRAINT "ImpuestoMensual_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ImpuestoMensual_anio_mes_idx" ON "ImpuestoMensual"("anio", "mes");

-- CreateIndex
CREATE UNIQUE INDEX "ImpuestoMensual_entidad_anio_mes_key" ON "ImpuestoMensual"("entidad", "anio", "mes");
