-- CreateTable
CREATE TABLE "IndicadorCompraMes" (
    "id" SERIAL NOT NULL,
    "anio" INTEGER NOT NULL,
    "mes" INTEGER NOT NULL,
    "ordenesCompletas" INTEGER NOT NULL DEFAULT 0,
    "ordenesTotales" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "IndicadorCompraMes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProveedorActivo" (
    "razonSocial" TEXT NOT NULL,
    "fichaTecnica" BOOLEAN NOT NULL DEFAULT false,
    "evaluacionInicial" BOOLEAN NOT NULL DEFAULT false,
    "seguimiento" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ProveedorActivo_pkey" PRIMARY KEY ("razonSocial")
);

-- CreateTable
CREATE TABLE "EvaluacionProveedor" (
    "id" SERIAL NOT NULL,
    "anio" INTEGER NOT NULL,
    "mes" INTEGER NOT NULL,
    "proveedor" TEXT NOT NULL,
    "calidad" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "tiempos" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "cantidad" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "precio" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "postventa" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "seguimiento" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "pct" DECIMAL(6,2) NOT NULL DEFAULT 0,

    CONSTRAINT "EvaluacionProveedor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IndicadorCompraMes_anio_idx" ON "IndicadorCompraMes"("anio");

-- CreateIndex
CREATE UNIQUE INDEX "IndicadorCompraMes_anio_mes_key" ON "IndicadorCompraMes"("anio", "mes");

-- CreateIndex
CREATE INDEX "EvaluacionProveedor_anio_mes_idx" ON "EvaluacionProveedor"("anio", "mes");

-- CreateIndex
CREATE INDEX "EvaluacionProveedor_proveedor_idx" ON "EvaluacionProveedor"("proveedor");

-- CreateIndex
CREATE UNIQUE INDEX "EvaluacionProveedor_anio_mes_proveedor_key" ON "EvaluacionProveedor"("anio", "mes", "proveedor");

