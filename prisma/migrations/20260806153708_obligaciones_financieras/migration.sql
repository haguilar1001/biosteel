-- CreateTable
CREATE TABLE "ObligacionFinanciera" (
    "id" SERIAL NOT NULL,
    "entidad" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'COP',
    "montoInicial" DECIMAL(18,2),
    "saldoCapital" DECIMAL(18,2) NOT NULL,
    "tasaEA" DECIMAL(7,4),
    "cuotaMensual" DECIMAL(18,2),
    "diaPago" INTEGER,
    "periodicidad" TEXT NOT NULL DEFAULT 'mensual',
    "fechaDesembolso" DATE,
    "fechaVencimiento" DATE,
    "corte" DATE,
    "estado" TEXT NOT NULL DEFAULT 'al_dia',
    "notas" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ObligacionFinanciera_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ObligacionFinanciera_numero_key" ON "ObligacionFinanciera"("numero");
