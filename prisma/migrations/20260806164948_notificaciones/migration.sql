-- CreateTable
CREATE TABLE "NotificacionEnviada" (
    "id" SERIAL NOT NULL,
    "clave" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "referencia" TEXT NOT NULL,
    "fechaEvento" DATE NOT NULL,
    "destinatarios" TEXT NOT NULL,
    "asunto" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'enviada',
    "error" TEXT,
    "enviadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificacionEnviada_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NotificacionEnviada_clave_key" ON "NotificacionEnviada"("clave");

-- CreateIndex
CREATE INDEX "NotificacionEnviada_enviadaEn_idx" ON "NotificacionEnviada"("enviadaEn");
