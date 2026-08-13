-- Ventas crudas (renglón) + venta neta por día.

-- CreateTable
CREATE TABLE "VentaDoc" (
    "id" SERIAL NOT NULL,
    "nro" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "aprobada" BOOLEAN NOT NULL DEFAULT false,
    "fecha" DATE NOT NULL,
    "anio" INTEGER NOT NULL,
    "mes" INTEGER NOT NULL,
    "dia" INTEGER NOT NULL,
    "ips" TEXT,
    "suc" TEXT NOT NULL DEFAULT '',
    "bod" TEXT NOT NULL DEFAULT '',
    "notas" TEXT NOT NULL DEFAULT '',
    "conv" TEXT NOT NULL DEFAULT '',
    "proc" TEXT NOT NULL DEFAULT '',
    "linea" TEXT NOT NULL DEFAULT '',
    "subtotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "fbd" TEXT,
    "costo" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "cliente" TEXT NOT NULL DEFAULT '',
    "nit" TEXT,
    "marca" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "VentaDoc_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VentaDia" (
    "id" SERIAL NOT NULL,
    "anio" INTEGER NOT NULL,
    "mes" INTEGER NOT NULL,
    "dia" INTEGER NOT NULL,
    "valor" DECIMAL(18,2) NOT NULL,
    "costo" DECIMAL(18,2) NOT NULL DEFAULT 0,

    CONSTRAINT "VentaDia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VentaDoc_anio_mes_idx" ON "VentaDoc"("anio", "mes");
CREATE INDEX "VentaDoc_fecha_idx" ON "VentaDoc"("fecha");

-- CreateIndex
CREATE UNIQUE INDEX "VentaDia_anio_mes_dia_key" ON "VentaDia"("anio", "mes", "dia");
CREATE INDEX "VentaDia_anio_mes_idx" ON "VentaDia"("anio", "mes");
