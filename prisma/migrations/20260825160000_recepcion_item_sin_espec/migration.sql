-- La "especificación requerida" a nivel de ítem es redundante: cada criterio
-- de inspección ya trae la suya. Se elimina la columna del ítem.
ALTER TABLE "RecepcionItem" DROP COLUMN "especificacion";
