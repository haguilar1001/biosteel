-- Recepción: cada criterio guarda la OPCIÓN del desplegable (texto) + su
-- especificación requerida. Se retira el enum ResultadoInspeccion.

-- AddColumn
ALTER TABLE "RecepcionCriterio" ADD COLUMN "especificacion" TEXT NOT NULL DEFAULT '';

-- AlterColumn: resultado enum → texto
ALTER TABLE "RecepcionCriterio" ALTER COLUMN "resultado" DROP DEFAULT;
ALTER TABLE "RecepcionCriterio" ALTER COLUMN "resultado" TYPE TEXT USING (
  CASE "resultado"::text
    WHEN 'conforme' THEN 'Conforme'
    WHEN 'no_conforme' THEN 'No conforme'
    WHEN 'cuarentena' THEN 'Cuarentena'
    ELSE 'Conforme'
  END
);
ALTER TABLE "RecepcionCriterio" ALTER COLUMN "resultado" SET DEFAULT 'Conforme';

-- DropEnum
DROP TYPE "ResultadoInspeccion";
