-- CreateTable
CREATE TABLE "Cirugia" (
    "id" SERIAL NOT NULL,
    "nroDocumento" TEXT NOT NULL,
    "numeroCaso" TEXT,
    "fecha" TIMESTAMP(3),
    "anio" INTEGER NOT NULL,
    "mes" INTEGER NOT NULL,
    "dia" INTEGER NOT NULL,
    "co" TEXT,
    "convenio" TEXT,
    "asesor" TEXT NOT NULL,
    "sinSoporte" BOOLEAN NOT NULL DEFAULT false,
    "ips" TEXT NOT NULL,
    "ciudad" TEXT,
    "grupo" TEXT,
    "medico" TEXT,
    "minutos" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Cirugia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Cirugia_nroDocumento_key" ON "Cirugia"("nroDocumento");

-- CreateIndex
CREATE INDEX "Cirugia_anio_mes_idx" ON "Cirugia"("anio", "mes");

-- CreateIndex
CREATE INDEX "Cirugia_asesor_idx" ON "Cirugia"("asesor");

-- CreateIndex
CREATE INDEX "Cirugia_ips_idx" ON "Cirugia"("ips");

-- CreateIndex
CREATE INDEX "Cirugia_sinSoporte_idx" ON "Cirugia"("sinSoporte");

