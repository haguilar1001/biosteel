-- Asistencia Técnica: evaluaciones de seguimiento a los asesores quirúrgicos.
-- Se guarda la evaluación cruda (una fila por cirugía evaluada) y los promedios
-- por mes, por asesor y por ítem se calculan; así el histórico no depende de
-- cómo se agregó. PQRS va en su propia tabla: no sale de las evaluaciones.

-- CreateTable
CREATE TABLE "EvaluacionAsesor" (
    "id" SERIAL NOT NULL,
    "fecha" DATE NOT NULL,
    "anio" INTEGER NOT NULL,
    "mes" INTEGER NOT NULL,
    "paciente" TEXT NOT NULL DEFAULT '',
    "procedimiento" TEXT NOT NULL DEFAULT '',
    "ips" TEXT NOT NULL DEFAULT '',
    "especialista" TEXT NOT NULL DEFAULT '',
    "asesor" TEXT NOT NULL,
    "conocimiento" DECIMAL(4,2) NOT NULL,
    "desempeno" DECIMAL(4,2) NOT NULL,
    "capacidad" DECIMAL(4,2) NOT NULL,
    "habilidad" DECIMAL(4,2) NOT NULL,
    "novedades" BOOLEAN NOT NULL DEFAULT false,
    "eventos" BOOLEAN NOT NULL DEFAULT false,
    "incidentes" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "EvaluacionAsesor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PqrsMes" (
    "id" SERIAL NOT NULL,
    "anio" INTEGER NOT NULL,
    "mes" INTEGER NOT NULL,
    "casos" INTEGER NOT NULL DEFAULT 0,
    "observacion" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "PqrsMes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EvaluacionAsesor_anio_mes_idx" ON "EvaluacionAsesor"("anio", "mes");

-- CreateIndex
CREATE INDEX "EvaluacionAsesor_asesor_idx" ON "EvaluacionAsesor"("asesor");

-- CreateIndex
CREATE INDEX "EvaluacionAsesor_fecha_idx" ON "EvaluacionAsesor"("fecha");

-- CreateIndex
CREATE UNIQUE INDEX "PqrsMes_anio_mes_key" ON "PqrsMes"("anio", "mes");
