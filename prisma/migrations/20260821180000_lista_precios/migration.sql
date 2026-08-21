-- Lista de precios ("Desc. lista de precios" del reporte de ventas por item).
-- Sin esta columna no se puede saber que tarifa deja un item en perdida.
--
-- Las filas ya cargadas quedan con '' (sin lista) hasta que se vuelvan a
-- cargar los archivos de ventas: el dato solo existe en el origen.

ALTER TABLE "VentaDoc" ADD COLUMN "lista" TEXT NOT NULL DEFAULT '';

ALTER TABLE "VentaItemIps" ADD COLUMN "lista" TEXT NOT NULL DEFAULT '';

-- La lista entra en la llave: el mismo item puede venderse a la misma IPS con
-- dos tarifas distintas en el mismo mes, y son dos margenes que no se suman.
DROP INDEX "VentaItemIps_anio_mes_marca_referencia_ips_key";
CREATE UNIQUE INDEX "VentaItemIps_anio_mes_marca_referencia_ips_lista_key"
  ON "VentaItemIps"("anio", "mes", "marca", "referencia", "ips", "lista");

CREATE INDEX "VentaItemIps_lista_idx" ON "VentaItemIps"("lista");
