-- CreateEnum
CREATE TYPE "EstadoInventario" AS ENUM ('activo', 'en_reparacion', 'de_baja', 'pendiente');

-- CreateEnum
CREATE TYPE "TipoItemInventario" AS ENUM ('equipo', 'accesorio');

-- CreateEnum
CREATE TYPE "TipoNovedad" AS ENUM ('compra', 'baja', 'dano', 'reparacion', 'retorno_reparacion', 'traslado');

-- CreateTable
CREATE TABLE "EquipoInventario" (
    "id" SERIAL NOT NULL,
    "sedeId" INTEGER NOT NULL,
    "categoria" TEXT NOT NULL,
    "marca" TEXT NOT NULL,
    "nombre" TEXT,
    "observaciones" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EquipoInventario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemInventario" (
    "id" SERIAL NOT NULL,
    "equipoId" INTEGER NOT NULL,
    "descripcion" TEXT NOT NULL,
    "tipo" "TipoItemInventario" NOT NULL DEFAULT 'accesorio',
    "cantidad" INTEGER NOT NULL DEFAULT 1,
    "lote" TEXT,
    "estado" "EstadoInventario" NOT NULL DEFAULT 'activo',
    "observaciones" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ItemInventario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NovedadInventario" (
    "id" SERIAL NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tipo" "TipoNovedad" NOT NULL,
    "equipoId" INTEGER NOT NULL,
    "itemId" INTEGER,
    "sedeOrigenId" INTEGER,
    "sedeDestinoId" INTEGER,
    "estadoAnterior" "EstadoInventario",
    "estadoNuevo" "EstadoInventario",
    "descripcion" TEXT,
    "usuarioId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NovedadInventario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EquipoInventario_sedeId_idx" ON "EquipoInventario"("sedeId");

-- CreateIndex
CREATE INDEX "EquipoInventario_categoria_idx" ON "EquipoInventario"("categoria");

-- CreateIndex
CREATE INDEX "ItemInventario_equipoId_idx" ON "ItemInventario"("equipoId");

-- CreateIndex
CREATE INDEX "ItemInventario_estado_idx" ON "ItemInventario"("estado");

-- CreateIndex
CREATE INDEX "NovedadInventario_equipoId_idx" ON "NovedadInventario"("equipoId");

-- CreateIndex
CREATE INDEX "NovedadInventario_tipo_idx" ON "NovedadInventario"("tipo");

-- CreateIndex
CREATE INDEX "NovedadInventario_fecha_idx" ON "NovedadInventario"("fecha");

-- AddForeignKey
ALTER TABLE "EquipoInventario" ADD CONSTRAINT "EquipoInventario_sedeId_fkey" FOREIGN KEY ("sedeId") REFERENCES "Sede"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemInventario" ADD CONSTRAINT "ItemInventario_equipoId_fkey" FOREIGN KEY ("equipoId") REFERENCES "EquipoInventario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NovedadInventario" ADD CONSTRAINT "NovedadInventario_equipoId_fkey" FOREIGN KEY ("equipoId") REFERENCES "EquipoInventario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NovedadInventario" ADD CONSTRAINT "NovedadInventario_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

