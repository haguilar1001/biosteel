-- CreateTable
CREATE TABLE "ProveedorEstado" (
    "id" SERIAL NOT NULL,
    "marca" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'ACTIVO',
    "motivo" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProveedorEstado_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProveedorEstado_marca_key" ON "ProveedorEstado"("marca");

-- CreateIndex
CREATE INDEX "ProveedorEstado_estado_idx" ON "ProveedorEstado"("estado");

