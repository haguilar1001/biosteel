-- CreateTable
CREATE TABLE "Nomina" (
    "id" SERIAL NOT NULL,
    "anio" INTEGER NOT NULL,
    "cedula" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "proceso" TEXT NOT NULL,
    "cargo" TEXT NOT NULL,
    "empresa" TEXT NOT NULL,
    "ciudad" TEXT NOT NULL,
    "baseSalarial" DECIMAL(18,2) NOT NULL,
    "auxTransporte" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "noPrestacional" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "totalDevengado" DECIMAL(18,2) NOT NULL,
    "seguridadSocial" DECIMAL(18,2) NOT NULL,
    "prestaciones" DECIMAL(18,2) NOT NULL,
    "total" DECIMAL(18,2) NOT NULL,
    "tipoContrato" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Nomina_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Nomina_anio_idx" ON "Nomina"("anio");

-- CreateIndex
CREATE INDEX "Nomina_empresa_idx" ON "Nomina"("empresa");

-- CreateIndex
CREATE INDEX "Nomina_proceso_idx" ON "Nomina"("proceso");

-- CreateIndex
CREATE UNIQUE INDEX "Nomina_anio_cedula_key" ON "Nomina"("anio", "cedula");
