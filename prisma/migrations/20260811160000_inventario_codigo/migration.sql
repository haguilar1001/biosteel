-- AlterTable
ALTER TABLE "EquipoInventario" ADD COLUMN     "codigo" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "EquipoInventario_codigo_key" ON "EquipoInventario"("codigo");

