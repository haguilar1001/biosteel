-- CreateTable
CREATE TABLE "ParametroNotaCredito" (
    "id" SERIAL NOT NULL,
    "ips" TEXT NOT NULL,
    "concepto" TEXT NOT NULL,
    "pct" DECIMAL(7,4) NOT NULL,
    "fechaInicio" DATE NOT NULL,
    "fechaFin" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParametroNotaCredito_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExclusionNC" (
    "id" SERIAL NOT NULL,
    "nroDocumento" TEXT NOT NULL,
    "concepto" TEXT NOT NULL DEFAULT 'TODOS',
    "motivo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExclusionNC_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ParametroNotaCredito_ips_concepto_idx" ON "ParametroNotaCredito"("ips", "concepto");

-- CreateIndex
CREATE INDEX "ExclusionNC_nroDocumento_idx" ON "ExclusionNC"("nroDocumento");

-- CreateIndex
CREATE UNIQUE INDEX "ExclusionNC_nroDocumento_concepto_key" ON "ExclusionNC"("nroDocumento", "concepto");
