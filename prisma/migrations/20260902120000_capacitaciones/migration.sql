-- Capacitaciones (Gestión Humana): consolidado del plan de formación.
CREATE TABLE "Capacitacion" (
    "id" SERIAL NOT NULL,
    "anio" INTEGER NOT NULL,
    "mes" INTEGER NOT NULL,
    "capacitacion" TEXT NOT NULL,
    "colaborador" TEXT NOT NULL,
    "pre" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "post" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "final" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "observaciones" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "Capacitacion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Capacitacion_anio_mes_capacitacion_colaborador_key"
    ON "Capacitacion"("anio", "mes", "capacitacion", "colaborador");
CREATE INDEX "Capacitacion_anio_mes_idx" ON "Capacitacion"("anio", "mes");
CREATE INDEX "Capacitacion_colaborador_idx" ON "Capacitacion"("colaborador");
CREATE INDEX "Capacitacion_capacitacion_idx" ON "Capacitacion"("capacitacion");

-- Plan de formación por mes: denominador del indicador de ejecución.
CREATE TABLE "CapacitacionPlan" (
    "anio" INTEGER NOT NULL,
    "mes" INTEGER NOT NULL,
    "planeadas" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CapacitacionPlan_pkey" PRIMARY KEY ("anio", "mes")
);
