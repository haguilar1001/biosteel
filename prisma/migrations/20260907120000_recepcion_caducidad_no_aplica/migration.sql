-- Recepción Técnica: marca explícita de "no aplica" para la fecha de
-- caducidad (compras nacionales, material que no vence).
ALTER TABLE "RecepcionItem" ADD COLUMN "caducidadNoAplica" BOOLEAN NOT NULL DEFAULT false;
