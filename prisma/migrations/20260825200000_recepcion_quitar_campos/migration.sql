-- Se quitan campos del encabezado no usados: hora de recepción, nº lote de
-- despacho y fecha de caducidad (la caducidad se registra por ítem).
ALTER TABLE "RecepcionTecnica" DROP COLUMN "horaRecepcion";
ALTER TABLE "RecepcionTecnica" DROP COLUMN "loteDespacho";
ALTER TABLE "RecepcionTecnica" DROP COLUMN "fechaCaducidad";
