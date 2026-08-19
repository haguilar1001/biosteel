-- Inventario de material de osteosíntesis (SIESA): catálogo de bodegas,
-- balance valorizado mensual por instalación y movimientos por documento.

-- CreateTable
CREATE TABLE "InvBodega" (
    "codigo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "ciudad" TEXT NOT NULL DEFAULT '',
    "tipoCompra" TEXT NOT NULL DEFAULT '',
    "modeloCompra" TEXT NOT NULL DEFAULT '',
    "instalacion" INTEGER NOT NULL,
    "inferida" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "InvBodega_pkey" PRIMARY KEY ("codigo")
);

-- CreateTable
CREATE TABLE "InvBalance" (
    "id" SERIAL NOT NULL,
    "anio" INTEGER NOT NULL,
    "mes" INTEGER NOT NULL,
    "instalacion" INTEGER NOT NULL,
    "item" TEXT NOT NULL,
    "referencia" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL DEFAULT '',
    "tipoInv" TEXT NOT NULL DEFAULT '',
    "marca" TEXT NOT NULL DEFAULT '',
    "linea" TEXT NOT NULL DEFAULT '',
    "anatomia" TEXT NOT NULL DEFAULT '',
    "sistema" TEXT NOT NULL DEFAULT '',
    "categoria" TEXT NOT NULL DEFAULT '',
    "cantEntradas" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "cantSalidas" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "cantFinal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "valorInicial" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "valorEntradas" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "valorSalidas" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "valorFinal" DECIMAL(18,2) NOT NULL DEFAULT 0,

    CONSTRAINT "InvBalance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvMovimiento" (
    "id" SERIAL NOT NULL,
    "fecha" DATE NOT NULL,
    "anio" INTEGER NOT NULL,
    "mes" INTEGER NOT NULL,
    "bodegaCodigo" TEXT NOT NULL,
    "referencia" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL DEFAULT '',
    "lote" TEXT NOT NULL DEFAULT '',
    "documento" TEXT NOT NULL,
    "tipoDoc" TEXT NOT NULL,
    "descTipoDoc" TEXT NOT NULL DEFAULT '',
    "ordenInterno" TEXT NOT NULL DEFAULT '',
    "cantEntradas" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "cantSalidas" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "costoEntradas" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "costoSalidas" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "costoUnit" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "marca" TEXT NOT NULL DEFAULT '',
    "linea" TEXT NOT NULL DEFAULT '',
    "anatomia" TEXT NOT NULL DEFAULT '',
    "usuario" TEXT NOT NULL DEFAULT '',
    "notas" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "InvMovimiento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InvBodega_instalacion_idx" ON "InvBodega"("instalacion");

-- CreateIndex
CREATE INDEX "InvBodega_ciudad_idx" ON "InvBodega"("ciudad");

-- CreateIndex
CREATE UNIQUE INDEX "InvBalance_anio_mes_instalacion_item_key" ON "InvBalance"("anio", "mes", "instalacion", "item");

-- CreateIndex
CREATE INDEX "InvBalance_anio_mes_idx" ON "InvBalance"("anio", "mes");

-- CreateIndex
CREATE INDEX "InvBalance_referencia_idx" ON "InvBalance"("referencia");

-- CreateIndex
CREATE INDEX "InvBalance_marca_idx" ON "InvBalance"("marca");

-- CreateIndex
CREATE INDEX "InvMovimiento_anio_mes_idx" ON "InvMovimiento"("anio", "mes");

-- CreateIndex
CREATE INDEX "InvMovimiento_fecha_idx" ON "InvMovimiento"("fecha");

-- CreateIndex
CREATE INDEX "InvMovimiento_bodegaCodigo_idx" ON "InvMovimiento"("bodegaCodigo");

-- CreateIndex
CREATE INDEX "InvMovimiento_referencia_idx" ON "InvMovimiento"("referencia");

-- CreateIndex
CREATE INDEX "InvMovimiento_tipoDoc_idx" ON "InvMovimiento"("tipoDoc");

-- CreateIndex
CREATE INDEX "InvMovimiento_documento_idx" ON "InvMovimiento"("documento");

-- AddForeignKey
ALTER TABLE "InvMovimiento" ADD CONSTRAINT "InvMovimiento_bodegaCodigo_fkey" FOREIGN KEY ("bodegaCodigo") REFERENCES "InvBodega"("codigo") ON DELETE CASCADE ON UPDATE CASCADE;
