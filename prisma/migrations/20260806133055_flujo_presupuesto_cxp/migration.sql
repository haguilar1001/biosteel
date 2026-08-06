-- CreateEnum
CREATE TYPE "TipoMovimiento" AS ENUM ('ingreso', 'egreso');

-- AlterTable
ALTER TABLE "DocumentoCxp" ADD COLUMN     "concepto" TEXT,
ADD COLUMN     "plazo" INTEGER;

-- CreateTable
CREATE TABLE "CategoriaFlujo" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" "TipoMovimiento" NOT NULL DEFAULT 'egreso',
    "orden" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "CategoriaFlujo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MovimientoFlujo" (
    "id" SERIAL NOT NULL,
    "fecha" DATE NOT NULL,
    "anio" INTEGER NOT NULL,
    "mes" INTEGER NOT NULL,
    "tipo" "TipoMovimiento" NOT NULL,
    "categoriaId" INTEGER,
    "terceroNombre" TEXT NOT NULL,
    "nit" TEXT,
    "beneficiario" TEXT,
    "detalle" TEXT,
    "observacion" TEXT,
    "valor" DECIMAL(18,2) NOT NULL,
    "saldo" DECIMAL(18,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MovimientoFlujo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PresupuestoMensual" (
    "id" SERIAL NOT NULL,
    "anio" INTEGER NOT NULL,
    "mes" INTEGER NOT NULL,
    "categoriaId" INTEGER NOT NULL,
    "terceroNombre" TEXT,
    "valor" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "PresupuestoMensual_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CategoriaFlujo_nombre_key" ON "CategoriaFlujo"("nombre");

-- CreateIndex
CREATE INDEX "MovimientoFlujo_anio_mes_idx" ON "MovimientoFlujo"("anio", "mes");

-- CreateIndex
CREATE INDEX "MovimientoFlujo_tipo_idx" ON "MovimientoFlujo"("tipo");

-- CreateIndex
CREATE INDEX "MovimientoFlujo_categoriaId_idx" ON "MovimientoFlujo"("categoriaId");

-- CreateIndex
CREATE INDEX "PresupuestoMensual_anio_mes_idx" ON "PresupuestoMensual"("anio", "mes");

-- CreateIndex
CREATE INDEX "PresupuestoMensual_categoriaId_idx" ON "PresupuestoMensual"("categoriaId");

-- AddForeignKey
ALTER TABLE "MovimientoFlujo" ADD CONSTRAINT "MovimientoFlujo_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "CategoriaFlujo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PresupuestoMensual" ADD CONSTRAINT "PresupuestoMensual_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "CategoriaFlujo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
