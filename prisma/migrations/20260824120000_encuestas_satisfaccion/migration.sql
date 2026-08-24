-- CreateTable
CREATE TABLE "EncuestaSatisfaccion" (
    "id" SERIAL NOT NULL,
    "tipo" TEXT NOT NULL,
    "origenId" TEXT,
    "fecha" TIMESTAMP(3),
    "anio" INTEGER NOT NULL,
    "cliente" TEXT NOT NULL,
    "cargo" TEXT,
    "ciudad" TEXT,
    "recomienda" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EncuestaSatisfaccion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EncuestaRespuesta" (
    "id" SERIAL NOT NULL,
    "encuestaId" INTEGER NOT NULL,
    "codigo" TEXT NOT NULL,
    "valor" INTEGER NOT NULL,

    CONSTRAINT "EncuestaRespuesta_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EncuestaSatisfaccion_tipo_anio_idx" ON "EncuestaSatisfaccion"("tipo", "anio");

-- CreateIndex
CREATE INDEX "EncuestaRespuesta_encuestaId_idx" ON "EncuestaRespuesta"("encuestaId");

-- CreateIndex
CREATE INDEX "EncuestaRespuesta_codigo_idx" ON "EncuestaRespuesta"("codigo");

-- AddForeignKey
ALTER TABLE "EncuestaRespuesta" ADD CONSTRAINT "EncuestaRespuesta_encuestaId_fkey" FOREIGN KEY ("encuestaId") REFERENCES "EncuestaSatisfaccion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

