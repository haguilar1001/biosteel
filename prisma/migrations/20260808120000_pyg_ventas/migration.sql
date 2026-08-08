-- CreateTable
CREATE TABLE "VentaLinea" (
    "id" SERIAL NOT NULL,
    "anio" INTEGER NOT NULL,
    "mes" INTEGER NOT NULL,
    "linea" TEXT NOT NULL,
    "valor" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "VentaLinea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VentaCliente" (
    "id" SERIAL NOT NULL,
    "anio" INTEGER NOT NULL,
    "mes" INTEGER NOT NULL,
    "clienteNombre" TEXT NOT NULL,
    "nit" TEXT,
    "valor" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "VentaCliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EstadoResultados" (
    "id" SERIAL NOT NULL,
    "anio" INTEGER NOT NULL,
    "mes" INTEGER NOT NULL,
    "ventasNetas" DECIMAL(18,2) NOT NULL,
    "costoVenta" DECIMAL(18,2) NOT NULL,
    "utilidadBruta" DECIMAL(18,2) NOT NULL,
    "gastosOperacionales" DECIMAL(18,2) NOT NULL,
    "utilidadOperacional" DECIMAL(18,2) NOT NULL,
    "ingresosNoOp" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "egresosNoOp" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "utilidadNeta" DECIMAL(18,2) NOT NULL,
    "detalle" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EstadoResultados_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VentaLinea_anio_mes_idx" ON "VentaLinea"("anio", "mes");

-- CreateIndex
CREATE UNIQUE INDEX "VentaLinea_anio_mes_linea_key" ON "VentaLinea"("anio", "mes", "linea");

-- CreateIndex
CREATE INDEX "VentaCliente_anio_mes_idx" ON "VentaCliente"("anio", "mes");

-- CreateIndex
CREATE UNIQUE INDEX "VentaCliente_anio_mes_clienteNombre_key" ON "VentaCliente"("anio", "mes", "clienteNombre");

-- CreateIndex
CREATE INDEX "EstadoResultados_anio_mes_idx" ON "EstadoResultados"("anio", "mes");

-- CreateIndex
CREATE UNIQUE INDEX "EstadoResultados_anio_mes_key" ON "EstadoResultados"("anio", "mes");
