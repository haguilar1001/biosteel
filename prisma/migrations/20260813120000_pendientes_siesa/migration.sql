-- Módulo PENDIENTES — datasets crudos de S1ESA cargados por formulario.

-- CreateTable
CREATE TABLE "FacturacionDoc" (
    "id" SERIAL NOT NULL,
    "nroDocumento" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "anio" INTEGER NOT NULL,
    "mes" INTEGER NOT NULL,
    "estado" TEXT NOT NULL,
    "clienteRazon" TEXT NOT NULL,
    "costoPromedio" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "subtotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "impuestos" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "neto" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "utilidadPromedio" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "sucursal" TEXT,
    "notasCredito" TEXT,
    "pedidos" TEXT,
    "usuarioAprobacion" TEXT,
    "convenio" TEXT,
    "fechaCx" DATE,

    CONSTRAINT "FacturacionDoc_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GastoDoc" (
    "id" SERIAL NOT NULL,
    "nroDocumento" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "anio" INTEGER NOT NULL,
    "mes" INTEGER NOT NULL,
    "estado" TEXT NOT NULL,
    "clienteRazon" TEXT NOT NULL,
    "sucursal" TEXT,
    "subtotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "valorBruto" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "impuestos" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "fechaAprobacion" DATE,
    "fechaCumplido" DATE,
    "diasFacturacion" INTEGER,
    "usuarioAprobacion" TEXT,
    "fechaCx" DATE,
    "convenio" TEXT,
    "numeroCaso" TEXT,
    "estadoPedidos" TEXT,

    CONSTRAINT "GastoDoc_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FacturaAnulada" (
    "id" SERIAL NOT NULL,
    "nroDocumento" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "anio" INTEGER NOT NULL,
    "mes" INTEGER NOT NULL,
    "clienteRazon" TEXT NOT NULL,
    "subtotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "numeroCaso" TEXT,
    "paciente" TEXT,
    "sucursal" TEXT,
    "doc" TEXT,
    "nFactura" TEXT,
    "usuarioAprobacion" TEXT,
    "fechaFacturaBase" DATE,
    "motivo" TEXT,
    "descripcion" TEXT,
    "responsable" TEXT,

    CONSTRAINT "FacturaAnulada_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PedidoPendiente" (
    "id" SERIAL NOT NULL,
    "nroDocumento" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "anio" INTEGER NOT NULL,
    "mes" INTEGER NOT NULL,
    "estado" TEXT NOT NULL,
    "clienteRazon" TEXT NOT NULL,
    "sucursal" TEXT,
    "subtotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "valorBruto" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "impuestos" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "fechaAprobacion" DATE,
    "fechaCumplido" DATE,
    "usuarioAprobacion" TEXT,
    "fechaCx" DATE,
    "convenio" TEXT,
    "numeroCaso" TEXT,
    "motivoPendiente" TEXT,
    "responsable" TEXT,

    CONSTRAINT "PedidoPendiente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CargaSiesa" (
    "id" SERIAL NOT NULL,
    "cargadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ok" BOOLEAN NOT NULL DEFAULT true,
    "resumen" JSONB NOT NULL,
    "mensaje" TEXT,
    "origenIp" TEXT,

    CONSTRAINT "CargaSiesa_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FacturacionDoc_anio_mes_idx" ON "FacturacionDoc"("anio", "mes");
CREATE INDEX "FacturacionDoc_usuarioAprobacion_idx" ON "FacturacionDoc"("usuarioAprobacion");
CREATE INDEX "FacturacionDoc_clienteRazon_idx" ON "FacturacionDoc"("clienteRazon");

-- CreateIndex
CREATE INDEX "GastoDoc_anio_mes_idx" ON "GastoDoc"("anio", "mes");
CREATE INDEX "GastoDoc_estado_idx" ON "GastoDoc"("estado");

-- CreateIndex
CREATE INDEX "FacturaAnulada_anio_mes_idx" ON "FacturaAnulada"("anio", "mes");
CREATE INDEX "FacturaAnulada_motivo_idx" ON "FacturaAnulada"("motivo");
CREATE INDEX "FacturaAnulada_responsable_idx" ON "FacturaAnulada"("responsable");

-- CreateIndex
CREATE INDEX "PedidoPendiente_clienteRazon_idx" ON "PedidoPendiente"("clienteRazon");
CREATE INDEX "PedidoPendiente_motivoPendiente_idx" ON "PedidoPendiente"("motivoPendiente");

-- CreateIndex
CREATE INDEX "CargaSiesa_cargadaEn_idx" ON "CargaSiesa"("cargadaEn");
