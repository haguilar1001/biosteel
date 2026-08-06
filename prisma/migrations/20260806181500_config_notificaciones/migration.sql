-- CreateTable
CREATE TABLE "ConfigNotificaciones" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "diasAntes" INTEGER NOT NULL DEFAULT 5,
    "destinatarios" TEXT NOT NULL,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,
    "actualizadoPor" TEXT,

    CONSTRAINT "ConfigNotificaciones_pkey" PRIMARY KEY ("id")
);
